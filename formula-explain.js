/**
 * Click general formulas → modal with symbol guide + worked example.
 */
(function () {
  const EXPLAINS = {
    entropy: {
      eyebrow: "Công thức tổng quát",
      title: "Entropy H(S)",
      blurb: "Đo độ lẫn nhãn trong tập S. H càng lớn → nhóm càng lẫn; H = 0 → thuần một lớp.",
      formulaTex: "H(S) = -\\left(\\sum_{i} p_i \\cdot \\log_2(p_i)\\right)",
      symbols: [
        ["H(S)", "Entropy của tập S (đơn vị bit)"],
        ["S", "Tập / nhóm đang xét"],
        ["i", "Từng lớp nhãn (vd. Có, Không)"],
        ["pᵢ", "Tỷ lệ lớp i = (số mẫu lớp i) / |S|"],
        ["log₂", "Logarit cơ số 2"],
        ["−(…)", "Dấu trừ cả tổng (vì log(p) < 0 khi 0 < p < 1)"],
      ],
      exampleTitle: "Ví dụ nhỏ: 5 mẫu picnic",
      exampleLead:
        "Giả sử tập S có 5 mẫu: 3 «Có» đi picnic và 2 «Không». Gán số vào công thức tổng quát:",
      exampleTableHtml: `
        <table class="fx-table">
          <thead>
            <tr><th>Lớp i</th><th>Số mẫu</th><th>pᵢ</th></tr>
          </thead>
          <tbody>
            <tr><td>Có (Yes)</td><td>3</td><td>3/5 = 0.6</td></tr>
            <tr><td>Không (No)</td><td>2</td><td>2/5 = 0.4</td></tr>
            <tr class="total"><td>Tổng |S|</td><td>5</td><td>1</td></tr>
          </tbody>
        </table>`,
      steps: [
        {
          label: "Công thức tổng quát",
          tex: "H(S) = -\\big(p_{\\mathrm{Có}}\\log_2 p_{\\mathrm{Có}} + p_{\\mathrm{Không}}\\log_2 p_{\\mathrm{Không}}\\big)",
        },
        {
          label: "Gán giá trị vào công thức",
          tex: "H(S) = -\\big(\\underbrace{0.6}_{p_{\\mathrm{Có}}}\\log_2 0.6 + \\underbrace{0.4}_{p_{\\mathrm{Không}}}\\log_2 0.4\\big)",
        },
        {
          label: "Tính ra kết quả",
          tex: "H(S) \\approx -\\big(0.6\\cdot(-0.737) + 0.4\\cdot(-1.322)\\big) \\approx 0.971",
        },
      ],
      note: "H ≈ 0.97 khá cao → tập còn lẫn. Nếu toàn «Có» thì H = 0.",
    },

    gain: {
      eyebrow: "Công thức tổng quát",
      title: "Information Gain",
      blurb:
        "Đo mức giảm Entropy khi chia S theo đặc trưng A. Gain càng lớn → câu hỏi A càng tốt.",
      formulaTex:
        "\\mathrm{Gain}(S,A) = H(S) - \\sum_{v}\\frac{|S_v|}{|S|}\\cdot H(S_v)",
      symbols: [
        ["A", "Đặc trưng dùng để hỏi / chia (vd. Thời tiết)"],
        ["v", "Một giá trị của A (vd. Nắng, Mưa)"],
        ["Sᵥ", "Tập con gồm các mẫu có A = v"],
        ["|Sᵥ| / |S|", "Trọng số nhánh (nhóm to nặng hơn)"],
        ["H(S)", "Entropy trước khi chia"],
        ["H(Sᵥ)", "Entropy của từng nhánh con"],
      ],
      exampleTitle: "Ví dụ: chia theo Thời tiết",
      exampleLead:
        "Cùng tập S với 5 mẫu. Chia theo A = Thời tiết thành Nắng / Mưa — bê số từ bảng gắn đúng chỗ trên công thức lớn:",
      exampleTableHtml: `
        <table class="fx-table fx-table-wide">
          <thead>
            <tr>
              <th>Giá trị v</th>
              <th>Mẫu trong Sᵥ</th>
              <th>|Sᵥ|</th>
              <th>|Sᵥ|/|S|</th>
              <th>Nhãn trong Sᵥ</th>
              <th>H(Sᵥ)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Nắng</td>
              <td>D1, D2</td>
              <td>2</td>
              <td>2/5 = 0.4</td>
              <td>0 Có · 2 Không</td>
              <td>0 (thuần)</td>
            </tr>
            <tr>
              <td>Mưa</td>
              <td>D3, D4, D5</td>
              <td>3</td>
              <td>3/5 = 0.6</td>
              <td>3 Có · 0 Không</td>
              <td>0 (thuần)</td>
            </tr>
            <tr class="total">
              <td colspan="2">Tổng |S|</td>
              <td>5</td>
              <td>1</td>
              <td>3 Có · 2 Không</td>
              <td>H(S) ≈ 0.971</td>
            </tr>
          </tbody>
        </table>`,
      steps: [
        {
          label: "Công thức tổng quát",
          tex: "\\mathrm{Gain}(S,\\text{Thời tiết}) = H(S) - \\Big(\\dfrac{|S_{\\mathrm{Nắng}}|}{|S|}H(S_{\\mathrm{Nắng}}) + \\dfrac{|S_{\\mathrm{Mưa}}|}{|S|}H(S_{\\mathrm{Mưa}})\\Big)",
        },
        {
          label: "Gán giá trị vào công thức",
          tex: "\\mathrm{Gain}(S,\\text{Thời tiết}) = 0.971 - \\Big(\\dfrac{2}{5}\\cdot 0 + \\dfrac{3}{5}\\cdot 0\\Big)",
        },
        {
          label: "Tính ra kết quả",
          tex: "\\mathrm{Gain}(S,\\text{Thời tiết}) = 0.971 - 0 = 0.971",
        },
      ],
      note: "Gain lớn vì sau khi hỏi Thời tiết, mỗi nhánh đều thuần (H = 0).",
    },

    gini: {
      eyebrow: "Công thức tổng quát",
      title: "Gini Impurity",
      blurb: "Đo độ lẫn không dùng log. Gini = 0 → thuần; với 2 lớp, Gini max = 0.5 khi 50/50.",
      formulaTex: "\\mathrm{Gini}(S) = 1 - \\sum_{i=1}^{C} (p_i)^2",
      symbols: [
        ["Gini(S)", "Độ lẫn của tập S"],
        ["C", "Số lớp / nhãn trong S"],
        ["i", "Từng lớp (1 … C)"],
        ["pᵢ", "Tỷ lệ lớp i"],
        ["(pᵢ)²", "Bình phương tỷ lệ"],
      ],
      exampleTitle: "Ví dụ nhỏ: 5 mẫu",
      exampleLead: "S có 3 «Có» và 2 «Không» (C = 2). Gắn số vào đúng chỗ trên công thức lớn:",
      exampleTableHtml: `
        <table class="fx-table">
          <thead>
            <tr><th>Lớp i</th><th>Số mẫu</th><th>pᵢ</th></tr>
          </thead>
          <tbody>
            <tr><td>Có</td><td>3</td><td>3/5 = 0.6</td></tr>
            <tr><td>Không</td><td>2</td><td>2/5 = 0.4</td></tr>
            <tr class="total"><td>Tổng</td><td>5</td><td>1</td></tr>
          </tbody>
        </table>`,
      steps: [
        {
          label: "Công thức tổng quát",
          tex: "\\mathrm{Gini}(S) = 1 - \\big((p_{\\mathrm{Có}})^2 + (p_{\\mathrm{Không}})^2\\big)",
        },
        {
          label: "Gán giá trị vào công thức",
          tex: "\\mathrm{Gini}(S) = 1 - \\big((0.6)^2 + (0.4)^2\\big)",
        },
        {
          label: "Tính ra kết quả",
          tex: "\\mathrm{Gini}(S) = 1 - (0.36 + 0.16) = 0.48",
        },
      ],
      note: "Gini = 0.48 gần mức lẫn cao (0.5). Nếu toàn một lớp → Gini = 0.",
    },

    "delta-gini": {
      eyebrow: "Công thức tổng quát",
      title: "ΔGini (Gini Gain)",
      blurb:
        "Mức giảm độ lẫn sau khi chia. ΔGini càng lớn → câu hỏi / cách chia càng tốt.",
      formulaTex: [
        "\\Delta\\mathrm{Gini} = \\mathrm{Gini}(S) - \\mathrm{Gini}_{\\mathrm{split}}",
        "\\mathrm{Gini}_{\\mathrm{split}} = \\sum_{k}\\left(\\dfrac{N_k}{N}\\times\\mathrm{Gini}_k\\right)",
      ],
      formulaTags: ["① ΔGini", "② Gini_split"],
      symbols: [
        ["Gini(S)", "Độ lẫn nút cha trước khi chia"],
        ["Gini_split", "Trung bình có trọng số Gini các nhánh con"],
        ["N", "Số mẫu nút cha (= |S|)"],
        ["Nₖ", "Số mẫu nhánh con k"],
        ["Giniₖ", "Gini của nhánh con k"],
        ["ΔGini", "Gini(S) − Gini_split"],
      ],
      exampleTitle: "Ví dụ: chia theo Thời tiết",
      exampleLead:
        "Cùng S (3 Có / 2 Không), Gini(S) = 0.48. Gắn số từ bảng vào từng phần công thức:",
      exampleTableHtml: `
        <table class="fx-table fx-table-wide">
          <thead>
            <tr>
              <th>Nhánh k</th>
              <th>Nₖ</th>
              <th>Nₖ/N</th>
              <th>Nhãn</th>
              <th>Giniₖ</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Nắng</td>
              <td>2</td>
              <td>0.4</td>
              <td>0 Có · 2 Không</td>
              <td>0</td>
            </tr>
            <tr>
              <td>Mưa</td>
              <td>3</td>
              <td>0.6</td>
              <td>3 Có · 0 Không</td>
              <td>0</td>
            </tr>
            <tr class="total">
              <td>Cha S</td>
              <td>N = 5</td>
              <td>1</td>
              <td>3 Có · 2 Không</td>
              <td>Gini(S) = 0.48</td>
            </tr>
          </tbody>
        </table>`,
      steps: [
        {
          label: "Công thức — phần ① ΔGini",
          tex: "\\Delta\\mathrm{Gini} = \\mathrm{Gini}(S) - \\mathrm{Gini}_{\\mathrm{split}}",
        },
        {
          label: "Công thức — phần ② Gini_split",
          tex: "\\mathrm{Gini}_{\\mathrm{split}} = \\dfrac{N_{\\mathrm{Nắng}}}{N}\\mathrm{Gini}_{\\mathrm{Nắng}} + \\dfrac{N_{\\mathrm{Mưa}}}{N}\\mathrm{Gini}_{\\mathrm{Mưa}}",
        },
        {
          label: "Gán giá trị vào ② Gini_split",
          tex: "\\mathrm{Gini}_{\\mathrm{split}} = \\dfrac{2}{5}\\cdot 0 + \\dfrac{3}{5}\\cdot 0",
        },
        {
          label: "Gán giá trị vào ① ΔGini",
          tex: "\\Delta\\mathrm{Gini} = 0.48 - \\mathrm{Gini}_{\\mathrm{split}}",
        },
        {
          label: "Tính ra kết quả",
          tex: "\\mathrm{Gini}_{\\mathrm{split}} = 0 \\quad\\Rightarrow\\quad \\Delta\\mathrm{Gini} = 0.48 - 0 = 0.48",
        },
      ],
      note: "ΔGini lớn vì sau chia mỗi nhánh đều thuần (Giniₖ = 0).",
    },
  };

  const modal = document.getElementById("formula-modal");
  if (!modal) return;

  const titleEl = document.getElementById("fx-title");
  const eyebrowEl = document.getElementById("fx-eyebrow");
  const blurbEl = document.getElementById("fx-blurb");
  const formulaEl = document.getElementById("fx-formula");
  const formulaWrap = document.getElementById("fx-formula-wrap") || formulaEl?.parentElement;
  const symbolsEl = document.getElementById("fx-symbols");
  const exampleTitleEl = document.getElementById("fx-example-title");
  const exampleLeadEl = document.getElementById("fx-example-lead");
  const exampleTableEl = document.getElementById("fx-example-table");
  const stepsEl = document.getElementById("fx-steps");
  const noteEl = document.getElementById("fx-note");

  function renderTex(el, tex, display = true) {
    if (!el) return;
    el.setAttribute("data-tex", tex);
    if (typeof katex !== "undefined") {
      try {
        katex.render(tex, el, {
          throwOnError: false,
          displayMode: display,
          output: "html",
        });
      } catch (_) {
        el.textContent = tex;
      }
    } else {
      el.textContent = tex;
    }
  }

  function renderFormulas(data) {
    const host = formulaWrap || formulaEl;
    if (!host) return;
    const list = Array.isArray(data.formulaTex)
      ? data.formulaTex
      : [data.formulaTex].filter(Boolean);
    const tags = Array.isArray(data.formulaTags) ? data.formulaTags : [];

    host.innerHTML = list
      .map(
        (_, i) => `
        <div class="fx-formula-item">
          ${tags[i] ? `<p class="fx-formula-tag">${tags[i]}</p>` : ""}
          <div class="formula formula-sm fx-formula-line"></div>
        </div>`
      )
      .join("");

    host.querySelectorAll(".fx-formula-line").forEach((el, i) => {
      renderTex(el, list[i], true);
    });
  }

  function openExplain(id) {
    const data = EXPLAINS[id];
    if (!data) return;

    if (eyebrowEl) eyebrowEl.textContent = data.eyebrow;
    if (titleEl) titleEl.textContent = data.title;
    if (blurbEl) blurbEl.textContent = data.blurb;
    renderFormulas(data);

    if (symbolsEl) {
      symbolsEl.innerHTML = data.symbols
        .map(
          ([k, v]) =>
            `<li><strong>${k}</strong> — ${v}</li>`
        )
        .join("");
    }

    if (exampleTitleEl) exampleTitleEl.textContent = data.exampleTitle;
    if (exampleLeadEl) exampleLeadEl.textContent = data.exampleLead;
    if (exampleTableEl) exampleTableEl.innerHTML = data.exampleTableHtml;

    if (stepsEl) {
      stepsEl.innerHTML = data.steps
        .map(
          (s, i) => `
          <div class="fx-step">
            <p class="fx-step-label">${i + 1}. ${s.label}</p>
            <div class="formula formula-sm fx-step-formula"></div>
          </div>`
        )
        .join("");
      stepsEl.querySelectorAll(".fx-step-formula").forEach((el, i) => {
        renderTex(el, data.steps[i].tex, true);
      });
    }

    if (noteEl) {
      noteEl.textContent = data.note || "";
      noteEl.hidden = !data.note;
    }

    modal.hidden = false;
    document.body.classList.add("modal-open");
  }

  function closeExplain() {
    modal.hidden = true;
    const appOpen =
      document.getElementById("app-modal") && !document.getElementById("app-modal").hidden;
    const exOpen =
      document.getElementById("ex-modal") && !document.getElementById("ex-modal").hidden;
    if (!appOpen && !exOpen) document.body.classList.remove("modal-open");
  }

  modal.querySelectorAll("[data-close-fx]").forEach((el) => {
    el.addEventListener("click", closeExplain);
  });

  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key !== "Escape" || !modal || modal.hidden) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      closeExplain();
    },
    true
  );

  function markClickable(el, id) {
    if (!el || !EXPLAINS[id] || el.dataset.fxWired) return;
    el.dataset.fxWired = "1";
    el.classList.add("formula-clickable");
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("data-formula-explain", id);
    el.setAttribute("title", "Bấm để xem giải thích + ví dụ gán số");
    const open = (e) => {
      e.preventDefault();
      e.stopPropagation();
      openExplain(id);
    };
    el.addEventListener("click", open);
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") open(e);
    });
  }

  function wire() {
    document.querySelectorAll("[data-formula-explain]").forEach((el) => {
      markClickable(el, el.getAttribute("data-formula-explain"));
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }

  window.openFormulaExplain = openExplain;
})();
