// Module: collaboration state, presence, approvals, and remote board RPC.
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
