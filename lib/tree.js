/**
 * ID3-style decision tree — ví dụ: tham dự buổi thuyết trình Decision Tree.
 */

const FEATURES = [
  { key: "free", label: "Hôm nay rảnh?" },
  { key: "interest", label: "Thích chủ đề?" },
  { key: "mode", label: "Hình thức?" },
];

const LABEL_KEY = "attend";

function countLabels(rows) {
  const counts = {};
  for (const r of rows) {
    counts[r[LABEL_KEY]] = (counts[r[LABEL_KEY]] || 0) + 1;
  }
  return counts;
}

function majorityLabel(rows) {
  const counts = countLabels(rows);
  let best = "Có";
  let max = -1;
  for (const [label, n] of Object.entries(counts)) {
    if (n > max) {
      max = n;
      best = label;
    }
  }
  return best;
}

function entropy(rows) {
  if (!rows.length) return 0;
  const counts = countLabels(rows);
  let h = 0;
  for (const n of Object.values(counts)) {
    const p = n / rows.length;
    if (p > 0) h -= p * Math.log2(p);
  }
  return h;
}

function informationGain(rows, feature) {
  const base = entropy(rows);
  const groups = {};
  for (const r of rows) {
    const v = r[feature];
    if (!groups[v]) groups[v] = [];
    groups[v].push(r);
  }
  let rem = 0;
  for (const g of Object.values(groups)) {
    rem += (g.length / rows.length) * entropy(g);
  }
  return { gain: base - rem, groups };
}

function isPure(rows) {
  if (!rows.length) return true;
  const first = rows[0][LABEL_KEY];
  return rows.every((r) => r[LABEL_KEY] === first);
}

function buildTree(rows, features = FEATURES.map((f) => f.key), depth = 0, maxDepth = 4) {
  if (!rows.length) {
    return { type: "leaf", label: "?", count: 0 };
  }
  if (isPure(rows) || !features.length || depth >= maxDepth) {
    return {
      type: "leaf",
      label: majorityLabel(rows),
      count: rows.length,
    };
  }

  let bestFeature = null;
  let bestGain = -1;
  let bestGroups = null;

  for (const f of features) {
    const { gain, groups } = informationGain(rows, f);
    if (gain > bestGain) {
      bestGain = gain;
      bestFeature = f;
      bestGroups = groups;
    }
  }

  if (!bestFeature || bestGain <= 0) {
    return {
      type: "leaf",
      label: majorityLabel(rows),
      count: rows.length,
    };
  }

  const meta = FEATURES.find((f) => f.key === bestFeature);
  const remaining = features.filter((f) => f !== bestFeature);
  const children = {};
  for (const [value, group] of Object.entries(bestGroups)) {
    children[value] = buildTree(group, remaining, depth + 1, maxDepth);
  }

  return {
    type: "node",
    feature: bestFeature,
    label: meta ? meta.label : bestFeature,
    gain: Number(bestGain.toFixed(3)),
    count: rows.length,
    children,
  };
}

/** 3 người có sẵn thông tin — mỗi người một bộ khác nhau */
function seedRows() {
  return [
    {
      id: "s1",
      name: "Luân",
      free: "Bận",
      interest: "Có",
      mode: "Offline",
      attend: "Không",
    },
    {
      id: "s2",
      name: "Thông",
      free: "Rảnh",
      interest: "Có",
      mode: "Online",
      attend: "Có",
    },
    {
      id: "s3",
      name: "Kiên",
      free: "Rảnh",
      interest: "Không",
      mode: "Offline",
      attend: "Không",
    },
  ];
}

module.exports = { FEATURES, LABEL_KEY, buildTree, seedRows, majorityLabel };
