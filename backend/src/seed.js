import mongoose from "mongoose";
import { config, validateConfig } from "./config.js";
import { User, initModels } from "./models.js";
import { createFixtures } from "./fixtures.js";
import { password } from "./auth-routes.js";
validateConfig();
if (config.production) throw new Error("Sample data is disabled in production");
password.parse(process.env.DEMO_PASSWORD);
await mongoose.connect(config.mongo);
await initModels();
if (await User.exists({}))
  throw new Error(
    "Seed requires an empty database; no records have been deleted",
  );
await createFixtures(process.env.DEMO_PASSWORD);
console.log(
  "Sample data created. Accounts: admin@attendly.example, faculty@attendly.example, student1@attendly.example. Password: your DEMO_PASSWORD value.",
);
await mongoose.disconnect();
