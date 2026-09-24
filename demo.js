/**
 * Live demo: render table + decision tree SVG from Socket.IO state.
 */
(() => {
  const tableBody = document.getElementById("demo-tbody");
  const treeHost = document.getElementById("demo-tree");
  const countEl = document.getElementById("demo-count");
  const resetBtn = document.getElementById("demo-reset");
  const joinQrCanvas = document.getElementById("demo-join-qr");
  const joinUrlEl = document.getElementById("demo-join-url");

  if (!tableBody || !treeHost) return;

  const socket = typeof io !== "undefined" ? io() : null;
  let lastIds = new Set();

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderTable(rows) {
    if (countEl) countEl.textContent = String(rows.length);
    const show = rows.slice(-12).reverse();
    tableBody.innerHTML = show
      .map((r) => {
        const cls = r.attend === "Có" ? "yes" : "no";
        const flash = !lastIds.has(r.id) && lastIds.size ? "flash" : "";
        return `<tr class="${flash}">
          <td>${escapeHtml(r.name)}</td>
          <td>${escapeHtml(r.free)}</td>
          <td>${escapeHtml(r.interest)}</td>
          <td>${escapeHtml(r.mode)}</td>
          <td class="${cls}">${escapeHtml(r.attend)}</td>
        </tr>`;
      })
      .join("");
    lastIds = new Set(rows.map((r) => r.id));
  }

  /** Layout tree for SVG */
  function layoutTree(node, depth = 0) {
    if (!node) return null;
    if (node.type === "leaf") {
      return { ...node, width: 1, depth, childrenLaid: [] };
    }
    const entries = Object.entries(node.children || {}).map(([value, child]) => ({
      value,
      child: layoutTree(child, depth + 1),
    }));
    const width = Math.max(
      1,
      entries.reduce((s, e) => s + (e.child?.width || 1), 0)
    );
    return { ...node, width, depth, childrenLaid: entries };
  }

  function assignX(laid, x0, gap) {
    if (!laid) return;
    if (laid.type === "leaf" || !laid.childrenLaid.length) {
      laid.x = x0 + (laid.width * gap) / 2;
      return;
    }
    let cursor = x0;
    for (const e of laid.childrenLaid) {
      assignX(e.child, cursor, gap);
      cursor += e.child.width * gap;
    }
    const xs = laid.childrenLaid.map((e) => e.child.x);
    laid.x = (Math.min(...xs) + Math.max(...xs)) / 2;
  }

  function renderTree(tree) {
    if (!tree) {
      treeHost.innerHTML = "<p class='demo-empty'>Chưa có dữ liệu</p>";
      return;
    }
    const laid = layoutTree(tree);
    // Compact fixed layout — không phình full panel
    const gap = 120;
    assignX(laid, gap * 0.5, gap);
    const maxDepth = (function walk(n, d) {
      if (!n || n.type === "leaf") return d;
      return Math.max(d, ...n.childrenLaid.map((e) => walk(e.child, d + 1)));
    })(laid, 0);

    const xs = [];
    (function collect(n) {
      if (!n) return;
      xs.push(n.x);
      (n.childrenLaid || []).forEach((e) => collect(e.child));
    })(laid);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const pad = 52;
    const W = Math.ceil(maxX - minX + pad * 2);
    const levelH = 52;
    const H = (maxDepth + 1) * levelH + 16;
    const shift = pad - minX;

    function yOf(d) {
      return 16 + d * levelH;
    }

    const parts = [];
    parts.push(
      `<svg class="tree-svg demo-tree-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img">`
    );

    function shortLabel(text) {
      const s = String(text || "");
      return s.length > 14 ? `${s.slice(0, 12)}…` : s;
    }

    function draw(n, parent) {
      if (!n) return;
      const x = n.x + shift;
      const y = yOf(n.depth);
      if (parent) {
        const px = parent.x + shift;
        const py = yOf(parent.depth);
        const midY = (py + y) / 2;
        parts.push(
          `<path class="demo-branch" d="M${px} ${py + 11} V${midY} H${x} V${y - 11}" />`
        );
        if (n._edge) {
          // Đặt nhãn lệch khỏi tâm ngang để khỏi đè nhau
          const labelX = px === x ? x + 14 : (px + x) / 2;
          parts.push(
            `<text class="edge-label" x="${labelX}" y="${midY - 3}" style="font-size:9px">${escapeHtml(n._edge)}</text>`
          );
        }
      }

      if (n.type === "leaf") {
        const cls = n.label === "Có" ? "node-yes" : "node-no";
        const tw = 64;
        parts.push(`<rect class="${cls}" x="${x - tw / 2}" y="${y - 11}" width="${tw}" height="22" rx="6" />`);
        parts.push(
          `<text class="node-text on-dark" x="${x}" y="${y + 3}" style="font-size:9px">${escapeHtml(n.label)} (${n.count})</text>`
        );
      } else {
        const label = shortLabel(n.label);
        const tw = Math.min(96, 12 + label.length * 6);
        parts.push(
          `<rect class="node-mid" x="${x - tw / 2}" y="${y - 11}" width="${tw}" height="22" rx="6" />`
        );
        parts.push(
          `<text class="node-text" x="${x}" y="${y + 3}" style="font-size:9px">${escapeHtml(label)}</text>`
        );
        for (const e of n.childrenLaid) {
          e.child._edge = e.value;
          draw(e.child, n);
        }
      }
    }

    draw(laid, null);
    parts.push("</svg>");
    treeHost.innerHTML = parts.join("");
  }

  function onState(state) {
    renderTable(state.rows || []);
    renderTree(state.tree);
  }

  if (socket) {
    socket.on("state", onState);
  }

  if (resetBtn && socket) {
    resetBtn.addEventListener("click", () => {
    if (confirm("Reset về 3 mẫu: Luân, Thông, Kiên?")) {
      socket.emit("reset");
    }
    });
  }

  // Join QR on demo slide
  async function paintJoinQr() {
    if (!joinQrCanvas || typeof QRCode === "undefined") return;
    let host = location.hostname;
    if (/^(localhost|127\.0\.0\.1)$/i.test(host) && typeof detectLanIp === "function") {
      const lan = await detectLanIp();
      if (lan) host = lan;
    }
    const url = `${location.protocol}//${host}${location.port ? `:${location.port}` : ""}/join.html`;
    if (joinUrlEl) joinUrlEl.textContent = url;
    QRCode.toCanvas(
      joinQrCanvas,
      url,
      { width: 160, margin: 1, color: { dark: "#0c2e28", light: "#ffffff" } },
      () => {}
    );
  }

  paintJoinQr();
})();
