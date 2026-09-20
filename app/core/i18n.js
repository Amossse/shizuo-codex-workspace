(function initializeLanguage(global) {
  "use strict";
  if (global.ShizuoI18n) return;
  const KEY = "__shizuo_language_v1__";
  const supported = value => value === "en" || value === "zh-CN";
  let language = "en";
  const format = (text, values) => text.replace(/\{(\d+)\}/g, (match, index) => index < values.length ? String(values[index]) : match);
  const t = (text, ...values) => format(language === "en" ? global.ShizuoEnglish?.[text] ?? text : text, values);

  // Migration is read-only: never open/create a database just to detect an old install.
  async function initialize() {
    try {
      const stored = await global.chrome.storage.local.get(null);
      if (supported(stored[KEY])) language = stored[KEY];
      else if (global.document && /^https?:$/.test(global.location?.protocol || "")) {
        // Content scripts must not inspect a website's IndexedDB or decide installation migration.
        const result = await global.chrome.runtime.sendMessage({ type: "shizuo-language-get" });
        if (supported(result?.language)) language = result.language;
      }
      else {
        const databases = await global.indexedDB?.databases?.() || [];
        const legacy = databases.some(database => database.name === "pagedock")
          || Object.keys(stored).some(key => key.startsWith("__pagedock_") || key === "__whiteboard_state__");
        language = legacy ? "zh-CN" : "en";
        await global.chrome.storage.local.set({ [KEY]: language });
      }
    } catch (error) {
      console.warn("[shizuo-i18n] Could not load language preference", error?.name || "Error");
    }
    return language;
  }

  async function setLanguage(value) {
    if (!supported(value)) throw new TypeError("Unsupported language");
    await global.chrome.storage.local.set({ [KEY]: value });
    // Apply to new pages, not the current document: reloading could lose an edit or task.
    return value;
  }

  global.ShizuoI18n = { KEY, t, setLanguage, get language() { return language; } };
  global.ui = t;
  global.ShizuoI18n.ready = initialize();
  // Service-worker labels should follow changes without restarting the worker.
  if (!global.document) global.chrome?.storage?.onChanged?.addListener((changes, area) => {
    if (area === "local" && supported(changes[KEY]?.newValue)) language = changes[KEY].newValue;
  });
})(globalThis);
