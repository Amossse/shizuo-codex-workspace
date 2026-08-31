// Module: scheduled tasks and dynamic workflow execution.
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
