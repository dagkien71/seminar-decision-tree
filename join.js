(() => {
  const form = document.getElementById("join-form");
  const status = document.getElementById("status");
  const btn = document.getElementById("submit-btn");
  const tbody = document.getElementById("mini-tbody");
  const rowCount = document.getElementById("row-count");
  const socket = io();

  let lastIds = new Set();

  function setStatus(msg, type) {
    status.textContent = msg;
    status.className = `status ${type || ""}`;
  }

  function renderTable(rows) {
    rowCount.textContent = String(rows.length);
    const newest = rows.slice().reverse().slice(0, 20);
    tbody.innerHTML = newest
      .map((r) => {
        const cls = r.attend === "Có" ? "yes" : "no";
        const flash = !lastIds.has(r.id) && lastIds.size ? "flash" : "";
        return `<tr class="${flash}" data-id="${r.id}">
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

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  socket.on("state", (state) => {
    renderTable(state.rows || []);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const payload = {
      name: data.get("name"),
      free: data.get("free"),
      interest: data.get("interest"),
      mode: data.get("mode"),
      attend: data.get("attend"),
    };

    btn.disabled = true;
    setStatus("Đang gửi…");

    socket.emit("submit", payload, (res) => {
      btn.disabled = false;
      if (res?.ok) {
        setStatus("Đã thêm! Cây trên màn hình vừa cập nhật.", "ok");
        form.querySelectorAll('input[type="radio"]').forEach((el) => {
          el.checked = false;
        });
      } else {
        setStatus(res?.error || "Gửi thất bại", "err");
      }
    });
  });
})();
