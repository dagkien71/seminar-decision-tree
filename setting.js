(() => {
  const thumbList = document.getElementById("thumb-list");
  const canvas = document.getElementById("canvas");
  const slideLabel = document.getElementById("slide-label");
  const statusEl = document.getElementById("status");
  const btnSave = document.getElementById("btn-save");
  const btnReset = document.getElementById("btn-reset");
  const btnHide = document.getElementById("btn-hide");
  const btnShowAll = document.getElementById("btn-show-all");

  /** @type {{ id: string, title: string, html: string }[]} */
  let slides = [];
  /** @type {{ hidden: string[], texts: Record<string, Record<string, string>> }} */
  let settings = { hidden: [], texts: {} };
  let selectedId = null;
  let dirty = false;
  let previewSlide = null;

  document.documentElement.classList.add("ppt-html");

  function setStatus(msg, kind) {
    statusEl.textContent = msg || "";
    statusEl.className = "ppt-status" + (kind ? ` ${kind}` : "");
  }

  function markDirty() {
    dirty = true;
    setStatus("Chưa lưu", "");
  }

  function isVisible(id) {
    return !settings.hidden.includes(id);
  }

  function parseDeck(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return [...doc.querySelectorAll(".slide")]
      .map((slide) => {
        const id = slide.dataset.slideId || "";
        const title = slide.dataset.title || id || "Slide";
        const clone = slide.cloneNode(true);
        clone.classList.remove("active", "slide-hidden");
        return { id, title, html: clone.outerHTML };
      })
      .filter((s) => s.id);
  }

  function makeSlideEl(slideData) {
    const wrap = document.createElement("div");
    wrap.innerHTML = slideData.html;
    const el = wrap.firstElementChild;
    el.classList.remove("active", "slide-hidden");
    el.classList.add("active");
    if (settings.texts?.[slideData.id]) {
      window.applySlideTexts(el, settings.texts[slideData.id]);
    }
    window.renderDeckMath?.(el);
    return el;
  }

  function scaleThumbs() {
    thumbList.querySelectorAll(".ppt-thumb-frame").forEach((frame) => {
      const scaleEl = frame.querySelector(".ppt-thumb-scale");
      if (!scaleEl) return;
      const w = frame.clientWidth;
      const factor = w / 1280;
      scaleEl.style.transform = `scale(${factor})`;
    });
  }

  function renderThumbs() {
    const keepScroll = thumbList.scrollTop;
    thumbList.innerHTML = "";

    slides.forEach((slide, i) => {
      const btn = document.createElement("div");
      btn.className = "ppt-thumb";
      btn.dataset.id = slide.id;
      if (slide.id === selectedId) btn.classList.add("active");
      if (!isVisible(slide.id)) btn.classList.add("is-hidden");

      const meta = document.createElement("div");
      meta.className = "ppt-thumb-meta";
      meta.innerHTML = `<strong>${i + 1}. ${slide.title}</strong>`;

      const eye = document.createElement("button");
      eye.type = "button";
      eye.className = "ppt-thumb-eye";
      eye.title = isVisible(slide.id) ? "Ẩn slide" : "Hiện slide";
      eye.textContent = isVisible(slide.id) ? "Ẩn" : "Hiện";
      eye.addEventListener("click", (e) => {
        e.stopPropagation();
        setVisible(slide.id, !isVisible(slide.id));
      });
      meta.appendChild(eye);

      const frame = document.createElement("div");
      frame.className = "ppt-thumb-frame";
      const scale = document.createElement("div");
      scale.className = "ppt-thumb-scale";
      scale.appendChild(makeSlideEl(slide));
      frame.appendChild(scale);

      btn.append(meta, frame);
      btn.addEventListener("click", () => selectSlide(slide.id));
      thumbList.appendChild(btn);
    });

    thumbList.scrollTop = keepScroll;
    requestAnimationFrame(scaleThumbs);
    syncHideButton();
  }

  function collectTextsFromPreview() {
    if (!previewSlide || !selectedId) return;
    const map = {};
    window.getSlideEditableElements(previewSlide).forEach((el, i) => {
      map[`t${i}`] = el.innerHTML;
    });
    settings.texts[selectedId] = map;
  }

  function enableInlineEdit(slideEl, slideId) {
    window.getSlideEditableElements(slideEl).forEach((el, i) => {
      const key = `t${i}`;
      el.dataset.editKey = key;
      el.contentEditable = "true";
      el.spellcheck = true;
      el.addEventListener("input", () => {
        if (!settings.texts[slideId]) settings.texts[slideId] = {};
        settings.texts[slideId][key] = el.innerHTML;
        markDirty();
        // refresh matching thumb quietly
        refreshThumb(slideId);
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey && el.tagName !== "LI" && !el.classList.contains("formula")) {
          // keep single-line feel for headings
          if (/^H[1-3]$/.test(el.tagName)) {
            e.preventDefault();
            el.blur();
          }
        }
        e.stopPropagation();
      });
    });
  }

  function refreshThumb(id) {
    const card = thumbList.querySelector(`.ppt-thumb[data-id="${id}"]`);
    if (!card) return;
    const scale = card.querySelector(".ppt-thumb-scale");
    const slide = slides.find((s) => s.id === id);
    if (!scale || !slide) return;
    scale.innerHTML = "";
    scale.appendChild(makeSlideEl(slide));
    requestAnimationFrame(scaleThumbs);
  }

  function selectSlide(id) {
    if (selectedId && selectedId !== id) collectTextsFromPreview();
    selectedId = id;
    const slide = slides.find((s) => s.id === id);
    if (!slide) return;

    canvas.innerHTML = "";
    canvas.classList.toggle("is-hidden-slide", !isVisible(id));
    previewSlide = makeSlideEl(slide);
    canvas.appendChild(previewSlide);
    enableInlineEdit(previewSlide, id);

    const idx = slides.findIndex((s) => s.id === id) + 1;
    slideLabel.textContent = `Slide ${idx} / ${slides.length} — ${slide.title}`;
    syncHideButton();

    thumbList.querySelectorAll(".ppt-thumb").forEach((el) => {
      el.classList.toggle("active", el.dataset.id === id);
      el.classList.toggle("is-hidden", !isVisible(el.dataset.id));
    });

    const activeThumb = thumbList.querySelector(`.ppt-thumb[data-id="${id}"]`);
    activeThumb?.scrollIntoView({ block: "nearest" });
  }

  function setVisible(id, visible) {
    const set = new Set(settings.hidden);
    if (visible) set.delete(id);
    else set.add(id);
    settings.hidden = [...set];
    markDirty();

    const card = thumbList.querySelector(`.ppt-thumb[data-id="${id}"]`);
    if (card) {
      card.classList.toggle("is-hidden", !visible);
      const eye = card.querySelector(".ppt-thumb-eye");
      if (eye) {
        eye.textContent = visible ? "Ẩn" : "Hiện";
        eye.title = visible ? "Ẩn slide" : "Hiện slide";
      }
    }
    if (selectedId === id) {
      canvas.classList.toggle("is-hidden-slide", !visible);
      syncHideButton();
    }
  }

  function syncHideButton() {
    if (!selectedId) {
      btnHide.textContent = "Ẩn slide";
      btnHide.disabled = true;
      return;
    }
    btnHide.disabled = false;
    const visible = isVisible(selectedId);
    btnHide.textContent = visible ? "Ẩn slide" : "Hiện slide";
    btnHide.classList.toggle("danger-ish", visible);
  }

  async function load() {
    setStatus("Đang tải…");
    const [deckRes, settingsRes] = await Promise.all([
      fetch("/index.html", { cache: "no-store" }),
      fetch("/api/settings", { cache: "no-store" }),
    ]);
    if (!deckRes.ok) throw new Error("Không đọc được slides");
    if (!settingsRes.ok) throw new Error("Không đọc được settings");
    slides = parseDeck(await deckRes.text());
    settings = await settingsRes.json();
    if (!Array.isArray(settings.hidden)) settings.hidden = [];
    if (!settings.texts || typeof settings.texts !== "object") settings.texts = {};
    dirty = false;
    renderThumbs();
    if (slides.length) {
      selectSlide(
        selectedId && slides.some((s) => s.id === selectedId) ? selectedId : slides[0].id
      );
    }
    setStatus(`${slides.length} slide`, "ok");
  }

  btnHide.addEventListener("click", () => {
    if (!selectedId) return;
    setVisible(selectedId, !isVisible(selectedId));
  });

  btnShowAll.addEventListener("click", () => {
    settings.hidden = [];
    markDirty();
    renderThumbs();
    if (selectedId) selectSlide(selectedId);
  });

  btnSave.addEventListener("click", async () => {
    collectTextsFromPreview();
    try {
      btnSave.disabled = true;
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Lưu thất bại");
      settings = data.settings;
      dirty = false;
      setStatus("Đã lưu", "ok");
      renderThumbs();
      if (selectedId) selectSlide(selectedId);
    } catch (err) {
      setStatus(err.message || "Lỗi lưu", "err");
    } finally {
      btnSave.disabled = false;
    }
  });

  btnReset.addEventListener("click", async () => {
    if (!confirm("Xoá toàn bộ ẩn/hiện và text đã sửa?")) return;
    try {
      const res = await fetch("/api/settings/reset", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Reset thất bại");
      settings = data.settings;
      dirty = false;
      renderThumbs();
      if (selectedId) selectSlide(selectedId);
      setStatus("Đã về bản gốc", "ok");
    } catch (err) {
      setStatus(err.message || "Lỗi reset", "err");
    }
  });

  document.addEventListener("keydown", (e) => {
    const editing = document.activeElement?.isContentEditable;
    if (editing) {
      if (e.key === "Escape") document.activeElement.blur();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "PageDown") {
      e.preventDefault();
      const i = slides.findIndex((s) => s.id === selectedId);
      if (i >= 0 && i < slides.length - 1) selectSlide(slides[i + 1].id);
    } else if (e.key === "ArrowUp" || e.key === "PageUp") {
      e.preventDefault();
      const i = slides.findIndex((s) => s.id === selectedId);
      if (i > 0) selectSlide(slides[i - 1].id);
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      btnSave.click();
    }
  });

  window.addEventListener("resize", scaleThumbs);
  window.addEventListener("beforeunload", (e) => {
    if (!dirty) return;
    e.preventDefault();
    e.returnValue = "";
  });

  load().catch((err) => setStatus(err.message || "Lỗi tải", "err"));
})();
