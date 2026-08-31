// Module: task execution, dynamic workflows, cancellation, and retry.
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
    if (!codexChatReady) throw new Error(codexConnectionHint || `${aiRuntimeLabel()} 未连接`);
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
    if (!codexChatReady) throw new Error(codexConnectionHint || `${aiRuntimeLabel()} 未连接`);
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
