// Module: task conversation model and task-card presentation.
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
  const preferred = value === "remotion" ? "remotion" : "hyperframes";
  if (!videoEngineHealth.loaded || videoEngineHealth[preferred]) return preferred;
  const fallback = preferred === "remotion" ? "hyperframes" : "remotion";
  return videoEngineHealth[fallback] ? fallback : preferred;
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
