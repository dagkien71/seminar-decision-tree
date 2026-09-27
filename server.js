const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const os = require("os");
const { buildTree, seedRows } = require("./lib/tree");
const { loadSettings, saveSettings, resetSettings } = require("./lib/settings");
const { listVisibleSlides } = require("./lib/slides");

const PORT = Number(process.env.PORT) || 3000;
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: "2mb" }));

app.get("/setting", (_req, res) => {
  res.sendFile(path.join(__dirname, "setting.html"));
});

app.get("/control", (_req, res) => {
  res.sendFile(path.join(__dirname, "control.html"));
});

app.get("/api/settings", (_req, res) => {
  res.json(loadSettings());
});

app.put("/api/settings", (req, res) => {
  try {
    const saved = saveSettings(req.body || {});
    res.json({ ok: true, settings: saved });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message || "Không lưu được" });
  }
});

app.post("/api/settings/reset", (_req, res) => {
  const settings = resetSettings();
  res.json({ ok: true, settings });
});

app.get("/api/slides", (_req, res) => {
  const slides = listVisibleSlides();
  let index = deck.index;
  if (deck.slideId) {
    const found = slides.findIndex((s) => s.id === deck.slideId);
    if (found >= 0) index = found;
  }
  index = Math.max(0, Math.min(Math.max(slides.length - 1, 0), index));
  res.json({ slides, currentIndex: index, currentId: slides[index]?.id || null });
});

app.use(express.static(path.join(__dirname)));

let rows = seedRows();
let nextId = 1;
let deck = { index: 0, slideId: null };

function publicState() {
  return {
    rows,
    tree: buildTree(rows),
    count: rows.length,
  };
}

function deckState() {
  return { ...deck };
}

function broadcast() {
  io.emit("state", publicState());
}

function broadcastDeck() {
  io.emit("deck:state", deckState());
}

function applyGoto(payload) {
  const slides = listVisibleSlides();
  if (!slides.length) return deckState();

  let index = typeof payload?.index === "number" ? payload.index : -1;
  if (payload?.slideId) {
    const found = slides.findIndex((s) => s.id === String(payload.slideId));
    if (found >= 0) index = found;
  }
  if (index < 0) index = 0;
  index = Math.max(0, Math.min(slides.length - 1, index));
  deck = { index, slideId: slides[index].id };
  return deckState();
}

io.on("connection", (socket) => {
  socket.emit("state", publicState());
  socket.emit("deck:state", deckState());

  socket.on("deck:goto", (payload, ack) => {
    const state = applyGoto(payload || {});
    broadcastDeck();
    if (typeof ack === "function") ack({ ok: true, ...state });
  });

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
  console.log(`  Slides:   http://localhost:${PORT}/`);
  console.log(`  Control:  http://localhost:${PORT}/control`);
  console.log(`  Setting:  http://localhost:${PORT}/setting`);
  console.log(`  Join:     http://localhost:${PORT}/join.html`);
  for (const ip of ips) {
    console.log(`  LAN:      http://${ip}:${PORT}/`);
    console.log(`  Control:  http://${ip}:${PORT}/control`);
  }
  console.log("");
});
