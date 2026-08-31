// Module: local AI chat state, progress, and message delivery.
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
    lastCodexStatusSnapshot = response;
    codexChatReady = Boolean(response.ready);
    codexConnectionHint = codexChatReady
      ? ""
      : (response.health?.nativeHost
        ? `${aiRuntimeLabel()} CLI 不可用，请确认已在终端完成登录`
        : "本地桥接未连接：请在 chrome://extensions 重新加载拾作；首次安装请先在扩展目录运行 ./install.sh --core");
    updateCodexTaskSnapshot(response);
    updateExternalCodexStatus(response);
    setCodexChatStatus(
      codexChatReady
        ? (codexRunningTaskIds().size ? `${codexRunningTaskIds().size} 个任务执行中` : "已连接")
        : codexConnectionHint,
      codexChatReady ? (codexRunningTaskIds().size ? "loading" : "success") : "error"
    );
  } catch (error) {
    codexChatReady = false;
    lastCodexStatusSnapshot = null;
    codexConnectionHint = "本地桥接未连接：请在 chrome://extensions 重新加载拾作；首次安装请先在扩展目录运行 ./install.sh --core";
    console.warn("[pagedock-codex-chat] local bridge unavailable", { reason: error?.message || String(error) });
    setCodexChatStatus(codexConnectionHint, "error");
  }
  updateCodexChatControls();
  return codexChatReady;
}

async function ensureCodexReadyForTask(resume) {
  if (!codexChatReady) await connectCodexChat();
  if (codexChatReady) return true;
  openConnectionGuide({ snapshot: lastCodexStatusSnapshot, resume });
  return false;
}

async function sendCodexChatMessage() {
  const prompt = codexChatInputEl.value.trim();
  if (!prompt || codexChatTask || codexAtCapacity()) return;
  if (!codexChatReady) {
    await connectCodexChat();
    if (!codexChatReady) {
      openConnectionGuide();
      return;
    }
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
