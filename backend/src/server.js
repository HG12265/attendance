import http from "node:http";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { app } from "./app.js";
import { config, validateConfig } from "./config.js";
import { initModels, settings } from "./models.js";
import { verifyAccess, assert } from "./security.js";
import { accessible, manages, setPublisher, sweep } from "./attendance.js";
validateConfig();
await mongoose.connect(config.mongo);
const hello = await mongoose.connection.db.admin().command({ hello: 1 });
if (!hello.setName)
  throw new Error(
    "MongoDB must be a replica set to support atomic attendance transactions",
  );
await initModels();
await settings();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.origin, credentials: true },
  allowRequest: (req, done) => done(null, req.headers.origin === config.origin),
  maxHttpBufferSize: 10000,
});
io.use(async (socket, next) => {
  try {
    socket.user = await verifyAccess(socket.handshake.auth.token);
    assert(!socket.user.mustChangePassword, 403, "Change your password first");
    next();
  } catch {
    next(new Error("Authentication required"));
  }
});
io.on("connection", (socket) => {
  const expiry = setTimeout(() => socket.disconnect(true), 15 * 60000);
  socket.on("disconnect", () => clearTimeout(expiry));
  socket.on("watch-session", async (id, ack = () => {}) => {
    try {
      socket.user = await verifyAccess(socket.handshake.auth.token);
      const session = await accessible(socket.user, id);
      assert(manages(socket.user, session), 403, "Faculty only");
      for (const room of socket.rooms)
        if (room.startsWith("session:")) socket.leave(room);
      socket.join(`session:${id}`);
      ack({ ok: true });
    } catch {
      ack({ error: "Access denied" });
    }
  });
});
// Broadcast invalidation only. Every client fetches fresh data through authorized APIs.
setPublisher((id) =>
  io.to(`session:${id}`).emit("attendance-updated", { sessionId: id }),
);
await sweep();
const timer = setInterval(
  () =>
    sweep().catch((e) => console.error("Background sweep failed:", e.message)),
  30000,
);
server.listen(config.port, () =>
  console.log(`Attendly listening on port ${config.port}`),
);
async function shutdown() {
  clearInterval(timer);
  io.close();
  server.close();
  await mongoose.disconnect();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
