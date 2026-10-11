import mongoose from "mongoose";
const { Schema } = mongoose;
const ref = (model, required = true) => ({
  type: Schema.Types.ObjectId,
  ref: model,
  required,
});
const schema = (fields) =>
  new Schema(fields, { timestamps: true, strict: "throw" });
const user = schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["admin", "faculty", "student"], required: true },
  code: { type: String, required: true, unique: true },
  classId: ref("Class", false),
  departmentId: ref("Department", false),
  isActive: { type: Boolean, default: true },
  tokenVersion: { type: Number, default: 0 },
  mustChangePassword: { type: Boolean, default: true },
});
const session = schema({
  assignmentId: ref("Assignment"),
  facultyId: ref("User"),
  subjectId: ref("Subject"),
  classId: ref("Class"),
  title: String,
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  lateAt: { type: Date, required: true },
  closedAt: Date,
  status: {
    type: String,
    enum: ["active", "closed", "cancelled"],
    default: "active",
  },
  roster: [ref("User")],
  revision: { type: Number, default: 0 },
  policy: { qrSeconds: Number, threshold: Number, lateCounts: Boolean },
  cancelReason: String,
});
session.index(
  { assignmentId: 1 },
  { unique: true, partialFilterExpression: { status: "active" } },
);
session.index({ status: 1, endsAt: 1 });
const attendance = schema({
  sessionId: ref("Session"),
  studentId: ref("User"),
  status: {
    type: String,
    enum: ["present", "late", "absent", "excused"],
    required: true,
  },
  method: { type: String, enum: ["qr", "manual", "auto"], required: true },
  markedAt: Date,
  reason: String,
});
attendance.index({ sessionId: 1, studentId: 1 }, { unique: true });
attendance.index({ studentId: 1, createdAt: -1 });
const refresh = schema({
  userId: ref("User"),
  hash: { type: String, unique: true },
  expiresAt: Date,
});
refresh.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const reset = schema({
  userId: ref("User"),
  hash: { type: String, unique: true },
  expiresAt: Date,
});
reset.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const User = mongoose.model("User", user);
export const Department = mongoose.model(
  "Department",
  schema({
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
  }),
);
export const Class = mongoose.model(
  "Class",
  schema({
    name: { type: String, required: true },
    departmentId: ref("Department"),
    academicYear: { type: String, required: true },
    semester: { type: Number, required: true },
  }),
);
export const Subject = mongoose.model(
  "Subject",
  schema({
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    departmentId: ref("Department"),
  }),
);
const assignment = schema({
  facultyId: ref("User"),
  subjectId: ref("Subject"),
  classId: ref("Class"),
  isActive: { type: Boolean, default: true },
});
assignment.index({ subjectId: 1, classId: 1 }, { unique: true });
export const Assignment = mongoose.model("Assignment", assignment);
const enrollment = schema({
  studentId: ref("User"),
  assignmentId: ref("Assignment"),
  isActive: { type: Boolean, default: true },
});
enrollment.index({ studentId: 1, assignmentId: 1 }, { unique: true });
export const Enrollment = mongoose.model("Enrollment", enrollment);
export const Timetable = mongoose.model(
  "Timetable",
  schema({
    assignmentId: ref("Assignment"),
    day: { type: Number, min: 0, max: 6 },
    startTime: String,
    endTime: String,
    room: String,
  }),
);
export const Session = mongoose.model("Session", session);
export const Attendance = mongoose.model("Attendance", attendance);
export const Refresh = mongoose.model("Refresh", refresh);
export const Reset = mongoose.model("Reset", reset);
export const Audit = mongoose.model(
  "Audit",
  schema({
    actorId: ref("User", false),
    action: String,
    targetId: String,
    reason: String,
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
  }),
);
const notice = schema({
  recipientId: ref("User"),
  message: String,
  key: { type: String, unique: true },
  readAt: Date,
});
export const Notification = mongoose.model("Notification", notice);
export const Settings = mongoose.model(
  "Settings",
  schema({
    _id: { type: String, default: "global" },
    collegeName: { type: String, default: "Your institution" },
    timezone: { type: String, default: "Asia/Kolkata" },
    threshold: { type: Number, default: 75 },
    qrSeconds: { type: Number, default: 30 },
    lateMinutes: { type: Number, default: 10 },
    sessionMinutes: { type: Number, default: 60 },
    lateCounts: { type: Boolean, default: true },
  }),
);
export async function initModels() {
  for (const model of Object.values(mongoose.models)) await model.init();
}
export async function settings() {
  return (
    (await Settings.findById("global")) ||
    (await Settings.create({ _id: "global" }))
  );
}
