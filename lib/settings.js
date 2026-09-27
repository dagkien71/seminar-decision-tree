const fs = require("fs");
const path = require("path");

const SETTINGS_PATH = path.join(__dirname, "..", "data", "settings.json");

const DEFAULT_SETTINGS = {
  // ẩn mặc định — bật lại ở /setting nếu cần
  hidden: ["learning", "entropy-map", "gini-map", "live-demo"],
  texts: {},
};

function ensureDir() {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function loadSettings() {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return {
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden.map(String) : [],
      texts:
        parsed.texts && typeof parsed.texts === "object" && !Array.isArray(parsed.texts)
          ? parsed.texts
          : {},
    };
  } catch {
    return { ...DEFAULT_SETTINGS, texts: {} };
  }
}

function saveSettings(next) {
  ensureDir();
  const cleaned = {
    hidden: Array.isArray(next.hidden)
      ? [...new Set(next.hidden.map(String).filter(Boolean))]
      : [],
    texts:
      next.texts && typeof next.texts === "object" && !Array.isArray(next.texts)
        ? next.texts
        : {},
  };
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(cleaned, null, 2), "utf8");
  return cleaned;
}

function resetSettings() {
  ensureDir();
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(DEFAULT_SETTINGS, null, 2), "utf8");
  return { ...DEFAULT_SETTINGS, texts: {} };
}

module.exports = {
  SETTINGS_PATH,
  loadSettings,
  saveSettings,
  resetSettings,
  DEFAULT_SETTINGS,
};
