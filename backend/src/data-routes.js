import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import {
  User,
  Department,
  Class,
  Subject,
  Assignment,
  Enrollment,
  Timetable,
  Audit,
  Settings,
  Notification,
  Refresh,
  settings,
} from "./models.js";
import { assert, roles, publicUser } from "./security.js";
import { password } from "./auth-routes.js";
import { transaction } from "./attendance.js";
export const oid = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid record identifier");
const name = z.string().trim().min(2).max(120),
  code = z.string().trim().min(2).max(40),
  time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const userSchema = z
  .object({
    name,
    email: z
      .string()
      .email()
      .max(254)
      .transform((x) => x.toLowerCase().trim()),
    code,
    role: z.enum(["student", "faculty", "admin"]),
    classId: oid.nullish(),
    departmentId: oid.nullish(),
    isActive: z.boolean().optional(),
    password: password.optional(),
  })
  .strict();
const definitions = {
  departments: {
    model: Department,
    validation: z.object({ name, code }).strict(),
  },
  classes: {
    model: Class,
    validation: z
      .object({
        name,
        departmentId: oid,
        academicYear: z.string().regex(/^\d{4}–\d{4}$|^\d{4}-\d{4}$/),
        semester: z.number().int().min(1).max(12),
      })
      .strict(),
  },
  subjects: {
    model: Subject,
    validation: z.object({ name, code, departmentId: oid }).strict(),
  },
  assignments: {
    model: Assignment,
    validation: z
      .object({
        facultyId: oid,
        subjectId: oid,
        classId: oid,
        isActive: z.boolean().optional(),
      })
      .strict(),
  },
  enrollments: {
    model: Enrollment,
    validation: z
      .object({
        studentId: oid,
        assignmentId: oid,
        isActive: z.boolean().optional(),
      })
      .strict(),
  },
  timetable: {
    model: Timetable,
    validation: z
      .object({
        assignmentId: oid,
        day: z.number().int().min(0).max(6),
        startTime: time,
        endTime: time,
        room: z.string().trim().max(60),
      })
      .strict(),
  },
};
const router = Router();
async function validateReferences(resource, data, id) {
  for (const [key, model] of Object.entries({
    departmentId: Department,
    classId: Class,
    subjectId: Subject,
    assignmentId: Assignment,
  })) {
    if (data[key])
      assert(await model.exists({ _id: data[key] }), 400, `Unknown ${key}`);
  }
  if (data.facultyId)
    assert(
      await User.exists({
        _id: data.facultyId,
        role: "faculty",
        isActive: true,
      }),
      400,
      "Choose an active faculty member",
    );
  if (data.studentId) {
    const u = await User.findById(data.studentId);
    const a = await Assignment.findById(data.assignmentId);
    assert(
      u?.role === "student" && u.isActive,
      400,
      "Choose an active student",
    );
    assert(
      a && String(a.classId) === String(u.classId),
      400,
      "Student and assignment must belong to the same class",
    );
  }
  if (resource === "timetable") {
    assert(
      data.startTime < data.endTime,
      400,
      "End time must be after start time",
    );
    const a = await Assignment.findById(data.assignmentId);
    const related = await Assignment.find({
      $or: [{ facultyId: a.facultyId }, { classId: a.classId }],
    }).select("_id");
    assert(
      !(await Timetable.exists({
        _id: { $ne: id },
        day: data.day,
        startTime: { $lt: data.endTime },
        endTime: { $gt: data.startTime },
        assignmentId: { $in: related.map((x) => x._id) },
      })),
      409,
      "This time overlaps another class or faculty period",
    );
  }
}
router.get("/catalog", async (req, res) => {
  const user = req.user;
  let af = {};
  if (user.role === "faculty") af.facultyId = user._id;
  if (user.role === "student") {
    const es = await Enrollment.find({ studentId: user._id, isActive: true });
    af._id = { $in: es.map((e) => e.assignmentId) };
  }
  const assignments = await Assignment.find(af)
    .populate("facultyId", "name code")
    .populate("subjectId", "name code")
    .populate("classId", "name")
    .lean();
  const aIds = assignments.map((x) => x._id);
  const all = user.role === "admin";
  const classIds = assignments.map((x) => x.classId?._id);
  const [
    departments,
    classes,
    subjects,
    timetable,
    users,
    enrollments,
    policy,
  ] = await Promise.all([
    Department.find().lean(),
    Class.find(all ? {} : { _id: { $in: classIds } }).lean(),
    Subject.find(
      all ? {} : { _id: { $in: assignments.map((x) => x.subjectId?._id) } },
    ).lean(),
    Timetable.find(all ? {} : { assignmentId: { $in: aIds } }).lean(),
    all ? User.find().select("-tokenVersion").limit(5000).lean() : [],
    all ? Enrollment.find().limit(10000).lean() : [],
    settings(),
  ]);
  res.json({
    departments,
    classes,
    subjects,
    assignments,
    timetable,
    users,
    enrollments,
    settings: policy,
  });
});
router.get("/users", roles("admin"), async (req, res) => {
  res.json((await User.find().sort({ name: 1 }).limit(5000)).map(publicUser));
});
router.post("/users", roles("admin"), async (req, res) => {
  const data = userSchema.parse(req.body);
  assert(data.password, 400, "Temporary password is required");
  await validateReferences("users", data);
  if (data.role === "student")
    assert(data.classId, 400, "Student class is required");
  const { password: pw, ...rest } = data;
  const passwordHash = await bcrypt.hash(pw, 12);
  const user = await transaction(async (db) => {
    const [u] = await User.create(
      [{ ...rest, passwordHash, mustChangePassword: true }],
      { session: db },
    );
    await Audit.create(
      [
        {
          actorId: req.user._id,
          action: "user.create",
          targetId: String(u._id),
          after: publicUser(u),
        },
      ],
      { session: db },
    );
    return u;
  });
  res.status(201).json(publicUser(user));
});
router.patch("/users/:id", roles("admin"), async (req, res) => {
  const id = oid.parse(req.params.id);
  const data = userSchema
    .omit({ password: true, role: true })
    .partial()
    .parse(req.body);
  assert(
    String(req.user._id) !== id || data.isActive !== false,
    400,
    "You cannot deactivate your own account",
  );
  await validateReferences("users", data);
  const user = await transaction(async (db) => {
    const before = await User.findById(id).session(db);
    assert(before, 404, "User not found");
    assert(
      before.role !== "admin" || String(before._id) === String(req.user._id),
      403,
      "Other administrator accounts are protected",
    );
    if (before.role === "student")
      assert(data.classId || before.classId, 400, "Student class is required");
    const u = await User.findByIdAndUpdate(
      id,
      { $set: data, $inc: { tokenVersion: 1 } },
      { new: true, runValidators: true, session: db },
    );
    await Refresh.deleteMany({ userId: id }, { session: db });
    if (data.classId && String(before.classId) !== data.classId)
      await Enrollment.updateMany(
        { studentId: id },
        { $set: { isActive: false } },
        { session: db },
      );
    await Audit.create(
      [
        {
          actorId: req.user._id,
          action: "user.update",
          targetId: id,
          before: publicUser(before),
          after: publicUser(u),
        },
      ],
      { session: db },
    );
    return u;
  });
  res.json(publicUser(user));
});
router.post("/users/:id/password", roles("admin"), async (req, res) => {
  const id = oid.parse(req.params.id),
    data = z
      .object({ password, reason: z.string().trim().min(5).max(500) })
      .parse(req.body);
  const u = await User.findById(id);
  assert(
    u && u.role !== "admin",
    403,
    "Use self-service password change for administrators",
  );
  const passwordHash = await bcrypt.hash(data.password, 12);
  await transaction(async (db) => {
    await User.updateOne(
      { _id: id },
      {
        $set: { passwordHash, mustChangePassword: true },
        $inc: { tokenVersion: 1 },
      },
      { session: db },
    );
    await Refresh.deleteMany({ userId: id }, { session: db });
    await Audit.create(
      [
        {
          actorId: req.user._id,
          action: "user.password.temporary",
          targetId: id,
          reason: data.reason,
        },
      ],
      { session: db },
    );
  });
  res.json({ ok: true });
});
router.post("/users/import", roles("admin"), async (req, res) => {
  const input = z
    .object({ rows: z.array(userSchema).min(1).max(500) })
    .parse(req.body);
  const records = [];
  for (const [i, data] of input.rows.entries()) {
    assert(
      data.role === "student",
      400,
      `Row ${i + 1}: only student imports are supported`,
    );
    assert(
      data.password && data.classId,
      400,
      `Row ${i + 1}: class and temporary password are required`,
    );
    await validateReferences("users", data);
    const { password: pw, ...rest } = data;
    records.push({
      ...rest,
      passwordHash: await bcrypt.hash(pw, 12),
      mustChangePassword: true,
    });
  }
  const result = await transaction(async (db) => {
    const users = await User.insertMany(records, { session: db });
    await Audit.create(
      [
        {
          actorId: req.user._id,
          action: "students.import",
          after: { count: users.length },
        },
      ],
      { session: db },
    );
    return users;
  });
  res.status(201).json({ count: result.length });
});
router.post("/enroll-class", roles("admin"), async (req, res) => {
  const { assignmentId } = z.object({ assignmentId: oid }).parse(req.body);
  const a = await Assignment.findById(assignmentId);
  assert(a, 404, "Assignment not found");
  const students = await User.find({
    classId: a.classId,
    role: "student",
    isActive: true,
  });
  assert(students.length, 400, "No active students in this class");
  await transaction(async (db) => {
    await Enrollment.bulkWrite(
      students.map((u) => ({
        updateOne: {
          filter: { assignmentId, studentId: u._id },
          update: { $set: { isActive: true } },
          upsert: true,
        },
      })),
      { session: db },
    );
    await Audit.create(
      [
        {
          actorId: req.user._id,
          action: "enrollment.class",
          targetId: assignmentId,
          after: { count: students.length },
        },
      ],
      { session: db },
    );
  });
  res.json({ count: students.length });
});
for (const [resource, { model, validation }] of Object.entries(definitions)) {
  router.post(`/${resource}`, roles("admin"), async (req, res) => {
    const data = validation.parse(req.body);
    await validateReferences(resource, data);
    const item = await transaction(async (db) => {
      const [row] = await model.create([data], { session: db });
      await Audit.create(
        [
          {
            actorId: req.user._id,
            action: `${resource}.create`,
            targetId: String(row._id),
            after: data,
          },
        ],
        { session: db },
      );
      return row;
    });
    res.status(201).json(item);
  });
  router.patch(`/${resource}/:id`, roles("admin"), async (req, res) => {
    const id = oid.parse(req.params.id),
      data = validation.partial().parse(req.body);
    const old = await model.findById(id);
    assert(old, 404, "Record not found");
    await validateReferences(resource, { ...old.toObject(), ...data }, id);
    if (resource === "enrollments")
      assert(
        !data.studentId && !data.assignmentId,
        400,
        "Deactivate the enrollment and create a new one to change its identity",
      );
    if (resource === "assignments")
      assert(
        !data.classId && !data.subjectId,
        400,
        "Class and subject are fixed after assignment creation",
      );
    const item = await transaction(async (db) => {
      const before = await model.findById(id).session(db).lean();
      const row = await model.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true, runValidators: true, session: db },
      );
      await Audit.create(
        [
          {
            actorId: req.user._id,
            action: `${resource}.update`,
            targetId: id,
            before,
            after: data,
          },
        ],
        { session: db },
      );
      return row;
    });
    res.json(item);
  });
}
router.delete("/timetable/:id", roles("admin"), async (req, res) => {
  const id = oid.parse(req.params.id);
  await transaction(async (db) => {
    const row = await Timetable.findByIdAndDelete(id, { session: db });
    assert(row, 404, "Period not found");
    await Audit.create(
      [
        {
          actorId: req.user._id,
          action: "timetable.delete",
          targetId: id,
          before: row.toObject(),
        },
      ],
      { session: db },
    );
  });
  res.json({ ok: true });
});
router.get("/settings", async (req, res) => res.json(await settings()));
router.patch("/settings", roles("admin"), async (req, res) => {
  const data = z
    .object({
      collegeName: name,
      timezone: z.string().refine((x) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: x });
          return true;
        } catch {
          return false;
        }
      }, "Use a valid IANA timezone"),
      threshold: z.number().min(0).max(100),
      qrSeconds: z.number().int().min(15).max(120),
      lateMinutes: z.number().int().min(0).max(120),
      sessionMinutes: z.number().int().min(5).max(240),
      lateCounts: z.boolean(),
    })
    .strict()
    .parse(req.body);
  assert(
    data.lateMinutes <= data.sessionMinutes,
    400,
    "Late cutoff must not exceed session duration",
  );
  const result = await transaction(async (db) => {
    const before = await Settings.findById("global").session(db).lean();
    const next = await Settings.findByIdAndUpdate("global", data, {
      new: true,
      upsert: true,
      session: db,
    });
    await Audit.create(
      [
        {
          actorId: req.user._id,
          action: "settings.update",
          before,
          after: data,
        },
      ],
      { session: db },
    );
    return next;
  });
  res.json(result);
});
router.get("/audit", roles("admin"), async (req, res) =>
  res.json(
    await Audit.find()
      .sort({ createdAt: -1 })
      .limit(500)
      .populate("actorId", "name")
      .lean(),
  ),
);
router.get("/notifications", async (req, res) =>
  res.json(
    await Notification.find({ recipientId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  ),
);
router.post("/notifications/:id/read", async (req, res) => {
  await Notification.updateOne(
    { _id: oid.parse(req.params.id), recipientId: req.user._id },
    { $set: { readAt: new Date() } },
  );
  res.json({ ok: true });
});
export default router;
