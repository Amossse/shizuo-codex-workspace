// Module: shared board runtime context and primitive UI operations.
const INITIAL_BOARD_WIDTH = 3200;
const INITIAL_BOARD_HEIGHT = 2200;
const BOARD_EXPANSION_STEP = 1200;
const BOARD_GROW_GUTTER = 320;
const SAVE_DELAY_MS = 320;
const HISTORY_DELAY_MS = 420;
const MARQUEE_DRAG_THRESHOLD_PX = 4;
const MIN_ZOOM = 0.35;
const MAX_ZOOM = 2;
const LEGACY_STORAGE_KEY = "__whiteboard_state__";
const CLIPBOARD_TYPE = "application/x-pagedock-items";
const CODEX_STATUS_REQUEST = "pagedock-codex-status";
const CODEX_RUN_REQUEST = "pagedock-codex-run";
const CODEX_CANCEL_REQUEST = "pagedock-codex-cancel";
const CODEX_SESSION_LIST_REQUEST = "pagedock-codex-session-list";
const CODEX_SESSION_PREVIEW_REQUEST = "pagedock-codex-session-preview";
const TASK_SCHEDULE_SYNC_REQUEST = "pagedock-task-schedule-sync";
const BRIDGE_SHARE_CREATE_REQUEST = "pagedock-bridge-share-create";
const BRIDGE_SHARE_STOP_REQUEST = "pagedock-bridge-share-stop";
const BRIDGE_CLIENT_REVOKE_REQUEST = "pagedock-bridge-client-revoke";
const BRIDGE_APPROVAL_RESPONSE = "pagedock-bridge-approval-response";
const BRIDGE_CLIENT_POLICY_REQUEST = "pagedock-bridge-client-policy";
const CODEX_EVENT = "pagedock-codex-event";
const TERMINAL_RUN_REQUEST = "pagedock-terminal-run";
const TERMINAL_CANCEL_REQUEST = "pagedock-terminal-cancel";
const TERMINAL_SESSION_OPEN_REQUEST = "pagedock-terminal-session-open";
const TERMINAL_SESSION_INPUT_REQUEST = "pagedock-terminal-session-input";
const TERMINAL_SESSION_RESIZE_REQUEST = "pagedock-terminal-session-resize";
const TERMINAL_SESSION_CLOSE_REQUEST = "pagedock-terminal-session-close";
const TERMINAL_EVENT = "pagedock-terminal-event";
const CODEX_CHAT_STORAGE_KEY = "__pagedock_codex_chat_v1__";
const CODEX_PAGE_ATTACHMENT_KEY = "__pagedock_codex_page_attachment_v1__";
const AI_RUNTIME_STORAGE_KEY = "__pagedock_ai_runtime_v1__";
const MAX_CODEX_CHAT_MESSAGES = 24;
const MAX_CODEX_CHAT_CONTEXT_CHARS = 80_000;
const MAX_TASK_MESSAGES = 30;
const TASK_VISIBLE_MESSAGE_LIMIT = 12;
const MAX_CODEX_IMAGES = 12;
const MAX_CODEX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_CODEX_IMAGE_CHUNKS = 96;
const MAX_CODEX_VIDEO_CHUNKS = 256;
const MAX_CODEX_VIDEO_BYTES = 48 * 1024 * 1024;
const MAX_TERMINAL_OUTPUT_CHARS = 120_000;
const MAX_TASK_EVENTS = 60;
const TERMINAL_SAVE_IDLE_MS = 800;
const PAGE_CARD_CONTEXT_REQUEST = "pagedock-page-card-context";
const SVG_NS = "http://www.w3.org/2000/svg";

const db = globalThis.PageDockDB;
const cardProtocol = globalThis.PageDockCardProtocol;
const messageSource = db.makeId("whiteboard");
const homeViewEl = document.getElementById("homeView");
const boardViewEl = document.getElementById("boardView");
const homeToolbarEl = document.getElementById("homeToolbar");
const homeMoreMenuEl = document.getElementById("homeMoreMenu");
const boardToolbarEl = document.getElementById("boardToolbar");
const boardToolsRightEl = document.getElementById("boardToolsRight");
const boardListEl = document.getElementById("boardList");
const recentListEl = document.getElementById("recentList");
const recentHeadingEl = document.getElementById("recentHeading");
const recentHintEl = document.getElementById("recentHint");
const boardCountEl = document.getElementById("boardCount");
const homeSearchEl = document.getElementById("homeSearch");
const quickTextEl = document.getElementById("quickText");
const quickCaptureWrapEl = document.querySelector(".quick-capture-wrap");
const homeJourneyEl = document.getElementById("homeJourney");
const boardNameEl = document.getElementById("boardName");
const addMenuEl = document.getElementById("addMenu");
const exportMenuEl = document.getElementById("exportMenu");
const aiRuntimeSelectEl = document.getElementById("aiRuntimeSelect");
const statusEl = document.getElementById("status");
const workflowTemplateDialogEl = document.getElementById("workflowTemplateDialog");
const homeCollaborationEl = document.getElementById("homeCollaboration");
const homeTemplatesEl = document.getElementById("homeTemplates");
const workflowTemplateNameEl = document.getElementById("workflowTemplateName");
const workflowTemplateListEl = document.getElementById("workflowTemplateList");
const workflowTemplateCountEl = document.getElementById("workflowTemplateCount");
const templateSaveSectionEl = document.getElementById("templateSaveSection");
const versionHistoryDialogEl = document.getElementById("versionHistoryDialog");
const versionHistoryListEl = document.getElementById("versionHistoryList");
const healthCheckDialogEl = document.getElementById("healthCheckDialog");
const healthCheckListEl = document.getElementById("healthCheckList");
const provenanceDialogEl = document.getElementById("provenanceDialog");
const provenanceSummaryEl = document.getElementById("provenanceSummary");
const provenanceChainEl = document.getElementById("provenanceChain");
const taskScheduleDialogEl = document.getElementById("taskScheduleDialog");
const taskScheduleAtEl = document.getElementById("taskScheduleAt");
const taskScheduleRepeatEl = document.getElementById("taskScheduleRepeat");
const taskScheduleExecutionEl = document.getElementById("taskScheduleExecution");
const clearTaskScheduleEl = document.getElementById("clearTaskSchedule");
const viewportEl = document.getElementById("viewport");
const stageEl = document.getElementById("stage");
const boardEl = document.getElementById("board");
const connectionLayerEl = document.getElementById("connectionLayer");
const remotePresenceLayerEl = document.getElementById("remotePresenceLayer");
const emptyStateEl = document.getElementById("emptyState");
const marqueeEl = document.getElementById("selectionMarquee");
const minimapEl = document.getElementById("minimap");
const minimapItemsEl = document.getElementById("minimapItems");
const minimapViewportEl = document.getElementById("minimapViewport");
const zoomLabelEl = document.getElementById("zoomLabel");
const optimizeLayoutEl = document.getElementById("optimizeLayout");
const imageInputEl = document.getElementById("imageInput");
const localFileInputEl = document.getElementById("localFileInput");
const localFolderInputEl = document.getElementById("localFolderInput");
const importInputEl = document.getElementById("importInput");
const newBoardDialogEl = document.getElementById("newBoardDialog");
const newBoardNameEl = document.getElementById("newBoardName");
const pageDialogEl = document.getElementById("pageDialog");
const pageUrlEl = document.getElementById("pageUrl");
const shareBridgeDialogEl = document.getElementById("shareBridgeDialog");
const shareBridgeTextEl = document.getElementById("shareBridgeText");
const shareCodexTextEl = document.getElementById("shareCodexText");
const shareBridgeStatusEl = document.getElementById("shareBridgeStatus");
const shareBridgeButtonEl = document.getElementById("shareBridge");
const copyBridgeShareEl = document.getElementById("copyBridgeShare");
const copyCodexShareEl = document.getElementById("copyCodexShare");
const stopBridgeShareEl = document.getElementById("stopBridgeShare");
const selectionActionsEl = document.getElementById("selectionActions");
const selectionMoreMenuEl = document.getElementById("selectionMoreMenu");
const selectionMorePanelEl = selectionMoreMenuEl.querySelector(".menu-panel");
const selectionActionCountEl = document.getElementById("selectionActionCount");
const askSelectionWithCodexEl = document.getElementById("askSelectionWithCodex");
const extractKnowledgeCardEl = document.getElementById("extractKnowledgeCard");
const summarizeSelectionTextEl = document.getElementById("summarizeSelectionText");
const summarizeSelectionImagesEl = document.getElementById("summarizeSelectionImages");
const summarizeSelectionVideoEl = document.getElementById("summarizeSelectionVideo");
const selectionVideoEngineEl = document.getElementById("selectionVideoEngine");
const selectionAiStatusEl = document.getElementById("selectionAiStatus");
const selectionAiCancelEl = document.getElementById("selectionAiCancel");
const cardFocusLayerEl = document.getElementById("cardFocusLayer");
const codexChatLauncherEl = document.getElementById("codexChatLauncher");
const codexExternalStatusEl = document.getElementById("codexExternalStatus");
const collaborationPanelEl = document.getElementById("collaborationPanel");
const collaborationAvatarEl = document.getElementById("collaborationAvatar");
const collaborationTitleEl = document.getElementById("collaborationTitle");
const collaborationClientsEl = document.getElementById("collaborationClients");
const collaborationLiveEl = document.getElementById("collaborationLive");
const collaborationPetStageEl = document.getElementById("collaborationPetStage");
const collaborationPetStatusEl = document.getElementById("collaborationPetStatus");
const collaborationPetMetaEl = document.getElementById("collaborationPetMeta");
const collaborationPetTitleEl = document.getElementById("collaborationPetTitle");
const collaborationPetMessageEl = document.getElementById("collaborationPetMessage");
const collaborationPetProgressEl = document.getElementById("collaborationPetProgress");
const collaborationPetProgressBarEl = document.getElementById("collaborationPetProgressBar");
const collaborationPetResultEl = document.getElementById("collaborationPetResult");
const collaborationPetResultContentEl = document.getElementById("collaborationPetResultContent");
const collaborationPetActionsEl = document.getElementById("collaborationPetActions");
const collaborationSessionsEl = document.getElementById("collaborationSessions");
const collaborationSessionCountEl = document.getElementById("collaborationSessionCount");
const codexSessionListEl = document.getElementById("codexSessionList");
const codexSessionPreviewEl = document.getElementById("codexSessionPreview");
const codexSessionPreviewTitleEl = document.getElementById("codexSessionPreviewTitle");
const codexSessionPreviewMetaEl = document.getElementById("codexSessionPreviewMeta");
const codexSessionMessagesEl = document.getElementById("codexSessionMessages");
const codexSessionBackEl = document.getElementById("codexSessionBack");
const collaborationConnectionsEl = document.getElementById("collaborationConnections");
const collaborationConnectionCountEl = document.getElementById("collaborationConnectionCount");
const collaborationApprovalsEl = document.getElementById("collaborationApprovals");
const collaborationActivityEl = document.getElementById("collaborationActivity");
const collaborationActivityCountEl = document.getElementById("collaborationActivityCount");
const collaborationActivityListEl = document.getElementById("collaborationActivityList");
const collaborationClientControlsEl = document.getElementById("collaborationClientControls");
const collaborationCloseEl = document.getElementById("collaborationClose");
const boardCollaborationEl = document.getElementById("boardCollaboration");
const codexChatPanelEl = document.getElementById("codexChatPanel");
const codexChatStatusEl = document.getElementById("codexChatStatus");
const codexChatMessagesEl = document.getElementById("codexChatMessages");
const codexChatEmptyEl = document.getElementById("codexChatEmpty");
const codexChatInputEl = document.getElementById("codexChatInput");
const codexChatTargetEl = document.getElementById("codexChatTarget");
const codexChatSendEl = document.getElementById("codexChatSend");
const codexChatStopEl = document.getElementById("codexChatStop");
const codexChatNewEl = document.getElementById("codexChatNew");
const codexSelectionContextEl = document.getElementById("codexSelectionContext");
const codexSelectionCountEl = document.getElementById("codexSelectionCount");
const codexSelectionClearEl = document.getElementById("codexSelectionClear");

let currentBoard;
let scheduledTaskItemId = "";
let boardItems = [];
let selectedIds = new Set();
let highestZ = 1;
let zoom = 1;
let boardWidth = INITIAL_BOARD_WIDTH;
let boardHeight = INITIAL_BOARD_HEIGHT;
let saveTimer;
let statusTimer;
let historyTimer;
let connectionRenderFrame;
let minimapRenderFrame;
let saveInFlight;
let lastStorageEstimateAt = 0;
const boardWriteQueues = new Map();
let lastBoardPoint;
let insertionCascade = 0;
let historyEntries = [];
let historyIndex = -1;
let applyingHistory = false;
let spacePressed = false;
let homeBoards = [];
let homeRecent = [];
let homeSearchTimer;
let homeSearchRequest = 0;
const whiteboardCodexTasks = new Map();
const boardCardCodexTasks = new Map();
const dynamicWorkflowRuns = new Map();
const preparingTaskItemIds = new Set();
const cancellingPreparedTaskItemIds = new Set();
const expandedTaskThreadIds = new Set();
const terminalTasks = new Map();
const terminalSessions = new Map();
const terminalSaveTimers = new Map();
let codexChatTask;
let codexChatReady = false;
let videoEngineHealth = { loaded: false, hyperframes: false, remotion: false };
let aiRuntime = "codex";
let externalCodexConnected = false;
let externalCodexScope = "disabled";
let externalCodexClients = [];
let externalCodexActivities = [];
let externalCodexTasks = [];
let localCodexSessionStatus = {
  active: false,
  activeCount: 0,
  threadId: "",
  title: "",
  startedAt: 0,
  updatedAt: 0
};
let localCodexSessionsAvailable = false;
let localCodexSessions = [];
let selectedLocalCodexSessionId = "";
let localCodexSessionListLoadedAt = 0;
let localCodexSessionListPromise;
let localCodexSessionListRequest = 0;
let localCodexSessionPreviewRequest = 0;
let localPluginCodexTaskStatus;
const externalCodexApprovals = new Map();
let externalClientPolicies = {};
const externalCodexPresence = new Map();
// 协作是按需能力；除非用户主动打开、发起共享或需要审批，否则不抢占画布。
let collaborationPanelDismissed = sessionStorage.getItem("__pagedock_collaboration_closed__") !== "0";
let collaborationLastReadSequence = Math.max(0, Number(sessionStorage.getItem("__pagedock_collaboration_last_read__")) || 0);
let codexActiveTaskIds = new Set();
let codexMaxConcurrentTasks = 3;
let codexChatMessages = [];
let codexAttachedSelectionIds = [];
let codexAttachedPage;
let localRelinkTargetId = "";
let focusedItemId = "";
let focusedItemElement;

function setStatus(message, isError = false, state = "", durationMs = 2600) {
  clearTimeout(statusTimer);
  statusEl.textContent = message;
  statusEl.title = message;
  const explicitState = ["busy", "success", "default"].includes(state) ? state : "";
  const busy = !isError && (explicitState === "busy" || (!explicitState && /正在|保存中|载入|连接|准备|渲染|生成|接收|检查|修复|发送/.test(message)));
  const success = !isError && (explicitState === "success" || (!explicitState && /已(?:保存|添加|生成|导出|导入|备份|复制|连接|恢复|设置)|工作流已完成/.test(message)));
  statusEl.dataset.state = isError ? "error" : explicitState || (busy ? "busy" : success ? "success" : "default");
  // 系统级错误保持可见，直到下一次明确状态更新，避免用户来不及读完就消失。
  if (message && !busy && !isError) {
    statusTimer = setTimeout(() => {
      if (statusEl.textContent === message) statusEl.textContent = "";
    }, Math.max(1200, Number(durationMs) || 2600));
  }
}

function enqueueBoardWrite(boardId, operation) {
  const key = String(boardId || "");
  const previous = boardWriteQueues.get(key) || Promise.resolve();
  const queued = previous.catch(() => {}).then(operation);
  boardWriteQueues.set(key, queued);
  queued.finally(() => {
    if (boardWriteQueues.get(key) === queued) boardWriteQueues.delete(key);
  }).catch(() => {});
  return queued;
}

function notifyDataChanged(boardIds, reason) {
  globalThis.chrome?.runtime?.sendMessage({
    type: "pagedock-data-changed",
    boardIds,
    reason,
    source: messageSource
  }).catch(() => {});
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function applyBoardDimensions() {
  boardEl.style.width = `${boardWidth}px`;
  boardEl.style.height = `${boardHeight}px`;
  connectionLayerEl.style.width = `${boardWidth}px`;
  connectionLayerEl.style.height = `${boardHeight}px`;
  connectionLayerEl.setAttribute("viewBox", `0 0 ${boardWidth} ${boardHeight}`);
  stageEl.style.width = `${boardWidth * zoom}px`;
  stageEl.style.height = `${boardHeight * zoom}px`;
}

function prependBoardSpace(shiftX = 0, shiftY = 0, positionMap = null) {
  if (!shiftX && !shiftY) return;
  for (const item of boardItems) {
    item.x += shiftX;
    item.y += shiftY;
    const element = itemElement(item.id);
    if (element) {
      element.style.left = `${item.x}px`;
      element.style.top = `${item.y}px`;
    }
  }
  if (positionMap) {
    for (const position of positionMap.values()) {
      position.x += shiftX;
      position.y += shiftY;
    }
  }
  if (lastBoardPoint) {
    lastBoardPoint.x += shiftX;
    lastBoardPoint.y += shiftY;
  }
  boardWidth += shiftX;
  boardHeight += shiftY;
  applyBoardDimensions();
  viewportEl.scrollLeft += shiftX * zoom;
  viewportEl.scrollTop += shiftY * zoom;
}

function ensureBoardContains(items, positionMap = null) {
  if (!items.length) return;
  const minX = Math.min(...items.map(item => item.x));
  const minY = Math.min(...items.map(item => item.y));
  const shiftX = minX < 0 ? Math.ceil(-minX / BOARD_EXPANSION_STEP) * BOARD_EXPANSION_STEP : 0;
  const shiftY = minY < 0 ? Math.ceil(-minY / BOARD_EXPANSION_STEP) * BOARD_EXPANSION_STEP : 0;
  if (shiftX || shiftY) prependBoardSpace(shiftX, shiftY, positionMap);
  const maxX = Math.max(...items.map(item => item.x + item.width));
  const maxY = Math.max(...items.map(item => item.y + item.height));
  while (maxX > boardWidth - BOARD_GROW_GUTTER) boardWidth += BOARD_EXPANSION_STEP;
  while (maxY > boardHeight - BOARD_GROW_GUTTER) boardHeight += BOARD_EXPANSION_STEP;
  applyBoardDimensions();
}

function clone(value) {
  return globalThis.structuredClone
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function formatTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function itemLabel(item) {
  if (["file", "folder"].includes(item.type)) return item.localName || item.text || (item.type === "folder" ? "文件夹" : "文件");
  if (["document", "code"].includes(item.type)) return item.text || (item.type === "document" ? "未命名文档" : "未命名代码");
  if (item.type === "image") return item.alt || item.source?.title || "图片";
  if (item.type === "video") return item.alt || item.source?.title || "视频";
  if (item.type === "page") return item.text || item.source?.title || item.src || "页面";
  if (item.type === "terminal") return item.text || "控制台";
  if (item.type === "link") return item.text || item.source?.title || item.src || "链接";
  if (item.type === "task") {
    const lastUserMessage = [...normalizeTaskMessages(item.taskMessages, item)]
      .reverse()
      .find(message => message.role === "user");
    return item.text || lastUserMessage?.text || "未填写任务";
  }
  return item.text || item.source?.title || "文字";
}

function itemIcon(item) {
  if (item.type === "file") return "▰";
  if (item.type === "folder") return "▱";
  if (item.type === "document") return "¶";
  if (item.type === "code") return "</>";
  if (item.type === "image") return "▧";
  if (item.type === "video") return "▶";
  if (item.type === "page") return "▤";
  if (item.type === "terminal") return ">_";
  if (item.type === "link") return "↗";
  if (item.type === "task") return "✓";
  return "T";
}

function itemTypeLabel(item) {
  if (item.type === "file") return "文件";
  if (item.type === "folder") return "文件夹";
  if (item.type === "document" && item.provenance?.operation === "codex-generate-knowledge") return "知识卡";
  if (item.type === "document") return "文档";
  if (item.type === "code") return "代码";
  if (item.type === "image") return "图片";
  if (item.type === "video") return "视频";
  if (item.type === "page") return "页面";
  if (item.type === "terminal") return "控制台";
  if (item.type === "link") return "链接";
  if (item.type === "task") return "任务";
  return "文字";
}

function permissionSummary(item) {
  const permissions = cardProtocol.normalizeMeta(item).permissions;
  const requested = permissions.requested
    .map(permission => cardProtocol.PERMISSIONS[permission]
      ? { id: permission, ...cardProtocol.PERMISSIONS[permission] }
      : null)
    .filter(Boolean);
  if (!requested.length) return null;
  const missing = requested.filter(permission => !permissions.granted.includes(permission.id));
  return {
    label: (missing.length ? missing : requested).map(permission => permission.label).join("、"),
    state: missing.length ? "required" : "granted",
    risk: requested.some(permission => permission.risk === "dangerous") ? "dangerous" : "sensitive"
  };
}

function localCodexTaskIds() {
  return new Set([
    ...whiteboardCodexTasks.keys(),
    ...boardCardCodexTasks.keys(),
    codexChatTask?.id
  ].filter(Boolean));
}

function codexRunningTaskIds() {
  return new Set([...codexActiveTaskIds, ...localCodexTaskIds()]);
}

function codexAtCapacity() {
  return codexRunningTaskIds().size >= codexMaxConcurrentTasks;
}

function codexCapacityReason() {
  const count = codexRunningTaskIds().size;
  return `已有 ${count} 个任务执行中，完成一个后可继续`;
}

function updateCodexTaskSnapshot(response) {
  const ids = Array.isArray(response?.activeTaskIds)
    ? response.activeTaskIds
    : response?.activeTaskId ? [response.activeTaskId] : [];
  codexActiveTaskIds = new Set(ids.map(String).filter(Boolean));
  const limit = Number(response?.maxConcurrentTasks);
  if (Number.isInteger(limit) && limit > 0) codexMaxConcurrentTasks = limit;
}

function trackCodexEvent(message) {
  const id = String(message?.id || "");
  if (!id) return;
  if (["started", "progress", "artifact-start", "artifact-chunk", "artifact-done"].includes(message.type)) {
    codexActiveTaskIds.add(id);
  } else if (["done", "error", "cancelled"].includes(message.type)) {
    codexActiveTaskIds.delete(id);
  }
}

function boardCardTaskForItem(itemId) {
  return [...boardCardCodexTasks.values()]
    .find(task => task.itemId === itemId && task.boardId === currentBoard?.id);
}

function whiteboardTaskForItem(itemId) {
  return [...whiteboardCodexTasks.values()]
    .find(task => task.taskItemId === itemId && task.boardId === currentBoard?.id);
}

function standaloneWhiteboardTask() {
  return [...whiteboardCodexTasks.values()]
    .find(task => !task.taskItemId && task.boardId === currentBoard?.id);
}

function safeFilename(value) {
  return String(value || "拾作")
    .normalize("NFKC")
    .replace(/[\p{Cc}\p{Cf}\p{Cs}]/gu, "")
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100) || "拾作";
}

function normalizedPageUrl(value) {
  const input = String(value || "").trim();
  if (!input) throw new Error("请输入网页地址");
  // 页面卡仅允许远程网页，避免把本地文件或扩展内部地址带入白板。
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(input) ? input : `https://${input}`;
  const url = new URL(candidate);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("只支持 http 或 https 网页地址");
  return url.href;
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
}
