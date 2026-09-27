/** Render LaTeX via KaTeX for elements with data-tex. */
window.renderDeckMath = function renderDeckMath(root) {
  if (typeof katex === "undefined") return;
  const scope = root || document;
  scope.querySelectorAll("[data-tex]").forEach((el) => {
    const tex = el.getAttribute("data-tex");
    if (tex == null || tex === "") return;
    const display =
      el.classList.contains("formula") || el.getAttribute("data-display") === "true";
    try {
      katex.render(tex, el, {
        throwOnError: false,
        displayMode: display,
        output: "html",
      });
    } catch (_) {
      /* keep empty / previous */
    }
  });
};
