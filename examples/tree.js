/**
 * ID3 nhẹ cho trình duyệt — dùng labelKey / features từ dataset.
 */
window.SimpleTree = (function () {
  function countLabels(rows, labelKey) {
    const counts = {};
    for (const r of rows) {
      counts[r[labelKey]] = (counts[r[labelKey]] || 0) + 1;
    }
    return counts;
  }

  function majorityLabel(rows, labelKey) {
    const counts = countLabels(rows, labelKey);
    let best = Object.keys(counts)[0] || "?";
    let max = -1;
    for (const [label, n] of Object.entries(counts)) {
      if (n > max) {
        max = n;
        best = label;
      }
    }
    return best;
  }

  function entropy(rows, labelKey) {
    if (!rows.length) return 0;
    const counts = countLabels(rows, labelKey);
    let h = 0;
    for (const n of Object.values(counts)) {
      const p = n / rows.length;
      if (p > 0) h -= p * Math.log2(p);
    }
    return h;
  }

  function informationGain(rows, feature, labelKey) {
    const base = entropy(rows, labelKey);
    const groups = {};
    for (const r of rows) {
      const v = r[feature];
      if (!groups[v]) groups[v] = [];
      groups[v].push(r);
    }
    let rem = 0;
    for (const g of Object.values(groups)) {
      rem += (g.length / rows.length) * entropy(g, labelKey);
    }
    return { gain: base - rem, groups };
  }

  function isPure(rows, labelKey) {
    if (!rows.length) return true;
    const first = rows[0][labelKey];
    return rows.every((r) => r[labelKey] === first);
  }

  function buildTree(rows, features, labelKey, depth = 0, maxDepth = 4) {
    const featureKeys = features.map((f) => (typeof f === "string" ? f : f.key));
    const labelOf = (key) => {
      const m = features.find((f) => f.key === key);
      return m ? m.label : key;
    };

    if (!rows.length) return { type: "leaf", label: "?", count: 0 };
    if (isPure(rows, labelKey) || !featureKeys.length || depth >= maxDepth) {
      return { type: "leaf", label: majorityLabel(rows, labelKey), count: rows.length };
    }

    let bestFeature = null;
    let bestGain = -1;
    let bestGroups = null;
    for (const f of featureKeys) {
      const { gain, groups } = informationGain(rows, f, labelKey);
      if (gain > bestGain) {
        bestGain = gain;
        bestFeature = f;
        bestGroups = groups;
      }
    }

    if (!bestFeature || bestGain <= 0) {
      return { type: "leaf", label: majorityLabel(rows, labelKey), count: rows.length };
    }

    const remaining = features.filter((f) => f.key !== bestFeature);
    const children = {};
    for (const [value, group] of Object.entries(bestGroups)) {
      children[value] = buildTree(group, remaining, labelKey, depth + 1, maxDepth);
    }

    return {
      type: "node",
      feature: bestFeature,
      label: labelOf(bestFeature),
      gain: Number(bestGain.toFixed(3)),
      count: rows.length,
      children,
    };
  }

  function layoutTree(node, depth = 0) {
    if (!node) return null;
    if (node.type === "leaf") {
      return { ...node, width: 1, depth, childrenLaid: [] };
    }
    const entries = Object.entries(node.children || {}).map(([value, child]) => ({
      value,
      child: layoutTree(child, depth + 1),
    }));
    const width = Math.max(
      1,
      entries.reduce((s, e) => s + (e.child?.width || 1), 0)
    );
    return { ...node, width, depth, childrenLaid: entries };
  }

  function assignX(laid, x0, gap) {
    if (!laid) return;
    if (laid.type === "leaf" || !laid.childrenLaid.length) {
      laid.x = x0 + (laid.width * gap) / 2;
      return;
    }
    let cursor = x0;
    for (const e of laid.childrenLaid) {
      assignX(e.child, cursor, gap);
      cursor += e.child.width * gap;
    }
    const xs = laid.childrenLaid.map((e) => e.child.x);
    laid.x = (Math.min(...xs) + Math.max(...xs)) / 2;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderSvg(tree, opts = {}) {
    if (!tree) return "<p class='demo-empty'>Chưa có dữ liệu</p>";
    const positiveSet = new Set(opts.positiveLabels || ["Có"]);
    const activePath = Array.isArray(opts.activePath) ? opts.activePath.map(String) : [];
    const trackPath = Array.isArray(opts.activePath);
    const atLeaf = Boolean(opts.atLeaf);
    const laid = layoutTree(tree);
    const gap = opts.gap || 118;
    assignX(laid, gap * 0.5, gap);
    const maxDepth = (function walk(n, d) {
      if (!n || n.type === "leaf") return d;
      return Math.max(d, ...n.childrenLaid.map((e) => walk(e.child, d + 1)));
    })(laid, 0);

    const xs = [];
    (function collect(n) {
      if (!n) return;
      xs.push(n.x);
      (n.childrenLaid || []).forEach((e) => collect(e.child));
    })(laid);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const pad = 52;
    const W = Math.ceil(maxX - minX + pad * 2);
    const levelH = 58;
    const H = (maxDepth + 1) * levelH + 20;
    const shift = pad - minX;
    const yOf = (d) => 18 + d * levelH;

    const parts = [
      `<svg class="tree-svg example-tree-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img">`,
    ];

    function shortLabel(text) {
      const s = String(text || "");
      return s.length > 16 ? `${s.slice(0, 14)}…` : s;
    }

    /** matched = số cạnh đã khớp với activePath khi tới nút này; -1 = ngoài đường đi */
    function draw(n, parent, matched) {
      if (!n) return;
      const x = n.x + shift;
      const y = yOf(n.depth);
      let nodeState = "";
      let branchState = "";
      if (trackPath) {
        const onRoute = matched >= 0;
        const isCurrent = onRoute && matched === activePath.length;
        const isPast = onRoute && matched < activePath.length;
        nodeState = isCurrent ? " is-current" : isPast ? " is-on-path" : " is-dim";
        if (parent) {
          branchState = isCurrent
            ? " is-current"
            : onRoute
              ? " is-on-path"
              : " is-dim";
        }
      }

      if (parent) {
        const px = parent.x + shift;
        const py = yOf(parent.depth);
        const midY = (py + y) / 2;
        parts.push(
          `<path class="demo-branch${branchState}" d="M${px} ${py + 11} V${midY} H${x} V${y - 11}" />`
        );
        if (n._edge) {
          // Đặt nhãn gần cột xuống tới nút con; ≥3 nhánh thì 2 bên xích ra để giữa đỡ chật
          let labelX = x;
          const sibN = n._sibN || 1;
          const sibI = n._sibI || 0;
          if (sibN >= 3) {
            const mid = (sibN - 1) / 2;
            labelX = x + (sibI - mid) * 20;
          } else if (Math.abs(px - x) < 1) {
            labelX = x - 16;
          } else {
            labelX = (px + x) / 2;
          }
          const edgeCls =
            !trackPath
              ? "edge-label"
              : branchState.includes("is-dim")
                ? "edge-label is-dim"
                : "edge-label is-hot";
          parts.push(
            `<text class="${edgeCls}" x="${labelX}" y="${midY - 3}" style="font-size:10px">${escapeHtml(n._edge)}</text>`
          );
        }
      }

      if (n.type === "leaf") {
        const cls = positiveSet.has(n.label) ? "node-yes" : "node-no";
        const tw = 72;
        const isCurrent = nodeState.includes("is-current");
        const ring = isCurrent ? ` stroke="#0d9488" stroke-width="3"` : "";
        parts.push(
          `<rect class="${cls}${nodeState}" x="${x - tw / 2}" y="${y - 12}" width="${tw}" height="24" rx="6"${ring} />`
        );
        parts.push(
          `<text class="node-text on-dark${nodeState}" x="${x}" y="${y + 4}" style="font-size:10px">${escapeHtml(n.label)} (${n.count})</text>`
        );
      } else {
        const label = shortLabel(n.label);
        const tw = Math.min(120, 14 + label.length * 6.5);
        const isCurrent = nodeState.includes("is-current");
        const ring = isCurrent ? ` stroke="#0d9488" stroke-width="3"` : "";
        parts.push(
          `<rect class="node-mid${nodeState}" x="${x - tw / 2}" y="${y - 12}" width="${tw}" height="24" rx="6"${ring} />`
        );
        parts.push(
          `<text class="node-text${nodeState}" x="${x}" y="${y + 4}" style="font-size:10px">${escapeHtml(label)}</text>`
        );
        const kids = n.childrenLaid || [];
        kids.forEach((e, i) => {
          e.child._edge = e.value;
          e.child._sibI = i;
          e.child._sibN = kids.length;
          let childMatched = -1;
          if (trackPath && matched >= 0 && matched < activePath.length && activePath[matched] === String(e.value)) {
            childMatched = matched + 1;
          } else if (!trackPath) {
            childMatched = 0;
          }
          draw(e.child, n, childMatched);
        });
      }
    }

    draw(laid, null, 0);
    parts.push("</svg>");
    return parts.join("");
  }

  return { buildTree, renderSvg, escapeHtml };
})();
