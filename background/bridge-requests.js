// Module: Codex and terminal request adapters.
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
