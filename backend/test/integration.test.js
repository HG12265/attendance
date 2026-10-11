import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
process.env.AUTH_SECRET = "test-auth-secret-not-for-deployment-123456789";
process.env.QR_SECRET = "test-qr-secret-not-for-deployment-123456789";
process.env.NODE_ENV = "test";
const { app } = await import("../src/app.js");
const { initModels, Session, Attendance, User, Audit, Notification } =
  await import("../src/models.js");
const { createFixtures } = await import("../src/fixtures.js");
const { sweep } = await import("../src/attendance.js");
const { signQR, verifyQR } = await import("../src/security.js");
let mongo, fixture, admin, faculty, student, other, sessionId, qr;
const password = "TestCampusPass123!";
const origin = "http://localhost:5173";
const call = (token, method, url, body) => {
  const r = request(app)
    [method]("/api" + url)
    .set("Origin", origin);
  if (token) r.set("Authorization", "Bearer " + token);
  return body ? r.send(body) : r;
};
async function login(email) {
  const r = await call(null, "post", "/auth/login", { email, password });
  assert.equal(r.status, 200, r.text);
  return r.body.token;
}
before(
  async () => {
    mongo = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      binary: { version: "7.0.24" },
    });
    await mongoose.connect(mongo.getUri());
    await initModels();
    fixture = await createFixtures(password);
    admin = await login("admin@attendly.example");
    faculty = await login("faculty@attendly.example");
    student = await login("student1@attendly.example");
    other = await login("student2@attendly.example");
  },
  { timeout: 240000 },
);
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
test("unauthenticated requests and malicious login origin are rejected", async () => {
  assert.equal((await call(null, "get", "/catalog")).status, 401);
  assert.equal(
    (
      await request(app)
        .post("/api/auth/login")
        .set("Origin", "https://evil.example")
        .send({ email: "admin@attendly.example", password })
    ).status,
    403,
  );
});
test("roles scope people and academic catalog", async () => {
  assert.equal((await call(student, "get", "/users")).status, 403);
  const r = await call(student, "get", "/catalog");
  assert.equal(r.status, 200);
  assert.equal(r.body.users.length, 0);
  assert.equal(r.body.assignments.length, 3);
});
test("faculty creates session with a fixed enrollment roster", async () => {
  const r = await call(faculty, "post", "/sessions", {
    assignmentId: String(fixture.assignments[0]._id),
    durationMinutes: 5,
  });
  assert.equal(r.status, 201, r.text);
  sessionId = r.body._id;
  assert.equal(r.body.roster.length, 12);
});
test("duplicate active sessions are blocked by database uniqueness", async () => {
  const r = await call(faculty, "post", "/sessions", {
    assignmentId: String(fixture.assignments[0]._id),
  });
  assert.equal(r.status, 409);
});
test("student cannot obtain classroom QR; faculty can", async () => {
  assert.equal(
    (await call(student, "get", `/sessions/${sessionId}/qr`)).status,
    403,
  );
  const r = await call(faculty, "get", `/sessions/${sessionId}/qr`);
  assert.equal(r.status, 200);
  qr = r.body.token;
});
test("modified and expired QR tokens fail cryptographic verification", () => {
  assert.throws(() => verifyQR(qr.slice(0, -5) + "xxxxx"));
  const old = signQR(
    { _id: sessionId, policy: { qrSeconds: 30 } },
    Date.now() - 120000,
  );
  assert.throws(() => verifyQR(old.token));
});
test("concurrent duplicate scans create exactly one attendance record", async () => {
  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      call(student, "post", "/attendance/scan", { token: qr }),
    ),
  );
  assert.ok(
    results.every((r) => r.status === 200),
    results.map((r) => r.text).join("\n"),
  );
  assert.equal(
    await Attendance.countDocuments({
      sessionId,
      studentId: fixture.students[0]._id,
    }),
    1,
  );
  assert.equal(results.filter((r) => !r.body.alreadyMarked).length, 1);
});
test("students cannot inspect another student attendance", async () => {
  const r = await call(other, "get", `/sessions/${sessionId}`);
  assert.equal(r.status, 200);
  assert.equal(r.body.records.length, 0);
  assert.equal(r.body.roster.length, 0);
});
test("non-enrolled student cannot scan", async () => {
  const outsider = await User.create({
    name: "Outside Student",
    email: "outside@example.test",
    passwordHash: fixture.admin.passwordHash,
    role: "student",
    code: "OUT001",
    classId: fixture.cls._id,
    mustChangePassword: false,
  });
  const { accessToken } = await import("../src/security.js");
  const r = await call(accessToken(outsider), "post", "/attendance/scan", {
    token: qr,
  });
  assert.equal(r.status, 403);
});
test("student cannot modify attendance", async () => {
  const r = await call(student, "patch", `/sessions/${sessionId}/attendance`, {
    studentId: String(fixture.students[1]._id),
    status: "present",
    reason: "Test correction",
  });
  assert.equal(r.status, 403);
});
test("closing and scanning race finalizes complete roster without duplicates", async () => {
  const result = await Promise.all([
    call(faculty, "post", `/sessions/${sessionId}/close`),
    call(other, "post", "/attendance/scan", { token: qr }),
  ]);
  assert.equal(result[0].status, 200, result[0].text);
  assert.ok([200, 409].includes(result[1].status), result[1].text);
  assert.equal(await Attendance.countDocuments({ sessionId }), 12);
  assert.equal((await Session.findById(sessionId)).status, "closed");
});
test("repeated finalization is idempotent", async () => {
  assert.equal(
    (await call(faculty, "post", `/sessions/${sessionId}/close`)).status,
    200,
  );
  assert.equal(await Attendance.countDocuments({ sessionId }), 12);
});
test("late submissions to a closed session are rejected", async () => {
  const third = await login("student3@attendly.example");
  const r = await call(third, "post", "/attendance/scan", { token: qr });
  assert.equal(r.status, 409);
});
test("correction requires reason and records before/after audit atomically", async () => {
  const payload = {
    studentId: String(fixture.students[2]._id),
    status: "excused",
    reason: "Approved medical absence",
  };
  assert.equal(
    (
      await call(faculty, "patch", `/sessions/${sessionId}/attendance`, {
        ...payload,
        reason: "",
      })
    ).status,
    400,
  );
  const r = await call(
    faculty,
    "patch",
    `/sessions/${sessionId}/attendance`,
    payload,
  );
  assert.equal(r.status, 200, r.text);
  const log = await Audit.findOne({
    action: "attendance.correct",
    targetId: r.body._id,
  });
  assert.equal(log.before.status, "absent");
  assert.equal(log.after.status, "excused");
});
test("reports are user-scoped and excused entries do not count as absence", async () => {
  const r = await call(student, "get", "/reports");
  assert.equal(r.status, 200);
  assert.ok(
    r.body.rows.every(
      (x) => x.studentId._id === String(fixture.students[0]._id),
    ),
  );
  const third = await login("student3@attendly.example");
  const report = await call(third, "get", "/reports");
  const summary = report.body.summary.find(
    (x) => x.subjectId === String(fixture.assignments[0].subjectId),
  );
  assert.equal(summary.excused, 1);
});
test("Excel and PDF exports produce actual files", async () => {
  const excel = await call(admin, "get", "/reports/export?format=xlsx");
  assert.equal(excel.status, 200);
  assert.match(excel.headers["content-type"], /spreadsheetml/);
  assert.ok(excel.body.length > 1000);
  const pdf = await call(admin, "get", "/reports/export?format=pdf");
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers["content-type"], /pdf/);
  assert.ok(pdf.body.length > 1000);
});
test("restart recovery finalizes overdue sessions and produces notifications", async () => {
  const r = await call(faculty, "post", "/sessions", {
    assignmentId: String(fixture.assignments[1]._id),
  });
  assert.equal(r.status, 201, r.text);
  await Session.updateOne(
    { _id: r.body._id },
    { endsAt: new Date(Date.now() - 1000) },
  );
  await sweep();
  assert.equal((await Session.findById(r.body._id)).status, "closed");
  assert.equal(
    await Attendance.countDocuments({
      sessionId: r.body._id,
      status: "absent",
    }),
    12,
  );
  assert.ok((await Notification.countDocuments()) > 0);
});
test("timetable overlap is rejected", async () => {
  const r = await call(admin, "post", "/timetable", {
    assignmentId: String(fixture.assignments[0]._id),
    day: 1,
    startTime: "09:30",
    endTime: "10:30",
    room: "Test room",
  });
  assert.equal(r.status, 409);
});
test("temporary password gate permits change but blocks application data", async () => {
  const r = await call(admin, "post", "/users", {
    name: "New Student",
    email: "new@example.test",
    role: "student",
    code: "NEW001",
    classId: String(fixture.cls._id),
    password,
  });
  assert.equal(r.status, 201, r.text);
  const token = await login("new@example.test");
  assert.equal((await call(token, "get", "/catalog")).status, 403);
  assert.equal((await call(token, "get", "/auth/me")).status, 200);
  assert.equal(
    (
      await call(token, "post", "/auth/password", {
        currentPassword: password,
        newPassword: "NewSafePassword123!",
      })
    ).status,
    200,
  );
  assert.equal((await call(token, "get", "/auth/me")).status, 401);
});
test("refresh tokens rotate and cannot be replayed", async () => {
  const loginResponse = await call(null, "post", "/auth/login", {
    email: "student1@attendly.example",
    password,
  });
  const cookie = loginResponse.headers["set-cookie"][0].split(";")[0];
  const r = await request(app)
    .post("/api/auth/refresh")
    .set("Origin", origin)
    .set("Cookie", cookie);
  assert.equal(r.status, 200);
  const replay = await request(app)
    .post("/api/auth/refresh")
    .set("Origin", origin)
    .set("Cookie", cookie);
  assert.equal(replay.status, 401);
});
test("deactivation immediately revokes access", async () => {
  assert.equal(
    (
      await call(admin, "patch", `/users/${fixture.students[1]._id}`, {
        isActive: false,
      })
    ).status,
    200,
  );
  assert.equal((await call(other, "get", "/auth/me")).status, 401);
});
