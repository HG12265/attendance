import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config, validateConfig } from "./config.js";
import { User, initModels, settings } from "./models.js";
import { password } from "./auth-routes.js";
validateConfig();
password.parse(process.env.ADMIN_PASSWORD);
if (!process.env.ADMIN_EMAIL) throw new Error("ADMIN_EMAIL is required");
await mongoose.connect(config.mongo);
await initModels();
if (await User.exists({ role: "admin" }))
  throw new Error(
    "Administrator already exists. Bootstrap cannot be run twice.",
  );
await User.create({
  name: process.env.ADMIN_NAME || "Administrator",
  email: process.env.ADMIN_EMAIL.toLowerCase(),
  passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12),
  role: "admin",
  code: "ADMIN001",
  mustChangePassword: true,
});
await settings();
console.log(
  "Administrator created. Change the temporary password at first sign-in.",
);
await mongoose.disconnect();
