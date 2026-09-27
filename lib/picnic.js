/**
 * Picnic dataset — editable table drives Entropy/Gain/Gini + result tree.
 */
(function () {
  const FEATURES = [
    { key: "weather", label: "Thời tiết", values: ["Nắng", "Mây", "Mưa"] },
    { key: "humidity", label: "Độ ẩm", values: ["Cao", "Thấp"] },
    { key: "wind", label: "Gió", values: ["Yếu", "Mạnh"] },
  ];
  const LABEL = "picnic";
  const YES = "Có";
  const NO = "Không";

  const DEFAULT_ROWS = [
    { weather: "Nắng", humidity: "Cao", wind: "Yếu", picnic: NO },
    { weather: "Nắng", humidity: "Cao", wind: "Mạnh", picnic: NO },
    { weather: "Mưa", humidity: "Cao", wind: "Yếu", picnic: NO },
    { weather: "Mây", humidity: "Cao", wind: "Yếu", picnic: YES },
    { weather: "Mây", humidity: "Thấp", wind: "Mạnh", picnic: YES },
    { weather: "Nắng", humidity: "Thấp", wind: "Yếu", picnic: YES },
    { weather: "Mưa", humidity: "Thấp", wind: "Mạnh", picnic: NO },
    { weather: "Mưa", humidity: "Thấp", wind: "Yếu", picnic: YES },
  ];

  let rows = DEFAULT_ROWS.map((r) => ({ ...r }));
  let editMode = false;

  const VALUE_ORDER = {
    weather: ["Nắng", "Mây", "Mưa"],
    humidity: ["Cao", "Thấp"],
    wind: ["Yếu", "Mạnh"],
  };

  function sortValues(featureKey, values) {
    const order = VALUE_ORDER[featureKey] || [];
    return [...values].sort((a, b) => {
      const ia = order.indexOf(a);
      const ib = order.indexOf(b);
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return String(a).localeCompare(String(b), "vi");
    });
  }

  function cloneDefault() {
    return DEFAULT_ROWS.map((r) => ({ ...r }));
  }

  function labelCounts(list) {
    let yes = 0;
    let no = 0;
    for (const r of list) {
      if (r[LABEL] === YES) yes += 1;
      else no += 1;
    }
    return { yes, no, n: list.length };
  }

  function entropy(list) {
    const { yes, no, n } = labelCounts(list);
    if (!n) return 0;
    let h = 0;
    for (const c of [yes, no]) {
      if (c <= 0) continue;
      const p = c / n;
      h -= p * Math.log2(p);
    }
    return h;
  }

  function gini(list) {
    const { yes, no, n } = labelCounts(list);
    if (!n) return 0;
    const py = yes / n;
    const pn = no / n;
    return 1 - py * py - pn * pn;
  }

  function groupBy(list, key) {
    const groups = {};
    for (const r of list) {
      const v = r[key];
      if (!groups[v]) groups[v] = [];
      groups[v].push(r);
    }
    return groups;
  }

  function infoGain(list, key) {
    const base = entropy(list);
    const groups = groupBy(list, key);
    let after = 0;
    for (const g of Object.values(groups)) {
      after += (g.length / list.length) * entropy(g);
    }
    return { gain: base - after, after, groups, base };
  }

  function deltaGini(list, key) {
    const base = gini(list);
    const groups = groupBy(list, key);
    let after = 0;
    for (const g of Object.values(groups)) {
      after += (g.length / list.length) * gini(g);
    }
    return { delta: base - after, after, groups, base };
  }

  function isPure(list) {
    if (!list.length) return true;
    const first = list[0][LABEL];
    return list.every((r) => r[LABEL] === first);
  }

  function majority(list) {
    const { yes, no } = labelCounts(list);
    return yes >= no ? YES : NO;
  }

  function bestFeature(list, featureKeys) {
    let best = null;
    let bestGain = -1;
    let bestInfo = null;
    for (const key of featureKeys) {
      const info = infoGain(list, key);
      if (info.gain > bestGain + 1e-12) {
        bestGain = info.gain;
        best = key;
        bestInfo = info;
      }
    }
    return { key: best, gain: bestGain, info: bestInfo };
  }

  function bestFeatureGini(list, featureKeys) {
    let best = null;
    let bestDelta = -1;
    let bestInfo = null;
    for (const key of featureKeys) {
      const info = deltaGini(list, key);
      if (info.delta > bestDelta + 1e-12) {
        bestDelta = info.delta;
        best = key;
        bestInfo = info;
      }
    }
    return { key: best, delta: bestDelta, info: bestInfo };
  }

  function buildTree(
    list,
    featureKeys = FEATURES.map((f) => f.key),
    depth = 0,
    maxDepth = 6,
    criterion = "gain"
  ) {
    const counts = labelCounts(list);
    if (!list.length) {
      return { type: "leaf", label: "?", counts: { yes: 0, no: 0, n: 0 } };
    }
    if (isPure(list) || !featureKeys.length || depth >= maxDepth) {
      return { type: "leaf", label: majority(list), counts };
    }
    const pick =
      criterion === "gini"
        ? bestFeatureGini(list, featureKeys)
        : bestFeature(list, featureKeys);
    const key = pick.key;
    const score = criterion === "gini" ? pick.delta : pick.gain;
    const info = pick.info;
    if (!key || score <= 1e-12) {
      return { type: "leaf", label: majority(list), counts };
    }
    const rest = featureKeys.filter((k) => k !== key);
    const children = {};
    for (const val of sortValues(key, Object.keys(info.groups))) {
      children[val] = buildTree(info.groups[val], rest, depth + 1, maxDepth, criterion);
    }
    return {
      type: "node",
      feature: key,
      label: featureLabel(key),
      gain: score,
      counts,
      children,
    };
  }

  function featureLabel(key) {
    return FEATURES.find((f) => f.key === key)?.label || key;
  }

  function featureMeta(key) {
    return FEATURES.find((f) => f.key === key);
  }

  function round3(x) {
    return Math.round(x * 1000) / 1000;
  }

  function fmt(x) {
    const r = round3(x);
    if (Number.isInteger(r)) return String(r);
    return r.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  }

  /** Use = when value matches 3-decimal display exactly; otherwise ≈ */
  function eqJoin(x) {
    return Math.abs(x - round3(x)) < 1e-9 ? `=${fmt(x)}` : `\\approx ${fmt(x)}`;
  }

  function texName(s) {
    // Use \text{} so Vietnamese diacritics render (mathrm breaks accents).
    return String(s).replace(/_/g, "").replace(/[{}]/g, "");
  }

  function texSub(name) {
    return `{\\text{${texName(name)}}}`;
  }

  /** H = -( (y/n)log(y/n) + (no/n)log(no/n) ) with 0-log convention shown explicitly */
  function texH(name, yes, no) {
    const n = yes + no;
    if (!n) return `H_${texSub(name)}=0`;
    const terms = [];
    terms.push(`\\dfrac{${yes}}{${n}}\\log_2\\dfrac{${yes}}{${n}}`);
    terms.push(`\\dfrac{${no}}{${n}}\\log_2\\dfrac{${no}}{${n}}`);
    const h = entropy(
      Array.from({ length: yes }, () => ({ picnic: YES })).concat(
        Array.from({ length: no }, () => ({ picnic: NO }))
      )
    );
    return `H_${texSub(name)}=-\\left(${terms.join("+")}\\right)${eqJoin(h)}`;
  }

  function countsPhrase(list) {
    const { yes, no, n } = labelCounts(list);
    return `${n} mẫu · ${yes} Có · ${no} Không`;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function selectHtml(name, value, options) {
    return `<select data-col="${esc(name)}">${options
      .map(
        (o) =>
          `<option value="${esc(o)}"${o === value ? " selected" : ""}>${esc(o)}</option>`
      )
      .join("")}</select>`;
  }

  /* ---------- render: dataset table ---------- */
  function renderTable() {
    const table = document.querySelector("[data-picnic='table']");
    const tbody = table?.querySelector("tbody");
    if (!tbody || !table) return;

    const wrap = table.closest(".picnic-table-wrap") || table.closest(".table-wrap");
    wrap?.classList.toggle("is-editing", editMode);
    table.classList.toggle("picnic-editing", editMode);

    const theadRow = table.querySelector("thead tr");
    if (theadRow) {
      const actionTh = theadRow.querySelector("th.picnic-actions-h");
      if (editMode && !actionTh) {
        theadRow.insertAdjacentHTML("beforeend", '<th class="picnic-actions-h"></th>');
      } else if (!editMode && actionTh) {
        actionTh.remove();
      }
    }

    const toolbar = document.querySelector("[data-picnic-toolbar]");
    if (toolbar) toolbar.hidden = !editMode;

    tbody.innerHTML = rows
      .map((r, i) => {
        const labelClass = r.picnic === YES ? "yes" : "no";
        if (editMode) {
          return `<tr data-row="${i}">
            <td class="picnic-idx">${i + 1}</td>
            <td>${selectHtml("weather", r.weather, FEATURES[0].values)}</td>
            <td>${selectHtml("humidity", r.humidity, FEATURES[1].values)}</td>
            <td>${selectHtml("wind", r.wind, FEATURES[2].values)}</td>
            <td class="${labelClass}">${selectHtml("picnic", r.picnic, [YES, NO])}</td>
            <td class="picnic-actions"><button type="button" class="picnic-del" data-del="${i}" title="Xóa dòng">×</button></td>
          </tr>`;
        }
        return `<tr data-row="${i}">
          <td class="picnic-idx">${i + 1}</td>
          <td>${esc(r.weather)}</td>
          <td>${esc(r.humidity)}</td>
          <td>${esc(r.wind)}</td>
          <td class="${labelClass}">${esc(r.picnic)}</td>
        </tr>`;
      })
      .join("");
  }

  function renderDatasetBind() {
    const el = document.querySelector("[data-picnic='dataset-bind']");
    if (!el) return;
    const { yes, no, n } = labelCounts(rows);
    const py = n ? yes / n : 0;
    const pn = n ? no / n : 0;
    const featLines = FEATURES.map((f) => {
      const groups = groupBy(rows, f.key);
      const parts = Object.keys(groups)
        .sort()
        .map((v) => {
          const c = labelCounts(groups[v]);
          return `${v} ${c.n} (${c.yes} Có, ${c.no} Không)`;
        });
      return `<li><strong>${esc(f.label)}</strong> — ${parts.map(esc).join(" · ")}</li>`;
    }).join("");
    el.innerHTML = `
      <div class="formula-bind-card">
        <p class="formula-bind-title">Cả bảng (tập S)</p>
        <ul class="map-bind">
          <li><strong>|S|</strong> = ${n} dòng</li>
          <li><strong>Có</strong> = ${yes} · <strong>Không</strong> = ${no}</li>
          <li><strong>p<sub>Yes</sub></strong> = ${yes}/${n || 1} = ${fmt(py)}</li>
          <li><strong>p<sub>No</sub></strong> = ${no}/${n || 1} = ${fmt(pn)}</li>
        </ul>
      </div>
      <div class="formula-bind-card">
        <p class="formula-bind-title">Đếm theo từng đặc trưng (để so sánh)</p>
        <ul class="map-bind">${featLines}</ul>
      </div>`;
  }

  /* ---------- entropy-h ---------- */
  function renderEntropyH() {
    const el = document.querySelector("[data-picnic='entropy-h']");
    if (!el) return;
    const { yes, no, n } = labelCounts(rows);
    const hBefore = entropy(rows);
    const py = n ? yes / n : 0;
    const pn = n ? no / n : 0;
    const cards = FEATURES.map((f) => {
      const groups = groupBy(rows, f.key);
      const from = Object.keys(groups)
        .sort()
        .map((v) => `${v} ${groups[v].length}`)
        .join(" · ");
      const body = Object.keys(groups)
        .sort()
        .map((v) => {
          const c = labelCounts(groups[v]);
          return `<p><strong>${esc(v)}</strong> (${c.yes} Có, ${c.no} Không):</p>
            <p class="calc-detail"><span data-tex="${texH(v, c.yes, c.no)}"></span></p>`;
        })
        .join("");
      return `<div class="calc-card"><h3>${esc(f.label)}</h3>
        <div class="calc-steps"><p class="calc-from">${esc(from)}</p>${body}</div></div>`;
    }).join("");

    el.innerHTML = `
      <div class="calc-card calc-wide calc-before">
        <h3>H<sub>before</sub> — Entropy của cả bảng</h3>
        <div class="calc-steps">
          <p class="calc-from">Cả bảng: ${countsPhrase(rows)}</p>
          <p><span data-tex="p_{\\mathrm{Yes}} = \\dfrac{${yes}}{${n || 1}} = ${fmt(py)},\\quad p_{\\mathrm{No}} = \\dfrac{${no}}{${n || 1}} = ${fmt(pn)}"></span></p>
          <p><span data-tex="H = -\\left(p_{\\mathrm{Yes}}\\log_2(p_{\\mathrm{Yes}}) + p_{\\mathrm{No}}\\log_2(p_{\\mathrm{No}})\\right)"></span></p>
          <p class="calc-result"><span data-tex="H_{\\mathrm{before}} = ${fmt(hBefore)}"></span></p>
        </div>
      </div>
      <div class="calc-grid calc-grid-3">${cards}</div>`;
  }

  /* ---------- entropy-calc (Gain) ---------- */
  function renderEntropyCalc() {
    const el = document.querySelector("[data-picnic='entropy-calc']");
    if (!el) return;
    const { yes, no, n } = labelCounts(rows);
    const hBefore = entropy(rows);
    const gains = FEATURES.map((f) => {
      const info = infoGain(rows, f.key);
      const groups = info.groups;
      const keys = Object.keys(groups).sort();
      const afterSym = keys
        .map((v) => `\\dfrac{${groups[v].length}}{${n}}H_${texSub(v)}`)
        .join("+");
      const afterNum = keys
        .map((v) => `\\dfrac{${groups[v].length}}{${n}}\\cdot ${fmt(entropy(groups[v]))}`)
        .join("+");
      return { f, info, afterSym, afterNum, keys };
    });
    const best = gains.reduce((a, b) => (b.info.gain > a.info.gain ? b : a));

    const cards = gains
      .map(({ f, info, afterSym, afterNum }) => {
        return `<div class="calc-card"><h3>${esc(f.label)}</h3>
          <div class="calc-steps">
            <p class="calc-from">Dùng H vừa tính</p>
            <p><span data-tex="H_{\\mathrm{after}}=${afterSym}"></span></p>
            <p><span data-tex="=${afterNum}${eqJoin(info.after)}"></span></p>
            <p class="calc-result"><span data-tex="\\mathrm{Gain}(\\text{${f.label}})=${fmt(hBefore)}-${fmt(info.after)}${eqJoin(info.gain)}"></span></p>
          </div></div>`;
      })
      .join("");

    el.innerHTML = `
      <div class="calc-card calc-wide calc-before">
        <h3>H<sub>before</sub> — Entropy cả bảng (nhắc lại)</h3>
        <div class="calc-steps">
          <p class="calc-from">${n} mẫu · ${yes} Có · ${no} Không → p<sub>Yes</sub> = ${fmt(yes / (n || 1))} · p<sub>No</sub> = ${fmt(no / (n || 1))}</p>
          <p><span data-tex="H_{\\mathrm{before}}=${fmt(hBefore)}"></span></p>
        </div>
      </div>
      <div class="calc-grid calc-grid-3">${cards}</div>
      <div class="calc-card calc-wide">
        <h3>Kết luận — chọn gốc</h3>
        <div class="calc-steps">
          <p class="calc-compare">
            Gain(<strong>${esc(best.f.label)}</strong>) lớn nhất (≈ ${fmt(best.info.gain)}) → hỏi <strong>${esc(best.f.label)}</strong> trước.
            Slide sau: tách bảng theo các nhánh của đặc trưng gốc.
          </p>
        </div>
      </div>`;
  }

  /* ---------- filter slide ---------- */
  function renderFilter() {
    const el = document.querySelector("[data-picnic='entropy-filter']");
    if (!el) return;
    const { key, info } = bestFeature(
      rows,
      FEATURES.map((f) => f.key)
    );
    if (!key || !info) {
      el.innerHTML = `<p class="lead">Không đủ dữ liệu để chia.</p>`;
      return;
    }
    const label = featureLabel(key);
    const groups = info.groups;
    const vals = sortValues(key, Object.keys(groups));
    const nodeW = 120;
    const step = 168; // center-to-center — đều, không dồn lá vào trái
    const width = Math.max(520, vals.length * step + 80);
    const cx = width / 2;
    const span = (vals.length - 1) * step;
    const startX = vals.length === 1 ? cx : cx - span / 2;

    const miniNodes = vals.map((v, i) => {
      const pure = isPure(groups[v]);
      const cls = pure && majority(groups[v]) === YES ? "node-yes" : pure ? "node-no" : "node-mid";
      const text = pure ? `Lá · ${majority(groups[v])}` : "còn lẫn…";
      const x = startX + i * step;
      const textCls = pure ? "node-text on-dark" : "node-text";
      return { v, x, cls, text, textCls };
    });

    // Shared trunk down from root, then horizontal rail, then drop to each child
    const railY = 50;
    const rootBottom = 38;
    const childTop = 78;
    // Nhãn nằm giữa đoạn thẳng đứng (đè lên branch)
    const labelY = (railY + childTop) / 2 + 4;
    let paths = `<path d="M${cx} ${rootBottom} V${railY}" />`;
    if (miniNodes.length === 1) {
      paths += `<path d="M${cx} ${railY} V${childTop}" />`;
    } else {
      const left = miniNodes[0].x;
      const right = miniNodes[miniNodes.length - 1].x;
      paths += `<path d="M${left} ${railY} H${right}" />`;
      miniNodes.forEach((n) => {
        paths += `<path d="M${n.x} ${railY} V${childTop}" />`;
      });
    }
    const edgeLabels = miniNodes
      .map((n) => {
        return `<text class="edge-label on-branch" x="${n.x}" y="${labelY}">${esc(n.v)}</text>`;
      })
      .join("");
    const rects = miniNodes
      .map(
        (n) =>
          `<rect class="${n.cls}" x="${n.x - nodeW / 2}" y="78" width="${nodeW}" height="28" rx="7" />
           <text class="${n.textCls}" x="${n.x}" y="97">${esc(n.text)}</text>`
      )
      .join("");

    const cards = vals
      .map((v) => {
        const g = groups[v];
        const otherKeys = FEATURES.filter((f) => f.key !== key);
        const rowsHtml = g
          .map((r) => {
            const globalIdx = rows.indexOf(r) + 1;
            const cls = r.picnic === YES ? "yes" : "no";
            return `<tr><td>${globalIdx}</td>${otherKeys
              .map((f) => `<td>${esc(r[f.key])}</td>`)
              .join("")}<td class="${cls}">${esc(r.picnic)}</td></tr>`;
          })
          .join("");
        const c = labelCounts(g);
        const note = isPure(g)
          ? `${c.n}/${c.n} ${majority(g)} → <strong>lá ${majority(g)}</strong> · không chia tiếp`
          : `${c.yes} Có · ${c.no} Không → <strong>còn lẫn</strong> · slide sau`;
        const head = otherKeys.map((f) => `<th>${esc(f.label)}</th>`).join("");
        return `<div class="filter-card">
          <h3>Nhánh ${esc(v)} — đã lọc</h3>
          <table class="filter-table">
            <thead><tr><th>#</th>${head}<th>Picnic?</th></tr></thead>
            <tbody>${rowsHtml || `<tr><td colspan="${2 + otherKeys.length}">(trống)</td></tr>`}</tbody>
          </table>
          <p class="filter-note">${note}</p>
        </div>`;
      })
      .join("");

    const titleEl = document.querySelector('[data-slide-id="entropy-filter"] h2');
    if (titleEl) titleEl.textContent = `Chọn ${label} → tách bảng thành ${vals.length} nhóm`;

    el.innerHTML = `
      <div class="grow-layout">
        <div class="grow-tree-mini filter-tree-mini" aria-hidden="true">
          <svg class="tree-svg" viewBox="0 0 ${width} 120">
            <g class="tree-lines">${paths}</g>
            ${edgeLabels}
            <rect class="node-root" x="${cx - 75}" y="8" width="150" height="30" rx="8" />
            <text class="node-text on-dark" x="${cx}" y="28">${esc(label)}?</text>
            ${rects}
          </svg>
        </div>
        <div class="filter-grid" style="grid-template-columns: repeat(${Math.min(vals.length, 3)}, 1fr);">${cards}</div>
      </div>`;
  }

  /* ---------- grow branch slides ---------- */
  function remainingFeatures(rootKey) {
    return FEATURES.filter((f) => f.key !== rootKey);
  }

  function pickGrowTargets(rootKey, groups) {
    const entries = Object.keys(groups).map((v) => ({
      val: v,
      rows: groups[v],
      pure: isPure(groups[v]),
    }));
    if (rootKey === "weather") {
      const nang = entries.find((e) => e.val === "Nắng");
      const mua = entries.find((e) => e.val === "Mưa");
      if (nang && mua) return [nang, mua];
    }
    const impure = entries.filter((e) => !e.pure).sort((a, b) => b.rows.length - a.rows.length);
    const pure = entries.filter((e) => e.pure).sort((a, b) => b.rows.length - a.rows.length);
    return [...impure, ...pure].slice(0, 2);
  }

  function renderGainCards(subset, featureKeys) {
    return featureKeys
      .map((f) => {
        const info = infoGain(subset, f.key);
        const keys = Object.keys(info.groups).sort();
        const from = keys
          .map((v) => {
            const g = info.groups[v];
            const ids = g.map((r) => `#${rows.indexOf(r) + 1}`).join(",");
            const c = labelCounts(g);
            return `${v} = ${ids || "∅"} (${c.yes} Có, ${c.no} Không)`;
          })
          .join(" · ");
        const hLines = keys
          .map((v) => {
            const c = labelCounts(info.groups[v]);
            return `<p class="calc-detail"><span data-tex="${texH(v, c.yes, c.no)}"></span></p>`;
          })
          .join("");
        const afterSym = keys
          .map((v) => `\\dfrac{${info.groups[v].length}}{${subset.length}}H_${texSub(v)}`)
          .join("+");
        const afterNum = keys
          .map(
            (v) =>
              `\\dfrac{${info.groups[v].length}}{${subset.length}}\\cdot ${fmt(entropy(info.groups[v]))}`
          )
          .join("+");
        const hBefore = entropy(subset);
        return `<div class="calc-card">
          <h3>Gain nếu chia theo ${esc(f.label)}</h3>
          <div class="calc-steps">
            <p class="calc-from">${esc(from)}</p>
            ${hLines}
            <p><span data-tex="H_{\\mathrm{after}}=${afterSym}=${afterNum}${eqJoin(info.after)}"></span></p>
            <p class="calc-result"><span data-tex="\\mathrm{Gain}=H_{\\mathrm{before}}-H_{\\mathrm{after}}=${fmt(hBefore)}-${fmt(info.after)}${eqJoin(info.gain)}"></span></p>
          </div>
        </div>`;
      })
      .join("");
  }

  function conclusionForBranch(subset, featureKeys, branchVal) {
    if (isPure(subset)) {
      return `Nhánh <strong>${esc(branchVal)}</strong> đã thuần → lá <strong>${esc(majority(subset))}</strong> (${countsPhrase(subset)}).`;
    }
    if (!featureKeys.length) {
      const c = labelCounts(subset);
      return `Hết đặc trưng · lá đa số <strong>${esc(majority(subset))}</strong> (${c.yes} Có · ${c.no} Không)${c.yes && c.no ? " — <em>không thuần</em>" : ""}.`;
    }
    const path = describeBranchPath(subset, featureKeys.map((f) => f.key), "gain");
    return `Chọn tiếp theo Gain → ${path}`;
  }

  function conclusionForBranchGini(subset, featureKeys, branchVal) {
    if (isPure(subset)) {
      return `Nhánh <strong>${esc(branchVal)}</strong> đã thuần → lá <strong>${esc(majority(subset))}</strong> (${countsPhrase(subset)}).`;
    }
    if (!featureKeys.length) {
      const c = labelCounts(subset);
      return `Hết đặc trưng · lá đa số <strong>${esc(majority(subset))}</strong> (${c.yes} Có · ${c.no} Không)${c.yes && c.no ? " — <em>không thuần</em>" : ""}.`;
    }
    const path = describeBranchPath(subset, featureKeys.map((f) => f.key), "gini");
    return `Chọn tiếp theo ΔGini → ${path}`;
  }

  /** Find first impure child after the preferred grow branch's first split. */
  function findDeepTarget(criterion) {
    const root =
      criterion === "gini"
        ? bestFeatureGini(
            rows,
            FEATURES.map((f) => f.key)
          )
        : bestFeature(
            rows,
            FEATURES.map((f) => f.key)
          );
    if (!root.key || !root.info) return null;
    const targets = pickGrowTargets(root.key, root.info.groups);
    // Prefer later impure branch (Mưa) — that's where Thấp còn lẫn appears
    const ordered = [...targets].reverse();
    for (const t of ordered) {
      if (t.pure) continue;
      const rem = remainingFeatures(root.key);
      const keyList = rem.map((f) => f.key);
      const pick =
        criterion === "gini" ? bestFeatureGini(t.rows, keyList) : bestFeature(t.rows, keyList);
      if (!pick.key) continue;
      const rest = rem.filter((f) => f.key !== pick.key);
      const impure = sortValues(pick.key, Object.keys(pick.info.groups))
        .map((v) => ({ v, rows: pick.info.groups[v] }))
        .filter((e) => !isPure(e.rows));
      if (impure.length && rest.length) {
        return {
          rootKey: root.key,
          rootLabel: featureLabel(root.key),
          branchVal: t.val,
          splitKey: pick.key,
          splitLabel: featureLabel(pick.key),
          childVal: impure[0].v,
          childRows: impure[0].rows,
          rest,
        };
      }
    }
    return null;
  }

  function renderGrowDeepSlide(criterion) {
    const picnicId = criterion === "gini" ? "gini-grow-deep" : "grow-deep";
    const slideId = criterion === "gini" ? "gini-grow-deep" : "entropy-grow-deep";
    const el = document.querySelector(`[data-picnic="${picnicId}"]`);
    const slide = document.querySelector(`[data-slide-id="${slideId}"]`);
    if (!el) return;

    const deep = findDeepTarget(criterion);
    if (!deep) {
      el.innerHTML = `<p class="lead calc-lead">Không còn nhóm lẫn để chia tiếp — mọi nhánh con đã thuần 100%.</p>`;
      return;
    }

    const { rootLabel, branchVal, splitLabel, childVal, childRows, rest } = deep;
    const c = labelCounts(childRows);
    const pathLabel = `${branchVal} → ${splitLabel} = ${childVal}`;
    if (slide) {
      const h2 = slide.querySelector("h2");
      if (h2) {
        h2.textContent =
          criterion === "gini"
            ? `${pathLabel} — tính ΔGini tiếp`
            : `${pathLabel} — tính Gain tiếp`;
      }
      slide.dataset.title = criterion === "gini" ? `Gini · ${childVal}` : `Chia tiếp · ${childVal}`;
    }

    const head = rest.map((f) => `<th>${esc(f.label)}</th>`).join("");
    const tableRows = childRows
      .map((r) => {
        const idx = rows.indexOf(r) + 1;
        const cls = r.picnic === YES ? "yes" : "no";
        return `<tr><td>${idx}</td>${rest
          .map((f) => `<td>${esc(r[f.key])}</td>`)
          .join("")}<td class="${cls}">${esc(r.picnic)}</td></tr>`;
      })
      .join("");

    const beforeCard =
      criterion === "gini"
        ? `<div class="calc-card">
            <h3>Gini<sub>before</sub> của nhóm ${esc(childVal)}</h3>
            <div class="calc-steps">
              <p class="calc-from">p<sub>Yes</sub> = ${c.yes}/${c.n || 1} · p<sub>No</sub> = ${c.no}/${c.n || 1}</p>
              <p><span data-tex="${texGini("before", c.yes, c.no)}"></span></p>
              <p class="calc-result"><span data-tex="\\mathrm{Gini}_{\\mathrm{before}}=${fmt(gini(childRows))}"></span></p>
            </div>
          </div>`
        : `<div class="calc-card">
            <h3>H<sub>before</sub> của nhóm ${esc(childVal)}</h3>
            <div class="calc-steps">
              <p class="calc-from">p<sub>Yes</sub> = ${c.yes}/${c.n || 1} · p<sub>No</sub> = ${c.no}/${c.n || 1}</p>
              <p><span data-tex="${texH("before", c.yes, c.no)}"></span></p>
            </div>
          </div>`;

    const cards =
      criterion === "gini"
        ? `<div class="calc-grid">${renderDeltaGiniCards(childRows, rest)}</div>`
        : `<div class="calc-grid">${renderGainCards(childRows, rest)}</div>`;

    const concl = firstLevelConclusion(childRows, rest, criterion);

    el.innerHTML = `
      <div class="grow-split grow-split-nang">
        <div class="filter-card">
          <h3>Bảng đã lọc (${esc(pathLabel)})</h3>
          <table class="filter-table">
            <thead><tr><th>#</th>${head}<th>Picnic?</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
          <p class="filter-note">${countsPhrase(childRows)} · còn lại: ${rest.map((f) => f.label).join(", ") || "—"}</p>
        </div>
        ${beforeCard}
      </div>
      ${cards}
      <div class="concl-with-tree">
        <div class="calc-card">
          <h3>Kết luận</h3>
          <div class="calc-steps">
            <p class="calc-compare">${concl}</p>
          </div>
        </div>
        <div class="grow-tree-mini concl-tree" aria-hidden="true">
          ${miniDeepSvg(splitLabel, childVal, childRows, rest, criterion === "gini")}
        </div>
      </div>`;
  }

  /** Human-readable path that continues until pure leaves (no early stop on impure). */
  function describeBranchPath(subset, featureKeys, criterion, depth = 0) {
    if (isPure(subset)) {
      return `lá <strong>${esc(majority(subset))}</strong> (${countsPhrase(subset)})`;
    }
    if (!featureKeys.length || depth > 5) {
      const c = labelCounts(subset);
      return `lá đa số <strong>${esc(majority(subset))}</strong>* (${c.yes} Có · ${c.no} Không)`;
    }
    const pick =
      criterion === "gini" ? bestFeatureGini(subset, featureKeys) : bestFeature(subset, featureKeys);
    if (!pick.key || (criterion === "gini" ? pick.delta : pick.gain) <= 1e-12) {
      const c = labelCounts(subset);
      return `lá đa số <strong>${esc(majority(subset))}</strong>* (${c.yes} Có · ${c.no} Không)`;
    }
    const rest = featureKeys.filter((k) => k !== pick.key);
    const childBits = sortValues(pick.key, Object.keys(pick.info.groups)).map((v) => {
      const g = pick.info.groups[v];
      if (isPure(g)) return `${esc(v)} → lá <strong>${esc(majority(g))}</strong>`;
      return `${esc(v)} (${countsPhrase(g)}) → ${describeBranchPath(g, rest, criterion, depth + 1)}`;
    });
    return `hỏi <strong>${esc(featureLabel(pick.key))}</strong>: ${childBits.join(" · ")}`;
  }

  function miniBranchSvg(rootLabel, branchVal, subset, featureKeys, byGini = false) {
    // One level only — impure children stay "…" (don't preview deeper splits)
    if (isPure(subset) || !featureKeys.length) {
      const lab = majority(subset);
      const cls = lab === YES ? "node-yes" : "node-no";
      return `<svg class="tree-svg" viewBox="0 0 280 130">
        <g class="tree-lines"><path d="M140 34 V90" /></g>
        <text class="edge-label on-branch" x="140" y="66">${esc(branchVal)}</text>
        <rect class="node-root" x="75" y="4" width="130" height="30" rx="7" />
        <text class="node-text on-dark" x="140" y="24">${esc(rootLabel)}?</text>
        <rect class="${cls}" x="80" y="94" width="120" height="28" rx="6" />
        <text class="node-text on-dark" x="140" y="113">${esc(lab)}</text>
      </svg>`;
    }

    const keyList = featureKeys.map((f) => (typeof f === "string" ? f : f.key));
    const pick = byGini ? bestFeatureGini(subset, keyList) : bestFeature(subset, keyList);
    const splitKey = pick.key || keyList[0];
    const splitLabel = featureLabel(splitKey);
    const groups = groupBy(subset, splitKey);
    const vals = sortValues(splitKey, Object.keys(groups));
    const gap = 118;
    const width = Math.max(300, 100 + Math.max(vals.length - 1, 1) * gap + 100);
    const cx = width / 2;
    const span = (vals.length - 1) * gap;
    const startX = cx - span / 2;
    const midTop = 70;
    const midBottom = 96;
    const leafTop = 128;
    const railY = 114;

    let lines = `<path d="M${cx} 34 V${midTop}" />`;
    const leafXs = vals.map((_, i) => (vals.length === 1 ? cx : startX + i * gap));
    if (vals.length === 1) {
      lines += `<path d="M${cx} ${midBottom} V${leafTop}" />`;
    } else {
      const left = leafXs[0];
      const right = leafXs[leafXs.length - 1];
      lines += `<path d="M${cx} ${midBottom} V${railY}" />`;
      lines += `<path d="M${left} ${railY} H${right}" />`;
      leafXs.forEach((x) => {
        lines += `<path d="M${x} ${railY} V${leafTop}" />`;
      });
    }

    let body = `<text class="edge-label on-branch" x="${cx}" y="54">${esc(branchVal)}</text>`;
    body += `<rect class="node-root" x="${cx - 65}" y="4" width="130" height="30" rx="7" />
      <text class="node-text on-dark" x="${cx}" y="24">${esc(rootLabel)}?</text>`;
    body += `<rect class="node-mid" x="${cx - 60}" y="${midTop}" width="120" height="26" rx="6" />
      <text class="node-text" x="${cx}" y="${midTop + 18}">${esc(splitLabel)}?</text>`;

    vals.forEach((v, i) => {
      const x = leafXs[i];
      const g = groups[v];
      const lab = majority(g);
      const pure = isPure(g);
      const cls = pure ? (lab === YES ? "node-yes" : "node-no") : "node-mid";
      const txt = pure ? lab : "…";
      const edgeCls =
        pure && lab === YES
          ? "edge-label yes-c on-branch"
          : pure
            ? "edge-label no-c on-branch"
            : "edge-label on-branch";
      // Nhãn đè giữa đoạn thẳng đứng rail → lá
      const labelY = (railY + leafTop) / 2 + 4;
      body += `<text class="${edgeCls}" x="${x}" y="${labelY}">${esc(v)}</text>`;
      body += `<rect class="${cls}" x="${x - 45}" y="${leafTop}" width="90" height="28" rx="6" />
        <text class="node-text${pure ? " on-dark" : ""}" x="${x}" y="${leafTop + 19}">${esc(txt)}</text>`;
    });

    return `<svg class="tree-svg" viewBox="0 0 ${width} 168"><g class="tree-lines">${lines}</g>${body}</svg>`;
  }

  /** One-level tree for the impure group just calculated (parent edge = childVal). */
  function miniDeepSvg(parentSplitLabel, groupVal, subset, featureKeys, byGini = false) {
    return miniBranchSvg(parentSplitLabel, groupVal, subset, featureKeys, byGini);
  }

  function firstLevelConclusion(subset, featureKeys, criterion) {
    if (isPure(subset)) {
      return `Nhánh đã thuần → lá <strong>${esc(majority(subset))}</strong> (${countsPhrase(subset)}).`;
    }
    if (!featureKeys.length) {
      const c = labelCounts(subset);
      return `Hết đặc trưng · lá đa số <strong>${esc(majority(subset))}</strong> (${c.yes} Có · ${c.no} Không).`;
    }
    const keyList = featureKeys.map((f) => f.key);
    const pick =
      criterion === "gini" ? bestFeatureGini(subset, keyList) : bestFeature(subset, keyList);
    if (!pick.key) return "";
    const metric = criterion === "gini" ? "ΔGini" : "Gain";
    const parts = sortValues(pick.key, Object.keys(pick.info.groups)).map((v) => {
      const g = pick.info.groups[v];
      if (isPure(g)) return `${esc(v)} → lá <strong>${esc(majority(g))}</strong>`;
      return `${esc(v)} còn lẫn (${countsPhrase(g)})`;
    });
    const score = criterion === "gini" ? pick.delta : pick.gain;
    const scoreTxt = Math.abs(score - round3(score)) < 1e-9 ? fmt(score) : `≈ ${fmt(score)}`;
    return `${metric} chọn <strong>${esc(featureLabel(pick.key))}</strong> (${scoreTxt}): ${parts.join(" · ")}.`;
  }

  function renderGrowSlide(slotIndex) {
    const slideIds = ["entropy-grow", "entropy-grow-rain"];
    const slideId = slideIds[slotIndex];
    const slide = document.querySelector(`[data-slide-id="${slideId}"]`);
    const el = document.querySelector(`[data-picnic="grow-${slotIndex}"]`);
    if (!el || !slide) return;

    const best = bestFeature(
      rows,
      FEATURES.map((f) => f.key)
    );
    if (!best.key) {
      el.innerHTML = `<p class="lead">Không đủ dữ liệu.</p>`;
      return;
    }
    const rootKey = best.key;
    const rootLabel = featureLabel(rootKey);
    const groups = best.info.groups;
    const targets = pickGrowTargets(rootKey, groups);
    const target = targets[slotIndex];
    if (!target) {
      el.innerHTML = `<p class="lead calc-lead">Không còn nhánh thứ ${slotIndex + 1} để minh họa (gốc chỉ có ít nhóm).</p>`;
      return;
    }

    const subset = target.rows;
    const rem = remainingFeatures(rootKey);
    const h2 = slide.querySelector("h2");
    if (h2) h2.textContent = `Nhánh ${target.val} — tính Gain rõ từng bước`;
    slide.dataset.title = `Nhánh ${target.val}`;

    const otherCols = rem;
    const tableRows = subset
      .map((r) => {
        const idx = rows.indexOf(r) + 1;
        const cls = r.picnic === YES ? "yes" : "no";
        return `<tr><td>${idx}</td>${otherCols
          .map((f) => `<td>${esc(r[f.key])}</td>`)
          .join("")}<td class="${cls}">${esc(r.picnic)}</td></tr>`;
      })
      .join("");
    const head = otherCols.map((f) => `<th>${esc(f.label)}</th>`).join("");
    const c = labelCounts(subset);
    const hBefore = entropy(subset);

    let gainBlock = "";
    if (isPure(subset)) {
      gainBlock = `<div class="calc-card calc-wide"><h3>Nhánh đã thuần</h3>
        <div class="calc-steps"><p class="calc-compare">Không cần tính Gain — kết luận lá <strong>${esc(majority(subset))}</strong>.</p></div></div>`;
    } else if (!rem.length) {
      gainBlock = `<div class="calc-card calc-wide"><h3>Hết đặc trưng</h3>
        <div class="calc-steps"><p class="calc-compare">Lá đa số <strong>${esc(majority(subset))}</strong> (${c.yes} Có · ${c.no} Không)${c.yes && c.no ? " — không thuần" : ""}.</p></div></div>`;
    } else {
      gainBlock = `<div class="calc-grid">${renderGainCards(subset, rem)}</div>`;
    }

    el.innerHTML = `
      <div class="grow-split grow-split-nang">
        <div class="filter-card">
          <h3>Bảng đã lọc (${esc(target.val)})</h3>
          <table class="filter-table">
            <thead><tr><th>#</th>${head}<th>Picnic?</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
          <p class="filter-note">${countsPhrase(subset)} · còn lại: ${rem.map((f) => f.label).join(", ") || "—"}</p>
        </div>
        <div class="calc-card">
          <h3>H<sub>before</sub> của nhánh ${esc(target.val)}</h3>
          <div class="calc-steps">
            <p class="calc-from">p<sub>Yes</sub> = ${c.yes}/${c.n || 1} · p<sub>No</sub> = ${c.no}/${c.n || 1}</p>
            <p><span data-tex="${texH("before", c.yes, c.no).replace("H_{\\mathrm{before}}", "H_{\\mathrm{before}}")}"></span></p>
          </div>
        </div>
      </div>
      ${gainBlock}
      <div class="concl-with-tree">
        <div class="calc-card">
          <h3>Kết luận nhánh ${esc(target.val)}</h3>
          <div class="calc-steps">
            <p class="calc-compare">${firstLevelConclusion(subset, rem, "gain")}</p>
          </div>
        </div>
        <div class="grow-tree-mini concl-tree" aria-hidden="true">
          ${miniBranchSvg(rootLabel, target.val, subset, rem)}
        </div>
      </div>`;
  }

  /* ---------- result tree SVG ---------- */
  function layoutTree(node) {
    const NODE_W = 124;
    const NODE_H = 42;
    const GAP_X = 36;
    const LEVEL_H = 92;
    const PAD = 28;
    let nextLeafX = 0;

    function place(n, depth) {
      n._depth = depth;
      n._w = NODE_W;
      n._h = NODE_H;
      if (n.type === "node") {
        n._childList = sortValues(n.feature, Object.keys(n.children)).map((v) => {
          const ch = n.children[v];
          ch._edge = v;
          place(ch, depth + 1);
          return ch;
        });
        if (n._childList.length) {
          n._x = (n._childList[0]._x + n._childList[n._childList.length - 1]._x) / 2;
        } else {
          n._x = nextLeafX + NODE_W / 2;
          nextLeafX += NODE_W + GAP_X;
        }
      } else {
        n._childList = [];
        n._x = nextLeafX + NODE_W / 2;
        nextLeafX += NODE_W + GAP_X;
      }
      n._y = PAD + depth * LEVEL_H + NODE_H / 2;
    }

    place(node, 0);

    const all = [];
    (function gather(n) {
      all.push(n);
      (n._childList || []).forEach(gather);
    })(node);

    const minX = Math.min(...all.map((n) => n._x - NODE_W / 2));
    const shift = PAD - minX;
    all.forEach((n) => {
      n._x += shift;
    });
    const maxX = Math.max(...all.map((n) => n._x + NODE_W / 2));
    const maxDepth = Math.max(...all.map((n) => n._depth));
    return {
      width: maxX + PAD,
      height: PAD + (maxDepth + 1) * LEVEL_H + 8,
      NODE_W,
      NODE_H,
    };
  }

  function treeSvgMarkup(tree, ariaLabel = "Cây quyết định") {
    const { width, height, NODE_W, NODE_H } = layoutTree(tree);
    const hw = NODE_W / 2;
    const hh = NODE_H / 2;

    const nodes = [];
    const edges = [];
    function collect(n, parent) {
      nodes.push(n);
      if (parent) edges.push({ from: parent, to: n, label: n._edge });
      (n._childList || []).forEach((ch) => collect(ch, n));
    }
    collect(tree, null);

    let paths = "";
    let edgeTexts = "";
    edges.forEach(({ from, to, label }) => {
      const y1 = from._y + hh;
      const y2 = to._y - hh;
      const midY = (y1 + y2) / 2;
      paths += `<path d="M${from._x} ${y1} V${midY} H${to._x} V${y2}" />`;
      const pureYes = to.type === "leaf" && to.counts.no === 0 && to.counts.yes > 0;
      const pureNo = to.type === "leaf" && to.counts.yes === 0 && to.counts.no > 0;
      const cls = pureYes
        ? "edge-label yes-c"
        : pureNo
          ? "edge-label no-c"
          : "edge-label";
      // Nhãn xích lên trên đoạn ngang; nhánh thẳng đứng (vd. Mây) lệch trái một chút
      const straight = Math.abs(from._x - to._x) < 1;
      const lx = straight ? from._x - 18 : (from._x + to._x) / 2;
      const ly = midY - 5;
      edgeTexts += `<text class="${cls}" x="${lx}" y="${ly}">${esc(label)}</text>`;
    });

    let nodeSvg = "";
    nodes.forEach((n) => {
      const c = n.counts;
      const stat = `${c.yes} Có · ${c.no} Không`;
      const x = n._x - hw;
      const y = n._y - hh;
      if (n.type === "leaf") {
        const impure = c.yes > 0 && c.no > 0;
        const cls = impure ? "node-mid" : n.label === YES ? "node-yes" : "node-no";
        const title = impure ? `${n.label}*` : n.label === YES ? "Có ✓" : "Không";
        const onDark = impure ? "" : "on-dark";
        nodeSvg += `<rect class="${cls}" x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="8" />
          <text class="node-text ${onDark}" x="${n._x}" y="${n._y - 4}">${esc(title)}</text>
          <text class="node-stat ${onDark}" x="${n._x}" y="${n._y + 12}">${esc(stat)}</text>`;
      } else {
        const isRoot = n === tree;
        const cls = isRoot ? "node-root" : "node-mid";
        const onDark = isRoot ? "on-dark" : "";
        nodeSvg += `<rect class="${cls}" x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="8" />
          <text class="node-text ${onDark}" x="${n._x}" y="${n._y - 4}">${esc(n.label)}?</text>
          <text class="node-stat ${onDark}" x="${n._x}" y="${n._y + 12}">${esc(stat)}</text>`;
      }
    });

    return `<div class="built-tree">
      <svg class="tree-svg picnic-tree-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(ariaLabel)}">
        <g class="tree-lines">${paths}</g>
        ${edgeTexts}
        ${nodeSvg}
      </svg>
    </div>`;
  }

  function renderResultTree() {
    const el = document.querySelector("[data-picnic='result-tree']");
    if (!el) return;
    if (!rows.length) {
      el.innerHTML = `<p class="lead">Bảng trống.</p>`;
      return;
    }
    const tree = buildTree(rows);
    el.innerHTML = `
      ${treeSvgMarkup(tree, "Cây picnic · Entropy")}
      <p class="callout">Cây dựng bằng Entropy trên bảng hiện tại (lá <code>*</code> = không thuần). Tiếp theo: Cách 2 với Gini.</p>`;
  }

  function texGini(name, yes, no) {
    const n = yes + no;
    if (!n) return `\\mathrm{Gini}_${texSub(name)}=0`;
    const g = 1 - (yes / n) * (yes / n) - (no / n) * (no / n);
    return `\\mathrm{Gini}_${texSub(name)}=1-\\left(\\left(\\dfrac{${yes}}{${n}}\\right)^2+\\left(\\dfrac{${no}}{${n}}\\right)^2\\right)${eqJoin(g)}`;
  }

  /* ---------- gini-h (Gini values) ---------- */
  function renderGiniH() {
    const el = document.querySelector("[data-picnic='gini-h']");
    if (!el) return;
    const { yes, no, n } = labelCounts(rows);
    const gBefore = gini(rows);
    const py = n ? yes / n : 0;
    const pn = n ? no / n : 0;
    if (!n) {
      el.innerHTML = `<p class="lead">Bảng trống.</p>`;
      return;
    }

    const cards = FEATURES.map((f) => {
      const groups = groupBy(rows, f.key);
      const keys = sortValues(f.key, Object.keys(groups));
      const from = keys
        .map((v) => `${v} ${groups[v].length}`)
        .join(" · ");
      const body = keys
        .map((v) => {
          const c = labelCounts(groups[v]);
          return `<p><strong>${esc(v)}</strong> (${c.yes} Có, ${c.no} Không):</p>
            <p class="calc-detail"><span data-tex="${texGini(v, c.yes, c.no)}"></span></p>`;
        })
        .join("");
      return `<div class="calc-card"><h3>${esc(f.label)}</h3>
        <div class="calc-steps"><p class="calc-from">${esc(from)}</p>${body}</div></div>`;
    }).join("");

    el.innerHTML = `
      <div class="calc-card calc-wide calc-before">
        <h3>Gini<sub>before</sub> — Gini của cả bảng</h3>
        <div class="calc-steps">
          <p class="calc-from">Cả bảng: ${countsPhrase(rows)}</p>
          <p><span data-tex="p_{\\mathrm{Yes}} = \\dfrac{${yes}}{${n}} = ${fmt(py)},\\quad p_{\\mathrm{No}} = \\dfrac{${no}}{${n}} = ${fmt(pn)}"></span></p>
          <p><span data-tex="\\mathrm{Gini} = 1-\\left((p_{\\mathrm{Yes}})^2+(p_{\\mathrm{No}})^2\\right)"></span></p>
          <p class="calc-result"><span data-tex="\\mathrm{Gini}_{\\mathrm{before}} = ${fmt(gBefore)}"></span></p>
        </div>
      </div>
      <div class="calc-grid calc-grid-3">${cards}</div>`;
  }

  /* ---------- gini-calc (ΔGini) ---------- */
  function renderGiniCalc() {
    const el = document.querySelector("[data-picnic='gini-calc']");
    if (!el) return;
    const { yes, no, n } = labelCounts(rows);
    const gBefore = gini(rows);
    if (!n) {
      el.innerHTML = `<p class="lead">Bảng trống.</p>`;
      return;
    }

    const scored = FEATURES.map((f) => {
      const info = deltaGini(rows, f.key);
      const keys = sortValues(f.key, Object.keys(info.groups));
      const afterSym = keys
        .map((v) => `\\dfrac{${info.groups[v].length}}{${n}}\\mathrm{Gini}_${texSub(v)}`)
        .join("+");
      const afterNum = keys
        .map((v) => `\\dfrac{${info.groups[v].length}}{${n}}\\cdot ${fmt(gini(info.groups[v]))}`)
        .join("+");
      return { f, info, afterSym, afterNum };
    });
    const best = scored.reduce((a, b) => (b.info.delta > a.info.delta ? b : a));
    const gainBest = bestFeature(
      rows,
      FEATURES.map((f) => f.key)
    );

    const cards = scored
      .map(({ f, info, afterSym, afterNum }) => {
        return `<div class="calc-card"><h3>${esc(f.label)}</h3>
          <div class="calc-steps">
            <p class="calc-from">Dùng Gini vừa tính</p>
            <p><span data-tex="\\mathrm{Gini}_{\\mathrm{after}}=${afterSym}"></span></p>
            <p><span data-tex="=${afterNum}${eqJoin(info.after)}"></span></p>
            <p class="calc-result"><span data-tex="\\Delta\\mathrm{Gini}(\\text{${f.label}})=${fmt(gBefore)}-${fmt(info.after)}${eqJoin(info.delta)}"></span></p>
          </div></div>`;
      })
      .join("");

    el.innerHTML = `
      <div class="calc-card calc-wide calc-before">
        <h3>Gini<sub>before</sub> — Gini cả bảng (nhắc lại)</h3>
        <div class="calc-steps">
          <p class="calc-from">${n} mẫu · ${yes} Có · ${no} Không → p<sub>Yes</sub> = ${fmt(yes / n)} · p<sub>No</sub> = ${fmt(no / n)}</p>
          <p><span data-tex="\\mathrm{Gini}_{\\mathrm{before}}=${fmt(gBefore)}"></span></p>
        </div>
      </div>
      <div class="calc-grid calc-grid-3">${cards}</div>
      <div class="calc-card calc-wide">
        <h3>Kết luận — chọn gốc</h3>
        <div class="calc-steps">
          <p class="calc-compare">
            ΔGini(<strong>${esc(best.f.label)}</strong>) lớn nhất (≈ ${fmt(best.info.delta)}) → hỏi <strong>${esc(best.f.label)}</strong> trước.
            So với Entropy: Cách 1 chọn <strong>${esc(featureLabel(gainBest.key || ""))}</strong>${
              gainBest.key === best.f.key ? " — <em>cùng gốc</em>." : " — có thể khác trên data này."
            }
            Slide sau: tính ΔGini tiếp trên từng nhánh chưa thuần (bảng lọc + công thức).
          </p>
        </div>
      </div>`;
  }

  function renderDeltaGiniCards(subset, featureKeys) {
    const gBefore = gini(subset);
    return featureKeys
      .map((f) => {
        const info = deltaGini(subset, f.key);
        const keys = sortValues(f.key, Object.keys(info.groups));
        const from = keys
          .map((v) => {
            const g = info.groups[v];
            const ids = g.map((r) => `#${rows.indexOf(r) + 1}`).join(",");
            const c = labelCounts(g);
            return `${v} = ${ids || "∅"} (${c.yes} Có, ${c.no} Không)`;
          })
          .join(" · ");
        const giniLines = keys
          .map((v) => {
            const c = labelCounts(info.groups[v]);
            return `<p class="calc-detail"><span data-tex="${texGini(v, c.yes, c.no)}"></span></p>`;
          })
          .join("");
        const afterSym = keys
          .map((v) => `\\dfrac{${info.groups[v].length}}{${subset.length}}\\mathrm{Gini}_${texSub(v)}`)
          .join("+");
        const afterNum = keys
          .map((v) => `\\dfrac{${info.groups[v].length}}{${subset.length}}\\cdot ${fmt(gini(info.groups[v]))}`)
          .join("+");
        return `<div class="calc-card">
          <h3>ΔGini nếu chia theo ${esc(f.label)}</h3>
          <div class="calc-steps">
            <p class="calc-from">${esc(from)}</p>
            ${giniLines}
            <p><span data-tex="\\mathrm{Gini}_{\\mathrm{after}}=${afterSym}"></span></p>
            <p><span data-tex="=${afterNum}${eqJoin(info.after)}"></span></p>
            <p class="calc-result"><span data-tex="\\Delta\\mathrm{Gini}=\\mathrm{Gini}_{\\mathrm{before}}-\\mathrm{Gini}_{\\mathrm{after}}=${fmt(gBefore)}-${fmt(info.after)}${eqJoin(info.delta)}"></span></p>
          </div>
        </div>`;
      })
      .join("");
  }

  function renderGiniGrowSlide(slotIndex) {
    const slideIds = ["gini-grow", "gini-grow-rain"];
    const slideId = slideIds[slotIndex];
    const slide = document.querySelector(`[data-slide-id="${slideId}"]`);
    const el = document.querySelector(`[data-picnic="gini-grow-${slotIndex}"]`);
    if (!el || !slide) return;

    const best = bestFeatureGini(
      rows,
      FEATURES.map((f) => f.key)
    );
    if (!best.key) {
      el.innerHTML = `<p class="lead">Không đủ dữ liệu.</p>`;
      return;
    }
    const rootKey = best.key;
    const rootLabel = featureLabel(rootKey);
    const groups = best.info.groups;
    const targets = pickGrowTargets(rootKey, groups);
    const target = targets[slotIndex];
    if (!target) {
      el.innerHTML = `<p class="lead calc-lead">Không còn nhánh thứ ${slotIndex + 1} để minh họa (gốc chỉ có ít nhóm).</p>`;
      return;
    }

    const subset = target.rows;
    const rem = remainingFeatures(rootKey);
    const h2 = slide.querySelector("h2");
    if (h2) h2.textContent = `Nhánh ${target.val} — tính ΔGini rõ từng bước`;
    slide.dataset.title = `Gini · ${target.val}`;

    const otherCols = rem;
    const tableRows = subset
      .map((r) => {
        const idx = rows.indexOf(r) + 1;
        const cls = r.picnic === YES ? "yes" : "no";
        return `<tr><td>${idx}</td>${otherCols
          .map((f) => `<td>${esc(r[f.key])}</td>`)
          .join("")}<td class="${cls}">${esc(r.picnic)}</td></tr>`;
      })
      .join("");
    const head = otherCols.map((f) => `<th>${esc(f.label)}</th>`).join("");
    const c = labelCounts(subset);
    const gBefore = gini(subset);

    let deltaBlock = "";
    if (isPure(subset)) {
      deltaBlock = `<div class="calc-card calc-wide"><h3>Nhánh đã thuần</h3>
        <div class="calc-steps"><p class="calc-compare">Không cần tính ΔGini — kết luận lá <strong>${esc(majority(subset))}</strong>.</p></div></div>`;
    } else if (!rem.length) {
      deltaBlock = `<div class="calc-card calc-wide"><h3>Hết đặc trưng</h3>
        <div class="calc-steps"><p class="calc-compare">Lá đa số <strong>${esc(majority(subset))}</strong> (${c.yes} Có · ${c.no} Không)${c.yes && c.no ? " — không thuần" : ""}.</p></div></div>`;
    } else {
      deltaBlock = `<div class="calc-grid">${renderDeltaGiniCards(subset, rem)}</div>`;
    }

    el.innerHTML = `
      <div class="grow-split grow-split-nang">
        <div class="filter-card">
          <h3>Bảng đã lọc (${esc(target.val)})</h3>
          <table class="filter-table">
            <thead><tr><th>#</th>${head}<th>Picnic?</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
          <p class="filter-note">${countsPhrase(subset)} · còn lại: ${rem.map((f) => f.label).join(", ") || "—"}</p>
        </div>
        <div class="calc-card">
          <h3>Gini<sub>before</sub> của nhánh ${esc(target.val)}</h3>
          <div class="calc-steps">
            <p class="calc-from">p<sub>Yes</sub> = ${c.yes}/${c.n || 1} · p<sub>No</sub> = ${c.no}/${c.n || 1}</p>
            <p><span data-tex="${texGini("before", c.yes, c.no)}"></span></p>
            <p class="calc-result"><span data-tex="\\mathrm{Gini}_{\\mathrm{before}}=${fmt(gBefore)}"></span></p>
          </div>
        </div>
      </div>
      ${deltaBlock}
      <div class="concl-with-tree">
        <div class="calc-card">
          <h3>Kết luận nhánh ${esc(target.val)}</h3>
          <div class="calc-steps">
            <p class="calc-compare">${firstLevelConclusion(subset, rem, "gini")}</p>
          </div>
        </div>
        <div class="grow-tree-mini concl-tree" aria-hidden="true">
          ${miniBranchSvg(rootLabel, target.val, subset, rem, true)}
        </div>
      </div>`;
  }

  function renderGiniResult() {
    const el = document.querySelector("[data-picnic='gini-result']");
    if (!el) return;
    if (!rows.length) {
      el.innerHTML = `<p class="lead">Bảng trống.</p>`;
      return;
    }
    const giniTree = buildTree(rows, FEATURES.map((f) => f.key), 0, 6, "gini");
    const entRoot = bestFeature(
      rows,
      FEATURES.map((f) => f.key)
    );
    const giniRoot = bestFeatureGini(
      rows,
      FEATURES.map((f) => f.key)
    );
    const sameRoot = entRoot.key && giniRoot.key && entRoot.key === giniRoot.key;
    el.innerHTML = `
      ${treeSvgMarkup(giniTree, "Cây picnic · Gini")}
      <p class="callout">
        Cây dựng bằng <strong>Gini / ΔGini</strong> trên bảng hiện tại (lá <code>*</code> = không thuần).
        Gốc Gini: <strong>${esc(featureLabel(giniRoot.key || ""))}</strong>
        · gốc Entropy: <strong>${esc(featureLabel(entRoot.key || ""))}</strong>
        ${sameRoot ? " — <em>cùng gốc</em>." : " — khác gốc trên data này."}
      </p>`;
  }

  /* ---------- recompute + events ---------- */
  function recompute() {
    renderTable();
    renderDatasetBind();
    renderEntropyH();
    renderEntropyCalc();
    renderFilter();
    renderGrowSlide(0);
    renderGrowSlide(1);
    renderGrowDeepSlide("gain");
    renderResultTree();
    renderGiniH();
    renderGiniCalc();
    renderGiniGrowSlide(0);
    renderGiniGrowSlide(1);
    renderGrowDeepSlide("gini");
    renderGiniResult();
    window.renderDeckMath?.(document);
  }

  function onTableChange(e) {
    const sel = e.target.closest("select[data-col]");
    if (!sel) return;
    const tr = sel.closest("tr[data-row]");
    if (!tr) return;
    const i = Number(tr.dataset.row);
    const col = sel.dataset.col;
    if (!rows[i]) return;
    rows[i][col] = sel.value;
    if (col === "picnic") {
      sel.closest("td")?.classList.toggle("yes", sel.value === YES);
      sel.closest("td")?.classList.toggle("no", sel.value === NO);
    }
    recompute();
  }

  function onTableClick(e) {
    const del = e.target.closest("[data-del]");
    if (del) {
      const i = Number(del.dataset.del);
      if (rows.length <= 1) return;
      rows.splice(i, 1);
      recompute();
      return;
    }
  }

  function addRow() {
    rows.push({
      weather: "Nắng",
      humidity: "Cao",
      wind: "Yếu",
      picnic: YES,
    });
    recompute();
  }

  function resetRows() {
    rows = cloneDefault();
    recompute();
  }

  function setEditMode(on) {
    editMode = Boolean(on);
    renderTable();
  }

  function initPicnicDeck() {
    const table = document.querySelector("[data-picnic='table']");
    if (!table) return;
    table.addEventListener("change", onTableChange);
    table.addEventListener("click", onTableClick);
    table.addEventListener("dblclick", (e) => {
      if (e.target.closest("select, button, a")) return;
      setEditMode(!editMode);
    });
    document.querySelector("[data-picnic-add]")?.addEventListener("click", addRow);
    document.querySelector("[data-picnic-reset]")?.addEventListener("click", resetRows);
    document.querySelector("[data-picnic-done]")?.addEventListener("click", () => setEditMode(false));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && editMode) setEditMode(false);
    });
    recompute();
  }

  window.PicnicDeck = {
    init: initPicnicDeck,
    recompute,
    getRows: () => rows.map((r) => ({ ...r })),
    setRows: (next) => {
      rows = next.map((r) => ({ ...r }));
      recompute();
    },
    reset: resetRows,
    setEditMode,
  };
})();
