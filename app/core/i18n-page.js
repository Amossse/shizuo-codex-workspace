// Run before application scripts. Only register nodes from the static HTML shell.
// Never observe/rewrite user text, AI output, editable values or later-added cards.
(function initializePageLanguage() {
  const bindings = [];
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement?.closest("script, style, textarea, [contenteditable]")) continue;
    const source = node.data.trim();
    if (Object.hasOwn(ShizuoEnglish, source)) bindings.push(() => {
      if (node.isConnected) node.data = node.data.replace(source, ui(source));
    });
  }
  for (const element of document.querySelectorAll("[title], [placeholder], [aria-label], [alt]")) {
    for (const name of ["title", "placeholder", "aria-label", "alt"]) {
      const source = element.getAttribute(name);
      if (source && Object.hasOwn(ShizuoEnglish, source)) bindings.push(() => {
        if (element.getAttribute(name) === source) element.setAttribute(name, ui(source));
      });
    }
  }
  ShizuoI18n.ready.then(() => {
    document.documentElement.lang = ShizuoI18n.language;
    bindings.forEach(apply => apply());
    for (const select of document.querySelectorAll("[data-language-select]")) {
      select.value = ShizuoI18n.language;
      select.addEventListener("change", async () => {
        const message = document.getElementById("languageNotice");
        select.disabled = true;
        try {
          await ShizuoI18n.setLanguage(select.value);
          message.textContent = ui("语言已保存；重新打开页面后生效，不会中断当前任务。");
        } catch {
          select.value = ShizuoI18n.language;
          message.textContent = ui("语言设置保存失败，请重试。");
        } finally { select.disabled = false; }
      });
    }
    document.documentElement.removeAttribute("data-language-loading");
  });
})();
