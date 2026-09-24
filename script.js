(() => {
  const slides = [...document.querySelectorAll(".slide")];
  const bar = document.getElementById("bar");
  const counter = document.getElementById("counter");
  const prevBtn = document.getElementById("prev");
  const nextBtn = document.getElementById("next");
  let index = 0;

  function go(i) {
    index = Math.max(0, Math.min(slides.length - 1, i));
    slides.forEach((s, n) => s.classList.toggle("active", n === index));
    const pct = ((index + 1) / slides.length) * 100;
    bar.style.width = `${pct}%`;
    counter.textContent = `${index + 1} / ${slides.length}`;
    document.title = `Decision Tree — ${slides[index].dataset.title || "Seminar"}`;
    const hash = `#${index + 1}`;
    if (location.hash !== hash) history.replaceState(null, "", hash);
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

  const hash = parseInt(location.hash.slice(1), 10);
  go(Number.isFinite(hash) && hash >= 1 ? hash - 1 : 0);

  window.addEventListener("hashchange", () => {
    const h = parseInt(location.hash.slice(1), 10);
    if (Number.isFinite(h) && h >= 1) go(h - 1);
  });

  renderShareQr();
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

async function renderShareQr() {
  const canvas = document.getElementById("share-qr");
  const label = document.getElementById("share-url");
  if (!canvas) return;

  const lan = await detectLanIp();
  const url = pageBaseUrl(lan || location.hostname);
  if (label) label.textContent = url;

  if (typeof QRCode === "undefined" || !QRCode.toCanvas) {
    console.error("QRCode library missing");
    return;
  }

  QRCode.toCanvas(
    canvas,
    url,
    {
      width: 280,
      margin: 1,
      color: { dark: "#0c2e28", light: "#ffffff" },
    },
    (err) => {
      if (err) console.error(err);
    }
  );
}
