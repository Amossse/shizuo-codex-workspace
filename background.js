// Service-worker composition root. Modules share one classic-script global realm.
importScripts(
  "card-protocol.js",
  "board-domain.js",
  "pagedock-db.js",
  "background/runtime-context.js",
  "background/collaboration.js",
  "background/native-bridge.js",
  "background/scheduler.js",
  "background/bridge-requests.js",
  "background/collection-router.js",
  "background/capture.js"
);
