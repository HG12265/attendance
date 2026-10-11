import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
process.env.AUTH_SECRET = "unit-auth-secret-123456789-123456789";
process.env.QR_SECRET = "unit-qr-secret-123456789-12345678900";
const { config, validateConfig } = await import("../src/config.js");
const {
  signQR,
  verifyQR,
  accessToken,
  hash,
  checkOrigin,
  roles,
  publicUser,
  auth,
} = await import("../src/security.js");
const { percentages, manages } = await import("../src/attendance.js");
const { User, Attendance, Session } = await import("../src/models.js");
const { password } = await import("../src/auth-routes.js");
const { app } = await import("../src/app.js");
const request = (await import("supertest")).default;
test("startup rejects missing and reused signing keys", () => {
  validateConfig();
  const old = config.qrSecret;
  config.qrSecret = config.authSecret;
  assert.throws(validateConfig);
  config.qrSecret = old;
});
test("QR binds a session, server timestamp, audience and expiry", () => {
  const now = Date.now();
  const qr = signQR(
    { _id: "507f1f77bcf86cd799439011", policy: { qrSeconds: 30 } },
    now,
  );
  const payload = verifyQR(qr.token);
  assert.equal(payload.sid, "507f1f77bcf86cd799439011");
  assert.equal(payload.aud, "attendance-scan");
  assert.ok(+new Date(qr.expiresAt) > now);
  assert.ok(+new Date(qr.expiresAt) <= now + 30000);
});
test("QR tampering is rejected", () => {
  const qr = signQR({ _id: "session", policy: { qrSeconds: 30 } });
  assert.throws(() => verifyQR(qr.token.slice(0, -8) + "tampered"));
});
test("expired QR is rejected without client clock trust", () => {
  const qr = signQR(
    { _id: "session", policy: { qrSeconds: 30 } },
    Date.now() - 61000,
  );
  assert.throws(() => verifyQR(qr.token));
});
test("auth tokens cannot be used as QR challenges", () => {
  const token = accessToken({
    _id: "507f1f77bcf86cd799439011",
    tokenVersion: 0,
  });
  assert.throws(() => verifyQR(token));
});
test("QR rejects wrong audience and unsigned tokens", () => {
  assert.throws(() =>
    verifyQR(
      jwt.sign({ sid: "s" }, config.qrSecret, {
        audience: "other",
        issuer: "attendly-qr",
      }),
    ),
  );
  assert.throws(() =>
    verifyQR(jwt.sign({ sid: "s" }, null, { algorithm: "none" })),
  );
});
test("attendance percentages respect excused and historical late policies", () => {
  const base = {
    studentId: { _id: "student", name: "Student", code: "001" },
    session: {
      subjectId: { _id: "subject", name: "Subject" },
      policy: { lateCounts: true },
    },
  };
  const rows = [
    { ...base, status: "present" },
    { ...base, status: "late" },
    { ...base, status: "absent" },
    { ...base, status: "excused" },
  ];
  const [result] = percentages(rows);
  assert.equal(result.total, 3);
  assert.equal(result.attended, 2);
  assert.equal(result.excused, 1);
  assert.equal(result.percentage, 66.67);
  rows[1] = {
    ...base,
    status: "late",
    session: { ...base.session, policy: { lateCounts: false } },
  };
  assert.equal(percentages(rows)[0].percentage, 33.33);
});
test("all-excused participation has no misleading zero percentage", () => {
  const [r] = percentages([
    {
      studentId: { _id: "u", name: "A" },
      session: { subjectId: { _id: "s" }, policy: {} },
      status: "excused",
    },
  ]);
  assert.equal(r.percentage, null);
  assert.equal(r.total, 0);
});
test("faculty ownership cannot be substituted by student role", () => {
  const session = { facultyId: "faculty" };
  assert.equal(manages({ role: "faculty", _id: "faculty" }, session), true);
  assert.equal(manages({ role: "faculty", _id: "other" }, session), false);
  assert.equal(manages({ role: "student", _id: "faculty" }, session), false);
});
test("duplicate attendance and active session uniqueness are database-enforced", () => {
  assert.ok(
    Attendance.schema
      .indexes()
      .some(
        ([keys, opt]) =>
          keys.sessionId === 1 && keys.studentId === 1 && opt.unique,
      ),
  );
  assert.ok(
    Session.schema
      .indexes()
      .some(
        ([keys, opt]) =>
          keys.assignmentId === 1 &&
          opt.unique &&
          opt.partialFilterExpression.status === "active",
      ),
  );
});
test("public identity strips credentials and revocation version", () => {
  const output = publicUser({
    _id: "u",
    passwordHash: "hidden",
    tokenVersion: 5,
    name: "A",
    role: "student",
  });
  assert.equal(output.passwordHash, undefined);
  assert.equal(output.tokenVersion, undefined);
  assert.equal(output.name, "A");
});
test("password policy rejects weak values", () => {
  assert.throws(() => password.parse("123"));
  assert.throws(() => password.parse("alllowercasepassword"));
  assert.throws(() => password.parse("a".repeat(73)));
  assert.equal(password.parse("UniqueCampusPass123!"), "UniqueCampusPass123!");
});
test("request origin validation rejects third-party mutations", () => {
  let error;
  checkOrigin(
    {
      method: "POST",
      path: "/api/auth/login",
      headers: { origin: "https://evil.example" },
    },
    null,
    (e) => (error = e),
  );
  assert.equal(error.status, 403);
  checkOrigin(
    {
      method: "POST",
      path: "/api/auth/login",
      headers: { origin: config.origin },
    },
    null,
    (e) => (error = e),
  );
  assert.equal(error, undefined);
});
test("temporary-password user may change password but cannot access catalog", async () => {
  const original = User.findById;
  const user = {
    _id: "507f1f77bcf86cd799439011",
    isActive: true,
    tokenVersion: 0,
    mustChangePassword: true,
  };
  User.findById = async () => user;
  try {
    const token = accessToken(user);
    let error;
    await auth(
      {
        headers: { authorization: "Bearer " + token },
        originalUrl: "/api/catalog",
      },
      null,
      (e) => (error = e),
    );
    assert.equal(error.status, 403);
    await auth(
      {
        headers: { authorization: "Bearer " + token },
        originalUrl: "/api/auth/password",
      },
      null,
      (e) => (error = e),
    );
    assert.equal(error, undefined);
  } finally {
    User.findById = original;
  }
});
test("revoked access tokens are rejected", async () => {
  const original = User.findById;
  const user = {
    _id: "507f1f77bcf86cd799439011",
    isActive: true,
    tokenVersion: 0,
  };
  const token = accessToken(user);
  User.findById = async () => ({ ...user, tokenVersion: 1 });
  try {
    let error;
    await auth(
      {
        headers: { authorization: "Bearer " + token },
        originalUrl: "/api/auth/me",
      },
      null,
      (e) => (error = e),
    );
    assert.equal(error.status, 401);
  } finally {
    User.findById = original;
  }
});
test("HTTP middleware rejects missing credentials and hostile origins", async () => {
  assert.equal((await request(app).get("/api/catalog")).status, 401);
  const r = await request(app)
    .post("/api/auth/login")
    .set("Origin", "https://evil.example")
    .send({});
  assert.equal(r.status, 403);
  assert.ok(r.headers["content-security-policy"]);
  assert.equal(r.headers["x-powered-by"], undefined);
});
test("token hashes are deterministic and conceal raw refresh tokens", () => {
  assert.equal(hash("token"), hash("token"));
  assert.notEqual(hash("token"), hash("other"));
  assert.equal(hash("token").length, 64);
});
test("Excel export library writes readable workbooks with patched UUID dependency", async () => {
  const ExcelJS = (await import("exceljs")).default;
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet("Attendance");
  sheet.addRow(["Student", "Percentage"]);
  sheet.addRow(["Student A", 80]);
  sheet.addConditionalFormatting({
    ref: "B2:B2",
    rules: [
      {
        type: "dataBar",
        cfvo: [{ type: "min" }, { type: "max" }],
        color: { argb: "FF176552" },
      },
    ],
  });
  const bytes = await book.xlsx.writeBuffer();
  assert.ok(bytes.byteLength > 1000);
  const copy = new ExcelJS.Workbook();
  await copy.xlsx.load(bytes);
  assert.equal(copy.getWorksheet("Attendance").getCell("B2").value, 80);
});
test("PDF export library creates a valid document stream", async () => {
  const PDF = (await import("pdfkit")).default;
  const doc = new PDF();
  const chunks = [];
  const finished = new Promise((resolve) => {
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", resolve);
  });
  doc.text("Attendly attendance report");
  doc.end();
  await finished;
  const buffer = Buffer.concat(chunks);
  assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
  assert.ok(buffer.length > 1000);
});
test("patched mailer composes reset emails without sending", async () => {
  const nodemailer = (await import("nodemailer")).default;
  const transport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: "unix",
  });
  const result = await transport.sendMail({
    from: "attendance@example.test",
    to: "student@example.test",
    subject: "Reset your Attendly password",
    text: "Use your single-use reset link.",
  });
  assert.match(result.message.toString(), /Reset your Attendly password/);
});
