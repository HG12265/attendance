import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
dotenv.config({
  path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.env"),
  quiet: true,
});
export const config = {
  port: Number(process.env.PORT || 4000),
  production: process.env.NODE_ENV === "production",
  origin: process.env.APP_ORIGIN || "http://localhost:5173",
  mongo:
    process.env.MONGODB_URI ||
    "mongodb://127.0.0.1:27017/attendly?replicaSet=rs0",
  authSecret: process.env.AUTH_SECRET,
  qrSecret: process.env.QR_SECRET,
  trustProxy: Number(process.env.TRUST_PROXY || 0),
  smtpHost: process.env.SMTP_HOST,
};
export function validateConfig() {
  for (const key of ["authSecret", "qrSecret"])
    if (!config[key] || config[key].length < 32)
      throw new Error(
        `${key} must be a unique random secret of at least 32 characters`,
      );
  if (config.authSecret === config.qrSecret)
    throw new Error("Authentication and QR secrets must differ");
  if (config.production && !config.origin.startsWith("https://"))
    throw new Error("Production requires HTTPS APP_ORIGIN");
}
