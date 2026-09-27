/** Shared editable text selectors for slides (browser + settings page). */
window.SLIDE_EDITABLE_SELECTOR = [
  ".lead",
  ".calc-lead",
  ".demo-lead",
  ".meaning-q",
  ".meaning-note",
  ".meaning-ex > li",
  ".tree-walk > li",
  ".formula-block > p",
  ".formula-tag",
  ".formula-sub",
  ".formula-general",
  ".formula-how > li",
  ".symbol-legend > li",
  ".map-bind > li",
  ".map-card > h3",
  ".map-callout",
  ".callout",
  ".note",
  ".apps-hint",
  ".card-label",
  ".mini",
  ".demo-join-label",
  ".agenda > li",
  ".struct-list > li",
  ".end-points > li",
  ".summary-box li",
  ".calc-steps > p",
  ".calc-card > h3",
  ".calc-wide > h3",
  ".card > h3",
  ".card > p",
  ".summary-box > h3",
  ".demo-panel > h3",
  ".apps > .app",
  ".meaning-box > h3",
].join(", ");

window.getSlideEditableElements = function getSlideEditableElements(slide) {
  const sel = window.SLIDE_EDITABLE_SELECTOR;
  return [...slide.querySelectorAll(sel)].filter((el) => {
    if (el.closest("svg")) return false;
    if (el.id === "share-url" || el.classList.contains("qr-url")) return false;
    if (el.id === "demo-join-url" || el.classList.contains("demo-join-url")) return false;
    if (el.closest(".balls")) return false;
    return true;
  });
};

window.applySlideTexts = function applySlideTexts(slide, texts) {
  if (!texts || typeof texts !== "object") return;
  window.getSlideEditableElements(slide).forEach((el, i) => {
    const key = `t${i}`;
    if (Object.prototype.hasOwnProperty.call(texts, key) && texts[key] != null) {
      el.innerHTML = String(texts[key]);
    }
  });
};
