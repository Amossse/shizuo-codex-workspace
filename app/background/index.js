// Service-worker composition root. Modules share one classic-script global realm.
importScripts(
  "../core/i18n-en.js",
  "../core/i18n-en-extended.js",
  "../core/i18n.js",
  "../core/card-protocol.js",
  "../core/board-domain.js",
  "../core/pagedock-db.js",
  "modules/runtime-context.js",
  "modules/collaboration.js",
  "modules/native-bridge.js",
  "modules/scheduler.js",
  "modules/bridge-requests.js",
  "modules/collection-router.js",
  "modules/capture.js"
);

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
  if (message?.type !== "shizuo-language-get") return;
  ShizuoI18n.ready.then(() => respond({ language: ShizuoI18n.language }));
  return true;
});
