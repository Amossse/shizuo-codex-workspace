// Module: home search, collection, boards, and sharing entry points.
function createBoardCard(board) {
  const isInbox = board.id === db.INBOX_ID;
  const card = document.createElement("article");
  card.className = "board-card";
  card.dataset.boardId = board.id;
  card.tabIndex = 0;
  card.setAttribute("role", "button");
  card.setAttribute("aria-label", isInbox ? "打开收件箱" : `打开白板 ${board.name}`);

  const top = document.createElement("div");
  top.className = "board-card-top";
  const icon = document.createElement("span");
  icon.className = "board-card-icon";
  icon.textContent = board.id === db.INBOX_ID ? "↓" : "□";
  const title = document.createElement("h3");
  title.textContent = board.name;
  top.append(icon, title);
  const remove = document.createElement("button");
  remove.className = "board-delete";
  remove.type = "button";
  remove.title = isInbox ? "清空收件箱" : "删除白板";
  remove.setAttribute("aria-label", remove.title);
  remove.textContent = "×";
  remove.addEventListener("click", async event => {
    event.stopPropagation();
    if (isInbox) {
      if (!confirm("确定清空收件箱吗？其中的内容会被删除。")) return;
      const removed = await db.clearInbox();
      notifyDataChanged([db.INBOX_ID], "clear-inbox");
      await renderHome();
      setStatus(removed ? `已清空收件箱（${removed} 项）` : "收件箱已经为空");
      return;
    }
    if (!confirm(`确定删除“${board.name}”吗？此操作无法撤销。`)) return;
    await db.deleteBoard(board.id);
    notifyDataChanged([board.id], "delete-board");
    await renderHome();
  });
  top.appendChild(remove);

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
  const inbox = homeBoards.find(board => board.id === db.INBOX_ID);
  const regularBoards = homeBoards.filter(board => board.id !== db.INBOX_ID);
  inboxListEl.replaceChildren();
  boardListEl.replaceChildren();
  recentListEl.replaceChildren();
  inboxLibraryEl.hidden = Boolean(query);
  if (!query && inbox) inboxListEl.appendChild(createBoardCard(inbox));
  const boards = regularBoards.filter(board => !query
    || `${board.name} ${board.preview}`.toLocaleLowerCase().includes(query));
  boards.forEach(board => boardListEl.appendChild(createBoardCard(board)));
  if (!boards.length) {
    const empty = document.createElement("div");
    empty.className = "empty-home";
    empty.textContent = query ? "没有匹配的白板" : "还没有白板，先新建一个吧";
    boardListEl.appendChild(empty);
  }
  if (!query) {
    recentHeadingEl.textContent = "最近内容";
    recentHintEl.textContent = "快捷入口，点击在所属位置打开";
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
  boardCountEl.textContent = `${homeBoards.filter(board => board.id !== db.INBOX_ID).length} 个白板`;
  inboxCountEl.textContent = `${inbox?.itemCount || 0} 项`;
  updateWorkflowTemplateEntry(templates.length);
  applyHomeFilter();
}

async function finishHomeCapture(savedItems, firstRun, successMessage) {
  notifyDataChanged([db.INBOX_ID], "quick-add");
  if (firstRun && savedItems[0]?.id) {
    console.info("[pagedock-onboarding] first content captured", { itemId: savedItems[0].id, count: savedItems.length });
    await focusExternalActivity({ boardId: db.INBOX_ID, cardId: savedItems[0].id });
    setStatus("内容已保存到收件箱。下一步：点击上方“交给 AI”", false, "success", 6500);
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
