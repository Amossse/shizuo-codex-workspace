// Module: shared service-worker state, constants, and event snapshots.
const CAPTURE_KEY = "__page_capture__";
const MARKDOWN_REQUEST = "capture-markdown";
const SCREENSHOT_REQUEST = "capture-screenshot";
const CODEX_PAGE_CONTEXT_REQUEST = "pagedock-codex-page-context";
const PAGE_CARD_CONTEXT_REQUEST = "pagedock-page-card-context";
const CODEX_STATUS_REQUEST = "pagedock-codex-status";
const CODEX_RUN_REQUEST = "pagedock-codex-run";
const CODEX_CANCEL_REQUEST = "pagedock-codex-cancel";
const CODEX_SESSION_LIST_REQUEST = "pagedock-codex-session-list";
const CODEX_SESSION_PREVIEW_REQUEST = "pagedock-codex-session-preview";
const PAGE_CHAT_GET_REQUEST = "pagedock-page-chat-get";
const PAGE_CHAT_PUT_REQUEST = "pagedock-page-chat-put";
const PAGE_CHAT_DELETE_REQUEST = "pagedock-page-chat-delete";
const TASK_SCHEDULE_SYNC_REQUEST = "pagedock-task-schedule-sync";
const BRIDGE_SHARE_CREATE_REQUEST = "pagedock-bridge-share-create";
const BRIDGE_SHARE_STOP_REQUEST = "pagedock-bridge-share-stop";
const BRIDGE_CLIENT_REVOKE_REQUEST = "pagedock-bridge-client-revoke";
const BRIDGE_APPROVAL_RESPONSE = "pagedock-bridge-approval-response";
const BRIDGE_CLIENT_POLICY_REQUEST = "pagedock-bridge-client-policy";
const COLLABORATION_STORAGE_KEY = "__pagedock_collaboration_v1__";
const AI_RUNTIME_STORAGE_KEY = "__pagedock_ai_runtime_v1__";
const CODEX_EVENT = "pagedock-codex-event";
const TERMINAL_RUN_REQUEST = "pagedock-terminal-run";
const TERMINAL_CANCEL_REQUEST = "pagedock-terminal-cancel";
const TERMINAL_SESSION_OPEN_REQUEST = "pagedock-terminal-session-open";
const TERMINAL_SESSION_INPUT_REQUEST = "pagedock-terminal-session-input";
const TERMINAL_SESSION_RESIZE_REQUEST = "pagedock-terminal-session-resize";
const TERMINAL_SESSION_CLOSE_REQUEST = "pagedock-terminal-session-close";
const TERMINAL_EVENT = "pagedock-terminal-event";
const CODEX_NATIVE_HOST = "com.pagedock.codex";
const CODEX_PLUGIN_REQUEST = "plugin-request";
const CODEX_PLUGIN_RESPONSE = "plugin-response";
const PAGE_CODEX_PORT = "pagedock-page-codex";
const CODEX_AUTO_CONNECT_ALARM = "pagedock-codex-auto-connect";
const TASK_SCHEDULE_ALARM_PREFIX = "pagedock-task-schedule:";
const CODEX_RECONNECT_DELAY_MS = 5_000;
const CODEX_PAGE_CONTENT_LIMIT = 600_000;
const CODEX_MAX_CONCURRENT_TASKS = 3;
const SCHEDULED_IMAGE_CHUNK_LIMIT = 96;
const SCHEDULED_VIDEO_CHUNK_LIMIT = 256;
const EXTERNAL_CODEX_PRESENCE_TIMEOUT_MS = 45_000;
const EXTERNAL_CODEX_APPROVAL_TIMEOUT_MS = 45_000;
const EXTERNAL_CODEX_ACTIVITY_LIMIT = 500;
const EXTERNAL_CODEX_TASK_LIMIT = 50;
const STITCH_INIT_REQUEST = "init-screenshot-stitch";
const STITCH_TILE_REQUEST = "add-screenshot-tile";
const STITCH_REQUEST = "stitch-screenshot-tiles";
const SCREENSHOT_RENDER_SETTLE_MS = 600;
const CONTEXT_MENU_PREFIX = "pagedock-save";
const RECENT_BOARD_LIMIT = 3;
const activeTasks = new Set();
let contextMenuRefresh;
let codexNativePort;
let codexConnectPromise;
let codexReconnectTimer;
let nativeHostReady = false;
let nativeHostVersion = "";
let codexReady = false;
let agyReady = false;
let aiRuntime = "codex";
let hyperframesAvailable = false;
let remotionAvailable = false;
const codexActiveTaskIds = new Set();
const scheduledCodexRuns = new Map();
const scheduledWorkflowControllers = new Map();
const scheduledBoardWrites = new Map();
const terminalActiveTaskIds = new Set();
const terminalSessionIds = new Set();
const pageCodexPorts = new Set();
const nativeControlRequests = new Map();
const externalApprovalRequests = new Map();
const externalCodexClients = new Map();
const externalCodexPresence = new Map();
const externalCodexActivities = [];
const externalCodexTasks = [];
const externalBoardChanges = [];
const externalSessionGrants = new Set();
const externalCollaborationWatchers = new Set();
let externalClientPolicies = {};
let externalCollaborationMessages = [];
let externalCollaborationSequence = 0;
let collaborationStatePromise;
let collaborationPersistQueue = Promise.resolve();
let codexLastEvent;
const codexRecentTerminalEvents = new Map();
let terminalAvailable = false;
let terminalPtyAvailable = false;
let terminalWorkspace = "";
let externalBridgeEnabled = false;
let externalCodexConnected = false;
let externalCodexLastSeenAt = 0;
let externalCodexScope = "disabled";
let externalCodexStatusTimer;
let externalBridgePort = 0;
let localCodexSessionStatus = {
  active: false,
  activeCount: 0,
  threadId: "",
  title: "",
  startedAt: 0,
  updatedAt: 0
};

function normalizeLocalCodexSessionStatus(status = {}) {
  return {
    active: Boolean(status.active),
    activeCount: Math.max(0, Number(status.activeCount) || 0),
    threadId: String(status.threadId || ""),
    title: String(status.title || ""),
    startedAt: Math.max(0, Number(status.startedAt) || 0),
    updatedAt: Math.max(0, Number(status.updatedAt) || 0)
  };
}

function normalizeAiRuntime(value) {
  return value === "agy" ? "agy" : "codex";
}

function runtimeReady(runtime = aiRuntime) {
  return normalizeAiRuntime(runtime) === "agy" ? agyReady : codexReady;
}

function rememberCodexTerminalEvent(event) {
  if (!event?.id || !["done", "error", "cancelled"].includes(event.type)) return;
  const id = String(event.id);
  codexRecentTerminalEvents.delete(id);
  codexRecentTerminalEvents.set(id, event);
  while (codexRecentTerminalEvents.size > 50) {
    codexRecentTerminalEvents.delete(codexRecentTerminalEvents.keys().next().value);
  }
  codexLastEvent = event;
}

function codexSnapshot(runtime = aiRuntime, taskId = "") {
  runtime = normalizeAiRuntime(runtime);
  const activeTaskIds = [...codexActiveTaskIds, ...terminalActiveTaskIds];
  return {
    ready: runtimeReady(runtime),
    runtime,
    runtimes: { codex: codexReady, agy: agyReady },
    // 保留 activeTaskId，兼容旧版页面；新版以 activeTaskIds 区分每个并发任务。
    activeTaskId: activeTaskIds[0] || "",
    activeTaskIds,
    codexTaskIds: [...codexActiveTaskIds],
    terminalTaskIds: [...terminalActiveTaskIds],
    terminalSessionIds: [...terminalSessionIds],
    maxConcurrentTasks: CODEX_MAX_CONCURRENT_TASKS,
    terminalReady: nativeHostReady && terminalAvailable && terminalPtyAvailable,
    terminalWorkspace,
    externalBridgeEnabled,
    externalCodexConnected,
    externalCodexLastSeenAt,
    externalCodexScope,
    health: {
      extension: true,
      nativeHost: nativeHostReady,
      nativeHostVersion,
      codex: codexReady,
      agy: agyReady,
      terminal: nativeHostReady && terminalAvailable && terminalPtyAvailable,
      hyperframes: nativeHostReady && hyperframesAvailable,
      remotion: nativeHostReady && remotionAvailable,
      bridge: externalBridgeEnabled,
      bridgeScope: externalCodexScope,
      bridgePort: externalBridgePort
    },
    externalCodexClients: [...externalCodexClients.values()],
    externalCodexPresence: [...externalCodexPresence.values()],
    externalCodexActivities: externalCodexActivities.map(activity => ({ ...activity })),
    externalCodexTasks: externalCodexTasks.map(task => ({ ...task })),
    localCodexSessionStatus: { ...localCodexSessionStatus },
    externalCodexApprovals: [...externalApprovalRequests.values()].map(pending => ({ ...pending.approval })),
    externalClientPolicies: { ...externalClientPolicies },
    externalCollaborationMessages: externalCollaborationMessages.map(message => ({ ...message })),
    lastEvent: codexLastEvent,
    // 页面可能在终态事件到达时短暂重连；按任务缓存可恢复结果，避免永久停在 loading。
    taskEvent: taskId ? codexRecentTerminalEvents.get(String(taskId)) : undefined
  };
}

chrome.storage.local.get(AI_RUNTIME_STORAGE_KEY).then(stored => {
  aiRuntime = normalizeAiRuntime(stored[AI_RUNTIME_STORAGE_KEY]);
}).catch(() => {});
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[AI_RUNTIME_STORAGE_KEY]) {
    aiRuntime = normalizeAiRuntime(changes[AI_RUNTIME_STORAGE_KEY].newValue);
  }
});

function broadcastCodexEvent(event) {
  const message = { type: CODEX_EVENT, event };
  chrome.runtime.sendMessage(message).catch(() => {});
  for (const port of pageCodexPorts) {
    try { port.postMessage(message); } catch { pageCodexPorts.delete(port); }
  }
}

function broadcastTerminalEvent(event) {
  chrome.runtime.sendMessage({ type: TERMINAL_EVENT, event }).catch(() => {});
}

function broadcastExternalCodexStatus() {
  broadcastCodexEvent({
    type: "external-codex-status",
    connected: externalCodexConnected,
    lastSeenAt: externalCodexLastSeenAt,
    scope: externalCodexScope,
    clients: [...externalCodexClients.values()],
    presence: [...externalCodexPresence.values()]
  });
}
