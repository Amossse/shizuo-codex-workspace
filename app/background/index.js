// Service-worker composition root. Modules share one classic-script global realm.
importScripts(
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
