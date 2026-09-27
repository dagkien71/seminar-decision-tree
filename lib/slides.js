const fs = require("fs");
const path = require("path");
const { loadSettings } = require("./settings");

const INDEX_PATH = path.join(__dirname, "..", "index.html");

function listVisibleSlides() {
  const html = fs.readFileSync(INDEX_PATH, "utf8");
  const settings = loadSettings();
  const hidden = new Set(Array.isArray(settings.hidden) ? settings.hidden.map(String) : []);
  const slides = [];
  const re = /<section class="slide[^"]*"\s+data-slide-id="([^"]*)"\s+data-title="([^"]*)"/g;
  let m;
  while ((m = re.exec(html))) {
    const id = m[1];
    const title = m[2]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");
    if (hidden.has(id)) continue;
    slides.push({
      id,
      title,
      index: slides.length,
      number: slides.length + 1,
    });
  }
  return slides;
}

module.exports = { listVisibleSlides };
