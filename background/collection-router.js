// Module: collection menus and Chrome event routing.
async function registerContextMenus() {
  if (contextMenuRefresh) return contextMenuRefresh;
  contextMenuRefresh = (async () => {
    const boards = (await PageDockDB.listBoards())
      .filter(board => board.id !== PageDockDB.INBOX_ID)
      .slice(0, RECENT_BOARD_LIMIT);
    const collectionTypes = [
      { type: "selection", title: "保存选中文字到拾作", contexts: ["selection"] },
      { type: "image", title: "保存图片到拾作", contexts: ["image"] },
      { type: "link", title: "保存链接到拾作", contexts: ["link"] },
      { type: "page", title: "保存当前页面到拾作", contexts: ["page"] }
    ];

    await chrome.contextMenus.removeAll();
    for (const entry of collectionTypes) {
      const parentId = `${CONTEXT_MENU_PREFIX}-${entry.type}`;
      chrome.contextMenus.create({
        id: parentId,
        title: entry.title,
        contexts: entry.contexts
      });
      chrome.contextMenus.create({
        id: `${parentId}|${PageDockDB.INBOX_ID}`,
        parentId,
        title: "保存到收件箱",
        contexts: entry.contexts
      });
      for (const board of boards) {
        chrome.contextMenus.create({
          id: `${parentId}|${board.id}`,
          parentId,
          title: `保存到：${board.name}`,
          contexts: entry.contexts
        });
      }
    }
    console.info("[pagedock-context-menu] collection entries registered", {
      recentBoardIds: boards.map(board => board.id)
    });
  })();
  try {
    await contextMenuRefresh;
  } finally {
    contextMenuRefresh = undefined;
  }
}

chrome.runtime.onInstalled.addListener(async () => {
  await PageDockDB.ensureInbox();
  await registerContextMenus();
  await recoverInterruptedScheduledTasks();
  await syncAllTaskScheduleAlarms();
  armCodexAutoConnectAlarm();
  ensureCodexAutoConnection("install");
});
chrome.runtime.onStartup.addListener(() => {
  registerContextMenus().catch(error => {
    console.error("[pagedock-context-menu] startup registration failed", error);
  });
  armCodexAutoConnectAlarm();
  recoverInterruptedScheduledTasks()
    .then(syncAllTaskScheduleAlarms)
    .catch(error => console.warn("[pagedock-scheduler] startup sync failed", error));
  ensureCodexAutoConnection("startup");
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === CODEX_AUTO_CONNECT_ALARM) {
    if (!codexNativePort || !nativeHostReady) ensureCodexAutoConnection("scheduled");
    return;
  }
  const scheduled = parseTaskScheduleAlarm(alarm.name);
  if (scheduled) runScheduledTask(scheduled.boardId, scheduled.itemId).catch(error => {
    console.error("[pagedock-scheduler] alarm failed", { ...scheduled, reason: error?.message || String(error) });
  });
});

chrome.runtime.onConnect.addListener(port => {
  if (port.name !== PAGE_CODEX_PORT) return;
  pageCodexPorts.add(port);
  port.onDisconnect.addListener(() => pageCodexPorts.delete(port));
  // Opening any supported web page is sufficient to wake the service worker
  // and connect the local Native Host; no manual connect action is required.
  ensureCodexAutoConnection("page-open");
});

chrome.runtime.onMessage.addListener(message => {
  if (message?.type !== "pagedock-data-changed") return;
  if (message.source !== "codex-bridge") recordExternalBoardChange(message.boardIds, message.itemId, message.reason);
  registerContextMenus().catch(error => {
    console.error("[pagedock-context-menu] refresh failed", error);
  });
});

/* 兼容开发者模式下直接重新载入 service worker。 */
PageDockDB.ensureInbox().then(registerContextMenus).catch(error => {
  console.error("[pagedock-context-menu] initial registration failed", error);
});
recoverInterruptedScheduledTasks()
  .then(syncAllTaskScheduleAlarms)
  .catch(error => console.warn("[pagedock-scheduler] initial sync failed", error));
armCodexAutoConnectAlarm();
ensureCodexAutoConnection("initial");

chrome.contextMenus.onClicked.addListener((info, tab) => {
  collectContextMenuItem(info, tab).catch(error => {
    console.error("[pagedock-context-menu] collection failed", error);
  });
});

async function collectContextMenuItem(info, tab) {
  const matched = String(info.menuItemId).match(
    /^pagedock-save-(selection|image|link|page)\|(.+)$/
  );
  if (!matched) return;
  const [, collectionType, targetBoardId] = matched;
  const source = {
    url: info.pageUrl || tab?.url || "",
    title: tab?.title || "",
    capturedAt: Date.now()
  };
  let item;
  if (collectionType === "selection") {
    item = { type: "text", text: info.selectionText || "", source };
  } else if (collectionType === "image") {
    item = {
      type: "image",
      src: await cacheImageSource(info.srcUrl),
      alt: tab?.title || "网页图片",
      source
    };
  } else if (collectionType === "link") {
    item = {
      type: "link",
      text: info.linkText || info.linkUrl || "网页链接",
      src: info.linkUrl || "",
      source
    };
  } else {
    item = { type: "link", text: tab?.title || source.url, src: source.url, source };
  }
  if (!item.text && !item.src) throw new Error("没有可保存的网页内容");
  const saved = await PageDockDB.addItem(targetBoardId, item);
  chrome.runtime.sendMessage({
    type: "pagedock-data-changed",
    itemId: saved.id,
    boardIds: [targetBoardId],
    reason: "context-menu-collect"
  }).catch(() => {});
  console.info("[pagedock-context-menu] item collected", {
    itemId: saved.id,
    itemType: saved.type,
    targetBoardId,
    sourceUrl: source.url
  });
}

async function cacheImageSource(sourceUrl) {
  if (!sourceUrl || sourceUrl.startsWith("data:image/")) return sourceUrl || "";
  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    if (!blob.type.startsWith("image/")) throw new Error("目标不是图片");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let binary = "";
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return `data:${blob.type};base64,${btoa(binary)}`;
  } catch (error) {
    console.warn("[pagedock-context-menu] image cached as URL", {
      sourceUrl,
      reason: error?.message || String(error)
    });
    return sourceUrl;
  }
}

// 工具菜单发起 Markdown 或截图任务；保持消息通道直到任务完成。
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (![MARKDOWN_REQUEST, SCREENSHOT_REQUEST, CODEX_PAGE_CONTEXT_REQUEST, PAGE_CARD_CONTEXT_REQUEST].includes(message?.type)) return;

  const task = message.type === MARKDOWN_REQUEST
    ? captureMarkdown(message)
    : message.type === SCREENSHOT_REQUEST
      ? captureFullPage(message)
      : message.type === PAGE_CARD_CONTEXT_REQUEST
        ? capturePageCardContext(message)
        : captureCodexPageContext();
  task
    .then(result => sendResponse({ ok: true, ...result }))
    .catch(error => {
      console.error(`[${message.type}] task failed`, error);
      sendResponse({
        ok: false,
        error: error?.message || String(error),
        code: error?.code || "",
        requiredOrigin: error?.requiredOrigin || "",
        requiredHost: error?.requiredHost || ""
      });
    });
  return true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (![CODEX_STATUS_REQUEST, CODEX_RUN_REQUEST, CODEX_CANCEL_REQUEST, CODEX_SESSION_LIST_REQUEST, CODEX_SESSION_PREVIEW_REQUEST, BRIDGE_SHARE_CREATE_REQUEST, BRIDGE_SHARE_STOP_REQUEST, BRIDGE_CLIENT_REVOKE_REQUEST].includes(message?.type)) return;
  handleCodexBridgeRequest(message)
    .then(result => sendResponse({ ok: true, ...result }))
    .catch(error => {
      console.error("[pagedock-codex] bridge request failed", {
        type: message.type,
        reason: error?.message || String(error)
      });
      sendResponse({ ok: false, error: error?.message || String(error) });
    });
  return true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (![PAGE_CHAT_GET_REQUEST, PAGE_CHAT_PUT_REQUEST, PAGE_CHAT_DELETE_REQUEST].includes(message?.type)) return;
  const task = message.type === PAGE_CHAT_GET_REQUEST
    ? PageDockDB.getPageChat(message.url)
    : message.type === PAGE_CHAT_PUT_REQUEST
      ? PageDockDB.savePageChat({ url: message.url, title: message.title, messages: message.messages })
      : PageDockDB.deletePageChat(message.url);
  task.then(result => {
    console.info("[pagedock-page-chat] IndexedDB operation completed", {
      type: message.type,
      messageCount: Array.isArray(message.messages) ? message.messages.length : undefined
    });
    sendResponse({ ok: true, result });
  }).catch(error => {
    console.warn("[pagedock-page-chat] IndexedDB operation failed", {
      type: message.type,
      reason: error?.message || String(error)
    });
    sendResponse({ ok: false, error: error?.message || String(error) });
  });
  return true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== TASK_SCHEDULE_SYNC_REQUEST) return;
  syncTaskScheduleAlarm(String(message.boardId || ""), String(message.itemId || ""))
    .then(schedule => sendResponse({ ok: true, schedule }))
    .catch(error => sendResponse({ ok: false, error: error?.message || String(error) }));
  return true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== BRIDGE_APPROVAL_RESPONSE) return;
  const approvalId = String(message.approvalId || "");
  const pending = externalApprovalRequests.get(approvalId);
  if (!pending) {
    sendResponse({ ok: false, error: "此操作确认已失效" });
    return;
  }
  externalApprovalRequests.delete(approvalId);
  clearTimeout(pending.timer);
  if (message.allow === true) {
    if (message.allowMode === "session" && pending.approval?.client?.id) externalSessionGrants.add(pending.approval.client.id);
    pending.resolve();
  }
  else pending.reject(new Error("白板用户拒绝了此操作"));
  console.info("[shizuo-bridge] external mutation approval settled", {
    requestId: pending.requestId,
    allowed: message.allow === true
  });
  sendResponse({ ok: true });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== BRIDGE_CLIENT_POLICY_REQUEST) return;
  const clientId = String(message.clientId || "");
  const policy = ["read", "ask", "edit"].includes(message.policy) ? message.policy : "ask";
  if (!clientId) {
    sendResponse({ ok: false, error: "缺少接入者" });
    return;
  }
  ensureCollaborationState().then(() => {
    externalClientPolicies = { ...externalClientPolicies, [clientId]: policy };
    if (policy !== "edit") externalSessionGrants.delete(clientId);
    return persistCollaborationState();
  }).then(() => sendResponse({ ok: true, policy })).catch(error => sendResponse({ ok: false, error: error?.message || String(error) }));
  return true;
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (![TERMINAL_RUN_REQUEST, TERMINAL_CANCEL_REQUEST, TERMINAL_SESSION_OPEN_REQUEST, TERMINAL_SESSION_INPUT_REQUEST, TERMINAL_SESSION_RESIZE_REQUEST, TERMINAL_SESSION_CLOSE_REQUEST].includes(message?.type)) return;
  handleTerminalBridgeRequest(message)
    .then(result => sendResponse({ ok: true, ...result }))
    .catch(error => {
      console.error("[pagedock-terminal] bridge request failed", {
        type: message.type,
        reason: error?.message || String(error)
      });
      sendResponse({ ok: false, error: error?.message || String(error) });
    });
  return true;
});
