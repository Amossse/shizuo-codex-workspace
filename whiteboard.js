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

async function migrateLegacyBoard() {
  const storage = globalThis.chrome?.storage?.local;
  if (!storage) return;
  const stored = (await storage.get(LEGACY_STORAGE_KEY))[LEGACY_STORAGE_KEY];
  if (!Array.isArray(stored?.items) || !stored.items.length) return;
  const board = await db.createBoard("迁移白板");
  const baseBoard = clone(board);
  board.items = stored.items.map(item => ({
    ...item,
    id: item.id || db.makeId(),
    createdAt: stored.updatedAt || Date.now(),
    updatedAt: stored.updatedAt || Date.now()
  }));
  await db.commitBoardSnapshot(board, { baseBoard, reason: "迁移旧白板" });
  await storage.remove(LEGACY_STORAGE_KEY);
  console.info("[pagedock-db] migrated legacy whiteboard", {
    boardId: board.id,
    itemCount: board.items.length
  });
}

function setView(view) {
  const boardVisible = view === "board";
  document.body.dataset.view = view;
  homeViewEl.classList.toggle("hidden", boardVisible);
  homeToolbarEl.classList.toggle("hidden", boardVisible);
  boardViewEl.classList.toggle("hidden", !boardVisible);
  boardToolbarEl.classList.toggle("hidden", !boardVisible);
  boardToolsRightEl.classList.toggle("hidden", !boardVisible);
  updateCodexSelectionContext();
  updateCodexChatTarget();
  renderCodexChatMessages();
  renderExternalCollaboration();
}

function resetBoardSurfaceUi(event) {
  addMenuEl.open = false;
  exportMenuEl.open = false;
  selectionMoreMenuEl.open = false;
  const blankCanvas = event && [viewportEl, boardEl, document.getElementById("stage")].includes(event.target);
  if (!blankCanvas) return;
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  if (!event.shiftKey) selectItems([]);
}

function setCodexChatStatus(message, state = "default") {
  codexChatStatusEl.textContent = message;
  codexChatStatusEl.title = message;
  codexChatLauncherEl.dataset.state = state;
  codexChatLauncherEl.dataset.connected = String(codexChatReady);
  renderCodexLauncherConnectionStatus();
}

function aiRuntimeLabel() {
  return aiRuntime === "agy" ? "AGY" : "Codex";
}

function updateAiRuntimeCopy() {
  document.getElementById("heroAiName").textContent = "AI";
  document.getElementById("journeyAiName").textContent = "AI";
  document.getElementById("askSelectionWithCodex").textContent = "交给 AI";
  document.getElementById("codexLauncherRuntimeName").textContent = "AI 助手";
  document.getElementById("codexChatRuntimeName").textContent = "AI 助手";
  updateAllTaskItemElements();
}

async function loadAiRuntime() {
  const stored = await chrome.storage.local.get(AI_RUNTIME_STORAGE_KEY);
  aiRuntime = stored[AI_RUNTIME_STORAGE_KEY] === "agy" ? "agy" : "codex";
  aiRuntimeSelectEl.value = aiRuntime;
  updateAiRuntimeCopy();
  aiRuntimeSelectEl.addEventListener("change", async () => {
    aiRuntime = aiRuntimeSelectEl.value === "agy" ? "agy" : "codex";
    await chrome.storage.local.set({ [AI_RUNTIME_STORAGE_KEY]: aiRuntime });
    updateAiRuntimeCopy();
    console.info("[pagedock-ai-runtime] runtime changed", { runtime: aiRuntime });
    await connectCodexChat();
  });
}

function renderCodexLauncherConnectionStatus() {
  const connected = codexChatReady || externalCodexConnected;
  codexExternalStatusEl.dataset.connected = String(connected);
  if (codexChatReady) {
    codexExternalStatusEl.textContent = "本地已连接";
    codexExternalStatusEl.title = "拾作已自动连接本地 Codex";
    return;
  }
  codexExternalStatusEl.textContent = externalCodexConnected
    ? (externalCodexScope === "lan" ? "MCP 内网已接入" : "MCP 已接入")
    : (externalCodexScope === "lan" ? "MCP 内网待接入" : "正在连接本地 Codex");
  codexExternalStatusEl.title = externalCodexConnected
    ? `外部 Codex 已通过${externalCodexScope === "lan" ? "内网" : "本机"} MCP 接入拾作`
    : (externalCodexScope === "lan" ? "拾作已开启内网共享，正在等待同事的 Codex 接入" : "打开拾作后会自动连接本地 Codex");
}

function updateExternalCodexStatus(snapshot = {}) {
  externalCodexConnected = Boolean(snapshot.externalCodexConnected ?? snapshot.connected);
  externalCodexScope = String(snapshot.externalCodexScope || snapshot.scope || externalCodexScope || "local");
  if (Array.isArray(snapshot.externalCodexClients)) externalCodexClients = snapshot.externalCodexClients;
  else if (Array.isArray(snapshot.clients)) externalCodexClients = snapshot.clients;
  if (Array.isArray(snapshot.externalCodexActivities)) externalCodexActivities = snapshot.externalCodexActivities;
  if (Array.isArray(snapshot.externalCodexTasks)) externalCodexTasks = snapshot.externalCodexTasks;
  if (snapshot.localCodexSessionStatus && typeof snapshot.localCodexSessionStatus === "object") {
    localCodexSessionsAvailable = Boolean(snapshot.health?.nativeHost ?? true);
    localCodexSessionStatus = {
      active: Boolean(snapshot.localCodexSessionStatus.active),
      activeCount: Math.max(0, Number(snapshot.localCodexSessionStatus.activeCount) || 0),
      threadId: String(snapshot.localCodexSessionStatus.threadId || ""),
      title: String(snapshot.localCodexSessionStatus.title || ""),
      startedAt: Math.max(0, Number(snapshot.localCodexSessionStatus.startedAt) || 0),
      updatedAt: Math.max(0, Number(snapshot.localCodexSessionStatus.updatedAt) || 0)
    };
  }
  const presence = Array.isArray(snapshot.externalCodexPresence) ? snapshot.externalCodexPresence : Array.isArray(snapshot.presence) ? snapshot.presence : null;
  if (presence) {
    externalCodexPresence.clear();
    presence.forEach(entry => {
      if (entry?.client?.id) externalCodexPresence.set(String(entry.client.id), entry);
    });
    renderRemotePresence();
  }
  if (snapshot.externalClientPolicies && typeof snapshot.externalClientPolicies === "object") externalClientPolicies = snapshot.externalClientPolicies;
  if (Array.isArray(snapshot.externalCodexApprovals)) {
    externalCodexApprovals.clear();
    snapshot.externalCodexApprovals.forEach(approval => externalCodexApprovals.set(String(approval.id || ""), approval));
  }
  if (externalCodexScope !== "lan" && !externalCodexConnected) {
    externalCodexApprovals.clear();
    externalCodexPresence.clear();
    renderRemotePresence();
  }
  renderCodexLauncherConnectionStatus();
  renderExternalCollaboration();
}

function localCodexSessionStateText(state) {
  if (state === "running") return "正在运行";
  if (state === "cancelled") return "已取消";
  return "已完成";
}

function renderLocalCodexSessionList() {
  collaborationSessionCountEl.textContent = localCodexSessions.length ? `${localCodexSessions.length} 个` : "";
  codexSessionListEl.replaceChildren();
  if (!localCodexSessions.length) {
    const empty = document.createElement("div");
    empty.className = "codex-session-empty";
    empty.textContent = localCodexSessionsAvailable ? "最近没有可预览的 Codex Session" : "本地桥接连接后可查看 Codex Sessions";
    codexSessionListEl.appendChild(empty);
    return;
  }
  localCodexSessions.forEach(session => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "codex-session-item";
    row.dataset.state = session.state || "completed";
    row.title = `预览 ${session.title || "Codex Session"}`;
    const dot = document.createElement("span");
    dot.className = "codex-session-dot";
    const copy = document.createElement("span");
    copy.className = "codex-session-copy";
    const title = document.createElement("strong");
    title.textContent = session.title || "未命名 Codex 会话";
    const summary = document.createElement("span");
    summary.textContent = [localCodexSessionStateText(session.state), session.latestText].filter(Boolean).join(" · ");
    const time = document.createElement("time");
    time.className = "codex-session-time";
    time.textContent = formatTime(session.updatedAt || session.modifiedAt);
    copy.append(title, summary);
    row.append(dot, copy, time);
    row.addEventListener("click", () => openLocalCodexSessionPreview(session.threadId));
    codexSessionListEl.appendChild(row);
  });
}

async function loadLocalCodexSessions(force = false) {
  if (localCodexSessionListPromise) return localCodexSessionListPromise;
  if (!force && localCodexSessionListLoadedAt && Date.now() - localCodexSessionListLoadedAt < 3_000) return localCodexSessions;
  const request = ++localCodexSessionListRequest;
  if (!localCodexSessions.length) {
    codexSessionListEl.replaceChildren();
    const loading = document.createElement("div");
    loading.className = "codex-session-empty";
    loading.textContent = "正在读取最近会话…";
    codexSessionListEl.appendChild(loading);
  }
  localCodexSessionListPromise = chrome.runtime.sendMessage({ type: CODEX_SESSION_LIST_REQUEST, limit: 12 })
    .then(response => {
      if (!response?.ok) throw new Error(response?.error || "Codex Session 列表读取失败");
      if (request !== localCodexSessionListRequest) return localCodexSessions;
      localCodexSessionsAvailable = true;
      localCodexSessions = Array.isArray(response.sessions) ? response.sessions : [];
      localCodexSessionListLoadedAt = Date.now();
      renderLocalCodexSessionList();
      return localCodexSessions;
    })
    .catch(error => {
      if (request !== localCodexSessionListRequest) return localCodexSessions;
      codexSessionListEl.replaceChildren();
      const failure = document.createElement("div");
      failure.className = "codex-session-empty";
      failure.textContent = error?.message || "Codex Session 列表读取失败";
      codexSessionListEl.appendChild(failure);
      return localCodexSessions;
    })
    .finally(() => {
      localCodexSessionListPromise = undefined;
    });
  return localCodexSessionListPromise;
}

function closeLocalCodexSessionPreview() {
  selectedLocalCodexSessionId = "";
  localCodexSessionPreviewRequest += 1;
  codexSessionPreviewEl.hidden = true;
  codexSessionListEl.hidden = false;
}

function renderLocalCodexSessionPreview(session) {
  codexSessionPreviewTitleEl.textContent = session.title || "未命名 Codex 会话";
  codexSessionPreviewMetaEl.textContent = [
    localCodexSessionStateText(session.state),
    session.threadId ? `Session ${session.threadId.slice(0, 8)}` : "",
    formatTime(session.updatedAt || session.modifiedAt)
  ].filter(Boolean).join(" · ");
  codexSessionMessagesEl.replaceChildren();
  const entries = Array.isArray(session.entries) ? session.entries : [];
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "codex-session-empty";
    empty.textContent = "这个 Session 暂无可公开预览的消息";
    codexSessionMessagesEl.appendChild(empty);
    return;
  }
  entries.forEach(entry => {
    const message = document.createElement("article");
    message.className = "codex-session-message";
    message.dataset.role = entry.role || "status";
    message.dataset.phase = entry.phase || "";
    const label = document.createElement("div");
    label.className = "codex-session-message-label";
    label.textContent = entry.role === "user"
      ? "你"
      : entry.role === "assistant"
        ? (entry.phase === "final_answer" ? "Codex · 最终回答" : "Codex")
        : "状态";
    const body = document.createElement("div");
    body.className = "codex-session-message-body";
    if (entry.role === "assistant") renderTaskMarkdown(body, String(entry.text || ""));
    else body.textContent = String(entry.text || "");
    message.append(label, body);
    codexSessionMessagesEl.appendChild(message);
  });
  requestAnimationFrame(() => { codexSessionMessagesEl.scrollTop = codexSessionMessagesEl.scrollHeight; });
}

async function openLocalCodexSessionPreview(threadId, refresh = false) {
  const id = String(threadId || "");
  if (!id) return;
  selectedLocalCodexSessionId = id;
  codexSessionListEl.hidden = true;
  codexSessionPreviewEl.hidden = false;
  const request = ++localCodexSessionPreviewRequest;
  if (!refresh) {
    codexSessionPreviewTitleEl.textContent = localCodexSessions.find(session => session.threadId === id)?.title || "Session Preview";
    codexSessionPreviewMetaEl.textContent = "正在读取公开消息…";
    codexSessionMessagesEl.replaceChildren();
  }
  try {
    const response = await chrome.runtime.sendMessage({ type: CODEX_SESSION_PREVIEW_REQUEST, threadId: id });
    if (!response?.ok) throw new Error(response?.error || "Codex Session 预览读取失败");
    if (request !== localCodexSessionPreviewRequest || selectedLocalCodexSessionId !== id) return;
    renderLocalCodexSessionPreview(response.session || {});
  } catch (error) {
    if (request !== localCodexSessionPreviewRequest || selectedLocalCodexSessionId !== id) return;
    codexSessionMessagesEl.replaceChildren();
    const failure = document.createElement("div");
    failure.className = "codex-session-empty";
    failure.textContent = error?.message || "Codex Session 预览读取失败";
    codexSessionMessagesEl.appendChild(failure);
  }
}

function externalActivityPhaseText(activity) {
  if (activity.phase === "approval") return "等待你确认";
  if (activity.phase === "running") return "正在执行";
  if (activity.phase === "completed") return "已完成";
  if (activity.error?.includes("拒绝")) return "已拒绝";
  if (activity.phase === "error") return "执行失败";
  return "";
}

const EXTERNAL_TASK_ACTIVE_PHASES = new Set(["started", "running", "waiting_approval"]);

function externalTaskPhaseText(task) {
  const connected = externalCodexClients.some(client => client.id === task.client?.id);
  if (EXTERNAL_TASK_ACTIVE_PHASES.has(task.phase) && !connected) return "连接中断";
  if (task.phase === "started" || task.phase === "running") return "正在执行";
  if (task.phase === "waiting_approval") return "等待你确认";
  if (task.phase === "completed") return "已完成";
  if (task.phase === "failed") return "执行失败";
  if (task.phase === "cancelled") return "已取消";
  return "";
}

function externalTaskPetState(task) {
  return ["started", "running"].includes(task?.phase)
    ? "running"
    : task?.phase === "waiting_approval"
      ? "waiting"
      : ["failed", "cancelled"].includes(task?.phase)
        ? "failed"
        : task?.phase === "completed" ? "review" : "idle";
}

function externalPetStatusText(state, connected) {
  if (state === "running") return "正在工作";
  if (state === "waiting") return "需要你确认";
  if (state === "review") return "完成啦";
  if (state === "failed") return "遇到问题";
  return connected ? "待命" : "休息中";
}

function externalTaskSummary(task, connected) {
  const text = String(task?.message || (!EXTERNAL_TASK_ACTIVE_PHASES.has(task?.phase) ? task?.result : "") || "").trim();
  if (text) return text.length > 150 ? `${text.slice(0, 147)}…` : text;
  if (task) return externalTaskPhaseText(task) || "任务状态已更新";
  return connected ? "我会在这里告诉你正在做什么。" : "连接 Codex 后，工作状态会在这里呈现。";
}

function appendExternalTaskActions(container, task) {
  if (!container || !task) return;
  const cardIds = Array.isArray(task.cardIds) ? task.cardIds.filter(Boolean).slice(0, 3) : [];
  if (task.result) {
    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "复制结果";
    copy.addEventListener("click", async () => {
      await copyTaskAnswer(task.result);
      setStatus("已复制 Codex 结果");
    });
    container.appendChild(copy);
  }
  if (task.boardId) cardIds.forEach((cardId, index) => {
    const locate = document.createElement("button");
    locate.type = "button";
    locate.textContent = cardIds.length === 1 ? "定位产物" : `定位产物 ${index + 1}`;
    locate.addEventListener("click", () => focusExternalActivity({ boardId: task.boardId, cardId }));
    container.appendChild(locate);
  });
}

function localPluginTaskTitle(task) {
  const prompt = String(task?.prompt || "").replace(/\s+/g, " ").trim();
  return prompt ? (prompt.length > 80 ? `${prompt.slice(0, 77)}…` : prompt) : "Codex 会话";
}

function syncLocalPluginCodexTask(task, phase, details = {}) {
  if (!task?.id) return;
  const previous = localPluginCodexTaskStatus?.sourceTaskId === task.id ? localPluginCodexTaskStatus : {};
  localPluginCodexTaskStatus = {
    ...previous,
    id: `local-plugin:${task.id}`,
    sourceTaskId: task.id,
    phase,
    title: localPluginTaskTitle(task),
    message: String(details.message || previous.message || "").slice(0, 1_000),
    result: details.result === undefined ? (previous.result || "") : String(details.result || "").slice(0, 40_000),
    client: { id: "plugin-local", name: "本地 Codex", scope: "local" },
    createdAt: Number(previous.createdAt) || Number(task.startedAt) || Date.now(),
    updatedAt: Date.now(),
    completedAt: ["completed", "failed", "cancelled"].includes(phase) ? Date.now() : null
  };
  renderExternalCollaboration();
}

async function focusExternalActivity(activity) {
  const boardId = String(activity.boardId || "");
  const cardId = String(activity.cardId || "");
  if (!boardId) return;
  if (currentBoard?.id !== boardId) await openBoard(boardId);
  if (!cardId) return;
  const item = boardItems.find(entry => String(entry.id) === cardId);
  if (!item) return;
  selectItems([cardId], true);
  viewportEl.scrollTo({
    left: Math.max(0, (item.x + item.width / 2) * zoom - viewportEl.clientWidth / 2),
    top: Math.max(0, (item.y + item.height / 2) * zoom - viewportEl.clientHeight / 2),
    behavior: "smooth"
  });
}

function managementEmpty(text) {
  const empty = document.createElement("div");
  empty.className = "empty-home";
  empty.textContent = text;
  return empty;
}

function updateWorkflowTemplateEntry(count) {
  const total = Math.max(0, Number(count) || 0);
  homeTemplatesEl.textContent = `模板库 · ${total}`;
  homeTemplatesEl.title = total ? `查看 ${total} 个工作流模板` : "暂无模板，可先新建或打开白板后保存";
  homeTemplatesEl.setAttribute("aria-label", total ? `模板库，${total} 个模板` : "模板库，暂无模板");
}

function createWorkflowTemplateEmpty() {
  const empty = managementEmpty("");
  empty.classList.add("template-empty");
  const title = document.createElement("strong");
  title.textContent = "暂无工作流模板";
  const detail = document.createElement("span");
  detail.textContent = currentBoard
    ? "填写上方名称，将当前白板保存为可复用模板。"
    : "新建或打开一块白板后，可从右上角“更多”中保存为模板。";
  empty.append(title, detail);
  if (!currentBoard) {
    const create = document.createElement("button");
    create.type = "button";
    create.className = "button primary";
    create.textContent = "新建白板";
    create.addEventListener("click", () => {
      workflowTemplateDialogEl.close();
      openCreateBoardDialog();
    });
    empty.appendChild(create);
  }
  return empty;
}

async function renderWorkflowTemplates() {
  const templates = await db.listTemplates();
  workflowTemplateCountEl.textContent = `${templates.length} 个`;
  updateWorkflowTemplateEntry(templates.length);
  workflowTemplateListEl.replaceChildren();
  if (!templates.length) {
    workflowTemplateListEl.appendChild(createWorkflowTemplateEmpty());
    return;
  }
  for (const template of templates) {
    const row = document.createElement("div");
    row.className = "management-row";
    const copy = document.createElement("div");
    copy.className = "management-row-copy";
    const name = document.createElement("strong");
    name.textContent = template.name || "未命名工作流";
    const detail = document.createElement("span");
    detail.textContent = `${(template.cards || []).length} 张卡片 · ${formatTime(template.updatedAt || template.createdAt)}`;
    copy.append(name, detail);
    const actions = document.createElement("div");
    actions.className = "management-row-actions";
    const create = document.createElement("button");
    create.type = "button";
    create.textContent = "新建白板";
    create.addEventListener("click", async () => {
      create.disabled = true;
      try {
        const board = await db.createBoardFromTemplate(template.id);
        workflowTemplateDialogEl.close();
        notifyDataChanged([board.id], "template-instantiate");
        await openBoard(board.id);
      } catch (error) {
        setStatus(error?.message || "从模板创建失败", true);
        create.disabled = false;
      }
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "删除";
    remove.addEventListener("click", async () => {
      if (!confirm(`删除工作流模板“${template.name}”吗？`)) return;
      await db.deleteTemplate(template.id);
      await renderWorkflowTemplates();
    });
    actions.append(create, remove);
    row.append(copy, actions);
    workflowTemplateListEl.appendChild(row);
  }
}

async function openWorkflowTemplates() {
  templateSaveSectionEl.hidden = !currentBoard;
  workflowTemplateNameEl.value = currentBoard ? `${currentBoard.name} 工作流` : "";
  if (!workflowTemplateDialogEl.open) workflowTemplateDialogEl.showModal();
  try {
    await renderWorkflowTemplates();
  } catch (error) {
    workflowTemplateListEl.replaceChildren(managementEmpty(error?.message || "模板库读取失败"));
  }
}

async function saveCurrentWorkflowTemplate() {
  if (!currentBoard) return;
  await flushSave();
  const name = workflowTemplateNameEl.value.trim() || `${currentBoard.name} 工作流`;
  const cardIds = selectedIds.size ? [...selectedIds] : undefined;
  const template = await db.saveTemplateFromBoard(currentBoard.id, {
    name,
    cardIds,
    description: selectedIds.size ? `来自 ${currentBoard.name} 的所选卡片` : `来自 ${currentBoard.name}`
  });
  setStatus(`已保存工作流模板“${template.name}”`);
  await renderWorkflowTemplates();
}

async function openVersionHistory() {
  if (!currentBoard) return;
  await flushSave();
  versionHistoryListEl.replaceChildren(managementEmpty("正在读取版本…"));
  if (!versionHistoryDialogEl.open) versionHistoryDialogEl.showModal();
  try {
    const revisions = await db.listBoardRevisions(currentBoard.id, { limit: 100 });
    versionHistoryListEl.replaceChildren();
    if (!revisions.length) {
      versionHistoryListEl.appendChild(managementEmpty("当前白板还没有可恢复版本。"));
      return;
    }
    for (const revision of revisions) {
      const row = document.createElement("div");
      row.className = "management-row";
      const copy = document.createElement("div");
      copy.className = "management-row-copy";
      const title = document.createElement("strong");
      title.textContent = `版本 ${revision.revision} · ${revision.reason || "更新白板"}`;
      const detail = document.createElement("span");
      detail.textContent = `${revision.actor?.name || "白板用户"} · ${revision.changedCardCount} 张卡片 · ${new Date(revision.createdAt).toLocaleString()}`;
      copy.append(title, detail);
      const actions = document.createElement("div");
      actions.className = "management-row-actions";
      if (revision.revision < Number(currentBoard.revision || 0)) {
        const restore = document.createElement("button");
        restore.type = "button";
        restore.textContent = "恢复到此版本";
        restore.addEventListener("click", async () => {
          if (!confirm(`恢复到版本 ${revision.revision}？当前状态也会作为新版本保留。`)) return;
          restore.disabled = true;
          try {
            await db.restoreBoardRevision(currentBoard.id, revision.revision);
            versionHistoryDialogEl.close();
            notifyDataChanged([currentBoard.id], "revision-restore");
            await openBoard(currentBoard.id, false);
            setStatus(`已恢复到版本 ${revision.revision}`);
          } catch (error) {
            setStatus(error?.message || "版本恢复失败", true);
            restore.disabled = false;
          }
        });
        actions.appendChild(restore);
      }
      row.append(copy, actions);
      versionHistoryListEl.appendChild(row);
    }
  } catch (error) {
    versionHistoryListEl.replaceChildren(managementEmpty(error?.message || "版本历史读取失败"));
  }
}

async function runHealthCheck() {
  healthCheckListEl.replaceChildren(managementEmpty("正在检查本地连接…"));
  try {
    const snapshot = await chrome.runtime.sendMessage({ type: CODEX_STATUS_REQUEST, runtime: aiRuntime });
    const health = snapshot?.health || {};
    const checks = [
      ["扩展页面", true, "当前页面运行正常", true],
      ["Native Host", health.nativeHost, health.nativeHost ? `版本 ${health.nativeHostVersion || "unknown"}` : "未连接；请运行 ./install.sh --core", true],
      ["Codex CLI", health.codex, health.codex ? "已就绪" : "未找到或未登录", aiRuntime === "codex"],
      ["AGY CLI", health.agy, health.agy ? "已就绪" : "未找到或未登录", aiRuntime === "agy"],
      ["交互终端", health.terminal, health.terminal ? "已就绪" : "可选；运行 ./install.sh --terminal", false],
      ["视频创作", health.hyperframes, health.hyperframes ? "HyperFrames 已就绪" : "可选；运行 ./install.sh --video", false],
      ["MCP 桥接", health.bridge, health.bridge ? `${health.bridgeScope || "local"} · ${health.bridgePort || ""}` : "未启用", false]
    ];
    healthCheckListEl.replaceChildren();
    for (const [label, passed, detail, required] of checks) {
      const row = document.createElement("div");
      row.className = "health-row";
      row.dataset.state = passed ? "pass" : required ? "fail" : "warn";
      const mark = document.createElement("span");
      mark.className = "health-mark";
      mark.textContent = passed ? "●" : required ? "×" : "!";
      const copy = document.createElement("div");
      copy.className = "management-row-copy";
      const name = document.createElement("strong");
      name.textContent = label;
      const description = document.createElement("span");
      description.textContent = detail;
      copy.append(name, description);
      row.append(mark, copy);
      healthCheckListEl.appendChild(row);
    }
  } catch (error) {
    healthCheckListEl.replaceChildren(managementEmpty(`健康检查失败：${error?.message || "无法连接扩展后台"}`));
  }
}

function openHealthCheck() {
  if (!healthCheckDialogEl.open) healthCheckDialogEl.showModal();
  runHealthCheck();
}

function openProvenance(item) {
  const provenance = item?.provenance || {};
  provenanceSummaryEl.textContent = `卡片版本 ${item?.revision || 1} · ${provenance.operation || "manual"}`;
  provenanceChainEl.replaceChildren();
  if (provenance.template?.id) {
    const row = document.createElement("div");
    row.className = "management-row";
    row.textContent = `工作流模板 · ${provenance.template.name || provenance.template.id}`;
    provenanceChainEl.appendChild(row);
  }
  for (const parent of provenance.parents || []) {
    const row = document.createElement("div");
    row.className = "management-row";
    const copy = document.createElement("div");
    copy.className = "management-row-copy";
    const title = document.createElement("strong");
    title.textContent = parent.kind === "external" ? (parent.title || "网页来源") : `上游卡片 · ${parent.cardId}`;
    const detail = document.createElement("span");
    detail.textContent = parent.kind === "external" ? parent.url : `${parent.boardId || currentBoard?.id} · 版本 ${parent.cardRevision || "未知"}`;
    copy.append(title, detail);
    const actions = document.createElement("div");
    actions.className = "management-row-actions";
    const open = document.createElement("button");
    open.type = "button";
    open.textContent = "打开";
    open.addEventListener("click", () => {
      provenanceDialogEl.close();
      if (parent.kind === "external") window.open(parent.url, "_blank", "noopener,noreferrer");
      else focusExternalActivity({ boardId: parent.boardId || currentBoard?.id, cardId: parent.cardId });
    });
    actions.appendChild(open);
    row.append(copy, actions);
    provenanceChainEl.appendChild(row);
  }
  if (!provenanceChainEl.children.length) provenanceChainEl.appendChild(managementEmpty("此卡片由用户直接创建，没有上游来源。"));
  provenanceDialogEl.showModal();
}

async function settleExternalApproval(approval, allow, buttons, allowMode = "once") {
  buttons.forEach(button => { button.disabled = true; });
  try {
    const response = await chrome.runtime.sendMessage({
      type: BRIDGE_APPROVAL_RESPONSE,
      approvalId: approval.id,
      allow,
      allowMode
    });
    if (!response?.ok) throw new Error(response?.error || "操作确认失败");
    externalCodexApprovals.delete(String(approval.id || ""));
    renderExternalCollaboration();
    setStatus(allow ? (allowMode === "session" ? `本次会话已允许 ${approval.client?.name || "Codex"} 编辑` : `已允许 ${approval.client?.name || "Codex"} 执行一次`) : "已拒绝外部修改");
  } catch (error) {
    buttons.forEach(button => { button.disabled = false; });
    setStatus(error?.message || "操作确认失败", true);
  }
}

function renderExternalCollaboration() {
  const available = externalCodexScope === "lan" || externalCodexConnected || externalCodexApprovals.size > 0
    || localCodexSessionsAvailable || localCodexSessionStatus.active || localPluginCodexTaskStatus || externalCodexTasks.length > 0 || externalCodexActivities.length > 0;
  const visible = available && !collaborationPanelDismissed;
  const latestSequence = Math.max(0,
    ...externalCodexActivities.map(entry => Number(entry.sequence) || 0),
    ...externalCodexTasks.map(entry => Number(entry.sequence) || 0),
    ...[...externalCodexPresence.values()].map(entry => Number(entry.sequence) || 0)
  );
  const unread = [
    ...externalCodexActivities,
    ...externalCodexTasks,
    ...externalCodexPresence.values()
  ].filter(entry => Number(entry.sequence) > collaborationLastReadSequence).length;
  if (visible && latestSequence > collaborationLastReadSequence) {
    collaborationLastReadSequence = latestSequence;
    sessionStorage.setItem("__pagedock_collaboration_last_read__", String(latestSequence));
  }
  collaborationPanelEl.hidden = !visible;
  boardCollaborationEl.disabled = !available;
  boardCollaborationEl.textContent = visible ? "收起协作" : `协作与会话${unread ? ` · ${unread}` : ""}`;
  homeCollaborationEl.disabled = !available;
  homeCollaborationEl.textContent = visible ? "收起协作" : `协作与会话${unread ? ` · ${unread}` : ""}`;
  if (!visible) return;
  collaborationSessionsEl.hidden = !localCodexSessionsAvailable;
  if (localCodexSessionsAvailable && collaborationSessionsEl.open) void loadLocalCodexSessions();
  const activeNames = externalCodexClients.map(client => String(client.name || "Codex"));
  const humanNames = externalCodexClients.filter(client => client.type === "human").map(client => String(client.name || "协作者"));
  const humanConnected = humanNames.length > 0;
  const activeTasks = externalCodexTasks.filter(task => EXTERNAL_TASK_ACTIVE_PHASES.has(task.phase));
  const automaticTask = localCodexSessionStatus.active ? {
    id: `local-session:${localCodexSessionStatus.threadId || "active"}`,
    phase: "running",
    title: localCodexSessionStatus.title || "Codex 正在工作",
    message: localCodexSessionStatus.activeCount > 1
      ? `${localCodexSessionStatus.activeCount} 个本地 Codex 任务正在执行`
      : "正在执行本地 Codex 任务",
    client: { id: "owner-local", name: "本地 Codex", scope: "local" },
    createdAt: localCodexSessionStatus.startedAt,
    updatedAt: localCodexSessionStatus.updatedAt || localCodexSessionStatus.startedAt
  } : null;
  const pluginTask = localPluginCodexTaskStatus || null;
  const visibleActiveTasks = [pluginTask, automaticTask, ...activeTasks].filter(task => EXTERNAL_TASK_ACTIVE_PHASES.has(task?.phase));
  const codexConnected = codexChatReady || localCodexSessionsAvailable || externalCodexConnected || activeNames.length > 0 || localCodexSessionStatus.active || Boolean(pluginTask);
  // 已连接但当前空闲时回到待命，不再把上一次完成任务长期当作当前状态展示。
  // 插件内发起的会话有完整阶段和结果，优先于 Codex Desktop 只能提供标题的泛化状态。
  const primaryTask = pluginTask || automaticTask || activeTasks[0] || (!codexConnected ? externalCodexTasks[0] : null) || null;
  const primaryClientIsLocal = primaryTask?.client?.scope === "local" || primaryTask?.client?.id === "owner-local";
  collaborationAvatarEl.textContent = "C";
  collaborationTitleEl.textContent = humanConnected ? "白板协作" : activeNames.length > 1 ? `${activeNames.length} 个 Codex` : "Codex 工作伙伴";
  collaborationClientsEl.textContent = visibleActiveTasks.length > 1
    ? `${visibleActiveTasks.length} 个任务正在执行`
    : primaryTask?.title || (humanConnected ? `${humanNames.join("、")} 正在协作` : codexConnected ? "已连接，随时待命" : "等待接入");
  collaborationLiveEl.textContent = primaryClientIsLocal ? "本机" : externalCodexScope === "lan" ? "内网" : codexConnected ? "本机" : "历史";

  const petState = externalTaskPetState(primaryTask);
  collaborationPetStageEl.dataset.state = petState;
  collaborationPetStatusEl.textContent = externalPetStatusText(petState, codexConnected);
  collaborationPetTitleEl.textContent = primaryTask?.title || (humanConnected ? "协作者已加入白板" : codexConnected ? "随时可以开始" : "等待 Codex 接入");
  collaborationPetMessageEl.textContent = primaryTask ? externalTaskSummary(primaryTask, codexConnected) : humanConnected ? "对方可以实时查看白板，修改仍受你的权限设置控制" : externalTaskSummary(primaryTask, codexConnected);
  collaborationPetMetaEl.textContent = primaryTask
    ? [primaryClientIsLocal ? "本地 Codex" : (primaryTask.client?.name || "Codex"), formatTime(primaryTask.updatedAt || primaryTask.createdAt)].filter(Boolean).join(" · ")
    : "";
  const progress = Number(primaryTask?.progress);
  const hasProgress = primaryTask?.progress !== null && primaryTask?.progress !== undefined && Number.isFinite(progress);
  collaborationPetProgressEl.hidden = !hasProgress;
  collaborationPetProgressBarEl.style.width = hasProgress ? `${Math.min(100, Math.max(0, progress))}%` : "0%";
  if (collaborationPetResultEl.dataset.taskId !== String(primaryTask?.id || "")) {
    collaborationPetResultEl.open = false;
    collaborationPetResultEl.dataset.taskId = String(primaryTask?.id || "");
  }
  collaborationPetResultEl.hidden = !primaryTask?.result;
  collaborationPetResultContentEl.textContent = primaryTask?.result || "";
  collaborationPetActionsEl.replaceChildren();
  appendExternalTaskActions(collaborationPetActionsEl, primaryTask);

  collaborationClientControlsEl.replaceChildren();
  const manageableClients = externalCodexClients.filter(client => client.scope !== "local" && client.id !== "owner-local");
  collaborationConnectionsEl.hidden = !manageableClients.length;
  collaborationConnectionCountEl.textContent = manageableClients.length ? `${manageableClients.length} 个` : "";
  manageableClients.forEach(client => {
    const row = document.createElement("div");
    row.className = "collaboration-client-row";
    const name = document.createElement("span");
    name.textContent = client.name || "Codex";
    const policy = document.createElement("select");
    [["read", "只读"], ["ask", "每次询问"], ["edit", "可编辑"]].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      policy.appendChild(option);
    });
    policy.value = externalClientPolicies[client.id] || (client.type === "human" ? "edit" : "ask");
    policy.addEventListener("change", async () => {
      const response = await chrome.runtime.sendMessage({ type: BRIDGE_CLIENT_POLICY_REQUEST, clientId: client.id, policy: policy.value });
      if (!response?.ok) setStatus(response?.error || "权限更新失败", true);
      else externalClientPolicies = { ...externalClientPolicies, [client.id]: policy.value };
    });
    const revoke = document.createElement("button");
    revoke.type = "button";
    revoke.className = "collaboration-client-revoke";
    revoke.textContent = "撤销";
    revoke.title = `撤销 ${client.name || "Codex"} 的连接令牌`;
    revoke.addEventListener("click", async () => {
      revoke.disabled = true;
      try {
        const response = await chrome.runtime.sendMessage({ type: BRIDGE_CLIENT_REVOKE_REQUEST, clientId: client.id });
        if (!response?.ok) throw new Error(response?.error || "撤销失败");
        externalCodexClients = externalCodexClients.filter(entry => entry.id !== client.id);
        externalCodexPresence.delete(client.id);
        renderExternalCollaboration();
        renderRemotePresence();
        setStatus(`已撤销 ${client.name || "Codex"} 的连接`);
      } catch (error) {
        revoke.disabled = false;
        setStatus(error?.message || "撤销接入者失败", true);
      }
    });
    row.append(name, policy, revoke);
    collaborationClientControlsEl.appendChild(row);
  });

  collaborationApprovalsEl.replaceChildren();
  for (const approval of externalCodexApprovals.values()) {
    const card = document.createElement("section");
    card.className = "collaboration-approval";
    const title = document.createElement("strong");
    title.textContent = `${approval.client?.name || "Codex"} 请求${approval.label || "修改白板"}`;
    const summary = document.createElement("span");
    summary.textContent = approval.summary || "此操作会修改拾作白板";
    const actions = document.createElement("div");
    actions.className = "collaboration-approval-actions";
    const reject = document.createElement("button");
    reject.type = "button";
    reject.textContent = "拒绝";
    const allow = document.createElement("button");
    allow.type = "button";
    allow.className = "allow";
    allow.textContent = "允许一次";
    const allowSession = document.createElement("button");
    allowSession.type = "button";
    allowSession.className = "allow";
    allowSession.textContent = "本次会话允许";
    const buttons = [reject, allow, allowSession];
    reject.addEventListener("click", () => settleExternalApproval(approval, false, buttons));
    allow.addEventListener("click", () => settleExternalApproval(approval, true, buttons));
    allowSession.addEventListener("click", () => settleExternalApproval(approval, true, buttons, "session"));
    actions.append(reject, allow, allowSession);
    card.append(title, summary, actions);
    collaborationApprovalsEl.appendChild(card);
  }

  collaborationActivityListEl.replaceChildren();
  collaborationActivityEl.hidden = !externalCodexActivities.length;
  collaborationActivityCountEl.textContent = externalCodexActivities.length ? `${Math.min(10, externalCodexActivities.length)} 条` : "";
  if (!externalCodexActivities.length) {
    const empty = document.createElement("div");
    empty.className = "collaboration-activity-title";
    empty.textContent = "接入后的读取和修改会实时显示在这里";
    collaborationActivityListEl.appendChild(empty);
  } else externalCodexActivities.slice(0, 10).forEach(activity => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "collaboration-activity-item";
    row.dataset.phase = String(activity.phase || "");
    row.dataset.locatable = String(Boolean(activity.boardId));
    const dot = document.createElement("span");
    dot.className = "collaboration-activity-dot";
    const copy = document.createElement("span");
    copy.className = "collaboration-activity-copy";
    const title = document.createElement("strong");
    const activityIsLocal = activity.client?.scope === "local" || activity.client?.id === "owner-local";
    title.textContent = activityIsLocal
      ? activity.label || "操作白板"
      : `${activity.client?.name || "Codex"} · ${activity.label || "操作白板"}`;
    const detail = document.createElement("span");
    detail.textContent = [externalActivityPhaseText(activity), activity.summary].filter(Boolean).join(" · ");
    const time = document.createElement("span");
    time.className = "collaboration-activity-time";
    time.textContent = formatTime(activity.updatedAt || activity.createdAt);
    copy.append(title, detail);
    row.append(dot, copy, time);
    if (activity.boardId) row.addEventListener("click", () => focusExternalActivity(activity));
    collaborationActivityListEl.appendChild(row);
  });

}

function handleExternalCollaborationEvent(event) {
  if (event?.type === "local-codex-session-status") {
    const status = event.status || {};
    localCodexSessionsAvailable = event.available !== false;
    localCodexSessionStatus = {
      active: Boolean(status.active),
      activeCount: Math.max(0, Number(status.activeCount) || 0),
      threadId: String(status.threadId || ""),
      title: String(status.title || ""),
      startedAt: Math.max(0, Number(status.startedAt) || 0),
      updatedAt: Math.max(0, Number(status.updatedAt) || 0)
    };
    renderExternalCollaboration();
    if (collaborationSessionsEl.open && !collaborationPanelDismissed) {
      void loadLocalCodexSessions(true).then(() => {
        if (selectedLocalCodexSessionId) void openLocalCodexSessionPreview(selectedLocalCodexSessionId, true);
      });
    }
    return;
  }
  if (event?.type === "external-codex-task" && event.task?.id) {
    externalCodexTasks = [
      event.task,
      ...externalCodexTasks.filter(task => task.id !== event.task.id)
    ].slice(0, 100);
    renderExternalCollaboration();
    return;
  }
  if (event?.type === "external-codex-presence" && event.presence?.client?.id) {
    externalCodexPresence.set(event.presence.client.id, event.presence);
    renderRemotePresence();
    return;
  }
  if (event?.type === "external-card-stream" && event.boardId === currentBoard?.id) {
    const item = boardItems.find(entry => entry.id === event.cardId);
    const element = itemElement(event.cardId);
    if (item && element) {
      item.text = String(event.text || "");
      const editor = element.querySelector(".text-content,.document-editor,.code-editor,.task-prompt");
      if (editor instanceof HTMLTextAreaElement) editor.value = item.text;
      else if (editor) editor.textContent = item.text;
    }
    return;
  }
  if (event?.type === "external-codex-approval" && event.approval?.id) {
    collaborationPanelDismissed = false;
    sessionStorage.setItem("__pagedock_collaboration_closed__", "0");
    externalCodexApprovals.set(String(event.approval.id), event.approval);
    renderExternalCollaboration();
    return;
  }
  if (event?.type !== "external-codex-activity" || !event.activity?.requestId) return;
  externalCodexActivities = [
    event.activity,
    ...externalCodexActivities.filter(activity => activity.requestId !== event.activity.requestId)
  ].slice(0, 30);
  if (event.activity.phase !== "approval") {
    for (const [id, approval] of externalCodexApprovals) {
      if (approval.requestId === event.activity.requestId) externalCodexApprovals.delete(id);
    }
  }
  renderExternalCollaboration();
}

function renderRemotePresence() {
  remotePresenceLayerEl.replaceChildren();
  document.querySelectorAll(".board-item.remote-selected").forEach(element => element.classList.remove("remote-selected"));
  for (const presence of externalCodexPresence.values()) {
    if (Number(presence.updatedAt) + 45_000 <= Date.now()) {
      externalCodexPresence.delete(String(presence.client?.id || ""));
      continue;
    }
    if (!currentBoard || presence.boardId !== currentBoard.id) continue;
    for (const cardId of presence.cardIds || []) itemElement(cardId)?.classList.add("remote-selected");
    if (!presence.hasPointer) continue;
    const cursor = document.createElement("div");
    cursor.className = "remote-presence";
    cursor.style.left = `${Math.max(0, Number(presence.x) || 0)}px`;
    cursor.style.top = `${Math.max(0, Number(presence.y) || 0)}px`;
    const pointer = document.createElement("div");
    pointer.className = "remote-presence-pointer";
    const label = document.createElement("div");
    label.className = "remote-presence-label";
    label.textContent = [presence.client?.name || "Codex", presence.state].filter(Boolean).join(" · ");
    cursor.append(pointer, label);
    remotePresenceLayerEl.appendChild(cursor);
  }
}

function codexChatElapsedText(task) {
  const seconds = Math.max(0, Math.floor((Date.now() - task.startedAt) / 1000));
  return `${seconds} 秒`;
}

function refreshCodexChatLoadingTime(task) {
  if (codexChatTask !== task) return;
  const loading = codexChatMessagesEl.querySelector(`.codex-message.loading[data-task-id="${task.id}"]`);
  const elapsed = loading?.querySelector(".codex-loading-time");
  if (elapsed) elapsed.textContent = codexChatElapsedText(task);
}

function updateCodexChatProgress(task, progressText) {
  if (!task || codexChatTask !== task) return;
  task.progressText = String(progressText || "Codex 正在处理…");
  setCodexChatStatus(task.progressText, "loading");
  renderCodexChatMessages();
  syncLocalPluginCodexTask(task, "running", { message: task.progressText });
}

function friendlyCodexProgress(message, fallback = "正在处理任务") {
  const stages = {
    thinking: "正在理解问题并组织回答",
    working: "正在处理任务",
    "running-command": "正在运行检查或命令",
    "using-tool": "正在调用工具",
    "updating-files": "正在更新文件",
    searching: "正在检索资料",
    planning: "正在规划执行步骤",
    "reading-page": "正在读取页面内容",
    "building-video": "正在组装画面",
    "checking-video": "正在组装画面",
    "retrying-video-check": "正在组装画面",
    "repairing-video": "正在组装画面",
    "repairing-render": "正在组装画面",
    "rendering-video": "正在导出视频",
    "packaging-video": "正在导出视频",
    "generating-image": "Codex 正在自由绘图",
    "packaging-image": "正在将图片添加到白板"
  };
  return String(message?.label || stages[String(message?.stage || "")] || fallback);
}

function normalizeTaskEvent(event) {
  return {
    id: String(event?.id || db.makeId("task-event")),
    stage: String(event?.stage || "working").slice(0, 80),
    label: String(event?.label || "正在处理任务").slice(0, 300),
    detail: String(event?.detail || "").slice(0, 1_500),
    status: ["running", "success", "error", "cancelled"].includes(event?.status) ? event.status : "running",
    createdAt: Number(event?.createdAt) || Date.now()
  };
}

function compactTaskEvents(taskEvents) {
  const events = (Array.isArray(taskEvents) ? taskEvents : []).map(normalizeTaskEvent);
  const seen = new Set();
  const compacted = [];
  // 多个底层阶段可能映射成同一句用户文案；只保留最新一次，避免过程面板刷屏。
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    const key = `${event.status}\u0000${event.label.trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    compacted.unshift(event);
  }
  return compacted.slice(-MAX_TASK_EVENTS);
}

function appendTaskEvent(item, event) {
  if (!item || item.type !== "task") return;
  const next = normalizeTaskEvent(event);
  item.taskEvents = compactTaskEvents([...(item.taskEvents || []), next]);
}

function taskElapsedText(startedAt, completedAt = 0) {
  if (!startedAt) return "";
  const elapsed = Math.max(0, (completedAt || Date.now()) - startedAt);
  const seconds = Math.floor(elapsed / 1000);
  if (seconds < 60) return `${seconds} 秒`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} 分 ${seconds % 60} 秒` : `${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分`;
}

function createTaskProcess(item, active) {
  const events = compactTaskEvents(item.taskEvents);
  if (!events.length && !active) return null;
  const details = document.createElement("details");
  details.className = "task-process";
  details.open = active;
  const summary = document.createElement("summary");
  const latest = events.at(-1);
  const label = document.createElement("span");
  label.className = "task-process-summary";
  label.textContent = active ? (item.taskProgress || latest?.label || "正在处理任务") : `过程记录 · ${events.length} 步`;
  const elapsed = document.createElement("time");
  elapsed.className = "task-process-elapsed";
  elapsed.dataset.startedAt = String(item.taskStartedAt || 0);
  elapsed.dataset.completedAt = String(item.taskCompletedAt || 0);
  elapsed.textContent = taskElapsedText(item.taskStartedAt, item.taskCompletedAt);
  summary.append(label, elapsed);
  const list = document.createElement("ol");
  list.className = "task-process-list";
  events.slice(-12).forEach(event => {
    const row = document.createElement("li");
    row.dataset.state = event.status;
    const marker = document.createElement("span");
    marker.className = "task-process-marker";
    const copy = document.createElement("span");
    copy.className = "task-process-copy";
    const title = document.createElement("strong");
    title.textContent = event.label;
    copy.appendChild(title);
    if (event.detail) {
      const detail = document.createElement("span");
      detail.textContent = event.detail;
      detail.title = event.detail;
      copy.appendChild(detail);
    }
    row.append(marker, copy);
    list.appendChild(row);
  });
  details.append(summary, list);
  return details;
}

function refreshTaskElapsedLabels() {
  document.querySelectorAll(".task-process-elapsed[data-started-at]").forEach(element => {
    const startedAt = Number(element.dataset.startedAt) || 0;
    const completedAt = Number(element.dataset.completedAt) || 0;
    element.textContent = taskElapsedText(startedAt, completedAt);
  });
}

function recordTaskProgress(item, message, fallback) {
  if (!item) return;
  const label = friendlyCodexProgress(message, fallback);
  item.taskProgress = label;
  appendTaskEvent(item, {
    stage: message?.stage || "working",
    label,
    detail: message?.detail || "",
    status: message?.status || "running",
    createdAt: message?.createdAt
  });
  item.updatedAt = Date.now();
  updateTaskItemElement(item);
  scheduleSave();
}

function startCodexChatProgress(task) {
  task.startedAt = Date.now();
  task.progressText = "正在准备会话上下文…";
  task.progressTimer = setInterval(() => refreshCodexChatLoadingTime(task), 1000);
  updateCodexChatProgress(task, task.progressText);
}

function stopCodexChatProgress(task) {
  if (!task) return;
  clearInterval(task.progressTimer);
  task.progressTimer = undefined;
}

function setCodexChatOpen(open) {
  codexChatPanelEl.hidden = !open;
  codexChatLauncherEl.classList.toggle("hidden", open);
  codexChatLauncherEl.setAttribute("aria-expanded", String(open));
  sessionStorage.setItem("__pagedock_codex_chat_open__", open ? "1" : "0");
  if (open) {
    codexChatLauncherEl.dataset.hasUpdate = "false";
    updateCodexSelectionContext();
    requestAnimationFrame(() => codexChatInputEl.focus());
  }
}

function updateCodexChatTarget() {
  if (!codexChatTargetEl) return;
  const context = codexAttachedPage ? "已附加网页 · " : "";
  codexChatTargetEl.textContent = currentBoard
    ? `${context}回答可添加到：${currentBoard.name}`
    : "回答可保存到收件箱";
}

function updateCodexChatControls() {
  const running = Boolean(codexChatTask);
  const atCapacity = !running && codexAtCapacity();
  codexChatSendEl.disabled = !codexChatReady || running || atCapacity || !codexChatInputEl.value.trim();
  codexChatSendEl.title = !codexChatReady
    ? "连接 Codex 后可发送"
    : atCapacity
    ? codexCapacityReason()
    : running ? "当前回答完成后可继续发送" : "发送给 Codex";
  codexChatSendEl.dataset.state = running ? "loading" : "default";
  codexChatStopEl.hidden = !running;
  codexChatStopEl.disabled = Boolean(codexChatTask?.cancelRequested);
  codexChatNewEl.disabled = running;
  updateCodexSelectionContext();
  updateAllTaskItemElements();
}

function attachedSelectionItems() {
  if (!currentBoard) return [];
  return codexAttachedSelectionIds.map(itemById).filter(Boolean);
}

function updateCodexSelectionContext() {
  if (!codexSelectionContextEl) return;
  const hasPage = Boolean(codexAttachedPage?.content);
  codexSelectionContextEl.hidden = !hasPage;
  codexSelectionCountEl.textContent = `已附加网页：${codexAttachedPage?.title || "当前网页"}`;
  codexSelectionClearEl.disabled = Boolean(codexChatTask);
  summarizeSelectionTextEl.textContent = "总结网页";
  summarizeSelectionTextEl.disabled = Boolean(codexChatTask) || codexAtCapacity() || !hasPage;
  summarizeSelectionImagesEl.hidden = true;
  summarizeSelectionVideoEl.hidden = true;
  selectionAiStatusEl.textContent = "";
  selectionAiStatusEl.classList.add("hidden");
  selectionAiCancelEl.hidden = true;
  updateCodexChatTarget();
}

function createSelectionCodexTask() {
  if (!currentBoard) return;
  const selection = selectedItems();
  if (!selection.length) return;
  const item = addTaskItem(aiResultPoint(selection), {
    sourceIds: selection.map(source => source.id),
    sourceCount: selection.length,
    focus: true
  });
  console.info("[pagedock-selection-task] created", {
    itemId: item.id,
    boardId: currentBoard.id,
    sourceCount: selection.length
  });
}

function extractKnowledgeCardFromSelection() {
  const selection = selectedItems();
  const sourceIds = selection.map(item => item.id);
  if (!sourceIds.length) return;
  selectionMoreMenuEl.open = false;
  const placeholder = addBoardItem({
    type: "document",
    text: "正在理解所选内容…",
    documentLanguage: "markdown",
    x: aiResultPoint(selection).x,
    y: aiResultPoint(selection).y,
    width: 520,
    height: 300,
    knowledgeState: "loading",
    relationSourceIds: sourceIds,
    provenance: {
      version: 1,
      operation: "codex-generate-knowledge",
      actor: { id: "codex", name: "Codex" },
      parents: selection.map(source => ({
        kind: "card",
        boardId: currentBoard.id,
        cardId: source.id,
        cardRevision: Math.max(1, Number(source.revision) || 1),
        relation: "generated-from"
      })),
      createdAt: Date.now()
    }
  });
  runWhiteboardCodex("knowledge", null, { sourceIds, resultItemId: placeholder.id });
}

function resizeCodexChatInput() {
  codexChatInputEl.style.height = "auto";
  const maximumHeight = Number.parseFloat(getComputedStyle(codexChatInputEl).maxHeight) || 160;
  const nextHeight = Math.min(codexChatInputEl.scrollHeight + 2, maximumHeight);
  codexChatInputEl.style.height = `${nextHeight}px`;
  codexChatInputEl.style.overflowY = codexChatInputEl.scrollHeight + 2 > maximumHeight ? "auto" : "hidden";
}

function normalizeCodexChatMessage(message) {
  const role = ["user", "assistant", "error"].includes(message?.role) ? message.role : "assistant";
  return {
    id: String(message?.id || db.makeId("chat-message")),
    role,
    text: String(message?.text || "").slice(0, 40_000),
    createdAt: Number(message?.createdAt) || Date.now(),
    added: Boolean(message?.added),
    addedTarget: ["board", "inbox"].includes(message?.addedTarget)
      ? message.addedTarget
      : (message?.added ? "board" : "")
  };
}

async function persistCodexChatMessages() {
  const persistent = codexChatMessages
    .filter(message => message.role !== "error")
    .slice(-MAX_CODEX_CHAT_MESSAGES);
  await chrome.storage.local.set({ [CODEX_CHAT_STORAGE_KEY]: persistent });
}

async function loadCodexChatMessages() {
  try {
    const stored = (await chrome.storage.local.get(CODEX_CHAT_STORAGE_KEY))[CODEX_CHAT_STORAGE_KEY];
    codexChatMessages = (Array.isArray(stored) ? stored : [])
      .map(normalizeCodexChatMessage)
      .filter(message => message.text)
      .slice(-MAX_CODEX_CHAT_MESSAGES);
  } catch (error) {
    console.warn("[pagedock-codex-chat] history load failed", error);
    codexChatMessages = [];
  }
  renderCodexChatMessages();
}

function appendCodexChatMessage(role, text) {
  const message = normalizeCodexChatMessage({ role, text });
  codexChatMessages.push(message);
  if (codexChatMessages.length > MAX_CODEX_CHAT_MESSAGES) {
    codexChatMessages = codexChatMessages.slice(-MAX_CODEX_CHAT_MESSAGES);
  }
  renderCodexChatMessages();
  persistCodexChatMessages().catch(error => {
    console.warn("[pagedock-codex-chat] history save failed", error);
  });
  return message;
}

async function addCodexChatAnswerToBoard(message, button) {
  if (!message?.text || message.added) return;
  button.disabled = true;
  button.dataset.state = "loading";
  try {
    const text = `Codex 会话\n\n${message.text}`;
    if (currentBoard) {
      const lineEstimate = text.split("\n").length + Math.ceil(text.length / 34);
      addBoardItem({
        type: "text",
        text,
        ...insertionPoint(),
        width: 420,
        height: clamp(120 + lineEstimate * 18, 180, 620)
      });
      message.addedTarget = "board";
      console.info("[pagedock-codex-chat] answer added to board", { boardId: currentBoard.id, messageId: message.id });
    } else {
      await db.addItem(db.INBOX_ID, { type: "text", text });
      notifyDataChanged([db.INBOX_ID], "codex-chat-to-inbox");
      await renderHome(false);
      message.addedTarget = "inbox";
      console.info("[pagedock-codex-chat] answer added to inbox", { messageId: message.id });
    }
    message.added = true;
    button.replaceWith(createCodexMessageAddedStatus(message));
    await persistCodexChatMessages();
  } catch (error) {
    button.disabled = false;
    button.dataset.state = "error";
    button.textContent = "添加失败，重试";
    setCodexChatStatus(error?.message || "添加到白板失败", "error");
  }
}

function createCodexMessageAddedStatus(message) {
  const status = document.createElement("span");
  status.className = "codex-message-added";
  status.textContent = message.addedTarget === "inbox" ? "✓ 已保存" : "✓ 已添加";
  return status;
}

function createCodexChatMessageElement(message) {
  const article = document.createElement("article");
  article.className = `codex-message ${message.role}`;
  article.dataset.messageId = message.id;
  const label = document.createElement("div");
  label.className = "codex-message-label";
  label.textContent = message.role === "user" ? "你" : message.role === "error" ? "错误" : "Codex";
  const body = document.createElement("div");
  body.className = "codex-message-body";
  if (message.role === "assistant") renderTaskMarkdown(body, message.text);
  else body.textContent = message.text;
  // Keep the message row stable while allowing only the bubble to fit its content.
  const content = document.createElement("div");
  content.className = "codex-message-content";
  content.appendChild(body);
  article.append(label, content);
  if (message.role === "assistant") {
    const actions = document.createElement("div");
    actions.className = "codex-message-actions";
    if (message.added) {
      actions.appendChild(createCodexMessageAddedStatus(message));
    } else {
      const add = document.createElement("button");
      add.className = "codex-message-action";
      add.type = "button";
      add.textContent = currentBoard ? "+ 放到白板" : "+ 保存到收件箱";
      add.addEventListener("click", () => addCodexChatAnswerToBoard(message, add));
      actions.appendChild(add);
    }
    content.appendChild(actions);
  }
  return article;
}

function createCodexChatLoadingElement(task) {
  const article = document.createElement("article");
  article.className = "codex-message assistant loading";
  article.dataset.taskId = task.id;
  const label = document.createElement("div");
  label.className = "codex-message-label";
  label.textContent = "Codex";
  const body = document.createElement("div");
  body.className = "codex-message-body";
  body.setAttribute("role", "status");
  const row = document.createElement("div");
  row.className = "codex-loading-row";
  const spinner = document.createElement("span");
  spinner.className = "codex-loading-spinner";
  spinner.setAttribute("aria-hidden", "true");
  const stage = document.createElement("span");
  stage.className = "codex-loading-stage";
  stage.textContent = task.progressText || "Codex 正在处理…";
  const elapsed = document.createElement("span");
  elapsed.className = "codex-loading-time";
  elapsed.setAttribute("aria-hidden", "true");
  elapsed.textContent = codexChatElapsedText(task);
  row.append(spinner, stage, elapsed);
  const hint = document.createElement("div");
  hint.className = "codex-loading-hint";
  hint.textContent = "回答生成中，你可以随时停止";
  body.append(row, hint);
  const content = document.createElement("div");
  content.className = "codex-message-content";
  content.appendChild(body);
  article.append(label, content);
  return article;
}

function renderCodexChatMessages() {
  if (!codexChatMessagesEl) return;
  codexChatMessagesEl.replaceChildren();
  if (!codexChatMessages.length && !codexChatTask) {
    codexChatMessagesEl.appendChild(codexChatEmptyEl);
    return;
  }
  codexChatMessages.forEach(message => {
    codexChatMessagesEl.appendChild(createCodexChatMessageElement(message));
  });
  if (codexChatTask) {
    codexChatMessagesEl.appendChild(createCodexChatLoadingElement(codexChatTask));
  }
  requestAnimationFrame(() => {
    codexChatMessagesEl.scrollTop = codexChatMessagesEl.scrollHeight;
  });
}

function codexChatConversationContext(currentMessageId) {
  let context = codexChatMessages
    .filter(message => message.id !== currentMessageId && message.role !== "error")
    .slice(-16)
    .map(message => `${message.role === "user" ? "用户" : "Codex"}：\n${message.text}`)
    .join("\n\n---\n\n");
  if (context.length > MAX_CODEX_CHAT_CONTEXT_CHARS) {
    context = context.slice(context.length - MAX_CODEX_CHAT_CONTEXT_CHARS);
  }
  return context;
}

async function connectCodexChat() {
  setCodexChatStatus("正在连接…", "loading");
  try {
    const response = await chrome.runtime.sendMessage({ type: CODEX_STATUS_REQUEST, runtime: aiRuntime });
    if (!response?.ok) throw new Error(response?.error || "无法连接本地桥接");
    codexChatReady = Boolean(response.ready);
    updateCodexTaskSnapshot(response);
    updateExternalCodexStatus(response);
    setCodexChatStatus(
      codexChatReady
        ? (codexRunningTaskIds().size ? `${codexRunningTaskIds().size} 个任务执行中` : "已连接")
        : `${aiRuntimeLabel()} 未连接`,
      codexChatReady ? (codexRunningTaskIds().size ? "loading" : "success") : "error"
    );
  } catch (error) {
    codexChatReady = false;
    setCodexChatStatus(error?.message || "本地桥接未连接", "error");
  }
  updateCodexChatControls();
}

async function sendCodexChatMessage() {
  const prompt = codexChatInputEl.value.trim();
  if (!prompt || codexChatTask || codexAtCapacity()) return;
  if (!codexChatReady) {
    await connectCodexChat();
    if (!codexChatReady) return;
  }
  const userMessage = appendCodexChatMessage("user", prompt);
  const conversationContext = codexChatConversationContext(userMessage.id);
  codexChatInputEl.value = "";
  resizeCodexChatInput();
  const task = {
    id: db.makeId("codex-chat"),
    userMessageId: userMessage.id,
    prompt
  };
  codexChatTask = task;
  console.info("[pagedock-codex-chat] conversation requested", {
    taskId: task.id,
    contextLength: conversationContext.length,
    hasPageContext: Boolean(codexAttachedPage?.content)
  });
  startCodexChatProgress(task);
  updateCodexChatControls();
  updateSelectionUi();
  try {
    const materialContext = codexAttachedPage?.content
      ? [
        `网页：${codexAttachedPage.title || "当前网页"}`,
        codexAttachedPage.url ? `来源：${codexAttachedPage.url}` : "",
        codexAttachedPage.content
      ].filter(Boolean).join("\n\n")
      : "";
    const response = await chrome.runtime.sendMessage({
      type: CODEX_RUN_REQUEST,
      id: task.id,
      runtime: aiRuntime,
      // Codex 会话保留工作区执行能力；AGY 走只读对话，避免绕过其交互式权限确认。
      mode: aiRuntime === "agy" ? "conversation" : "coding",
      prompt,
      page: {
        title: codexAttachedPage?.title || (currentBoard ? `${currentBoard.name} · Codex 会话` : "拾作 · Codex 会话"),
        url: codexAttachedPage?.url || "",
        content: [materialContext, conversationContext].filter(Boolean).join("\n\n---\n\n")
      },
      images: []
    });
    if (!response?.ok) throw new Error(response?.error || `${aiRuntimeLabel()} 会话启动失败`);
  } catch (error) {
    stopCodexChatProgress(task);
    codexChatTask = undefined;
    const errorMessage = error?.message || `${aiRuntimeLabel()} 会话启动失败`;
    appendCodexChatMessage("error", errorMessage);
    syncLocalPluginCodexTask(task, "failed", { message: errorMessage });
    setCodexChatStatus("发送失败", "error");
    updateCodexChatControls();
    updateSelectionUi();
  }
}

function handleCodexChatEvent(message) {
  const task = codexChatTask;
  if (!task || message?.id !== task.id) {
    const count = codexRunningTaskIds().size;
    setCodexChatStatus(
      codexChatReady ? (count ? `${count} 个任务执行中` : "已连接") : "连接不可用",
      codexChatReady ? (count ? "loading" : "success") : "error"
    );
    updateCodexChatControls();
    return;
  }
  if (message.type === "started") {
    updateCodexChatProgress(task, "正在理解问题并组织回答…");
    return;
  }
  if (message.type === "progress") {
    updateCodexChatProgress(task, friendlyCodexProgress(message, "正在处理会话"));
    return;
  }
  if (message.type === "done") {
    stopCodexChatProgress(task);
    codexChatTask = undefined;
    const answer = message.answer || "Codex 没有返回内容";
    appendCodexChatMessage("assistant", answer);
    syncLocalPluginCodexTask(task, "completed", { message: "回答已生成", result: answer });
    console.info("[pagedock-codex-chat] conversation completed", { taskId: task.id });
    setCodexChatStatus("已完成 · 可继续追问", "success");
    if (codexChatPanelEl.hidden) codexChatLauncherEl.dataset.hasUpdate = "true";
  } else if (message.type === "cancelled") {
    stopCodexChatProgress(task);
    codexChatTask = undefined;
    syncLocalPluginCodexTask(task, "cancelled", { message: "任务已停止" });
    renderCodexChatMessages();
    setCodexChatStatus("已停止 · 可继续提问");
  } else if (message.type === "error") {
    stopCodexChatProgress(task);
    codexChatTask = undefined;
    const errorMessage = message.error || "Codex 会话失败";
    appendCodexChatMessage("error", errorMessage);
    syncLocalPluginCodexTask(task, "failed", { message: errorMessage });
    setCodexChatStatus("执行失败", "error");
  } else {
    return;
  }
  updateCodexChatControls();
  updateSelectionUi();
}

function createBoardCard(board) {
  const card = document.createElement("article");
  card.className = "board-card";
  card.dataset.boardId = board.id;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", `打开白板 ${board.name}`);

  const top = document.createElement("div");
  top.className = "board-card-top";
  const icon = document.createElement("span");
  icon.className = "board-card-icon";
  icon.textContent = board.id === db.INBOX_ID ? "↓" : "□";
  const title = document.createElement("h3");
  title.textContent = board.name;
  top.append(icon, title);
  if (board.id !== db.INBOX_ID) {
    const remove = document.createElement("button");
    remove.className = "board-delete";
    remove.type = "button";
    remove.title = "删除白板";
    remove.textContent = "×";
    remove.addEventListener("click", async event => {
      event.stopPropagation();
      if (!confirm(`确定删除“${board.name}”吗？此操作无法撤销。`)) return;
      await db.deleteBoard(board.id);
      notifyDataChanged([board.id], "delete-board");
      await renderHome();
    });
    top.appendChild(remove);
  }

  const preview = document.createElement("p");
  preview.textContent = board.preview || "暂无内容";
  const meta = document.createElement("div");
  meta.className = "board-meta";
  const count = document.createElement("span");
  count.textContent = `${board.itemCount || 0} 项`;
  const updated = document.createElement("span");
  updated.textContent = formatTime(board.updatedAt);
  meta.append(count, updated);
  card.append(top, preview, meta);
  card.addEventListener("click", () => openBoard(board.id));
  card.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openBoard(board.id);
    }
  });
  return card;
}

function createRecentItem(item) {
  const row = document.createElement("article");
  row.className = "recent-item";
  row.dataset.boardId = item.boardId;
  row.tabIndex = 0;
  row.setAttribute("role", "button");
  const icon = document.createElement("span");
  icon.className = "recent-kind";
  icon.textContent = itemIcon(item);
  const copy = document.createElement("div");
  copy.className = "recent-copy";
  const title = document.createElement("strong");
  title.textContent = itemLabel(item).replace(/\s+/g, " ").slice(0, 120);
  const source = document.createElement("span");
  source.textContent = item.source?.title || item.source?.url || "手动添加";
  copy.append(title, source);
  const time = document.createElement("span");
  time.className = "recent-time";
  time.textContent = formatTime(item.createdAt);
  row.append(icon, copy, time);
  const open = () => focusExternalActivity({ boardId: item.boardId, cardId: item.id });
  row.addEventListener("click", open);
  row.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  });
  return row;
}

function createSearchResult(result) {
  const row = document.createElement("article");
  row.className = "recent-item";
  row.tabIndex = 0;
  row.setAttribute("role", "button");
  const icon = document.createElement("span");
  icon.className = "recent-kind";
  icon.textContent = itemIcon(result);
  const copy = document.createElement("div");
  copy.className = "recent-copy";
  const title = document.createElement("strong");
  title.textContent = result.label || "卡片";
  const source = document.createElement("span");
  source.textContent = [result.boardName, result.sourceTitle || result.snippet].filter(Boolean).join(" · ");
  copy.append(title, source);
  const time = document.createElement("span");
  time.className = "recent-time";
  time.textContent = formatTime(result.updatedAt);
  row.append(icon, copy, time);
  const open = () => focusExternalActivity({ boardId: result.boardId, cardId: result.id });
  row.addEventListener("click", open);
  row.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  });
  return row;
}

async function applyHomeFilter() {
  const query = homeSearchEl.value.trim().toLocaleLowerCase();
  const requestId = ++homeSearchRequest;
  boardListEl.replaceChildren();
  recentListEl.replaceChildren();
  const boards = homeBoards.filter(board => !query
    || `${board.name} ${board.preview}`.toLocaleLowerCase().includes(query));
  boards.forEach(board => boardListEl.appendChild(createBoardCard(board)));
  if (!boards.length) {
    const empty = document.createElement("div");
    empty.className = "empty-home";
    empty.textContent = query ? "没有匹配的白板" : "还没有白板，先新建一个吧";
    boardListEl.appendChild(empty);
  }
  if (!query) {
    recentHeadingEl.textContent = "最近收集";
    recentHintEl.textContent = "右键网页内容可直接收进来";
    homeRecent.forEach(item => recentListEl.appendChild(createRecentItem(item)));
  } else {
    recentHeadingEl.textContent = "跨白板结果";
    recentHintEl.textContent = "搜索卡片正文、任务回答和来源";
    const loading = document.createElement("div");
    loading.className = "empty-home";
    loading.textContent = "正在搜索本地白板…";
    recentListEl.appendChild(loading);
    try {
      const results = await db.searchBoards(query, { limit: 80 });
      if (requestId !== homeSearchRequest) return;
      recentListEl.replaceChildren();
      results.forEach(result => recentListEl.appendChild(createSearchResult(result)));
      if (!results.length) {
        const empty = document.createElement("div");
        empty.className = "empty-home";
        empty.textContent = "没有匹配的卡片或来源";
        recentListEl.appendChild(empty);
      }
    } catch (error) {
      if (requestId !== homeSearchRequest) return;
      recentListEl.replaceChildren();
      const failed = document.createElement("div");
      failed.className = "empty-home";
      failed.textContent = `搜索失败：${error?.message || "本地索引不可用"}`;
      recentListEl.appendChild(failed);
    }
  }
  if (!query && !homeRecent.length) {
    const empty = document.createElement("div");
    empty.className = "empty-home";
    empty.textContent = "最近收集会出现在这里";
    recentListEl.appendChild(empty);
  }
}

function scheduleHomeFilter() {
  clearTimeout(homeSearchTimer);
  homeSearchTimer = setTimeout(() => applyHomeFilter(), 180);
}

async function renderHome(updateUrl = true) {
  await flushSave();
  exitItemFocus(false, false);
  await Promise.all([...terminalSessions.values()].map(session => closeTerminalSession(session.item)));
  disposeTerminalRenderers();
  currentBoard = undefined;
  boardItems = [];
  lastBoardPoint = undefined;
  insertionCascade = 0;
  selectedIds.clear();
  setView("home");
  if (updateUrl && location.search) history.pushState({}, "", location.pathname);
  document.title = "拾作";
  const [boards, recent, templates] = await Promise.all([db.listBoards(), db.recentItems(16), db.listTemplates()]);
  homeBoards = boards;
  homeRecent = recent;
  const inbox = homeBoards.find(board => board.id === db.INBOX_ID);
  const isFirstRun = homeBoards.every(board => !Number(board.itemCount))
    && !Number(inbox?.itemCount)
    && !homeRecent.length;
  homeJourneyEl.hidden = !isFirstRun;
  document.body.dataset.onboarding = isFirstRun ? "first-run" : "established";
  document.getElementById("quickAdd").textContent = isFirstRun ? "开始整理" : "存入收件箱";
  quickTextEl.placeholder = isFirstRun ? "粘贴文字或链接…" : "快速收集文字或链接…";
  boardCountEl.textContent = `${homeBoards.length} 个白板`;
  updateWorkflowTemplateEntry(templates.length);
  applyHomeFilter();
}

async function finishHomeCapture(savedItems, firstRun, successMessage) {
  notifyDataChanged([db.INBOX_ID], "quick-add");
  if (firstRun && savedItems[0]?.id) {
    console.info("[pagedock-onboarding] first content captured", { itemId: savedItems[0].id, count: savedItems.length });
    await focusExternalActivity({ boardId: db.INBOX_ID, cardId: savedItems[0].id });
    setStatus("内容已放入白板。下一步：点击上方“交给 AI”", false, "success", 6500);
    return;
  }
  await renderHome(false);
  setStatus(successMessage, false, "success");
}

async function captureHomeImages(files) {
  const images = [...files].filter(file => file?.type?.startsWith("image/"));
  if (!images.length) return false;
  const firstRun = document.body.dataset.onboarding === "first-run";
  const button = document.getElementById("quickAdd");
  quickCaptureWrapEl.dataset.loading = "true";
  button.disabled = true;
  button.textContent = "导入中…";
  try {
    const savedItems = [];
    for (const file of images) {
      const src = await readFileAsDataUrl(file);
      savedItems.push(await db.addItem(db.INBOX_ID, { type: "image", src, alt: file.name }));
    }
    await finishHomeCapture(savedItems, firstRun, images.length > 1 ? `已保存 ${images.length} 张图片` : "图片已保存到收件箱");
  } catch (error) {
    setStatus(error?.message || "图片未能保存到收件箱", true);
  } finally {
    delete quickCaptureWrapEl.dataset.loading;
    delete quickCaptureWrapEl.dataset.dragging;
    button.disabled = false;
    button.textContent = firstRun ? "开始整理" : "存入收件箱";
  }
  return true;
}

function openCreateBoardDialog() {
  newBoardNameEl.value = "新白板";
  newBoardNameEl.setCustomValidity("");
  newBoardDialogEl.showModal();
  requestAnimationFrame(() => {
    newBoardNameEl.focus();
    newBoardNameEl.select();
  });
}

function openPageDialog() {
  pageUrlEl.value = "";
  pageUrlEl.setCustomValidity("");
  pageDialogEl.showModal();
  requestAnimationFrame(() => pageUrlEl.focus());
}

function setBridgeShareDialogStatus(message, state = "default") {
  shareBridgeStatusEl.textContent = message;
  shareBridgeStatusEl.dataset.state = state;
}

async function createBridgeShare() {
  if (!shareBridgeDialogEl.open) shareBridgeDialogEl.showModal();
  shareBridgeButtonEl.disabled = true;
  copyBridgeShareEl.disabled = true;
  copyCodexShareEl.disabled = true;
  stopBridgeShareEl.disabled = true;
  shareBridgeTextEl.value = "";
  shareCodexTextEl.value = "";
  setBridgeShareDialogStatus("正在生成协作邀请…");
  try {
    const response = await chrome.runtime.sendMessage({ type: BRIDGE_SHARE_CREATE_REQUEST, boardId: currentBoard?.id || "" });
    if (!response?.ok || !response.collaborationUrl || !response.inviteText) throw new Error(response?.error || "无法生成协作邀请");
    shareBridgeTextEl.value = response.collaborationUrl;
    shareCodexTextEl.value = response.inviteText;
    collaborationPanelDismissed = false;
    sessionStorage.setItem("__pagedock_collaboration_closed__", "0");
    copyBridgeShareEl.disabled = false;
    copyCodexShareEl.disabled = false;
    stopBridgeShareEl.disabled = false;
    updateExternalCodexStatus({ connected: false, scope: "lan" });
    const expiresAt = new Date(Number(response.expiresAt) || Date.now() + 10 * 60_000);
    try {
      await copyTaskAnswer(response.collaborationUrl);
      setBridgeShareDialogStatus(`协作链接已复制，将于 ${expiresAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} 过期`);
    } catch {
      setBridgeShareDialogStatus(`邀请已生成，将于 ${expiresAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} 过期，请手动复制`);
    }
    console.info("[shizuo-bridge] one-time invite ready", { expiresAt: expiresAt.getTime() });
  } catch (error) {
    setBridgeShareDialogStatus(error?.message || "生成连接邀请失败", "error");
    setStatus(error?.message || "生成连接邀请失败", true);
  } finally {
    shareBridgeButtonEl.disabled = false;
  }
}

async function stopBridgeShare() {
  stopBridgeShareEl.disabled = true;
  copyBridgeShareEl.disabled = true;
  copyCodexShareEl.disabled = true;
  setBridgeShareDialogStatus("正在停止内网共享…");
  try {
    const response = await chrome.runtime.sendMessage({ type: BRIDGE_SHARE_STOP_REQUEST });
    if (!response?.ok) throw new Error(response?.error || "停止共享失败");
    shareBridgeTextEl.value = "";
    shareCodexTextEl.value = "";
    updateExternalCodexStatus({ connected: false, scope: "local" });
    setBridgeShareDialogStatus("已停止共享，拾作已恢复为仅本机访问");
    setStatus("已停止内网共享");
  } catch (error) {
    stopBridgeShareEl.disabled = false;
    setBridgeShareDialogStatus(error?.message || "停止共享失败", "error");
    setStatus(error?.message || "停止共享失败", true);
  }
}

function refreshHomeWhenVisible() {
  if (document.visibilityState !== "visible" || currentBoard) return;
  renderHome(false).catch(error => {
    console.warn("[pagedock-home] visibility refresh failed", error);
  });
}

function closeDialogFromBackdrop(event) {
  if (event.target === event.currentTarget) event.currentTarget.close();
}

function boardPointFromEvent(event) {
  const rect = viewportEl.getBoundingClientRect();
  return {
    x: clamp((viewportEl.scrollLeft + event.clientX - rect.left) / zoom, 0, boardWidth),
    y: clamp((viewportEl.scrollTop + event.clientY - rect.top) / zoom, 0, boardHeight)
  };
}

function viewportCenter() {
  return {
    x: (viewportEl.scrollLeft + viewportEl.clientWidth / 2) / zoom,
    y: (viewportEl.scrollTop + viewportEl.clientHeight / 2) / zoom
  };
}

function insertionPoint(offset = 0) {
  const point = lastBoardPoint || viewportCenter();
  const cascade = insertionCascade;
  insertionCascade = (insertionCascade + 28) % 168;
  return {
    x: Math.max(12, point.x - 140 + cascade + offset),
    y: Math.max(12, point.y - 70 + cascade + offset)
  };
}

function taskInsertionPoint() {
  const point = insertionPoint();
  // The pointer leaves the canvas through its top edge before the user clicks
  // the toolbar menu. Keep a new task visually separated from that edge.
  const visibleTop = viewportEl.scrollTop / zoom;
  const topGutter = 48 / zoom;
  return { ...point, y: Math.max(point.y, visibleTop + topGutter) };
}

function itemById(id) {
  return boardItems.find(item => item.id === id);
}

function itemElement(id) {
  if (focusedItemId === id && focusedItemElement?.isConnected) return focusedItemElement;
  return boardEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
}

function setItemFocusButtonState(button, active) {
  if (!button) return;
  button.dataset.active = String(active);
  button.setAttribute("aria-label", active ? "退出全屏" : "全屏查看");
  button.title = active ? "退出全屏 (Esc)" : "全屏查看";
}

function setItemCloseButtonState(button, focused) {
  if (!button) return;
  button.setAttribute("aria-label", focused ? "退出全屏" : "删除卡片");
  button.title = focused ? "退出全屏" : "删除卡片";
}

function enterItemFocus(item, element) {
  if (!item || !element) return;
  if (focusedItemId === item.id) {
    exitItemFocus();
    return;
  }
  if (focusedItemId) exitItemFocus();
  focusedItemId = item.id;
  focusedItemElement = element;
  cardFocusLayerEl.hidden = false;
  document.body.classList.add("card-focus-active");
  element.classList.add("item-focused");
  cardFocusLayerEl.appendChild(element);
  setItemFocusButtonState(element.querySelector(".item-focus"), true);
  setItemCloseButtonState(element.querySelector(".delete-item"), true);
  selectItems([item.id], true);
  requestAnimationFrame(() => element.querySelector(".item-focus")?.focus({ preventScroll: true }));
  console.info("[shizuo-card-focus] entered", { itemId: item.id, type: item.type });
}

function exitItemFocus(restore = true, returnFocus = true) {
  if (!focusedItemId) return;
  const itemId = focusedItemId;
  const item = itemById(itemId);
  const element = focusedItemElement;
  focusedItemId = "";
  focusedItemElement = undefined;
  document.body.classList.remove("card-focus-active");
  cardFocusLayerEl.hidden = true;
  if (element) {
    element.classList.remove("item-focused");
    setItemFocusButtonState(element.querySelector(".item-focus"), false);
    setItemCloseButtonState(element.querySelector(".delete-item"), false);
    if (restore && item && currentBoard) {
      element.style.left = `${item.x}px`;
      element.style.top = `${item.y}px`;
      element.style.width = `${item.width}px`;
      element.style.height = `${item.height}px`;
      element.style.zIndex = item.z;
      boardEl.appendChild(element);
      if (returnFocus) requestAnimationFrame(() => element.querySelector(".item-focus")?.focus({ preventScroll: true }));
    } else {
      element.remove();
    }
  }
  updateSelectionUi();
  renderConnections();
  renderMinimap();
  console.info("[shizuo-card-focus] exited", { itemId, restored: Boolean(restore && item && currentBoard) });
}

function selectedItems() {
  return [...selectedIds].map(itemById).filter(Boolean);
}

function relationSourceIds(item) {
  const ids = [
    ...(cardProtocol?.connectionSources(item) || []),
    ...(Array.isArray(item.relationSourceIds) ? item.relationSourceIds : []),
    ...(item.type === "task" && Array.isArray(item.taskSourceIds) ? item.taskSourceIds : [])
  ].map(String);
  return [...new Set(ids)].filter(id => id !== item.id && itemById(id));
}

function relationEdges(items = boardItems) {
  const targets = new Set(items.map(item => item.id));
  return items.flatMap(target => relationSourceIds(target)
    .filter(sourceId => targets.has(sourceId))
    .map(sourceId => ({ source: itemById(sourceId), target }))
    .filter(edge => edge.source));
}

function cardTextOutput(item) {
  if (!item) return "";
  if (item.type === "task") {
    const latest = [...normalizeTaskMessages(item.taskMessages, item)].reverse().find(message => message.role === "assistant");
    return latest?.text || item.taskResult || item.text || "";
  }
  if (item.type === "terminal") return item.terminalOutput || item.text || "";
  if (item.type === "file") return item.localPreview || `${item.localName || "文件"}${item.localMime ? ` (${item.localMime})` : ""}`;
  if (item.type === "folder") return (item.localEntries || []).map(entry => `${entry.kind === "directory" ? "[目录]" : "[文件]"} ${entry.name}`).join("\n");
  if (item.type === "page") {
    return [item.text, item.src, item.pageContent ? `页面正文：\n${item.pageContent}` : ""].filter(Boolean).join("\n\n");
  }
  if (item.type === "link") return [item.text, item.src].filter(Boolean).join("\n");
  if (item.type === "image") return [item.alt || "图片", item.source?.url].filter(Boolean).join("\n");
  if (item.type === "video") return [item.alt || "视频", item.src].filter(Boolean).join("\n");
  return item.text || "";
}

function pagePermissionOrigin(value) {
  const url = new URL(String(value || ""));
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("页面卡地址不是可读取的 HTTP(S) 网页");
  return `${url.protocol}//${url.host}/*`;
}

async function hydratePageCardsForCodex(items, onProgress = () => {}) {
  const pages = items.filter(item => item.type === "page" && item.src);
  if (!pages.length) return;
  const origins = [...new Set(pages.flatMap(item => [
    pagePermissionOrigin(item.src),
    item.pageContentRequiredOrigin
  ].filter(Boolean)))];
  // 必须直接发生在“发送/快捷能力”用户手势中；Chrome 会按实际域名展示一次读取授权。
  const alreadyAllowed = await chrome.permissions.contains({ origins });
  const allowed = alreadyAllowed || await chrome.permissions.request({ origins });
  if (!allowed) {
    pages.forEach(item => {
      cardProtocol.revoke(item, "page-content-read");
      updatePermissionChip(item);
    });
    const hosts = pages.map(item => new URL(item.src).host).join("、");
    throw new Error(`未允许读取 ${hosts} 的页面内容，Codex 尚未收到正文`);
  }
  for (const item of pages) {
    cardProtocol.grant(item, "page-content-read");
    updatePermissionChip(item);
  }
  scheduleSave();

  for (let index = 0; index < pages.length; index += 1) {
    const item = pages[index];
    onProgress(pages.length > 1 ? `正在读取页面 ${index + 1}/${pages.length}` : "正在读取页面内容");
    const response = await chrome.runtime.sendMessage({
      type: PAGE_CARD_CONTEXT_REQUEST,
      url: item.src
    });
    if (!response?.ok) {
      if (response?.requiredOrigin) {
        item.pageContentRequiredOrigin = String(response.requiredOrigin);
        cardProtocol.revoke(item, "page-content-read");
        updatePermissionChip(item);
        item.updatedAt = Date.now();
        scheduleSave();
        throw new Error(`页面跳转到了 ${response.requiredHost || "另一个站点"}，请点击重试并允许读取`);
      }
      throw new Error(response?.error || `无法读取页面：${itemLabel(item)}`);
    }
    const content = String(response.content || "").trim();
    if (!content) throw new Error(`页面“${itemLabel(item)}”没有提取到可分析内容`);
    item.pageContent = content.slice(0, 600_000);
    item.pageContentUrl = String(response.url || item.src);
    item.pageContentMode = String(response.mode || "");
    item.pageContentCapturedAt = Date.now();
    delete item.pageContentRequiredOrigin;
    item.updatedAt = Date.now();
    console.info("[pagedock-page] content collected for Codex", {
      itemId: item.id,
      contentLength: item.pageContent.length,
      mode: item.pageContentMode,
      reachedEnd: response.reachedEnd !== false
    });
  }
  scheduleSave();
}

function connectSelectedItems() {
  const [source, target] = selectedItems();
  if (!source || !target) return;
  try {
    cardProtocol.connect(source, target);
    target.updatedAt = Date.now();
    // 可编辑文本卡在建立连接时接收一次当前内容；任务卡在每轮执行前读取最新上游内容。
    if (["text", "document", "code"].includes(target.type)) {
      const incoming = cardTextOutput(source).trim();
      if (incoming) target.text = target.text ? `${target.text}\n\n${incoming}` : incoming;
      const editor = itemElement(target.id)?.querySelector(".text-content,.document-editor,.code-editor");
      if (editor) {
        if (editor instanceof HTMLTextAreaElement) editor.value = target.text;
        else editor.textContent = target.text;
      }
    }
    renderConnections();
    scheduleSave();
    commitHistory();
    setStatus(`已连接：${itemTypeLabel(source)} → ${itemTypeLabel(target)}`);
    console.info("[pagedock-card] cards connected", { sourceId: source.id, targetId: target.id, targetType: target.type });
  } catch (error) {
    setStatus(error?.message || "卡片连接失败", true);
  }
}

function relationGeometry(source, target) {
  const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  const horizontal = Math.abs(targetCenter.x - sourceCenter.x) >= Math.abs(targetCenter.y - sourceCenter.y);
  if (horizontal) {
    const direction = targetCenter.x >= sourceCenter.x ? 1 : -1;
    const start = { x: sourceCenter.x + direction * source.width / 2, y: sourceCenter.y };
    const end = { x: targetCenter.x - direction * target.width / 2, y: targetCenter.y };
    const control = Math.max(48, Math.abs(end.x - start.x) * .45);
    return {
      start,
      end,
      control1: { x: start.x + direction * control, y: start.y },
      control2: { x: end.x - direction * control, y: end.y }
    };
  }
  const direction = targetCenter.y >= sourceCenter.y ? 1 : -1;
  const start = { x: sourceCenter.x, y: sourceCenter.y + direction * source.height / 2 };
  const end = { x: targetCenter.x, y: targetCenter.y - direction * target.height / 2 };
  const control = Math.max(48, Math.abs(end.y - start.y) * .45);
  return {
    start,
    end,
    control1: { x: start.x, y: start.y + direction * control },
    control2: { x: end.x, y: end.y - direction * control }
  };
}

function renderConnections() {
  cancelAnimationFrame(connectionRenderFrame);
  connectionRenderFrame = undefined;
  const definitions = document.createElementNS(SVG_NS, "defs");
  const marker = document.createElementNS(SVG_NS, "marker");
  marker.setAttribute("id", "relationArrow");
  marker.setAttribute("viewBox", "0 0 8 8");
  marker.setAttribute("refX", "7");
  marker.setAttribute("refY", "4");
  marker.setAttribute("markerWidth", "7");
  marker.setAttribute("markerHeight", "7");
  marker.setAttribute("orient", "auto-start-reverse");
  const arrow = document.createElementNS(SVG_NS, "path");
  arrow.setAttribute("d", "M 0 0 L 8 4 L 0 8 z");
  arrow.setAttribute("fill", "var(--color-accent)");
  marker.appendChild(arrow);
  definitions.appendChild(marker);
  const paths = relationEdges().map(({ source, target }) => {
    const geometry = relationGeometry(source, target);
    const path = document.createElementNS(SVG_NS, "path");
    path.classList.add("relation-line");
    path.dataset.sourceId = source.id;
    path.dataset.targetId = target.id;
    path.setAttribute("marker-end", "url(#relationArrow)");
    path.setAttribute("d", `M ${geometry.start.x} ${geometry.start.y} C ${geometry.control1.x} ${geometry.control1.y}, ${geometry.control2.x} ${geometry.control2.y}, ${geometry.end.x} ${geometry.end.y}`);
    return path;
  });
  connectionLayerEl.replaceChildren(definitions, ...paths);
}

function scheduleConnectionRender() {
  if (connectionRenderFrame) return;
  connectionRenderFrame = requestAnimationFrame(renderConnections);
}

function taskMatchesCurrentSelection(task = standaloneWhiteboardTask()) {
  if (!task || task.boardId !== currentBoard?.id) return false;
  if (task.taskItemId) return selectedIds.has(task.taskItemId);
  // AI progress belongs to the cards that started the task, never to whichever cards are selected later.
  const taskSelectionIds = Array.isArray(task.selectionIds) ? task.selectionIds : [];
  return taskSelectionIds.length === selectedIds.size
    && taskSelectionIds.every(id => selectedIds.has(id));
}

function updateWhiteboardCodexStatus(task, text) {
  if (!task) return;
  task.status = String(text || "");
  if (task.mode === "knowledge" && task.resultItemId) {
    const loading = itemElement(task.resultItemId)?.querySelector(".knowledge-card-loading");
    if (loading) loading.querySelector("span").textContent = task.status;
  }
  if (whiteboardCodexTasks.get(task.id) === task && task.boardId === currentBoard?.id) {
    if (task.taskItemId) {
      const item = itemById(task.taskItemId);
      if (item) {
        item.taskProgress = task.status;
        updateTaskItemElement(item);
      }
    } else {
      selectionAiStatusEl.textContent = task.status;
      selectionAiStatusEl.title = task.status;
      selectionAiStatusEl.classList.toggle("hidden", !task.status);
    }
  }
}

function finishKnowledgeCardPlaceholder(task, state, message) {
  if (task?.mode !== "knowledge" || !task.resultItemId || task.boardId !== currentBoard?.id) return;
  const item = itemById(task.resultItemId);
  if (!item || item.knowledgeState === "success") return;
  item.knowledgeState = state;
  item.text = message;
  item.updatedAt = Date.now();
  const loading = itemElement(item.id)?.querySelector(".knowledge-card-loading");
  if (loading) {
    loading.dataset.state = state;
    loading.querySelector("span").textContent = message;
  }
  scheduleSave();
}

function positionSelectionMenu() {
  const toolbarRect = selectionActionsEl.getBoundingClientRect();
  const gap = 8;
  const viewportMargin = 12;
  const menuHeight = selectionMorePanelEl.scrollHeight || 228;
  const spaceAbove = toolbarRect.top - gap - viewportMargin;
  const spaceBelow = window.innerHeight - toolbarRect.bottom - gap - viewportMargin;
  const opensAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;
  const availableHeight = Math.max(48, opensAbove ? spaceAbove : spaceBelow);
  selectionActionsEl.dataset.menuPlacement = opensAbove ? "above" : "below";
  selectionActionsEl.style.setProperty("--selection-menu-max-height", `${Math.floor(availableHeight)}px`);
}

function positionSelectionActions() {
  if (selectionActionsEl.classList.contains("hidden")) return;
  const rectangles = [...selectedIds]
    .map(id => itemElement(id)?.getBoundingClientRect())
    .filter(Boolean);
  if (!rectangles.length) {
    selectionActionsEl.classList.add("hidden");
    return;
  }
  const left = Math.min(...rectangles.map(rect => rect.left));
  const right = Math.max(...rectangles.map(rect => rect.right));
  const top = Math.min(...rectangles.map(rect => rect.top));
  const bottom = Math.max(...rectangles.map(rect => rect.bottom));
  const menuWidth = selectionActionsEl.offsetWidth;
  const menuHeight = selectionActionsEl.offsetHeight;
  const nextLeft = clamp((left + right - menuWidth) / 2, 12, window.innerWidth - menuWidth - 12);
  const above = top - menuHeight - 10;
  const nextTop = above >= 66
    ? above
    : clamp(bottom + 10, 66, window.innerHeight - menuHeight - 12);
  selectionActionsEl.style.left = `${Math.round(nextLeft)}px`;
  selectionActionsEl.style.top = `${Math.round(nextTop)}px`;
  positionSelectionMenu();
}

function aiResultPoint(items) {
  const top = Math.min(...items.map(item => item.y));
  const right = Math.max(...items.map(item => item.x + item.width));
  return { x: right + 36, y: top };
}

function updateEmptyState() {
  emptyStateEl.classList.toggle("hidden", boardItems.length > 0);
  optimizeLayoutEl.disabled = boardItems.length < 2;
  optimizeLayoutEl.title = boardItems.length < 2
    ? "至少添加 2 个模块后才能优化布局"
    : "按模块关系自动分层并减少连线交叉";
}

function updateSelectionUi() {
  boardViewEl.querySelectorAll(".board-item").forEach(element => {
    element.classList.toggle("selected", selectedIds.has(element.dataset.id));
  });
  const selection = selectedItems();
  const canAlign = selectedIds.size > 1;
  document.getElementById("alignLeft").disabled = !canAlign;
  document.getElementById("alignTop").disabled = !canAlign;
  document.getElementById("connectItems").disabled = selectedIds.size !== 2;
  document.getElementById("connectItems").title = selectedIds.size === 2
    ? "按选择顺序连接：第一张卡片输出到第二张卡片"
    : "请选择两张卡片";
  document.getElementById("groupItems").disabled = !canAlign;
  document.getElementById("ungroupItems").disabled = ![...selectedIds]
    .some(id => itemById(id)?.groupId);
  selectionActionCountEl.textContent = `已选 ${selection.length} 项`;
  askSelectionWithCodexEl.disabled = !selection.length;
  askSelectionWithCodexEl.title = "基于所选内容继续提问或创作";
  extractKnowledgeCardEl.disabled = !selection.length || codexAtCapacity() || Boolean(standaloneWhiteboardTask());
  extractKnowledgeCardEl.title = selection.some(item => item.type === "folder")
    ? "文件夹仅按当前目录索引提炼，不会读取未明确打开的文件正文"
    : "把所选内容提炼为可编辑、可搜索的知识卡";
  selectionActionsEl.classList.toggle("hidden", !selection.length);
  if (!selection.length) document.getElementById("selectionMoreMenu").open = false;
  updateCodexSelectionContext();
  updateAllTaskItemElements();
  if (selection.length) requestAnimationFrame(positionSelectionActions);
}

function selectItems(ids, bringToFront = false) {
  selectedIds = new Set(ids.filter(id => itemById(id)));
  if (bringToFront && selectedIds.size) {
    for (const id of selectedIds) {
      const item = itemById(id);
      const element = itemElement(id);
      item.z = ++highestZ;
      if (element) element.style.zIndex = item.z;
    }
    scheduleSave();
  }
  updateSelectionUi();
}

function selectFromPointer(item, event) {
  if (event.shiftKey) {
    const next = new Set(selectedIds);
    if (next.has(item.id)) next.delete(item.id);
    else next.add(item.id);
    selectItems([...next], true);
    return;
  }
  if (item.groupId) {
    selectItems(boardItems.filter(candidate => candidate.groupId === item.groupId).map(candidate => candidate.id), true);
    return;
  }
  if (!selectedIds.has(item.id)) selectItems([item.id], true);
}

function syncItemSize(item, element) {
  if (focusedItemId === item.id) return;
  item.width = Math.round(element.offsetWidth);
  item.height = Math.round(element.offsetHeight);
  item.updatedAt = Date.now();
}

function appendSource(element, item) {
  if (!item.source?.url) return;
  const source = document.createElement("div");
  source.className = "source-line";
  const label = document.createElement("span");
  label.textContent = "来源";
  const link = document.createElement("a");
  link.href = item.source.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = item.source.title || item.source.url;
  link.title = item.source.url;
  link.addEventListener("pointerdown", event => event.stopPropagation());
  source.append(label, link);
  element.appendChild(source);
}

function enableDragging(handle, element, item) {
  let dragStart;
  handle.addEventListener("pointerdown", event => {
    if (focusedItemId === item.id || event.button !== 0 || event.target.closest("button")) return;
    event.preventDefault();
    selectFromPointer(item, event);
    const positions = new Map([...selectedIds].map(id => {
      const selected = itemById(id);
      return [id, { x: selected.x, y: selected.y }];
    }));
    dragStart = { clientX: event.clientX, clientY: event.clientY, positions };
    handle.setPointerCapture(event.pointerId);
    selectedIds.forEach(id => itemElement(id)?.classList.add("dragging"));
  });
  handle.addEventListener("pointermove", event => {
    if (!dragStart || !handle.hasPointerCapture(event.pointerId)) return;
    const deltaX = (event.clientX - dragStart.clientX) / zoom;
    const deltaY = (event.clientY - dragStart.clientY) / zoom;
    for (const [id, start] of dragStart.positions) {
      const selected = itemById(id);
      const selectedElement = itemElement(id);
      if (!selected || !selectedElement) continue;
      selected.x = start.x + deltaX;
      selected.y = start.y + deltaY;
      selectedElement.style.left = `${selected.x}px`;
      selectedElement.style.top = `${selected.y}px`;
    }
    ensureBoardContains([...selectedIds].map(itemById).filter(Boolean), dragStart.positions);
    scheduleConnectionRender();
    renderMinimap();
    positionSelectionActions();
  });
  const finish = event => {
    if (!dragStart || !handle.hasPointerCapture(event.pointerId)) return;
    handle.releasePointerCapture(event.pointerId);
    selectedIds.forEach(id => {
      const selected = itemById(id);
      const selectedElement = itemElement(id);
      if (selected && selectedElement) syncItemSize(selected, selectedElement);
      selectedElement?.classList.remove("dragging");
    });
    dragStart = undefined;
    commitHistory();
    scheduleSave();
  };
  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);
}

function normalizeTaskMessage(message) {
  const role = message?.role === "user" ? "user" : "assistant";
  const legacyText = String(message?.text || message?.content || "");
  const inferredKind = role === "assistant" && /^(?:图片|视频)已生成并添加到白板$/.test(legacyText.trim())
    ? "generation-result"
    : role === "user" && /^(?:总结|基于).*(?:圈选内容|当前回答|当前对话|原始素材)(?:生成图片|生成视频)?/.test(legacyText.trim())
      ? "generation-request"
      : "conversation";
  return {
    id: String(message?.id || db.makeId("task-message")),
    role,
    kind: ["conversation", "generation-request", "generation-result"].includes(message?.kind)
      ? message.kind
      : inferredKind,
    text: legacyText.slice(0, 40_000),
    createdAt: Number(message?.createdAt) || Date.now()
  };
}

function normalizeTaskMessages(messages, legacyItem = {}) {
  const normalized = (Array.isArray(messages) ? messages : [])
    .map(normalizeTaskMessage)
    .filter(message => message.text)
    .slice(-MAX_TASK_MESSAGES);
  if (normalized.length || !legacyItem.taskResult) return normalized;
  const createdAt = Number(legacyItem.createdAt) || Date.now();
  const migrated = [];
  if (String(legacyItem.text || "").trim()) {
    migrated.push(normalizeTaskMessage({
      id: `${legacyItem.id || "task"}-legacy-user`,
      role: "user",
      text: legacyItem.text,
      createdAt
    }));
  }
  migrated.push(normalizeTaskMessage({
    id: `${legacyItem.id || "task"}-legacy-assistant`,
    role: "assistant",
    text: legacyItem.taskResult,
    createdAt: Number(legacyItem.updatedAt) || createdAt
  }));
  return migrated;
}

function appendTaskMessage(messages, role, text, kind = "conversation") {
  return [
    ...normalizeTaskMessages(messages),
    normalizeTaskMessage({ role, text, kind })
  ].slice(-MAX_TASK_MESSAGES);
}

function taskConversationMessages(item) {
  return normalizeTaskMessages(item?.taskMessages, item)
    .filter(message => message.kind === "conversation");
}

function taskTurnForAnswer(messages, messageId = "") {
  const normalized = normalizeTaskMessages(messages).filter(message => message.kind === "conversation");
  const assistantIndex = messageId
    ? normalized.findIndex(message => message.id === messageId && message.role === "assistant")
    : normalized.findLastIndex(message => message.role === "assistant");
  if (assistantIndex < 0) return [];
  const userIndex = normalized.slice(0, assistantIndex).findLastIndex(message => message.role === "user");
  return [
    ...(userIndex >= 0 ? [normalized[userIndex]] : []),
    normalized[assistantIndex]
  ];
}

function taskGenerationContext(item, options = {}) {
  const conversation = taskConversationMessages(item);
  const requestedScope = String(options.scope || item?.taskGenerationScope || "");
  const requestedMessageId = String(options.messageId || item?.taskGenerationMessageId || "");
  const hasAnswer = conversation.some(message => message.role === "assistant");
  const scope = requestedScope === "message"
    ? "message"
    : ["latest", "conversation", "sources"].includes(requestedScope)
      ? requestedScope
      : hasAnswer ? "latest" : "sources";
  const messages = scope === "conversation"
    ? conversation.slice(-16)
    : ["latest", "message"].includes(scope)
      ? taskTurnForAnswer(conversation, scope === "message" ? requestedMessageId : "")
      : [];
  if (scope !== "sources" && !messages.length) {
    return { scope: "sources", label: "原始素材", messages: [], messageIds: [], messageId: "" };
  }
  return {
    scope,
    label: scope === "conversation" ? "当前对话" : scope === "sources" ? "原始素材" : "当前回答",
    messages,
    messageIds: messages.map(message => message.id),
    messageId: scope === "message" ? requestedMessageId : ""
  };
}

function taskGenerationContextText(context) {
  return context.messages
    .map(message => `${message.role === "user" ? "用户" : "Codex"}：\n${message.text}`)
    .join("\n\n---\n\n")
    .slice(-MAX_CODEX_CHAT_CONTEXT_CHARS);
}

function taskConversationContext(messages, currentMessageId) {
  let context = normalizeTaskMessages(messages)
    .filter(message => message.kind === "conversation" && message.id !== currentMessageId)
    .slice(-16)
    .map(message => `${message.role === "user" ? "用户" : "Codex"}：\n${message.text}`)
    .join("\n\n---\n\n");
  if (context.length > MAX_CODEX_CHAT_CONTEXT_CHARS) {
    context = context.slice(context.length - MAX_CODEX_CHAT_CONTEXT_CHARS);
  }
  return context;
}

function taskReplyContext(item) {
  const messageId = String(item?.taskReplyMessageId || "");
  const messages = taskConversationMessages(item);
  const answerIndex = messages.findIndex(message => message.id === messageId && message.role === "assistant");
  if (answerIndex < 0) return { messageId: "", messages: [], answerNumber: 0 };
  return {
    messageId,
    messages: taskTurnForAnswer(messages, messageId),
    answerNumber: messages.slice(0, answerIndex + 1).filter(message => message.role === "assistant").length
  };
}

function renderTaskMarkdown(element, markdown) {
  try {
    marked.setOptions({ gfm: true, breaks: false, headerIds: false, mangle: false });
    element.innerHTML = DOMPurify.sanitize(marked.parse(String(markdown || "")));
    element.querySelectorAll("a[href]").forEach(link => {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    });
  } catch (error) {
    console.warn("[pagedock-task] markdown render failed", error);
    element.textContent = String(markdown || "");
  }
}

async function copyTaskAnswer(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      console.warn("[pagedock-task] clipboard API unavailable, using selection fallback", error);
    }
  }
  const fallback = document.createElement("textarea");
  fallback.value = text;
  fallback.setAttribute("readonly", "");
  fallback.style.position = "fixed";
  fallback.style.opacity = "0";
  document.body.appendChild(fallback);
  fallback.select();
  const copied = document.execCommand("copy");
  fallback.remove();
  if (!copied) throw new Error("浏览器拒绝复制");
}

function positionTaskCreatePanel(trigger, panel) {
  if (!trigger?.isConnected || !panel?.matches(":popover-open")) return;
  const viewportInset = 12;
  const gap = 8;
  const triggerRect = trigger.getBoundingClientRect();
  const panelRect = panel.getBoundingClientRect();
  const panelWidth = panelRect.width || 236;
  const panelHeight = panelRect.height || 196;
  const roomBelow = window.innerHeight - triggerRect.bottom - viewportInset;
  const roomAbove = triggerRect.top - viewportInset;
  const placeAbove = roomBelow < panelHeight && roomAbove > roomBelow;
  const left = Math.min(
    Math.max(viewportInset, triggerRect.left),
    Math.max(viewportInset, window.innerWidth - panelWidth - viewportInset)
  );
  const requestedTop = placeAbove
    ? triggerRect.top - panelHeight - gap
    : triggerRect.bottom + gap;
  const top = Math.min(
    Math.max(viewportInset, requestedTop),
    Math.max(viewportInset, window.innerHeight - panelHeight - viewportInset)
  );
  panel.dataset.side = placeAbove ? "top" : "bottom";
  panel.style.left = `${Math.round(left)}px`;
  panel.style.top = `${Math.round(top)}px`;
}

function createTaskMessageElement(message, item, active = false) {
  const article = document.createElement("article");
  article.className = `task-message ${message.role}`;
  article.dataset.messageId = message.id;
  const label = document.createElement("div");
  label.className = "task-message-label";
  label.textContent = message.role === "user" ? "你" : aiRuntimeLabel();
  const body = document.createElement("div");
  body.className = "task-message-body";
  if (message.role === "assistant") renderTaskMarkdown(body, message.text);
  else body.textContent = message.text;
  article.append(label, body);
  if (message.role === "assistant" && message.kind === "conversation") {
    const actions = document.createElement("div");
    actions.className = "task-message-actions";
    const copy = document.createElement("button");
    copy.className = "task-message-action";
    copy.type = "button";
    copy.textContent = "复制";
    copy.addEventListener("click", async () => {
      try {
        await copyTaskAnswer(message.text);
        copy.textContent = "已复制";
        window.setTimeout(() => { copy.textContent = "复制"; }, 1600);
      } catch (error) {
        console.warn("[pagedock-task] answer copy failed", error);
        setStatus("复制失败，请重新选择文字", true);
      }
    });
    const quote = document.createElement("button");
    quote.className = "task-message-action task-message-quote";
    quote.type = "button";
    quote.textContent = "引用";
    quote.disabled = active;
    quote.addEventListener("click", () => {
      item.taskReplyMessageId = message.id;
      item.updatedAt = Date.now();
      updateTaskItemElement(item);
      scheduleSave();
      requestAnimationFrame(() => itemElement(item.id)?.querySelector(".task-prompt")?.focus());
    });
    const createMenu = document.createElement("div");
    createMenu.className = "task-create-menu";
    const createSummary = document.createElement("button");
    createSummary.className = "task-message-action task-create-summary";
    createSummary.type = "button";
    createSummary.textContent = "创作";
    createSummary.setAttribute("aria-label", "基于这条回答继续创作");
    createSummary.setAttribute("aria-expanded", "false");
    const createPanel = document.createElement("div");
    createPanel.className = "task-create-panel";
    createPanel.id = `task-create-${message.id}`;
    createPanel.setAttribute("popover", "auto");
    createPanel.setAttribute("role", "dialog");
    createPanel.setAttribute("aria-label", "选择创作方式");
    createSummary.setAttribute("popovertarget", createPanel.id);
    const createContext = document.createElement("label");
    createContext.className = "task-create-context";
    const createLabel = document.createElement("span");
    createLabel.textContent = "素材范围";
    const createSelect = document.createElement("select");
    createSelect.setAttribute("aria-label", "选择创作依据");
    createSelect.disabled = active;
    [
      ["message", "当前回答"],
      ["conversation", "完整对话"],
      ["sources", "原始素材"]
    ].forEach(([value, text]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = text;
      option.disabled = value === "sources" && !item.taskSourceCount;
      createSelect.appendChild(option);
    });
    [
      ["text", "文字总结", "提炼为可编辑文字", "文"],
      ["image", "手稿信息图", "用模板稳定呈现结构与关系", "图"],
      ["image-gen", "AI 自由绘图", "由 Codex image-gen 直接创作", "绘"],
      ["video", "生成视频", "生成纯画面视频", "影"]
    ].forEach(([mode, title, description, icon]) => {
      const button = document.createElement("button");
      button.className = "task-create-option";
      button.type = "button";
      button.dataset.mode = mode;
      const optionIcon = document.createElement("span");
      optionIcon.className = "task-create-option-icon";
      optionIcon.setAttribute("aria-hidden", "true");
      optionIcon.textContent = icon;
      const optionCopy = document.createElement("span");
      optionCopy.className = "task-create-option-copy";
      const optionTitle = document.createElement("span");
      optionTitle.className = "task-create-option-title";
      optionTitle.textContent = title;
      const optionDescription = document.createElement("span");
      optionDescription.className = "task-create-option-description";
      optionDescription.textContent = description;
      optionCopy.append(optionTitle, optionDescription);
      button.append(optionIcon, optionCopy);
      button.disabled = active || codexAtCapacity();
      button.addEventListener("click", () => {
        button.dataset.state = "loading";
        button.setAttribute("aria-busy", "true");
        createPanel.hidePopover();
        const scope = createSelect.value;
        runWhiteboardCodex(mode, item, {
          scope,
          messageId: scope === "message" ? message.id : ""
        });
      });
      createPanel.appendChild(button);
    });
    createContext.append(createLabel, createSelect);
    createPanel.appendChild(createContext);
    let stopPositionTracking = () => {};
    createPanel.addEventListener("toggle", event => {
      const open = event.newState === "open";
      createSummary.setAttribute("aria-expanded", String(open));
      stopPositionTracking();
      stopPositionTracking = () => {};
      if (!open) return;
      const reposition = () => positionTaskCreatePanel(createSummary, createPanel);
      const taskThread = article.closest(".task-thread");
      requestAnimationFrame(reposition);
      window.addEventListener("resize", reposition);
      taskThread?.addEventListener("scroll", reposition, { passive: true });
      stopPositionTracking = () => {
        window.removeEventListener("resize", reposition);
        taskThread?.removeEventListener("scroll", reposition);
      };
    });
    createMenu.append(createSummary, createPanel);
    actions.append(copy, quote, createMenu);
    article.appendChild(actions);
  }
  return article;
}

function renderTaskThread(item, thread, active) {
  const messages = normalizeTaskMessages(item.taskMessages, item);
  const events = Array.isArray(item.taskEvents) ? item.taskEvents : [];
  const state = active ? "running" : (item.taskStatus || "idle");
  const signature = [
    ...messages.map(message => `${message.id}:${message.text.length}:${message.text.slice(-24)}`),
    ...events.slice(-12).map(event => `${event.id}:${event.status}:${event.label}:${event.detail}`),
    `progress:${item.taskProgress || ""}`,
    `state:${state}`,
    `expanded:${expandedTaskThreadIds.has(item.id)}`
  ].join("|");
  if (thread.dataset.signature === signature) {
    const loading = thread.querySelector(".task-loading");
    if (loading) loading.textContent = item.taskProgress || "Codex 正在理解并组织回答…";
    return;
  }
  const previousMessageCount = Number(thread.dataset.messageCount) || 0;
  const shouldStickToBottom = !thread.dataset.signature
    || thread.scrollHeight - thread.scrollTop - thread.clientHeight < 48;
  thread.dataset.signature = signature;
  thread.dataset.messageCount = String(messages.length);
  thread.replaceChildren();
  thread.hidden = !messages.length && !events.length && !active;
  if (thread.hidden) return;

  const process = createTaskProcess(item, active);
  // 过程日志与会话分层：完成后置顶折叠，会话始终按时间正序阅读。
  if (!active && process) thread.appendChild(process);
  const expanded = expandedTaskThreadIds.has(item.id);
  const hiddenMessageCount = expanded ? 0 : Math.max(0, messages.length - TASK_VISIBLE_MESSAGE_LIMIT);
  if (hiddenMessageCount) {
    const reveal = document.createElement("button");
    reveal.className = "task-thread-reveal";
    reveal.type = "button";
    reveal.textContent = `显示更早的 ${hiddenMessageCount} 条消息`;
    reveal.addEventListener("click", () => {
      expandedTaskThreadIds.add(item.id);
      thread.dataset.signature = "";
      renderTaskThread(item, thread, active);
    });
    thread.appendChild(reveal);
  }
  messages.slice(hiddenMessageCount).forEach(message => {
    thread.appendChild(createTaskMessageElement(message, item, active));
  });
  if (active) {
    if (process) thread.appendChild(process);
    const loading = document.createElement("div");
    loading.className = "task-loading";
    loading.setAttribute("role", "status");
    loading.textContent = item.taskProgress || "Codex 正在理解并组织回答…";
    thread.appendChild(loading);
  }
  requestAnimationFrame(() => {
    if (shouldStickToBottom || messages.length > previousMessageCount) thread.scrollTop = thread.scrollHeight;
  });
}

function taskErrorPresentation(rawError, cancelled = false) {
  const detail = String(rawError || "").trim();
  if (cancelled) return { summary: "任务已停止，可以重新执行", detail: "" };
  if (/最多可同时执行|个任务执行中/.test(detail)) {
    return { summary: codexAtCapacity() ? codexCapacityReason() : "现在可以重新执行", detail };
  }
  if (/未连接|桥接|native host|node:/i.test(detail)) return { summary: "Codex 暂时不可用，请检查本地连接", detail };
  if (/timeout|超时|超过\s*\d+\s*(?:分钟|小时)/i.test(detail)) return { summary: "任务耗时过长，已自动停止", detail };
  if (/hyperframes|browsergpumode|render|渲染/i.test(detail)) return { summary: "视频生成没有完成，请重试", detail };
  if (/remotion/i.test(detail)) return { summary: "Remotion 视频生成没有完成，请重试", detail };
  if (/图片|image/i.test(detail)) return { summary: "图片处理没有完成，请检查素材后重试", detail };
  return { summary: detail ? "任务执行失败，请重试" : "任务执行失败，请重试", detail };
}

function resizeTaskPrompt(prompt) {
  if (!prompt || prompt.hidden) return;
  prompt.style.height = "auto";
  const minimumHeight = Number.parseFloat(getComputedStyle(prompt).minHeight) || 64;
  const maximumHeight = Number.parseFloat(getComputedStyle(prompt).maxHeight) || 180;
  const nextHeight = Math.min(Math.max(minimumHeight, prompt.scrollHeight + 2), maximumHeight);
  prompt.style.height = `${nextHeight}px`;
  prompt.style.overflowY = prompt.scrollHeight + 2 > maximumHeight ? "auto" : "hidden";
}

function taskStatusText(item, active) {
  if (active) return item.taskProgress || `${aiRuntimeLabel()} 正在执行…`;
  if (item.taskStatus === "error") return taskErrorPresentation(item.taskError).summary;
  if (item.taskStatus === "cancelled") return "任务已停止";
  if (codexAtCapacity()) return codexCapacityReason();
  if (item.taskStatus === "success") return item.taskWorkflowRole === "controller" ? "工作流已完成" : "可以继续追问";
  if (normalizeTaskMessages(item.taskMessages, item).length) return "继续提问";
  if (item.taskSourceCount) return "输入问题，或选择快捷操作";
  return "描述任务后发送";
}

function taskWorkflowPendingText(item) {
  const dependencies = [...new Set([...(item.taskSourceIds || []), ...(item.relationSourceIds || [])])]
    .map(itemById)
    .filter(source => source?.taskWorkflowRole === "step" && source.taskStatus !== "success");
  return dependencies.length
    ? `等待上一步 · ${dependencies.map(source => source.taskWorkflowTitle).filter(Boolean).join("、") || "依赖任务"}`
    : "等待执行";
}

function taskWorkflowModeLabel(mode) {
  return ({ coding: "Codex", text: "文字", "image-gen": "图片", video: "视频" })[mode] || "任务";
}

function taskVideoEngine(value) {
  return value === "remotion" ? "remotion" : "hyperframes";
}

function taskCardLabel(item) {
  const lens = PageDockBoardDomain.workflowLens(item.taskWorkflowLens);
  const hasConversation = normalizeTaskMessages(item.taskMessages, item).length > 0;
  return item.taskWorkflowRole === "controller"
    ? `动态工作流${lens.id === "general" ? "" : ` · ${lens.label}`} · ${item.taskWorkflowTitle || "执行中"}`
    : item.taskWorkflowRole === "step"
      ? `执行容器 · ${taskWorkflowModeLabel(item.taskWorkflowMode)} · ${item.taskWorkflowTitle || "未命名步骤"}`
      : item.taskSourceCount
        ? `基于 ${item.taskSourceCount} 项素材`
        : hasConversation ? `与 ${aiRuntimeLabel()} 对话` : `问问 ${aiRuntimeLabel()}`;
}

function localDateTimeValue(timestamp) {
  const date = new Date(timestamp);
  const pad = value => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function taskScheduleLabel(input) {
  const schedule = PageDockBoardDomain.normalizeTaskSchedule(input);
  if (!schedule?.enabled || !schedule.nextRunAt) return "定时";
  const prefix = schedule.execution === "workflow" ? "工作流 · " : "";
  const date = new Date(schedule.nextRunAt);
  const time = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
  if (schedule.repeat === "daily") return `${prefix}每天 ${time}`;
  if (schedule.repeat === "weekly") return `${prefix}每周${"日一二三四五六"[date.getDay()]} ${time}`;
  return `${prefix}${date.getMonth() + 1}/${date.getDate()} ${time}`;
}

function openTaskScheduleDialog(item) {
  if (!item || item.type !== "task" || item.taskWorkflowRole === "step") return;
  scheduledTaskItemId = item.id;
  const schedule = PageDockBoardDomain.normalizeTaskSchedule(item.taskSchedule);
  const earliest = Date.now() + 60_000;
  taskScheduleAtEl.min = localDateTimeValue(earliest);
  taskScheduleAtEl.value = localDateTimeValue(schedule?.nextRunAt > earliest ? schedule.nextRunAt : Date.now() + 60 * 60_000);
  taskScheduleRepeatEl.value = schedule?.repeat || "once";
  taskScheduleExecutionEl.value = item.taskWorkflowRole === "controller" ? "workflow" : (schedule?.execution || "task");
  taskScheduleExecutionEl.disabled = item.taskWorkflowRole === "controller";
  clearTaskScheduleEl.hidden = !schedule?.enabled;
  taskScheduleDialogEl.showModal();
}

async function persistTaskSchedule(item, schedule) {
  item.taskSchedule = PageDockBoardDomain.normalizeTaskSchedule(schedule);
  item.updatedAt = Date.now();
  updateTaskItemElement(item);
  if (!await saveBoardNow()) throw new Error("定时规则保存失败");
  const response = await chrome.runtime.sendMessage({
    type: TASK_SCHEDULE_SYNC_REQUEST,
    boardId: currentBoard.id,
    itemId: item.id
  });
  if (!response?.ok) throw new Error(response?.error || "后台定时器同步失败");
  notifyDataChanged([currentBoard.id], "task-schedule-updated");
}

function updateTaskItemElement(item) {
  const element = itemElement(item.id);
  if (!element || item.type !== "task") return;
  const activeConversationTask = boardCardTaskForItem(item.id);
  const activeShortcutTask = whiteboardTaskForItem(item.id);
  const activeWorkflow = dynamicWorkflowRuns.get(item.id);
  const persistedRunIds = item.taskWorkflowRole === "controller"
    ? [item.taskRunId, ...(item.taskWorkflowStepIds || []).map(id => itemById(id)?.taskRunId)]
    : [item.taskRunId];
  const scheduledPersisted = item.taskStatus === "running"
    && persistedRunIds.some(id => String(id || "").startsWith("scheduled-"));
  const activePersisted = scheduledPersisted || persistedRunIds.some(id => id && codexActiveTaskIds.has(String(id)));
  const preparing = preparingTaskItemIds.has(item.id);
  const activeConversation = Boolean(activeConversationTask);
  const activeShortcut = Boolean(activeShortcutTask);
  const active = preparing || activeConversation || activeShortcut || Boolean(activeWorkflow) || activePersisted;
  const content = element.querySelector(".task-content");
  const label = element.querySelector(".task-label");
  const prompt = element.querySelector(".task-prompt");
  const status = element.querySelector(".task-status");
  const send = element.querySelector(".task-send");
  const orchestrate = element.querySelector(".task-orchestrate");
  const stop = element.querySelector(".task-stop");
  const retry = element.querySelector(".task-retry");
  const edit = element.querySelector(".task-edit");
  const errorPanel = element.querySelector(".task-error-panel");
  const errorSummary = element.querySelector(".task-error-summary");
  const errorDetail = element.querySelector(".task-error-details");
  const errorDetailText = element.querySelector(".task-error-details pre");
  const starters = [...element.querySelectorAll(".task-starter")];
  const starterGroup = element.querySelector(".task-starters");
  const composeMain = element.querySelector(".task-compose-main");
  const composeContext = element.querySelector(".task-compose-context");
  const composeContextLabel = element.querySelector(".task-compose-context-label");
  const composeContextClear = element.querySelector(".task-compose-context-clear");
  const settingsToggle = element.querySelector(".task-settings-toggle");
  const workflowLens = element.querySelector(".task-workflow-lens");
  const videoEngine = element.querySelector(".task-video-engine");
  const scheduleButton = element.querySelector(".task-schedule-button");
  const actions = element.querySelector(".task-actions");
  const thread = element.querySelector(".task-thread");
  if (!content || !label || !prompt || !status || !send || !orchestrate || !stop || !retry || !edit || !errorPanel || !errorSummary || !errorDetail || !errorDetailText || !starterGroup || !composeMain || !composeContext || !composeContextLabel || !composeContextClear || !settingsToggle || !workflowLens || !videoEngine || !scheduleButton || !actions || !thread) return;
  const state = active ? "running" : (item.taskStatus || "idle");
  const pending = item.taskWorkflowRole === "step" && state === "idle";
  const failed = ["error", "cancelled"].includes(state);
  const atCapacity = !active && codexAtCapacity();
  const conversation = taskConversationMessages(item);
  const hasAnswer = conversation.some(message => message.role === "assistant");
  const replyContext = taskReplyContext(item);
  if (item.taskReplyMessageId && !replyContext.messageId) item.taskReplyMessageId = "";
  content.dataset.state = pending ? "pending" : state;
  label.textContent = taskCardLabel(item);
  content.dataset.atCapacity = String(atCapacity);
  content.setAttribute("aria-busy", String(active));
  if (!active && prompt.value !== String(item.text || "")) prompt.value = String(item.text || "");
  prompt.disabled = false;
  prompt.hidden = active || failed || pending;
  prompt.placeholder = conversation.length
      ? replyContext.messageId
        ? "围绕引用的回答继续提问，回车发送，Shift + 回车换行"
        : "继续当前对话，回车发送，Shift + 回车换行"
      : item.taskSourceCount
        ? "针对已选素材自由提问，回车发送，Shift + 回车换行"
        : "描述要完成的任务，回车发送，Shift + 回车换行";
  send.hidden = active || failed || pending;
  send.disabled = active || atCapacity || !String(item.text || "").trim();
  send.textContent = "发送";
  send.title = atCapacity
    ? codexCapacityReason()
    : !String(item.text || "").trim()
      ? "先输入问题或要完成的任务"
      : `发送给 ${aiRuntimeLabel()}`;
  const settingsExpanded = settingsToggle.getAttribute("aria-expanded") === "true";
  // Keep the common question flow visually dominant; reveal orchestration with the advanced controls.
  orchestrate.hidden = active || failed || item.taskWorkflowRole === "step" || !settingsExpanded;
  orchestrate.disabled = active || atCapacity || !String(item.text || "").trim();
  const lens = PageDockBoardDomain.workflowLens(item.taskWorkflowLens);
  orchestrate.title = atCapacity
    ? codexCapacityReason()
    : !String(item.text || "").trim()
      ? "先描述一个需要分步骤完成的目标"
      : `按“${lens.label}”视角规划并执行多步骤工作流`;
  starterGroup.hidden = item.taskWorkflowRole === "step" || hasAnswer || !item.taskSourceCount || active || failed;
  starters.forEach(button => {
    button.disabled = active || atCapacity;
    button.title = atCapacity
      ? codexCapacityReason()
      : `${button.textContent}（基于原始素材）`;
  });
  composeContext.hidden = active || failed || pending;
  composeMain.hidden = active || failed || pending;
  composeContextLabel.textContent = replyContext.messageId
    ? `引用：第 ${replyContext.answerNumber} 条回答`
    : hasAnswer
      ? "继续当前对话"
      : item.taskSourceCount
        ? `基于：${item.taskSourceCount} 项素材`
        : "直接提问";
  composeContext.dataset.kind = replyContext.messageId ? "quote" : "default";
  composeContextClear.hidden = !replyContext.messageId;
  settingsToggle.hidden = Boolean(item.taskWorkflowRole);
  settingsToggle.textContent = settingsExpanded ? "收起设置" : item.taskSchedule?.enabled ? "已定时" : "更多设置";
  settingsToggle.title = settingsExpanded ? "收起高级能力" : "工作流、视频与定时等高级能力";
  workflowLens.hidden = Boolean(item.taskWorkflowRole) || !settingsExpanded;
  workflowLens.disabled = active;
  workflowLens.value = PageDockBoardDomain.workflowLens(item.taskWorkflowLens).id;
  videoEngine.hidden = Boolean(item.taskWorkflowRole === "step") || !settingsExpanded;
  videoEngine.disabled = active;
  videoEngine.value = taskVideoEngine(item.taskVideoEngine);
  scheduleButton.hidden = item.taskWorkflowRole === "step" || !settingsExpanded;
  scheduleButton.textContent = taskScheduleLabel(item.taskSchedule);
  scheduleButton.dataset.active = String(Boolean(item.taskSchedule?.enabled));
  scheduleButton.title = item.taskSchedule?.enabled ? `下次执行：${new Date(item.taskSchedule.retryAt || item.taskSchedule.nextRunAt).toLocaleString()}` : "设置定时执行";
  stop.hidden = !preparing && !activeConversation && !activeShortcut && !activeWorkflow && !activePersisted;
  stop.disabled = Boolean(active && (activeConversation
    ? activeConversationTask?.cancelRequested
    : activeShortcut
      ? activeShortcutTask?.cancelRequested
      : activeWorkflow
        ? activeWorkflow.cancelRequested
        : cancellingPreparedTaskItemIds.has(item.id)));
  retry.hidden = !failed;
  retry.disabled = atCapacity;
  const retryMode = ({ text: "总结", image: "手稿图", "image-gen": "图片", video: "视频", "video-post": "口播视频" })[item.taskLastMode] || "任务";
  retry.textContent = `重试${retryMode}`;
  retry.title = atCapacity ? codexCapacityReason() : `重新执行这项${retryMode}`;
  edit.hidden = !failed;
  const error = taskErrorPresentation(item.taskError, state === "cancelled");
  errorPanel.hidden = !failed;
  errorSummary.textContent = error.summary;
  errorDetail.hidden = !error.detail;
  errorDetailText.textContent = error.detail;
  status.textContent = active || failed ? "" : pending ? taskWorkflowPendingText(item) : taskStatusText(item, active);
  status.title = status.textContent;
  actions.hidden = !active && !failed && !atCapacity && !pending;
  renderTaskThread(item, thread, active);
  element.querySelectorAll(".task-create-option").forEach(button => {
    button.disabled = active || atCapacity;
    const title = button.querySelector(".task-create-option-title")?.textContent || "继续创作";
    button.title = atCapacity ? codexCapacityReason() : `${title}（基于当前选择）`;
  });
  element.querySelectorAll(".task-create-summary").forEach(button => {
    button.disabled = active || atCapacity;
    button.title = active ? "当前任务执行中" : atCapacity ? codexCapacityReason() : "继续创作";
    button.closest(".task-create-menu").dataset.state = button.disabled ? "disabled" : "default";
  });
  element.querySelectorAll(".task-create-context select").forEach(select => { select.disabled = active; });
  element.querySelectorAll(".task-message-quote").forEach(button => { button.disabled = active; });
  requestAnimationFrame(() => resizeTaskPrompt(prompt));
}

function updateAllTaskItemElements() {
  boardItems.filter(item => item.type === "task").forEach(updateTaskItemElement);
}

function createTaskContent(item, element) {
  const content = document.createElement("div");
  content.className = "task-content";
  const label = document.createElement("div");
  label.className = "task-label";
  label.textContent = taskCardLabel(item);
  const starters = document.createElement("div");
  starters.className = "task-starters";
  const starterLabel = document.createElement("span");
  starterLabel.className = "task-starters-label";
  starterLabel.textContent = "从素材开始";
  starters.appendChild(starterLabel);
  [
    ["text", "总结"],
    ["image", "做成信息图"],
    ["image-gen", "自由画图"]
  ].forEach(([mode, text]) => {
    const button = document.createElement("button");
    button.className = "task-starter";
    button.type = "button";
    button.dataset.mode = mode;
    button.textContent = text;
    button.addEventListener("click", () => runWhiteboardCodex(mode, item, { scope: "sources" }));
    starters.appendChild(button);
  });
  const intro = document.createElement("div");
  intro.className = "task-intro";
  intro.appendChild(label);
  const prompt = document.createElement("textarea");
  prompt.className = "task-prompt";
  prompt.maxLength = 8_000;
  prompt.placeholder = item.taskSourceCount
    ? "针对已选素材自由提问，回车发送，Shift + 回车换行"
    : "描述要完成的任务，回车发送，Shift + 回车换行";
  prompt.setAttribute("aria-label", "Codex 任务内容");
  prompt.value = item.text || "";
  prompt.addEventListener("input", () => {
    item.text = prompt.value;
    item.updatedAt = Date.now();
    item.taskStatus = item.taskStatus === "error" ? "idle" : item.taskStatus;
    // 输入新的问题即回到对话模式，避免继承上一轮图片或视频任务的重试方式。
    if (String(prompt.value || "").trim()) item.taskLastMode = "coding";
    item.taskError = "";
    resizeTaskPrompt(prompt);
    updateTaskItemElement(item);
    scheduleSave();
    queueHistoryCommit();
  });
  prompt.addEventListener("keydown", event => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    if (!send.disabled) runBoardCardTask(item);
  });
  const thread = document.createElement("div");
  thread.className = "task-thread";
  thread.setAttribute("role", "log");
  thread.setAttribute("aria-label", "Codex 对话记录");
  thread.setAttribute("aria-live", "polite");
  thread.setAttribute("aria-relevant", "additions text");
  const errorPanel = document.createElement("section");
  errorPanel.className = "task-error-panel";
  errorPanel.hidden = true;
  errorPanel.setAttribute("role", "alert");
  const errorSummary = document.createElement("strong");
  errorSummary.className = "task-error-summary";
  const errorDetails = document.createElement("details");
  errorDetails.className = "task-error-details";
  const errorDetailsSummary = document.createElement("summary");
  errorDetailsSummary.textContent = "查看技术详情";
  const errorDetailsText = document.createElement("pre");
  errorDetails.append(errorDetailsSummary, errorDetailsText);
  errorPanel.append(errorSummary, errorDetails);
  const compose = document.createElement("div");
  compose.className = "task-compose";
  const composeContext = document.createElement("div");
  composeContext.className = "task-compose-context";
  const composeContextLabel = document.createElement("span");
  composeContextLabel.className = "task-compose-context-label";
  const composeContextClear = document.createElement("button");
  composeContextClear.className = "task-compose-context-clear";
  composeContextClear.type = "button";
  composeContextClear.textContent = "×";
  composeContextClear.setAttribute("aria-label", "取消引用回答");
  composeContextClear.addEventListener("click", () => {
    item.taskReplyMessageId = "";
    item.updatedAt = Date.now();
    updateTaskItemElement(item);
    scheduleSave();
    requestAnimationFrame(() => prompt.focus());
  });
  const workflowLens = document.createElement("select");
  workflowLens.className = "task-workflow-lens";
  workflowLens.setAttribute("aria-label", "工作流成长视角");
  workflowLens.title = "选择动态工作流的规划侧重点";
  [["general", "通用"], ["efficiency", "提效"], ["skill", "技能"], ["perspective", "视野"], ["strategy", "格局"]].forEach(([value, text]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    workflowLens.appendChild(option);
  });
  workflowLens.value = PageDockBoardDomain.workflowLens(item.taskWorkflowLens).id;
  workflowLens.addEventListener("change", () => {
    item.taskWorkflowLens = PageDockBoardDomain.workflowLens(workflowLens.value).id;
    item.updatedAt = Date.now();
    scheduleSave();
    queueHistoryCommit();
  });
  const videoEngine = document.createElement("select");
  videoEngine.className = "task-video-engine";
  videoEngine.setAttribute("aria-label", "视频生成引擎");
  [["hyperframes", "视频 · HyperFrames"], ["remotion", "视频 · Remotion"]].forEach(([value, text]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    videoEngine.appendChild(option);
  });
  videoEngine.value = taskVideoEngine(item.taskVideoEngine);
  videoEngine.addEventListener("change", () => {
    item.taskVideoEngine = taskVideoEngine(videoEngine.value);
    item.updatedAt = Date.now();
    scheduleSave();
    queueHistoryCommit();
  });
  const scheduleButton = document.createElement("button");
  scheduleButton.className = "task-schedule-button";
  scheduleButton.type = "button";
  scheduleButton.textContent = taskScheduleLabel(item.taskSchedule);
  scheduleButton.addEventListener("click", () => openTaskScheduleDialog(item));
  const settingsToggle = document.createElement("button");
  settingsToggle.className = "task-settings-toggle";
  settingsToggle.type = "button";
  settingsToggle.textContent = "更多设置";
  settingsToggle.setAttribute("aria-expanded", "false");
  settingsToggle.addEventListener("click", () => {
    settingsToggle.setAttribute("aria-expanded", String(settingsToggle.getAttribute("aria-expanded") !== "true"));
    updateTaskItemElement(item);
  });
  composeContext.append(composeContextLabel, composeContextClear, settingsToggle, workflowLens, videoEngine, scheduleButton);
  const composeMain = document.createElement("div");
  composeMain.className = "task-compose-main";
  const actions = document.createElement("div");
  actions.className = "task-actions";
  const status = document.createElement("span");
  status.className = "task-status";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const stop = document.createElement("button");
  stop.className = "task-button stop task-stop";
  stop.type = "button";
  stop.textContent = "停止";
  stop.hidden = true;
  stop.addEventListener("click", () => cancelTaskItem(item));
  const edit = document.createElement("button");
  edit.className = "task-button task-edit";
  edit.type = "button";
  edit.textContent = "修改";
  edit.hidden = true;
  edit.addEventListener("click", () => {
    item.taskStatus = "idle";
    item.taskError = "";
    updateTaskItemElement(item);
    scheduleSave();
    requestAnimationFrame(() => prompt.focus());
  });
  const retry = document.createElement("button");
  retry.className = "task-button primary task-retry";
  retry.type = "button";
  retry.textContent = "重试";
  retry.hidden = true;
  retry.addEventListener("click", () => retryTaskItem(item));
  const send = document.createElement("button");
  send.className = "task-button primary task-send";
  send.type = "button";
  send.textContent = "发送";
  send.addEventListener("click", () => runBoardCardTask(item));
  const orchestrate = document.createElement("button");
  orchestrate.className = "task-button task-orchestrate";
  orchestrate.type = "button";
  orchestrate.textContent = "规划多步任务";
  orchestrate.title = "适合检索、整理、画图或视频等需要连续完成的目标";
  orchestrate.hidden = true;
  orchestrate.addEventListener("click", () => runDynamicWorkflow(item));
  composeMain.append(prompt, orchestrate, send);
  actions.append(status, edit, stop, retry);
  compose.append(composeContext, composeMain, actions);
  content.append(intro, starters, thread, errorPanel, compose);
  content.addEventListener("pointerdown", event => event.stopPropagation());
  element.appendChild(content);
  requestAnimationFrame(() => updateTaskItemElement(item));
}

function terminalItemForTask(taskId) {
  return boardItems.find(item => item.type === "terminal" && item.terminalTaskId === String(taskId || ""));
}

function appendTerminalOutput(item, chunk) {
  const next = `${item.terminalOutput || ""}${String(chunk || "")}`;
  if (next.length <= MAX_TERMINAL_OUTPUT_CHARS) {
    item.terminalOutput = next;
    return;
  }
  item.terminalOutput = `[前序输出已截断]\n${next.slice(-(MAX_TERMINAL_OUTPUT_CHARS - 10_000))}`;
}

function clearTerminalSaveTimer(itemId) {
  const timer = terminalSaveTimers.get(itemId);
  if (timer) clearTimeout(timer);
  terminalSaveTimers.delete(itemId);
}

function scheduleTerminalSave(item) {
  clearTerminalSaveTimer(item.id);
  terminalSaveTimers.set(item.id, setTimeout(() => {
    terminalSaveTimers.delete(item.id);
    scheduleSave();
  }, TERMINAL_SAVE_IDLE_MS));
}

function disposeTerminalRenderer(session) {
  if (!session) return;
  if (session.fitFrame) cancelAnimationFrame(session.fitFrame);
  session.observer?.disconnect();
  try { session.terminal?.dispose(); } catch {}
  if (terminalSessions.get(session.item?.terminalSessionId) === session) {
    terminalSessions.delete(session.item.terminalSessionId);
  }
}

function disposeTerminalRenderers() {
  for (const session of terminalSessions.values()) disposeTerminalRenderer(session);
  terminalSessions.clear();
}

function terminalStatusLabel(item) {
  if (item.terminalStatus === "connecting") return "正在连接";
  if (item.terminalStatus === "connected") return "已连接";
  if (item.terminalStatus === "closed") return "已关闭";
  if (item.terminalStatus === "running") return "执行中";
  if (item.terminalStatus === "done") return item.terminalExitCode === 0 ? "已完成" : `退出码 ${item.terminalExitCode}`;
  if (item.terminalStatus === "error") return "执行失败";
  if (item.terminalStatus === "cancelled") return "已停止";
  return "就绪";
}

function updateTerminalItemElement(item, scrollToEnd = true) {
  const element = itemElement(item.id);
  if (!element) return;
  const content = element.querySelector(".terminal-content");
  const connect = element.querySelector(".terminal-connect");
  if (!content || !connect) return;
  content.dataset.state = item.terminalStatus || "idle";
  element.querySelector(".terminal-cwd").textContent = item.terminalCwd || "本地编码工作区";
  element.querySelector(".terminal-cwd").title = item.terminalCwd || "执行目录由本地桥接配置";
  element.querySelector(".terminal-state").textContent = terminalStatusLabel(item);
  const active = ["connected", "connecting"].includes(item.terminalStatus);
  connect.textContent = active ? "关闭" : "连接";
  connect.setAttribute("aria-label", active ? "关闭终端会话" : "连接终端会话");
  if (scrollToEnd) terminalSessions.get(item.terminalSessionId)?.terminal?.scrollToBottom();
  updatePermissionChip(item, element);
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(String(value || ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function openTerminalSession(item, element = itemElement(item.id), resumeExisting = false) {
  const session = terminalSessions.get(item.terminalSessionId);
  if (!session || (!resumeExisting && ["connected", "connecting"].includes(item.terminalStatus))) return;
  try {
    session.fitAddon.fit();
    item.terminalStatus = "connecting";
    cardProtocol.grant(item, "local-shell");
    updateTerminalItemElement(item, false);
    scheduleSave();
    const response = await chrome.runtime.sendMessage({
      type: TERMINAL_SESSION_OPEN_REQUEST,
      id: item.terminalSessionId,
      cols: session.terminal.cols,
      rows: session.terminal.rows
    });
    if (!response?.ok) throw new Error(response?.error || "终端会话启动失败");
    updateCodexTaskSnapshot(response);
    if (response.terminalWorkspace) item.terminalCwd = response.terminalWorkspace;
    session.terminal.focus();
    updateTerminalItemElement(item, false);
    console.info("[pagedock-terminal] PTY session requested", { id: item.terminalSessionId, itemId: item.id });
  } catch (error) {
    item.terminalStatus = "error";
    session.terminal.writeln(`\r\n\x1b[31m[拾作] ${error?.message || "终端连接失败"}\x1b[0m`);
    updateTerminalItemElement(item, false);
    scheduleSave();
  }
}

async function closeTerminalSession(item) {
  if (!item?.terminalSessionId) return;
  try {
    await chrome.runtime.sendMessage({ type: TERMINAL_SESSION_CLOSE_REQUEST, id: item.terminalSessionId });
  } catch (error) {
    console.warn("[pagedock-terminal] PTY close failed", { id: item.terminalSessionId, reason: error?.message || String(error) });
  }
  item.terminalStatus = "closed";
  updateTerminalItemElement(item, false);
  scheduleSave();
}

async function runTerminalItem(item) {
  if (!item || item.type !== "terminal" || item.terminalStatus === "running") return;
  const element = itemElement(item.id);
  const input = element?.querySelector(".terminal-input");
  const command = String(input?.value || "").trim();
  if (!command) {
    input?.focus();
    return;
  }
  const taskId = db.makeId("terminal");
  item.text = command;
  item.terminalHistory = [...(item.terminalHistory || []), command].slice(-30);
  item.terminalStatus = "running";
  item.terminalTaskId = taskId;
  item.terminalExitCode = null;
  appendTerminalOutput(item, `${item.terminalOutput && !item.terminalOutput.endsWith("\n") ? "\n" : ""}$ ${command}\n`);
  input.value = "";
  item.updatedAt = Date.now();
  terminalTasks.set(taskId, { boardId: currentBoard.id, item });
  updateTerminalItemElement(item);
  scheduleSave();
  console.info("[pagedock-terminal] command requested", { taskId, itemId: item.id, commandLength: command.length });
  try {
    const response = await chrome.runtime.sendMessage({
      type: TERMINAL_RUN_REQUEST,
      id: taskId,
      command
    });
    if (!response?.ok) throw new Error(response?.error || "控制台任务启动失败");
    updateCodexTaskSnapshot(response);
    updateCodexChatControls();
    if (response.terminalWorkspace) {
      item.terminalCwd = response.terminalWorkspace;
      updateTerminalItemElement(item, false);
      scheduleSave();
    }
  } catch (error) {
    if (item.terminalTaskId !== taskId) return;
    terminalTasks.delete(taskId);
    codexActiveTaskIds.delete(taskId);
    item.terminalStatus = "error";
    item.terminalTaskId = "";
    appendTerminalOutput(item, `\n[错误] ${error?.message || "控制台任务启动失败"}\n`);
    updateTerminalItemElement(item);
    scheduleSave();
  }
}

async function cancelTerminalItem(item) {
  if (!item?.terminalTaskId || item.terminalStatus !== "running") return;
  const taskId = item.terminalTaskId;
  try {
    const response = await chrome.runtime.sendMessage({ type: TERMINAL_CANCEL_REQUEST, id: taskId });
    if (!response?.ok) throw new Error(response?.error || "停止命令失败");
  } catch (error) {
    appendTerminalOutput(item, `\n[错误] ${error?.message || "停止命令失败"}\n`);
    item.terminalStatus = "error";
    item.terminalTaskId = "";
    updateTerminalItemElement(item);
    scheduleSave();
  }
}

function handleTerminalEvent(event) {
  const taskId = String(event?.id || "");
  if (String(event?.type || "").startsWith("terminal-session-")) {
    const session = terminalSessions.get(taskId);
    const item = session?.item || boardItems.find(candidate => candidate.type === "terminal" && candidate.terminalSessionId === taskId);
    if (!item) return;
    if (event.type === "terminal-session-started") {
      item.terminalStatus = "connected";
      item.terminalCwd = String(event.cwd || item.terminalCwd || "");
      cardProtocol.grant(item, "local-shell");
      session?.terminal?.focus();
    } else if (event.type === "terminal-session-output") {
      const bytes = base64ToBytes(event.data);
      session?.terminal?.write(bytes);
      if (session?.decoder) appendTerminalOutput(item, session.decoder.decode(bytes, { stream: true }));
      item.updatedAt = Date.now();
      // Terminal output is already painted by xterm. Persist only after the stream
      // becomes idle; rebuilding card metadata for every fragment can freeze Chrome.
      scheduleTerminalSave(item);
      return;
    } else if (event.type === "terminal-session-closed") {
      item.terminalStatus = "closed";
      item.terminalExitCode = Number.isInteger(event.exitCode) ? event.exitCode : null;
    } else if (event.type === "terminal-session-error") {
      item.terminalStatus = "error";
      session?.terminal?.writeln(`\r\n\x1b[31m[拾作] ${event.error || "终端会话失败"}\x1b[0m`);
    }
    clearTerminalSaveTimer(item.id);
    item.updatedAt = Date.now();
    updateTerminalItemElement(item, false);
    scheduleSave();
    return;
  }
  if (event?.type === "terminal-started" && taskId) codexActiveTaskIds.add(taskId);
  if (["terminal-done", "terminal-error", "terminal-cancelled"].includes(event?.type) && taskId) codexActiveTaskIds.delete(taskId);
  updateCodexChatControls();
  updateSelectionUi();
  const terminalTask = terminalTasks.get(taskId);
  const item = terminalItemForTask(event?.id) || terminalTask?.item;
  if (!item) return;
  if (terminalTask) terminalTask.item = item;
  if (event.type === "terminal-started") {
    item.terminalStatus = "running";
    item.terminalCwd = String(event.cwd || item.terminalCwd || "");
  } else if (event.type === "terminal-output") {
    appendTerminalOutput(item, event.data || "");
  } else if (event.type === "terminal-done") {
    item.terminalExitCode = Number.isInteger(event.exitCode) ? event.exitCode : null;
    item.terminalStatus = item.terminalExitCode === 0 ? "done" : "error";
    item.terminalTaskId = "";
    appendTerminalOutput(item, `\n[退出码 ${item.terminalExitCode ?? "未知"}]\n`);
  } else if (event.type === "terminal-cancelled") {
    item.terminalStatus = "cancelled";
    item.terminalTaskId = "";
    appendTerminalOutput(item, "\n[已停止]\n");
  } else if (event.type === "terminal-error") {
    item.terminalStatus = "error";
    item.terminalTaskId = "";
    appendTerminalOutput(item, `\n[错误] ${event.error || "命令执行失败"}\n`);
  }
  item.updatedAt = Date.now();
  const itemIsVisible = currentBoard?.id === terminalTask?.boardId || boardItems.includes(item);
  if (itemIsVisible) {
    updateTerminalItemElement(item);
    scheduleSave();
  }
  if (["terminal-done", "terminal-error", "terminal-cancelled"].includes(event.type)) {
    terminalTasks.delete(taskId);
    if (!itemIsVisible && terminalTask?.boardId) {
      persistTerminalItem(terminalTask.boardId, item).catch(error => {
        console.error("[pagedock-terminal] inactive card save failed", { taskId, reason: error?.message || String(error) });
      });
    }
  }
}

async function persistTerminalItem(boardId, item) {
  const board = await db.getBoard(boardId, { includeArchived: true });
  const baseBoard = board ? structuredClone(board) : null;
  const stored = board?.items?.find(candidate => candidate.id === item.id);
  if (!stored) return;
  Object.assign(stored, {
    text: item.text,
    terminalOutput: item.terminalOutput,
    terminalStatus: item.terminalStatus,
    terminalTaskId: item.terminalTaskId,
    terminalSessionId: item.terminalSessionId,
    terminalCwd: item.terminalCwd,
    terminalExitCode: item.terminalExitCode,
    terminalHistory: item.terminalHistory,
    updatedAt: item.updatedAt
  });
  await db.commitBoardSnapshot(board, {
    baseBoard,
    preserveArchived: boardId === db.INBOX_ID,
    reason: "保存终端结果"
  });
  notifyDataChanged([boardId], "terminal-result");
}

function createTerminalContent(item, element) {
  const content = document.createElement("div");
  content.className = "terminal-content";
  const meta = document.createElement("div");
  meta.className = "terminal-meta";
  const cwd = document.createElement("span");
  cwd.className = "terminal-cwd";
  const state = document.createElement("span");
  state.className = "terminal-state";
  const clear = document.createElement("button");
  clear.className = "terminal-clear";
  clear.type = "button";
  clear.textContent = "清空";
  clear.addEventListener("click", () => {
    item.terminalOutput = "";
    item.updatedAt = Date.now();
    terminalSessions.get(item.terminalSessionId)?.terminal?.clear();
    clearTerminalSaveTimer(item.id);
    scheduleSave();
  });
  const connect = document.createElement("button");
  connect.className = "terminal-connect";
  connect.type = "button";
  connect.textContent = ["connected", "connecting"].includes(item.terminalStatus) ? "关闭" : "连接";
  connect.addEventListener("click", () => {
    initializeTerminalRenderer();
    if (["connected", "connecting"].includes(item.terminalStatus)) closeTerminalSession(item);
    else openTerminalSession(item, element);
  });
  meta.append(cwd, state, clear, connect);
  const mount = document.createElement("div");
  mount.className = "terminal-mount";
  mount.setAttribute("aria-label", "交互式本地终端");
  content.append(meta, mount);
  content.addEventListener("pointerdown", event => event.stopPropagation());
  element.appendChild(content);
  let initialized = false;
  const initializeTerminalRenderer = () => {
    if (initialized || !element.isConnected) return;
    initialized = true;
  const terminal = new globalThis.Terminal({
    allowProposedApi: false,
    cursorBlink: true,
    cursorStyle: "bar",
    fontFamily: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    lineHeight: 1.2,
    scrollback: 2000,
    convertEol: false,
    theme: {
      background: "#211914",
      foreground: "#f4ede5",
      cursor: "#e79b7e",
      selectionBackground: "#7d493c99",
      black: "#211914",
      red: "#e2776a",
      green: "#90bd83",
      yellow: "#d9b36c",
      blue: "#83a9c9",
      magenta: "#bc91b7",
      cyan: "#7db8b3",
      white: "#f4ede5"
    }
  });
  const fitAddon = new globalThis.FitAddon.FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(mount);
  if (item.terminalOutput) terminal.write(item.terminalOutput);
  item.terminalSessionId = item.terminalSessionId || `terminal:${item.id}`;
  disposeTerminalRenderer(terminalSessions.get(item.terminalSessionId));
  const terminalSession = {
    item,
    boardId: currentBoard?.id,
    terminal,
    fitAddon,
    decoder: new TextDecoder(),
    element,
    observer: undefined,
    fitFrame: undefined
  };
  terminalSessions.set(item.terminalSessionId, terminalSession);
  terminal.onData(data => {
    if (item.terminalStatus !== "connected") return;
    const bytes = new TextEncoder().encode(data);
    chrome.runtime.sendMessage({
      type: TERMINAL_SESSION_INPUT_REQUEST,
      id: item.terminalSessionId,
      data: bytesToBase64(bytes)
    }).catch(error => setStatus(error?.message || "终端输入发送失败", true));
  });
  terminal.onResize(({ cols, rows }) => {
    if (!item.terminalSessionId || !["connected", "connecting"].includes(item.terminalStatus)) return;
    chrome.runtime.sendMessage({ type: TERMINAL_SESSION_RESIZE_REQUEST, id: item.terminalSessionId, cols, rows }).catch(() => {});
  });
  const observer = new ResizeObserver(() => {
    if (!element.isConnected) {
      observer.disconnect();
      return;
    }
    if (terminalSession.fitFrame) cancelAnimationFrame(terminalSession.fitFrame);
    terminalSession.fitFrame = requestAnimationFrame(() => {
      terminalSession.fitFrame = undefined;
      if (!element.isConnected) return;
      try { fitAddon.fit(); } catch {}
    });
  });
  terminalSession.observer = observer;
  observer.observe(mount);
  requestAnimationFrame(() => {
    fitAddon.fit();
    updateTerminalItemElement(item);
  });
  };
  // 终端是白板中最重的卡片，只在接近视口或用户主动连接时创建渲染器。
  const visibilityObserver = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    visibilityObserver.disconnect();
    initializeTerminalRenderer();
  }, { root: viewportEl, rootMargin: "240px" });
  visibilityObserver.observe(element);
}

function createDocumentContent(item, element, codeMode = false) {
  const content = document.createElement("div");
  content.className = codeMode ? "code-content" : "document-content";
  const isKnowledgeCard = item.provenance?.operation === "codex-generate-knowledge";
  content.classList.toggle("knowledge-card-content", isKnowledgeCard);
  if (!codeMode && item.knowledgeState && item.knowledgeState !== "success") {
    const loading = document.createElement("div");
    loading.className = "knowledge-card-loading";
    loading.dataset.state = item.knowledgeState;
    const status = document.createElement("span");
    status.textContent = item.text || "正在提炼知识卡…";
    loading.appendChild(status);
    content.appendChild(loading);
    element.appendChild(content);
    return;
  }
  const toolbar = document.createElement("div");
  toolbar.className = codeMode ? "code-toolbar" : "document-toolbar";
  const editor = document.createElement("textarea");
  editor.className = codeMode ? "code-editor" : "document-editor";
  editor.value = item.text || "";
  editor.spellcheck = !codeMode;
  editor.placeholder = codeMode ? "输入代码…" : "使用 Markdown 编写文档…";
  editor.setAttribute("aria-label", codeMode ? "代码内容" : "Markdown 文档内容");
  editor.addEventListener("input", () => {
    item.text = editor.value;
    item.updatedAt = Date.now();
    scheduleSave();
    queueHistoryCommit();
  });

  if (codeMode) {
    const language = document.createElement("select");
    language.className = "code-language";
    for (const value of ["plaintext", "javascript", "typescript", "python", "json", "html", "css", "shell", "sql", "go", "markdown"]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      language.appendChild(option);
    }
    language.value = item.documentLanguage || "plaintext";
    language.setAttribute("aria-label", "代码语言");
    language.addEventListener("change", () => {
      item.documentLanguage = language.value;
      item.updatedAt = Date.now();
      scheduleSave();
    });
    toolbar.appendChild(language);
  } else {
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "编辑";
    edit.setAttribute("aria-pressed", "true");
    const previewButton = document.createElement("button");
    previewButton.type = "button";
    previewButton.textContent = "预览";
    previewButton.setAttribute("aria-pressed", "false");
    const preview = document.createElement("div");
    preview.className = `document-preview${isKnowledgeCard ? " knowledge-card-preview" : ""}`;
    preview.hidden = true;
    const setPreview = active => {
      editor.hidden = active;
      preview.hidden = !active;
      edit.setAttribute("aria-pressed", String(!active));
      previewButton.setAttribute("aria-pressed", String(active));
      if (active) renderTaskMarkdown(preview, item.text || "");
      else editor.focus();
    };
    edit.addEventListener("click", () => setPreview(false));
    previewButton.addEventListener("click", () => setPreview(true));
    toolbar.append(edit, previewButton);
    content.append(toolbar, editor, preview);
    setPreview(isKnowledgeCard);
    content.addEventListener("pointerdown", event => event.stopPropagation());
    element.appendChild(content);
    return;
  }

  content.append(toolbar, editor);
  content.addEventListener("pointerdown", event => event.stopPropagation());
  element.appendChild(content);
}

function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function localTextFileCanPreview(file) {
  return file.size <= 512_000 && (/^(text\/|application\/(json|javascript|xml))/i.test(file.type) || /\.(md|txt|json|ya?ml|js|ts|tsx|jsx|py|go|rs|java|css|html|xml|sql|sh|zsh)$/i.test(file.name));
}

async function localEntryHandle(item, path, kind) {
  const record = await db.getLocalHandle(item.localHandleId);
  const root = record?.handle;
  if (!root) throw new Error("此卡片只有目录快照，请点击“重新关联”后再打开内容");
  const state = await permissionForHandle(root, true);
  item.localPermissionState = state;
  updatePermissionChip(item);
  if (state !== "granted") throw new Error("需要允许读取此文件夹后才能打开内容");
  cardProtocol.grant(item, "local-folder-read");
  let handle = root;
  for (let index = 0; index < path.length; index += 1) {
    const entryKind = index === path.length - 1 ? kind : "directory";
    handle = entryKind === "directory"
      ? await handle.getDirectoryHandle(path[index])
      : await handle.getFileHandle(path[index]);
  }
  return handle;
}

async function localDirectoryEntries(handle) {
  const entries = [];
  for await (const [name, child] of handle.entries()) {
    entries.push({ name, kind: child.kind });
    if (entries.length >= 200) break;
  }
  return entries.sort((left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name));
}

function closeLocalFilePreview(element) {
  const entries = element.querySelector(".local-card-entries");
  const view = element.querySelector(".local-card-file-view");
  if (!entries || !view) return;
  const objectUrl = view.dataset.objectUrl;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  delete view.dataset.objectUrl;
  view.hidden = true;
  entries.hidden = false;
}

async function showLocalFilePreview(item, element, path) {
  const entries = element.querySelector(".local-card-entries");
  const view = element.querySelector(".local-card-file-view");
  const fileName = element.querySelector(".local-card-file-name");
  const body = element.querySelector(".local-card-file-body");
  if (!entries || !view || !fileName || !body) return;
  closeLocalFilePreview(element);
  entries.hidden = true;
  view.hidden = false;
  fileName.textContent = path.join(" / ");
  body.textContent = "正在读取文件…";
  try {
    const handle = await localEntryHandle(item, path, "file");
    const file = await handle.getFile();
    body.replaceChildren();
    if (localTextFileCanPreview(file)) {
      const preview = document.createElement("pre");
      preview.textContent = (await file.text()).slice(0, 120_000);
      body.appendChild(preview);
    } else if (file.type.startsWith("image/")) {
      const image = document.createElement("img");
      const objectUrl = URL.createObjectURL(file);
      view.dataset.objectUrl = objectUrl;
      image.src = objectUrl;
      image.alt = file.name;
      body.appendChild(image);
    } else {
      const note = document.createElement("p");
      note.className = "local-card-file-note";
      note.textContent = `${file.type || "未知格式"} · ${formatBytes(file.size)}。当前仅支持直接预览文本和图片文件。`;
      body.appendChild(note);
    }
    console.info("[pagedock-local-card] entry opened", { itemId: item.id, path: path.join("/"), kind: "file", size: file.size });
  } catch (error) {
    body.textContent = error?.message || "文件读取失败";
    setStatus(error?.message || "文件读取失败", true);
  }
}

function renderLocalFolderEntries(item, element, list, entries, parentPath = []) {
  if (!list) return;
  if (!entries.length) {
    const empty = document.createElement("li");
    empty.className = "local-card-file-note";
    empty.textContent = "此文件夹为空";
    list.replaceChildren(empty);
    return;
  }
  list.replaceChildren(...entries.map(entry => {
    const row = document.createElement("li");
    row.className = "local-card-entry";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "local-card-entry-button";
    button.title = entry.kind === "directory" ? `展开 ${entry.name}` : `预览 ${entry.name}`;
    const marker = document.createElement("span");
    marker.className = "local-card-entry-marker";
    marker.textContent = entry.kind === "directory" ? "▸" : "·";
    const label = document.createElement("span");
    label.className = "local-card-entry-name";
    label.textContent = entry.name;
    button.append(marker, label);
    const path = [...parentPath, entry.name];
    if (entry.kind === "directory") {
      button.setAttribute("aria-expanded", "false");
      const children = document.createElement("ol");
      children.className = "local-card-children";
      children.hidden = true;
      button.addEventListener("click", async () => {
        const expanded = button.getAttribute("aria-expanded") === "true";
        if (expanded) {
          button.setAttribute("aria-expanded", "false");
          button.title = `展开 ${entry.name}`;
          marker.textContent = "▸";
          children.hidden = true;
          return;
        }
        if (!children.dataset.loaded) {
          button.disabled = true;
          marker.textContent = "…";
          try {
            const handle = await localEntryHandle(item, path, "directory");
            renderLocalFolderEntries(item, element, children, await localDirectoryEntries(handle), path);
            children.dataset.loaded = "true";
            console.info("[pagedock-local-card] entry opened", { itemId: item.id, path: path.join("/"), kind: "directory" });
          } catch (error) {
            marker.textContent = "▸";
            setStatus(error?.message || "文件夹读取失败", true);
            return;
          } finally {
            button.disabled = false;
          }
        }
        button.setAttribute("aria-expanded", "true");
        button.title = `收起 ${entry.name}`;
        marker.textContent = "▾";
        children.hidden = false;
      });
      row.append(button, children);
    } else {
      button.addEventListener("click", () => showLocalFilePreview(item, element, path));
      row.appendChild(button);
    }
    return row;
  }));
}

async function permissionForHandle(handle, request = false) {
  if (!handle) return "missing";
  const options = { mode: "read" };
  let state = await handle.queryPermission?.(options) || "prompt";
  if (request && state !== "granted") state = await handle.requestPermission?.(options) || state;
  return state;
}

async function refreshLocalCard(item, element, requestPermission = false) {
  const record = await db.getLocalHandle(item.localHandleId);
  const handle = record?.handle;
  const state = await permissionForHandle(handle, requestPermission);
  item.localPermissionState = state;
  if (state === "granted") cardProtocol.grant(item, item.type === "folder" ? "local-folder-read" : "local-file-read");
  else cardProtocol.revoke(item, item.type === "folder" ? "local-folder-read" : "local-file-read");
  if (state === "granted" && item.type === "file") {
    const file = await handle.getFile();
    item.localName = file.name;
    item.localMime = file.type;
    item.localSize = file.size;
    item.localModified = file.lastModified;
    if (file.size <= 512_000 && (/^(text\/|application\/(json|javascript|xml))/i.test(file.type) || /\.(md|txt|json|ya?ml|js|ts|tsx|jsx|py|go|rs|java|css|html|xml|sql|sh|zsh)$/i.test(file.name))) {
      item.localPreview = (await file.text()).slice(0, 120_000);
    }
  } else if (state === "granted" && item.type === "folder") {
    const entries = [];
    for await (const [name, child] of handle.entries()) {
      entries.push({ name, kind: child.kind });
      if (entries.length >= 200) break;
    }
    item.localEntries = entries.sort((left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name));
  }
  item.updatedAt = Date.now();
  updateLocalCardElement(item, element);
  scheduleSave();
}

function updatePermissionChip(item, element = itemElement(item.id)) {
  const chip = element?.querySelector(".permission-chip");
  const permission = permissionSummary(item);
  if (!chip || !permission) return;
  chip.dataset.state = permission.state;
  chip.dataset.risk = permission.risk;
  chip.textContent = permission.state === "granted" ? `已允许 · ${permission.label}` : `需允许 · ${permission.label}`;
}

function updateLocalCardElement(item, element = itemElement(item.id)) {
  if (!element) return;
  const name = element.querySelector(".local-card-name");
  const details = element.querySelector(".local-card-details");
  const preview = element.querySelector(".local-card-preview");
  const entries = element.querySelector(".local-card-entries");
  if (name) name.textContent = item.localName || (item.type === "folder" ? "未关联文件夹" : "未关联文件");
  if (details) {
    const permission = item.localPermissionState === "granted" ? "已授权" : item.localHandleId ? "需要授权" : "本地快照";
    details.textContent = item.type === "folder"
      ? `${permission} · ${(item.localEntries || []).length} 项预览`
      : `${permission}${item.localSize ? ` · ${formatBytes(item.localSize)}` : ""}${item.localMime ? ` · ${item.localMime}` : ""}`;
  }
  if (preview) preview.textContent = item.localPreview || "此文件没有可展示的文本预览。";
  if (entries) {
    closeLocalFilePreview(element);
    renderLocalFolderEntries(item, element, entries, item.localEntries || []);
  }
  updatePermissionChip(item, element);
}

function createLocalCardContent(item, element) {
  const content = document.createElement("div");
  content.className = "local-card-content";
  const toolbar = document.createElement("div");
  toolbar.className = "local-card-toolbar";
  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.textContent = item.localHandleId ? "刷新" : "重新关联";
  refresh.addEventListener("click", async () => {
    try {
      if (!item.localHandleId) {
        await relinkLocalCard(item);
      } else {
        await refreshLocalCard(item, element, true);
      }
    } catch (error) {
      setStatus(error?.message || "读取本地内容失败", true);
    }
  });
  toolbar.appendChild(refresh);
  const summary = document.createElement("div");
  summary.className = "local-card-summary";
  const icon = document.createElement("span");
  icon.className = "local-card-icon";
  icon.textContent = item.type === "folder" ? "▱" : "▰";
  const meta = document.createElement("div");
  meta.className = "local-card-meta";
  const name = document.createElement("strong");
  name.className = "local-card-name";
  const details = document.createElement("span");
  details.className = "local-card-details";
  meta.append(name, details);
  summary.append(icon, meta);
  content.append(toolbar, summary);
  if (item.type === "folder") {
    const entries = document.createElement("ol");
    entries.className = "local-card-entries";
    const fileView = document.createElement("section");
    fileView.className = "local-card-file-view";
    fileView.hidden = true;
    const fileHead = document.createElement("div");
    fileHead.className = "local-card-file-head";
    const back = document.createElement("button");
    back.type = "button";
    back.className = "local-card-file-back";
    back.textContent = "← 文件列表";
    back.addEventListener("click", () => closeLocalFilePreview(element));
    const fileName = document.createElement("strong");
    fileName.className = "local-card-file-name";
    const fileBody = document.createElement("div");
    fileBody.className = "local-card-file-body";
    fileHead.append(back, fileName);
    fileView.append(fileHead, fileBody);
    content.append(entries, fileView);
  } else {
    const preview = document.createElement("pre");
    preview.className = "local-card-preview";
    content.appendChild(preview);
  }
  content.addEventListener("pointerdown", event => event.stopPropagation());
  element.appendChild(content);
  updateLocalCardElement(item, element);
  if (item.localHandleId) refreshLocalCard(item, element, false).catch(error => {
    console.warn("[pagedock-local-card] refresh failed", { itemId: item.id, reason: error?.message || String(error) });
  });
}

function createItemElement(item) {
  const element = document.createElement("article");
  element.className = `board-item ${item.type}-item`;
  element.classList.toggle("grouped", Boolean(item.groupId));
  element.dataset.id = item.id;
  element.tabIndex = 0;
  element.setAttribute("role", "group");
  element.setAttribute("aria-label", `${itemTypeLabel(item)}卡片`);
  element.style.left = `${item.x}px`;
  element.style.top = `${item.y}px`;
  element.style.width = `${item.width || 320}px`;
  if (item.height) element.style.height = `${item.height}px`;
  element.style.zIndex = item.z;

  const handle = document.createElement("div");
  handle.className = "item-handle";
  handle.tabIndex = 0;
  handle.setAttribute("role", "button");
  handle.setAttribute("aria-label", "拖动卡片，方向键可微调位置");
  const grip = document.createElement("span");
  grip.className = "grip";
  grip.textContent = "⠿";
  const kind = document.createElement("span");
  kind.className = "item-kind";
  kind.textContent = itemTypeLabel(item);
  const permission = permissionSummary(item);
  const permissionChip = permission ? document.createElement("span") : null;
  if (permissionChip) {
    permissionChip.className = "permission-chip";
    permissionChip.dataset.state = permission.state;
    permissionChip.dataset.risk = permission.risk;
    permissionChip.textContent = permission.state === "granted" ? `已允许 · ${permission.label}` : `需允许 · ${permission.label}`;
    permissionChip.title = permission.state === "granted"
      ? `此卡片已获得：${permission.label}`
      : `只会在你主动操作时请求：${permission.label}`;
  }
  const source = document.createElement("button");
  source.className = "item-source";
  source.type = "button";
  source.textContent = "↗";
  source.title = "查看卡片来源与版本";
  source.setAttribute("aria-label", "查看卡片来源与版本");
  source.addEventListener("pointerdown", event => event.stopPropagation());
  source.addEventListener("click", () => openProvenance(item));
  const focus = document.createElement("button");
  focus.className = "item-focus";
  focus.type = "button";
  focus.innerHTML = [
    '<svg data-icon="expand" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>',
    '<svg data-icon="collapse" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5"/></svg>'
  ].join("");
  setItemFocusButtonState(focus, false);
  focus.addEventListener("pointerdown", event => event.stopPropagation());
  focus.addEventListener("click", () => enterItemFocus(item, element));
  const remove = document.createElement("button");
  remove.className = "delete-item";
  remove.type = "button";
  setItemCloseButtonState(remove, false);
  remove.textContent = "×";
  remove.addEventListener("pointerdown", event => event.stopPropagation());
  remove.addEventListener("click", () => {
    if (focusedItemId === item.id) {
      exitItemFocus();
      return;
    }
    if (item.type === "terminal" && ["connected", "connecting"].includes(item.terminalStatus)) closeTerminalSession(item);
    else if (item.type === "terminal" && item.terminalStatus === "running") cancelTerminalItem(item);
    removeItems([item.id]);
  });
  handle.append(grip, kind);
  if (permissionChip) handle.appendChild(permissionChip);
  handle.append(source, focus, remove);
  element.appendChild(handle);

  if (item.type === "image") {
    const content = document.createElement("div");
    content.className = "image-content";
    const image = document.createElement("img");
    image.src = item.src;
    image.alt = item.alt || "白板图片";
    image.loading = "lazy";
    image.decoding = "async";
    content.appendChild(image);
    element.appendChild(content);
  } else if (item.type === "video") {
    const content = document.createElement("div");
    content.className = "video-content";
    const video = document.createElement("video");
    video.src = item.src;
    video.controls = true;
    video.preload = "metadata";
    video.setAttribute("aria-label", item.alt || "AI 生成视频");
    const download = document.createElement("a");
    download.className = "video-download";
    download.href = item.src;
    download.download = item.filename || `${safeFilename(item.alt || "拾作-AI-Video")}.mp4`;
    download.textContent = "下载 MP4";
    const narrate = document.createElement("button");
    narrate.className = "video-narrate";
    narrate.type = "button";
    narrate.textContent = "添加口播与字幕";
    narrate.addEventListener("click", () => {
      const narration = window.prompt("输入口播文案。拾作会按句生成字幕，并使用本地 Kokoro 配音。", "");
      if (!String(narration || "").trim()) return;
      const task = addTaskItem(aiResultPoint([item]), {
        text: String(narration).trim(),
        sourceIds: [item.id],
        sourceCount: 1,
        focus: false
      });
      task.taskLastMode = "video-post";
      runWhiteboardCodex("video-post", task, { scope: "sources" });
    });
    const actions = document.createElement("div");
    actions.className = "video-actions";
    actions.append(narrate, download);
    content.append(video, actions);
    content.addEventListener("pointerdown", event => event.stopPropagation());
    element.appendChild(content);
  } else if (item.type === "page") {
    let pageSrc = "about:blank";
    try {
      pageSrc = normalizedPageUrl(item.src);
    } catch {}
    const content = document.createElement("div");
    content.className = "page-content";
    const address = document.createElement("div");
    address.className = "page-address";
    const open = document.createElement("a");
    if (pageSrc !== "about:blank") {
      open.href = pageSrc;
      open.target = "_blank";
      open.rel = "noopener noreferrer";
    } else {
      open.setAttribute("aria-disabled", "true");
    }
    open.textContent = pageSrc === "about:blank" ? "网页地址不可用" : pageSrc;
    open.title = "在新标签页打开";
    const refresh = document.createElement("button");
    refresh.className = "page-refresh";
    refresh.type = "button";
    refresh.textContent = "↻";
    refresh.title = "重新加载页面";
    refresh.setAttribute("aria-label", "重新加载页面");
    refresh.disabled = pageSrc === "about:blank";
    const frame = document.createElement("iframe");
    frame.className = "page-frame";
    frame.src = pageSrc;
    frame.title = item.text || item.src || "白板页面";
    frame.loading = "lazy";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    // 标题栏仍负责拖拽；网页交互只发生在正文 iframe 中，并限制可用浏览器能力。
    frame.setAttribute("sandbox", "allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts");
    frame.setAttribute("allow", "clipboard-read; clipboard-write; fullscreen");
    refresh.addEventListener("click", () => {
      frame.src = "about:blank";
      requestAnimationFrame(() => { frame.src = pageSrc; });
    });
    address.append(open, refresh);
    content.append(address, frame);
    content.addEventListener("pointerdown", event => event.stopPropagation());
    element.appendChild(content);
  } else if (item.type === "link") {
    const link = document.createElement("a");
    link.className = "link-content";
    link.href = item.src || item.source?.url || "#";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = item.text || item.source?.title || item.src || "打开链接";
    link.addEventListener("pointerdown", event => event.stopPropagation());
    element.appendChild(link);
  } else if (item.type === "document") {
    createDocumentContent(item, element, false);
  } else if (item.type === "code") {
    createDocumentContent(item, element, true);
  } else if (["file", "folder"].includes(item.type)) {
    createLocalCardContent(item, element);
  } else if (item.type === "task") {
    createTaskContent(item, element);
  } else if (item.type === "terminal") {
    createTerminalContent(item, element);
  } else {
    const content = document.createElement("div");
    content.className = "text-content";
    content.setAttribute("contenteditable", "plaintext-only");
    content.spellcheck = true;
    content.dataset.placeholder = "输入文字…";
    content.setAttribute("aria-label", "白板文字内容");
    content.textContent = item.text || "";
    content.addEventListener("input", () => {
      item.text = content.innerText;
      item.updatedAt = Date.now();
      syncItemSize(item, element);
      scheduleSave();
      queueHistoryCommit();
    });
    element.appendChild(content);
  }
  if (item.type !== "page") appendSource(element, item);

  element.addEventListener("pointerdown", event => {
    if (event.target.closest("a,button,select,.text-content,.document-content,.code-content,.local-card-content,.task-content,.page-content,.terminal-content")) return;
    selectFromPointer(item, event);
  });
  element.addEventListener("focus", () => {
    if (!selectedIds.has(item.id)) selectItems([item.id]);
  });
  element.addEventListener("pointerup", () => {
    if (focusedItemId === item.id) return;
    syncItemSize(item, element);
    commitHistory();
    scheduleSave();
    renderMinimap();
  });
  handle.addEventListener("keydown", event => {
    const distance = event.shiftKey ? 24 : 8;
    let dx = 0;
    let dy = 0;
    if (event.key === "ArrowLeft") dx = -distance;
    if (event.key === "ArrowRight") dx = distance;
    if (event.key === "ArrowUp") dy = -distance;
    if (event.key === "ArrowDown") dy = distance;
    if (!dx && !dy) return;
    event.preventDefault();
    moveSelectedBy(dx, dy);
  });
  enableDragging(handle, element, item);
  new ResizeObserver(() => {
    if (!element.isConnected || applyingHistory || focusedItemId === item.id) return;
    const previousWidth = item.width;
    const previousHeight = item.height;
    syncItemSize(item, element);
    if (previousWidth !== item.width || previousHeight !== item.height) {
      ensureBoardContains([item]);
      scheduleSave();
      renderMinimap();
      scheduleConnectionRender();
      positionSelectionActions();
    }
  }).observe(element);
  return element;
}

function renderAllItems() {
  exitItemFocus(false, false);
  disposeTerminalRenderers();
  boardEl.replaceChildren(connectionLayerEl, remotePresenceLayerEl);
  highestZ = 1;
  for (const item of boardItems) {
    item.z = Number(item.z) || ++highestZ;
    highestZ = Math.max(highestZ, item.z);
    boardEl.appendChild(createItemElement(item));
  }
  updateEmptyState();
  renderRemotePresence();
  updateSelectionUi();
  renderConnections();
  renderMinimap();
}

function addBoardItem(item, focusText = false, selectResult = true) {
  const now = Date.now();
  const taskMessages = item.type === "task" ? normalizeTaskMessages(item.taskMessages, item) : [];
  const migratedLegacyTask = item.type === "task"
    && !Array.isArray(item.taskMessages)
    && Boolean(item.taskResult);
  const next = {
    id: item.id || db.makeId(),
    type: item.type || "text",
    text: migratedLegacyTask ? "" : (item.text || ""),
    src: item.src || "",
    alt: item.alt || "",
    pageContent: String(item.pageContent || "").slice(0, 600_000),
    pageContentUrl: String(item.pageContentUrl || ""),
    pageContentMode: String(item.pageContentMode || ""),
    pageContentCapturedAt: Math.max(0, Number(item.pageContentCapturedAt) || 0),
    x: Number(item.x) || 0,
    y: Number(item.y) || 0,
    width: Number(item.width) || 320,
    height: Number(item.height) || 120,
    z: ++highestZ,
    groupId: item.groupId || "",
    source: item.source || null,
    taskResult: String(item.taskResult || ""),
    // 每张任务卡独立保存对话历史，刷新或切换白板后仍可继续追问。
    taskMessages,
    taskStatus: ["idle", "running", "success", "error", "cancelled"].includes(item.taskStatus) ? item.taskStatus : "idle",
    // 记录最近一次执行方式，让失败卡片可以原位重试同一种任务。
    taskLastMode: ["coding", "conversation", "text", "image", "image-gen", "video", "video-post"].includes(item.taskLastMode) ? item.taskLastMode : "coding",
    // 视频任务在卡片级保存引擎，保证重试、工作流和定时执行使用同一选择。
    taskVideoEngine: taskVideoEngine(item.taskVideoEngine),
    taskError: String(item.taskError || ""),
    taskRunId: String(item.taskRunId || ""),
    taskProgress: String(item.taskProgress || ""),
    taskStartedAt: Math.max(0, Number(item.taskStartedAt) || 0),
    taskCompletedAt: Math.max(0, Number(item.taskCompletedAt) || 0),
    taskEvents: compactTaskEvents(item.taskEvents),
    // 圈选任务只保存来源卡片 ID，避免复制图片 data URL 导致 IndexedDB 膨胀。
    taskSourceIds: Array.isArray(item.taskSourceIds) ? item.taskSourceIds.map(String) : [],
    taskSourceCount: Math.max(0, Number(item.taskSourceCount) || 0),
    taskWorkflowId: String(item.taskWorkflowId || ""),
    taskWorkflowStepId: String(item.taskWorkflowStepId || ""),
    taskWorkflowRole: ["controller", "step"].includes(item.taskWorkflowRole) ? item.taskWorkflowRole : "",
    taskWorkflowMode: ["coding", "text", "image-gen", "video"].includes(item.taskWorkflowMode) ? item.taskWorkflowMode : "",
    taskWorkflowTitle: String(item.taskWorkflowTitle || ""),
    taskWorkflowInstruction: String(item.taskWorkflowInstruction || item.text || "").slice(0, 8_000),
    taskWorkflowRunId: String(item.taskWorkflowRunId || ""),
    taskWorkflowStepIds: (Array.isArray(item.taskWorkflowStepIds) ? item.taskWorkflowStepIds : []).map(String).slice(0, 8),
    taskWorkflowLens: PageDockBoardDomain.workflowLens(item.taskWorkflowLens).id,
    taskSchedule: PageDockBoardDomain.normalizeTaskSchedule(item.taskSchedule),
    // 派生创作与最初素材解耦；失败重试仍使用发起时明确选择的回答或素材。
    taskGenerationScope: ["latest", "conversation", "sources", "message"].includes(item.taskGenerationScope)
      ? item.taskGenerationScope
      : "",
    taskGenerationMessageId: String(item.taskGenerationMessageId || ""),
    taskReplyMessageId: String(item.taskReplyMessageId || ""),
    taskGenerationSnapshot: item.taskGenerationSnapshot ? clone(item.taskGenerationSnapshot) : null,
    generationContext: item.generationContext ? clone(item.generationContext) : null,
    terminalOutput: String(item.terminalOutput || "").slice(-MAX_TERMINAL_OUTPUT_CHARS),
    terminalStatus: ["idle", "connecting", "connected", "running", "done", "closed", "error", "cancelled"].includes(item.terminalStatus) ? item.terminalStatus : "idle",
    terminalTaskId: String(item.terminalTaskId || ""),
    terminalSessionId: String(item.terminalSessionId || ""),
    terminalCwd: String(item.terminalCwd || ""),
    terminalExitCode: Number.isInteger(item.terminalExitCode) ? item.terminalExitCode : null,
    terminalHistory: (Array.isArray(item.terminalHistory) ? item.terminalHistory : [])
      .map(command => String(command || "").trim().slice(0, 8_000))
      .filter(Boolean)
      .slice(-30),
    localHandleId: String(item.localHandleId || ""),
    localName: String(item.localName || ""),
    localKind: String(item.localKind || ""),
    localMime: String(item.localMime || ""),
    localSize: Math.max(0, Number(item.localSize) || 0),
    localModified: Math.max(0, Number(item.localModified) || 0),
    localEntries: Array.isArray(item.localEntries) ? item.localEntries.slice(0, 200) : [],
    localPreview: String(item.localPreview || "").slice(0, 120_000),
    localPermissionState: String(item.localPermissionState || "missing"),
    knowledgeState: ["loading", "success", "error", "cancelled"].includes(item.knowledgeState) ? item.knowledgeState : "",
    documentLanguage: String(item.documentLanguage || (item.type === "code" ? "plaintext" : "markdown")),
    relationSourceIds: Array.isArray(item.relationSourceIds) ? item.relationSourceIds.map(String) : [],
    createdAt: item.createdAt || now,
    updatedAt: now
  };
  next.card = cardProtocol.normalizeMeta({ ...item, ...next });
  boardItems.push(next);
  ensureBoardContains([next]);
  const element = createItemElement(next);
  boardEl.appendChild(element);
  if (selectResult) selectItems([next.id], true);
  else updateSelectionUi();
  updateEmptyState();
  renderConnections();
  renderMinimap();
  positionSelectionActions();
  commitHistory();
  scheduleSave();
  if (focusText) requestAnimationFrame(() => element.querySelector(".text-content")?.focus());
  return next;
}

function addTextItem(text = "", point = insertionPoint(), focus = false, source = null) {
  return addBoardItem({
    type: "text",
    text,
    x: point.x,
    y: point.y,
    width: 340,
    height: text ? 130 : 112,
    source
  }, focus);
}

function addDocumentItem(point = insertionPoint()) {
  return addBoardItem({
    type: "document",
    text: "",
    documentLanguage: "markdown",
    x: point.x,
    y: point.y,
    width: 520,
    height: 420
  });
}

function addCodeItem(point = insertionPoint()) {
  return addBoardItem({
    type: "code",
    text: "",
    documentLanguage: "plaintext",
    x: point.x,
    y: point.y,
    width: 560,
    height: 420
  });
}

async function localItemDraftFromHandle(handle, type, existing = null) {
  const permission = type === "folder" ? "local-folder-read" : "local-file-read";
  const record = existing?.localHandleId
    ? await db.replaceLocalHandle(existing.localHandleId, currentBoard.id, handle, handle.kind)
    : await db.saveLocalHandle(currentBoard.id, handle, handle.kind);
  const draft = {
    ...(existing || {}),
    type,
    localHandleId: record.id,
    localName: handle.name,
    localKind: handle.kind,
    localPermissionState: "granted"
  };
  draft.card = cardProtocol.normalizeMeta(draft);
  cardProtocol.grant(draft, permission);
  if (type === "file") {
    const file = await handle.getFile();
    draft.localMime = file.type;
    draft.localSize = file.size;
    draft.localModified = file.lastModified;
    if (file.size <= 512_000 && (/^(text\/|application\/(json|javascript|xml))/i.test(file.type) || /\.(md|txt|json|ya?ml|js|ts|tsx|jsx|py|go|rs|java|css|html|xml|sql|sh|zsh)$/i.test(file.name))) {
      draft.localPreview = (await file.text()).slice(0, 120_000);
    }
  } else {
    const entries = [];
    for await (const [name, child] of handle.entries()) {
      entries.push({ name, kind: child.kind });
      if (entries.length >= 200) break;
    }
    draft.localEntries = entries;
  }
  return draft;
}

async function addLocalHandleCard(handle, type, point = insertionPoint()) {
  const draft = await localItemDraftFromHandle(handle, type);
  const item = addBoardItem({
    ...draft,
    x: point.x,
    y: point.y,
    width: type === "folder" ? 440 : 480,
    height: type === "folder" ? 360 : 320
  });
  console.info("[pagedock-local-card] added", { itemId: item.id, type, name: item.localName });
  return item;
}

async function chooseLocalCard(type) {
  if (type === "file" && globalThis.showOpenFilePicker) {
    const [handle] = await globalThis.showOpenFilePicker({ multiple: false });
    if (handle) await addLocalHandleCard(handle, type);
    return;
  }
  if (type === "folder" && globalThis.showDirectoryPicker) {
    const handle = await globalThis.showDirectoryPicker({ mode: "read" });
    if (handle) await addLocalHandleCard(handle, type);
    return;
  }
  (type === "folder" ? localFolderInputEl : localFileInputEl).click();
}

async function relinkLocalCard(item) {
  const type = item.type;
  if (type === "file" && globalThis.showOpenFilePicker) {
    const [handle] = await globalThis.showOpenFilePicker({ multiple: false });
    if (!handle) return;
    Object.assign(item, await localItemDraftFromHandle(handle, type, item), { updatedAt: Date.now() });
    updateLocalCardElement(item);
    scheduleSave();
    return;
  }
  if (type === "folder" && globalThis.showDirectoryPicker) {
    const handle = await globalThis.showDirectoryPicker({ mode: "read" });
    if (!handle) return;
    Object.assign(item, await localItemDraftFromHandle(handle, type, item), { updatedAt: Date.now() });
    updateLocalCardElement(item);
    scheduleSave();
    return;
  }
  localRelinkTargetId = item.id;
  (type === "folder" ? localFolderInputEl : localFileInputEl).click();
}

async function snapshotFileForCard(file) {
  let preview = "";
  if (file.size <= 512_000 && (/^(text\/|application\/(json|javascript|xml))/i.test(file.type) || /\.(md|txt|json|ya?ml|js|ts|tsx|jsx|py|go|rs|java|css|html|xml|sql|sh|zsh)$/i.test(file.name))) {
    preview = (await file.text()).slice(0, 120_000);
  }
  return {
    type: "file",
    localName: file.name,
    localKind: "file",
    localMime: file.type,
    localSize: file.size,
    localModified: file.lastModified,
    localPermissionState: "granted",
    localPreview: preview
  };
}

function fileFromDropEntry(entry) {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function snapshotFolderFromDropEntry(entry) {
  const reader = entry.createReader();
  const entries = [];
  while (entries.length < 200) {
    const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    if (!batch.length) break;
    entries.push(...batch.slice(0, 200 - entries.length));
  }
  return {
    type: "folder",
    localName: entry.name || "文件夹",
    localKind: "directory",
    localPermissionState: "granted",
    localEntries: entries.map(child => ({
      name: child.name,
      kind: child.isDirectory ? "directory" : "file"
    }))
  };
}

function addDroppedLocalSnapshot(draft, point) {
  draft.card = cardProtocol.normalizeMeta(draft);
  cardProtocol.grant(draft, draft.type === "folder" ? "local-folder-read" : "local-file-read");
  return addBoardItem({
    ...draft,
    x: point.x,
    y: point.y,
    width: draft.type === "folder" ? 440 : 480,
    height: draft.type === "folder" ? 360 : 320
  });
}

async function addDroppedFile(file, point) {
  if (file.type?.startsWith("image/")) {
    const src = await readFileAsDataUrl(file);
    return addImageSource(src, file.name, point);
  }
  return addDroppedLocalSnapshot(await snapshotFileForCard(file), point);
}

async function addDroppedHandle(handle, point) {
  if (handle.kind === "file") {
    const file = await handle.getFile();
    if (file.type?.startsWith("image/")) return addDroppedFile(file, point);
    return addLocalHandleCard(handle, "file", point);
  }
  if (handle.kind === "directory") return addLocalHandleCard(handle, "folder", point);
  throw new Error("不支持的本地项目类型");
}

async function addDroppedItems(dataTransfer, point) {
  const transferItems = [...(dataTransfer?.items || [])].filter(item => item.kind === "file");
  // Chrome 要求在 drop 事件的当前调用栈内取得句柄，不能等到第一个 await 之后再调用。
  const descriptors = transferItems.map(item => {
    let handlePromise = Promise.resolve(null);
    try {
      if (typeof item.getAsFileSystemHandle === "function") {
        handlePromise = Promise.resolve(item.getAsFileSystemHandle()).catch(() => null);
      }
    } catch (error) {
      handlePromise = Promise.resolve(null);
    }
    return {
      handlePromise,
      entry: item.webkitGetAsEntry?.() || null,
      file: item.getAsFile?.() || null
    };
  });
  if (!descriptors.length) {
    descriptors.push(...[...(dataTransfer?.files || [])].map(file => ({
      handlePromise: Promise.resolve(null),
      entry: null,
      file
    })));
  }

  let added = 0;
  const failures = [];
  for (const [index, descriptor] of descriptors.entries()) {
    const itemPoint = { x: point.x + index * 28, y: point.y + index * 28 };
    try {
      const handle = await descriptor.handlePromise;
      if (handle) {
        await addDroppedHandle(handle, itemPoint);
      } else if (descriptor.entry?.isDirectory) {
        addDroppedLocalSnapshot(await snapshotFolderFromDropEntry(descriptor.entry), itemPoint);
      } else {
        const file = descriptor.entry?.isFile ? await fileFromDropEntry(descriptor.entry) : descriptor.file;
        if (!file) throw new Error("无法读取拖入的文件");
        await addDroppedFile(file, itemPoint);
      }
      added += 1;
    } catch (error) {
      failures.push(error?.message || "读取失败");
      console.warn("[shizuo-drop] local item failed", { index, reason: error?.message || String(error) });
    }
  }
  if (failures.length) setStatus(`已添加 ${added} 项，${failures.length} 项读取失败`, true);
  else if (added) setStatus(`已添加 ${added} 项到白板`);
}

function addPageItem(value, point = insertionPoint()) {
  const src = normalizedPageUrl(value);
  const url = new URL(src);
  const title = url.hostname.replace(/^www\./i, "") || src;
  const draft = {
    type: "page",
    text: title,
    src,
    x: point.x,
    y: point.y,
    width: 720,
    height: 520,
    source: { url: src, title, capturedAt: Date.now() }
  };
  draft.card = cardProtocol.normalizeMeta(draft);
  // 提交 URL 本身就是用户对该页面卡联网的明确授权。
  cardProtocol.grant(draft, "network-read");
  const item = addBoardItem(draft);
  console.info("[pagedock-page] added", { itemId: item.id, origin: url.origin });
  return item;
}

function addTerminalItem(point = insertionPoint()) {
  const draft = {
    type: "terminal",
    text: "",
    terminalOutput: "",
    terminalStatus: "idle",
    x: point.x,
    y: point.y,
    width: 640,
    height: 420
  };
  draft.card = cardProtocol.normalizeMeta(draft);
  const item = addBoardItem(draft);
  console.info("[pagedock-terminal] card added", { itemId: item.id });
  return item;
}

function addTaskItem(point = insertionPoint(), options = {}) {
  const item = addBoardItem({
    type: "task",
    text: String(options.text || ""),
    taskResult: "",
    taskStatus: "idle",
    taskRunId: "",
    taskProgress: "",
    taskStartedAt: 0,
    taskCompletedAt: 0,
    taskEvents: [],
    taskSourceIds: Array.isArray(options.sourceIds) ? options.sourceIds : [],
    taskSourceCount: Number(options.sourceCount) || 0,
    x: point.x,
    y: point.y,
    width: 480,
    height: 320
  });
  if (options.focus !== false) {
    requestAnimationFrame(() => itemElement(item.id)?.querySelector(".task-prompt")?.focus());
  }
  return item;
}

async function applyBoardCardTaskPatch(task, patch) {
  if (Array.isArray(patch.taskEvents)) patch = { ...patch, taskEvents: compactTaskEvents(patch.taskEvents) };
  if (currentBoard?.id === task.boardId) {
    const item = itemById(task.itemId);
    if (!item) return;
    Object.assign(item, patch, { updatedAt: Date.now() });
    updateTaskItemElement(item);
    commitHistory();
    scheduleSave();
    return;
  }
  await enqueueBoardWrite(task.boardId, async () => {
    const board = await db.getBoard(task.boardId, { includeArchived: true });
    const baseBoard = board ? structuredClone(board) : null;
    if (!board) return;
    const item = board.items.find(candidate => candidate.id === task.itemId);
    if (!item) return;
    Object.assign(item, patch, { updatedAt: Date.now() });
    await db.commitBoardSnapshot(board, {
      baseBoard,
      preserveArchived: task.boardId === db.INBOX_ID,
      reason: "保存 Codex 任务结果"
    });
  });
  notifyDataChanged([task.boardId], "codex-task-result");
}

async function runBoardCardTask(item, sourceItems = null) {
  const previousPrompt = [...normalizeTaskMessages(item?.taskMessages, item)]
    .reverse()
    .find(message => message.role === "user")?.text;
  const prompt = String(item?.text || previousPrompt || "").trim();
  if (!prompt || !currentBoard || item.type !== "task") {
    itemElement(item.id)?.querySelector(".task-prompt")?.focus();
    return { status: "skipped", reason: "任务卡缺少提示词" };
  }
  item.taskLastMode = "coding";
  cardProtocol.grant(item, "codex-run");
  updatePermissionChip(item);
  const existingConversation = taskConversationMessages(item);
  // 原始素材只在首轮自动注入；后续以当前会话为主，避免旧素材覆盖已经切换的新话题。
  const selection = (Array.isArray(sourceItems)
    ? sourceItems
    : existingConversation.length
      ? []
      : (item.taskSourceIds || []).map(itemById)
  ).filter(Boolean);
  item.provenance = {
    ...(item.provenance || {}),
    version: 1,
    operation: "codex-task",
    actor: { id: "codex", name: "Codex" },
    parents: selection.map(source => ({
      kind: "card",
      boardId: String(source.boardId || currentBoard.id),
      cardId: String(source.id),
      cardRevision: Math.max(1, Number(source.revision) || 1),
      relation: "input"
    })),
    createdAt: Number(item.provenance?.createdAt) || Number(item.createdAt) || Date.now()
  };
  const imageItems = selection.filter(source => source.type === "image" && source.src);
  const taskMode = aiRuntime === "agy" ? "conversation" : "coding";
  const initialProgress = selection.some(source => source.type === "page")
    ? "正在分析页面"
    : selection.some(source => ["file", "folder", "document", "code"].includes(source.type))
      ? "正在理解任务和素材"
      : "正在理解任务";
  if (imageItems.length > MAX_CODEX_IMAGES) {
    item.taskStatus = "error";
    item.taskError = `单次最多分析 ${MAX_CODEX_IMAGES} 张图片，请减少圈选内容`;
    updateTaskItemElement(item);
    scheduleSave();
    return { status: "error", reason: item.taskError };
  }
  const runningTask = boardCardTaskForItem(item.id);
  if (runningTask?.completion) return runningTask.completion;
  if (preparingTaskItemIds.has(item.id) || whiteboardTaskForItem(item.id)) return { status: "busy", reason: "任务已在运行" };
  if (codexAtCapacity()) {
    item.taskStatus = "error";
    item.taskError = codexCapacityReason();
    updateTaskItemElement(item);
    scheduleSave();
    return { status: "error", reason: item.taskError };
  }
  cancellingPreparedTaskItemIds.delete(item.id);
  preparingTaskItemIds.add(item.id);
  item.taskStatus = "running";
  item.taskError = "";
  item.taskProgress = selection.some(source => source.type === "page") ? "正在读取页面内容" : initialProgress;
  item.taskStartedAt = Date.now();
  item.taskCompletedAt = 0;
  item.taskEvents = [];
  appendTaskEvent(item, { stage: "preparing", label: item.taskProgress, status: "running" });
  updateTaskItemElement(item);
  updateCodexChatControls();
  try {
    await hydratePageCardsForCodex(selection, progress => {
      if (cancellingPreparedTaskItemIds.has(item.id)) return;
      item.taskProgress = progress;
      updateTaskItemElement(item);
    });
  } catch (error) {
    const cancelled = completePreparingTaskCancellation(item);
    if (cancelled) return cancelled;
    preparingTaskItemIds.delete(item.id);
    item.taskStatus = "error";
    item.taskError = error?.message || "页面内容读取失败";
    item.taskProgress = "";
    updateTaskItemElement(item);
    scheduleSave();
    updateCodexChatControls();
    return { status: "error", reason: item.taskError };
  }
  const cancelled = completePreparingTaskCancellation(item);
  if (cancelled) return cancelled;

  const messagesBefore = normalizeTaskMessages(item.taskMessages, item);
  const replyContext = taskReplyContext(item);
  const replyContextText = taskGenerationContextText({ messages: replyContext.messages });
  const userMessage = normalizeTaskMessage({ role: "user", text: prompt });
  const conversationMessages = [...messagesBefore, userMessage].slice(-MAX_TASK_MESSAGES);
  const conversationContext = taskConversationContext(conversationMessages, userMessage.id);
  let finishTask;
  const completion = new Promise(resolve => { finishTask = resolve; });
  const task = {
    id: db.makeId("board-task"),
    itemId: item.id,
    boardId: currentBoard.id,
    boardName: currentBoard.name,
    sourceCount: selection.length,
    cancelRequested: false,
    userMessageId: userMessage.id,
    userPrompt: prompt,
    replyMessageId: replyContext.messageId,
    messagesBefore,
    conversationMessages,
    taskEvents: item.taskEvents,
    completion,
    finishTask
  };
  boardCardCodexTasks.set(task.id, task);
  preparingTaskItemIds.delete(item.id);
  item.taskMessages = conversationMessages;
  item.taskReplyMessageId = "";
  item.text = "";
  item.taskStatus = "running";
  item.taskRunId = task.id;
  item.taskLastMode = taskMode;
  item.taskError = "";
  item.taskProgress = initialProgress;
  appendTaskEvent(item, { stage: "thinking", label: initialProgress, status: "running" });
  item.updatedAt = Date.now();
  const promptElement = itemElement(item.id)?.querySelector(".task-prompt");
  if (promptElement) promptElement.value = "";
  console.info("[pagedock-board-task] requested", {
    taskId: task.id,
    itemId: item.id,
    boardId: task.boardId,
    sourceCount: selection.length,
    imageCount: imageItems.length
  });
  updateTaskItemElement(item);
  updateCodexChatControls();
  updateSelectionUi();
  scheduleSave();
  try {
    if (!codexChatReady) await connectCodexChat();
    if (!codexChatReady) throw new Error(`${aiRuntimeLabel()} 未连接`);
    item.taskProgress = initialProgress;
    updateTaskItemElement(item);
    const images = aiRuntime === "agy" ? [] : await Promise.all(imageItems.map(imageDataForCodex));
    item.taskProgress = initialProgress;
    updateTaskItemElement(item);
    const response = await chrome.runtime.sendMessage({
      type: CODEX_RUN_REQUEST,
      runtime: aiRuntime,
      id: task.id,
      mode: taskMode,
      prompt,
      page: {
        title: `${task.boardName} · 任务`,
        url: "",
        content: [
          selection.length ? `原始素材：\n\n${selectionContextForCodex(selection)}` : "",
          aiRuntime === "agy" && imageItems.length ? "说明：当前使用 AGY，未传入图片像素；请不要声称看到了图片内容。" : "",
          replyContextText ? `本轮明确引用的回答：\n\n${replyContextText}` : "",
          conversationContext ? `任务卡历史对话：\n\n${conversationContext}` : ""
        ].filter(Boolean).join("\n\n---\n\n")
      },
      images
    });
    if (!response?.ok) throw new Error(response?.error || `${aiRuntimeLabel()} 任务启动失败`);
    return completion;
  } catch (error) {
    boardCardCodexTasks.delete(task.id);
    item.taskMessages = messagesBefore;
    item.taskReplyMessageId = task.replyMessageId;
    item.text = prompt;
    item.taskStatus = "error";
    item.taskError = error?.message || `${aiRuntimeLabel()} 任务启动失败`;
    item.taskProgress = "";
    item.taskRunId = "";
    item.taskCompletedAt = Date.now();
    appendTaskEvent(item, { stage: "failed", label: "任务启动失败", detail: item.taskError, status: "error" });
    console.error("[pagedock-board-task] start failed", error);
    if (promptElement) promptElement.value = prompt;
    updateTaskItemElement(item);
    updateCodexChatControls();
    updateSelectionUi();
    scheduleSave();
    finishTask({ status: "error", reason: item.taskError });
    return completion;
  }
}

async function runDynamicWorkflow(item) {
  const prompt = String(item?.text || "").trim();
  if (!currentBoard || !prompt || item.type !== "task" || whiteboardTaskForItem(item.id) || boardCardTaskForItem(item.id)) return;
  if (codexAtCapacity()) {
    item.taskStatus = "error";
    item.taskError = codexCapacityReason();
    updateTaskItemElement(item);
    return;
  }
  const sourceItems = (item.taskSourceIds || []).map(itemById).filter(Boolean);
  const lens = PageDockBoardDomain.workflowLens(item.taskWorkflowLens);
  const messagesBefore = normalizeTaskMessages(item.taskMessages, item);
  const userMessage = normalizeTaskMessage({ role: "user", text: prompt });
  const task = {
    id: db.makeId("workflow-plan"),
    itemId: item.id,
    taskItemId: item.id,
    boardId: currentBoard.id,
    boardName: currentBoard.name,
    mode: "workflow-plan",
    userPrompt: prompt,
    messagesBefore,
    conversationMessages: [...messagesBefore, userMessage].slice(-MAX_TASK_MESSAGES),
    taskEvents: []
  };
  task.workflowLens = lens.id;
  item.taskWorkflowRole = "controller";
  item.taskWorkflowLens = lens.id;
  item.taskWorkflowTitle = "正在规划";
  item.taskStatus = "running";
  item.taskProgress = "正在规划动态工作流";
  item.taskRunId = task.id;
  item.taskStartedAt = Date.now();
  item.taskCompletedAt = 0;
  item.taskMessages = task.conversationMessages;
  item.text = "";
  item.taskError = "";
  item.taskEvents = [normalizeTaskEvent({ stage: "planning", label: "正在规划动态工作流", status: "running" })];
  task.taskEvents = item.taskEvents;
  whiteboardCodexTasks.set(task.id, task);
  updateTaskItemElement(item);
  scheduleSave();
  try {
    if (!codexChatReady) await connectCodexChat();
    if (!codexChatReady) throw new Error(`${aiRuntimeLabel()} 未连接`);
    const response = await chrome.runtime.sendMessage({
      type: CODEX_RUN_REQUEST,
      id: task.id,
      runtime: aiRuntime,
      mode: "analysis",
      prompt: PageDockBoardDomain.workflowPlanningPrompt(prompt, lens.id),
      page: {
        title: `${currentBoard.name} · 动态工作流`,
        url: "",
        content: sourceItems.length ? selectionContextForCodex(sourceItems) : prompt
      },
      images: []
    });
    if (!response?.ok) throw new Error(response?.error || "动态工作流规划失败");
  } catch (error) {
    whiteboardCodexTasks.delete(task.id);
    item.taskMessages = messagesBefore;
    item.text = prompt;
    item.taskStatus = "error";
    item.taskError = error?.message || "动态工作流规划失败";
    item.taskProgress = "";
    item.taskRunId = "";
    item.taskCompletedAt = Date.now();
    updateTaskItemElement(item);
    scheduleSave();
  }
}

function parseDynamicWorkflowAnswer(answer) {
  const text = String(answer || "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Codex 没有返回有效的工作流计划");
  return PageDockBoardDomain.normalizeWorkflowPlan(JSON.parse(text.slice(start, end + 1)));
}

async function completeDynamicWorkflowPlan(task, answer) {
  const controller = currentBoard?.id === task.boardId ? itemById(task.taskItemId) : null;
  if (!controller) throw new Error("已切换白板，动态工作流未创建");
  const plan = parseDynamicWorkflowAnswer(answer);
  const lens = PageDockBoardDomain.workflowLens(controller.taskWorkflowLens || task.workflowLens);
  whiteboardCodexTasks.delete(task.id);
  const stepCards = createDynamicWorkflowCards(controller, plan);
  controller.taskMessages = appendTaskMessage(task.conversationMessages, "assistant", [
    `已按“${lens.label}”视角规划“${plan.title}”，共 ${plan.steps.length} 个执行容器：`,
    ...plan.steps.map((step, index) => `${index + 1}. ${step.title}（${taskWorkflowModeLabel(step.mode)}）`)
  ].join("\n"));
  controller.taskResult = `动态工作流已规划，共 ${plan.steps.length} 个执行容器`;
  controller.taskStatus = "running";
  controller.taskProgress = "准备执行工作流";
  controller.taskRunId = controller.taskWorkflowId;
  controller.taskEvents = [...(controller.taskEvents || []), normalizeTaskEvent({ stage: "planned", label: "工作流规划完成", status: "success" })].slice(-MAX_TASK_EVENTS);
  updateTaskItemElement(controller);
  if (!await saveBoardNow()) throw new Error("动态工作流未能保存，尚未开始执行");
  try {
    const completed = await executeWorkflowTasks(stepCards, controller);
    controller.taskStatus = "success";
    controller.taskProgress = "";
    controller.taskRunId = "";
    controller.taskCompletedAt = Date.now();
    controller.taskResult = `工作流已完成，${completed} 个执行容器均已产出结果`;
    controller.taskEvents = [...controller.taskEvents, normalizeTaskEvent({ stage: "completed", label: "动态工作流执行完成", status: "success" })].slice(-MAX_TASK_EVENTS);
  } catch (error) {
    const cancelled = error?.code === "WORKFLOW_CANCELLED";
    controller.taskStatus = cancelled ? "cancelled" : "error";
    controller.taskProgress = "";
    controller.taskRunId = "";
    controller.taskCompletedAt = Date.now();
    controller.taskError = cancelled ? "" : (error?.message || "动态工作流执行失败");
    controller.taskEvents = [...controller.taskEvents, normalizeTaskEvent({
      stage: cancelled ? "cancelled" : "failed",
      label: cancelled ? "工作流已停止" : "动态工作流执行失败",
      detail: controller.taskError,
      status: cancelled ? "cancelled" : "error"
    })].slice(-MAX_TASK_EVENTS);
    console.error("[pagedock-dynamic-workflow] stopped", { workflowId: controller.taskWorkflowId, reason: error?.message || "" });
  } finally {
    updateTaskItemElement(controller);
    scheduleSave();
    updateCodexChatControls();
  }
}

function createDynamicWorkflowCards(controller, plan) {
  const workflowId = db.makeId("workflow");
  const cardByStepId = new Map();
  const waveByStepId = new Map(plan.waves.flatMap((wave, waveIndex) => wave.map(id => [id, waveIndex])));
  const rowsByWave = new Map();
  const workflowBottom = controller.y + Math.max(...plan.waves.map(wave => wave.length)) * 380;
  const nearbyItems = boardItems.filter(item => item.id !== controller.id
    && item.y < workflowBottom
    && item.y + item.height > controller.y);
  const startX = Math.max(
    controller.x + controller.width + 180,
    ...nearbyItems.map(item => item.x + item.width + 120)
  );
  for (const step of plan.steps) {
    const wave = waveByStepId.get(step.id) || 0;
    const row = rowsByWave.get(wave) || 0;
    rowsByWave.set(wave, row + 1);
    const card = addBoardItem({
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
      taskWorkflowTitle: step.title,
      taskWorkflowInstruction: step.instruction,
      taskWorkflowRunId: workflowId,
      taskWorkflowLens: PageDockBoardDomain.workflowLens(controller.taskWorkflowLens).id,
      taskVideoEngine: taskVideoEngine(controller.taskVideoEngine),
      x: startX + wave * 600,
      y: controller.y + row * 380,
      width: 480,
      height: 320
    }, false, false);
    cardByStepId.set(step.id, card);
  }
  for (const step of plan.steps) {
    const card = cardByStepId.get(step.id);
    const dependencyCardIds = step.dependsOn.map(id => cardByStepId.get(id)?.id).filter(Boolean);
    const sourceIds = dependencyCardIds.length ? dependencyCardIds : [...new Set([controller.id, ...(controller.taskSourceIds || [])])];
    card.taskSourceIds = sourceIds;
    card.taskSourceCount = sourceIds.length;
    card.relationSourceIds = sourceIds;
  }
  controller.taskWorkflowId = workflowId;
  controller.taskWorkflowRunId = workflowId;
  controller.taskWorkflowRole = "controller";
  controller.taskWorkflowTitle = plan.title;
  controller.taskWorkflowStepIds = plan.steps.map(step => cardByStepId.get(step.id).id);
  controller.updatedAt = Date.now();
  ensureBoardContains([...cardByStepId.values()]);
  renderAllItems();
  return plan.steps.map(step => cardByStepId.get(step.id));
}

async function runWorkflowTask(item) {
  if (!item) return { status: "error", reason: "工作流执行容器已被删除" };
  const directSourceIds = [...new Set([...(item.taskSourceIds || []), ...(item.relationSourceIds || [])])];
  const generatedSourceIds = boardItems
    .filter(candidate => candidate.id !== item.id
      && candidate.taskWorkflowRole !== "step"
      && candidate.generationContext?.workflowId === item.taskWorkflowId
      && (candidate.relationSourceIds || []).some(id => {
        const source = directSourceIds.includes(String(id)) ? itemById(String(id)) : null;
        return source && Number(candidate.createdAt) >= Number(source.taskStartedAt || 0);
      }))
    .map(candidate => candidate.id);
  item.taskSourceIds = [...new Set([...directSourceIds, ...generatedSourceIds])];
  item.taskSourceCount = item.taskSourceIds.length;
  if (!String(item.text || "").trim()) item.text = String(item.taskWorkflowInstruction || "");
  let result;
  if (item.taskWorkflowMode === "text") result = await runWhiteboardCodex("text", item, { scope: "sources" });
  else if (item.taskWorkflowMode === "image-gen") result = await runWhiteboardCodex("image-gen", item, { scope: "sources" });
  else if (item.taskWorkflowMode === "video") result = await runWhiteboardCodex("video", item, { scope: "sources" });
  else result = await runBoardCardTask(item, item.taskSourceIds.map(itemById).filter(Boolean));
  return result?.status ? result : { status: "error", reason: item.taskError || "执行容器未能启动" };
}

async function executeWorkflowTasks(tasks, controller = null) {
  const boardId = currentBoard.id;
  const plan = PageDockBoardDomain.planWorkflow(tasks);
  if (plan.cycles.length) throw new Error(`工作流存在循环依赖：${plan.cycles.join("、")}`);
  const run = controller ? { cancelRequested: false } : null;
  if (controller) dynamicWorkflowRuns.set(controller.id, run);
  console.info("[pagedock-workflow] started", { boardId, taskCount: tasks.length, waveCount: plan.waves.length });
  let completed = 0;
  try {
    for (const wave of plan.waves) {
      if (currentBoard?.id !== boardId) throw new Error("已切换白板，工作流停止调度后续任务");
      for (let offset = 0; offset < wave.length; offset += codexMaxConcurrentTasks) {
        if (run?.cancelRequested) throw Object.assign(new Error("工作流已停止"), { code: "WORKFLOW_CANCELLED" });
        const batch = wave.slice(offset, offset + codexMaxConcurrentTasks);
        const activeTitles = batch.map(id => itemById(id)?.taskWorkflowTitle).filter(Boolean).join("、");
        const progress = `正在执行 ${completed + 1}/${tasks.length}${activeTitles ? ` · ${activeTitles}` : ""}`;
        setStatus(`正在运行工作流 ${completed + 1}/${tasks.length}`);
        if (controller) {
          controller.taskProgress = progress;
          updateTaskItemElement(controller);
          scheduleSave();
        }
        const lanes = PageDockBoardDomain.partitionWorkflowWave(batch, id => itemById(id)?.taskWorkflowMode);
        const results = await Promise.all(lanes.parallel.map(id => runWorkflowTask(itemById(id))));
        for (const id of lanes.serial) {
          if (run?.cancelRequested) break;
          results.push(await runWorkflowTask(itemById(id)));
        }
        if (run?.cancelRequested) throw Object.assign(new Error("工作流已停止"), { code: "WORKFLOW_CANCELLED" });
        completed += batch.length;
        const failed = results.find(result => result?.status !== "success");
        if (failed) throw new Error(failed.reason || "工作流任务执行失败");
      }
    }
  } finally {
    if (controller && dynamicWorkflowRuns.get(controller.id) === run) dynamicWorkflowRuns.delete(controller.id);
  }
  setStatus(`工作流已完成 · ${completed} 个任务`);
  console.info("[pagedock-workflow] completed", { boardId, completed });
  return completed;
}

async function runCurrentWorkflow() {
  if (!currentBoard) throw new Error("请先打开白板");
  const tasks = boardItems.filter(item => item.type === "task" && item.taskWorkflowRole !== "controller");
  if (!tasks.length) throw new Error("当前白板没有任务卡");
  const runButton = document.getElementById("runWorkflow");
  runButton.disabled = true;
  exportMenuEl.open = false;
  try {
    await executeWorkflowTasks(tasks);
  } catch (error) {
    console.error("[pagedock-workflow] stopped", { boardId: currentBoard?.id, reason: error?.message || String(error) });
    setStatus(error?.message || "工作流执行失败", true);
  } finally {
    runButton.disabled = false;
  }
}

function cancelBoardCardTask(item) {
  const task = boardCardTaskForItem(item.id);
  if (!task || task.cancelRequested) return;
  task.cancelRequested = true;
  item.taskProgress = "正在停止…";
  updateTaskItemElement(item);
  chrome.runtime.sendMessage({ type: CODEX_CANCEL_REQUEST, id: task.id })
    .then(response => {
      if (!response?.ok) throw new Error(response?.error || "停止任务失败");
    })
    .catch(error => {
      if (boardCardCodexTasks.get(task.id) !== task) return;
      task.cancelRequested = false;
      item.taskProgress = error?.message || "停止任务失败";
      updateTaskItemElement(item);
    });
}

function cancelWhiteboardTask(task = standaloneWhiteboardTask()) {
  if (!task || task.cancelRequested) return;
  task.cancelRequested = true;
  updateWhiteboardCodexStatus(task, "正在停止…");
  updateSelectionUi();
  chrome.runtime.sendMessage({
    type: CODEX_CANCEL_REQUEST,
    id: task.id
  }).then(response => {
    if (!response?.ok) throw new Error(response?.error || "停止任务失败");
    const activeTaskIds = Array.isArray(response.activeTaskIds)
      ? response.activeTaskIds
      : response.activeTaskId ? [response.activeTaskId] : [];
    if (whiteboardCodexTasks.get(task.id) === task && !activeTaskIds.includes(task.id)) {
      whiteboardCodexTasks.delete(task.id);
      if (task.taskItemId) {
        applyBoardCardTaskPatch(task, {
          taskStatus: "cancelled",
          taskError: "",
          taskProgress: "",
          taskRunId: "",
          taskCompletedAt: Date.now(),
          taskEvents: [...(task.taskEvents || []), normalizeTaskEvent({ stage: "cancelled", label: "任务已停止", status: "cancelled" })].slice(-MAX_TASK_EVENTS)
        }).catch(error => console.error("[pagedock-selection-task] cancel save failed", error));
      }
      if (!task.taskItemId) setStatus("已停止");
      updateSelectionUi();
      updateCodexChatControls();
    }
  }).catch(error => {
    if (whiteboardCodexTasks.get(task.id) !== task) return;
    task.cancelRequested = false;
    updateWhiteboardCodexStatus(task, error?.message || "停止任务失败");
    updateSelectionUi();
    console.error("[pagedock-whiteboard-ai] cancel failed", error);
  });
}

function cancelTaskItem(item) {
  if (!item) return;
  const workflow = dynamicWorkflowRuns.get(item.id);
  if (workflow && !workflow.cancelRequested) {
    workflow.cancelRequested = true;
    item.taskProgress = "正在停止工作流…";
    for (const stepId of item.taskWorkflowStepIds || []) cancelTaskItem(itemById(stepId));
    updateTaskItemElement(item);
    return;
  }
  if (preparingTaskItemIds.has(item.id)) {
    cancellingPreparedTaskItemIds.add(item.id);
    item.taskProgress = "正在停止…";
    updateTaskItemElement(item);
    return;
  }
  const persistedRunIds = item.taskWorkflowRole === "controller"
    ? [item.taskRunId, ...(item.taskWorkflowStepIds || []).map(id => itemById(id)?.taskRunId)]
    : [item.taskRunId];
  const activePersistedRunIds = [...new Set(persistedRunIds.map(String).filter(id => id && codexActiveTaskIds.has(id)))];
  if (item.taskWorkflowRole === "controller" && item.taskStatus === "running" && String(item.taskRunId || "").startsWith("scheduled-")) {
    item.taskProgress = "正在停止定时工作流…";
    updateTaskItemElement(item);
    chrome.runtime.sendMessage({
      type: CODEX_CANCEL_REQUEST,
      id: item.taskRunId,
      boardId: currentBoard.id,
      controllerId: item.id
    }).catch(error => {
      item.taskProgress = error?.message || "停止任务失败";
      updateTaskItemElement(item);
    });
    return;
  }
  if (activePersistedRunIds.length) {
    item.taskProgress = "正在停止定时工作流…";
    updateTaskItemElement(item);
    Promise.all(activePersistedRunIds.map(id => chrome.runtime.sendMessage({ type: CODEX_CANCEL_REQUEST, id })))
      .catch(error => {
        item.taskProgress = error?.message || "停止任务失败";
        updateTaskItemElement(item);
      });
    return;
  }
  if (boardCardTaskForItem(item.id)) {
    cancelBoardCardTask(item);
    return;
  }
  const task = whiteboardTaskForItem(item.id);
  if (task) cancelWhiteboardTask(task);
}

function completePreparingTaskCancellation(item) {
  if (!cancellingPreparedTaskItemIds.delete(item.id)) return null;
  preparingTaskItemIds.delete(item.id);
  item.taskStatus = "cancelled";
  item.taskError = "";
  item.taskProgress = "";
  item.taskRunId = "";
  item.taskCompletedAt = Date.now();
  appendTaskEvent(item, { stage: "cancelled", label: "任务已停止", status: "cancelled" });
  updateTaskItemElement(item);
  updateCodexChatControls();
  scheduleSave();
  return { status: "cancelled", reason: "任务已停止" };
}

function retryTaskItem(item) {
  if (!item || item.type !== "task" || codexAtCapacity()) return;
  if (item.taskWorkflowRole === "controller") {
    const steps = (item.taskWorkflowStepIds || []).map(itemById).filter(Boolean);
    if (!steps.length) {
      runDynamicWorkflow(item);
      return;
    }
    item.taskStatus = "running";
    item.taskError = "";
    item.taskProgress = "正在重新执行工作流";
    item.taskRunId = item.taskWorkflowId;
    item.taskStartedAt = Date.now();
    item.taskCompletedAt = 0;
    updateTaskItemElement(item);
    scheduleSave();
    executeWorkflowTasks(steps, item).then(completed => {
      item.taskStatus = "success";
      item.taskResult = `工作流已完成，${completed} 个执行容器均已产出结果`;
      item.taskProgress = "";
      item.taskRunId = "";
      item.taskCompletedAt = Date.now();
    }).catch(error => {
      const cancelled = error?.code === "WORKFLOW_CANCELLED";
      item.taskStatus = cancelled ? "cancelled" : "error";
      item.taskError = cancelled ? "" : (error?.message || "动态工作流执行失败");
      item.taskProgress = "";
      item.taskRunId = "";
      item.taskCompletedAt = Date.now();
    }).finally(() => {
      updateTaskItemElement(item);
      scheduleSave();
    });
    return;
  }
  if (["text", "image", "image-gen", "video", "video-post"].includes(item.taskLastMode)) {
    runWhiteboardCodex(item.taskLastMode, item, {
      scope: item.taskGenerationScope,
      messageId: item.taskGenerationMessageId
    });
    return;
  }
  runBoardCardTask(item);
}

function handleBoardCardCodexEvent(message) {
  const task = boardCardCodexTasks.get(String(message?.id || ""));
  if (!task) return;
  const item = currentBoard?.id === task.boardId ? itemById(task.itemId) : null;
  if (message.type === "started" || message.type === "progress") {
    if (item) {
      recordTaskProgress(item, message, item.taskProgress || "正在处理任务");
      task.taskEvents = item.taskEvents;
    } else {
      const event = normalizeTaskEvent({
        stage: message.stage,
        label: friendlyCodexProgress(message, "正在处理任务"),
        detail: message.detail,
        status: message.status,
        createdAt: message.createdAt
      });
      task.taskEvents = compactTaskEvents([...(task.taskEvents || []), event]);
      applyBoardCardTaskPatch(task, { taskProgress: event.label, taskEvents: task.taskEvents }).catch(error => {
        console.warn("[pagedock-board-task] inactive progress save failed", error);
      });
    }
    return;
  }
  if (!["done", "error", "cancelled"].includes(message.type)) return;

  boardCardCodexTasks.delete(task.id);
  const answer = String(message.answer || "Codex 没有返回内容");
  const restoredPrompt = String(item?.text || "").trim() ? item.text : task.userPrompt;
  const patch = message.type === "done"
    ? {
        taskStatus: "success",
        taskResult: answer,
        taskMessages: appendTaskMessage(task.conversationMessages, "assistant", answer),
        taskError: "",
        taskProgress: "",
        taskRunId: "",
        taskCompletedAt: Date.now(),
        taskEvents: [...(item?.taskEvents || task.taskEvents || []), normalizeTaskEvent({ stage: "completed", label: "任务执行完成", status: "success" })].slice(-MAX_TASK_EVENTS)
      }
    : message.type === "cancelled"
      ? {
          taskStatus: "cancelled",
          taskMessages: task.messagesBefore,
          taskReplyMessageId: task.replyMessageId,
          text: restoredPrompt,
          taskError: "",
          taskProgress: "",
          taskRunId: "",
          taskCompletedAt: Date.now(),
          taskEvents: [...(item?.taskEvents || task.taskEvents || []), normalizeTaskEvent({ stage: "cancelled", label: "任务已停止", status: "cancelled" })].slice(-MAX_TASK_EVENTS)
        }
      : {
          taskStatus: "error",
          taskMessages: task.messagesBefore,
          taskReplyMessageId: task.replyMessageId,
          text: restoredPrompt,
          taskError: String(message.error || "Codex 任务失败"),
          taskProgress: "",
          taskRunId: "",
          taskCompletedAt: Date.now(),
          taskEvents: [...(item?.taskEvents || task.taskEvents || []), normalizeTaskEvent({ stage: "failed", label: "任务执行失败", detail: String(message.error || ""), status: "error" })].slice(-MAX_TASK_EVENTS)
        };
  applyBoardCardTaskPatch(task, patch).then(async () => {
    const saved = currentBoard?.id === task.boardId ? await saveBoardNow() : true;
    task.finishTask?.({
      status: saved ? patch.taskStatus : "error",
      reason: saved ? patch.taskError || "" : "任务结果未能保存"
    });
  }).catch(error => {
    console.error("[pagedock-board-task] result save failed", error);
    setStatus(error?.message || "任务结果保存失败", true);
    task.finishTask?.({ status: "error", reason: error?.message || "任务结果保存失败" });
  });
  console.info("[pagedock-board-task] finished", { taskId: task.id, status: patch.taskStatus });
  updateCodexChatControls();
  updateSelectionUi();
}

function addLinkItem(url, title = "", point = insertionPoint(), source = null) {
  return addBoardItem({
    type: "link",
    text: title || url,
    src: url,
    x: point.x,
    y: point.y,
    width: 360,
    height: 112,
    source: source || { url, title, capturedAt: Date.now() }
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function imageDimensions(src) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({ width: 420, height: 280 });
    image.src = src;
  });
}

async function addImageSource(src, alt = "", point = insertionPoint(), source = null, selectResult = true, relationSourceIds = [], metadata = {}) {
  if (!/^(data:image\/|blob:|https?:\/\/)/i.test(src || "")) return;
  const dimensions = await imageDimensions(src);
  const naturalWidth = Math.max(1, Number(dimensions.width) || 1);
  const naturalHeight = Math.max(1, Number(dimensions.height) || 1);
  const width = clamp(naturalWidth, 240, 560);
  const contentHeight = Math.max(80, Math.round(width * naturalHeight / naturalWidth));
  return addBoardItem({
    type: "image",
    src,
    alt,
    x: point.x,
    y: point.y,
    width,
    height: Math.min(760, contentHeight + 58 + (source ? 28 : 0)),
    source,
    relationSourceIds,
    ...metadata
  }, false, selectResult);
}

async function addImageFiles(files, point = insertionPoint()) {
  let offset = 0;
  for (const file of files) {
    if (!file?.type?.startsWith("image/")) continue;
    const src = await readFileAsDataUrl(file);
    await addImageSource(src, file.name, { x: point.x + offset, y: point.y + offset });
    offset += 26;
  }
}

function selectionTextForCodex(items) {
  return items
    .filter(item => ["text", "document", "code", "file", "folder", "link", "page", "video", "task", "terminal"].includes(item.type) && itemLabel(item).trim())
    .map((item, index) => {
      const source = item.source?.url ? `\n来源：${item.source.url}` : "";
      const link = item.type === "link" && item.src ? `\n链接：${item.src}` : "";
      const page = item.type === "page" && item.src
        ? `\n页面：${item.src}${item.pageContent ? `\n页面正文（${item.pageContentMode || "已渲染"}）：\n${item.pageContent}` : ""}`
        : "";
      const taskOutput = item.type === "task" ? cardTextOutput(item).trim() : "";
      const result = taskOutput ? `\n最新回答：${taskOutput.slice(0, 40_000)}` : "";
      const terminal = item.type === "terminal"
        ? `\n命令：${item.text || ""}\n控制台输出：${String(item.terminalOutput || "").slice(-20_000)}`
        : "";
      const local = ["file", "folder"].includes(item.type) ? `\n内容：\n${cardTextOutput(item).slice(0, 40_000)}` : "";
      const document = ["document", "code"].includes(item.type) ? `\n内容：\n${String(item.text || "").slice(0, 40_000)}` : "";
      return `[${index + 1}] ${itemTypeLabel(item)}卡片\n${itemLabel(item)}${result}${terminal}${local}${document}${link}${page}${source}`;
    })
    .join("\n\n");
}

function selectionContextForCodex(items) {
  const textContent = selectionTextForCodex(items);
  const images = items.filter(item => item.type === "image" && item.src);
  const imageMetadata = images
    .map((item, index) => `[图片 ${index + 1}] ${item.alt || item.source?.title || "未命名图片"}${item.source?.url ? `\n来源：${item.source.url}` : ""}`)
    .join("\n\n");
  return [
    `圈选内容共 ${items.length} 项：${items.filter(item => item.type === "text").length} 个文字、${items.filter(item => item.type === "document").length} 个文档、${items.filter(item => item.type === "code").length} 个代码、${items.filter(item => ["file", "folder"].includes(item.type)).length} 个本地文件、${images.length} 张图片、${items.filter(item => item.type === "link").length} 个链接、${items.filter(item => item.type === "page").length} 个页面、${items.filter(item => item.type === "video").length} 个视频卡片、${items.filter(item => item.type === "task").length} 个任务、${items.filter(item => item.type === "terminal").length} 个控制台。`,
    textContent ? `文字、链接、页面与控制台：\n\n${textContent}` : "",
    imageMetadata ? `图片名称与来源：\n\n${imageMetadata}` : ""
  ].filter(Boolean).join("\n\n---\n\n");
}

async function imageDataForCodex(item) {
  const response = await fetch(item.src);
  if (!response.ok) throw new Error(`图片读取失败：HTTP ${response.status}`);
  const blob = await response.blob();
  if (!/^image\/(png|jpe?g|webp)$/i.test(blob.type)) {
    throw new Error(`“${itemLabel(item)}”不是 Codex 支持的 PNG、JPEG 或 WebP 图片`);
  }
  if (blob.size > MAX_CODEX_IMAGE_BYTES) throw new Error(`“${itemLabel(item)}”超过 10 MB`);
  return readFileAsDataUrl(blob);
}

async function videoDataForCodex(item) {
  const response = await fetch(item.src);
  if (!response.ok) throw new Error(`视频读取失败：HTTP ${response.status}`);
  const blob = await response.blob();
  if (blob.type !== "video/mp4") throw new Error("当前只支持 MP4 视频后期");
  if (blob.size > MAX_CODEX_VIDEO_BYTES) throw new Error("视频超过 48 MB，无法添加口播");
  return readFileAsDataUrl(blob);
}

async function runWhiteboardCodex(mode, taskItem = null, contextOptions = {}) {
  if (!currentBoard) return;
  const generationContext = taskItem
    ? taskGenerationContext(taskItem, contextOptions)
    : { scope: "sources", label: "圈选内容", messages: [], messageIds: [], messageId: "" };
  const selectedVideoEngine = taskVideoEngine(taskItem?.taskVideoEngine || contextOptions.videoEngine);
  if (taskItem) {
    taskItem.taskLastMode = mode;
    cardProtocol.grant(taskItem, "codex-run");
    updatePermissionChip(taskItem);
  }
  if (taskItem && (preparingTaskItemIds.has(taskItem.id) || boardCardTaskForItem(taskItem.id) || whiteboardTaskForItem(taskItem.id))) return;
  if (!taskItem && standaloneWhiteboardTask()) return;
  if (codexAtCapacity()) {
    const error = codexCapacityReason();
    if (taskItem) {
      taskItem.taskStatus = "error";
      taskItem.taskError = error;
      updateTaskItemElement(taskItem);
      scheduleSave();
    }
    if (!taskItem) setStatus(error, true);
    return;
  }
  const selection = taskItem
    ? generationContext.scope === "sources"
      ? (taskItem.taskSourceIds || []).map(itemById).filter(Boolean)
      : []
    : Array.isArray(contextOptions.sourceIds)
      ? contextOptions.sourceIds.map(itemById).filter(Boolean)
      : attachedSelectionItems();
  if (!selection.length && generationContext.scope === "sources") {
    if (taskItem) {
      taskItem.taskStatus = "error";
      taskItem.taskError = "原始素材已不存在，请重新圈选，或改为基于当前回答";
      taskItem.taskProgress = "";
      updateTaskItemElement(taskItem);
      scheduleSave();
    }
    return;
  }
  if (taskItem) {
    cancellingPreparedTaskItemIds.delete(taskItem.id);
    preparingTaskItemIds.add(taskItem.id);
    taskItem.taskStatus = "running";
    taskItem.taskError = "";
    taskItem.taskProgress = selection.some(item => item.type === "page")
      ? "正在读取页面内容"
      : `正在理解${generationContext.label}`;
    taskItem.taskStartedAt = Date.now();
    taskItem.taskCompletedAt = 0;
    taskItem.taskEvents = [];
    appendTaskEvent(taskItem, { stage: "preparing", label: taskItem.taskProgress, status: "running" });
    updateTaskItemElement(taskItem);
    updateCodexChatControls();
  }
  try {
    await hydratePageCardsForCodex(selection, progress => {
      if (taskItem) {
        if (cancellingPreparedTaskItemIds.has(taskItem.id)) return;
        taskItem.taskProgress = progress;
        updateTaskItemElement(taskItem);
      } else {
        setStatus(progress);
      }
    });
  } catch (error) {
    if (taskItem) {
      const cancelled = completePreparingTaskCancellation(taskItem);
      if (cancelled) return cancelled;
      preparingTaskItemIds.delete(taskItem.id);
      taskItem.taskStatus = "error";
      taskItem.taskError = error?.message || "页面内容读取失败";
      taskItem.taskProgress = "";
      updateTaskItemElement(taskItem);
      scheduleSave();
      updateCodexChatControls();
    } else {
      setStatus(error?.message || "页面内容读取失败", true);
    }
    return;
  }
  if (taskItem) {
    const cancelled = completePreparingTaskCancellation(taskItem);
    if (cancelled) return cancelled;
  }
  const imageItems = selection.filter(item => item.type === "image" && item.src);
  if (imageItems.length > MAX_CODEX_IMAGES) {
    const error = `单次最多分析 ${MAX_CODEX_IMAGES} 张图片，请减少圈选内容`;
    if (taskItem) {
      preparingTaskItemIds.delete(taskItem.id);
      taskItem.taskStatus = "error";
      taskItem.taskError = error;
      taskItem.taskProgress = "";
      updateTaskItemElement(taskItem);
      scheduleSave();
    } else {
      selectionAiStatusEl.textContent = error;
      selectionAiStatusEl.classList.remove("hidden");
    }
    if (!taskItem) setStatus(error, true);
    return;
  }

  const shortcutLabels = {
    text: `总结${generationContext.label}`,
    image: `基于${generationContext.label}生成手稿信息图`,
    "image-gen": `基于${generationContext.label}进行 AI 自由绘图`,
    video: `基于${generationContext.label}生成视频`,
    "video-post": "为视频添加口播与字幕"
  };
  const additionalInstruction = String(taskItem?.text || taskItem?.taskGenerationSnapshot?.instruction || "").trim();
  const messagesBefore = taskItem ? normalizeTaskMessages(taskItem.taskMessages, taskItem) : [];
  const shortcutUserMessage = taskItem && mode === "text"
    ? normalizeTaskMessage({
        role: "user",
        text: additionalInstruction
          ? `${shortcutLabels[mode]}\n\n补充要求：${additionalInstruction}`
          : shortcutLabels[mode],
        kind: "conversation"
      })
    : null;
  const conversationMessages = shortcutUserMessage
    ? [...messagesBefore, shortcutUserMessage].slice(-MAX_TASK_MESSAGES)
    : messagesBefore;
  // 派生创作只读取用户明确选择的上下文，避免原始素材和后续话题被静默混合。
  const primaryContext = taskItem ? taskGenerationContextText(generationContext) : "";
  const sourceContext = selection.length ? selectionContextForCodex(selection) : "";
  const contextSnapshot = {
    scope: generationContext.scope,
    label: generationContext.label,
    messageIds: [...generationContext.messageIds],
    sourceIds: selection.map(item => item.id),
    primaryText: primaryContext,
    instruction: additionalInstruction,
    workflowId: String(taskItem?.taskWorkflowId || ""),
    workflowStepId: String(taskItem?.taskWorkflowStepId || ""),
    createdAt: Date.now()
  };
  let finishTask;
  const completion = new Promise(resolve => { finishTask = resolve; });

  const task = {
    id: db.makeId("board-codex"),
    itemId: taskItem?.id || "",
    taskItemId: taskItem?.id || "",
    boardId: currentBoard.id,
    boardName: currentBoard.name,
    mode,
    selectionIds: selection.map(item => item.id),
    point: taskItem ? aiResultPoint([taskItem]) : aiResultPoint(selection),
    materials: selection.map(item => ({
      type: item.type,
      text: item.text || "",
      alt: item.alt || "",
      src: ["link", "page"].includes(item.type) ? item.src || "" : "",
      source: item.source ? { ...item.source } : null
    })),
    userPrompt: additionalInstruction,
    messagesBefore,
    conversationMessages,
    userMessageId: shortcutUserMessage?.id || "",
    contextSnapshot,
    resultItemId: String(contextOptions.resultItemId || ""),
    parentSnapshots: (taskItem ? [taskItem] : selection).map(source => ({
      kind: "card",
      boardId: String(source.boardId || currentBoard.id),
      cardId: String(source.id),
      cardRevision: Math.max(1, Number(source.revision) || 1),
      relation: "generated-from"
    })),
    taskEvents: taskItem?.taskEvents || [],
    completion,
    finishTask
  };
  whiteboardCodexTasks.set(task.id, task);
  if (taskItem) preparingTaskItemIds.delete(taskItem.id);
  if (!taskItem) codexAttachedSelectionIds = [...task.selectionIds];
  if (taskItem) {
    taskItem.taskStatus = "running";
    taskItem.taskRunId = task.id;
    taskItem.taskLastMode = mode;
    taskItem.taskError = "";
    taskItem.taskMessages = conversationMessages;
    taskItem.taskGenerationScope = generationContext.scope;
    taskItem.taskGenerationMessageId = generationContext.messageId;
    taskItem.taskGenerationSnapshot = contextSnapshot;
    taskItem.text = "";
    taskItem.taskProgress = `正在理解${generationContext.label}`;
    appendTaskEvent(taskItem, { stage: "thinking", label: taskItem.taskProgress, status: "running" });
    taskItem.updatedAt = Date.now();
    const promptElement = itemElement(taskItem.id)?.querySelector(".task-prompt");
    if (promptElement) promptElement.value = "";
    updateTaskItemElement(taskItem);
    scheduleSave();
  }
  updateWhiteboardCodexStatus(task, `正在理解${generationContext.label}`);
  updateSelectionUi();
  updateCodexChatControls();
  if (!taskItem) setStatus("正在理解素材");

  try {
    const images = await Promise.all(imageItems.map(imageDataForCodex));
    task.images = images;
    updateWhiteboardCodexStatus(task, `正在理解${generationContext.label}`);
    const shortcutPrompts = {
      text: "请把指定输入作为一个整体理解。输出文字总结：先给出一句话结论，再列出关键观点、重要信息、内容之间的关系、冲突点和可执行事项。不要遗漏输入信息，也不要臆测。",
      knowledge: "请把指定输入提炼成一张结论优先、可长期复用的业务知识卡，只输出 Markdown。若输入是任务卡，以“最新回答”为主体，忽略任务标题、状态和执行回执。严格结构：# 标题（不超过16字）；紧接一个引用块 > 一句话结论（不超过60字）；## 核心要点（3到5条，每条只写一个有依据的事实或判断，不超过50字）；仅在输入确有依据时增加 ## 业务规则、## 关键指标、## 风险与待确认，每节1到3条；最后写 ## 来源，最多5条，只列可确认的卡片名、文件名或 URL。除来源 URL 外，总字数不超过 500 个中文字符。省略没有可靠信息的章节，禁止重复、空话、背景铺垫和“未识别”占位章节，不得补造事实、规则、指标或来源。若输入含文件夹，只能把目录名和文件名视为索引，不能推断文件正文，并在风险中用一句话说明边界。",
      image: `请把指定输入作为一个整体理解，并为一张重点突出、吸引人眼球的手稿信息图制定内容方案。成图采用粗粝纸张纹理与明显的手写字感，只呈现内容、结构和关系，可使用便签、手绘箭头、圈画、马克笔高亮和少量涂鸦修饰，但装饰不能压过信息。只输出合法 JSON，不要 Markdown 或代码块。格式必须是：{"title":"不超过24字","summary":"不超过120字","highlights":["3到6个按逻辑顺序排列的核心内容节点，每条不超过40字，第一条是最重要结论"],"relations":[{"from":"起点概念，不超过16字","to":"终点概念，不超过16字","label":"关系说明，不超过12字"}],"imageNotes":["按输入图片顺序给出每张图不超过24字的说明"],"theme":"ocean、violet、warm、forest 四选一"}。relations 提取 2 到 5 条最关键的因果、层级、流程或依赖关系。内容层级必须清楚，重点突出，文字精炼。禁止加入产品或品牌眉标、AI 生成说明、用户原始输入、内容摘录、白板名称、来源、时间、生成方式、页脚或水印。提炼内容关系与结论，不要臆测。`,
      "image-gen": "请把指定输入作为一个整体理解，使用 Codex 内置 image-gen 直接创作一张完整图片。允许根据内容自由构图，但视觉语言必须与模板做图一致：明亮温暖的米白或暖奶油纸面、明显但克制的纸纤维与手绘笔触、深蓝或深棕墨线、珊瑚/蓝/橙少量重点色、清晰居中的文字区块，以及便签、手绘箭头、圈画和马克笔高亮。画面要重点突出、吸引人，并准确呈现核心内容、结构和关系；中文要有自然手写感且清楚易读，装饰不能压过信息。禁止暗黑科技风、黑色或深色大底、霓虹光效、赛博朋克、玻璃拟态、金属质感、强烈渐变和阴郁低对比画面。不要照搬固定模板排版，不要加入无用眉标、来源脚注、水印或生成说明，也不要臆造事实。",
      video: "请把指定输入作为一个整体理解，提炼一条清晰叙事主线，并制作成解释型视频。只使用本次明确提供的内容作为事实依据，不要回到未选择的旧话题，也不要臆造事实。",
      "video-post": "使用输入的口播文案，为指定视频添加本地 Kokoro 配音与同步字幕。"
    };
    const prompt = additionalInstruction
      ? `${shortcutPrompts[mode]}\n\n用户补充要求：${additionalInstruction}`
      : shortcutPrompts[mode];
    const sourceVideo = mode === "video-post" ? selection.find(item => item.type === "video" && item.src) : null;
    if (mode === "video-post" && !sourceVideo) throw new Error("原视频已不存在，请重新选择视频");
    const response = await chrome.runtime.sendMessage({
      type: CODEX_RUN_REQUEST,
      id: task.id,
      runtime: aiRuntime,
      mode: mode === "video"
        ? selectedVideoEngine === "remotion" ? "remotion-video" : "hyperframes-video"
        : mode === "video-post" ? "video-post"
        : mode === "image-gen" ? "image-gen" : "analysis",
      prompt,
      page: {
        title: `${task.boardName} · 任务`,
        url: "",
        content: [
          primaryContext ? `${generationContext.label}：\n\n${primaryContext}` : "",
          sourceContext ? `${generationContext.label}：\n\n${sourceContext}` : ""
        ].filter(Boolean).join("\n\n---\n\n")
      },
      images,
      video: sourceVideo ? await videoDataForCodex(sourceVideo) : undefined,
      narration: mode === "video-post" ? additionalInstruction : undefined
    });
    console.info("[pagedock-whiteboard-ai] context frozen", {
      taskId: task.id,
      taskItemId: task.taskItemId,
      scope: contextSnapshot.scope,
      messageCount: contextSnapshot.messageIds.length,
      sourceCount: contextSnapshot.sourceIds.length
    });
    if (!response?.ok) throw new Error(response?.error || "Codex 任务启动失败");
    return completion;
  } catch (error) {
    whiteboardCodexTasks.delete(task.id);
    console.error("[pagedock-whiteboard-ai] task failed", error);
    if (taskItem) {
      taskItem.taskMessages = messagesBefore;
      taskItem.text = additionalInstruction;
      taskItem.taskStatus = "error";
      taskItem.taskError = error?.message || "AI 任务启动失败";
      taskItem.taskProgress = "";
      taskItem.taskRunId = "";
      taskItem.taskCompletedAt = Date.now();
      appendTaskEvent(taskItem, { stage: "failed", label: "任务启动失败", detail: taskItem.taskError, status: "error" });
      const promptElement = itemElement(taskItem.id)?.querySelector(".task-prompt");
      if (promptElement) promptElement.value = additionalInstruction;
      updateTaskItemElement(taskItem);
      scheduleSave();
    }
    if (!taskItem) setStatus(error?.message || "任务启动失败", true);
    finishKnowledgeCardPlaceholder(task, "error", error?.message || "知识卡生成失败，请重试");
    updateSelectionUi();
    updateCodexChatControls();
    finishTask({ status: "error", reason: error?.message || "任务启动失败" });
    return completion;
  }
}

function parseVisualSummary(answer) {
  const fallback = String(answer || "").trim();
  try {
    const start = fallback.indexOf("{");
    const end = fallback.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("没有 JSON");
    const parsed = JSON.parse(fallback.slice(start, end + 1));
    return {
      title: String(parsed.title || "内容总结").trim().slice(0, 36),
      summary: String(parsed.summary || "").trim().slice(0, 300),
      highlights: (Array.isArray(parsed.highlights) ? parsed.highlights : [])
        .map(item => String(item || "").trim().slice(0, 80))
        .filter(Boolean)
        .slice(0, 6),
      relations: (Array.isArray(parsed.relations) ? parsed.relations : [])
        .map(relation => ({
          from: String(relation?.from || "").trim().slice(0, 32),
          to: String(relation?.to || "").trim().slice(0, 32),
          label: String(relation?.label || "关联").trim().slice(0, 24)
        }))
        .filter(relation => relation.from && relation.to)
        .slice(0, 5),
      imageNotes: (Array.isArray(parsed.imageNotes) ? parsed.imageNotes : [])
        .map(item => String(item || "").trim().slice(0, 60))
        .slice(0, MAX_CODEX_IMAGES),
      theme: ["ocean", "violet", "warm", "forest"].includes(parsed.theme) ? parsed.theme : "ocean"
    };
  } catch (_) {
    return {
      title: "内容总结",
      summary: fallback.slice(0, 300) || "Codex 没有返回内容",
      highlights: [],
      relations: [],
      imageNotes: [],
      theme: "ocean"
    };
  }
}

function wrappedCanvasLines(context, value, maxWidth, maxLines) {
  const lines = [];
  for (const paragraph of String(value || "").split(/\n/)) {
    let line = "";
    for (const character of paragraph) {
      const next = line + character;
      if (line && context.measureText(next).width > maxWidth) {
        lines.push(line);
        line = character;
        if (lines.length >= maxLines) return lines;
      } else {
        line = next;
      }
    }
    if (line || !paragraph) lines.push(line);
    if (lines.length >= maxLines) return lines;
  }
  return lines;
}

function drawCanvasText(context, value, x, y, maxWidth, lineHeight, maxLines) {
  const lines = wrappedCanvasLines(context, value, maxWidth, maxLines);
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function drawCenteredCanvasText(context, value, x, y, width, height, lineHeight, maxLines) {
  const lines = wrappedCanvasLines(context, value, width, maxLines);
  const blockHeight = Math.max(0, (lines.length - 1) * lineHeight);
  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";
  const startY = y + height / 2 - blockHeight / 2;
  lines.forEach((line, index) => {
    const seed = [...line].reduce((sum, character) => sum + character.charCodeAt(0), index * 47 + line.length * 13);
    const offsetX = (seed % 7 - 3) * .32;
    const offsetY = (seed % 5 - 2) * .28;
    const rotation = (seed % 9 - 4) * .0009;
    context.save();
    context.translate(x + width / 2 + offsetX, startY + index * lineHeight + offsetY);
    context.rotate(rotation);
    context.strokeStyle = context.fillStyle;
    context.lineWidth = .7 + seed % 3 * .12;
    context.globalAlpha = .2;
    context.strokeText(line, .6, .5);
    context.globalAlpha = 1;
    context.fillText(line, 0, 0);
    context.restore();
  });
  context.restore();
  return lines.length;
}

function paperTextureValue(index, salt = 1) {
  const raw = Math.sin((index + 1) * (12.9898 + salt * 17.731)) * 43758.5453;
  return raw - Math.floor(raw);
}

function drawPaperTexture(context, width, height, palette) {
  const wash = context.createLinearGradient(0, 0, width, height);
  wash.addColorStop(0, palette.paperRaised);
  wash.addColorStop(.38, palette.paper);
  wash.addColorStop(.72, palette.paperRaised);
  wash.addColorStop(1, palette.paper);
  context.fillStyle = wash;
  context.fillRect(0, 0, width, height);

  const stains = [
    [.17, .14, .34, "rgba(165,112,57,.075)"],
    [.82, .28, .27, "rgba(110,77,45,.055)"],
    [.34, .78, .31, "rgba(184,132,72,.052)"],
    [.88, .9, .25, "rgba(120,86,50,.06)"]
  ];
  for (const [x, y, radius, color] of stains) {
    const stain = context.createRadialGradient(width * x, height * y, 0, width * x, height * y, Math.min(width, height) * radius);
    stain.addColorStop(0, color);
    stain.addColorStop(1, "rgba(150,100,50,0)");
    context.fillStyle = stain;
    context.fillRect(0, 0, width, height);
  }

  context.strokeStyle = `${palette.ink}18`;
  context.lineWidth = 1;
  for (let lineY = 42; lineY < height; lineY += 42) {
    context.beginPath();
    context.moveTo(30, lineY + lineY % 3);
    context.quadraticCurveTo(width * .52, lineY - 1, width - 30, lineY + 1);
    context.stroke();
  }
  context.strokeStyle = "rgba(190,87,73,.12)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(62, 26);
  context.lineTo(62, height - 26);
  context.stroke();

  // paper-fiber: deterministic short fibers keep exports stable while making the sheet visibly tactile.
  context.lineCap = "round";
  for (let index = 0; index < 520; index += 1) {
    const x = paperTextureValue(index, 1) * width;
    const y = paperTextureValue(index, 2) * height;
    const length = 3 + paperTextureValue(index, 3) * 19;
    const bend = (paperTextureValue(index, 4) - .5) * 4;
    context.strokeStyle = `rgba(91,68,43,${(.018 + paperTextureValue(index, 5) * .045).toFixed(3)})`;
    context.lineWidth = .35 + paperTextureValue(index, 6) * .75;
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(x + length * .52, y + bend, x + length, y + bend * .35);
    context.stroke();
  }
  for (let index = 0; index < 760; index += 1) {
    const x = paperTextureValue(index, 7) * width;
    const y = paperTextureValue(index, 8) * height;
    const radius = .25 + paperTextureValue(index, 9) * 1.05;
    context.fillStyle = `rgba(72,55,38,${(.018 + paperTextureValue(index, 10) * .05).toFixed(3)})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  const vignette = context.createRadialGradient(width / 2, height / 2, Math.min(width, height) * .18, width / 2, height / 2, Math.max(width, height) * .69);
  vignette.addColorStop(.62, "rgba(75,48,27,0)");
  vignette.addColorStop(1, "rgba(75,48,27,.14)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
}

function drawSketchCard(context, x, y, width, height, options = {}) {
  const radius = options.radius || 18;
  context.save();
  context.translate(x + width / 2, y + height / 2);
  context.rotate(Number(options.rotate) || 0);
  context.translate(-width / 2, -height / 2);
  context.fillStyle = options.fill || "#fffaf0";
  context.beginPath();
  context.roundRect(0, 0, width, height, radius);
  context.fill();
  context.strokeStyle = options.stroke || "#243746";
  context.lineWidth = options.lineWidth || 3;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.roundRect(1.5, -1, width - 2, height + 1, radius);
  context.stroke();
  context.globalAlpha = .36;
  context.lineWidth = Math.max(1, (options.lineWidth || 3) - 1);
  context.beginPath();
  context.roundRect(-1, 1.5, width + 1, height - 2, radius + 2);
  context.stroke();
  context.restore();
}

function drawSketchArrow(context, x1, y1, x2, y2, color) {
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineCap = "round";
  context.lineWidth = 4;
  for (const offset of [-1.5, 1.5]) {
    context.globalAlpha = offset < 0 ? .95 : .4;
    context.beginPath();
    context.moveTo(x1, y1 + offset);
    context.quadraticCurveTo((x1 + x2) / 2, y1 - 5 - offset, x2, y2 + offset);
    context.stroke();
  }
  context.globalAlpha = 1;
  context.beginPath();
  context.moveTo(x2 + 2, y2);
  context.lineTo(x2 - 18, y2 - 11);
  context.lineTo(x2 - 14, y2 + 13);
  context.closePath();
  context.fill();
  context.restore();
}

function drawSketchEmphasis(context, x, y, width, height, color, variant = 0) {
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineCap = "round";
  if (variant % 3 === 0) {
    context.globalAlpha = .22;
    context.lineWidth = Math.max(12, height * .42);
    context.beginPath();
    context.moveTo(x + 8, y + height * .64);
    context.quadraticCurveTo(x + width * .5, y + height * .54, x + width - 8, y + height * .62);
    context.stroke();
  } else if (variant % 3 === 1) {
    context.globalAlpha = .85;
    context.lineWidth = 3;
    context.setLineDash([10, 7]);
    context.beginPath();
    context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, -.03, 0, Math.PI * 2);
    context.stroke();
  } else {
    context.globalAlpha = .9;
    context.lineWidth = 3;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    for (let index = 0; index < 8; index += 1) {
      const angle = Math.PI * 2 * index / 8;
      context.beginPath();
      context.moveTo(centerX + Math.cos(angle) * 14, centerY + Math.sin(angle) * 14);
      context.lineTo(centerX + Math.cos(angle) * 26, centerY + Math.sin(angle) * 26);
      context.stroke();
    }
  }
  context.restore();
}

function drawImageCover(context, image, x, y, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.save();
  context.beginPath();
  context.roundRect(x, y, width, height, 22);
  context.clip();
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  context.restore();
}

async function renderVisualSummary(task, answer) {
  const plan = parseVisualSummary(answer);
  const themes = {
    ocean: { paper: "#f7f0df", paperRaised: "#fffaf0", ink: "#17324d", accent: "#2779d8", accent2: "#f0ad3d", soft: "#dbeaff", contrast: "#e86652" },
    violet: { paper: "#f5efe4", paperRaised: "#fff9f2", ink: "#33284f", accent: "#7557c5", accent2: "#efb54a", soft: "#e9ddff", contrast: "#d95d7b" },
    warm: { paper: "#f8eddf", paperRaised: "#fff8ee", ink: "#4c2e25", accent: "#d65f3c", accent2: "#e8a72f", soft: "#ffe0ce", contrast: "#247c78" },
    forest: { paper: "#f1f0df", paperRaised: "#fbfaed", ink: "#24483d", accent: "#2f8269", accent2: "#e5ad3d", soft: "#d8eadc", contrast: "#cb5b4d" }
  };
  const palette = themes[plan.theme] || themes.ocean;
  const imageCount = task.images?.length || 0;
  const imageColumns = imageCount <= 1 ? 1 : imageCount <= 4 ? 2 : 3;
  const imageRows = Math.ceil(imageCount / imageColumns);
  const imageHeight = imageRows ? 72 + imageRows * 260 + (imageRows - 1) * 24 + 28 : 0;
  const highlights = plan.highlights.length ? plan.highlights : [plan.summary || plan.title].filter(Boolean);
  const relations = plan.relations.length
    ? plan.relations
    : highlights.slice(1, 5).map((highlight, index) => ({
        from: highlights[index],
        to: highlight,
        label: "关联"
      }));
  const highlightRows = Math.ceil(Math.max(1, highlights.length) / 2);
  const highlightHeight = 72 + highlightRows * 174 + 20;
  const relationHeight = relations.length ? 72 + relations.length * 130 + 24 : 0;
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = Math.max(820, 470 + imageHeight + highlightHeight + relationHeight + 84);
  const context = canvas.getContext("2d", { alpha: false });
  const fontFamily = "'HanziPen SC', 'Xingkai SC', 'STXingkai', 'Kaiti SC', 'STKaiti', 'PingFang SC', sans-serif";
  drawPaperTexture(context, canvas.width, canvas.height, palette);
  context.strokeStyle = palette.ink;
  context.lineWidth = 3;
  context.globalAlpha = .72;
  context.strokeRect(24, 22, canvas.width - 48, canvas.height - 44);
  context.globalAlpha = .22;
  context.strokeRect(28, 18, canvas.width - 52, canvas.height - 38);
  context.globalAlpha = 1;

  const padding = 74;
  context.fillStyle = palette.ink;
  context.font = `700 64px ${fontFamily}`;
  drawCenteredCanvasText(context, plan.title, padding, 54, canvas.width - padding * 2, 138, 68, 2);
  drawSketchEmphasis(context, canvas.width * .23, 167, canvas.width * .54, 28, palette.accent, 0);
  drawSketchEmphasis(context, canvas.width - 114, 78, 34, 34, palette.contrast, 2);

  let y = 218;
  const summaryHeight = 150;
  drawSketchCard(context, padding + 30, y, canvas.width - padding * 2 - 60, summaryHeight, {
    fill: palette.soft,
    stroke: palette.ink,
    rotate: -.004,
    lineWidth: 3
  });
  drawSketchEmphasis(context, padding + 68, y + 47, canvas.width - padding * 2 - 136, 50, palette.accent2, 0);
  context.fillStyle = palette.ink;
  context.font = `500 27px ${fontFamily}`;
  drawCenteredCanvasText(context, plan.summary, padding + 70, y + 18, canvas.width - padding * 2 - 140, summaryHeight - 36, 38, 4);
  y += summaryHeight + 48;

  if (imageCount) {
    drawSketchCard(context, padding, y, 170, 48, { fill: palette.accent, stroke: palette.ink, rotate: -.012 });
    context.fillStyle = palette.paperRaised;
    context.font = `700 24px ${fontFamily}`;
    drawCenteredCanvasText(context, "视觉素材", padding, y, 170, 48, 30, 1);
    y += 72;
    const gap = 24;
    const cellWidth = (canvas.width - padding * 2 - gap * (imageColumns - 1)) / imageColumns;
    const cellHeight = 260;
    const images = await Promise.all(task.images.map(loadCanvasImage));
    images.forEach((image, index) => {
      const column = index % imageColumns;
      const row = Math.floor(index / imageColumns);
      const x = padding + column * (cellWidth + gap);
      const top = y + row * (cellHeight + gap);
      drawSketchCard(context, x, top, cellWidth, cellHeight, { fill: palette.paperRaised, stroke: palette.ink, rotate: index % 2 ? .006 : -.006 });
      if (image) drawImageCover(context, image, x + 10, top + 10, cellWidth - 20, cellHeight - 66);
      const note = plan.imageNotes[index] || task.materials.filter(item => item.type === "image")[index]?.alt || `素材 ${index + 1}`;
      context.fillStyle = palette.ink;
      context.font = `600 19px ${fontFamily}`;
      drawCenteredCanvasText(context, String(note).slice(0, 32), x + 18, top + cellHeight - 54, cellWidth - 36, 44, 24, 2);
    });
    y += imageRows * cellHeight + (imageRows - 1) * gap + 38;
  }

  drawSketchCard(context, padding, y, 170, 48, { fill: palette.accent, stroke: palette.ink, rotate: .01 });
  context.fillStyle = palette.paperRaised;
  context.font = `700 24px ${fontFamily}`;
  drawCenteredCanvasText(context, "内容结构", padding, y, 170, 48, 30, 1);
  drawSketchEmphasis(context, padding + 186, y + 8, 36, 30, palette.accent2, 2);
  y += 72;
  highlights.forEach((highlight, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const gap = 28;
    const width = (canvas.width - padding * 2 - gap) / 2;
    const x = padding + column * (width + gap);
    const top = y + row * 174;
    const isPrimary = index === 0;
    drawSketchCard(context, x, top, width, 148, {
      fill: isPrimary ? palette.soft : palette.paperRaised,
      stroke: isPrimary ? palette.accent : palette.ink,
      rotate: (index % 2 ? 1 : -1) * .005,
      lineWidth: isPrimary ? 5 : 3
    });
    if (isPrimary) drawSketchEmphasis(context, x + 58, top + 44, width - 116, 58, palette.accent2, 0);
    context.fillStyle = isPrimary ? palette.accent : palette.ink;
    context.beginPath();
    context.arc(x + 28, top + 28, 23, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = palette.paperRaised;
    context.font = `700 18px ${fontFamily}`;
    drawCenteredCanvasText(context, String(index + 1).padStart(2, "0"), x + 5, top + 5, 46, 46, 22, 1);
    context.fillStyle = palette.ink;
    context.font = `${isPrimary ? 700 : 600} ${isPrimary ? 25 : 23}px ${fontFamily}`;
    drawCenteredCanvasText(context, highlight, x + 62, top + 20, width - 104, 108, 33, 3);
    if (isPrimary) drawSketchEmphasis(context, x + width - 56, top + 14, 30, 30, palette.contrast, 2);
  });
  y += Math.ceil(highlights.length / 2) * 174 + 24;

  if (relations.length) {
    drawSketchCard(context, padding, y, 170, 48, { fill: palette.contrast, stroke: palette.ink, rotate: -.008 });
    context.fillStyle = palette.paperRaised;
    context.font = `700 24px ${fontFamily}`;
    drawCenteredCanvasText(context, "关键关系", padding, y, 170, 48, 30, 1);
    y += 72;
    const rowWidth = canvas.width - padding * 2;
    const nodeWidth = 380;
    relations.forEach((relation, index) => {
      const top = y + index * 130;
      const leftX = padding + 12;
      const rightX = padding + rowWidth - nodeWidth - 12;
      drawSketchCard(context, leftX, top + 18, nodeWidth, 88, { fill: palette.paperRaised, stroke: palette.ink, rotate: -.006 });
      drawSketchCard(context, rightX, top + 18, nodeWidth, 88, { fill: palette.soft, stroke: palette.ink, rotate: .006 });
      context.fillStyle = palette.ink;
      context.font = `600 22px ${fontFamily}`;
      drawCenteredCanvasText(context, relation.from, leftX + 24, top + 28, nodeWidth - 48, 68, 28, 2);
      drawCenteredCanvasText(context, relation.to, rightX + 24, top + 28, nodeWidth - 48, 68, 28, 2);
      const arrowStart = leftX + nodeWidth + 24;
      const arrowEnd = rightX - 24;
      const arrowY = top + 68;
      drawSketchArrow(context, arrowStart, arrowY, arrowEnd, arrowY, palette.accent);
      const labelWidth = Math.min(190, Math.max(112, context.measureText(relation.label || "关联").width + 42));
      const labelX = (arrowStart + arrowEnd - labelWidth) / 2;
      drawSketchCard(context, labelX, top + 8, labelWidth, 42, { fill: palette.accent2, stroke: palette.ink, rotate: index % 2 ? .018 : -.018, radius: 10, lineWidth: 2 });
      context.fillStyle = palette.ink;
      context.font = `700 18px ${fontFamily}`;
      drawCenteredCanvasText(context, relation.label || "关联", labelX + 8, top + 12, labelWidth - 16, 34, 22, 1);
    });
    y += relations.length * 130 + 24;
  }

  drawSketchEmphasis(context, canvas.width - 104, y - 18, 28, 28, palette.accent2, 2);
  const outputHeight = Math.min(canvas.height, Math.max(820, Math.ceil(y + 58)));
  context.strokeStyle = palette.ink;
  context.lineWidth = 3;
  context.globalAlpha = .72;
  context.beginPath();
  context.moveTo(24, outputHeight - 22);
  context.lineTo(canvas.width - 24, outputHeight - 22);
  context.stroke();
  context.globalAlpha = 1;
  const outputCanvas = outputHeight === canvas.height ? canvas : document.createElement("canvas");
  if (outputCanvas !== canvas) {
    outputCanvas.width = canvas.width;
    outputCanvas.height = outputHeight;
    outputCanvas.getContext("2d", { alpha: false }).drawImage(canvas, 0, 0);
  }
  const blob = await canvasBlob(outputCanvas, "image/png");
  return {
    dataUrl: await readFileAsDataUrl(blob),
    title: plan.title,
    aspectRatio: outputCanvas.width / outputCanvas.height
  };
}

async function addWhiteboardAiResult(task, answer) {
  // 任务卡是 Codex 输出的直接上游；没有任务卡时，输出直接连接到原始圈选素材。
  const relationSourceIds = task.taskItemId ? [task.taskItemId] : task.selectionIds;
  const provenance = {
    version: 1,
    operation: `codex-generate-${task.mode}`,
    actor: { id: "codex", name: "Codex" },
    parents: task.parentSnapshots || [],
    createdAt: Date.now()
  };
  if (task.mode === "knowledge") {
    const item = {
      type: "document",
      text: String(answer || "# 知识卡\n\n未识别到可提炼的内容").trim(),
      documentLanguage: "markdown",
      x: task.point.x,
      y: task.point.y,
      width: 520,
      height: 420,
      knowledgeState: "success",
      relationSourceIds,
      generationContext: task.contextSnapshot,
      provenance
    };
    if (currentBoard?.id === task.boardId) {
      const placeholder = itemById(task.resultItemId);
      if (placeholder) {
        Object.assign(placeholder, item, { id: placeholder.id, updatedAt: Date.now() });
        placeholder.card = cardProtocol.normalizeMeta(placeholder);
        itemElement(placeholder.id)?.replaceWith(createItemElement(placeholder));
        updateSelectionUi();
        renderConnections();
        renderMinimap();
        scheduleSave();
        return;
      }
      addBoardItem(item, false, taskMatchesCurrentSelection(task));
      return;
    }
    await db.addItem(task.boardId, item);
    notifyDataChanged([task.boardId], "whiteboard-ai-knowledge-result");
    return;
  }
  if (["video", "video-post"].includes(task.mode)) {
    const artifact = task.videoArtifact;
    if (!artifact?.ready || !artifact.chunks?.length || artifact.chunks.some(chunk => !chunk)) {
      throw new Error("视频文件回传不完整，请重试");
    }
    const src = `data:${artifact.mimeType || "video/mp4"};base64,${artifact.chunks.join("")}`;
    const filename = safeFilename(artifact.filename || `${task.boardName}-AI-Video.mp4`);
    const item = {
      type: "video",
      src,
      alt: task.mode === "video-post" ? `Kokoro 口播视频：${task.boardName}` : `AI 视频：${task.boardName}`,
      filename: filename.endsWith(".mp4") ? filename : `${filename}.mp4`,
      x: task.point.x,
      y: task.point.y,
      width: 640,
      height: 440,
      relationSourceIds,
      generationContext: task.contextSnapshot,
      provenance
    };
    task.videoArtifact = undefined;
    if (currentBoard?.id === task.boardId) {
      const selectResult = taskMatchesCurrentSelection(task);
      addBoardItem(item, false, selectResult);
      return;
    }
    await db.addItem(task.boardId, item);
    notifyDataChanged([task.boardId], "whiteboard-ai-video-result");
    return;
  }
  if (task.mode === "image-gen") {
    const artifact = task.imageArtifact;
    if (!artifact?.ready || !artifact.chunks?.length || artifact.chunks.some(chunk => !chunk)) {
      throw new Error("AI 自由绘图文件回传不完整，请重试");
    }
    const src = `data:${artifact.mimeType || "image/png"};base64,${artifact.chunks.join("")}`;
    const alt = `Codex AI 自由绘图：${safeFilename(artifact.filename || task.boardName)}`;
    task.imageArtifact = undefined;
    if (currentBoard?.id === task.boardId) {
      const selectResult = taskMatchesCurrentSelection(task);
      await addImageSource(src, alt, task.point, null, selectResult, relationSourceIds, {
        generationContext: task.contextSnapshot,
        provenance
      });
      return;
    }
    const dimensions = await imageDimensions(src);
    const naturalWidth = Math.max(1, Number(dimensions.width) || 1);
    const naturalHeight = Math.max(1, Number(dimensions.height) || 1);
    const width = clamp(naturalWidth, 240, 560);
    await db.addItem(task.boardId, {
      type: "image",
      src,
      alt,
      x: task.point.x,
      y: task.point.y,
      width,
      height: Math.min(760, Math.max(80, Math.round(width * naturalHeight / naturalWidth)) + 58),
      relationSourceIds,
      generationContext: task.contextSnapshot,
      provenance
    });
    notifyDataChanged([task.boardId], "whiteboard-ai-image-gen-result");
    return;
  }
  if (task.mode === "image") {
    const visual = await renderVisualSummary(task, answer);
    if (currentBoard?.id === task.boardId) {
      const selectResult = taskMatchesCurrentSelection(task);
      await addImageSource(visual.dataUrl, `Codex 图片：${visual.title}`, task.point, null, selectResult, relationSourceIds, {
        generationContext: task.contextSnapshot,
        provenance
      });
      return;
    }
    const width = 560;
    await db.addItem(task.boardId, {
      type: "image",
      src: visual.dataUrl,
      alt: `Codex 图片：${visual.title}`,
      x: task.point.x,
      y: task.point.y,
      width,
      height: Math.round(width / visual.aspectRatio) + 58,
      relationSourceIds,
      generationContext: task.contextSnapshot,
      provenance
    });
    notifyDataChanged([task.boardId], "whiteboard-ai-visual-result");
    return;
  }
  const text = `Codex 总结\n\n${String(answer || "Codex 没有返回内容").trim()}`;
  const lineEstimate = text.split("\n").length + Math.ceil(text.length / 34);
  const item = {
    type: "text",
    text,
    x: task.point.x,
    y: task.point.y,
    width: 420,
    height: clamp(120 + lineEstimate * 18, 180, 620),
    relationSourceIds,
    generationContext: task.contextSnapshot,
    provenance
  };
  if (currentBoard?.id === task.boardId) {
    const selectResult = taskMatchesCurrentSelection(task);
    addBoardItem(item, false, selectResult);
    return;
  }
  await db.addItem(task.boardId, item);
  notifyDataChanged([task.boardId], "whiteboard-ai-result");
}

function handleWhiteboardCodexEvent(message) {
  const task = whiteboardCodexTasks.get(String(message?.id || ""));
  if (!task) return;
  if (message.type === "done" && task.mode === "workflow-plan") {
    completeDynamicWorkflowPlan(task, message.answer).catch(error => {
      whiteboardCodexTasks.delete(task.id);
      const controller = currentBoard?.id === task.boardId ? itemById(task.taskItemId) : null;
      if (!controller) return;
      controller.taskMessages = task.messagesBefore;
      controller.text = task.userPrompt;
      controller.taskStatus = "error";
      controller.taskError = error?.message || "动态工作流规划失败";
      controller.taskProgress = "";
      controller.taskRunId = "";
      controller.taskCompletedAt = Date.now();
      updateTaskItemElement(controller);
      scheduleSave();
      console.error("[pagedock-dynamic-workflow] planning failed", error);
    });
    return;
  }
  if (message.type === "artifact-start" && task.mode === "image-gen" && message.artifactType === "image") {
    const totalChunks = Number(message.totalChunks) || 0;
    if (totalChunks < 1 || totalChunks > MAX_CODEX_IMAGE_CHUNKS) {
      updateWhiteboardCodexStatus(task, "生成图片过大，无法回传到白板");
      return;
    }
    task.imageArtifact = {
      mimeType: String(message.mimeType || "image/png"),
      filename: String(message.filename || "拾作-AI-Image.png"),
      size: Number(message.size) || 0,
      chunks: new Array(totalChunks),
      received: 0,
      ready: false
    };
    updateWhiteboardCodexStatus(task, "正在将图片添加到白板");
    return;
  }
  if (message.type === "artifact-chunk" && message.artifactType === "image" && task.imageArtifact) {
    const index = Number(message.index);
    if (!Number.isInteger(index) || index < 0 || index >= task.imageArtifact.chunks.length) return;
    if (!task.imageArtifact.chunks[index]) task.imageArtifact.received += 1;
    task.imageArtifact.chunks[index] = String(message.data || "");
    const percent = Math.round(task.imageArtifact.received / task.imageArtifact.chunks.length * 100);
    updateWhiteboardCodexStatus(task, `正在将图片添加到白板 · ${percent}%`);
    return;
  }
  if (message.type === "artifact-done" && message.artifactType === "image" && task.imageArtifact) {
    task.imageArtifact.ready = task.imageArtifact.received === task.imageArtifact.chunks.length;
    updateWhiteboardCodexStatus(task, "正在将图片添加到白板");
    return;
  }
  if (message.type === "artifact-start" && ["video", "video-post"].includes(task.mode)) {
    const totalChunks = Number(message.totalChunks) || 0;
    if (totalChunks < 1 || totalChunks > MAX_CODEX_VIDEO_CHUNKS) {
      updateWhiteboardCodexStatus(task, "视频文件过大，无法回传到白板");
      return;
    }
    task.videoArtifact = {
      mimeType: String(message.mimeType || "video/mp4"),
      filename: String(message.filename || "拾作-AI-Video.mp4"),
      size: Number(message.size) || 0,
      chunks: new Array(totalChunks),
      received: 0,
      ready: false
    };
    updateWhiteboardCodexStatus(task, "正在导出视频");
    return;
  }
  if (message.type === "artifact-chunk" && task.videoArtifact) {
    const index = Number(message.index);
    if (!Number.isInteger(index) || index < 0 || index >= task.videoArtifact.chunks.length) return;
    if (!task.videoArtifact.chunks[index]) task.videoArtifact.received += 1;
    task.videoArtifact.chunks[index] = String(message.data || "");
    const percent = Math.round(task.videoArtifact.received / task.videoArtifact.chunks.length * 100);
    updateWhiteboardCodexStatus(task, `正在导出视频 · ${percent}%`);
    return;
  }
  if (message.type === "artifact-done" && task.videoArtifact) {
    task.videoArtifact.ready = task.videoArtifact.received === task.videoArtifact.chunks.length;
    updateWhiteboardCodexStatus(task, "正在导出视频");
    return;
  }
  if (message.type === "started" || message.type === "progress") {
    const taskItem = task.taskItemId && currentBoard?.id === task.boardId ? itemById(task.taskItemId) : null;
    if (taskItem) {
      recordTaskProgress(taskItem, message, "正在理解素材");
      task.taskEvents = taskItem.taskEvents;
      task.status = taskItem.taskProgress;
    } else {
      updateWhiteboardCodexStatus(task, friendlyCodexProgress(message, "正在理解素材"));
      if (task.taskItemId) {
        const event = normalizeTaskEvent({
          stage: message.stage,
          label: friendlyCodexProgress(message, "正在理解素材"),
          detail: message.detail,
          status: message.status,
          createdAt: message.createdAt
        });
        task.taskEvents = compactTaskEvents([...(task.taskEvents || []), event]);
        applyBoardCardTaskPatch(task, { taskProgress: event.label, taskEvents: task.taskEvents }).catch(error => {
          console.warn("[pagedock-whiteboard-ai] inactive progress save failed", error);
        });
      }
    }
    return;
  }
  if (message.type === "done") {
    updateWhiteboardCodexStatus(task, ["video", "video-post"].includes(task.mode)
      ? "正在导出视频"
      : task.mode === "image-gen"
        ? "正在将图片添加到白板"
        : task.mode === "image" ? "正在生成图片…" : task.mode === "knowledge" ? "正在整理知识卡…" : "正在生成文字卡片…");
    const linkedTaskResult = task.mode === "text"
      ? String(message.answer || "Codex 没有返回内容")
      : ["image", "image-gen"].includes(task.mode)
        ? "图片已生成并添加到白板"
        : task.mode === "video-post" ? "口播与字幕已添加到新视频" : "视频已生成并添加到白板";
    const resultWork = task.taskItemId && task.mode === "text"
      ? Promise.resolve()
      : addWhiteboardAiResult(task, message.answer);
    resultWork
      .then(() => task.taskItemId
        ? applyBoardCardTaskPatch(task, {
            taskStatus: "success",
            taskResult: linkedTaskResult,
            taskMessages: task.mode === "text"
              ? appendTaskMessage(task.conversationMessages, "assistant", linkedTaskResult)
              : task.messagesBefore,
            taskError: "",
            taskProgress: "",
            taskRunId: "",
            taskGenerationScope: "latest",
            taskGenerationMessageId: "",
            taskCompletedAt: Date.now(),
            taskEvents: [...(task.taskEvents || []), normalizeTaskEvent({ stage: "completed", label: "任务执行完成", status: "success" })].slice(-MAX_TASK_EVENTS)
          })
        : undefined)
      .then(() => {
        whiteboardCodexTasks.delete(task.id);
        console.info("[pagedock-whiteboard-ai] finished", {
          taskId: task.id,
          taskItemId: task.taskItemId || "",
          mode: task.mode
        });
        updateSelectionUi();
        updateCodexChatControls();
        if (!task.taskItemId && task.mode === "knowledge") setStatus("知识卡已生成", false, "success");
        task.finishTask?.({ status: "success", reason: "" });
      })
      .catch(error => {
        whiteboardCodexTasks.delete(task.id);
        console.error("[pagedock-whiteboard-ai] result save failed", error);
        if (task.taskItemId) {
          const taskItem = currentBoard?.id === task.boardId ? itemById(task.taskItemId) : null;
          applyBoardCardTaskPatch(task, {
            taskStatus: "error",
            taskMessages: task.messagesBefore,
            text: String(taskItem?.text || "").trim() ? taskItem.text : task.userPrompt,
            taskError: error?.message || "AI 结果保存失败",
            taskProgress: "",
            taskRunId: "",
            taskCompletedAt: Date.now(),
            taskEvents: [...(task.taskEvents || []), normalizeTaskEvent({ stage: "failed", label: "结果保存失败", detail: error?.message || "", status: "error" })].slice(-MAX_TASK_EVENTS)
          }).catch(saveError => console.error("[pagedock-selection-task] failure save failed", saveError));
        }
        if (!task.taskItemId) setStatus("结果保存失败", true);
        finishKnowledgeCardPlaceholder(task, "error", error?.message || "知识卡保存失败，请重试");
        updateSelectionUi();
        updateCodexChatControls();
        task.finishTask?.({ status: "error", reason: error?.message || "AI 结果保存失败" });
      });
    return;
  }
  if (message.type === "error" || message.type === "cancelled") {
    whiteboardCodexTasks.delete(task.id);
    const status = message.type === "cancelled"
      ? "已停止"
      : (message.error || "AI 总结失败");
    if (task.taskItemId) {
      const taskItem = currentBoard?.id === task.boardId ? itemById(task.taskItemId) : null;
      applyBoardCardTaskPatch(task, {
        taskStatus: message.type === "cancelled" ? "cancelled" : "error",
        taskMessages: task.messagesBefore,
        text: String(taskItem?.text || "").trim() ? taskItem.text : task.userPrompt,
        taskError: message.type === "error" ? status : "",
        taskProgress: "",
        taskRunId: "",
        taskCompletedAt: Date.now(),
        taskEvents: [...(task.taskEvents || []), normalizeTaskEvent({
          stage: message.type === "cancelled" ? "cancelled" : "failed",
          label: message.type === "cancelled" ? "任务已停止" : "任务执行失败",
          detail: message.type === "error" ? status : "",
          status: message.type === "cancelled" ? "cancelled" : "error"
        })].slice(-MAX_TASK_EVENTS)
      }).catch(error => console.error("[pagedock-selection-task] final state save failed", error));
    }
    if (!task.taskItemId) setStatus(status, message.type === "error");
    finishKnowledgeCardPlaceholder(task, message.type === "cancelled" ? "cancelled" : "error", status);
    updateSelectionUi();
    updateCodexChatControls();
    task.finishTask?.({ status: message.type === "cancelled" ? "cancelled" : "error", reason: status });
  }
}

function removeItems(ids) {
  if (focusedItemId && ids.includes(focusedItemId)) exitItemFocus(false, false);
  for (const id of ids) {
    const item = itemById(id);
    if (item?.taskWorkflowRole === "controller") cancelTaskItem(item);
  }
  for (const item of boardItems) {
    if (ids.includes(item.id) && item.type === "terminal") {
      if (["connected", "connecting"].includes(item.terminalStatus)) closeTerminalSession(item);
      clearTerminalSaveTimer(item.id);
      disposeTerminalRenderer(terminalSessions.get(item.terminalSessionId));
    }
  }
  for (const task of boardCardCodexTasks.values()) {
    if (ids.includes(task.itemId)) chrome.runtime.sendMessage({ type: CODEX_CANCEL_REQUEST, id: task.id }).catch(() => {});
  }
  for (const task of whiteboardCodexTasks.values()) {
    if (task.taskItemId && ids.includes(task.taskItemId)) {
      chrome.runtime.sendMessage({ type: CODEX_CANCEL_REQUEST, id: task.id }).catch(() => {});
    }
  }
  const removing = new Set(ids);
  boardItems = boardItems.filter(item => !removing.has(item.id));
  for (const item of boardItems) {
    if (item.card?.inputs) item.card.inputs = item.card.inputs.filter(connection => !removing.has(connection.sourceId));
    item.relationSourceIds = (item.relationSourceIds || []).filter(id => !removing.has(id));
    if (item.type === "task") item.taskSourceIds = (item.taskSourceIds || []).filter(id => !removing.has(id));
  }
  ids.forEach(id => itemElement(id)?.remove());
  selectedIds = new Set([...selectedIds].filter(id => !removing.has(id)));
  updateSelectionUi();
  updateEmptyState();
  renderConnections();
  renderMinimap();
  commitHistory();
  scheduleSave();
}

function moveSelectedBy(dx, dy) {
  for (const id of selectedIds) {
    const item = itemById(id);
    const element = itemElement(id);
    if (!item || !element) continue;
    item.x += dx;
    item.y += dy;
    item.updatedAt = Date.now();
    element.style.left = `${item.x}px`;
    element.style.top = `${item.y}px`;
  }
  ensureBoardContains(selectedItems());
  renderConnections();
  renderMinimap();
  positionSelectionActions();
  commitHistory();
  scheduleSave();
}

function alignSelection(axis) {
  const selected = [...selectedIds].map(itemById).filter(Boolean);
  if (selected.length < 2) return;
  const target = Math.min(...selected.map(item => axis === "x" ? item.x : item.y));
  for (const item of selected) {
    item[axis] = target;
    const element = itemElement(item.id);
    if (element) element.style[axis === "x" ? "left" : "top"] = `${target}px`;
  }
  renderConnections();
  renderMinimap();
  positionSelectionActions();
  commitHistory();
  scheduleSave();
}

function gridLayout(items, startX, startY) {
  if (!items.length) return { right: startX, bottom: startY };
  const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(items.length))));
  const rows = Math.ceil(items.length / columns);
  const columnWidths = Array.from({ length: columns }, () => 0);
  const rowHeights = Array.from({ length: rows }, () => 0);
  items.forEach((item, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    columnWidths[column] = Math.max(columnWidths[column], item.width);
    rowHeights[row] = Math.max(rowHeights[row], item.height);
  });
  const xPositions = [];
  const yPositions = [];
  columnWidths.reduce((position, width, index) => {
    xPositions[index] = position;
    return position + width + 56;
  }, startX);
  rowHeights.reduce((position, height, index) => {
    yPositions[index] = position;
    return position + height + 48;
  }, startY);
  items.forEach((item, index) => {
    item.x = xPositions[index % columns];
    item.y = yPositions[Math.floor(index / columns)];
  });
  return {
    right: xPositions.at(-1) + columnWidths.at(-1),
    bottom: yPositions.at(-1) + rowHeights.at(-1)
  };
}

function optimizeBoardLayout() {
  if (boardItems.length < 2) return;
  const edges = relationEdges();
  const originX = Math.max(32, Math.min(...boardItems.map(item => item.x)));
  const originY = Math.max(32, Math.min(...boardItems.map(item => item.y)));
  const connectedIds = new Set(edges.flatMap(edge => [edge.source.id, edge.target.id]));
  const connectedItems = boardItems.filter(item => connectedIds.has(item.id));
  const isolatedItems = boardItems.filter(item => !connectedIds.has(item.id)).sort((left, right) => left.y - right.y || left.x - right.x);

  let graphBounds = { right: originX, bottom: originY };
  if (connectedItems.length) {
    const outgoing = new Map(connectedItems.map(item => [item.id, []]));
    const indegree = new Map(connectedItems.map(item => [item.id, 0]));
    edges.forEach(edge => {
      outgoing.get(edge.source.id)?.push(edge.target.id);
      indegree.set(edge.target.id, (indegree.get(edge.target.id) || 0) + 1);
    });
    const layerById = new Map(connectedItems.map(item => [item.id, 0]));
    const queue = connectedItems.filter(item => indegree.get(item.id) === 0).sort((left, right) => left.y - right.y);
    const processed = new Set();
    while (queue.length) {
      const item = queue.shift();
      if (processed.has(item.id)) continue;
      processed.add(item.id);
      for (const targetId of outgoing.get(item.id) || []) {
        layerById.set(targetId, Math.max(layerById.get(targetId) || 0, (layerById.get(item.id) || 0) + 1));
        indegree.set(targetId, indegree.get(targetId) - 1);
        if (indegree.get(targetId) === 0) queue.push(itemById(targetId));
      }
    }
    // 循环关系无法形成严格 DAG，保留其相对顺序并放入最浅层，避免布局失败。
    connectedItems.filter(item => !processed.has(item.id)).forEach(item => layerById.set(item.id, 0));
    const layers = new Map();
    connectedItems.forEach(item => {
      const layer = layerById.get(item.id) || 0;
      if (!layers.has(layer)) layers.set(layer, []);
      layers.get(layer).push(item);
    });
    const orderedLayers = [...layers.entries()].sort((left, right) => left[0] - right[0]);
    orderedLayers.forEach(([, items]) => items.sort((left, right) => {
      const leftSources = relationSourceIds(left).map(itemById).filter(Boolean);
      const rightSources = relationSourceIds(right).map(itemById).filter(Boolean);
      const leftWeight = leftSources.length ? leftSources.reduce((sum, item) => sum + item.y, 0) / leftSources.length : left.y;
      const rightWeight = rightSources.length ? rightSources.reduce((sum, item) => sum + item.y, 0) / rightSources.length : right.y;
      return leftWeight - rightWeight;
    }));
    const layerWidths = orderedLayers.map(([, items]) => Math.max(...items.map(item => item.width)));
    const layerHeights = orderedLayers.map(([, items]) => items.reduce((sum, item) => sum + item.height, 0) + Math.max(0, items.length - 1) * 56);
    const graphHeight = Math.max(...layerHeights);
    let x = originX;
    orderedLayers.forEach(([, items], layerIndex) => {
      let y = originY + Math.max(0, (graphHeight - layerHeights[layerIndex]) / 2);
      items.forEach(item => {
        item.x = x;
        item.y = y;
        y += item.height + 56;
      });
      x += layerWidths[layerIndex] + 104;
    });
    graphBounds = { right: x - 104, bottom: originY + graphHeight };
  }

  if (isolatedItems.length) {
    const gridY = connectedItems.length ? graphBounds.bottom + 88 : originY;
    gridLayout(
      isolatedItems,
      originX,
      gridY
    );
  }

  for (const item of boardItems) {
    item.x = Math.round(item.x);
    item.y = Math.round(item.y);
    item.updatedAt = Date.now();
    const element = itemElement(item.id);
    if (!element) continue;
    element.style.left = `${item.x}px`;
    element.style.top = `${item.y}px`;
  }
  ensureBoardContains(boardItems);
  renderConnections();
  renderMinimap();
  positionSelectionActions();
  commitHistory();
  scheduleSave();
  console.info("[pagedock-layout] optimized", { itemCount: boardItems.length, relationCount: edges.length });
}

function groupSelection() {
  if (selectedIds.size < 2) return;
  const groupId = db.makeId("group");
  selectedIds.forEach(id => {
    const item = itemById(id);
    if (item) item.groupId = groupId;
    itemElement(id)?.classList.add("grouped");
  });
  updateSelectionUi();
  commitHistory();
  scheduleSave();
}

function ungroupSelection() {
  selectedIds.forEach(id => {
    const item = itemById(id);
    if (item) item.groupId = "";
    itemElement(id)?.classList.remove("grouped");
  });
  updateSelectionUi();
  commitHistory();
  scheduleSave();
}

function historySnapshot() {
  return JSON.stringify(boardItems);
}

function resetHistory() {
  clearTimeout(historyTimer);
  historyEntries = [historySnapshot()];
  historyIndex = 0;
  updateHistoryButtons();
}

function commitHistory() {
  if (applyingHistory) return;
  clearTimeout(historyTimer);
  const snapshot = historySnapshot();
  if (historyEntries[historyIndex] === snapshot) return;
  historyEntries = historyEntries.slice(0, historyIndex + 1);
  historyEntries.push(snapshot);
  if (historyEntries.length > 80) historyEntries.shift();
  historyIndex = historyEntries.length - 1;
  updateHistoryButtons();
}

function queueHistoryCommit() {
  clearTimeout(historyTimer);
  historyTimer = setTimeout(commitHistory, HISTORY_DELAY_MS);
}

function updateHistoryButtons() {
  document.getElementById("undo").disabled = historyIndex <= 0;
  document.getElementById("redo").disabled = historyIndex >= historyEntries.length - 1;
}

function applyHistory(index) {
  if (index < 0 || index >= historyEntries.length) return;
  applyingHistory = true;
  historyIndex = index;
  boardItems = JSON.parse(historyEntries[historyIndex]);
  selectedIds.clear();
  renderAllItems();
  applyingHistory = false;
  updateHistoryButtons();
  scheduleSave();
}

function scheduleSave() {
  if (!currentBoard) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveBoardNow, SAVE_DELAY_MS);
}

async function saveBoardNow() {
  if (!currentBoard) return;
  clearTimeout(saveTimer);
  saveTimer = undefined;
  const boardReference = currentBoard;
  const boardId = boardReference.id;
  const baseBoard = clone(boardReference);
  const snapshot = {
    ...clone(boardReference),
    name: boardNameEl.value.trim() || boardReference.name || "未命名白板",
    items: clone(boardItems),
    viewport: {
      zoom,
      scrollLeft: viewportEl.scrollLeft,
      scrollTop: viewportEl.scrollTop,
      canvasWidth: boardWidth,
      canvasHeight: boardHeight
    }
  };
  let operation;
  try {
    if (navigator.storage?.estimate && Date.now() - lastStorageEstimateAt > 30_000) {
      lastStorageEstimateAt = Date.now();
      const estimate = await navigator.storage.estimate();
      if (estimate.quota && estimate.usage / estimate.quota > 0.9) {
        setStatus("本地存储空间接近上限，建议先备份并清理大型视频或图片", true);
        console.warn("[pagedock-storage] quota pressure", { usage: estimate.usage, quota: estimate.quota });
      }
    }
    operation = enqueueBoardWrite(boardId, () => db.commitBoardSnapshot(snapshot, {
      baseBoard,
      preserveArchived: boardId === db.INBOX_ID,
      actor: { id: "owner", name: "白板用户" },
      reason: "编辑白板"
    }));
    saveInFlight = operation;
    const saved = await operation;
    if (currentBoard?.id === boardId) {
      const mergedExternalChanges = Number(saved.revision) > Number(baseBoard.revision || 0) + 1
        || saved.items.length !== snapshot.items.length;
      Object.assign(currentBoard, saved, { items: clone(saved.items) });
      if (mergedExternalChanges) {
        // IndexedDB 已完成字段级合并，画布必须采用完整结果，不能让下一次旧快照删除外部新增卡片。
        boardItems = clone(saved.items);
        renderAllItems();
        ensureBoardContains(boardItems);
        renderConnections();
        renderMinimap();
      } else {
        const savedItems = new Map(saved.items.map(item => [String(item.id), item]));
        for (const item of boardItems) item.revision = Number(savedItems.get(String(item.id))?.revision) || item.revision;
      }
    }
    chrome.runtime.sendMessage({
      type: "pagedock-data-changed",
      boardIds: [boardId],
      reason: "owner-board-save",
      source: messageSource
    }).catch(() => {});
    return saved;
  } catch (error) {
    console.error("[pagedock-board] save failed", error);
    setStatus(error?.code === "BOARD_CONFLICT"
      ? "检测到协作冲突：已保留当前编辑，请重新打开白板后合并"
      : "白板未能保存，请检查存储空间后重试", true);
    return null;
  } finally {
    if (saveInFlight === operation) saveInFlight = undefined;
  }
}

async function flushSave() {
  const hasPendingTerminalSave = terminalSaveTimers.size > 0;
  for (const timer of terminalSaveTimers.values()) clearTimeout(timer);
  terminalSaveTimers.clear();
  if ((saveTimer || hasPendingTerminalSave) && currentBoard) await saveBoardNow();
  if (saveInFlight) await saveInFlight.catch(() => {});
}

function setZoom(nextZoom, preserveCenter = true) {
  const previous = zoom;
  const center = {
    x: (viewportEl.scrollLeft + viewportEl.clientWidth / 2) / previous,
    y: (viewportEl.scrollTop + viewportEl.clientHeight / 2) / previous
  };
  zoom = clamp(Number(nextZoom) || 1, MIN_ZOOM, MAX_ZOOM);
  boardEl.style.transform = `scale(${zoom})`;
  stageEl.style.width = `${boardWidth * zoom}px`;
  stageEl.style.height = `${boardHeight * zoom}px`;
  zoomLabelEl.textContent = `${Math.round(zoom * 100)}%`;
  if (preserveCenter) {
    viewportEl.scrollLeft = center.x * zoom - viewportEl.clientWidth / 2;
    viewportEl.scrollTop = center.y * zoom - viewportEl.clientHeight / 2;
  }
  updateMinimapViewport();
  positionSelectionActions();
  scheduleSave();
}

function blockBrowserPageZoomShortcut(event) {
  if (!currentBoard || !(event.metaKey || event.ctrlKey)) return false;
  if (!["+", "=", "-", "0"].includes(event.key)) return false;
  // 白板缩放只由画布手势和右下角控件控制，页面框架始终保持 100%。
  event.preventDefault();
  return true;
}

function blockBrowserPageZoomOutsideCanvas(event) {
  if (!currentBoard || !(event.metaKey || event.ctrlKey)) return;
  if (viewportEl.contains(event.target)) return;
  // 阻止 Chrome 在工具栏、侧栏和浮层上执行整页缩放。
  event.preventDefault();
}

function fitBoard() {
  if (!boardItems.length) {
    setZoom(1, false);
    viewportEl.scrollLeft = 0;
    viewportEl.scrollTop = 0;
    return;
  }
  const padding = 80;
  const minX = Math.max(0, Math.min(...boardItems.map(item => item.x)) - padding);
  const minY = Math.max(0, Math.min(...boardItems.map(item => item.y)) - padding);
  const maxX = Math.max(...boardItems.map(item => item.x + item.width)) + padding;
  const maxY = Math.max(...boardItems.map(item => item.y + item.height)) + padding;
  const next = clamp(
    Math.min(viewportEl.clientWidth / Math.max(1, maxX - minX), viewportEl.clientHeight / Math.max(1, maxY - minY)),
    MIN_ZOOM,
    1
  );
  setZoom(next, false);
  viewportEl.scrollLeft = minX * zoom;
  viewportEl.scrollTop = minY * zoom;
  updateMinimapViewport();
}

function renderMinimap() {
  if (minimapRenderFrame) return;
  minimapRenderFrame = requestAnimationFrame(() => {
    minimapRenderFrame = undefined;
    renderMinimapNow();
  });
}

function renderMinimapNow() {
  minimapItemsEl.replaceChildren();
  const scaleX = minimapEl.clientWidth / boardWidth;
  const scaleY = minimapEl.clientHeight / boardHeight;
  for (const item of boardItems) {
    const marker = document.createElement("div");
    marker.className = "minimap-item";
    marker.style.left = `${item.x * scaleX}px`;
    marker.style.top = `${item.y * scaleY}px`;
    marker.style.width = `${Math.max(2, item.width * scaleX)}px`;
    marker.style.height = `${Math.max(2, item.height * scaleY)}px`;
    minimapItemsEl.appendChild(marker);
  }
  updateMinimapViewport();
}

function updateMinimapViewport() {
  if (!minimapEl.clientWidth || !viewportEl.clientWidth) return;
  const scaleX = minimapEl.clientWidth / boardWidth;
  const scaleY = minimapEl.clientHeight / boardHeight;
  minimapViewportEl.style.left = `${viewportEl.scrollLeft / zoom * scaleX}px`;
  minimapViewportEl.style.top = `${viewportEl.scrollTop / zoom * scaleY}px`;
  minimapViewportEl.style.width = `${Math.min(minimapEl.clientWidth, viewportEl.clientWidth / zoom * scaleX)}px`;
  minimapViewportEl.style.height = `${Math.min(minimapEl.clientHeight, viewportEl.clientHeight / zoom * scaleY)}px`;
}

function initializeBoardDimensions(board) {
  const contentMaxX = boardItems.length ? Math.max(...boardItems.map(item => item.x + item.width)) : 0;
  const contentMaxY = boardItems.length ? Math.max(...boardItems.map(item => item.y + item.height)) : 0;
  const requiredWidth = contentMaxX + BOARD_GROW_GUTTER;
  const requiredHeight = contentMaxY + BOARD_GROW_GUTTER;
  boardWidth = Math.max(
    INITIAL_BOARD_WIDTH,
    Number(board.viewport?.canvasWidth) || 0,
    Math.ceil(requiredWidth / BOARD_EXPANSION_STEP) * BOARD_EXPANSION_STEP
  );
  boardHeight = Math.max(
    INITIAL_BOARD_HEIGHT,
    Number(board.viewport?.canvasHeight) || 0,
    Math.ceil(requiredHeight / BOARD_EXPANSION_STEP) * BOARD_EXPANSION_STEP
  );
  applyBoardDimensions();
}

function restoreRunningTasksForBoard(board) {
  for (const item of boardItems) {
    if (item.type !== "task" || item.taskStatus !== "running") continue;
    const runId = String(item.taskRunId || "");
    const messages = normalizeTaskMessages(item.taskMessages, item);
    const lastUserMessage = [...messages].reverse().find(message => message.role === "user");
    const workflowPlanning = item.taskWorkflowRole === "controller" && item.taskWorkflowTitle === "正在规划";
    if (runId.startsWith("scheduled-")) continue;
    if (!runId || !codexActiveTaskIds.has(runId)) {
      item.taskStatus = "error";
      item.taskProgress = "";
      item.taskRunId = "";
      item.taskCompletedAt = Date.now();
      item.taskError = item.taskWorkflowRole === "controller"
        ? "页面刷新中断了工作流调度，已有内容已保留，请点击重试继续执行"
        : "任务连接已中断，原始内容已经保留，可以重新执行";
      item.text = String(item.text || lastUserMessage?.text || "");
      appendTaskEvent(item, { stage: "interrupted", label: "任务连接已中断", status: "error" });
      continue;
    }
    const task = {
      id: runId,
      itemId: item.id,
      taskItemId: item.id,
      boardId: board.id,
      boardName: board.name,
      mode: workflowPlanning ? "workflow-plan" : item.taskLastMode,
      selectionIds: [...(item.taskSourceIds || [])],
      sourceCount: item.taskSourceCount || 0,
      point: aiResultPoint([item]),
      materials: [],
      userMessageId: lastUserMessage?.id || "",
      userPrompt: lastUserMessage?.text || "",
      messagesBefore: messages.slice(0, -1),
      conversationMessages: messages,
      contextSnapshot: item.taskGenerationSnapshot || null,
      taskEvents: item.taskEvents || [],
      resumed: true
    };
    if (workflowPlanning || ["text", "image", "image-gen", "video", "video-post"].includes(item.taskLastMode)) whiteboardCodexTasks.set(runId, task);
    else boardCardCodexTasks.set(runId, task);
    item.taskProgress = item.taskProgress || "正在恢复任务进度";
    appendTaskEvent(item, { stage: "resumed", label: "已恢复任务连接", status: "running" });
    console.info("[pagedock-task] resumed", { taskId: runId, itemId: item.id, mode: item.taskLastMode });
  }
}

async function openBoard(boardId, updateUrl = true) {
  await flushSave();
  const board = await db.getBoard(boardId);
  if (!board) {
    await renderHome(updateUrl);
    return;
  }
  if (currentBoard?.id && currentBoard.id !== board.id) {
    await Promise.all([...terminalSessions.values()].map(session => closeTerminalSession(session.item)));
    disposeTerminalRenderers();
  }
  currentBoard = board;
  lastBoardPoint = undefined;
  insertionCascade = 0;
  boardItems = board.items.map(item => {
    const taskMessages = item.type === "task" ? normalizeTaskMessages(item.taskMessages, item) : [];
    const migratedLegacyTask = item.type === "task"
      && !Array.isArray(item.taskMessages)
      && Boolean(item.taskResult);
    return {
      ...item,
      text: migratedLegacyTask ? "" : item.text,
      taskMessages,
      taskStatus: item.taskStatus,
      terminalStatus: item.type === "terminal"
        && ["running", "connecting", "connected"].includes(item.terminalStatus)
        && !codexActiveTaskIds.has(item.terminalTaskId)
        ? (item.terminalStatus === "running" ? "cancelled" : "closed")
        : item.terminalStatus,
      terminalTaskId: item.type === "terminal"
        && item.terminalStatus === "running"
        && !codexActiveTaskIds.has(item.terminalTaskId)
        ? ""
        : item.terminalTaskId,
      taskProgress: String(item.taskProgress || ""),
      taskEvents: compactTaskEvents(item.taskEvents),
      taskGenerationScope: ["latest", "conversation", "sources", "message"].includes(item.taskGenerationScope)
        ? item.taskGenerationScope
        : "",
      taskGenerationMessageId: String(item.taskGenerationMessageId || ""),
      taskReplyMessageId: String(item.taskReplyMessageId || ""),
      taskGenerationSnapshot: item.taskGenerationSnapshot ? clone(item.taskGenerationSnapshot) : null
    };
  });
  restoreRunningTasksForBoard(board);
  for (const [taskId, terminalTask] of terminalTasks) {
    if (terminalTask.boardId === board.id) terminalTasks.delete(taskId);
  }
  for (const item of boardItems) {
    if (item.type === "terminal" && item.terminalStatus === "running" && item.terminalTaskId) {
      terminalTasks.set(item.terminalTaskId, { boardId: board.id, item });
    }
  }
  initializeBoardDimensions(board);
  selectedIds.clear();
  setView("board");
  if (updateUrl) history.pushState({}, "", `${location.pathname}?board=${encodeURIComponent(board.id)}`);
  document.title = `${board.name} · 拾作`;
  boardNameEl.value = board.name;
  renderAllItems();
  setZoom(board.viewport?.zoom || 1, false);
  resetHistory();
  requestAnimationFrame(() => {
    viewportEl.scrollLeft = Number(board.viewport?.scrollLeft) || 0;
    viewportEl.scrollTop = Number(board.viewport?.scrollTop) || 0;
    updateMinimapViewport();
  });
}

function pastedImageSource(clipboardData) {
  const html = clipboardData?.getData("text/html");
  if (!html) return "";
  const parsed = new DOMParser().parseFromString(html, "text/html");
  return parsed.querySelector("img")?.getAttribute("src") || "";
}

async function addClipboardToInbox(event) {
  const imageFiles = [...(event.clipboardData?.items || [])]
    .filter(item => item.type.startsWith("image/"))
    .map(item => item.getAsFile())
    .filter(Boolean);
  if (imageFiles.length) {
    for (const file of imageFiles) {
      const src = await readFileAsDataUrl(file);
      await db.addItem(db.INBOX_ID, { type: "image", src, alt: file.name });
    }
    return true;
  }
  const imageSrc = pastedImageSource(event.clipboardData);
  if (imageSrc) {
    await db.addItem(db.INBOX_ID, { type: "image", src: imageSrc });
    return true;
  }
  const text = event.clipboardData?.getData("text/plain")?.trim();
  if (text) {
    await db.addItem(db.INBOX_ID, { type: "text", text });
    return true;
  }
  return false;
}

function isEditableClipboardTarget(target) {
  return Boolean(target?.closest?.(
    'input,textarea,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'
  ));
}

async function handlePaste(event) {
  // 输入框、文档/代码编辑器和 xterm 的隐藏 textarea 必须优先使用浏览器原生粘贴。
  // 只有焦点位于非编辑区域时，拾作才把剪贴板内容转换成白板卡片。
  if (isEditableClipboardTarget(event.target)) return;
  if (!currentBoard) {
    if (await addClipboardToInbox(event)) {
      event.preventDefault();
      await renderHome(false);
    }
    return;
  }
  const internal = event.clipboardData?.getData(CLIPBOARD_TYPE);
  if (internal) {
    event.preventDefault();
    try {
      const copied = JSON.parse(internal);
      const groupMap = new Map();
      const idMap = new Map(copied.map(item => [String(item.id), db.makeId()]));
      copied.forEach((item, index) => {
        const groupId = item.groupId
          ? groupMap.get(item.groupId) || db.makeId("group")
          : "";
        if (item.groupId) groupMap.set(item.groupId, groupId);
        addBoardItem({
          ...item,
          id: idMap.get(String(item.id)),
          x: item.x + 34 + index * 3,
          y: item.y + 34 + index * 3,
          groupId,
          terminalSessionId: item.type === "terminal" ? "" : item.terminalSessionId,
          terminalStatus: item.type === "terminal" ? "closed" : item.terminalStatus,
          taskSourceIds: (item.taskSourceIds || []).map(id => idMap.get(String(id)) || String(id)),
          relationSourceIds: (item.relationSourceIds || []).map(id => idMap.get(String(id)) || String(id)),
          card: item.card ? {
            ...item.card,
            inputs: (item.card.inputs || []).map(connection => ({
              ...connection,
              id: db.makeId("connection"),
              sourceId: idMap.get(String(connection.sourceId)) || String(connection.sourceId),
              targetId: idMap.get(String(connection.targetId)) || idMap.get(String(item.id))
            }))
          } : undefined
        });
      });
      return;
    } catch (_) { /* fall through to normal clipboard content */ }
  }
  const imageFiles = [...(event.clipboardData?.items || [])]
    .filter(item => item.type.startsWith("image/"))
    .map(item => item.getAsFile())
    .filter(Boolean);
  if (imageFiles.length) {
    event.preventDefault();
    await addImageFiles(imageFiles);
    return;
  }
  const imageSrc = pastedImageSource(event.clipboardData);
  if (imageSrc) {
    event.preventDefault();
    await addImageSource(imageSrc);
    return;
  }
  const text = event.clipboardData?.getData("text/plain") || "";
  if (text) {
    event.preventDefault();
    if (/^https?:\/\/\S+$/i.test(text.trim())) addLinkItem(text.trim());
    else addTextItem(text);
  }
}

function handleCopy(event) {
  const selection = window.getSelection();
  const selectedText = selection && !selection.isCollapsed ? selection.toString() : "";
  const editingText = isEditableClipboardTarget(event.target);
  if (editingText) return;
  // 显式覆盖拾作自定义卡片格式，避免文字复制后再次粘贴时仍命中整卡片数据。
  if (selectedText) {
    event.clipboardData.clearData();
    event.clipboardData.setData("text/plain", selectedText);
    event.preventDefault();
    return;
  }
  if (!currentBoard || !selectedIds.size || editingText) return;
  const copied = boardItems.filter(item => selectedIds.has(item.id));
  event.clipboardData.setData(CLIPBOARD_TYPE, JSON.stringify(copied));
  event.clipboardData.setData("text/plain", copied.map(itemLabel).join("\n\n"));
  event.preventDefault();
  setStatus(`已复制 ${copied.length} 项`);
}

function startMarquee(event) {
  if (event.button !== 0 || event.target !== boardEl || spacePressed) return;
  event.preventDefault();
  const pointerId = event.pointerId;
  const start = boardPointFromEvent(event);
  const startClient = { x: event.clientX, y: event.clientY };
  const baseSelection = event.shiftKey ? new Set(selectedIds) : new Set();
  let dragging = false;
  boardEl.setPointerCapture(event.pointerId);
  const move = moveEvent => {
    if (!boardEl.hasPointerCapture(moveEvent.pointerId)) return;
    if (!dragging) {
      const distance = Math.hypot(
        moveEvent.clientX - startClient.x,
        moveEvent.clientY - startClient.y
      );
      if (distance < MARQUEE_DRAG_THRESHOLD_PX) return;
      dragging = true;
      marqueeEl.classList.remove("hidden");
    }
    const end = boardPointFromEvent(moveEvent);
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const right = Math.max(start.x, end.x);
    const bottom = Math.max(start.y, end.y);
    marqueeEl.style.left = `${left * zoom}px`;
    marqueeEl.style.top = `${top * zoom}px`;
    marqueeEl.style.width = `${(right - left) * zoom}px`;
    marqueeEl.style.height = `${(bottom - top) * zoom}px`;
    const matches = boardItems
      .filter(item => item.x < right && item.x + item.width > left && item.y < bottom && item.y + item.height > top)
      .map(item => item.id);
    selectItems([...new Set([...baseSelection, ...matches])]);
  };
  const finish = finishEvent => {
    if (finishEvent?.pointerId !== undefined && finishEvent.pointerId !== pointerId) return;
    marqueeEl.classList.add("hidden");
    marqueeEl.removeAttribute("style");
    boardEl.removeEventListener("pointermove", move);
    boardEl.removeEventListener("pointerup", finish);
    boardEl.removeEventListener("pointercancel", finish);
    boardEl.removeEventListener("lostpointercapture", finish);
    window.removeEventListener("blur", finish);
    document.removeEventListener("visibilitychange", finish);
    if (boardEl.hasPointerCapture(pointerId)) boardEl.releasePointerCapture(pointerId);
  };
  boardEl.addEventListener("pointermove", move);
  boardEl.addEventListener("pointerup", finish);
  boardEl.addEventListener("pointercancel", finish);
  boardEl.addEventListener("lostpointercapture", finish);
  window.addEventListener("blur", finish);
  document.addEventListener("visibilitychange", finish);
  if (!event.shiftKey) selectItems([]);
}

function setupPanning() {
  let pan;
  viewportEl.addEventListener("pointerdown", event => {
    if (!(event.button === 1 || (event.button === 0 && spacePressed))) return;
    event.preventDefault();
    event.stopPropagation();
    pan = {
      clientX: event.clientX,
      clientY: event.clientY,
      scrollLeft: viewportEl.scrollLeft,
      scrollTop: viewportEl.scrollTop
    };
    viewportEl.setPointerCapture(event.pointerId);
  }, true);
  viewportEl.addEventListener("pointermove", event => {
    if (!pan || !viewportEl.hasPointerCapture(event.pointerId)) return;
    let nextLeft = pan.scrollLeft - (event.clientX - pan.clientX);
    let nextTop = pan.scrollTop - (event.clientY - pan.clientY);
    const edge = 80;
    if (nextLeft < edge && event.clientX > pan.clientX) {
      prependBoardSpace(BOARD_EXPANSION_STEP, 0);
      pan.scrollLeft += BOARD_EXPANSION_STEP * zoom;
      nextLeft += BOARD_EXPANSION_STEP * zoom;
    }
    if (nextTop < edge && event.clientY > pan.clientY) {
      prependBoardSpace(0, BOARD_EXPANSION_STEP);
      pan.scrollTop += BOARD_EXPANSION_STEP * zoom;
      nextTop += BOARD_EXPANSION_STEP * zoom;
    }
    let expanded = false;
    while (nextLeft + viewportEl.clientWidth > boardWidth * zoom - edge) {
      boardWidth += BOARD_EXPANSION_STEP;
      expanded = true;
    }
    while (nextTop + viewportEl.clientHeight > boardHeight * zoom - edge) {
      boardHeight += BOARD_EXPANSION_STEP;
      expanded = true;
    }
    if (expanded) applyBoardDimensions();
    viewportEl.scrollLeft = nextLeft;
    viewportEl.scrollTop = nextTop;
    scheduleConnectionRender();
    renderMinimap();
  });
  const finish = event => {
    if (!pan || !viewportEl.hasPointerCapture(event.pointerId)) return;
    viewportEl.releasePointerCapture(event.pointerId);
    pan = undefined;
    scheduleSave();
  };
  viewportEl.addEventListener("pointerup", finish);
  viewportEl.addEventListener("pointercancel", finish);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportCurrentBoard() {
  await flushSave();
  const board = await db.getBoard(currentBoard.id);
  const payload = { kind: "pagedock-board", version: 1, exportedAt: Date.now(), board };
  downloadBlob(
    new Blob([JSON.stringify(payload)], { type: "application/json" }),
    `${safeFilename(board.name)}-${timestamp()}.pagedock`
  );
  setStatus("已导出当前白板");
}

async function backupAllBoards() {
  await flushSave();
  const payload = await db.exportAll();
  downloadBlob(
    new Blob([JSON.stringify(payload)], { type: "application/json" }),
    `拾作-backup-${timestamp()}.pagedock`
  );
  setStatus("已备份全部白板");
}

function wrapCanvasText(context, text, x, y, maxWidth, lineHeight, maxLines) {
  const paragraphs = String(text || "").split(/\n/);
  let lineCount = 0;
  for (const paragraph of paragraphs) {
    let line = "";
    for (const character of paragraph) {
      const next = line + character;
      if (line && context.measureText(next).width > maxWidth) {
        context.fillText(line, x, y + lineCount * lineHeight);
        lineCount += 1;
        if (lineCount >= maxLines) return;
        line = character;
      } else {
        line = next;
      }
    }
    context.fillText(line, x, y + lineCount * lineHeight);
    lineCount += 1;
    if (lineCount >= maxLines) return;
  }
}

function loadCanvasImage(src) {
  return new Promise(resolve => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

async function renderBoardCanvas() {
  if (!boardItems.length) throw new Error("当前白板没有可导出的内容");
  const minX = Math.max(0, Math.min(...boardItems.map(item => item.x)) - 48);
  const minY = Math.max(0, Math.min(...boardItems.map(item => item.y)) - 48);
  const maxX = Math.max(...boardItems.map(item => item.x + item.width)) + 48;
  const maxY = Math.max(...boardItems.map(item => item.y + item.height)) + 48;
  const sourceWidth = Math.max(1, maxX - minX);
  const sourceHeight = Math.max(1, maxY - minY);
  const exportScale = Math.min(2, 12000 / sourceWidth, 12000 / sourceHeight, Math.sqrt(40000000 / (sourceWidth * sourceHeight)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * exportScale));
  canvas.height = Math.max(1, Math.round(sourceHeight * exportScale));
  const context = canvas.getContext("2d", { alpha: false });
  context.scale(exportScale, exportScale);
  context.fillStyle = "#171a1e";
  context.fillRect(0, 0, sourceWidth, sourceHeight);
  context.strokeStyle = "#2d333c";
  context.lineWidth = 1;
  for (let x = 0; x < sourceWidth; x += 24) {
    for (let y = 0; y < sourceHeight; y += 24) {
      context.beginPath();
      context.arc(x, y, 1, 0, Math.PI * 2);
      context.fillStyle = "#343b45";
      context.fill();
    }
  }
  context.save();
  context.strokeStyle = "#d98f7e";
  context.fillStyle = "#d98f7e";
  context.lineWidth = 2;
  context.globalAlpha = .72;
  for (const { source, target } of relationEdges()) {
    const geometry = relationGeometry(source, target);
    const startX = geometry.start.x - minX;
    const startY = geometry.start.y - minY;
    const endX = geometry.end.x - minX;
    const endY = geometry.end.y - minY;
    const control1X = geometry.control1.x - minX;
    const control1Y = geometry.control1.y - minY;
    const control2X = geometry.control2.x - minX;
    const control2Y = geometry.control2.y - minY;
    context.beginPath();
    context.moveTo(startX, startY);
    context.bezierCurveTo(control1X, control1Y, control2X, control2Y, endX, endY);
    context.stroke();
    const angle = Math.atan2(endY - control2Y, endX - control2X);
    context.beginPath();
    context.moveTo(endX, endY);
    context.lineTo(endX - 10 * Math.cos(angle - Math.PI / 6), endY - 10 * Math.sin(angle - Math.PI / 6));
    context.lineTo(endX - 10 * Math.cos(angle + Math.PI / 6), endY - 10 * Math.sin(angle + Math.PI / 6));
    context.closePath();
    context.fill();
  }
  context.restore();
  const ordered = [...boardItems].sort((left, right) => left.z - right.z);
  for (const item of ordered) {
    const x = item.x - minX;
    const y = item.y - minY;
    context.fillStyle = "#22262c";
    context.strokeStyle = "#424a55";
    context.lineWidth = 1;
    context.fillRect(x, y, item.width, item.height);
    context.strokeRect(x, y, item.width, item.height);
    context.fillStyle = "#292e35";
    context.fillRect(x, y, item.width, 30);
    context.fillStyle = "#9aa4b1";
    context.font = "11px sans-serif";
    context.fillText(itemTypeLabel(item), x + 10, y + 20);
    if (item.type === "image") {
      const image = await loadCanvasImage(item.src);
      if (image) {
        const contentHeight = Math.max(30, item.height - 40 - (item.source ? 24 : 0));
        const scale = Math.min((item.width - 20) / image.naturalWidth, contentHeight / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        context.drawImage(image, x + (item.width - width) / 2, y + 36 + (contentHeight - height) / 2, width, height);
      } else {
        context.fillStyle = "#818b98";
        context.fillText("图片无法离线导出", x + 16, y + 58);
      }
    } else if (item.type === "video") {
      context.fillStyle = "#15191f";
      context.fillRect(x + 10, y + 40, item.width - 20, Math.max(80, item.height - 60));
      context.fillStyle = "#77b7ff";
      context.font = "28px sans-serif";
      context.fillText("▶", x + item.width / 2 - 12, y + item.height / 2);
      context.fillStyle = "#aeb8c5";
      context.font = "12px sans-serif";
      context.fillText("视频请在拾作白板中播放", x + 16, y + item.height - 18);
    } else if (item.type === "page") {
      context.fillStyle = "#f7f3ed";
      context.fillRect(x + 10, y + 40, item.width - 20, Math.max(80, item.height - 60));
      context.fillStyle = "#77b7ff";
      context.font = "14px sans-serif";
      wrapCanvasText(context, item.src, x + 18, y + 64, item.width - 36, 21, 3);
      context.fillStyle = "#68727f";
      context.font = "12px sans-serif";
      context.fillText("网页请在拾作白板中浏览", x + 18, y + 128);
    } else if (item.type === "terminal") {
      context.fillStyle = "#211d1a";
      context.fillRect(x + 10, y + 40, item.width - 20, Math.max(80, item.height - 60));
      context.fillStyle = "#f7eee6";
      context.font = "11px monospace";
      wrapCanvasText(
        context,
        String(item.terminalOutput || `$ ${item.text || ""}`).slice(-6_000),
        x + 18,
        y + 62,
        item.width - 36,
        17,
        Math.max(1, Math.floor((item.height - 82) / 17))
      );
    } else if (["document", "code"].includes(item.type)) {
      if (item.type === "code") {
        context.fillStyle = "#211d1a";
        context.fillRect(x + 10, y + 40, item.width - 20, Math.max(80, item.height - 60));
      }
      context.fillStyle = item.type === "code" ? "#f7eee6" : "#e3e8ee";
      context.font = item.type === "code" ? "11px monospace" : "13px sans-serif";
      wrapCanvasText(
        context,
        String(item.text || ""),
        x + 16,
        y + 54,
        item.width - 32,
        item.type === "code" ? 17 : 21,
        Math.max(1, Math.floor((item.height - 68) / (item.type === "code" ? 17 : 21)))
      );
    } else if (["file", "folder"].includes(item.type)) {
      context.fillStyle = "#e3e8ee";
      context.font = "600 13px sans-serif";
      context.fillText(item.localName || itemTypeLabel(item), x + 16, y + 54);
      context.fillStyle = "#aeb8c5";
      context.font = "11px monospace";
      wrapCanvasText(
        context,
        cardTextOutput(item),
        x + 16,
        y + 78,
        item.width - 32,
        17,
        Math.max(1, Math.floor((item.height - 92) / 17))
      );
    } else {
      context.fillStyle = item.type === "link" ? "#77b7ff" : "#e3e8ee";
      context.font = item.type === "link" ? "14px sans-serif" : "13px sans-serif";
      wrapCanvasText(context, itemLabel(item), x + 16, y + 52, item.width - 32, 21, Math.max(1, Math.floor((item.height - 52) / 21)));
    }
    if (item.source?.url) {
      context.fillStyle = "#778391";
      context.font = "10px sans-serif";
      context.fillText(`来源：${item.source.title || item.source.url}`.slice(0, 90), x + 12, y + item.height - 10);
    }
  }
  return canvas;
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("画布导出失败")), type, quality);
  });
}

function buildJpegPdf(jpegBytes, pixelWidth, pixelHeight) {
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let length = 0;
  const add = bytes => { chunks.push(bytes); length += bytes.byteLength; };
  const text = value => add(encoder.encode(value));
  const object = (id, parts) => {
    offsets[id] = length;
    text(`${id} 0 obj\n`);
    parts.forEach(part => typeof part === "string" ? text(part) : add(part));
    text("\nendobj\n");
  };
  text("%PDF-1.7\n%Shizuo\n");
  const pageScale = Math.min(0.75, 14000 / pixelWidth, 14000 / pixelHeight);
  const width = Number((pixelWidth * pageScale).toFixed(3));
  const height = Number((pixelHeight * pageScale).toFixed(3));
  const content = encoder.encode(`q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`);
  object(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  object(2, ["<< /Type /Pages /Count 1 /Kids [3 0 R] >>"]);
  object(3, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`]);
  object(4, [`<< /Length ${content.byteLength} >>\nstream\n`, content, "endstream"]);
  object(5, [`<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.byteLength} >>\nstream\n`, jpegBytes, "\nendstream"]);
  const xref = length;
  text("xref\n0 6\n0000000000 65535 f \n");
  for (let id = 1; id <= 5; id += 1) text(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  text(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks, { type: "application/pdf" });
}

async function exportBoardImage(type) {
  setStatus(type === "png" ? "正在生成 PNG…" : "正在生成 PDF…");
  try {
    const canvas = await renderBoardCanvas();
    if (type === "png") {
      downloadBlob(await canvasBlob(canvas, "image/png"), `${safeFilename(currentBoard.name)}-${timestamp()}.png`);
    } else {
      const jpeg = await canvasBlob(canvas, "image/jpeg", .94);
      const pdf = buildJpegPdf(new Uint8Array(await jpeg.arrayBuffer()), canvas.width, canvas.height);
      downloadBlob(pdf, `${safeFilename(currentBoard.name)}-${timestamp()}.pdf`);
    }
    setStatus(`已导出 ${type.toUpperCase()}`);
  } catch (error) {
    console.error("[pagedock-export] failed", error);
    setStatus(error?.message || "导出失败", true);
  }
}

async function importSelectedFile() {
  const file = importInputEl.files?.[0];
  importInputEl.value = "";
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const imported = await db.importData(payload);
    notifyDataChanged(imported.map(board => board.id), "import-boards");
    if (imported.length === 1) await openBoard(imported[0].id);
    else await renderHome();
    setStatus(`已导入 ${imported.length} 个白板`);
  } catch (error) {
    console.error("[pagedock-import] failed", error);
    setStatus(error?.message || "导入失败，请检查文件后重试", true);
  }
}

async function deleteCurrentBoard() {
  if (!currentBoard || currentBoard.id === db.INBOX_ID) {
    setStatus("收件箱不能删除", true);
    return;
  }
  if (!confirm(`确定删除“${currentBoard.name}”吗？此操作无法撤销。`)) return;
  await db.deleteBoard(currentBoard.id);
  notifyDataChanged([currentBoard.id], "delete-board");
  await renderHome();
}

function wireEvents() {
  const transientMenus = [addMenuEl, exportMenuEl, homeMoreMenuEl, selectionMoreMenuEl];
  transientMenus.forEach(menu => {
    menu.addEventListener("toggle", () => {
      if (!menu.open) return;
      for (const other of transientMenus) {
        if (other !== menu) other.open = false;
      }
      if (menu === selectionMoreMenuEl) requestAnimationFrame(positionSelectionActions);
    });
  });
  document.addEventListener("pointerdown", event => {
    if (event.target.closest?.("details.menu")) return;
    transientMenus.forEach(menu => { menu.open = false; });
  }, true);
  codexChatLauncherEl.addEventListener("click", () => {
    setCodexChatOpen(true);
    if (!codexChatReady) connectCodexChat();
  });
  document.getElementById("codexChatClose").addEventListener("click", () => setCodexChatOpen(false));
  codexChatNewEl.addEventListener("click", () => {
    if (codexChatTask) return;
    codexChatMessages = [];
    localPluginCodexTaskStatus = undefined;
    renderExternalCollaboration();
    renderCodexChatMessages();
    persistCodexChatMessages().catch(error => {
      console.warn("[pagedock-codex-chat] clear history failed", error);
    });
    setCodexChatStatus(codexChatReady ? "新会话 · 已连接" : "新会话 · 未连接", codexChatReady ? "success" : "error");
    codexChatInputEl.focus();
  });
  codexChatSendEl.addEventListener("click", sendCodexChatMessage);
  codexChatInputEl.addEventListener("input", () => {
    resizeCodexChatInput();
    updateCodexChatControls();
  });
  resizeCodexChatInput();
  codexChatInputEl.addEventListener("keydown", event => {
    if (event.key === "Escape") setCodexChatOpen(false);
    if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    sendCodexChatMessage();
  });
  codexChatStopEl.addEventListener("click", () => {
    const task = codexChatTask;
    if (!task || task.cancelRequested) return;
    task.cancelRequested = true;
    task.progressBeforeCancel = task.progressText;
    updateCodexChatProgress(task, "正在停止本地任务…");
    updateCodexChatControls();
    chrome.runtime.sendMessage({ type: CODEX_CANCEL_REQUEST, id: task.id })
      .then(response => {
        if (!response?.ok) throw new Error(response?.error || "停止会话失败");
        if (codexChatTask?.id === task.id && response.activeTaskId !== task.id) {
          stopCodexChatProgress(task);
          codexChatTask = undefined;
          syncLocalPluginCodexTask(task, "cancelled", { message: "任务已停止" });
          renderCodexChatMessages();
          setCodexChatStatus("已停止 · 可继续提问");
          updateCodexChatControls();
          updateSelectionUi();
        }
      })
      .catch(error => {
        if (codexChatTask?.id === task.id) {
          task.cancelRequested = false;
          updateCodexChatProgress(task, task.progressBeforeCancel || "Codex 正在处理…");
          setCodexChatStatus(error?.message || "停止会话失败", "error");
          updateCodexChatControls();
        }
      });
  });
  shareBridgeButtonEl.addEventListener("click", createBridgeShare);
  const setCollaborationPanelOpen = open => {
    collaborationPanelDismissed = !open;
    sessionStorage.setItem("__pagedock_collaboration_closed__", open ? "0" : "1");
    renderExternalCollaboration();
  };
  collaborationCloseEl.addEventListener("click", () => setCollaborationPanelOpen(false));
  boardCollaborationEl.addEventListener("click", () => {
    exportMenuEl.open = false;
    setCollaborationPanelOpen(collaborationPanelEl.hidden);
  });
  homeCollaborationEl.addEventListener("click", () => {
    homeMoreMenuEl.open = false;
    setCollaborationPanelOpen(collaborationPanelEl.hidden);
  });
  collaborationSessionsEl.addEventListener("toggle", () => {
    if (collaborationSessionsEl.open) void loadLocalCodexSessions(true);
  });
  codexSessionBackEl.addEventListener("click", closeLocalCodexSessionPreview);
  copyBridgeShareEl.addEventListener("click", async () => {
    if (!shareBridgeTextEl.value) return;
    try {
      await copyTaskAnswer(shareBridgeTextEl.value);
      setBridgeShareDialogStatus("协作链接已复制");
    } catch (error) {
      setBridgeShareDialogStatus(error?.message || "复制失败，请手动复制", "error");
    }
  });
  copyCodexShareEl.addEventListener("click", async () => {
    if (!shareCodexTextEl.value) return;
    try {
      await copyTaskAnswer(shareCodexTextEl.value);
      setBridgeShareDialogStatus("Codex 接入指令已复制");
    } catch (error) {
      setBridgeShareDialogStatus(error?.message || "复制失败，请手动复制", "error");
    }
  });
  stopBridgeShareEl.addEventListener("click", stopBridgeShare);
  document.getElementById("closeBridgeShare").addEventListener("click", () => shareBridgeDialogEl.close());
  shareBridgeDialogEl.addEventListener("click", closeDialogFromBackdrop);
  workflowTemplateDialogEl.addEventListener("click", closeDialogFromBackdrop);
  versionHistoryDialogEl.addEventListener("click", closeDialogFromBackdrop);
  healthCheckDialogEl.addEventListener("click", closeDialogFromBackdrop);
  taskScheduleDialogEl.addEventListener("click", closeDialogFromBackdrop);
  provenanceDialogEl.addEventListener("click", closeDialogFromBackdrop);
  document.getElementById("closeWorkflowTemplates").addEventListener("click", () => workflowTemplateDialogEl.close());
  document.getElementById("closeVersionHistory").addEventListener("click", () => versionHistoryDialogEl.close());
  document.getElementById("closeHealthCheck").addEventListener("click", () => healthCheckDialogEl.close());
  document.getElementById("cancelTaskSchedule").addEventListener("click", () => taskScheduleDialogEl.close());
  document.getElementById("closeProvenance").addEventListener("click", () => provenanceDialogEl.close());
  document.getElementById("taskScheduleForm").addEventListener("submit", event => {
    event.preventDefault();
    const item = itemById(scheduledTaskItemId);
    const nextRunAt = new Date(taskScheduleAtEl.value).getTime();
    const prompt = String(item?.text || [...(item?.taskMessages || [])].reverse().find(message => message.role === "user")?.text || "").trim();
    if (!prompt) {
      setStatus("请先填写任务内容，再设置定时执行", true);
      return;
    }
    if (!item || !Number.isFinite(nextRunAt) || nextRunAt <= Date.now()) {
      setStatus("请选择未来的执行时间", true);
      return;
    }
    const previous = PageDockBoardDomain.normalizeTaskSchedule(item.taskSchedule);
    persistTaskSchedule(item, {
      ...previous,
      enabled: true,
      repeat: taskScheduleRepeatEl.value,
      execution: item.taskWorkflowRole === "controller" ? "workflow" : taskScheduleExecutionEl.value,
      nextRunAt,
      retryAt: 0,
      lastStatus: "",
      lastError: ""
    }).then(() => {
      taskScheduleDialogEl.close();
      setStatus(`已设置${taskScheduleLabel(item.taskSchedule)}`);
    }).catch(error => setStatus(error?.message || "定时设置失败", true));
  });
  clearTaskScheduleEl.addEventListener("click", () => {
    const item = itemById(scheduledTaskItemId);
    if (!item) return;
    persistTaskSchedule(item, null).then(() => {
      taskScheduleDialogEl.close();
      setStatus("已取消定时执行");
    }).catch(error => setStatus(error?.message || "取消定时失败", true));
  });
  document.getElementById("confirmSaveWorkflowTemplate").addEventListener("click", () => {
    saveCurrentWorkflowTemplate().catch(error => setStatus(error?.message || "模板保存失败", true));
  });
  document.getElementById("runWorkflow").addEventListener("click", runCurrentWorkflow);
  document.getElementById("rerunHealthCheck").addEventListener("click", runHealthCheck);
  document.getElementById("homeButton").addEventListener("click", () => renderHome());
  document.getElementById("backBoards").addEventListener("click", () => renderHome());
  document.getElementById("newBoard").addEventListener("click", openCreateBoardDialog);
  document.getElementById("journeyCapture").addEventListener("click", () => {
    console.info("[pagedock-onboarding] quick capture selected");
    quickTextEl.focus();
    quickTextEl.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  document.getElementById("journeyCreateBoard").addEventListener("click", () => {
    console.info("[pagedock-onboarding] first board selected");
    openCreateBoardDialog();
  });
  document.getElementById("cancelNewBoard").addEventListener("click", () => newBoardDialogEl.close());
  newBoardDialogEl.addEventListener("click", closeDialogFromBackdrop);
  pageDialogEl.addEventListener("click", closeDialogFromBackdrop);
  document.getElementById("newBoardForm").addEventListener("submit", async event => {
    event.preventDefault();
    const name = newBoardNameEl.value.trim();
    if (!name) {
      newBoardNameEl.setCustomValidity("请输入白板名称");
      newBoardNameEl.reportValidity();
      return;
    }
    newBoardNameEl.setCustomValidity("");
    try {
      const board = await db.createBoard(name);
      notifyDataChanged([board.id], "create-board");
      newBoardDialogEl.close();
      await openBoard(board.id);
    } catch (error) {
      setStatus(error?.message || "白板创建失败", true);
    }
  });
  newBoardNameEl.addEventListener("input", () => newBoardNameEl.setCustomValidity(""));
  document.getElementById("cancelPage").addEventListener("click", () => pageDialogEl.close());
  document.getElementById("pageForm").addEventListener("submit", event => {
    event.preventDefault();
    try {
      addPageItem(pageUrlEl.value, insertionPoint());
      pageUrlEl.setCustomValidity("");
      pageDialogEl.close();
    } catch (error) {
      pageUrlEl.setCustomValidity(error.message || "网页地址无效");
      pageUrlEl.reportValidity();
    }
  });
  pageUrlEl.addEventListener("input", () => pageUrlEl.setCustomValidity(""));
  document.getElementById("openInbox").addEventListener("click", () => openBoard(db.INBOX_ID));
  homeSearchEl.addEventListener("input", scheduleHomeFilter);
  document.getElementById("quickAdd").addEventListener("click", async () => {
    const text = quickTextEl.value.trim();
    if (!text) return;
    const button = document.getElementById("quickAdd");
    const firstRun = document.body.dataset.onboarding === "first-run";
    button.disabled = true;
    button.dataset.state = "loading";
    button.textContent = "保存中…";
    try {
      const savedItem = await db.addItem(db.INBOX_ID, { type: /^https?:\/\/\S+$/i.test(text) ? "link" : "text", text, src: /^https?:\/\//i.test(text) ? text : "" });
      quickTextEl.value = "";
      await finishHomeCapture([savedItem], firstRun, "已保存到收件箱");
    } catch (error) {
      setStatus(error?.message || "内容未能保存到收件箱", true);
    } finally {
      button.disabled = false;
      button.dataset.state = "default";
      button.textContent = firstRun ? "开始整理" : "存入收件箱";
    }
  });
  quickTextEl.addEventListener("keydown", event => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    document.getElementById("quickAdd").click();
  });
  quickTextEl.addEventListener("paste", event => {
    const imageFiles = [...(event.clipboardData?.items || [])]
      .filter(item => item.type.startsWith("image/"))
      .map(item => item.getAsFile())
      .filter(Boolean);
    if (!imageFiles.length) return;
    event.preventDefault();
    captureHomeImages(imageFiles);
  });
  quickCaptureWrapEl.addEventListener("dragover", event => {
    if (![...(event.dataTransfer?.items || [])].some(item => item.type.startsWith("image/"))) return;
    event.preventDefault();
    quickCaptureWrapEl.dataset.dragging = "true";
  });
  quickCaptureWrapEl.addEventListener("dragleave", event => {
    if (!quickCaptureWrapEl.contains(event.relatedTarget)) delete quickCaptureWrapEl.dataset.dragging;
  });
  quickCaptureWrapEl.addEventListener("drop", event => {
    delete quickCaptureWrapEl.dataset.dragging;
    const imageFiles = [...(event.dataTransfer?.files || [])].filter(file => file.type.startsWith("image/"));
    if (!imageFiles.length) return;
    event.preventDefault();
    captureHomeImages(imageFiles);
  });
  document.getElementById("emptyAddText").addEventListener("click", () => {
    console.info("[pagedock-onboarding] empty board text selected", { boardId: currentBoard?.id });
    addTextItem("", insertionPoint(), true);
  });
  document.getElementById("emptyAddImage").addEventListener("click", () => {
    console.info("[pagedock-onboarding] empty board image selected", { boardId: currentBoard?.id });
    imageInputEl.click();
  });
  document.getElementById("emptyAddTask").addEventListener("click", () => {
    console.info("[pagedock-onboarding] empty board task selected", { boardId: currentBoard?.id });
    addTaskItem(taskInsertionPoint());
  });
  document.getElementById("addText").addEventListener("click", () => {
    addMenuEl.open = false;
    addTextItem("", insertionPoint(), true);
  });
  document.getElementById("addDocument").addEventListener("click", () => {
    addMenuEl.open = false;
    addDocumentItem(insertionPoint());
  });
  document.getElementById("addCode").addEventListener("click", () => {
    addMenuEl.open = false;
    addCodeItem(insertionPoint());
  });
  document.getElementById("addImage").addEventListener("click", () => {
    addMenuEl.open = false;
    imageInputEl.click();
  });
  document.getElementById("addFile").addEventListener("click", async () => {
    addMenuEl.open = false;
    try { await chooseLocalCard("file"); } catch (error) {
      if (error?.name !== "AbortError") setStatus(error?.message || "添加文件失败", true);
    }
  });
  document.getElementById("addFolder").addEventListener("click", async () => {
    addMenuEl.open = false;
    try { await chooseLocalCard("folder"); } catch (error) {
      if (error?.name !== "AbortError") setStatus(error?.message || "添加文件夹失败", true);
    }
  });
  document.getElementById("addPage").addEventListener("click", () => {
    addMenuEl.open = false;
    openPageDialog();
  });
  document.getElementById("addTerminal").addEventListener("click", () => {
    addMenuEl.open = false;
    addTerminalItem(insertionPoint());
  });
  document.getElementById("addTask").addEventListener("click", () => {
    addMenuEl.open = false;
    addTaskItem(taskInsertionPoint());
  });
  imageInputEl.addEventListener("change", async () => {
    await addImageFiles([...imageInputEl.files]);
    imageInputEl.value = "";
  });
  localFileInputEl.addEventListener("change", async () => {
    const file = localFileInputEl.files?.[0];
    if (!file) return;
    const draft = await snapshotFileForCard(file);
    draft.card = cardProtocol.normalizeMeta(draft);
    cardProtocol.grant(draft, "local-file-read");
    const target = itemById(localRelinkTargetId);
    if (target?.type === "file") {
      Object.assign(target, draft, { localHandleId: "", updatedAt: Date.now() });
      updateLocalCardElement(target);
      scheduleSave();
    } else {
      const point = insertionPoint();
      addBoardItem({ ...draft, x: point.x, y: point.y, width: 480, height: 320 });
    }
    localRelinkTargetId = "";
    localFileInputEl.value = "";
  });
  localFolderInputEl.addEventListener("change", () => {
    const files = [...(localFolderInputEl.files || [])];
    if (!files.length) return;
    const root = files[0].webkitRelativePath?.split("/")[0] || "文件夹";
    const draft = {
      type: "folder",
      localName: root,
      localKind: "directory",
      localPermissionState: "granted",
      localEntries: files.slice(0, 200).map(file => ({ name: file.webkitRelativePath || file.name, kind: "file" }))
    };
    draft.card = cardProtocol.normalizeMeta(draft);
    cardProtocol.grant(draft, "local-folder-read");
    const target = itemById(localRelinkTargetId);
    if (target?.type === "folder") {
      Object.assign(target, draft, { localHandleId: "", updatedAt: Date.now() });
      updateLocalCardElement(target);
      scheduleSave();
    } else {
      const point = insertionPoint();
      addBoardItem({ ...draft, x: point.x, y: point.y, width: 440, height: 360 });
    }
    localRelinkTargetId = "";
    localFolderInputEl.value = "";
  });
  document.getElementById("undo").addEventListener("click", () => applyHistory(historyIndex - 1));
  document.getElementById("redo").addEventListener("click", () => applyHistory(historyIndex + 1));
  optimizeLayoutEl.addEventListener("click", () => {
    exportMenuEl.open = false;
    optimizeBoardLayout();
  });
  askSelectionWithCodexEl.addEventListener("click", createSelectionCodexTask);
  extractKnowledgeCardEl.addEventListener("click", extractKnowledgeCardFromSelection);
  codexSelectionClearEl.addEventListener("click", () => {
    if (codexChatTask) return;
    codexAttachedSelectionIds = [];
    codexAttachedPage = undefined;
    updateCodexSelectionContext();
  });
  document.getElementById("alignLeft").addEventListener("click", () => {
    document.getElementById("selectionMoreMenu").open = false;
    alignSelection("x");
  });
  document.getElementById("alignTop").addEventListener("click", () => {
    document.getElementById("selectionMoreMenu").open = false;
    alignSelection("y");
  });
  document.getElementById("connectItems").addEventListener("click", () => {
    document.getElementById("selectionMoreMenu").open = false;
    connectSelectedItems();
  });
  document.getElementById("groupItems").addEventListener("click", () => {
    document.getElementById("selectionMoreMenu").open = false;
    groupSelection();
  });
  document.getElementById("ungroupItems").addEventListener("click", () => {
    document.getElementById("selectionMoreMenu").open = false;
    ungroupSelection();
  });
  summarizeSelectionTextEl.addEventListener("click", () => {
    if (codexAttachedPage?.content) {
      codexChatInputEl.value = "请总结当前网页：先给出一句话结论，再列出关键观点、重要数据和可执行事项。不要遗漏正文后半部分。";
      resizeCodexChatInput();
      sendCodexChatMessage();
      return;
    }
    runWhiteboardCodex("text");
  });
  summarizeSelectionImagesEl.addEventListener("click", () => runWhiteboardCodex("image"));
  summarizeSelectionVideoEl.addEventListener("click", () => runWhiteboardCodex("video", null, { videoEngine: selectionVideoEngineEl.value }));
  selectionAiCancelEl.addEventListener("click", () => {
    cancelWhiteboardTask(standaloneWhiteboardTask());
  });
  document.getElementById("zoomOut").addEventListener("click", () => setZoom(zoom - .1));
  document.getElementById("zoomIn").addEventListener("click", () => setZoom(zoom + .1));
  document.getElementById("zoomReset").addEventListener("click", fitBoard);
  document.getElementById("exportBoard").addEventListener("click", exportCurrentBoard);
  document.getElementById("backupAll").addEventListener("click", backupAllBoards);
  document.getElementById("saveWorkflowTemplate").addEventListener("click", openWorkflowTemplates);
  document.getElementById("openWorkflowTemplates").addEventListener("click", openWorkflowTemplates);
  document.getElementById("homeTemplates").addEventListener("click", () => {
    homeMoreMenuEl.open = false;
    openWorkflowTemplates();
  });
  document.getElementById("openVersionHistory").addEventListener("click", openVersionHistory);
  document.getElementById("openHealthCheck").addEventListener("click", openHealthCheck);
  document.getElementById("homeHealthCheck").addEventListener("click", () => {
    homeMoreMenuEl.open = false;
    openHealthCheck();
  });
  document.getElementById("exportPng").addEventListener("click", () => exportBoardImage("png"));
  document.getElementById("exportPdf").addEventListener("click", () => exportBoardImage("pdf"));
  document.getElementById("importBoard").addEventListener("click", () => importInputEl.click());
  document.getElementById("homeImport").addEventListener("click", () => {
    homeMoreMenuEl.open = false;
    importInputEl.click();
  });
  document.getElementById("deleteBoard").addEventListener("click", deleteCurrentBoard);
  importInputEl.addEventListener("change", importSelectedFile);
  boardNameEl.addEventListener("input", scheduleSave);
  boardNameEl.addEventListener("change", async () => {
    if (!currentBoard) return;
    document.title = `${boardNameEl.value || "未命名白板"} · 拾作`;
    await saveBoardNow();
    notifyDataChanged([currentBoard.id], "rename-board");
  });

  document.addEventListener("paste", handlePaste);
  document.addEventListener("copy", handleCopy);
  document.addEventListener("keydown", event => {
    if (blockBrowserPageZoomShortcut(event)) return;
    if (event.key === "Escape") {
      if (focusedItemId) {
        event.preventDefault();
        exitItemFocus();
        return;
      }
      addMenuEl.open = false;
      exportMenuEl.open = false;
      homeMoreMenuEl.open = false;
      selectionMoreMenuEl.open = false;
      if (currentBoard) selectItems([]);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      return;
    }
    const editing = event.target.closest?.(".text-content,input,textarea");
    if (event.code === "Space" && !editing) {
      spacePressed = true;
      if (currentBoard) event.preventDefault();
    }
    if (!currentBoard || editing) return;
    const command = event.metaKey || event.ctrlKey;
    if (command && event.key.toLowerCase() === "z") {
      event.preventDefault();
      applyHistory(historyIndex + (event.shiftKey ? 1 : -1));
      return;
    }
    if (command && event.key.toLowerCase() === "a") {
      event.preventDefault();
      selectItems(boardItems.map(item => item.id));
      return;
    }
    if (command && event.key.toLowerCase() === "g") {
      event.preventDefault();
      if (event.shiftKey) ungroupSelection();
      else groupSelection();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      if (selectedIds.size) {
        event.preventDefault();
        removeItems([...selectedIds]);
      }
    }
  });
  document.addEventListener("keyup", event => {
    if (event.code === "Space") spacePressed = false;
  });
  window.addEventListener("blur", () => { spacePressed = false; });
  window.addEventListener("popstate", () => {
    const id = new URLSearchParams(location.search).get("board");
    if (id) openBoard(id, false);
    else renderHome(false);
  });
  // 不在 window focus 时替换白板卡片，否则首次点击可能在 pointerdown 与 click 之间丢失。
  document.addEventListener("visibilitychange", refreshHomeWhenVisible);
  globalThis.chrome?.runtime?.onMessage?.addListener(message => {
    if (message?.type === TERMINAL_EVENT) {
      handleTerminalEvent(message.event);
      return;
    }
    if (message?.type === CODEX_EVENT) {
      if (message.event?.type === "external-codex-status") {
        updateExternalCodexStatus(message.event);
        return;
      }
      if (["local-codex-session-status", "external-codex-activity", "external-codex-task", "external-codex-approval", "external-codex-presence", "external-card-stream"].includes(message.event?.type)) {
        handleExternalCollaborationEvent(message.event);
        return;
      }
      trackCodexEvent(message.event);
      // 定时任务由后台持久化，画布只展示全局运行态并等待数据库变更通知刷新卡片。
      if (message.event?.scheduled) return;
      handleWhiteboardCodexEvent(message.event);
      handleBoardCardCodexEvent(message.event);
      handleCodexChatEvent(message.event);
      return;
    }
    if (message?.type !== "pagedock-data-changed") return;
    if (message.source === messageSource) return;
    if (!currentBoard) {
      renderHome(false);
      return;
    }
    if (!message.boardIds?.includes(currentBoard.id)) return;
    if (saveTimer) {
      setStatus("检测到外部更新，完成当前编辑后请重新打开白板");
      return;
    }
    openBoard(currentBoard.id, false);
  });

  // Canvas interaction should return transient toolbar controls to their resting state.
  cardFocusLayerEl.addEventListener("pointerdown", event => {
    if (event.target === cardFocusLayerEl) exitItemFocus();
  });
  viewportEl.addEventListener("pointerdown", resetBoardSurfaceUi, true);
  boardEl.addEventListener("pointerdown", startMarquee);
  boardEl.addEventListener("dblclick", event => {
    if (event.target === boardEl) addTextItem("", boardPointFromEvent(event), true);
  });
  viewportEl.addEventListener("pointermove", event => { lastBoardPoint = boardPointFromEvent(event); });
  viewportEl.addEventListener("scroll", () => {
    updateMinimapViewport();
    positionSelectionActions();
    scheduleSave();
  });
  viewportEl.addEventListener("wheel", event => {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    // Trackpads emit many small wheel events, so scale proportionally instead of jumping 10% each time.
    const normalizedDelta = clamp(event.deltaY, -100, 100);
    setZoom(zoom * Math.exp(-normalizedDelta * .01));
  }, { passive: false });
  document.addEventListener("wheel", blockBrowserPageZoomOutsideCanvas, { capture: true, passive: false });
  viewportEl.addEventListener("dragover", event => event.preventDefault());
  viewportEl.addEventListener("drop", async event => {
    event.preventDefault();
    await addDroppedItems(event.dataTransfer, boardPointFromEvent(event));
  });
  minimapEl.addEventListener("click", event => {
    const rect = minimapEl.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * boardWidth;
    const y = (event.clientY - rect.top) / rect.height * boardHeight;
    viewportEl.scrollLeft = x * zoom - viewportEl.clientWidth / 2;
    viewportEl.scrollTop = y * zoom - viewportEl.clientHeight / 2;
  });
  window.addEventListener("resize", positionSelectionActions);
  setupPanning();
}

async function boot() {
  if (!db) throw new Error("拾作数据库模块未载入");
  wireEvents();
  await loadAiRuntime();
  const params = new URLSearchParams(location.search);
  if (params.get("codex") === "page") {
    const stored = (await chrome.storage.local.get(CODEX_PAGE_ATTACHMENT_KEY))[CODEX_PAGE_ATTACHMENT_KEY];
    if (stored?.content && Date.now() - Number(stored.createdAt || 0) < 10 * 60 * 1000) {
      codexAttachedPage = stored;
    }
    await chrome.storage.local.remove(CODEX_PAGE_ATTACHMENT_KEY);
  }
  await loadCodexChatMessages();
  setCodexChatOpen(Boolean(codexAttachedPage) || sessionStorage.getItem("__pagedock_codex_chat_open__") === "1");
  await connectCodexChat();
  await db.ensureInbox();
  await migrateLegacyBoard();
  const boardId = params.get("board");
  if (boardId) await openBoard(boardId, false);
  else await renderHome(false);
  setInterval(refreshTaskElapsedLabels, 1000);
}

boot().catch(error => {
  console.error("[pagedock] boot failed", error);
  setStatus(error?.message || "拾作载入失败", true);
});
