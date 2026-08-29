importScripts("card-protocol.js", "board-domain.js", "pagedock-db.js");

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

function ensureCollaborationState() {
  if (collaborationStatePromise) return collaborationStatePromise;
  collaborationStatePromise = chrome.storage.local.get(COLLABORATION_STORAGE_KEY).then(stored => {
    const state = stored[COLLABORATION_STORAGE_KEY] || {};
    externalCollaborationSequence = Math.max(0, Number(state.sequence) || 0);
    externalClientPolicies = state.policies && typeof state.policies === "object" ? state.policies : {};
    externalCollaborationMessages = Array.isArray(state.messages) ? state.messages.slice(-200) : [];
    const activities = Array.isArray(state.activities) ? state.activities.slice(-500).reverse() : [];
    const tasks = Array.isArray(state.tasks) ? state.tasks.slice(-EXTERNAL_CODEX_TASK_LIMIT).reverse() : [];
    // 旧版本没有事件序号；升级时补齐，避免长轮询永远看不到历史尾部。
    for (const entry of [...externalCollaborationMessages, ...activities, ...tasks]) {
      if (!Number(entry.sequence)) entry.sequence = ++externalCollaborationSequence;
      else externalCollaborationSequence = Math.max(externalCollaborationSequence, Number(entry.sequence));
    }
    externalCodexActivities.splice(0, externalCodexActivities.length, ...activities);
    externalCodexTasks.splice(0, externalCodexTasks.length, ...tasks);
  }).catch(error => console.warn("[shizuo-bridge] collaboration state load failed", { reason: error?.message || String(error) }));
  return collaborationStatePromise;
}

function persistCollaborationState() {
  collaborationPersistQueue = collaborationPersistQueue.catch(() => {}).then(() => chrome.storage.local.set({
    [COLLABORATION_STORAGE_KEY]: {
      policies: externalClientPolicies,
      messages: externalCollaborationMessages.slice(-200),
      activities: [...externalCodexActivities].reverse().slice(-500),
      tasks: [...externalCodexTasks].reverse().slice(-EXTERNAL_CODEX_TASK_LIMIT),
      sequence: externalCollaborationSequence,
      updatedAt: Date.now()
    }
  }));
  return collaborationPersistQueue.catch(error => {
    console.warn("[shizuo-bridge] collaboration state save failed", { reason: error?.message || String(error) });
  });
}

function scheduleExternalCollaborationCleanup() {
  clearTimeout(externalCodexStatusTimer);
  const expiries = [...externalCodexPresence.values()]
    .map(presence => Number(presence.updatedAt) + EXTERNAL_CODEX_PRESENCE_TIMEOUT_MS)
    .filter(Number.isFinite);
  if (!expiries.length) return;
  const delay = Math.max(25, Math.min(...expiries) - Date.now() + 10);
  externalCodexStatusTimer = setTimeout(() => {
    const now = Date.now();
    for (const [id, entry] of externalCodexPresence) {
      if (Number(entry.updatedAt) + EXTERNAL_CODEX_PRESENCE_TIMEOUT_MS <= now) externalCodexPresence.delete(id);
    }
    // Codex 接入状态不因空闲过期；仅光标和选区需要清理，避免画布残留旧位置。
    broadcastExternalCodexStatus();
    scheduleExternalCollaborationCleanup();
  }, delay);
}

function markExternalCodexConnected(remote = {}) {
  const scope = remote.lan ? "lan" : "local";
  const clientType = remote.clientType === "human" ? "human" : "codex";
  const fallbackName = clientType === "human" ? "协作者" : "Codex";
  const clientName = boundedRemoteText(remote.clientName || fallbackName, 80).replace(/[\r\n\t]/g, " ").trim() || fallbackName;
  const clientId = String(remote.clientId || `${scope}:${String(remote.address || "unknown")}:${clientName}`);
  const client = { id: clientId, name: clientName, type: clientType, scope, boardId: String(remote.boardId || ""), lastSeenAt: Date.now() };
  externalCodexClients.set(clientId, client);
  externalCodexConnected = true;
  externalCodexLastSeenAt = client.lastSeenAt;
  externalCodexScope = scope;
  console.info("[shizuo-bridge] external Codex connected", {
    scope: externalCodexScope,
    clientName,
    lastSeenAt: externalCodexLastSeenAt
  });
  broadcastExternalCodexStatus();
  scheduleExternalCollaborationCleanup();
  return client;
}

function nextCollaborationSequence() {
  externalCollaborationSequence += 1;
  return externalCollaborationSequence;
}

function wakeCollaborationWatchers() {
  for (const resolve of externalCollaborationWatchers) resolve();
  externalCollaborationWatchers.clear();
}

function recordExternalBoardChange(boardIds, itemId = "", reason = "") {
  for (const boardId of [...new Set((boardIds || []).map(String).filter(Boolean))]) {
    externalBoardChanges.push({
      boardId,
      itemId: String(itemId || ""),
      reason: boundedRemoteText(reason, 120),
      sequence: nextCollaborationSequence(),
      updatedAt: Date.now()
    });
  }
  externalBoardChanges.splice(0, Math.max(0, externalBoardChanges.length - 100));
  wakeCollaborationWatchers();
}

function collaborationEventsAfter(after, boardId = "") {
  return [
    ...externalBoardChanges.map(change => ({ type: "board", sequence: change.sequence, boardId: change.boardId, change })),
    ...externalCodexActivities.map(activity => ({ type: "activity", sequence: Number(activity.sequence) || 0, boardId: activity.boardId, activity })),
    ...externalCodexTasks.map(task => ({ type: "task", sequence: Number(task.sequence) || 0, boardId: task.boardId, task })),
    ...externalCollaborationMessages.map(message => ({ type: "message", sequence: Number(message.sequence) || 0, boardId: message.boardId, message })),
    ...[...externalCodexPresence.values()].map(presence => ({ type: "presence", sequence: Number(presence.sequence) || 0, boardId: presence.boardId, presence }))
  ]
    .filter(event => event.sequence > after && (!boardId || event.boardId === boardId))
    .sort((left, right) => left.sequence - right.sequence)
    .slice(-100);
}

async function watchCollaboration(after, boardId, timeoutMs) {
  let events = collaborationEventsAfter(after, boardId);
  if (!events.length) {
    await new Promise(resolve => {
      let timer;
      const finish = () => {
        clearTimeout(timer);
        externalCollaborationWatchers.delete(finish);
        resolve();
      };
      timer = setTimeout(finish, timeoutMs);
      externalCollaborationWatchers.add(finish);
    });
    events = collaborationEventsAfter(after, boardId);
  }
  return { cursor: externalCollaborationSequence, events };
}

function updateExternalPresence(presence) {
  const clientId = String(presence?.client?.id || "");
  if (!clientId) return;
  const next = { ...presence, sequence: nextCollaborationSequence(), updatedAt: Number(presence.updatedAt) || Date.now() };
  externalCodexPresence.set(clientId, next);
  broadcastCodexEvent({ type: "external-codex-presence", presence: next });
  wakeCollaborationWatchers();
  scheduleExternalCollaborationCleanup();
}

const EXTERNAL_CODEX_TASK_PHASES = new Set(["started", "running", "waiting_approval", "completed", "failed", "cancelled"]);

async function reportExternalCodexTask(params, capabilities, assertBoardScope) {
  await ensureCollaborationState();
  const client = capabilities.remoteClient;
  if (!client?.id) throw new Error("缺少 Codex 接入者身份");
  const taskId = boundedRemoteText(params.taskId, 120).replace(/[\r\n\t]/g, " ").trim();
  if (!taskId) throw new Error("任务状态缺少 taskId");
  const phase = String(params.phase || "");
  if (!EXTERNAL_CODEX_TASK_PHASES.has(phase)) throw new Error("不支持的 Codex 任务状态");
  const boardId = String(params.boardId || capabilities.boardScopeId || "");
  assertBoardScope(boardId);
  const id = `${client.id}:${taskId}`;
  const existingIndex = externalCodexTasks.findIndex(task => task.id === id);
  const previous = existingIndex >= 0 ? externalCodexTasks[existingIndex] : {};
  const revision = params.revision !== undefined && Number.isInteger(Number(params.revision)) ? Math.max(0, Number(params.revision)) : null;
  // 外部 Codex 断线重试时可能重复上报；revision 防止旧进度覆盖新的结果。
  if (revision !== null && Number.isInteger(previous.revision) && revision <= previous.revision) {
    return { task: { ...previous }, ignored: true };
  }
  if (["completed", "failed", "cancelled"].includes(previous.phase) && !["completed", "failed", "cancelled"].includes(phase)) {
    throw new Error("已结束的 Codex 任务不能重新进入运行态，请使用新的 taskId");
  }
  const rawProgress = Number(params.progress);
  const progress = params.progress !== undefined && params.progress !== null && Number.isFinite(rawProgress)
    ? Math.min(100, Math.max(0, rawProgress))
    : (phase === "completed" ? 100 : previous.progress ?? null);
  const terminal = ["completed", "failed", "cancelled"].includes(phase);
  const task = {
    ...previous,
    id,
    taskId,
    boardId,
    client: { id: client.id, name: client.name, type: client.type, scope: client.scope },
    title: boundedRemoteText(params.title, 160) || previous.title || "Codex 任务",
    phase,
    message: boundedRemoteText(params.message, 1_000),
    progress,
    result: params.result === undefined ? previous.result || "" : boundedRemoteText(params.result, 12_000),
    cardIds: (Array.isArray(params.cardIds) ? params.cardIds : previous.cardIds || []).map(String).filter(Boolean).slice(0, 20),
    revision: revision ?? (Number(previous.revision) || 0) + 1,
    sequence: nextCollaborationSequence(),
    createdAt: previous.createdAt || Date.now(),
    updatedAt: Date.now(),
    completedAt: terminal ? Date.now() : null
  };
  if (existingIndex >= 0) externalCodexTasks.splice(existingIndex, 1);
  externalCodexTasks.unshift(task);
  externalCodexTasks.splice(EXTERNAL_CODEX_TASK_LIMIT);
  await persistCollaborationState();
  wakeCollaborationWatchers();
  broadcastCodexEvent({ type: "external-codex-task", task });
  console.info("[shizuo-bridge] external Codex task reported", {
    clientId: client.id,
    taskId,
    phase,
    progress
  });
  return { task };
}

const EXTERNAL_METHOD_LABELS = Object.freeze({
  "boards.list": "查看白板列表",
  "boards.get": "读取白板",
  "boards.create": "创建白板",
  "cards.create": "创建卡片",
  "cards.update": "更新卡片",
  "cards.connect": "连接卡片",
  "cards.stream": "渐进生成卡片",
  "cards.search": "搜索白板卡片",
  "collaboration.list": "查看协作消息",
  "collaboration.send": "发送协作消息",
  "collaboration.presence": "更新协作位置",
  "collaboration.watch": "等待协作事件",
  "collaboration.task": "上报任务状态",
  "cards.delete": "删除卡片"
});

function externalOperationSummary(method, params = {}) {
  if (method === "boards.create") return boundedRemoteText(params.name || "新白板", 80);
  if (method === "cards.create") {
    const card = params.card && typeof params.card === "object" ? params.card : {};
    return boundedRemoteText(card.text || card.alt || card.src || card.type || "新卡片", 100).replace(/\s+/g, " ");
  }
  if (method === "cards.update") return `更新 ${Object.keys(params.patch || {}).slice(0, 6).join("、") || "卡片内容"}`;
  if (method === "cards.connect") return "建立卡片内容连线";
  if (method === "cards.stream") return boundedRemoteText(params.text, 100).replace(/\s+/g, " ");
  if (method === "collaboration.send") return boundedRemoteText(params.text, 100).replace(/\s+/g, " ");
  if (method === "cards.delete") return `删除 ${(params.cardIds || []).length || 1} 张卡片`;
  return "";
}

function recordExternalCodexActivity(message, client, phase, details = {}) {
  const requestId = String(message.requestId || "");
  const method = String(message.method || "");
  const params = message.params && typeof message.params === "object" ? message.params : {};
  const existingIndex = externalCodexActivities.findIndex(activity => activity.requestId === requestId);
  const previous = existingIndex >= 0 ? externalCodexActivities.splice(existingIndex, 1)[0] : {};
  const result = details.result && typeof details.result === "object" ? details.result : {};
  const activity = {
    ...previous,
    requestId,
    method,
    label: EXTERNAL_METHOD_LABELS[method] || "操作白板",
    summary: externalOperationSummary(method, params),
    phase,
    sequence: nextCollaborationSequence(),
    client: { id: client.id, name: client.name, scope: client.scope },
    boardId: String(params.boardId || (method === "boards.create" ? result.id : result.boardId) || previous.boardId || ""),
    cardId: String(params.cardId || params.targetCardId || (method.startsWith("cards.") ? result.id : "") || previous.cardId || ""),
    error: boundedRemoteText(details.error, 300),
    createdAt: previous.createdAt || Date.now(),
    updatedAt: Date.now()
  };
  externalCodexActivities.unshift(activity);
  externalCodexActivities.splice(EXTERNAL_CODEX_ACTIVITY_LIMIT);
  void persistCollaborationState();
  wakeCollaborationWatchers();
  broadcastCodexEvent({ type: "external-codex-activity", activity });
  return activity;
}

function requestExternalMutationApproval(message, client) {
  const approvalId = crypto.randomUUID();
  const activity = recordExternalCodexActivity(message, client, "approval");
  const approval = {
    id: approvalId,
    requestId: String(message.requestId || ""),
    client: activity.client,
    method: activity.method,
    label: activity.label,
    summary: activity.summary,
    boardId: activity.boardId,
    cardId: activity.cardId,
    createdAt: Date.now(),
    expiresAt: Date.now() + EXTERNAL_CODEX_APPROVAL_TIMEOUT_MS
  };
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      externalApprovalRequests.delete(approvalId);
      reject(new Error("等待白板用户确认超时"));
    }, EXTERNAL_CODEX_APPROVAL_TIMEOUT_MS);
    externalApprovalRequests.set(approvalId, { resolve, reject, timer, requestId: message.requestId, approval });
    broadcastCodexEvent({
      type: "external-codex-approval",
      approval
    });
  });
}

function boundedRemoteText(value, limit = 50_000) {
  const text = String(value || "");
  return text.length > limit ? `${text.slice(0, limit)}\n\n[内容已截断]` : text;
}

function remoteItemSnapshot(item) {
  const source = item?.source && typeof item.source === "object"
    ? {
        url: boundedRemoteText(item.source.url, 4_000),
        title: boundedRemoteText(item.source.title, 500),
        capturedAt: Number(item.source.capturedAt) || 0
      }
    : null;
  const src = String(item?.src || "");
  return {
    id: String(item?.id || ""),
    boardId: String(item?.boardId || ""),
    type: String(item?.type || "text"),
    filename: boundedRemoteText(item?.filename, 500),
    text: boundedRemoteText(item?.text),
    src: src.startsWith("data:") ? "" : boundedRemoteText(src, 8_000),
    embeddedContentOmitted: src.startsWith("data:"),
    alt: boundedRemoteText(item?.alt, 2_000),
    pageContent: boundedRemoteText(item?.pageContent),
    x: Number(item?.x) || 0,
    y: Number(item?.y) || 0,
    width: Number(item?.width) || 320,
    height: Number(item?.height) || 120,
    documentLanguage: boundedRemoteText(item?.documentLanguage, 80),
    taskStatus: boundedRemoteText(item?.taskStatus, 40),
    taskResult: boundedRemoteText(item?.taskResult),
    taskError: boundedRemoteText(item?.taskError, 4_000),
    taskWorkflowRole: boundedRemoteText(item?.taskWorkflowRole, 20),
    taskWorkflowMode: boundedRemoteText(item?.taskWorkflowMode, 20),
    taskVideoEngine: item?.taskVideoEngine === "remotion" ? "remotion" : "hyperframes",
    taskWorkflowTitle: boundedRemoteText(item?.taskWorkflowTitle, 80),
    taskWorkflowLens: PageDockBoardDomain.workflowLens(item?.taskWorkflowLens).id,
    taskSchedule: PageDockBoardDomain.normalizeTaskSchedule(item?.taskSchedule),
    taskMessages: (Array.isArray(item?.taskMessages) ? item.taskMessages : []).slice(-20).map(message => ({
      id: String(message?.id || ""),
      role: message?.role === "user" ? "user" : "assistant",
      text: boundedRemoteText(message?.text, 20_000),
      createdAt: Number(message?.createdAt) || 0
    })),
    relationSourceIds: (Array.isArray(item?.relationSourceIds) ? item.relationSourceIds : []).map(String).slice(0, 100),
    revision: Math.max(1, Number(item?.revision) || 1),
    provenance: item?.provenance ? {
      version: 1,
      operation: boundedRemoteText(item.provenance.operation, 80),
      template: item.provenance.template ? { id: String(item.provenance.template.id || ""), name: boundedRemoteText(item.provenance.template.name, 80) } : null,
      parents: (Array.isArray(item.provenance.parents) ? item.provenance.parents : [])
        .filter(parent => parent?.kind === "external" || !parent?.boardId || String(parent.boardId) === String(item.boardId))
        .slice(0, 100)
    } : null,
    source,
    createdAt: Number(item?.createdAt) || 0,
    updatedAt: Number(item?.updatedAt) || 0
  };
}

function remoteBoardSnapshot(board, options = {}) {
  const allItems = Array.isArray(board?.items) ? board.items : [];
  const offset = Math.max(0, Number(options.offset) || 0);
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 50));
  const items = [];
  let responseBytes = 0;
  for (const item of allItems.slice(offset, offset + limit)) {
    const snapshot = remoteItemSnapshot(item);
    const itemBytes = new TextEncoder().encode(JSON.stringify(snapshot)).length;
    if (items.length && responseBytes + itemBytes > 700_000) break;
    items.push(snapshot);
    responseBytes += itemBytes;
  }
  return {
    id: String(board?.id || ""),
    name: String(board?.name || ""),
    itemCount: Number(board?.itemCount) || allItems.length,
    preview: boundedRemoteText(board?.preview, 500),
    createdAt: Number(board?.createdAt) || 0,
    updatedAt: Number(board?.updatedAt) || 0,
    revision: Math.max(0, Number(board?.revision) || 0),
    viewport: {
      zoom: Number(board?.viewport?.zoom) || 1,
      scrollLeft: Math.max(0, Number(board?.viewport?.scrollLeft) || 0),
      scrollTop: Math.max(0, Number(board?.viewport?.scrollTop) || 0),
      canvasWidth: Math.max(0, Number(board?.viewport?.canvasWidth) || 0),
      canvasHeight: Math.max(0, Number(board?.viewport?.canvasHeight) || 0)
    },
    items,
    nextOffset: offset + items.length < allItems.length ? offset + items.length : null
  };
}

function remoteCardInput(params) {
  const input = params?.card && typeof params.card === "object" ? params.card : {};
  const allowedTypes = ["text", "document", "code", "image", "link", "page", "task"];
  const type = allowedTypes.includes(input.type) ? input.type : "text";
  const src = boundedRemoteText(input.src, 200_000);
  if ((type === "image" || type === "link" || type === "page") && !src && !input.text) {
    throw new Error("卡片缺少可展示的内容或地址");
  }
  return {
    type,
    text: boundedRemoteText(input.text, 120_000),
    src,
    alt: boundedRemoteText(input.alt, 2_000),
    pageContent: boundedRemoteText(input.pageContent, 120_000),
    documentLanguage: boundedRemoteText(input.documentLanguage, 80),
    x: Number(input.x) || undefined,
    y: Number(input.y) || undefined,
    width: Number(input.width) || undefined,
    height: Number(input.height) || undefined,
    taskStatus: type === "task" ? "idle" : undefined,
    taskMessages: type === "task" ? [] : undefined,
    source: input.source && typeof input.source === "object" ? {
      url: boundedRemoteText(input.source.url, 4_000),
      title: boundedRemoteText(input.source.title, 500),
      capturedAt: Number(input.source.capturedAt) || Date.now()
    } : null
  };
}

async function notifyRemoteBoardChange(boardIds, itemId, reason) {
  recordExternalBoardChange(boardIds, itemId, reason);
  chrome.runtime.sendMessage({
    type: "pagedock-data-changed",
    boardIds: [...new Set(boardIds.map(String).filter(Boolean))],
    itemId: String(itemId || ""),
    reason,
    source: "codex-bridge"
  }).catch(() => {});
  registerContextMenus().catch(() => {});
}

async function handlePluginRpc(method, params = {}, capabilities = {}) {
  const boardScopeId = String(capabilities.boardScopeId || "");
  const assertBoardScope = boardId => {
    if (boardScopeId && String(boardId || "") !== boardScopeId) throw new Error("此接入者仅获授权访问当前共享白板");
  };
  if (method === "boards.list") {
    return (await PageDockDB.listBoards()).filter(board => !boardScopeId || String(board.id) === boardScopeId).map(board => remoteBoardSnapshot(board));
  }
  if (method === "boards.get") {
    assertBoardScope(params.boardId);
    const board = await PageDockDB.getBoard(String(params.boardId || ""), { includeArchived: Boolean(params.includeArchived) });
    if (!board) throw new Error("白板不存在");
    return remoteBoardSnapshot(board, params);
  }
  if (method === "cards.asset") {
    const boardId = String(params.boardId || "");
    assertBoardScope(boardId);
    const board = await PageDockDB.getBoard(boardId);
    const item = board?.items?.find(entry => String(entry.id) === String(params.cardId || ""));
    if (!item) throw new Error("卡片不存在");
    const dataUrl = String(item.src || "");
    if (!dataUrl.startsWith("data:")) throw new Error("卡片没有内嵌资源");
    return { dataUrl };
  }
  if (method === "cards.search") {
    return PageDockDB.searchBoards(boundedRemoteText(params.query, 500), {
      boardId: boardScopeId || String(params.boardId || ""),
      limit: Math.min(100, Math.max(1, Number(params.limit) || 30))
    });
  }
  if (method === "boards.create") {
    if (boardScopeId) throw new Error("当前邀请不能创建其他白板");
    const board = await PageDockDB.createBoard(boundedRemoteText(params.name, 80) || "新白板");
    await notifyRemoteBoardChange([board.id], "", "codex-bridge-board-create");
    return remoteBoardSnapshot(board);
  }
  if (method === "cards.create") {
    const boardId = String(params.boardId || "");
    assertBoardScope(boardId);
    const item = await PageDockDB.addItem(boardId, remoteCardInput(params));
    await notifyRemoteBoardChange([boardId], item.id, "codex-bridge-card-create");
    return remoteItemSnapshot(item);
  }
  if (method === "cards.update") {
    const boardId = String(params.boardId || "");
    assertBoardScope(boardId);
    const itemId = String(params.cardId || "");
    const board = await PageDockDB.getBoard(boardId, { includeArchived: true });
    if (!board) throw new Error("白板不存在");
    const baseBoard = structuredClone(board);
    const item = board.items.find(entry => String(entry.id) === itemId);
    if (!item) throw new Error("卡片不存在");
    if (capabilities.requireVersion && Number(params.expectedUpdatedAt) !== Number(item.updatedAt)) {
      throw new Error("卡片已被其他协作者更新，请重新读取后再修改");
    }
    const patch = params.patch && typeof params.patch === "object" ? params.patch : {};
    for (const key of ["text", "alt", "pageContent", "documentLanguage"]) {
      if (Object.hasOwn(patch, key)) item[key] = boundedRemoteText(patch[key], key === "text" || key === "pageContent" ? 120_000 : 2_000);
    }
    if (Object.hasOwn(patch, "src")) item.src = boundedRemoteText(patch.src, 200_000);
    for (const key of ["x", "y"]) {
      if (Object.hasOwn(patch, key) && Number.isFinite(Number(patch[key]))) item[key] = Number(patch[key]);
    }
    if (Object.hasOwn(patch, "width") && Number.isFinite(Number(patch.width))) item.width = Math.min(4_000, Math.max(160, Number(patch.width)));
    if (Object.hasOwn(patch, "height") && Number.isFinite(Number(patch.height))) item.height = Math.min(4_000, Math.max(100, Number(patch.height)));
    item.updatedAt = Date.now();
    const saved = await PageDockDB.commitBoardSnapshot(board, {
      baseBoard,
      preserveArchived: true,
      actor: capabilities.remoteClient,
      reason: "Codex 更新卡片"
    });
    await notifyRemoteBoardChange([boardId], itemId, "codex-bridge-card-update");
    return remoteItemSnapshot(saved.items.find(entry => String(entry.id) === itemId));
  }
  if (method === "cards.connect") {
    const boardId = String(params.boardId || "");
    assertBoardScope(boardId);
    const board = await PageDockDB.getBoard(boardId, { includeArchived: true });
    if (!board) throw new Error("白板不存在");
    const baseBoard = structuredClone(board);
    const source = board.items.find(entry => String(entry.id) === String(params.sourceCardId || ""));
    const target = board.items.find(entry => String(entry.id) === String(params.targetCardId || ""));
    if (!source || !target) throw new Error("来源或目标卡片不存在");
    if (capabilities.requireVersion && Number(params.expectedTargetUpdatedAt) !== Number(target.updatedAt)) {
      throw new Error("目标卡片已被其他协作者更新，请重新读取后再连接");
    }
    PageDockCardProtocol.connect(source, target, params.contentType ? String(params.contentType) : undefined);
    target.updatedAt = Date.now();
    const saved = await PageDockDB.commitBoardSnapshot(board, {
      baseBoard,
      preserveArchived: true,
      actor: capabilities.remoteClient,
      reason: "Codex 连接卡片"
    });
    await notifyRemoteBoardChange([boardId], target.id, "codex-bridge-card-connect");
    return remoteItemSnapshot(saved.items.find(entry => String(entry.id) === String(target.id)));
  }
  if (method === "cards.stream") {
    const boardId = String(params.boardId || "");
    assertBoardScope(boardId);
    const itemId = String(params.cardId || "");
    const board = await PageDockDB.getBoard(boardId, { includeArchived: true });
    if (!board) throw new Error("白板不存在");
    const baseBoard = structuredClone(board);
    const item = board.items.find(entry => String(entry.id) === itemId);
    if (!item) throw new Error("卡片不存在");
    if (capabilities.requireVersion && Number(params.expectedUpdatedAt) !== Number(item.updatedAt)) {
      throw new Error("卡片已被其他协作者更新，请重新读取后再生成");
    }
    const incoming = boundedRemoteText(params.text, 30_000);
    const prefix = params.mode === "append" ? String(item.text || "") : "";
    const finalText = prefix + incoming;
    for (let length = Math.min(finalText.length, 500); length < finalText.length; length += 500) {
      broadcastCodexEvent({ type: "external-card-stream", boardId, cardId: itemId, text: finalText.slice(0, length), progress: length / finalText.length });
      await new Promise(resolve => setTimeout(resolve, 35));
    }
    item.text = finalText;
    item.updatedAt = Date.now();
    const saved = await PageDockDB.commitBoardSnapshot(board, {
      baseBoard,
      preserveArchived: true,
      actor: capabilities.remoteClient,
      reason: "Codex 渐进生成卡片"
    });
    await notifyRemoteBoardChange([boardId], itemId, "codex-bridge-card-stream");
    broadcastCodexEvent({ type: "external-card-stream", boardId, cardId: itemId, text: finalText, progress: 1, done: true });
    return remoteItemSnapshot(saved.items.find(entry => String(entry.id) === itemId));
  }
  if (method === "collaboration.list") {
    await ensureCollaborationState();
    return externalCollaborationMessages.filter(entry => !boardScopeId || entry.boardId === boardScopeId).slice(-100);
  }
  if (method === "collaboration.watch") {
    await ensureCollaborationState();
    const boardId = String(params.boardId || boardScopeId || "");
    assertBoardScope(boardId);
    const after = Math.max(0, Number(params.after) || 0);
    // 长轮询短于 Native Host 请求超时，调用方可用返回的 cursor 无缝续订。
    const timeoutMs = Math.min(25_000, Math.max(0, Number(params.timeoutMs) || 20_000));
    return watchCollaboration(after, boardId, timeoutMs);
  }
  if (method === "collaboration.send") {
    await ensureCollaborationState();
    const boardId = String(params.boardId || boardScopeId || "");
    assertBoardScope(boardId);
    const message = {
      id: crypto.randomUUID(),
      boardId,
      cardId: String(params.cardId || ""),
      author: capabilities.remoteClient?.name || "Codex",
      authorId: capabilities.remoteClient?.id || capabilities.remoteClientId || "codex",
      role: "codex",
      text: boundedRemoteText(params.text, 4_000),
      sequence: nextCollaborationSequence(),
      createdAt: Date.now()
    };
    if (!message.text.trim()) throw new Error("消息内容不能为空");
    externalCollaborationMessages.push(message);
    externalCollaborationMessages = externalCollaborationMessages.slice(-200);
    await persistCollaborationState();
    wakeCollaborationWatchers();
    broadcastCodexEvent({ type: "external-codex-message", message });
    return { message, recent: externalCollaborationMessages.filter(entry => entry.boardId === boardId).slice(-20) };
  }
  if (method === "collaboration.presence") {
    const boardId = String(params.boardId || boardScopeId || "");
    assertBoardScope(boardId);
    const hasPointer = Number.isFinite(Number(params.x)) && Number.isFinite(Number(params.y));
    const presence = {
      client: capabilities.remoteClient,
      boardId,
      cardIds: (Array.isArray(params.cardIds) ? params.cardIds : []).map(String).slice(0, 20),
      x: hasPointer ? Number(params.x) : null,
      y: hasPointer ? Number(params.y) : null,
      hasPointer,
      state: boundedRemoteText(params.state, 80),
      updatedAt: Date.now()
    };
    updateExternalPresence(presence);
    return presence;
  }
  if (method === "collaboration.task") {
    return reportExternalCodexTask(params, capabilities, assertBoardScope);
  }
  if (method === "cards.delete") {
    if (!capabilities.allowDestructive) throw new Error("桥接未开启删除权限");
    const boardId = String(params.boardId || "");
    assertBoardScope(boardId);
    const itemIds = (Array.isArray(params.cardIds) ? params.cardIds : [params.cardId]).map(String).filter(Boolean).slice(0, 100);
    const deleted = await PageDockDB.deleteItems(boardId, itemIds);
    await notifyRemoteBoardChange([boardId], "", "codex-bridge-card-delete");
    return { deleted };
  }
  throw new Error(`不支持的插件操作：${method}`);
}

async function respondToPluginRequest(port, message) {
  const requestId = String(message.requestId || "");
  if (!requestId) return;
  const client = markExternalCodexConnected(message.remote);
  const method = String(message.method || "");
  const mutating = ["boards.create", "cards.create", "cards.update", "cards.connect", "cards.stream", "cards.delete"].includes(method);
  const passiveWatch = method === "collaboration.watch" || method === "cards.asset";
  const passiveActivity = passiveWatch || method === "collaboration.task";
  try {
    await ensureCollaborationState();
    const params = message.params && typeof message.params === "object" ? message.params : {};
    const cardIds = [params.cardId, params.sourceCardId, params.targetCardId].filter(Boolean).map(String);
    const rawX = params.patch?.x ?? params.card?.x;
    const rawY = params.patch?.y ?? params.card?.y;
    const hasPointer = Number.isFinite(Number(rawX)) && Number.isFinite(Number(rawY));
    if (!passiveActivity) {
      updateExternalPresence({
        client,
        boardId: String(params.boardId || client.boardId || ""),
        cardIds,
        x: hasPointer ? Number(rawX) : null,
        y: hasPointer ? Number(rawY) : null,
        hasPointer,
        state: EXTERNAL_METHOD_LABELS[method] || "操作白板",
        updatedAt: Date.now()
      });
    }
    if (mutating) {
      const policy = externalClientPolicies[client.id] || (client.type === "human" ? "edit" : "ask");
      if (policy === "read") throw new Error("此接入者当前为只读权限");
      if (policy !== "edit" && !externalSessionGrants.has(client.id)) await requestExternalMutationApproval(message, client);
    }
    if (!passiveActivity) recordExternalCodexActivity(message, client, "running");
    const result = await handlePluginRpc(method, message.params, {
      ...message.capabilities,
      boardScopeId: message.remote?.boardId,
      remoteClientId: client.id,
      remoteClient: client
    });
    if (!passiveActivity) recordExternalCodexActivity(message, client, "completed", { result });
    port.postMessage({ type: CODEX_PLUGIN_RESPONSE, requestId, ok: true, result });
    console.info("[shizuo-bridge] plugin request completed", { requestId, method: message.method });
  } catch (error) {
    if (!passiveActivity) recordExternalCodexActivity(message, client, "error", { error: error?.message || String(error) });
    port.postMessage({ type: CODEX_PLUGIN_RESPONSE, requestId, ok: false, error: error?.message || String(error) });
    console.warn("[shizuo-bridge] plugin request failed", { requestId, method: message.method, reason: error?.message || String(error) });
  }
}

// Native Port 由后台持有，避免侧边栏随标签页切换重载时中断正在运行的 Codex。
function scheduleCodexReconnect(reason = "") {
  if (codexReconnectTimer || (codexNativePort && nativeHostReady)) return;
  codexReconnectTimer = setTimeout(() => {
    codexReconnectTimer = undefined;
    connectCodexNative().catch(error => {
      console.info("[shizuo-bridge] automatic reconnect pending", {
        reason: error?.message || reason || String(error)
      });
      scheduleCodexReconnect(error?.message || reason);
    });
  }, CODEX_RECONNECT_DELAY_MS);
}

function connectCodexNative() {
  if (codexNativePort && nativeHostReady) return Promise.resolve(codexSnapshot());
  if (codexConnectPromise) return codexConnectPromise;

  codexConnectPromise = new Promise((resolve, reject) => {
    let port;
    let settled = false;
    let handshakeTimer;
    const settle = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(handshakeTimer);
      codexConnectPromise = undefined;
      if (error) reject(error);
      else resolve(codexSnapshot());
    };

    try {
      port = chrome.runtime.connectNative(CODEX_NATIVE_HOST);
      codexNativePort = port;
      port.onMessage.addListener(message => {
        if (!message || typeof message !== "object") return;
        if (message.type === CODEX_PLUGIN_REQUEST) {
          void respondToPluginRequest(port, message);
          return;
        }
        if (message.type === "local-codex-session-status") {
          localCodexSessionStatus = normalizeLocalCodexSessionStatus(message.status);
          broadcastCodexEvent({ type: "local-codex-session-status", available: true, status: { ...localCodexSessionStatus } });
          return;
        }
        if (["codex-session-list-result", "codex-session-preview-result", "codex-session-error"].includes(message.type)) {
          const requestId = String(message.id || "");
          const pending = nativeControlRequests.get(requestId);
          if (!pending) return;
          nativeControlRequests.delete(requestId);
          clearTimeout(pending.timer);
          if (message.type === "codex-session-error") pending.reject(new Error(String(message.error || "Codex Session 读取失败")));
          else pending.resolve(message);
          return;
        }
        if (String(message.type || "").startsWith("bridge-share-") || String(message.type || "").startsWith("bridge-client-")) {
          const requestId = String(message.id || "");
          const pending = nativeControlRequests.get(requestId);
          if (pending) {
            nativeControlRequests.delete(requestId);
            clearTimeout(pending.timer);
            if (message.type === "bridge-share-error" || message.type === "bridge-client-error") pending.reject(new Error(String(message.error || "共享设置失败")));
            else pending.resolve(message);
          }
          if (message.type === "bridge-share-created") {
            externalBridgeEnabled = true;
            externalCodexConnected = false;
            externalCodexScope = "lan";
            externalCodexClients.clear();
            externalCodexPresence.clear();
            externalSessionGrants.clear();
            broadcastExternalCodexStatus();
          } else if (message.type === "bridge-share-stopped") {
            externalBridgeEnabled = true;
            externalCodexConnected = false;
            externalCodexScope = "local";
            externalCodexClients.clear();
            externalCodexPresence.clear();
            externalSessionGrants.clear();
            for (const pending of externalApprovalRequests.values()) {
              clearTimeout(pending.timer);
              pending.reject(new Error("内网共享已停止"));
            }
            externalApprovalRequests.clear();
            broadcastExternalCodexStatus();
          }
          return;
        }
        if (message.type === "pong") {
          clearTimeout(codexReconnectTimer);
          codexReconnectTimer = undefined;
          nativeHostReady = true;
          nativeHostVersion = String(message.hostVersion || "");
          codexReady = Boolean(message.codexAvailable);
          agyReady = Boolean(message.agyAvailable);
          hyperframesAvailable = Boolean(message.hyperframesAvailable);
          remotionAvailable = Boolean(message.remotionAvailable);
          terminalAvailable = Boolean(message.terminalAvailable);
          terminalPtyAvailable = Boolean(message.terminalPtyAvailable);
          terminalWorkspace = String(message.terminalWorkspace || message.codingWorkspace || "");
          externalBridgeEnabled = Boolean(message.externalBridgeEnabled);
          externalBridgePort = Number(message.externalBridgePort) || 0;
          externalCodexScope = String(message.externalBridgeScope || (externalBridgeEnabled ? "local" : "disabled"));
          localCodexSessionStatus = normalizeLocalCodexSessionStatus(message.localCodexSessionStatus);
          console.info("[pagedock-codex] native host connected", {
            hostVersion: message.hostVersion,
            codexAvailable: codexReady,
            agyAvailable: agyReady,
            terminalAvailable
          });
          settle();
          return;
        }
        if (String(message.type || "").startsWith("terminal-")) {
          if (message.type === "terminal-session-started") {
            if (message.id) terminalSessionIds.add(String(message.id));
          } else if (["terminal-session-closed", "terminal-session-error"].includes(message.type)) {
            if (message.id) terminalSessionIds.delete(String(message.id));
          } else if (message.type === "terminal-started") {
            if (message.id) terminalActiveTaskIds.add(String(message.id));
          } else if (["terminal-done", "terminal-error", "terminal-cancelled"].includes(message.type)) {
            if (message.id) terminalActiveTaskIds.delete(String(message.id));
          }
          broadcastTerminalEvent(message);
          return;
        }
        const scheduledRun = message.id ? scheduledCodexRuns.get(String(message.id)) : null;
        if (message.type === "started" || message.type === "progress") {
          if (message.id) codexActiveTaskIds.add(String(message.id));
        } else if (["done", "error", "cancelled"].includes(message.type)) {
          if (message.id) codexActiveTaskIds.delete(String(message.id));
          rememberCodexTerminalEvent(message);
        }
        if (!scheduledRun || !String(message.type || "").startsWith("artifact-")) {
          broadcastCodexEvent(scheduledRun ? {
            ...message,
            scheduled: true,
            boardId: scheduledRun.boardId,
            itemId: scheduledRun.itemId,
            controllerId: scheduledRun.controllerId || ""
          } : message);
        }
        if (scheduledRun) handleScheduledCodexEvent(message, scheduledRun).catch(error => {
          console.error("[pagedock-scheduler] result persistence failed", { taskId: message.id, reason: error?.message || String(error) });
        });
      });
      port.onDisconnect.addListener(() => {
        const reason = chrome.runtime.lastError?.message || "本地桥接已断开";
        if (codexNativePort !== port) return;
        const interruptedTaskIds = [...codexActiveTaskIds];
        const interruptedTerminalIds = [...terminalActiveTaskIds];
        const interruptedTerminalSessionIds = [...terminalSessionIds];
        codexNativePort = undefined;
        nativeHostReady = false;
        nativeHostVersion = "";
        codexReady = false;
        agyReady = false;
        hyperframesAvailable = false;
        remotionAvailable = false;
        terminalAvailable = false;
        terminalPtyAvailable = false;
        externalBridgeEnabled = false;
        externalCodexConnected = false;
        externalCodexScope = "disabled";
        localCodexSessionStatus = normalizeLocalCodexSessionStatus();
        externalCodexClients.clear();
        externalCodexPresence.clear();
        externalSessionGrants.clear();
        clearTimeout(externalCodexStatusTimer);
        codexActiveTaskIds.clear();
        terminalActiveTaskIds.clear();
        terminalSessionIds.clear();
        for (const pending of nativeControlRequests.values()) {
          clearTimeout(pending.timer);
          pending.reject(new Error(reason));
        }
        nativeControlRequests.clear();
        for (const pending of externalApprovalRequests.values()) {
          clearTimeout(pending.timer);
          pending.reject(new Error(reason));
        }
        externalApprovalRequests.clear();
        broadcastExternalCodexStatus();
        broadcastCodexEvent({ type: "local-codex-session-status", available: false, status: { ...localCodexSessionStatus } });
        console.warn("[pagedock-codex] native host disconnected", { reason });
        for (const interruptedTaskId of interruptedTaskIds) {
          const interruptedEvent = {
            type: "error",
            id: interruptedTaskId,
            code: "bridge-disconnected",
            error: `本地桥接已断开：${reason}`
          };
          rememberCodexTerminalEvent(interruptedEvent);
          const scheduledRun = scheduledCodexRuns.get(interruptedTaskId);
          if (scheduledRun) {
            scheduledCodexRuns.delete(interruptedTaskId);
            if (scheduledRun.kind === "workflow-job") scheduledRun.reject?.(new Error(interruptedEvent.error));
            else failScheduledTask(scheduledRun.boardId, scheduledRun.itemId, interruptedEvent.error, true).catch(error => {
              console.error("[pagedock-scheduler] reconnect retry persistence failed", error);
            });
          }
          broadcastCodexEvent(scheduledRun ? { ...interruptedEvent, scheduled: true } : interruptedEvent);
        }
        for (const interruptedTaskId of interruptedTerminalIds) {
          broadcastTerminalEvent({
            type: "terminal-error",
            id: interruptedTaskId,
            error: `本地桥接已断开：${reason}`
          });
        }
        for (const interruptedSessionId of interruptedTerminalSessionIds) {
          broadcastTerminalEvent({
            type: "terminal-session-error",
            id: interruptedSessionId,
            error: `本地桥接已断开：${reason}`
          });
        }
        scheduleCodexReconnect(reason);
        settle(new Error(reason));
      });
      handshakeTimer = setTimeout(() => {
        if (codexNativePort === port) {
          codexNativePort = undefined;
          nativeHostReady = false;
          codexReady = false;
          agyReady = false;
        }
        port.disconnect();
        settle(new Error("连接本地桥接超时"));
      }, 5000);
      port.postMessage({ type: "ping", id: `ping-${Date.now()}` });
    } catch (error) {
      if (codexNativePort === port) codexNativePort = undefined;
      codexReady = false;
      agyReady = false;
      scheduleCodexReconnect(error?.message || String(error));
      settle(error);
    }
  });
  return codexConnectPromise;
}

function ensureCodexAutoConnection(context) {
  connectCodexNative().catch(error => {
    console.info(`[shizuo-bridge] ${context} connection unavailable`, { reason: error?.message || String(error) });
    scheduleCodexReconnect(error?.message || String(error));
  });
}

function armCodexAutoConnectAlarm() {
  chrome.alarms.create(CODEX_AUTO_CONNECT_ALARM, { delayInMinutes: 1, periodInMinutes: 1 });
}

function taskScheduleAlarmName(boardId, itemId) {
  return `${TASK_SCHEDULE_ALARM_PREFIX}${encodeURIComponent(JSON.stringify([String(boardId), String(itemId)]))}`;
}

function parseTaskScheduleAlarm(name) {
  if (!String(name || "").startsWith(TASK_SCHEDULE_ALARM_PREFIX)) return null;
  try {
    const [boardId, itemId] = JSON.parse(decodeURIComponent(name.slice(TASK_SCHEDULE_ALARM_PREFIX.length)));
    return boardId && itemId ? { boardId: String(boardId), itemId: String(itemId) } : null;
  } catch {
    return null;
  }
}

async function syncTaskScheduleAlarm(boardId, itemId) {
  const name = taskScheduleAlarmName(boardId, itemId);
  await chrome.alarms.clear(name);
  const board = await PageDockDB.getBoard(boardId);
  const item = board?.items.find(candidate => String(candidate.id) === String(itemId));
  const schedule = PageDockBoardDomain.normalizeTaskSchedule(item?.taskSchedule);
  const dueAt = schedule?.retryAt || schedule?.nextRunAt;
  if (schedule?.enabled && dueAt) {
    chrome.alarms.create(name, { when: Math.max(Date.now() + 1_000, dueAt) });
  }
  return schedule;
}

async function syncAllTaskScheduleAlarms() {
  const expected = new Set();
  for (const summary of await PageDockDB.listBoards()) {
    const board = await PageDockDB.getBoard(summary.id);
    for (const item of board?.items || []) {
      const schedule = PageDockBoardDomain.normalizeTaskSchedule(item.taskSchedule);
      const dueAt = schedule?.retryAt || schedule?.nextRunAt;
      if (!schedule?.enabled || !dueAt) continue;
      const name = taskScheduleAlarmName(board.id, item.id);
      expected.add(name);
      chrome.alarms.create(name, { when: Math.max(Date.now() + 1_000, dueAt) });
    }
  }
  for (const alarm of await chrome.alarms.getAll()) {
    if (alarm.name.startsWith(TASK_SCHEDULE_ALARM_PREFIX) && !expected.has(alarm.name)) await chrome.alarms.clear(alarm.name);
  }
}

async function recoverInterruptedScheduledTasks() {
  for (const summary of await PageDockDB.listBoards()) {
    await queueScheduledBoardWrite(summary.id, async () => {
      const board = await PageDockDB.getBoard(summary.id);
      const interrupted = board?.items.filter(item => item.taskStatus === "running" && String(item.taskRunId || "").startsWith("scheduled-")) || [];
      if (!interrupted.length) return;
      const baseBoard = structuredClone(board);
      const retryAt = Date.now() + 5 * 60_000;
      for (const item of interrupted) {
        const schedule = PageDockBoardDomain.normalizeTaskSchedule(item.taskSchedule);
        if (schedule) item.taskSchedule = { ...schedule, enabled: true, retryAt, lastStatus: "error", lastError: "浏览器重启中断了定时执行" };
        item.taskStatus = "error";
        item.taskError = schedule ? "浏览器重启中断了定时执行，将在 5 分钟后重试" : "浏览器重启中断了工作流步骤";
        item.taskProgress = "";
        item.taskRunId = "";
        item.taskCompletedAt = Date.now();
      }
      await PageDockDB.commitBoardSnapshot(board, { baseBoard, reason: "scheduled-task-recovered", preserveArchived: true });
      console.warn("[pagedock-scheduler] interrupted runs recovered", { boardId: board.id, count: interrupted.length });
    });
  }
}

function scheduledTaskPrompt(item) {
  return String(item?.text || [...(item?.taskMessages || [])].reverse().find(message => message?.role === "user")?.text || "").trim();
}

function scheduledTaskContext(board, item) {
  const sourceIds = new Set([...(item.taskSourceIds || []), ...(item.relationSourceIds || [])].map(String));
  return board.items.filter(source => sourceIds.has(String(source.id))).map((source, index) => {
    const content = source.type === "task"
      ? source.taskWorkflowRole === "controller"
        ? source.text || [...(source.taskMessages || [])].reverse().find(message => message?.role === "user")?.text || source.taskResult
        : source.taskResult || source.taskWorkflowInstruction || source.text
      : source.pageContent || source.localPreview || source.text || source.alt || source.src;
    return `[${index + 1}] ${source.type}\n${String(content || "").slice(0, 30_000)}`;
  }).join("\n\n").slice(0, 80_000);
}

function queueScheduledBoardWrite(boardId, write) {
  const key = String(boardId);
  const previous = scheduledBoardWrites.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(write);
  scheduledBoardWrites.set(key, next);
  return next.finally(() => {
    if (scheduledBoardWrites.get(key) === next) scheduledBoardWrites.delete(key);
  });
}

function mutateScheduledTask(boardId, itemId, reason, mutate, notify = true) {
  return queueScheduledBoardWrite(boardId, async () => {
    const board = await PageDockDB.getBoard(boardId);
    if (!board) return null;
    const baseBoard = structuredClone(board);
    const item = board.items.find(candidate => String(candidate.id) === String(itemId));
    if (!item) return null;
    mutate(item, board);
    const saved = await PageDockDB.commitBoardSnapshot(board, { baseBoard, reason, preserveArchived: true });
    if (notify) {
      chrome.runtime.sendMessage({
        type: "pagedock-data-changed",
        boardIds: [boardId],
        itemId,
        reason,
        source: "task-scheduler"
      }).catch(() => {});
    }
    return saved.items.find(candidate => String(candidate.id) === String(itemId)) || null;
  });
}

async function failScheduledTask(boardId, itemId, error, retry = false) {
  const message = String(error?.message || error || "定时任务启动失败");
  await mutateScheduledTask(boardId, itemId, "scheduled-task-start-failed", item => {
    const schedule = PageDockBoardDomain.normalizeTaskSchedule(item.taskSchedule) || {};
    item.taskSchedule = {
      ...schedule,
      enabled: retry,
      nextRunAt: retry ? schedule.nextRunAt : 0,
      retryAt: retry ? Date.now() + 5 * 60_000 : 0,
      lastRunAt: Date.now(),
      lastStatus: "error",
      lastError: message
    };
    item.taskStatus = "error";
    item.taskError = retry ? `${message}，将在 5 分钟后重试` : message;
    item.taskProgress = "";
    item.taskRunId = "";
    item.taskCompletedAt = Date.now();
  });
  await syncTaskScheduleAlarm(boardId, itemId);
}

function parseScheduledWorkflowPlan(answer) {
  const text = String(answer || "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Codex 没有返回有效的工作流计划");
  return PageDockBoardDomain.normalizeWorkflowPlan(JSON.parse(text.slice(start, end + 1)));
}

function scheduledWorkflowStepRequest(board, item) {
  const sourceIds = new Set([...(item.taskSourceIds || []), ...(item.relationSourceIds || [])].map(String));
  const directSources = board.items.filter(candidate => sourceIds.has(String(candidate.id)));
  const generated = board.items.filter(candidate => candidate.generationContext?.workflowId === item.taskWorkflowId
    && (candidate.relationSourceIds || []).some(id => sourceIds.has(String(id))));
  const context = scheduledTaskContext(board, {
    ...item,
    taskSourceIds: [...sourceIds, ...generated.map(candidate => String(candidate.id))]
  });
  const images = [...directSources, ...generated]
    .filter(candidate => candidate.type === "image" && /^data:image\/(png|jpe?g|webp);base64,/i.test(String(candidate.src || "")))
    .slice(0, 3)
    .map(candidate => candidate.src);
  const instruction = String(item.taskWorkflowInstruction || item.text || item.taskWorkflowTitle || "执行工作流步骤").trim();
  const prompts = {
    text: instruction,
    "image-gen": `${instruction}\n\n视觉要求：使用明亮温暖的纸张手稿风格，突出内容、结构和关系；禁止暗黑科技风、无用眉标、来源脚注和水印。`,
    video: `${instruction}\n\n制作解释型视频，只使用提供的内容作为事实依据，不要臆造。`
  };
  const preferredVideoMode = item.taskVideoEngine === "remotion" ? "remotion-video" : "hyperframes-video";
  const availableVideoMode = preferredVideoMode === "remotion-video"
    ? remotionAvailable ? "remotion-video" : hyperframesAvailable ? "hyperframes-video" : preferredVideoMode
    : hyperframesAvailable ? "hyperframes-video" : remotionAvailable ? "remotion-video" : preferredVideoMode;
  return {
    mode: item.taskWorkflowMode === "video"
      ? availableVideoMode
      : item.taskWorkflowMode === "image-gen" ? "image-gen" : item.taskWorkflowMode === "text" ? "analysis" : "coding",
    prompt: prompts[item.taskWorkflowMode] || instruction,
    page: { title: `${board.name} · ${item.taskWorkflowTitle || "工作流步骤"}`, url: "", content: context || instruction },
    images
  };
}

function runScheduledNativeJob(payload, metadata) {
  const id = String(metadata.id || `scheduled-${metadata.kind}-${crypto.randomUUID()}`);
  return new Promise((resolve, reject) => {
    if (codexActiveTaskIds.size + terminalActiveTaskIds.size >= CODEX_MAX_CONCURRENT_TASKS) {
      reject(new Error("本地任务并发已满"));
      return;
    }
    const run = { ...metadata, id, resolve, reject, artifact: null };
    scheduledCodexRuns.set(id, run);
    codexActiveTaskIds.add(id);
    try {
      codexNativePort.postMessage({ type: "run", id, runtime: aiRuntime, ...payload });
    } catch (error) {
      scheduledCodexRuns.delete(id);
      codexActiveTaskIds.delete(id);
      reject(error);
    }
  });
}

function collectScheduledWorkflowArtifact(message, run) {
  if (message.type === "artifact-start") {
    const totalChunks = Number(message.totalChunks) || 0;
    const limit = message.artifactType === "video" ? SCHEDULED_VIDEO_CHUNK_LIMIT : SCHEDULED_IMAGE_CHUNK_LIMIT;
    if (totalChunks < 1 || totalChunks > limit) throw new Error("工作流产物过大，无法回传到白板");
    run.artifact = {
      type: message.artifactType === "video" ? "video" : "image",
      mimeType: String(message.mimeType || (message.artifactType === "video" ? "video/mp4" : "image/png")),
      filename: String(message.filename || "Codex 产物"),
      chunks: new Array(totalChunks),
      received: 0,
      ready: false
    };
    return true;
  }
  if (message.type === "artifact-chunk" && run.artifact) {
    const index = Number(message.index);
    if (!Number.isInteger(index) || index < 0 || index >= run.artifact.chunks.length) return true;
    if (!run.artifact.chunks[index]) run.artifact.received += 1;
    run.artifact.chunks[index] = String(message.data || "");
    return true;
  }
  if (message.type === "artifact-done" && run.artifact) {
    run.artifact.ready = run.artifact.received === run.artifact.chunks.length;
    return true;
  }
  return false;
}

function commitScheduledWorkflowPlan(boardId, controllerId, plan, workflowRunId) {
  return queueScheduledBoardWrite(boardId, async () => {
    const board = await PageDockDB.getBoard(boardId, { includeArchived: true });
    if (!board) throw new Error("定时工作流所在白板不存在");
    const baseBoard = structuredClone(board);
    const controller = board.items.find(item => String(item.id) === String(controllerId));
    if (!controller) throw new Error("定时工作流控制卡不存在");
    const now = Date.now();
    const workflowId = `workflow-${crypto.randomUUID()}`;
  // 仅保留上一轮已归档的工作流，防止周期任务无限堆积隐藏容器和媒体。
  board.items = board.items.filter(item => !item.archivedAt
    || (!item.taskWorkflowRunId && !item.generationContext?.workflowId));
  const previousWorkflowId = String(controller.taskWorkflowId || "");
  const oldStepIds = new Set((controller.taskWorkflowStepIds || []).map(String));
  board.items.forEach(item => {
    if (oldStepIds.has(String(item.id)) || (previousWorkflowId && item.generationContext?.workflowId === previousWorkflowId)) {
      item.archivedAt = now;
    }
  });
  const waveByStepId = new Map(plan.waves.flatMap((wave, waveIndex) => wave.map(id => [id, waveIndex])));
  const rows = new Map();
  const startX = Number(controller.x) + Number(controller.width || 480) + 180;
  const stepByPlanId = new Map();
  for (const step of plan.steps) {
    const wave = waveByStepId.get(step.id) || 0;
    const row = rows.get(wave) || 0;
    rows.set(wave, row + 1);
    const card = {
      id: crypto.randomUUID(),
      boardId,
      type: "task",
      text: step.instruction,
      taskStatus: "idle",
      taskSourceIds: [],
      taskSourceCount: 0,
      relationSourceIds: [],
      taskWorkflowId: workflowId,
      taskWorkflowStepId: step.id,
      taskWorkflowRole: "step",
      taskWorkflowMode: step.mode,
      taskVideoEngine: controller.taskVideoEngine === "remotion" ? "remotion" : "hyperframes",
      taskWorkflowTitle: step.title,
      taskWorkflowInstruction: step.instruction,
      taskWorkflowRunId: workflowRunId,
      taskWorkflowLens: PageDockBoardDomain.workflowLens(controller.taskWorkflowLens).id,
      x: startX + wave * 600,
      y: Number(controller.y) + row * 380,
      width: 480,
      height: 320,
      z: board.items.length + stepByPlanId.size + 1,
      createdAt: now,
      updatedAt: now
    };
    board.items.push(card);
    stepByPlanId.set(step.id, card);
  }
  for (const step of plan.steps) {
    const card = stepByPlanId.get(step.id);
    const dependencies = step.dependsOn.map(id => stepByPlanId.get(id)?.id).filter(Boolean);
    const sourceIds = dependencies.length ? dependencies : [...new Set([controller.id, ...(controller.taskSourceIds || [])])];
    card.taskSourceIds = sourceIds;
    card.taskSourceCount = sourceIds.length;
    card.relationSourceIds = sourceIds;
  }
  controller.taskWorkflowId = workflowId;
  controller.taskWorkflowRunId = workflowRunId;
  controller.taskWorkflowRole = "controller";
  controller.taskWorkflowTitle = plan.title;
  controller.taskWorkflowStepIds = plan.steps.map(step => stepByPlanId.get(step.id).id);
  controller.taskRunId = workflowRunId;
  controller.taskProgress = "准备执行定时工作流";
  controller.updatedAt = now;
    const saved = await PageDockDB.commitBoardSnapshot(board, { baseBoard, reason: "scheduled-workflow-planned" });
    chrome.runtime.sendMessage({ type: "pagedock-data-changed", boardIds: [boardId], itemId: controllerId, reason: "scheduled-workflow-planned", source: "task-scheduler" }).catch(() => {});
    return saved;
  });
}

function persistScheduledWorkflowBatch(boardId, controllerId, results) {
  return queueScheduledBoardWrite(boardId, async () => {
    const board = await PageDockDB.getBoard(boardId);
    if (!board) throw new Error("定时工作流所在白板不存在");
    const baseBoard = structuredClone(board);
    const now = Date.now();
  for (const result of results) {
    const item = board.items.find(candidate => String(candidate.id) === String(result.itemId));
    if (!item) throw new Error("工作流执行容器已被删除");
    item.taskStatus = "success";
    item.taskProgress = "";
    item.taskRunId = "";
    item.taskCompletedAt = now;
    item.taskResult = result.artifact ? `${result.artifact.type === "video" ? "视频" : "图片"}已生成并添加到白板` : String(result.answer || "Codex 没有返回内容");
    item.taskMessages = [...(item.taskMessages || []), { id: crypto.randomUUID(), role: "assistant", kind: "conversation", text: item.taskResult, createdAt: now }].slice(-30);
    if (result.artifact) {
      if (!result.artifact.ready || result.artifact.chunks.some(chunk => !chunk)) throw new Error(`${item.taskWorkflowTitle || "工作流步骤"}的产物回传不完整`);
      const isVideo = result.artifact.type === "video";
      board.items.push({
        id: crypto.randomUUID(),
        boardId,
        type: isVideo ? "video" : "image",
        src: `data:${result.artifact.mimeType};base64,${result.artifact.chunks.join("")}`,
        alt: `${item.taskWorkflowTitle || "Codex"} · ${result.artifact.filename}`,
        filename: result.artifact.filename,
        x: Number(item.x),
        y: Number(item.y) + Number(item.height || 320) + 80,
        width: isVideo ? 640 : 560,
        height: isVideo ? 420 : 420,
        z: board.items.length + 1,
        relationSourceIds: [item.id],
        generationContext: { workflowId: item.taskWorkflowId, workflowStepId: item.taskWorkflowStepId, createdAt: now },
        provenance: {
          version: 1,
          operation: `codex-generate-${isVideo ? "video" : "image-gen"}`,
          actor: { id: "codex", name: "Codex" },
          parents: [{ kind: "card", boardId, cardId: item.id, cardRevision: Number(item.revision) || 0, relation: "workflow-step" }],
          createdAt: now
        },
        createdAt: now,
        updatedAt: now
      });
    }
  }
  const controller = board.items.find(item => String(item.id) === String(controllerId));
  if (controller) controller.taskProgress = `定时工作流已完成 ${board.items.filter(item => item.taskWorkflowId === controller.taskWorkflowId && item.taskWorkflowRole === "step" && item.taskStatus === "success").length}/${controller.taskWorkflowStepIds.length}`;
    await PageDockDB.commitBoardSnapshot(board, { baseBoard, reason: "scheduled-workflow-step-completed", preserveArchived: true });
    chrome.runtime.sendMessage({ type: "pagedock-data-changed", boardIds: [boardId], itemId: controllerId, reason: "scheduled-workflow-step-completed", source: "task-scheduler" }).catch(() => {});
  });
}

async function runScheduledWorkflow(board, controller, schedule, prompt) {
  const boardId = board.id;
  const controllerId = controller.id;
  const workflowRunId = `scheduled-workflow-${crypto.randomUUID()}`;
  const planningId = `scheduled-workflow-plan-${crypto.randomUUID()}`;
  const workflowState = { boardId, controllerId, runId: workflowRunId, cancelRequested: false };
  scheduledWorkflowControllers.set(String(controllerId), workflowState);
  const assertNotCancelled = () => {
    if (!workflowState.cancelRequested) return;
    const error = new Error("定时工作流已停止");
    error.code = "WORKFLOW_CANCELLED";
    throw error;
  };
  const nextSchedule = { ...PageDockBoardDomain.beginTaskScheduleRun(schedule, Date.now()), lastRunAt: Date.now(), lastStatus: "", lastError: "" };
  await mutateScheduledTask(boardId, controllerId, "scheduled-workflow-started", item => {
    item.taskSchedule = nextSchedule;
    item.taskStatus = "running";
    item.taskError = "";
    item.taskProgress = "正在规划定时工作流";
    item.taskRunId = planningId;
    item.taskStartedAt = Date.now();
    item.taskCompletedAt = 0;
  }, false);
  await syncTaskScheduleAlarm(boardId, controllerId);
  try {
    const planning = await runScheduledNativeJob({
      mode: "analysis",
      prompt: PageDockBoardDomain.workflowPlanningPrompt(prompt, controller.taskWorkflowLens),
      page: { title: `${board.name} · 定时工作流规划`, url: "", content: scheduledTaskContext(board, controller) || prompt },
      images: []
    }, { id: planningId, kind: "workflow-job", boardId, itemId: controllerId, controllerId, phase: "planning" });
    assertNotCancelled();
    const plan = parseScheduledWorkflowPlan(planning.answer);
    let current = await commitScheduledWorkflowPlan(boardId, controllerId, plan, workflowRunId);
    const cardByPlanId = new Map(plan.steps.map(step => [step.id, current.items.find(item => item.taskWorkflowRole === "step" && item.taskWorkflowId === current.items.find(candidate => candidate.id === controllerId)?.taskWorkflowId && item.taskWorkflowStepId === step.id)]));
    let completed = 0;
    for (const wave of plan.waves) {
      for (let offset = 0; offset < wave.length; offset += CODEX_MAX_CONCURRENT_TASKS) {
        assertNotCancelled();
        const ids = wave.slice(offset, offset + CODEX_MAX_CONCURRENT_TASKS);
        const jobIdByItem = new Map(ids.map(id => [cardByPlanId.get(id)?.id, `scheduled-workflow-step-${crypto.randomUUID()}`]));
        current = await queueScheduledBoardWrite(boardId, async () => {
          const latest = await PageDockDB.getBoard(boardId);
          const baseBoard = structuredClone(latest);
          const starting = ids.map(id => latest.items.find(item => item.id === cardByPlanId.get(id)?.id)).filter(Boolean);
          starting.forEach(item => {
            item.taskStatus = "running";
            item.taskProgress = "定时工作流正在执行";
            item.taskRunId = jobIdByItem.get(item.id);
            item.taskStartedAt = Date.now();
            item.taskCompletedAt = 0;
          });
          const activeController = latest.items.find(item => item.id === controllerId);
          if (activeController) activeController.taskProgress = `正在执行 ${completed + 1}/${plan.steps.length}`;
          return PageDockDB.commitBoardSnapshot(latest, { baseBoard, reason: "scheduled-workflow-step-started", preserveArchived: true });
        });
        chrome.runtime.sendMessage({
          type: "pagedock-data-changed",
          boardIds: [boardId],
          itemId: controllerId,
          reason: "scheduled-workflow-step-started",
          source: "task-scheduler"
        }).catch(() => {});
        const batch = ids.map(id => current.items.find(item => item.id === cardByPlanId.get(id)?.id)).filter(Boolean);
        const runStep = async item => {
          const latest = await PageDockDB.getBoard(boardId);
          const request = scheduledWorkflowStepRequest(latest, latest.items.find(candidate => candidate.id === item.id));
          const output = await runScheduledNativeJob(request, { id: jobIdByItem.get(item.id), kind: "workflow-job", boardId, itemId: item.id, controllerId, phase: "step" });
          return { itemId: item.id, answer: output.answer, artifact: output.artifact };
        };
        const lanes = PageDockBoardDomain.partitionWorkflowWave(batch, item => item.taskWorkflowMode);
        const settled = await Promise.allSettled(lanes.parallel.map(runStep));
        const parallelResults = settled.filter(result => result.status === "fulfilled").map(result => result.value);
        if (parallelResults.length) {
          await persistScheduledWorkflowBatch(boardId, controllerId, parallelResults);
          completed += parallelResults.length;
        }
        const failed = settled.find(result => result.status === "rejected");
        if (failed) throw failed.reason;
        for (const media of lanes.serial) {
          assertNotCancelled();
          const result = await runStep(media);
          await persistScheduledWorkflowBatch(boardId, controllerId, [result]);
          completed += 1;
        }
      }
    }
    await mutateScheduledTask(boardId, controllerId, "scheduled-workflow-completed", item => {
      const activeSchedule = PageDockBoardDomain.normalizeTaskSchedule(item.taskSchedule);
      item.taskSchedule = activeSchedule ? { ...activeSchedule, lastRunAt: Date.now(), lastStatus: "success", lastError: "" } : null;
      item.taskStatus = "success";
      item.taskResult = `定时工作流已完成，${completed} 个执行容器均已产出结果`;
      item.taskError = "";
      item.taskProgress = "";
      item.taskRunId = "";
      item.taskCompletedAt = Date.now();
    });
    console.info("[pagedock-scheduler] workflow finished", { boardId, controllerId, completed });
  } catch (error) {
    for (const [taskId, run] of scheduledCodexRuns) {
      if (run.kind !== "workflow-job" || run.controllerId !== controllerId) continue;
      try { codexNativePort?.postMessage({ type: "cancel", id: taskId }); } catch {}
    }
    await mutateScheduledTask(boardId, controllerId, "scheduled-workflow-failed", (item, activeBoard) => {
      const activeSchedule = PageDockBoardDomain.normalizeTaskSchedule(item.taskSchedule);
      const cancelled = error?.code === "WORKFLOW_CANCELLED";
      const retry = /桥接|并发已满|disconnected/i.test(String(error?.message || error));
      item.taskSchedule = activeSchedule ? { ...activeSchedule, enabled: retry || activeSchedule.enabled, retryAt: retry ? Date.now() + 5 * 60_000 : 0, lastRunAt: Date.now(), lastStatus: cancelled ? "" : "error", lastError: cancelled ? "" : String(error?.message || error) } : null;
      item.taskStatus = cancelled ? "cancelled" : "error";
      item.taskError = cancelled ? "" : `${String(error?.message || error || "定时工作流执行失败")}${retry ? "，将在 5 分钟后重试" : ""}`;
      item.taskProgress = "";
      item.taskRunId = "";
      item.taskCompletedAt = Date.now();
      for (const step of activeBoard.items.filter(candidate => candidate.taskWorkflowId === item.taskWorkflowId && candidate.taskWorkflowRole === "step" && candidate.taskStatus === "running")) {
        step.taskStatus = cancelled ? "cancelled" : "error";
        step.taskError = cancelled ? "" : "定时工作流已中断";
        step.taskProgress = "";
        step.taskRunId = "";
        step.taskCompletedAt = Date.now();
      }
    });
    await syncTaskScheduleAlarm(boardId, controllerId);
    console.error("[pagedock-scheduler] workflow failed", { boardId, controllerId, reason: error?.message || String(error) });
  } finally {
    if (scheduledWorkflowControllers.get(String(controllerId)) === workflowState) {
      scheduledWorkflowControllers.delete(String(controllerId));
    }
  }
}

async function runScheduledTask(boardId, itemId) {
  const board = await PageDockDB.getBoard(boardId);
  const item = board?.items.find(candidate => String(candidate.id) === String(itemId));
  const schedule = PageDockBoardDomain.normalizeTaskSchedule(item?.taskSchedule);
  if (!board || !item || !schedule?.enabled) return;
  const dueAt = schedule.retryAt || schedule.nextRunAt;
  if (dueAt > Date.now() + 5_000) {
    await syncTaskScheduleAlarm(boardId, itemId);
    return;
  }
  if (item.type !== "task" || item.taskWorkflowRole === "step") {
    await failScheduledTask(boardId, itemId, "执行容器不能单独设置定时任务");
    return;
  }
  const prompt = scheduledTaskPrompt(item);
  if (!prompt) {
    await failScheduledTask(boardId, itemId, "定时任务缺少执行内容");
    return;
  }
  try {
    await connectCodexNative();
    if (!runtimeReady()) throw new Error(`本机未找到 ${aiRuntime === "agy" ? "AGY" : "Codex"} CLI`);
    if (codexActiveTaskIds.size + terminalActiveTaskIds.size >= CODEX_MAX_CONCURRENT_TASKS) throw new Error("本地任务并发已满");
  } catch (error) {
    await failScheduledTask(boardId, itemId, error, true);
    return;
  }

  if (schedule.execution === "workflow" || item.taskWorkflowRole === "controller") {
    await runScheduledWorkflow(board, item, { ...schedule, execution: "workflow" }, prompt);
    return;
  }

  const taskId = `scheduled-${crypto.randomUUID()}`;
  const context = scheduledTaskContext(board, item);
  const nextSchedule = {
    ...PageDockBoardDomain.beginTaskScheduleRun(schedule, Date.now()),
    lastRunAt: Date.now(),
    lastStatus: "",
    lastError: ""
  };
  const userMessage = {
    id: crypto.randomUUID(),
    role: "user",
    kind: "conversation",
    text: prompt,
    createdAt: Date.now()
  };
  await mutateScheduledTask(boardId, itemId, "scheduled-task-started", taskItem => {
    taskItem.taskSchedule = nextSchedule;
    taskItem.taskStatus = "running";
    taskItem.taskError = "";
    taskItem.taskProgress = "定时任务正在执行";
    taskItem.taskRunId = taskId;
    taskItem.taskLastMode = "coding";
    taskItem.taskStartedAt = Date.now();
    taskItem.taskCompletedAt = 0;
    taskItem.taskMessages = [...(taskItem.taskMessages || []), userMessage].slice(-30);
  }, false);
  await syncTaskScheduleAlarm(boardId, itemId);
  scheduledCodexRuns.set(taskId, { boardId, itemId, prompt });
  codexActiveTaskIds.add(taskId);
  try {
    codexNativePort.postMessage({
      type: "run",
      id: taskId,
      runtime: aiRuntime,
      mode: "coding",
      prompt,
      page: { title: `${board.name} · 定时任务`, url: "", content: context },
      images: []
    });
    console.info("[pagedock-scheduler] task started", { taskId, boardId, itemId, repeat: schedule.repeat });
  } catch (error) {
    scheduledCodexRuns.delete(taskId);
    codexActiveTaskIds.delete(taskId);
    await failScheduledTask(boardId, itemId, error, true);
  }
}

async function handleScheduledCodexEvent(message, run) {
  if (run.kind === "workflow-job") {
    try {
      if (collectScheduledWorkflowArtifact(message, run)) return;
    } catch (error) {
      try { codexNativePort?.postMessage({ type: "cancel", id: String(message.id) }); } catch {}
      scheduledCodexRuns.delete(String(message.id));
      codexActiveTaskIds.delete(String(message.id));
      run.reject(error);
      return;
    }
    if (!["done", "error", "cancelled"].includes(message.type)) return;
    scheduledCodexRuns.delete(String(message.id));
    codexActiveTaskIds.delete(String(message.id));
    if (message.type === "done") run.resolve({ answer: String(message.answer || ""), artifact: run.artifact });
    else {
      const error = new Error(String(message.error || (message.type === "cancelled" ? "定时工作流已停止" : "定时工作流执行失败")));
      if (message.type === "cancelled") error.code = "WORKFLOW_CANCELLED";
      run.reject(error);
    }
    return;
  }
  if (message.type === "started") {
    chrome.runtime.sendMessage({
      type: "pagedock-data-changed",
      boardIds: [run.boardId],
      itemId: run.itemId,
      reason: "scheduled-task-started",
      source: "task-scheduler"
    }).catch(() => {});
    return;
  }
  if (!["done", "error", "cancelled"].includes(message.type)) return;
  scheduledCodexRuns.delete(String(message.id));
  const success = message.type === "done";
  const result = success ? String(message.answer || "Codex 没有返回内容") : "";
  const error = success ? "" : String(message.error || (message.type === "cancelled" ? "定时任务已停止" : "定时任务执行失败"));
  await mutateScheduledTask(run.boardId, run.itemId, success ? "scheduled-task-completed" : "scheduled-task-failed", item => {
    const schedule = PageDockBoardDomain.normalizeTaskSchedule(item.taskSchedule);
    item.taskSchedule = schedule ? { ...schedule, lastRunAt: Date.now(), lastStatus: success ? "success" : "error", lastError: error } : null;
    item.taskStatus = success ? "success" : (message.type === "cancelled" ? "cancelled" : "error");
    item.taskResult = success ? result : item.taskResult;
    item.taskError = error;
    item.taskProgress = "";
    item.taskRunId = "";
    item.taskCompletedAt = Date.now();
    if (success) item.taskMessages = [...(item.taskMessages || []), {
      id: crypto.randomUUID(),
      role: "assistant",
      kind: "conversation",
      text: result,
      createdAt: Date.now()
    }].slice(-30);
  });
  console.info("[pagedock-scheduler] task finished", { taskId: message.id, boardId: run.boardId, itemId: run.itemId, status: message.type });
}

async function requestNativeControl(type, payload = {}) {
  await connectCodexNative();
  if (!codexNativePort || !nativeHostReady) throw new Error("本地桥接未连接");
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      nativeControlRequests.delete(id);
      reject(new Error("本地请求超时，请重试"));
    }, 15_000);
    nativeControlRequests.set(id, { resolve, reject, timer });
    try {
      codexNativePort.postMessage({ type, id, ...payload });
    } catch (error) {
      nativeControlRequests.delete(id);
      clearTimeout(timer);
      reject(error);
    }
  });
}

async function handleCodexBridgeRequest(message) {
  if (message.type === CODEX_STATUS_REQUEST) {
    await ensureCollaborationState();
    await connectCodexNative();
    return codexSnapshot(message.runtime || aiRuntime, message.taskId);
  }
  if (message.type === CODEX_SESSION_LIST_REQUEST) {
    return requestNativeControl("codex-session-list", { limit: Math.min(30, Math.max(1, Number(message.limit) || 12)) });
  }
  if (message.type === CODEX_SESSION_PREVIEW_REQUEST) {
    const threadId = String(message.threadId || "");
    if (!threadId) throw new Error("缺少 Codex Session ID");
    return requestNativeControl("codex-session-preview", { threadId });
  }
  if (message.type === CODEX_RUN_REQUEST) {
    await connectCodexNative();
    const runtime = normalizeAiRuntime(message.runtime || aiRuntime);
    if (message.mode !== "video-post" && !runtimeReady(runtime)) throw new Error(`本机未找到 ${runtime === "agy" ? "AGY" : "Codex"} CLI`);
    const taskId = String(message.id || "");
    if (!taskId) throw new Error("Codex 任务缺少 id");
    const activeTaskCount = codexActiveTaskIds.size + terminalActiveTaskIds.size;
    if (!codexActiveTaskIds.has(taskId) && activeTaskCount >= CODEX_MAX_CONCURRENT_TASKS) {
      throw new Error(`最多可同时执行 ${CODEX_MAX_CONCURRENT_TASKS} 个本地任务`);
    }
    codexActiveTaskIds.add(taskId);
    codexRecentTerminalEvents.delete(taskId);
    try {
      codexNativePort.postMessage({
        type: "run",
        id: taskId,
        runtime,
        prompt: message.prompt,
        page: message.page,
        images: message.images,
        video: message.video,
        narration: message.narration,
        mode: message.mode
      });
    } catch (error) {
      codexActiveTaskIds.delete(taskId);
      throw error;
    }
    console.info("[pagedock-codex] task forwarded to native host", {
      taskId,
      activeTaskCount: codexActiveTaskIds.size,
      mode: message.mode || "analysis",
      runtime,
      contentLength: String(message.page?.content || "").length,
      imageCount: Array.isArray(message.images) ? message.images.length : 0
    });
    return codexSnapshot(runtime, taskId);
  }
  if (message.type === CODEX_CANCEL_REQUEST) {
    const taskId = String(message.id || "");
    if (!taskId) throw new Error("停止任务缺少 id");
    const controllerId = String(message.controllerId || "");
    const workflowState = controllerId ? scheduledWorkflowControllers.get(controllerId) : null;
    if (workflowState) workflowState.cancelRequested = true;
    const scheduledMatches = [...scheduledCodexRuns.entries()].filter(([id, run]) => id === taskId
      || (controllerId && String(run.controllerId || "") === controllerId));
    const cancellationIds = scheduledMatches.length ? scheduledMatches.map(([id]) => id) : [taskId];
    for (const cancellationId of cancellationIds) {
      if (codexNativePort && codexActiveTaskIds.has(cancellationId)) {
        try {
          codexNativePort.postMessage({ type: "cancel", id: cancellationId });
        } catch (error) {
          console.warn("[pagedock-codex] native cancel delivery failed", {
            taskId: cancellationId,
            reason: error?.message || String(error)
          });
        }
      }
      codexActiveTaskIds.delete(cancellationId);
      const scheduledRun = scheduledCodexRuns.get(cancellationId);
      if (scheduledRun) handleScheduledCodexEvent({ type: "cancelled", id: cancellationId }, scheduledRun).catch(error => {
        console.error("[pagedock-scheduler] cancellation persistence failed", error);
      });
    }
    // 取消是用户侧的确定动作；即使桥接已断开或任务已先行失败，也要立即清掉残留运行态。
    codexActiveTaskIds.delete(taskId);
    const cancelledEvent = { type: "cancelled", id: taskId };
    rememberCodexTerminalEvent(cancelledEvent);
    broadcastCodexEvent(scheduledMatches.length ? { ...cancelledEvent, scheduled: true, controllerId } : cancelledEvent);
    return codexSnapshot(aiRuntime, taskId);
  }
  if (message.type === BRIDGE_SHARE_CREATE_REQUEST) {
    return requestNativeControl("bridge-share-create", { boardId: message.boardId });
  }
  if (message.type === BRIDGE_SHARE_STOP_REQUEST) {
    return requestNativeControl("bridge-share-stop");
  }
  if (message.type === BRIDGE_CLIENT_REVOKE_REQUEST) {
    const clientId = String(message.clientId || "");
    const result = await requestNativeControl("bridge-client-revoke", { clientId });
    externalCodexClients.delete(clientId);
    externalCodexConnected = externalCodexClients.size > 0;
    externalCodexPresence.delete(clientId);
    externalSessionGrants.delete(clientId);
    const policies = { ...externalClientPolicies };
    delete policies[clientId];
    externalClientPolicies = policies;
    await persistCollaborationState();
    broadcastExternalCodexStatus();
    return result;
  }
  throw new Error("不支持的 Codex 桥接请求");
}

async function handleTerminalBridgeRequest(message) {
  await connectCodexNative();
  if (!terminalAvailable) throw new Error("本地桥接未找到可用 Shell");
  const taskId = String(message.id || "");
  if (!taskId) throw new Error("控制台任务缺少 id");
  if ([TERMINAL_SESSION_OPEN_REQUEST, TERMINAL_SESSION_INPUT_REQUEST, TERMINAL_SESSION_RESIZE_REQUEST, TERMINAL_SESSION_CLOSE_REQUEST].includes(message.type)) {
    if (!terminalPtyAvailable) throw new Error("本地桥接缺少交互终端组件，请重新安装");
    const nativeType = {
      [TERMINAL_SESSION_OPEN_REQUEST]: "terminal-session-open",
      [TERMINAL_SESSION_INPUT_REQUEST]: "terminal-session-input",
      [TERMINAL_SESSION_RESIZE_REQUEST]: "terminal-session-resize",
      [TERMINAL_SESSION_CLOSE_REQUEST]: "terminal-session-close"
    }[message.type];
    codexNativePort.postMessage({
      type: nativeType,
      id: taskId,
      data: message.data,
      cols: message.cols,
      rows: message.rows
    });
    if (message.type === TERMINAL_SESSION_CLOSE_REQUEST) terminalSessionIds.delete(taskId);
    if (message.type === TERMINAL_SESSION_OPEN_REQUEST) {
      console.info("[pagedock-terminal] PTY session forwarded", { id: taskId, cols: message.cols, rows: message.rows });
    }
    return codexSnapshot();
  }
  if (message.type === TERMINAL_RUN_REQUEST) {
    const activeTaskCount = codexActiveTaskIds.size + terminalActiveTaskIds.size;
    if (!terminalActiveTaskIds.has(taskId) && activeTaskCount >= CODEX_MAX_CONCURRENT_TASKS) {
      throw new Error(`最多可同时执行 ${CODEX_MAX_CONCURRENT_TASKS} 个本地任务`);
    }
    terminalActiveTaskIds.add(taskId);
    try {
      codexNativePort.postMessage({
        type: "terminal-run",
        id: taskId,
        command: message.command
      });
    } catch (error) {
      terminalActiveTaskIds.delete(taskId);
      throw error;
    }
    console.info("[pagedock-terminal] task forwarded", {
      taskId,
      commandLength: String(message.command || "").length,
      activeTaskCount: codexActiveTaskIds.size + terminalActiveTaskIds.size
    });
    return codexSnapshot();
  }
  if (message.type === TERMINAL_CANCEL_REQUEST) {
    if (codexNativePort && terminalActiveTaskIds.has(taskId)) {
      codexNativePort.postMessage({ type: "terminal-cancel", id: taskId });
    }
    terminalActiveTaskIds.delete(taskId);
    const event = { type: "terminal-cancelled", id: taskId };
    broadcastTerminalEvent(event);
    return codexSnapshot();
  }
  throw new Error("不支持的控制台桥接请求");
}

// 每种网页内容都展开为“收件箱 + 最近白板”，同时保留原网页来源便于回溯。
async function registerContextMenus() {
  if (contextMenuRefresh) return contextMenuRefresh;
  contextMenuRefresh = (async () => {
    const boards = (await PageDockDB.listBoards())
      .filter(board => board.id !== PageDockDB.INBOX_ID)
      .slice(0, RECENT_BOARD_LIMIT);
    const collectionTypes = [
      { type: "selection", title: "保存选中文字到拾作", contexts: ["selection"] },
      { type: "image", title: "保存图片到拾作", contexts: ["image"] },
      { type: "link", title: "保存链接到拾作", contexts: ["link"] },
      { type: "page", title: "保存当前页面到拾作", contexts: ["page"] }
    ];

    await chrome.contextMenus.removeAll();
    for (const entry of collectionTypes) {
      const parentId = `${CONTEXT_MENU_PREFIX}-${entry.type}`;
      chrome.contextMenus.create({
        id: parentId,
        title: entry.title,
        contexts: entry.contexts
      });
      chrome.contextMenus.create({
        id: `${parentId}|${PageDockDB.INBOX_ID}`,
        parentId,
        title: "保存到收件箱",
        contexts: entry.contexts
      });
      for (const board of boards) {
        chrome.contextMenus.create({
          id: `${parentId}|${board.id}`,
          parentId,
          title: `保存到：${board.name}`,
          contexts: entry.contexts
        });
      }
    }
    console.info("[pagedock-context-menu] collection entries registered", {
      recentBoardIds: boards.map(board => board.id)
    });
  })();
  try {
    await contextMenuRefresh;
  } finally {
    contextMenuRefresh = undefined;
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await PageDockDB.ensureInbox();
  await registerContextMenus();
  await recoverInterruptedScheduledTasks();
  await syncAllTaskScheduleAlarms();
  armCodexAutoConnectAlarm();
  ensureCodexAutoConnection("install");
});
chrome.runtime.onStartup.addListener(() => {
  registerContextMenus().catch(error => {
    console.error("[pagedock-context-menu] startup registration failed", error);
  });
  armCodexAutoConnectAlarm();
  recoverInterruptedScheduledTasks()
    .then(syncAllTaskScheduleAlarms)
    .catch(error => console.warn("[pagedock-scheduler] startup sync failed", error));
  ensureCodexAutoConnection("startup");
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === CODEX_AUTO_CONNECT_ALARM) {
    if (!codexNativePort || !nativeHostReady) ensureCodexAutoConnection("scheduled");
    return;
  }
  const scheduled = parseTaskScheduleAlarm(alarm.name);
  if (scheduled) runScheduledTask(scheduled.boardId, scheduled.itemId).catch(error => {
    console.error("[pagedock-scheduler] alarm failed", { ...scheduled, reason: error?.message || String(error) });
  });
});

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== PAGE_CODEX_PORT) return;
  pageCodexPorts.add(port);
  port.onDisconnect.addListener(() => pageCodexPorts.delete(port));
  // Opening any supported web page is sufficient to wake the service worker
  // and connect the local Native Host; no manual connect action is required.
  ensureCodexAutoConnection("page-open");
});

chrome.runtime.onMessage.addListener(message => {
  if (message?.type !== "pagedock-data-changed") return;
  if (message.source !== "codex-bridge") recordExternalBoardChange(message.boardIds, message.itemId, message.reason);
  registerContextMenus().catch(error => {
    console.error("[pagedock-context-menu] refresh failed", error);
  });
});

/* 兼容开发者模式下直接重新载入 service worker。 */
PageDockDB.ensureInbox().then(registerContextMenus).catch(error => {
  console.error("[pagedock-context-menu] initial registration failed", error);
});
recoverInterruptedScheduledTasks()
  .then(syncAllTaskScheduleAlarms)
  .catch(error => console.warn("[pagedock-scheduler] initial sync failed", error));
armCodexAutoConnectAlarm();
ensureCodexAutoConnection("initial");

chrome.contextMenus.onClicked.addListener((info, tab) => {
  collectContextMenuItem(info, tab).catch(error => {
    console.error("[pagedock-context-menu] collection failed", error);
  });
});

async function collectContextMenuItem(info, tab) {
  const matched = String(info.menuItemId).match(
    /^pagedock-save-(selection|image|link|page)\|(.+)$/
  );
  if (!matched) return;
  const [, collectionType, targetBoardId] = matched;
  const source = {
    url: info.pageUrl || tab?.url || "",
    title: tab?.title || "",
    capturedAt: Date.now()
  };
  let item;
  if (collectionType === "selection") {
    item = { type: "text", text: info.selectionText || "", source };
  } else if (collectionType === "image") {
    item = {
      type: "image",
      src: await cacheImageSource(info.srcUrl),
      alt: tab?.title || "网页图片",
      source
    };
  } else if (collectionType === "link") {
    item = {
      type: "link",
      text: info.linkText || info.linkUrl || "网页链接",
      src: info.linkUrl || "",
      source
    };
  } else {
    item = { type: "link", text: tab?.title || source.url, src: source.url, source };
  }
  if (!item.text && !item.src) throw new Error("没有可保存的网页内容");
  const saved = await PageDockDB.addItem(targetBoardId, item);
  chrome.runtime.sendMessage({
    type: "pagedock-data-changed",
    itemId: saved.id,
    boardIds: [targetBoardId],
    reason: "context-menu-collect"
  }).catch(() => {});
  console.info("[pagedock-context-menu] item collected", {
    itemId: saved.id,
    itemType: saved.type,
    targetBoardId,
    sourceUrl: source.url
  });
}

async function cacheImageSource(sourceUrl) {
  if (!sourceUrl || sourceUrl.startsWith("data:image/")) return sourceUrl || "";
  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) throw new Error("目标不是图片");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return `data:${blob.type};base64,${btoa(binary)}`;
  } catch (error) {
    console.warn("[pagedock-context-menu] image cached as URL", {
      sourceUrl,
      reason: error?.message || String(error)
    });
    return sourceUrl;
  }
}

// 工具菜单发起 Markdown 或截图任务；保持消息通道直到任务完成。
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (![MARKDOWN_REQUEST, SCREENSHOT_REQUEST, CODEX_PAGE_CONTEXT_REQUEST, PAGE_CARD_CONTEXT_REQUEST].includes(message?.type)) return;

  const task = message.type === MARKDOWN_REQUEST
    ? captureMarkdown(message)
    : message.type === SCREENSHOT_REQUEST
      ? captureFullPage(message)
      : message.type === PAGE_CARD_CONTEXT_REQUEST
        ? capturePageCardContext(message)
        : captureCodexPageContext();
  task
    .then(result => sendResponse({ ok: true, ...result }))
    .catch(error => {
      console.error(`[${message.type}] task failed`, error);
      sendResponse({
        ok: false,
        error: error?.message || String(error),
        code: error?.code || "",
        requiredOrigin: error?.requiredOrigin || "",
        requiredHost: error?.requiredHost || ""
      });
    });
  return true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (![CODEX_STATUS_REQUEST, CODEX_RUN_REQUEST, CODEX_CANCEL_REQUEST, CODEX_SESSION_LIST_REQUEST, CODEX_SESSION_PREVIEW_REQUEST, BRIDGE_SHARE_CREATE_REQUEST, BRIDGE_SHARE_STOP_REQUEST, BRIDGE_CLIENT_REVOKE_REQUEST].includes(message?.type)) return;
  handleCodexBridgeRequest(message)
    .then(result => sendResponse({ ok: true, ...result }))
    .catch(error => {
      console.error("[pagedock-codex] bridge request failed", {
        type: message.type,
        reason: error?.message || String(error)
      });
      sendResponse({ ok: false, error: error?.message || String(error) });
    });
  return true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (![PAGE_CHAT_GET_REQUEST, PAGE_CHAT_PUT_REQUEST, PAGE_CHAT_DELETE_REQUEST].includes(message?.type)) return;
  const task = message.type === PAGE_CHAT_GET_REQUEST
    ? PageDockDB.getPageChat(message.url)
    : message.type === PAGE_CHAT_PUT_REQUEST
      ? PageDockDB.savePageChat({ url: message.url, title: message.title, messages: message.messages })
      : PageDockDB.deletePageChat(message.url);
  task.then(result => {
    console.info("[pagedock-page-chat] IndexedDB operation completed", {
      type: message.type,
      messageCount: Array.isArray(message.messages) ? message.messages.length : undefined
    });
    sendResponse({ ok: true, result });
  }).catch(error => {
    console.warn("[pagedock-page-chat] IndexedDB operation failed", {
      type: message.type,
      reason: error?.message || String(error)
    });
    sendResponse({ ok: false, error: error?.message || String(error) });
  });
  return true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== TASK_SCHEDULE_SYNC_REQUEST) return;
  syncTaskScheduleAlarm(String(message.boardId || ""), String(message.itemId || ""))
    .then(schedule => sendResponse({ ok: true, schedule }))
    .catch(error => sendResponse({ ok: false, error: error?.message || String(error) }));
  return true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== BRIDGE_APPROVAL_RESPONSE) return;
  const approvalId = String(message.approvalId || "");
  const pending = externalApprovalRequests.get(approvalId);
  if (!pending) {
    sendResponse({ ok: false, error: "此操作确认已失效" });
    return;
  }
  externalApprovalRequests.delete(approvalId);
  clearTimeout(pending.timer);
  if (message.allow === true) {
    if (message.allowMode === "session" && pending.approval?.client?.id) externalSessionGrants.add(pending.approval.client.id);
    pending.resolve();
  }
  else pending.reject(new Error("白板用户拒绝了此操作"));
  console.info("[shizuo-bridge] external mutation approval settled", {
    requestId: pending.requestId,
    allowed: message.allow === true
  });
  sendResponse({ ok: true });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== BRIDGE_CLIENT_POLICY_REQUEST) return;
  const clientId = String(message.clientId || "");
  const policy = ["read", "ask", "edit"].includes(message.policy) ? message.policy : "ask";
  if (!clientId) {
    sendResponse({ ok: false, error: "缺少接入者" });
    return;
  }
  ensureCollaborationState().then(() => {
    externalClientPolicies = { ...externalClientPolicies, [clientId]: policy };
    if (policy !== "edit") externalSessionGrants.delete(clientId);
    return persistCollaborationState();
  }).then(() => sendResponse({ ok: true, policy })).catch(error => sendResponse({ ok: false, error: error?.message || String(error) }));
  return true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (![TERMINAL_RUN_REQUEST, TERMINAL_CANCEL_REQUEST, TERMINAL_SESSION_OPEN_REQUEST, TERMINAL_SESSION_INPUT_REQUEST, TERMINAL_SESSION_RESIZE_REQUEST, TERMINAL_SESSION_CLOSE_REQUEST].includes(message?.type)) return;
  handleTerminalBridgeRequest(message)
    .then(result => sendResponse({ ok: true, ...result }))
    .catch(error => {
      console.error("[pagedock-terminal] bridge request failed", {
        type: message.type,
        reason: error?.message || String(error)
      });
      sendResponse({ ok: false, error: error?.message || String(error) });
    });
  return true;
});

async function captureMarkdown(request) {
  return runExclusive(request.tabId, "Markdown 解析", async () => {
    const tab = await validateSourceTab(request);
    console.info("[capture-markdown] collecting page content", { tabId: tab.id });
    const extracted = await collectPageContent(tab);

    const payload = {
      url: tab.url,
      title: tab.title,
      sourceTabId: tab.id,
      capturedAt: Date.now(),
      ...extracted
    };
    await chrome.storage.local.set({ [CAPTURE_KEY]: payload });
    await chrome.tabs.create({ url: chrome.runtime.getURL("editor.html") });

    console.info("[capture-markdown] editor opened", {
      tabId: tab.id,
      mode: payload.mode,
      textLength: payload.textLength,
      blockCount: payload.blockCount
    });
    return {
      mode: payload.mode,
      textLength: payload.textLength || 0,
      blockCount: payload.blockCount || 0,
      reachedEnd: payload.reachedEnd !== false
    };
  });
}

async function captureCodexPageContext() {
  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!activeTab?.id) throw new Error("找不到当前网页");
  return runExclusive(activeTab.id, "Codex 网页分析", async () => {
    const tab = await validateSourceTab({ tabId: activeTab.id, expectedUrl: activeTab.url });
    console.info("[pagedock-codex] collecting current page", { tabId: tab.id });
    const extracted = await collectPageContent(tab);
    const markdown = await convertCapturedHtmlToMarkdown(tab.id, extracted.html, tab.url);
    console.info("[pagedock-codex] current page collected", {
      tabId: tab.id,
      mode: extracted.mode,
      textLength: extracted.textLength,
      markdownLength: markdown.length,
      reachedEnd: extracted.reachedEnd !== false
    });
    const limitedMarkdown = markdown.length > CODEX_PAGE_CONTENT_LIMIT
      ? `${markdown.slice(0, CODEX_PAGE_CONTENT_LIMIT)}\n\n[拾作：网页内容超过分析上限，已截断]`
      : markdown;
    return {
      title: extracted.title || tab.title || "",
      url: tab.url || "",
      content: limitedMarkdown,
      mode: extracted.mode || "",
      reachedEnd: extracted.reachedEnd !== false
    };
  });
}

function pageOriginPattern(value) {
  const url = new URL(String(value || ""));
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("页面卡地址不是可读取的 HTTP(S) 网页");
  return `${url.protocol}//${url.host}/*`;
}

function waitForTabComplete(tabId, timeoutMs = 45_000) {
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
    };
    const finish = value => {
      cleanup();
      resolve(value);
    };
    const fail = error => {
      cleanup();
      reject(error);
    };
    const onUpdated = (updatedTabId, changeInfo, tab) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") finish(tab);
    };
    const onRemoved = removedTabId => {
      if (removedTabId === tabId) fail(new Error("页面读取标签页已关闭"));
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    timer = setTimeout(() => fail(new Error("页面加载超过 45 秒，请确认网页可以正常打开")), timeoutMs);
    chrome.tabs.get(tabId).then(tab => {
      if (tab?.status === "complete") finish(tab);
    }).catch(fail);
  });
}

async function capturePageCardContext(request) {
  const requestedUrl = new URL(String(request?.url || ""));
  const requestedOrigin = pageOriginPattern(requestedUrl);
  const allowed = await chrome.permissions.contains({ origins: [requestedOrigin] });
  if (!allowed) throw new Error(`尚未允许读取 ${requestedUrl.host} 的页面内容`);

  const created = await chrome.tabs.create({ url: requestedUrl.toString(), active: false });
  if (!created?.id) throw new Error("无法创建页面读取标签页");
  try {
    await waitForTabComplete(created.id);
    // 给动态页面首屏请求和组件渲染留出时间，随后复用完整滚动采集器读取虚拟列表。
    await wait(1_500);
    const tab = await chrome.tabs.get(created.id);
    const finalOrigin = pageOriginPattern(tab.url || requestedUrl);
    if (!await chrome.permissions.contains({ origins: [finalOrigin] })) {
      const error = new Error(`页面跳转到了 ${new URL(tab.url).host}，需要重新授权后读取`);
      error.code = "page-permission-required";
      error.requiredOrigin = finalOrigin;
      error.requiredHost = new URL(tab.url).host;
      throw error;
    }
    console.info("[pagedock-page] collecting page-card content", {
      tabId: tab.id,
      requestedUrl: requestedUrl.toString(),
      finalUrl: tab.url
    });
    const extracted = await collectPageContent(tab);
    const markdown = await convertCapturedHtmlToMarkdown(tab.id, extracted.html, tab.url);
    if (!markdown.trim()) throw new Error("页面没有提取到可分析的正文");
    const content = markdown.length > CODEX_PAGE_CONTENT_LIMIT
      ? `${markdown.slice(0, CODEX_PAGE_CONTENT_LIMIT)}\n\n[拾作：网页内容超过分析上限，已截断]`
      : markdown;
    console.info("[pagedock-page] page-card content collected", {
      tabId: tab.id,
      mode: extracted.mode,
      markdownLength: content.length,
      reachedEnd: extracted.reachedEnd !== false
    });
    return {
      title: extracted.title || tab.title || "",
      url: tab.url || requestedUrl.toString(),
      content,
      mode: extracted.mode || "",
      reachedEnd: extracted.reachedEnd !== false
    };
  } finally {
    await chrome.tabs.remove(created.id).catch(() => {});
  }
}

async function collectPageContent(tab) {
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: [
      "vendor/readability/Readability.js",
      "vendor/turndown/turndown.js",
      "vendor/turndown/turndown-plugin-gfm.js",
      "content-capture.js"
    ]
  });

  // 虚拟滚动页面按区段累计结构化内容；普通页面继续走 Readability。
  const virtualCapture = await callContentCapture(tab.id, "captureMarkdown");
  if (virtualCapture?.html) return virtualCapture;
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractArticle
  });
  return {
    ...result,
    reachedEnd: virtualCapture?.reachedEnd,
    scrollTarget: virtualCapture?.scrollTarget
  };
}

async function convertCapturedHtmlToMarkdown(tabId, html, baseUrl) {
  if (!html) throw new Error("当前网页没有可分析的正文");
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (capturedHtml, pageUrl) => {
      if (typeof TurndownService === "undefined") throw new Error("Markdown 转换器未载入");
      const service = new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
        bulletListMarker: "-"
      });
      if (typeof turndownPluginGfm !== "undefined") service.use(turndownPluginGfm.gfm);
      service.addRule("pagedockAbsoluteLinks", {
        filter: "a",
        replacement(content, node) {
          const href = node.getAttribute("href");
          if (!href || href.startsWith("javascript:") || href.startsWith("#")) return content;
          let absolute = href;
          try { absolute = new URL(href, pageUrl).toString(); } catch (_) {}
          return `[${content}](${absolute})`;
        }
      });
      service.addRule("pagedockAbsoluteImages", {
        filter: "img",
        replacement(_, node) {
          const source = node.getAttribute("src") || node.getAttribute("data-src");
          if (!source || source.startsWith("data:")) return "";
          let absolute = source;
          try { absolute = new URL(source, pageUrl).toString(); } catch (_) {}
          return `![${node.getAttribute("alt") || ""}](${absolute})`;
        }
      });
      return service.turndown(capturedHtml);
    },
    args: [html, baseUrl]
  });
  return String(result || "").trim();
}

async function captureFullPage(request) {
  return runExclusive(request.tabId, "整页截图", async () => {
    const tab = await validateSourceTab(request);
    const [activeTab] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
    if (activeTab?.id !== tab.id) {
      throw new Error("截图期间请保持原网页为当前标签页");
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content-capture.js"]
    });

    console.info("[capture-screenshot] starting scroll capture", { tabId: tab.id });
    const session = await callContentCapture(tab.id, "startScreenshotCapture");
    let offscreenOpen = true;
    let tileCount = 0;
    let totalHeight = session.scrollHeight;
    let reachedEnd = false;
    let stitched;

    try {
      await openScreenshotStitchSession(session.sessionId);
      let nextTop = 0;
      for (let index = 0; index < 200; index += 1) {
        const state = await callContentCapture(
          tab.id,
          "scrollScreenshotCapture",
          [session.sessionId, nextTop, SCREENSHOT_RENDER_SETTLE_MS]
        );
        const [currentActive] = await chrome.tabs.query({
          active: true,
          windowId: tab.windowId
        });
        if (currentActive?.id !== tab.id) {
          throw new Error("截图被中断：请在截图完成前保持原网页为当前标签页");
        }

        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: "png"
        });
        await addScreenshotTile(session.sessionId, { ...state, dataUrl });
        tileCount += 1;
        totalHeight = Math.max(totalHeight, state.scrollHeight);

        if (state.atBottom) {
          const measured = await callContentCapture(
            tab.id,
            "measureScreenshotCapture",
            [session.sessionId, SCREENSHOT_RENDER_SETTLE_MS]
          );
          totalHeight = Math.max(totalHeight, measured.scrollHeight);
          if (measured.scrollHeight <= state.scrollHeight + 1) {
            reachedEnd = true;
            break;
          }
        }

        nextTop = Math.min(
          state.scrollTop + state.clientHeight,
          Math.max(0, totalHeight - state.clientHeight)
        );
        // captureVisibleTab 每秒最多调用两次。
        await wait(550);
      }
      if (!tileCount) throw new Error("浏览器没有捕获到截图画面");
      stitched = await finishScreenshotStitchSession(session.sessionId, totalHeight);
      offscreenOpen = false;
    } finally {
      await callContentCapture(
        tab.id,
        "finishScreenshotCapture",
        [session.sessionId, session.originalScrollTop]
      ).catch(error => {
        console.warn("[capture-screenshot] failed to restore scroll position", error);
      });
      if (offscreenOpen) await chrome.offscreen.closeDocument().catch(() => {});
    }

    const { filename, downloadId } = await downloadScreenshotPdf(
      stitched.dataUrl,
      tab.title
    );

    console.info("[capture-screenshot] download created", {
      tabId: tab.id,
      downloadId,
      pageCount: stitched.pageCount,
      tileCount,
      width: stitched.width,
      height: stitched.height,
      effectiveCssScale: stitched.effectiveCssScale,
      reachedEnd
    });
    return {
      downloadId,
      filename,
      fileCount: 1,
      pageCount: stitched.pageCount,
      width: stitched.width,
      height: stitched.height,
      tileCount,
      reachedEnd
    };
  });
}

async function validateSourceTab(request) {
  if (!Number.isInteger(request.tabId)) {
    throw new Error("找不到当前网页，请关闭菜单后重试");
  }
  const tab = await chrome.tabs.get(request.tabId);
  if (!/^https?:/.test(tab.url || "")) {
    throw new Error("当前页面不支持该操作");
  }
  if (request.expectedUrl && comparableUrl(tab.url) !== comparableUrl(request.expectedUrl)) {
    throw new Error("网页已跳转，请重新打开工具菜单");
  }
  return tab;
}

async function runExclusive(tabId, label, task) {
  if (activeTasks.has(tabId)) {
    throw new Error(`该网页已有任务运行中，请等待完成后再执行${label}`);
  }
  activeTasks.add(tabId);
  try {
    return await task();
  } finally {
    activeTasks.delete(tabId);
  }
}

async function callContentCapture(tabId, method, args = []) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (methodName, methodArgs) => {
      const api = globalThis.__markdownifyCaptureApi;
      if (!api?.[methodName]) throw new Error(`页面采集器不可用：${methodName}`);
      return api[methodName](...methodArgs);
    },
    args: [method, args]
  });
  return result;
}

async function openScreenshotStitchSession(sessionId) {
  await ensureOffscreenDocument();
  const result = await chrome.runtime.sendMessage({
    type: STITCH_INIT_REQUEST,
    sessionId
  });
  if (!result?.ok) throw new Error(result?.error || "截图拼接器初始化失败");
}

async function addScreenshotTile(sessionId, tile) {
  const result = await chrome.runtime.sendMessage({
    type: STITCH_TILE_REQUEST,
    sessionId,
    tile
  });
  if (!result?.ok) throw new Error(result?.error || "截图分片保存失败");
}

async function finishScreenshotStitchSession(sessionId, totalHeight) {
  let result;
  try {
    result = await chrome.runtime.sendMessage({
      type: STITCH_REQUEST,
      sessionId,
      totalHeight
    });
    if (!result?.ok) throw new Error(result?.error || "截图拼接失败");
    return result;
  } finally {
    await chrome.offscreen.closeDocument().catch(() => {});
  }
}

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL("offscreen.html");
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [offscreenUrl]
    });
    if (!contexts.length) await createOffscreenDocument();
  } else {
    await createOffscreenDocument();
  }
}

async function createOffscreenDocument() {
  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["BLOBS"],
      justification: "拼接滚动页面截图并生成本地 PDF"
    });
  } catch (error) {
    if (!/single offscreen document/i.test(error?.message || "")) throw error;
  }
}

function comparableUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch (_) {
    return url || "";
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildScreenshotPdfFilename(title) {
  let safeTitle = String(title || "webpage")
    .normalize("NFKC")
    // Chrome 会拒绝双向控制符、零宽字符等 Unicode 控制/格式字符。
    .replace(/[\p{Cc}\p{Cf}\p{Cs}]/gu, "")
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/^\.+|[. ]+$/g, "");
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(safeTitle)) {
    safeTitle = `webpage-${safeTitle}`;
  }
  safeTitle = truncateUtf8(safeTitle, 160).replace(/[. ]+$/g, "") || "webpage";
  const stamp = screenshotTimestamp();
  return `拾作/${safeTitle}-${stamp}.pdf`;
}

function truncateUtf8(value, maxBytes) {
  const encoder = new TextEncoder();
  let bytes = 0;
  let result = "";
  for (const character of value) {
    const length = encoder.encode(character).length;
    if (bytes + length > maxBytes) break;
    result += character;
    bytes += length;
  }
  return result;
}

function screenshotTimestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
}

async function downloadScreenshotPdf(dataUrl, title) {
  const filename = buildScreenshotPdfFilename(title);
  try {
    const downloadId = await chrome.downloads.download({
      url: dataUrl,
      filename,
      saveAs: true
    });
    return { filename, downloadId };
  } catch (error) {
    if (!/invalid filename/i.test(error?.message || "")) throw error;

    // 极端站点标题仍被平台拒绝时，使用纯 ASCII 文件名兜底，不让截图结果丢失。
    const fallbackFilename = `拾作-${screenshotTimestamp()}.pdf`;
    console.warn("[capture-screenshot] retrying with fallback filename", {
      rejectedFilename: filename,
      fallbackFilename
    });
    const downloadId = await chrome.downloads.download({
      url: dataUrl,
      filename: fallbackFilename,
      saveAs: true
    });
    return { filename: fallbackFilename, downloadId };
  }
}

// 注入到页面上下文执行
function extractArticle() {
  function cleanClone(root) {
    const clone = root.cloneNode(true);
    clone.querySelectorAll("script,style,noscript,iframe,svg,canvas,link,meta")
         .forEach(n => n.remove());
    return clone;
  }

  // 先尝试 Readability
  try {
    const docClone = document.cloneNode(true);
    // 同步剔除噪声节点，避免污染正文识别
    docClone.querySelectorAll("script,style,noscript,iframe,svg,canvas")
            .forEach(n => n.remove());
    const article = new Readability(docClone, { keepClasses: false }).parse();
    if (article && article.content) {
      return {
        mode: "readability",
        title: article.title || document.title,
        byline: article.byline || "",
        excerpt: article.excerpt || "",
        html: article.content,
        textLength: article.textContent?.length || 0
      };
    }
  } catch (_) { /* fall through */ }

  // Fallback：清理后整 body
  const clone = cleanClone(document.body);
  return {
    mode: "fallback",
    title: document.title,
    html: clone.innerHTML,
    textLength: clone.innerText?.length || 0
  };
}
