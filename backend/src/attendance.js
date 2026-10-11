import mongoose from "mongoose";
import {
  Attendance,
  Session,
  Assignment,
  Enrollment,
  User,
  Audit,
  Notification,
  settings,
} from "./models.js";
import { assert, verifyQR } from "./security.js";
export let publish = () => {};
export function setPublisher(fn) {
  publish = fn;
}
export async function transaction(fn) {
  const db = await mongoose.startSession();
  try {
    let result;
    await db.withTransaction(
      async () => {
        result = await fn(db);
      },
      { writeConcern: { w: "majority" } },
    );
    return result;
  } finally {
    await db.endSession();
  }
}
export const manages = (user, s) =>
  user.role === "admin" ||
  (user.role === "faculty" && String(s.facultyId) === String(user._id));
export async function accessible(user, id) {
  const s = await Session.findById(id);
  assert(s, 404, "Attendance session not found");
  assert(
    manages(user, s) ||
      (user.role === "student" &&
        s.roster.some((x) => String(x) === String(user._id))),
    403,
    "This session is not assigned to you",
  );
  return s;
}
export async function createSession(user, input) {
  const a = await Assignment.findById(input.assignmentId).populate("subjectId");
  assert(a?.isActive, 400, "Select an active teaching assignment");
  assert(
    user.role === "admin" || String(a.facultyId) === String(user._id),
    403,
    "This subject is not assigned to you",
  );
  assert(
    await User.exists({ _id: a.facultyId, isActive: true }),
    400,
    "Assigned faculty account is inactive",
  );
  const policy = await settings();
  const enrollments = await Enrollment.find({
    assignmentId: a._id,
    isActive: true,
  });
  const roster = await User.find({
    _id: { $in: enrollments.map((x) => x.studentId) },
    isActive: true,
    role: "student",
  }).select("_id");
  assert(roster.length, 400, "Enroll students before starting attendance");
  assert(roster.length <= 500, 400, "Maximum 500 students per session");
  const now = new Date();
  const duration = input.durationMinutes || policy.sessionMinutes;
  return transaction(async (db) => {
    const [s] = await Session.create(
      [
        {
          assignmentId: a._id,
          facultyId: a.facultyId,
          subjectId: a.subjectId._id,
          classId: a.classId,
          title: a.subjectId.name,
          startsAt: now,
          endsAt: new Date(+now + duration * 60000),
          lateAt: new Date(+now + policy.lateMinutes * 60000),
          roster: roster.map((x) => x._id),
          policy: {
            qrSeconds: policy.qrSeconds,
            threshold: policy.threshold,
            lateCounts: policy.lateCounts,
          },
        },
      ],
      { session: db },
    );
    await Audit.create(
      [{ actorId: user._id, action: "session.start", targetId: String(s._id) }],
      { session: db },
    );
    return s;
  });
}
export async function scan(user, token) {
  const qr = verifyQR(token);
  const result = await transaction(async (db) => {
    const s = await Session.findById(qr.sid).session(db);
    assert(s, 404, "Session not found");
    assert(
      s.roster.some((x) => String(x) === String(user._id)),
      403,
      "You are not enrolled in this session",
    );
    const existing = await Attendance.findOne({
      sessionId: s._id,
      studentId: user._id,
    }).session(db);
    if (existing && existing.method !== "auto")
      return { record: existing, alreadyMarked: true };
    const now = new Date();
    assert(
      s.status === "active" && s.endsAt > now,
      409,
      "Attendance session has ended",
    );
    assert(qr.exp * 1000 > +now, 400, "QR expired. Scan the current code.");
    const gate = await Session.updateOne(
      { _id: s._id, status: "active", endsAt: { $gt: now } },
      { $inc: { revision: 1 } },
      { session: db },
    );
    assert(gate.modifiedCount, 409, "Attendance session has ended");
    const [record] = await Attendance.create(
      [
        {
          sessionId: s._id,
          studentId: user._id,
          status: now > s.lateAt ? "late" : "present",
          method: "qr",
          markedAt: now,
        },
      ],
      { session: db },
    );
    return { record, alreadyMarked: false };
  });
  publish(String(result.record.sessionId));
  return result;
}
export async function closeSession(id, actor = null, cancelReason = null) {
  const result = await transaction(async (db) => {
    const s = await Session.findById(id).session(db);
    assert(s, 404, "Session not found");
    if (actor) assert(manages(actor, s), 403, "Session not assigned to you");
    if (s.status !== "active") {
      assert(
        !cancelReason || s.status === "cancelled",
        409,
        "Only active sessions can be cancelled",
      );
      return s;
    }
    const now = new Date();
    s.status = cancelReason ? "cancelled" : "closed";
    s.cancelReason = cancelReason || undefined;
    s.closedAt = now;
    s.revision++;
    await s.save({ session: db });
    if (!cancelReason) {
      const marked = await Attendance.find({ sessionId: s._id })
        .session(db)
        .select("studentId");
      const ids = new Set(marked.map((x) => String(x.studentId)));
      const absent = s.roster
        .filter((x) => !ids.has(String(x)))
        .map((studentId) => ({
          sessionId: s._id,
          studentId,
          status: "absent",
          method: "auto",
        }));
      if (absent.length) await Attendance.insertMany(absent, { session: db });
    }
    await Audit.create(
      [
        {
          actorId: actor?._id,
          action: cancelReason ? "session.cancel" : "session.close",
          targetId: String(id),
          reason: cancelReason || (actor ? "Manual close" : "Scheduled close"),
        },
      ],
      { session: db },
    );
    return s;
  });
  publish(String(id));
  return result;
}
export async function correctAttendance(user, id, input) {
  const result = await transaction(async (db) => {
    const s = await Session.findById(id).session(db);
    assert(s, 404, "Session not found");
    assert(manages(user, s), 403, "Session not assigned to you");
    assert(
      s.status !== "cancelled",
      409,
      "Cancelled session cannot be changed",
    );
    assert(
      s.roster.some((x) => String(x) === input.studentId),
      400,
      "Student is not on the session roster",
    );
    await Session.updateOne(
      { _id: id },
      { $inc: { revision: 1 } },
      { session: db },
    );
    const before = await Attendance.findOne({
      sessionId: id,
      studentId: input.studentId,
    })
      .session(db)
      .lean();
    const record = await Attendance.findOneAndUpdate(
      { sessionId: id, studentId: input.studentId },
      {
        $set: {
          status: input.status,
          method: "manual",
          markedAt: new Date(),
          reason: input.reason,
        },
      },
      { new: true, upsert: true, runValidators: true, session: db },
    );
    await Audit.create(
      [
        {
          actorId: user._id,
          action: "attendance.correct",
          targetId: String(record._id),
          reason: input.reason,
          before,
          after: record.toObject(),
        },
      ],
      { session: db },
    );
    return record;
  });
  publish(id);
  return result;
}
export async function sessionList(user) {
  let filter = {};
  if (user.role === "faculty") filter.facultyId = user._id;
  if (user.role === "student") filter.roster = user._id;
  return Session.find(filter)
    .select(user.role === "student" ? "-roster" : "")
    .sort({ startsAt: -1 })
    .limit(200)
    .populate("classId", "name")
    .populate("facultyId", "name")
    .lean();
}
export async function reportRows(user, query = {}) {
  const filter = { status: "closed" };
  if (user.role === "faculty") filter.facultyId = user._id;
  if (user.role === "student") filter.roster = user._id;
  if (query.classId) filter.classId = query.classId;
  if (query.subjectId) filter.subjectId = query.subjectId;
  if (query.from || query.to) {
    filter.startsAt = {};
    if (query.from) filter.startsAt.$gte = new Date(query.from);
    if (query.to) filter.startsAt.$lte = new Date(query.to + "T23:59:59.999Z");
  }
  const sessions = await Session.find(filter)
    .select("-roster")
    .populate("classId", "name")
    .populate("subjectId", "name code")
    .sort({ startsAt: -1 })
    .limit(2000)
    .lean();
  const map = new Map(sessions.map((x) => [String(x._id), x]));
  const f = { sessionId: { $in: sessions.map((x) => x._id) } };
  if (user.role === "student") f.studentId = user._id;
  const rows = await Attendance.find(f)
    .populate("studentId", "name code email")
    .lean();
  return rows
    .filter((r) => r.studentId)
    .map((r) => {
      const s = map.get(String(r.sessionId));
      return { ...r, session: s };
    });
}
export function percentages(rows) {
  const groups = new Map();
  for (const r of rows) {
    const key = String(r.studentId._id) + ":" + String(r.session.subjectId._id);
    if (!groups.has(key))
      groups.set(key, {
        studentId: r.studentId._id,
        name: r.studentId.name,
        code: r.studentId.code,
        subject: r.session.subjectId.name,
        subjectId: r.session.subjectId._id,
        total: 0,
        attended: 0,
        excused: 0,
      });
    const g = groups.get(key);
    if (r.status === "excused") {
      g.excused++;
      continue;
    }
    g.total++;
    if (
      r.status === "present" ||
      (r.status === "late" && r.session.policy.lateCounts)
    )
      g.attended++;
  }
  return [...groups.values()].map((g) => ({
    ...g,
    percentage: g.total
      ? Math.round((g.attended / g.total) * 10000) / 100
      : null,
  }));
}
let busy = false,
  lastNoticeRun = 0;
export async function sweep() {
  if (busy) return;
  busy = true;
  try {
    const overdue = await Session.find({
      status: "active",
      endsAt: { $lte: new Date() },
    }).select("_id");
    for (const s of overdue) await closeSession(s._id);
    if (Date.now() - lastNoticeRun < 3600000) return;
    const policy = await settings();
    const groups = percentages(await reportRows({ role: "admin" }));
    const day = new Date().toISOString().slice(0, 10);
    for (const g of groups.filter(
      (x) => x.percentage !== null && x.percentage < policy.threshold,
    )) {
      await Notification.updateOne(
        { key: `shortage:${g.studentId}:${g.subjectId}:${day}` },
        {
          $setOnInsert: {
            recipientId: g.studentId,
            message: `${g.subject}: ${g.percentage}% attendance, below the ${policy.threshold}% threshold.`,
          },
        },
        { upsert: true },
      );
    }
    lastNoticeRun = Date.now();
  } finally {
    busy = false;
  }
}
