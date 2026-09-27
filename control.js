(() => {
  const listEl = document.getElementById("list");
  const statusEl = document.getElementById("status");
  const nowEl = document.getElementById("now");
  const btnPrev = document.getElementById("btn-prev");
  const btnNext = document.getElementById("btn-next");
  const btnHw = document.getElementById("btn-hw");
  const hwAudio = document.getElementById("hw-audio");

  /** @type {{ id: string, title: string, index: number, number: number }[]} */
  let slides = [];
  let index = 0;
  let socket = null;

  // WAV im lặng rất ngắn — giữ Media Session active trên mobile
  const SILENT_WAV =
    "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAAAAAA==";

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = "ctrl-status" + (kind ? ` ${kind}` : "");
  }

  function renderList() {
    listEl.innerHTML = "";
    slides.forEach((s) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "ctrl-item" + (s.index === index ? " active" : "");
      btn.innerHTML = `<span class="ctrl-num">${String(s.number).padStart(2, "0")}</span>
        <span><span class="ctrl-title">${s.title}</span><span class="ctrl-id">${s.id}</span></span>`;
      btn.addEventListener("click", () => goto(s.index));
      listEl.appendChild(btn);
    });
    const cur = slides[index];
    nowEl.textContent = cur
      ? `${cur.number} / ${slides.length} — ${cur.title}`
      : "—";
  }

  function goto(i) {
    if (!slides.length) return;
    const next = Math.max(0, Math.min(slides.length - 1, i));
    index = next;
    const slide = slides[index];
    renderList();
    listEl.querySelector(".ctrl-item.active")?.scrollIntoView({ block: "nearest" });
    if (socket?.connected) {
      socket.emit("deck:goto", { index: slide.index, slideId: slide.id });
    }
    syncMediaSession();
  }

  function syncMediaSession() {
    if (!navigator.mediaSession) return;
    const cur = slides[index];
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: cur ? `${cur.number}. ${cur.title}` : "Decision Tree",
        artist: "Slide remote",
        album: "Seminar",
      });
      navigator.mediaSession.playbackState = "playing";
    } catch (_) {
      /* ignore */
    }
  }

  async function enableHardwareRemote() {
    if (!hwAudio) return;
    hwAudio.src = SILENT_WAV;
    hwAudio.volume = 0.01;
    try {
      await hwAudio.play();
    } catch (err) {
      setStatus("Cần bấm lại để bật audio", "err");
      throw err;
    }

    if (navigator.mediaSession) {
      const bind = (action, fn) => {
        try {
          navigator.mediaSession.setActionHandler(action, fn);
        } catch (_) {
          /* action không hỗ trợ */
        }
      };
      bind("nexttrack", () => goto(index + 1));
      bind("previoustrack", () => goto(index - 1));
      bind("seekforward", () => goto(index + 1));
      bind("seekbackward", () => goto(index - 1));
      bind("play", () => {
        hwAudio.play().catch(() => {});
        goto(index + 1);
      });
      bind("pause", () => goto(index - 1));
      syncMediaSession();
    }

    btnHw.classList.add("on");
    btnHw.textContent = "Tai nghe / remote đã bật";
    setStatus("Tai nghe Next/Prev sẵn sàng", "ok");
  }

  async function loadSlides() {
    const res = await fetch("/api/slides", { cache: "no-store" });
    if (!res.ok) throw new Error("Không tải danh sách slide");
    const data = await res.json();
    slides = Array.isArray(data.slides) ? data.slides : [];
    if (typeof data.currentIndex === "number") {
      index = Math.max(0, Math.min(slides.length - 1, data.currentIndex));
    }
    renderList();
  }

  function connect() {
    if (typeof io === "undefined") {
      setStatus("Thiếu Socket.IO", "err");
      return;
    }
    socket = io();
    socket.on("connect", () => setStatus("Đã kết nối", "ok"));
    socket.on("disconnect", () => setStatus("Mất kết nối", "err"));
    socket.on("deck:state", (state) => {
      if (!state || !slides.length) return;
      let i = typeof state.index === "number" ? state.index : -1;
      if (state.slideId) {
        const found = slides.findIndex((s) => s.id === state.slideId);
        if (found >= 0) i = found;
      }
      if (i >= 0 && i !== index) {
        index = Math.max(0, Math.min(slides.length - 1, i));
        renderList();
        syncMediaSession();
      }
    });
  }

  btnPrev.addEventListener("click", () => goto(index - 1));
  btnNext.addEventListener("click", () => goto(index + 1));
  btnHw.addEventListener("click", () => {
    enableHardwareRemote().catch(() => {});
  });

  document.addEventListener("keydown", (e) => {
    if (["ArrowRight", "ArrowDown", " ", "PageDown"].includes(e.key)) {
      e.preventDefault();
      goto(index + 1);
    } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) {
      e.preventDefault();
      goto(index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      goto(0);
    } else if (e.key === "End") {
      e.preventDefault();
      goto(slides.length - 1);
    }
  });

  loadSlides()
    .then(connect)
    .catch((err) => setStatus(err.message || "Lỗi", "err"));
})();
