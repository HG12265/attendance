import { Router } from "express";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { User, Refresh, Reset, Audit } from "./models.js";
import {
  auth,
  assert,
  accessToken,
  randomToken,
  hash,
  cookieOptions,
  publicUser,
} from "./security.js";
import { transaction } from "./attendance.js";
import { config } from "./config.js";
const router = Router();
const limit = rateLimit({
  windowMs: 15 * 60000,
  limit: 3000,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many authentication attempts. Try again in 15 minutes.",
  },
});
router.use(limit);
const loginLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 15,
  keyGenerator: (req) =>
    hash(
      String(req.body?.email || "")
        .trim()
        .toLowerCase(),
    ),
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    error: "Too many attempts for this account. Try again in 15 minutes.",
  },
});
const recoveryLimit = rateLimit({
  windowMs: 15 * 60000,
  limit: 5,
  keyGenerator: (req) =>
    hash(
      String(req.body?.email || req.body?.token || "")
        .trim()
        .toLowerCase(),
    ),
  message: { error: "Too many recovery attempts. Try later." },
});
const password = z
  .string()
  .min(12)
  .max(72)
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[0-9]/, "Include a number")
  .refine(
    (x) => Buffer.byteLength(x, "utf8") <= 72,
    "Password must be at most 72 UTF-8 bytes",
  );
async function issue(user, res) {
  const token = randomToken();
  await Refresh.create({
    userId: user._id,
    hash: hash(token),
    expiresAt: new Date(Date.now() + 7 * 86400000),
  });
  res.cookie("refresh", token, cookieOptions);
  return { token: accessToken(user), user: publicUser(user) };
}
router.post("/login", loginLimit, async (req, res) => {
  const input = z
    .object({
      email: z.string().email().max(254),
      password: z.string().max(100),
    })
    .parse(req.body);
  const user = await User.findOne({
    email: input.email.toLowerCase().trim(),
  }).select("+passwordHash");
  const ok = await bcrypt.compare(
    input.password,
    user?.passwordHash ||
      "$2b$12$C6UzMDM.H6dfI/f/IKcEe.9IyIXZPQPa.Q2T8xrDtLUTxPgRYqbB6",
  );
  assert(user?.isActive && ok, 401, "Email or password is incorrect");
  res.json(await issue(user, res));
});
router.post("/refresh", async (req, res) => {
  const raw = req.cookies.refresh;
  assert(raw, 401, "Please sign in");
  const record = await Refresh.findOneAndDelete({
    hash: hash(raw),
    expiresAt: { $gt: new Date() },
  });
  assert(record, 401, "Please sign in again");
  const user = await User.findById(record.userId);
  assert(user?.isActive, 401, "Account inactive");
  res.json(await issue(user, res));
});
router.post("/logout", auth, async (req, res) => {
  await transaction(async (db) => {
    await User.updateOne(
      { _id: req.user._id },
      { $inc: { tokenVersion: 1 } },
      { session: db },
    );
    await Refresh.deleteMany({ userId: req.user._id }, { session: db });
  });
  res.clearCookie("refresh", { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});
router.get("/me", auth, (req, res) => res.json(publicUser(req.user)));
router.post("/password", auth, async (req, res) => {
  const data = z
    .object({ currentPassword: z.string(), newPassword: password })
    .parse(req.body);
  const user = await User.findById(req.user._id).select("+passwordHash");
  assert(
    await bcrypt.compare(data.currentPassword, user.passwordHash),
    400,
    "Current password is incorrect",
  );
  const passwordHash = await bcrypt.hash(data.newPassword, 12);
  await transaction(async (db) => {
    await User.updateOne(
      { _id: user._id },
      {
        $set: { passwordHash, mustChangePassword: false },
        $inc: { tokenVersion: 1 },
      },
      { session: db },
    );
    await Refresh.deleteMany({ userId: user._id }, { session: db });
    await Audit.create(
      [
        {
          actorId: user._id,
          action: "password.change",
          targetId: String(user._id),
        },
      ],
      { session: db },
    );
  });
  res.clearCookie("refresh", { ...cookieOptions, maxAge: undefined });
  res.json({
    ok: true,
    message: "Password updated. Sign in with your new password.",
  });
});
router.post("/forgot", recoveryLimit, async (req, res) => {
  const { email } = z.object({ email: z.string().email() }).parse(req.body);
  assert(
    config.smtpHost,
    503,
    "Email recovery is not configured. Contact your administrator.",
  );
  const user = await User.findOne({
    email: email.toLowerCase(),
    isActive: true,
  });
  if (user) {
    const token = randomToken();
    await Reset.deleteMany({ userId: user._id });
    await Reset.create({
      userId: user._id,
      hash: hash(token),
      expiresAt: new Date(Date.now() + 30 * 60000),
    });
    const mail = nodemailer.createTransport({
      host: config.smtpHost,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
    });
    await mail.sendMail({
      from: process.env.MAIL_FROM,
      to: user.email,
      subject: "Reset your Attendly password",
      text: `Reset your password within 30 minutes: ${config.origin}/?reset=${token}\nIf you did not request this, ignore this email.`,
    });
  }
  res.json({ message: "If the account exists, a reset link has been sent." });
});
router.post("/reset", recoveryLimit, async (req, res) => {
  const input = z
    .object({ token: z.string().length(80), newPassword: password })
    .parse(req.body);
  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  await transaction(async (db) => {
    const reset = await Reset.findOneAndDelete(
      { hash: hash(input.token), expiresAt: { $gt: new Date() } },
      { session: db },
    );
    assert(reset, 400, "Reset link is invalid or expired");
    await User.updateOne(
      { _id: reset.userId },
      {
        $set: { passwordHash, mustChangePassword: false },
        $inc: { tokenVersion: 1 },
      },
      { session: db },
    );
    await Refresh.deleteMany({ userId: reset.userId }, { session: db });
    await Audit.create(
      [
        {
          actorId: reset.userId,
          action: "password.reset",
          targetId: String(reset.userId),
        },
      ],
      { session: db },
    );
  });
  res.json({ ok: true });
});
export { password };
export default router;
