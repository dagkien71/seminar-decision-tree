/**
 * Pen / highlight annotations on slides.
 */
(function () {
  const COLORS = [
    { id: "red", value: "#e11d48", label: "Đỏ" },
    { id: "amber", value: "#f59e0b", label: "Vàng" },
    { id: "green", value: "#059669", label: "Xanh lá" },
    { id: "blue", value: "#2563eb", label: "Xanh dương" },
    { id: "white", value: "#ffffff", label: "Trắng" },
  ];

  const TOOLS = {
    pen: { width: 3.2, alpha: 1, composite: "source-over" },
    highlight: { width: 18, alpha: 0.35, composite: "source-over" },
    eraser: { width: 28, alpha: 1, composite: "destination-out" },
  };

  /** @type {Map<number, Array<{tool:string,color:string,width:number,points:Array<{x:number,y:number}>}>>} */
  const strokesBySlide = new Map();

  let active = false;
  let tool = "pen";
  let color = COLORS[0].value;
  let slideIndex = 0;
  let drawing = false;
  let current = null;
  let canvas = null;
  let ctx = null;
  let toolbar = null;
  let btnToggle = null;
  let dpr = Math.max(1, window.devicePixelRatio || 1);

  function ensureUi() {
    if (canvas) return;

    canvas = document.createElement("canvas");
    canvas.id = "pen-canvas";
    canvas.className = "pen-canvas";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    ctx = canvas.getContext("2d");

    toolbar = document.createElement("div");
    toolbar.id = "pen-toolbar";
    toolbar.className = "pen-toolbar";
    toolbar.hidden = true;
    toolbar.innerHTML = `
      <div class="pen-toolbar-group" role="group" aria-label="Công cụ">
        <button type="button" class="pen-tool is-on" data-tool="pen" title="Bút (1)">Bút</button>
        <button type="button" class="pen-tool" data-tool="highlight" title="Highlight (2)">Highlight</button>
        <button type="button" class="pen-tool" data-tool="eraser" title="Tẩy (3)">Tẩy</button>
      </div>
      <div class="pen-toolbar-group pen-colors" role="group" aria-label="Màu">
        ${COLORS.map(
          (c) =>
            `<button type="button" class="pen-color${c.value === color ? " is-on" : ""}" data-color="${c.value}" title="${c.label}" style="--pen-swatch:${c.value}" aria-label="${c.label}"></button>`
        ).join("")}
      </div>
      <div class="pen-toolbar-group">
        <button type="button" class="pen-action" data-action="undo" title="Hoàn tác (Z)">↩</button>
        <button type="button" class="pen-action" data-action="clear" title="Xóa nét slide này (C)">Xóa</button>
        <button type="button" class="pen-action pen-action-off" data-action="off" title="Tắt bút (P / Esc)">Tắt</button>
      </div>
    `;
    document.body.appendChild(toolbar);

    toolbar.addEventListener("click", (e) => {
      const t = e.target.closest("[data-tool]");
      if (t) {
        setTool(t.dataset.tool);
        return;
      }
      const c = e.target.closest("[data-color]");
      if (c) {
        setColor(c.dataset.color);
        return;
      }
      const a = e.target.closest("[data-action]");
      if (!a) return;
      if (a.dataset.action === "undo") undo();
      else if (a.dataset.action === "clear") clearSlide();
      else if (a.dataset.action === "off") setActive(false);
    });

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);
    canvas.addEventListener("pointerleave", onPointerUp);

    window.addEventListener("resize", () => {
      resizeCanvas();
      redraw();
    });

    btnToggle = document.getElementById("btn-pen");
    btnToggle?.addEventListener("click", () => setActive(!active));
  }

  function resizeCanvas() {
    if (!canvas || !ctx) return;
    dpr = Math.max(1, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function strokes() {
    if (!strokesBySlide.has(slideIndex)) strokesBySlide.set(slideIndex, []);
    return strokesBySlide.get(slideIndex);
  }

  function styleFor(stroke) {
    const base = TOOLS[stroke.tool] || TOOLS.pen;
    return {
      width: stroke.width || base.width,
      alpha: base.alpha,
      composite: base.composite,
      color: stroke.color || color,
    };
  }

  function drawStroke(stroke, previewPoint) {
    const pts = stroke.points;
    if (!pts.length) return;
    const s = styleFor(stroke);
    ctx.save();
    ctx.globalCompositeOperation = s.composite;
    ctx.globalAlpha = s.alpha;
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (pts.length === 1 && !previewPoint) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, s.width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i += 1) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    if (previewPoint) ctx.lineTo(previewPoint.x, previewPoint.y);
    ctx.stroke();
    ctx.restore();
  }

  function redraw() {
    if (!ctx || !canvas) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    for (const stroke of strokes()) drawStroke(stroke);
    if (current) drawStroke(current);
  }

  function pointFromEvent(e) {
    return { x: e.clientX, y: e.clientY };
  }

  function onPointerDown(e) {
    if (!active) return;
    if (e.button != null && e.button !== 0) return;
    e.preventDefault();
    canvas.setPointerCapture?.(e.pointerId);
    drawing = true;
    const conf = TOOLS[tool] || TOOLS.pen;
    current = {
      tool,
      color: tool === "eraser" ? "#000" : color,
      width: conf.width,
      points: [pointFromEvent(e)],
    };
    redraw();
  }

  function onPointerMove(e) {
    if (!drawing || !current) return;
    e.preventDefault();
    const p = pointFromEvent(e);
    const last = current.points[current.points.length - 1];
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < 1.2) return;
    current.points.push(p);
    redraw();
  }

  function onPointerUp(e) {
    if (!drawing) return;
    drawing = false;
    try {
      canvas.releasePointerCapture?.(e.pointerId);
    } catch (_) {}
    if (current && current.points.length) {
      strokes().push(current);
    }
    current = null;
    redraw();
  }

  function setTool(next) {
    if (!TOOLS[next]) return;
    tool = next;
    toolbar?.querySelectorAll("[data-tool]").forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.tool === tool);
    });
    canvas?.classList.toggle("is-eraser", tool === "eraser");
    canvas?.classList.toggle("is-highlight", tool === "highlight");
  }

  function setColor(next) {
    color = next;
    toolbar?.querySelectorAll("[data-color]").forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.color === color);
    });
    if (tool === "eraser") setTool("pen");
  }

  function undo() {
    const list = strokes();
    if (!list.length) return;
    list.pop();
    redraw();
  }

  function clearSlide() {
    strokesBySlide.set(slideIndex, []);
    current = null;
    drawing = false;
    redraw();
  }

  function updateToggle() {
    if (!btnToggle) btnToggle = document.getElementById("btn-pen");
    if (!btnToggle) return;
    btnToggle.classList.toggle("is-on", active);
    btnToggle.setAttribute("aria-pressed", active ? "true" : "false");
    btnToggle.textContent = active ? "Bút: bật" : "Bút";
  }

  function setActive(on) {
    ensureUi();
    active = Boolean(on);
    document.body.classList.toggle("pen-mode", active);
    if (toolbar) toolbar.hidden = !active;
    if (canvas) {
      canvas.classList.toggle("is-active", active);
      canvas.style.pointerEvents = active ? "auto" : "none";
    }
    if (active) {
      resizeCanvas();
      redraw();
      setTool(tool);
    } else {
      drawing = false;
      current = null;
    }
    updateToggle();
  }

  function setSlideIndex(i) {
    if (typeof i !== "number" || i < 0) return;
    if (i === slideIndex) return;
    slideIndex = i;
    drawing = false;
    current = null;
    if (canvas && ctx) redraw();
  }

  document.addEventListener(
    "keydown",
    (e) => {
      if (document.body.classList.contains("modal-open")) return;
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;

      if (e.key === "p" || e.key === "P") {
        e.preventDefault();
        e.stopPropagation();
        setActive(!active);
        return;
      }

      if (!active) return;

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        setActive(false);
        return;
      }
      if (e.key === "1") {
        e.preventDefault();
        setTool("pen");
      } else if (e.key === "2") {
        e.preventDefault();
        setTool("highlight");
      } else if (e.key === "3") {
        e.preventDefault();
        setTool("eraser");
      } else if (e.key === "c" || e.key === "C") {
        e.preventDefault();
        clearSlide();
      } else if ((e.key === "z" || e.key === "Z") && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        undo();
      }
    },
    true
  );

  window.DeckPen = {
    isActive: () => active,
    setActive,
    setSlideIndex,
    clearSlide,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      ensureUi();
      updateToggle();
      const h = parseInt(location.hash.slice(1), 10);
      if (Number.isFinite(h) && h >= 1) slideIndex = h - 1;
    });
  } else {
    ensureUi();
    updateToggle();
    const h = parseInt(location.hash.slice(1), 10);
    if (Number.isFinite(h) && h >= 1) slideIndex = h - 1;
  }
})();
