(() => {
  const bar = document.getElementById("bar");
  const counter = document.getElementById("counter");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  const controls = document.querySelector(".controls");
  const slideRail = document.getElementById("slide-rail");
  const slideRailList = document.getElementById("slide-rail-list");
  const btnPresent = document.getElementById("btn-present");
  const btnPresentBar = document.getElementById("btn-present-bar");
  const btnRemote = document.getElementById("btn-remote");
  let slides = [];
  let index = 0;
  let syncing = false;
  let socket = null;
  let controlsHideTimer = null;
  let controlsPinned = false;
  let mode = "present"; // present | overview
  let followRemote = false;
  let displayId = null;
  let displayCode = null;
  let identifyTimer = null;
  const DISPLAY_KEY = "dt-follow-remote";
  const DISPLAY_NAME_KEY = "dt-display-name";

  function flashIdentify(payload) {
    if (payload?.code) displayCode = String(payload.code);
    updateRemoteButton();
    document.body.classList.add("is-display-identify");
    clearTimeout(identifyTimer);
    identifyTimer = setTimeout(() => {
      document.body.classList.remove("is-display-identify");
    }, 1600);
  }

  function isOverview() {
    return mode === "overview";
  }

  function setMode(next) {
    mode = next === "overview" ? "overview" : "present";
    document.body.classList.toggle("mode-overview", mode === "overview");
    document.body.classList.toggle("mode-present", mode === "present");
    if (slideRail) {
      if (mode === "overview") slideRail.removeAttribute("hidden");
      else slideRail.setAttribute("hidden", "");
    }
    if (mode === "overview") {
      controlsPinned = true;
      showControls();
      syncRailActive();
      scrollRailIntoView();
    } else {
      controlsPinned = false;
      hideControls();
    }
  }

  function buildRail() {
    if (!slideRailList) return;
    slideRailList.innerHTML = slides
      .map((s, i) => {
        const title = s.dataset.title || `Slide ${i + 1}`;
        const num = String(i + 1).padStart(2, "0");
        return `<li>
          <button type="button" class="slide-rail-btn" data-rail-index="${i}">
            <span class="slide-rail-num">${num}</span>
            <span class="slide-rail-label">${title.replace(/</g, "&lt;")}</span>
          </button>
        </li>`;
      })
      .join("");
  }

  function syncRailActive() {
    if (!slideRailList) return;
    slideRailList.querySelectorAll(".slide-rail-btn").forEach((btn) => {
      const i = Number(btn.dataset.railIndex);
      btn.classList.toggle("is-active", i === index);
    });
  }

  function scrollRailIntoView() {
    const active = slideRailList?.querySelector(".slide-rail-btn.is-active");
    active?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function showControls(ms = 2200) {
    if (!controls) return;
    controls.classList.add("is-visible");
    clearTimeout(controlsHideTimer);
    if (controlsPinned || isOverview()) return;
    controlsHideTimer = setTimeout(() => {
      if (!controlsPinned && !isOverview()) controls.classList.remove("is-visible");
    }, ms);
  }

  function hideControls() {
    if (!controls || controlsPinned || isOverview()) return;
    clearTimeout(controlsHideTimer);
    controls.classList.remove("is-visible");
  }

  if (controls) {
    controls.addEventListener("mouseenter", () => {
      if (isOverview()) return;
      controlsPinned = true;
      showControls();
    });
    controls.addEventListener("mouseleave", () => {
      if (isOverview()) return;
      controlsPinned = false;
      showControls(1200);
    });
  }

  // Di chuyển chuột / cuộn xuống → hiện thanh điều hướng (chế độ trình chiếu)
  let moveShowRaf = 0;
  window.addEventListener(
    "mousemove",
    () => {
      if (isOverview()) return;
      if (document.body.classList.contains("modal-open") || window.isAppModalOpen?.()) {
        return;
      }
      if (moveShowRaf) return;
      moveShowRaf = requestAnimationFrame(() => {
        moveShowRaf = 0;
        showControls();
      });
    },
    { passive: true }
  );

  window.addEventListener(
    "wheel",
    (e) => {
      if (isOverview()) return;
      if (document.body.classList.contains("modal-open") || window.isAppModalOpen?.()) {
        return;
      }
      if (e.deltaY > 4) showControls();
      else if (e.deltaY < -4) hideControls();
    },
    { passive: true }
  );

  function enterPresent() {
    setMode("present");
  }

  function enterOverview() {
    setMode("overview");
  }

  btnPresent?.addEventListener("click", enterPresent);
  btnPresentBar?.addEventListener("click", enterPresent);

  slideRailList?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-rail-index]");
    if (!btn) return;
    go(Number(btn.dataset.railIndex));
  });

  function emitGoto() {
    // Chỉ báo cho remote khi màn này đang nhận điều khiển — không broadcast mọi tab
    if (syncing || !followRemote || !socket?.connected || !slides.length) return;
    const slide = slides[index];
    socket.emit("display:sync", {
      index,
      slideId: slide?.dataset?.slideId || null,
    });
  }

  function updateRemoteButton() {
    if (!btnRemote) return;
    btnRemote.classList.toggle("is-on", followRemote);
    btnRemote.setAttribute("aria-pressed", followRemote ? "true" : "false");
    btnRemote.textContent = followRemote
      ? `Remote #${displayCode || "…"}`
      : "Remote: tắt";
    btnRemote.title = followRemote
      ? `Màn này là #${displayCode || "?"} — remote chọn đúng mã này mới điều khiển được`
      : "Bật để remote chỉ điều khiển màn này (các tab khác không bị kéo theo)";
  }

  function defaultDisplayName() {
    try {
      const saved = sessionStorage.getItem(DISPLAY_NAME_KEY);
      if (saved) return saved;
    } catch (_) {}
    return "Màn chiếu";
  }

  function registerDisplay() {
    if (!socket?.connected) return;
    socket.emit(
      "display:register",
      {
        name: defaultDisplayName(),
        index,
        slideId: slides[index]?.dataset?.slideId || null,
      },
      (res) => {
        if (res?.ok) {
          displayId = res.id;
          displayCode = res.code || null;
          updateRemoteButton();
        }
      }
    );
  }

  function unregisterDisplay() {
    displayId = null;
    displayCode = null;
    if (!socket?.connected) return;
    socket.emit("display:unregister");
  }

  function setFollowRemote(on, persist = true) {
    followRemote = Boolean(on);
    if (persist) {
      try {
        sessionStorage.setItem(DISPLAY_KEY, followRemote ? "1" : "0");
      } catch (_) {}
    }
    updateRemoteButton();
    if (followRemote) {
      ensureSocket();
      registerDisplay();
    } else {
      unregisterDisplay();
    }
  }

  function go(i, fromRemote) {
    if (!slides.length) return;
    index = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((s, n) => s.classList.toggle("active", n === index));
    const pct = ((index + 1) / slides.length) * 100;
    bar.style.width = `${pct}%`;
    counter.textContent = `${index + 1} / ${slides.length}`;
    document.title = `Decision Tree — ${slides[index].dataset.title || "Seminar"}`;
    const hash = `#${index + 1}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
    syncRailActive();
    if (isOverview()) scrollRailIntoView();
    if (!fromRemote) emitGoto();
  }

  function next() {
    go(index + 1);
  }

  function prev() {
    go(index - 1);
  }

  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);

  document.addEventListener("keydown", (e) => {
    if (document.body.classList.contains("modal-open") || window.isAppModalOpen?.()) {
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      if (isOverview()) enterPresent();
      else enterOverview();
      return;
    }
    if (["ArrowRight", "ArrowDown", " ", "PageDown", "Enter"].includes(e.key)) {
      e.preventDefault();
      next();
    } else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(e.key)) {
      e.preventDefault();
      prev();
    } else if (e.key === "Home") {
      e.preventDefault();
      go(0);
    } else if (e.key === "End") {
      e.preventDefault();
      go(slides.length - 1);
    }
  });

  let touchX = null;
  document.addEventListener(
    "touchstart",
    (e) => {
      touchX = e.changedTouches[0].screenX;
    },
    { passive: true }
  );
  document.addEventListener(
    "touchend",
    (e) => {
      if (touchX == null) return;
      const dx = e.changedTouches[0].screenX - touchX;
      if (Math.abs(dx) > 50) (dx < 0 ? next : prev)();
      touchX = null;
    },
    { passive: true }
  );

  window.addEventListener("hashchange", () => {
    const h = parseInt(location.hash.slice(1), 10);
    if (Number.isFinite(h) && h >= 1) go(h - 1);
  });

  function applyDeckState(state) {
    if (!followRemote || !state || !slides.length) return;
    let i = typeof state.index === "number" ? state.index : -1;
    if (state.slideId) {
      const found = slides.findIndex((s) => s.dataset.slideId === state.slideId);
      if (found >= 0) i = found;
    }
    if (i < 0 || i === index) return;
    syncing = true;
    go(i, true);
    syncing = false;
  }

  function ensureSocket() {
    if (typeof io === "undefined") return;
    if (socket) return;
    socket = io();
    socket.on("connect", () => {
      if (followRemote) registerDisplay();
    });
    socket.on("deck:state", applyDeckState);
    socket.on("display:identify", flashIdentify);
  }

  function wantsFollowRemoteOnBoot() {
    try {
      const params = new URLSearchParams(location.search);
      if (params.get("display") === "1" || params.get("remote") === "1") return true;
      return sessionStorage.getItem(DISPLAY_KEY) === "1";
    } catch (_) {
      return false;
    }
  }

  async function boot() {
    let settings = { hidden: [], texts: {} };
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      if (res.ok) settings = await res.json();
    } catch (_) {
      /* offline / file:// */
    }

    const all = [...document.querySelectorAll(".slide")];
    const hidden = new Set(Array.isArray(settings.hidden) ? settings.hidden : []);

    all.forEach((slide) => {
      const id = slide.dataset.slideId;
      if (id && settings.texts?.[id]) {
        window.applySlideTexts?.(slide, settings.texts[id]);
      }
      const isHidden = id && hidden.has(id);
      slide.classList.toggle("slide-hidden", Boolean(isHidden));
      slide.classList.remove("active");
    });

    slides = all.filter((s) => !s.classList.contains("slide-hidden"));
    window.PicnicDeck?.init?.();
    window.renderDeckMath?.(document);
    if (!slides.length) {
      counter.textContent = "0 / 0";
      bar.style.width = "0%";
      return;
    }

    buildRail();
    setMode("present");
    updateRemoteButton();
    btnRemote?.addEventListener("click", () => setFollowRemote(!followRemote));

    const hash = parseInt(location.hash.slice(1), 10);
    go(Number.isFinite(hash) && hash >= 1 ? hash - 1 : 0, true);
    // Mặc định độc lập — chỉ nhận remote khi bật trên màn chiếu
    if (wantsFollowRemoteOnBoot()) setFollowRemote(true);
  }

  boot();
})();

function pageBaseUrl(host) {
  const h = host || location.hostname;
  return `${location.protocol}//${h}${location.port ? `:${location.port}` : ""}${location.pathname}`;
}

function detectLanIp() {
  return new Promise((resolve) => {
    const local = /^(localhost|127\.0\.0\.1)$/i.test(location.hostname);
    if (!local) {
      resolve(null);
      return;
    }
    const rtc = window.RTCPeerConnection
      ? new RTCPeerConnection({ iceServers: [] })
      : null;
    if (!rtc) {
      resolve(null);
      return;
    }
    let done = false;
    const finish = (ip) => {
      if (done) return;
      done = true;
      try {
        rtc.close();
      } catch (_) {}
      resolve(ip);
    };
    setTimeout(() => finish(null), 1200);
    rtc.createDataChannel("");
    rtc
      .createOffer()
      .then((o) => rtc.setLocalDescription(o))
      .catch(() => finish(null));
    rtc.onicecandidate = (e) => {
      if (!e.candidate) return;
      const m = /([0-9]{1,3}(\.[0-9]{1,3}){3})/.exec(e.candidate.candidate || "");
      if (m && !m[1].startsWith("127.")) finish(m[1]);
    };
  });
}
