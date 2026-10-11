import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import mongoose from "mongoose";
import { z } from "zod";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";
import authRoutes from "./auth-routes.js";
import dataRoutes, { oid } from "./data-routes.js";
import { config } from "./config.js";
import { auth, roles, assert, checkOrigin, signQR } from "./security.js";
import { Session, Attendance, User } from "./models.js";
import {
  accessible,
  manages,
  createSession,
  scan,
  closeSession,
  correctAttendance,
  sessionList,
  reportRows,
  percentages,
} from "./attendance.js";
export const app = express();
app.disable("x-powered-by");
app.set("trust proxy", config.trustProxy);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "'unsafe-inline'"],
        "img-src": ["'self'", "data:", "blob:"],
        "connect-src": ["'self'"],
        "worker-src": ["'self'", "blob:"],
        "media-src": ["'self'", "blob:"],
        "frame-ancestors": ["'none'"],
        "font-src": ["'self'"],
        "upgrade-insecure-requests": config.production ? [] : null,
      },
    },
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(
  "/api",
  rateLimit({
    windowMs: 60000,
    limit: 3000,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many requests. Please retry shortly." },
  }),
);
app.use(checkOrigin);
app.get("/api/health", (req, res) =>
  res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
    status: mongoose.connection.readyState === 1 ? "ok" : "unavailable",
  }),
);
app.use("/api/auth", authRoutes);
app.use("/api", auth);
app.use("/api", dataRoutes);
app.get("/api/sessions", async (req, res) =>
  res.json(await sessionList(req.user)),
);
app.post("/api/sessions", roles("admin", "faculty"), async (req, res) =>
  res.status(201).json(
    await createSession(
      req.user,
      z
        .object({
          assignmentId: oid,
          durationMinutes: z.number().int().min(5).max(240).optional(),
        })
        .parse(req.body),
    ),
  ),
);
app.get("/api/sessions/:id", async (req, res) => {
  const s = await accessible(req.user, oid.parse(req.params.id));
  const filter = { sessionId: s._id };
  if (req.user.role === "student") filter.studentId = req.user._id;
  const records = await Attendance.find(filter)
    .populate("studentId", "name code")
    .lean();
  const roster = manages(req.user, s)
    ? await User.find({ _id: { $in: s.roster } })
        .select("name code isActive")
        .lean()
    : [];
  res.json({
    session:
      req.user.role === "student"
        ? { ...s.toObject(), roster: [req.user._id] }
        : s,
    records,
    roster,
  });
});
app.get("/api/sessions/:id/qr", roles("admin", "faculty"), async (req, res) => {
  const s = await accessible(req.user, oid.parse(req.params.id));
  assert(manages(req.user, s), 403, "Not your session");
  assert(
    s.status === "active" && s.endsAt > new Date(),
    409,
    "Session has ended",
  );
  res.set("Cache-Control", "no-store").json(signQR(s));
});
app.post(
  "/api/attendance/scan",
  roles("student"),
  rateLimit({
    windowMs: 60000,
    limit: 30,
    keyGenerator: (req) => String(req.user._id),
    message: { error: "Please wait before scanning again." },
  }),
  async (req, res) =>
    res.json(
      await scan(
        req.user,
        z.object({ token: z.string().min(20).max(2048) }).parse(req.body).token,
      ),
    ),
);
app.post(
  "/api/sessions/:id/close",
  roles("admin", "faculty"),
  async (req, res) =>
    res.json(await closeSession(oid.parse(req.params.id), req.user)),
);
app.post(
  "/api/sessions/:id/cancel",
  roles("admin", "faculty"),
  async (req, res) =>
    res.json(
      await closeSession(
        oid.parse(req.params.id),
        req.user,
        z.object({ reason: z.string().trim().min(5).max(500) }).parse(req.body)
          .reason,
      ),
    ),
);
app.patch(
  "/api/sessions/:id/attendance",
  roles("admin", "faculty"),
  async (req, res) =>
    res.json(
      await correctAttendance(
        req.user,
        oid.parse(req.params.id),
        z
          .object({
            studentId: oid,
            status: z.enum(["present", "late", "absent", "excused"]),
            reason: z.string().trim().min(5).max(500),
          })
          .parse(req.body),
      ),
    ),
);
const querySchema = z.object({
  classId: oid.optional(),
  subjectId: oid.optional(),
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  format: z.enum(["xlsx", "pdf"]).optional(),
});
app.get("/api/reports", async (req, res) => {
  const rows = await reportRows(req.user, querySchema.parse(req.query));
  res.json({
    rows,
    summary: percentages(rows),
    scope:
      "Latest 2,000 matching completed sessions. Narrow the date filters for larger histories.",
  });
});
app.get("/api/reports/export", async (req, res) => {
  const q = querySchema.parse(req.query),
    rows = await reportRows(req.user, q);
  const values = rows.map((r) => [
    r.session.startsAt.toISOString().slice(0, 10),
    r.studentId.code,
    r.studentId.name,
    r.session.subjectId.name,
    r.session.classId.name,
    r.status,
  ]);
  if (q.format === "pdf") {
    res.type("pdf").attachment("attendly-attendance.pdf");
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 36,
    });
    doc.pipe(res);
    doc.fontSize(22).text("Attendly | Attendance report");
    doc
      .fontSize(9)
      .text(
        `Generated ${new Date().toISOString()} | ${rows.length} records | UTC dates`,
        { paragraphGap: 15 },
      );
    for (const row of values) {
      if (doc.y > 520) doc.addPage();
      doc.fontSize(9).text(row.join("   |   "), { paragraphGap: 7 });
    }
    doc.end();
  } else {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Attendly";
    const sheet = workbook.addWorksheet("Attendance");
    sheet.columns = [
      { header: "Date (UTC)", key: "date", width: 15 },
      { header: "Register number", key: "code", width: 23 },
      { header: "Student", key: "student", width: 28 },
      { header: "Subject", key: "subject", width: 30 },
      { header: "Class", key: "class", width: 24 },
      { header: "Status", key: "status", width: 15 },
    ];
    sheet.addRows(values);
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF17685A" },
    };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = "A1:F1";
    res
      .type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .attachment("attendly-attendance.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  }
});
app.get("/api/dashboard", async (req, res) => {
  const rows = await reportRows(req.user);
  const sessions = await sessionList(req.user);
  const summary = percentages(rows);
  const counted = rows.filter((r) => r.status !== "excused");
  const attended = counted.filter(
    (r) =>
      r.status === "present" ||
      (r.status === "late" && r.session.policy.lateCounts),
  );
  const days = {};
  for (const r of counted) {
    const day = r.session.startsAt.toISOString().slice(0, 10);
    days[day] ||= { date: day, total: 0, present: 0 };
    days[day].total++;
    if (
      r.status === "present" ||
      (r.status === "late" && r.session.policy.lateCounts)
    )
      days[day].present++;
  }
  res.json({
    sessions: sessions.slice(0, 8),
    summary,
    stats: {
      students:
        req.user.role === "admin"
          ? await User.countDocuments({ role: "student", isActive: true })
          : null,
      faculty:
        req.user.role === "admin"
          ? await User.countDocuments({ role: "faculty", isActive: true })
          : null,
      active: sessions.filter((s) => s.status === "active").length,
      completed: sessions.filter((s) => s.status === "closed").length,
      rate: counted.length
        ? Math.round((attended.length / counted.length) * 1000) / 10
        : null,
    },
    trend: Object.values(days)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14)
      .map((x) => ({ ...x, rate: Math.round((x.present / x.total) * 100) })),
  });
});
app.use("/api", (req, res) =>
  res.status(404).json({ error: "API route not found" }),
);
const dist = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../frontend/dist",
);
app.use(express.static(dist));
app.get("/{*path}", (req, res) => res.sendFile(path.join(dist, "index.html")));
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err instanceof z.ZodError)
    return res.status(400).json({
      error: err.issues
        .map((x) => `${x.path.join(".")}: ${x.message}`)
        .join("; "),
    });
  if (err.code === 11000)
    return res.status(409).json({
      error:
        "A record with these details already exists, or an attendance session is already active.",
    });
  if (err.name === "CastError")
    return res.status(400).json({ error: "Invalid record identifier" });
  if (!err.status) console.error("Request failed:", err.name, err.message);
  res.status(err.status || 500).json({
    error: err.status
      ? err.message
      : "The request could not be completed. Please retry or contact your administrator.",
  });
});
