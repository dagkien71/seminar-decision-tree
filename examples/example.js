(() => {
  const params = new URLSearchParams(location.search);
  const appId = params.get("app") || "medical";
  const apps = window.APP_EXAMPLES || {};
  const app = apps[appId] || apps.medical;

  const positiveByApp = {
    medical: ["Không"], // không cần khám thêm = ổn
    fraud: ["Không"], // không gian lận = hợp lệ
    credit: ["Có"],
    shopping: ["Có"],
    quality: ["Có"],
    spam: ["Không"], // không spam = thư hợp lệ
  };

  document.title = `${app.icon} ${app.title} — Decision Tree`;
  document.getElementById("ex-eyebrow").textContent = "Ví dụ ứng dụng";
  document.getElementById("ex-title").textContent = `${app.icon} ${app.title}`;
  document.getElementById("ex-blurb").textContent = app.blurb;

  const nav = document.getElementById("ex-nav");
  nav.innerHTML = Object.values(apps)
    .map(
      (a) =>
        `<a href="example.html?app=${a.id}" class="${a.id === app.id ? "active" : ""}">${a.icon} ${a.title}</a>`
    )
    .join("");

  const thead = document.getElementById("ex-thead");
  const tbody = document.getElementById("ex-tbody");
  thead.innerHTML = `<tr>${app.columns.map((c) => `<th>${SimpleTree.escapeHtml(c.label)}</th>`).join("")}</tr>`;
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
  document.getElementById("ex-tree").innerHTML = SimpleTree.renderSvg(tree, {
    positiveLabels: positiveByApp[app.id] || ["Có"],
    gap: 120,
  });

  const rootQ = tree.type === "node" ? tree.label : "(lá thuần)";
  document.getElementById("ex-note").textContent =
    `Cây được xây bằng Information Gain từ ${app.rows.length} mẫu. Câu hỏi gốc: ${rootQ}`;
})();
