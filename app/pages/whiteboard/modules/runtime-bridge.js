// Module: local AI runtime and session bridge adapters.
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
    : (externalCodexScope === "lan" ? "MCP 内网待接入" : (codexConnectionHint ? "需要重新加载拾作" : "正在连接本地 Codex"));
  codexExternalStatusEl.title = externalCodexConnected
    ? `外部 Codex 已通过${externalCodexScope === "lan" ? "内网" : "本机"} MCP 接入拾作`
    : (externalCodexScope === "lan" ? "拾作已开启内网共享，正在等待同事的 Codex 接入" : (codexConnectionHint || "打开拾作后会自动连接本地 Codex"));
}

function updateExternalCodexStatus(snapshot = {}) {
  if (snapshot.health && typeof snapshot.health === "object") {
    videoEngineHealth = {
      loaded: true,
      hyperframes: Boolean(snapshot.health.hyperframes),
      remotion: Boolean(snapshot.health.remotion)
    };
  }
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
