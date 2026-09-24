(() => {
  const modal = document.getElementById("app-modal");
  if (!modal || !window.APP_EXAMPLES || !window.SimpleTree) return;

  const positiveByApp = {
    medical: ["Có"],
    fraud: ["Không"],
    credit: ["Có"],
    shopping: ["Có"],
    quality: ["Có"],
    spam: ["Không"],
  };

  function openModal(appId) {
    const app = APP_EXAMPLES[appId];
    if (!app) return;

    document.getElementById("modal-title").textContent = `${app.icon} ${app.title}`;
    document.getElementById("modal-blurb").textContent = app.blurb;

    const thead = document.getElementById("modal-thead");
    const tbody = document.getElementById("modal-tbody");
    thead.innerHTML = `<tr>${app.columns
      .map((c) => `<th>${SimpleTree.escapeHtml(c.label)}</th>`)
      .join("")}</tr>`;
    tbody.innerHTML = app.rows
      .map((row) => {
        const cells = app.columns
          .map((c) => {
            const val = row[c.key];
            let cls = "";
            if (c.key === app.labelKey) {
              const pos = (positiveByApp[app.id] || ["Có"]).includes(val);
              cls = pos ? "yes" : "no";
            }
            return `<td class="${cls}">${SimpleTree.escapeHtml(val)}</td>`;
          })
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");

    const tree = SimpleTree.buildTree(app.rows, app.features, app.labelKey);
    document.getElementById("modal-tree").innerHTML = SimpleTree.renderSvg(tree, {
      positiveLabels: positiveByApp[app.id] || ["Có"],
      gap: 110,
    });
    const rootQ = tree.type === "node" ? tree.label : "(lá thuần)";
    document.getElementById("modal-note").textContent =
      `Information Gain · ${app.rows.length} mẫu · gốc: ${rootQ}`;

    modal.hidden = false;
    document.body.classList.add("modal-open");
    modal.querySelector(".app-modal-close")?.focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
  }

  document.querySelectorAll(".app[data-app]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openModal(btn.dataset.app);
    });
  });

  modal.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) {
      e.preventDefault();
      closeModal();
    }
  });

  window.isAppModalOpen = () => !modal.hidden;
})();
