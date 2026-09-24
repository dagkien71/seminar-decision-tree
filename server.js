const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const os = require("os");
const { buildTree, seedRows } = require("./lib/tree");

const PORT = Number(process.env.PORT) || 3080;
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname)));

let rows = seedRows();
let nextId = 1;

function publicState() {
  return {
    rows,
    tree: buildTree(rows),
    count: rows.length,
  };
}

function broadcast() {
  io.emit("state", publicState());
}

io.on("connection", (socket) => {
  socket.emit("state", publicState());

  socket.on("submit", (payload, ack) => {
    try {
      const name = String(payload?.name || "").trim().slice(0, 40);
      const free = payload?.free;
      const interest = payload?.interest;
      const mode = payload?.mode;
      const attend = payload?.attend;

      const okFree = ["Bận", "Rảnh"].includes(free);
      const okInterest = ["Có", "Không"].includes(interest);
      const okMode = ["Online", "Offline"].includes(mode);
      const okAttend = ["Có", "Không"].includes(attend);

      if (!name || !okFree || !okInterest || !okMode || !okAttend) {
        if (typeof ack === "function") ack({ ok: false, error: "Thiếu hoặc sai thông tin" });
        return;
      }

      const row = {
        id: `u${Date.now()}-${nextId++}`,
        name,
        free,
        interest,
        mode,
        attend,
        socketId: socket.id,
        at: Date.now(),
      };
      rows.push(row);
      broadcast();
      if (typeof ack === "function") ack({ ok: true, row });
    } catch (err) {
      if (typeof ack === "function") ack({ ok: false, error: "Lỗi server" });
    }
  });

  socket.on("reset", (_payload, ack) => {
    rows = seedRows();
    broadcast();
    if (typeof ack === "function") ack({ ok: true });
  });
});

function lanIPs() {
  const nets = os.networkInterfaces();
  const out = [];
  for (const list of Object.values(nets)) {
    for (const n of list || []) {
      if (n.family === "IPv4" && !n.internal) out.push(n.address);
    }
  }
  return out;
}

server.listen(PORT, "0.0.0.0", () => {
  const ips = lanIPs();
  console.log(`\n  Decision Tree Seminar`);
  console.log(`  Slides:  http://localhost:${PORT}/`);
  console.log(`  Join:    http://localhost:${PORT}/join.html`);
  for (const ip of ips) {
    console.log(`  LAN:     http://${ip}:${PORT}/`);
    console.log(`  Join LAN http://${ip}:${PORT}/join.html`);
  }
  console.log("");
});
