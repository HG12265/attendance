import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { User } from "./models.js";
import { config } from "./config.js";
export const hash = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
export const randomToken = () => crypto.randomBytes(40).toString("hex");
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const assert = (condition, status, message) => {
  if (!condition) throw new HttpError(status, message);
};
export function accessToken(user) {
  return jwt.sign(
    { sub: String(user._id), v: user.tokenVersion },
    config.authSecret,
    {
      algorithm: "HS256",
      issuer: "attendly",
      audience: "attendly-web",
      expiresIn: "15m",
    },
  );
}
export async function verifyAccess(token) {
  let payload;
  try {
    payload = jwt.verify(token, config.authSecret, {
      algorithms: ["HS256"],
      issuer: "attendly",
      audience: "attendly-web",
    });
  } catch {
    throw new HttpError(401, "Please sign in again");
  }
  const user = await User.findById(payload.sub);
  assert(
    user?.isActive && user.tokenVersion === payload.v,
    401,
    "Account or session is no longer active",
  );
  return user;
}
export async function auth(req, res, next) {
  try {
    req.user = await verifyAccess(
      (req.headers.authorization || "").replace(/^Bearer /, ""),
    );
    if (
      req.user.mustChangePassword &&
      !["/api/auth/me", "/api/auth/password", "/api/auth/logout"].includes(
        req.originalUrl.split("?")[0],
      )
    )
      throw new HttpError(
        403,
        "Change your temporary password before continuing",
      );
    next();
  } catch (e) {
    next(e);
  }
}
export const roles =
  (...allowed) =>
  (req, res, next) =>
    allowed.includes(req.user.role)
      ? next()
      : next(new HttpError(403, "You do not have permission for this action"));
export const cookieOptions = {
  httpOnly: true,
  secure: config.production,
  sameSite: "strict",
  path: "/api/auth",
  maxAge: 7 * 86400000,
};
export function checkOrigin(req, res, next) {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.origin;
    if (origin && origin !== config.origin)
      return next(new HttpError(403, "Untrusted request origin"));
    if (req.path.startsWith("/api/auth/") && !origin)
      return next(new HttpError(403, "Request origin is required"));
  }
  next();
}
export function signQR(session, now = Date.now()) {
  const seconds = session.policy.qrSeconds;
  const iat = Math.floor(now / 1000);
  const exp = (Math.floor(iat / seconds) + 1) * seconds;
  return {
    token: jwt.sign({ sid: String(session._id), iat, exp }, config.qrSecret, {
      algorithm: "HS256",
      issuer: "attendly-qr",
      audience: "attendance-scan",
    }),
    expiresAt: new Date(exp * 1000),
    serverTime: new Date(now),
  };
}
export function verifyQR(token) {
  try {
    return jwt.verify(token, config.qrSecret, {
      algorithms: ["HS256"],
      issuer: "attendly-qr",
      audience: "attendance-scan",
    });
  } catch {
    throw new HttpError(
      400,
      "QR code is invalid or expired. Scan the current code.",
    );
  }
}
export const publicUser = (user) => {
  const {
    _id,
    name,
    email,
    role,
    code,
    classId,
    departmentId,
    isActive,
    mustChangePassword,
  } = user;
  return {
    _id,
    name,
    email,
    role,
    code,
    classId,
    departmentId,
    isActive,
    mustChangePassword,
  };
};
