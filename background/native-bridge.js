// Module: Native Host connection lifecycle and automatic reconnection.
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
