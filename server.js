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
/** @type {Map<string, { id: string, name: string, index: number, slideId: string|null }>} */
const displays = new Map();

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

function listDisplays() {
  return [...displays.values()].map((d) => ({ ...d }));
}

function nextDisplayCode() {
  const used = new Set([...displays.values()].map((d) => d.code));
  for (let n = 1; n < 1000; n += 1) {
    const code = String(n).padStart(2, "0");
    if (!used.has(code)) return code;
  }
  return String(Date.now()).slice(-3);
}

function broadcast() {
  io.emit("state", publicState());
}

function broadcastDisplays() {
  io.to("controllers").emit("displays:list", listDisplays());
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

function resolveTargetId(payload) {
  const requested = payload?.targetId ? String(payload.targetId) : "";
  if (requested && displays.has(requested)) return requested;
  if (displays.size === 1) return [...displays.keys()][0];
  return null;
}

function sendDeckToDisplay(targetId, state) {
  if (!targetId || !displays.has(targetId)) return false;
  const entry = displays.get(targetId);
  entry.index = state.index;
  entry.slideId = state.slideId;
  displays.set(targetId, entry);
  io.to(targetId).emit("deck:state", { ...state, targetId });
  broadcastDisplays();
  return true;
}

io.on("connection", (socket) => {
  socket.emit("state", publicState());

  socket.on("control:join", (_payload, ack) => {
    socket.join("controllers");
    socket.emit("displays:list", listDisplays());
    if (typeof ack === "function") ack({ ok: true, displays: listDisplays() });
  });

  socket.on("display:register", (payload, ack) => {
    const name = String(payload?.name || "Màn chiếu").trim().slice(0, 40) || "Màn chiếu";
    let index = typeof payload?.index === "number" ? payload.index : deck.index;
    let slideId = payload?.slideId ? String(payload.slideId) : deck.slideId;
    const slides = listVisibleSlides();
    if (slideId) {
      const found = slides.findIndex((s) => s.id === slideId);
      if (found >= 0) index = found;
    }
    index = Math.max(0, Math.min(Math.max(slides.length - 1, 0), index));
    slideId = slides[index]?.id || null;

    const existing = displays.get(socket.id);
    const code = existing?.code || nextDisplayCode();
    displays.set(socket.id, {
      id: socket.id,
      code,
      name,
      index,
      slideId,
    });
    socket.join("displays");
    broadcastDisplays();
    if (typeof ack === "function") {
      ack({ ok: true, id: socket.id, code, name, index, slideId });
    }
  });

  socket.on("display:identify", (payload, ack) => {
    const targetId = resolveTargetId(payload || {});
    if (!targetId) {
      if (typeof ack === "function") ack({ ok: false, error: "Chưa chọn màn chiếu" });
      return;
    }
    const entry = displays.get(targetId);
    io.to(targetId).emit("display:identify", {
      code: entry?.code || null,
      name: entry?.name || null,
    });
    if (typeof ack === "function") ack({ ok: true, targetId, code: entry?.code });
  });

  socket.on("display:rename", (payload, ack) => {
    const entry = displays.get(socket.id);
    if (!entry) {
      if (typeof ack === "function") ack({ ok: false, error: "Chưa đăng ký màn chiếu" });
      return;
    }
    entry.name = String(payload?.name || entry.name).trim().slice(0, 40) || entry.name;
    displays.set(socket.id, entry);
    broadcastDisplays();
    if (typeof ack === "function") ack({ ok: true, ...entry });
  });

  socket.on("display:unregister", (_payload, ack) => {
    if (displays.delete(socket.id)) broadcastDisplays();
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("display:sync", (payload, ack) => {
    const entry = displays.get(socket.id);
    if (!entry) {
      if (typeof ack === "function") ack({ ok: false });
      return;
    }
    const state = applyGoto(payload || {});
    entry.index = state.index;
    entry.slideId = state.slideId;
    displays.set(socket.id, entry);
    // Chỉ cập nhật remote/control — không đẩy sang các màn khác
    io.to("controllers").emit("deck:state", { ...state, targetId: socket.id });
    broadcastDisplays();
    if (typeof ack === "function") ack({ ok: true, ...state });
  });

  socket.on("deck:goto", (payload, ack) => {
    const state = applyGoto(payload || {});
    const targetId = resolveTargetId(payload || {});
    const delivered = targetId ? sendDeckToDisplay(targetId, state) : false;
    io.to("controllers").emit("deck:state", {
      ...state,
      targetId: delivered ? targetId : null,
    });
    if (typeof ack === "function") {
      ack({
        ok: delivered,
        ...state,
        targetId: delivered ? targetId : null,
        error: delivered ? undefined : "Chưa chọn / chưa có màn chiếu nhận remote",
      });
    }
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

  socket.on("disconnect", () => {
    if (displays.delete(socket.id)) broadcastDisplays();
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
