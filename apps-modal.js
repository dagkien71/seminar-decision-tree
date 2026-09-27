(() => {
  const modal = document.getElementById("app-modal");
  if (!modal || !window.APP_EXAMPLES || !window.SimpleTree) return;

  /**
   * Nhãn mang hàm ý TỐT → xanh. Nhãn xấu / cảnh báo → đỏ.
   * (Không phải lúc nào “Có” cũng là tốt.)
   */
  const goodLabelsByApp = {
    medical: ["Không"], // không cần khám thêm = ổn
    fraud: ["Không"], // không gian lận = hợp lệ
    credit: ["Có"], // duyệt = tốt
    shopping: ["Có"], // mua = tốt
    quality: ["Có"], // đạt QC = tốt
    spam: ["Không"], // không spam = thư hợp lệ
  };

  /** Kịch bản ngắn — làm phần chơi đỡ khô */
  const SCENES = {
    medical: {
      role: "Bạn là bác sĩ trực",
      setup: "Bệnh nhân vừa vào phòng khám. Hỏi lần lượt để quyết định có cần khám thêm không.",
      asking: "Dựa trên triệu chứng, hỏi tiếp:",
      forCo: "Nên khám thêm — triệu chứng đáng lưu ý.",
      forKhong: "Chưa cần khám thêm — theo dõi tại nhà là được.",
    },
    fraud: {
      role: "Bạn là hệ thống chống gian lận",
      setup: "Có một giao dịch vừa tới. Kiểm tra từng dấu hiệu để xem có nghi ngờ không.",
      asking: "Dấu hiệu tiếp theo:",
      forCo: "Cảnh báo: giao dịch có dấu hiệu gian lận.",
      forKhong: "Ổn — giao dịch trông hợp lệ.",
    },
    credit: {
      role: "Bạn là nhân viên tín dụng",
      setup: "Khách đang xin vay. Hỏi vài tiêu chí rồi quyết định duyệt hay từ chối.",
      asking: "Tiêu chí tiếp theo:",
      forCo: "Duyệt khoản vay — hồ sơ đạt.",
      forKhong: "Từ chối — rủi ro còn cao.",
    },
    shopping: {
      role: "Bạn là hệ thống gợi ý",
      setup: "Khách đang xem sản phẩm. Đoán xem họ có khả năng mua không.",
      asking: "Hành vi tiếp theo của khách:",
      forCo: "Nên gợi ý mua — khả năng chốt đơn cao.",
      forKhong: "Chưa gợi ý — khách còn do dự.",
    },
    quality: {
      role: "Bạn là kiểm soát chất lượng",
      setup: "Một sản phẩm trên dây chuyền. Kiểm tra từng tiêu chí đạt / không đạt.",
      asking: "Kiểm tra tiếp:",
      forCo: "Đạt — cho xuất xưởng.",
      forKhong: "Không đạt — giữ lại để xử lý.",
    },
    spam: {
      role: "Bạn là bộ lọc hộp thư",
      setup: "Có email mới. Soi vài dấu hiệu rồi xếp spam hay thư thường.",
      asking: "Dấu hiệu tiếp theo:",
      forCo: "Spam — chuyển vào thư rác.",
      forKhong: "Thư hợp lệ — để trong hộp thư đến.",
    },
  };

  let playState = null;

  function esc(s) {
    return SimpleTree.escapeHtml(s);
  }

  function goodLabels(appId) {
    return goodLabelsByApp[appId] || ["Có"];
  }

  function isGoodResult(appId, result) {
    return goodLabels(appId).includes(result);
  }

  function sceneOf(app) {
    return (
      SCENES[app.id] || {
        role: "Bạn đang dùng Decision Tree",
        setup: "Trả lời từng câu hỏi để đi tới kết luận.",
        asking: "Câu hỏi tiếp theo:",
        forCo: "Kết luận: Có.",
        forKhong: "Kết luận: Không.",
      }
    );
  }

  function outcomeStory(app, result) {
    const scene = sceneOf(app);
    return result === "Có" ? scene.forCo : scene.forKhong;
  }

  function depthLeft(node) {
    if (!node || node.type === "leaf") return 0;
    const kids = Object.values(node.children || {});
    if (!kids.length) return 1;
    return 1 + Math.max(...kids.map(depthLeft));
  }

  function choiceCaption(questionLabel, value) {
    const stem = String(questionLabel || "")
      .replace(/\?$/u, "")
      .trim();
    if (value === "Có") return `Có · ${stem}`;
    if (value === "Không") return `Không · ${stem}`;
    return `${stem}: ${value}`;
  }

  function resultCaption(app, result) {
    const hints = {
      medical: { Có: "Cần khám thêm", Không: "Không cần khám thêm" },
      fraud: { Có: "Nghi gian lận", Không: "Giao dịch hợp lệ" },
      credit: { Có: "Được duyệt", Không: "Từ chối vay" },
      shopping: { Có: "Khả năng mua cao", Không: "Ít khả năng mua" },
      quality: { Có: "Đạt chất lượng", Không: "Không đạt" },
      spam: { Có: "Spam", Không: "Thư hợp lệ" },
    };
    return hints[app.id]?.[result] || `${result} · ${(app.labelName || "Kết luận").replace(/\?$/u, "")}`;
  }

  function crumbCaption(questionLabel, value) {
    return choiceCaption(questionLabel, value);
  }

  function refreshTreeHighlight() {
    if (!playState) return;
    const treeEl = document.getElementById("modal-tree");
    if (!treeEl) return;
    const playing = playState.playing;
    treeEl.innerHTML = SimpleTree.renderSvg(playState.tree, {
      positiveLabels: goodLabels(playState.app.id),
      gap: 128,
      activePath: playing ? playState.edgePath || [] : null,
      atLeaf: playing ? playState.done : false,
    });
  }

  function renderPlay() {
    const el = document.getElementById("modal-play");
    if (!el || !playState) return;
    const { app, node, path, done, result, step, maxSteps, playing } = playState;
    const scene = sceneOf(app);

    refreshTreeHighlight();

    if (!playing) {
      el.innerHTML = `
        <div class="app-play-card app-play-idle">
          <span class="app-play-badge">${esc(app.icon)} ${esc(scene.role)}</span>
          <p class="app-play-story">${esc(scene.setup)}</p>
          <p class="app-play-idle-tip">Xem bảng + cây bên trái trước, rồi bấm Play để nhập vai đi theo từng nút.</p>
          <button type="button" class="app-play-start" data-play-start>
            ▶ Play
          </button>
        </div>
      `;
      return;
    }

    const pos = isGoodResult(app.id, result);
    const progress = Math.min(100, Math.round((step / Math.max(maxSteps, 1)) * 100));

    if (done) {
      el.innerHTML = `
        <div class="app-play-card is-done ${pos ? "tone-yes" : "tone-no"}">
          <div class="app-play-top">
            <span class="app-play-badge">${esc(app.icon)} ${esc(scene.role)}</span>
            <span class="app-play-steps">Xong · ${step} bước</span>
          </div>
          <div class="app-play-meter"><span style="width:${progress}%"></span></div>
          ${
            path.length
              ? `<div class="app-play-crumbs">${path
                  .map((p) => `<span class="app-play-crumb">${esc(p)}</span>`)
                  .join("")}</div>`
              : ""
          }
          <p class="app-play-story">${esc(outcomeStory(app, result))}</p>
          <div class="app-play-result ${pos ? "yes" : "no"}">
            <p class="app-play-result-label">Kết luận của cây</p>
            <p class="app-play-result-value">${esc(resultCaption(app, result))}</p>
          </div>
          <div class="app-play-actions">
            <button type="button" class="app-play-again" data-play-start>Chơi lại</button>
            <button type="button" class="app-play-stop" data-play-stop>Xem lại cây</button>
          </div>
        </div>
      `;
      return;
    }

    const options = Object.keys(node.children || {});
    el.innerHTML = `
      <div class="app-play-card">
        <div class="app-play-top">
          <span class="app-play-badge">${esc(app.icon)} ${esc(scene.role)}</span>
          <span class="app-play-steps">Bước ${step + 1}</span>
        </div>
        <div class="app-play-meter"><span style="width:${progress}%"></span></div>
        <p class="app-play-story">${esc(path.length ? scene.asking : scene.setup)}</p>
        ${
          path.length
            ? `<div class="app-play-crumbs">${path
                .map((p) => `<span class="app-play-crumb">${esc(p)}</span>`)
                .join("")}</div>`
            : ""
        }
        <p class="app-play-q">${esc(node.label)}</p>
        <div class="app-play-choices">
          ${options
            .map((v) => {
              const label = choiceCaption(node.label, v);
              return `<button type="button" class="app-play-choice" data-play-value="${esc(v)}">
                <span class="app-play-choice-main">${esc(v)}</span>
                <span class="app-play-choice-sub">${esc(label)}</span>
              </button>`;
            })
            .join("")}
        </div>
        <button type="button" class="app-play-stop subtle" data-play-stop>Dừng · xem lại cây</button>
      </div>
    `;
  }

  function resetPlayToIdle() {
    if (!playState) return;
    playState.playing = false;
    playState.node = playState.tree;
    playState.path = [];
    playState.edgePath = [];
    playState.done = false;
    playState.result = null;
    playState.step = 0;
    renderPlay();
  }

  function beginPlay() {
    if (!playState) return;
    playState.playing = true;
    playState.node = playState.tree;
    playState.path = [];
    playState.edgePath = [];
    playState.done = playState.tree.type === "leaf";
    playState.result = playState.done ? playState.tree.label : null;
    playState.step = 0;
    playState.maxSteps = Math.max(1, depthLeft(playState.tree));
    renderPlay();
  }

  function preparePlay(app, tree) {
    playState = {
      app,
      tree,
      node: tree,
      path: [],
      edgePath: [],
      playing: false,
      done: false,
      result: null,
      step: 0,
      maxSteps: Math.max(1, depthLeft(tree)),
    };
    renderPlay();
  }

  function answerPlay(value) {
    if (!playState || !playState.playing || playState.done) return;
    const next = playState.node.children?.[value];
    if (!next) return;
    const shortQ = playState.node.label;
    playState.path.push(crumbCaption(shortQ, value));
    playState.edgePath.push(value);
    playState.step += 1;
    playState.node = next;
    if (next.type === "leaf") {
      playState.done = true;
      playState.result = next.label;
    }
    renderPlay();
  }

  document.getElementById("modal-play")?.addEventListener("click", (e) => {
    if (e.target.closest("[data-play-start]")) {
      beginPlay();
      return;
    }
    if (e.target.closest("[data-play-stop]")) {
      resetPlayToIdle();
      return;
    }
    const choice = e.target.closest("[data-play-value]");
    if (choice) answerPlay(choice.dataset.playValue);
  });

  function openModal(appId) {
    const app = APP_EXAMPLES[appId];
    if (!app) return;

    document.getElementById("modal-title").textContent = `${app.icon} ${app.title}`;
    document.getElementById("modal-blurb").textContent = app.blurb;

    const thead = document.getElementById("modal-thead");
    const tbody = document.getElementById("modal-tbody");
    thead.innerHTML = `<tr>${app.columns
      .map((c) => `<th>${esc(c.label)}</th>`)
      .join("")}</tr>`;
    tbody.innerHTML = app.rows
      .map((row) => {
        const cells = app.columns
          .map((c) => {
            const val = row[c.key];
            let cls = "";
            if (c.key === app.labelKey) {
              const ok = isGoodResult(app.id, val);
              cls = ok ? "yes" : "no";
            }
            return `<td class="${cls}">${esc(val)}</td>`;
          })
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");

    const tree = SimpleTree.buildTree(app.rows, app.features, app.labelKey);
    const rootQ = tree.type === "node" ? tree.label : "(lá thuần)";
    document.getElementById("modal-note").textContent =
      `Cây học từ ${app.rows.length} mẫu · câu hỏi gốc: ${rootQ}`;

    preparePlay(app, tree);

    modal.hidden = false;
    document.body.classList.add("modal-open");
    modal.querySelector(".app-modal-close")?.focus();
  }

  function closeModal() {
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    playState = null;
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
      e.stopImmediatePropagation();
      closeModal();
    }
  });

  window.isAppModalOpen = () => !modal.hidden;
})();
