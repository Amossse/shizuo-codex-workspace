// Module: board mutation, revision, persistence, layout, and navigation.
function removeItems(ids) {
  if (focusedItemId && ids.includes(focusedItemId)) exitItemFocus(false, false);
  for (const id of ids) {
    const item = itemById(id);
    if (item?.taskWorkflowRole === "controller") cancelTaskItem(item);
  }
  for (const item of boardItems) {
    if (ids.includes(item.id) && item.type === "terminal") {
      if (["connected", "connecting"].includes(item.terminalStatus)) closeTerminalSession(item);
      clearTerminalSaveTimer(item.id);
      disposeTerminalRenderer(terminalSessions.get(item.terminalSessionId));
    }
  }
  for (const task of boardCardCodexTasks.values()) {
    if (ids.includes(task.itemId)) chrome.runtime.sendMessage({ type: CODEX_CANCEL_REQUEST, id: task.id }).catch(() => {});
  }
  for (const task of whiteboardCodexTasks.values()) {
    if (task.taskItemId && ids.includes(task.taskItemId)) {
      chrome.runtime.sendMessage({ type: CODEX_CANCEL_REQUEST, id: task.id }).catch(() => {});
    }
  }
  const removing = new Set(ids);
  boardItems = boardItems.filter(item => !removing.has(item.id));
  for (const item of boardItems) {
    if (item.card?.inputs) item.card.inputs = item.card.inputs.filter(connection => !removing.has(connection.sourceId));
    item.relationSourceIds = (item.relationSourceIds || []).filter(id => !removing.has(id));
    if (item.type === "task") item.taskSourceIds = (item.taskSourceIds || []).filter(id => !removing.has(id));
  }
  ids.forEach(id => itemElement(id)?.remove());
  selectedIds = new Set([...selectedIds].filter(id => !removing.has(id)));
  updateSelectionUi();
  updateEmptyState();
  renderConnections();
  renderMinimap();
  commitHistory();
  scheduleSave();
}

function moveSelectedBy(dx, dy) {
  for (const id of selectedIds) {
    const item = itemById(id);
    const element = itemElement(id);
    if (!item || !element) continue;
    item.x += dx;
    item.y += dy;
    item.updatedAt = Date.now();
    element.style.left = `${item.x}px`;
    element.style.top = `${item.y}px`;
  }
  ensureBoardContains(selectedItems());
  renderConnections();
  renderMinimap();
  positionSelectionActions();
  commitHistory();
  scheduleSave();
}

function alignSelection(axis) {
  const selected = [...selectedIds].map(itemById).filter(Boolean);
  if (selected.length < 2) return;
  const target = Math.min(...selected.map(item => axis === "x" ? item.x : item.y));
  for (const item of selected) {
    item[axis] = target;
    const element = itemElement(item.id);
    if (element) element.style[axis === "x" ? "left" : "top"] = `${target}px`;
  }
  renderConnections();
  renderMinimap();
  positionSelectionActions();
  commitHistory();
  scheduleSave();
}

function gridLayout(items, startX, startY) {
  if (!items.length) return { right: startX, bottom: startY };
  const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(items.length))));
  const rows = Math.ceil(items.length / columns);
  const columnWidths = Array.from({ length: columns }, () => 0);
  const rowHeights = Array.from({ length: rows }, () => 0);
  items.forEach((item, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    columnWidths[column] = Math.max(columnWidths[column], item.width);
    rowHeights[row] = Math.max(rowHeights[row], item.height);
  });
  const xPositions = [];
  const yPositions = [];
  columnWidths.reduce((position, width, index) => {
    xPositions[index] = position;
    return position + width + 56;
  }, startX);
  rowHeights.reduce((position, height, index) => {
    yPositions[index] = position;
    return position + height + 48;
  }, startY);
  items.forEach((item, index) => {
    item.x = xPositions[index % columns];
    item.y = yPositions[Math.floor(index / columns)];
  });
  return {
    right: xPositions.at(-1) + columnWidths.at(-1),
    bottom: yPositions.at(-1) + rowHeights.at(-1)
  };
}

function optimizeBoardLayout() {
  if (boardItems.length < 2) return;
  const edges = relationEdges();
  const originX = Math.max(32, Math.min(...boardItems.map(item => item.x)));
  const originY = Math.max(32, Math.min(...boardItems.map(item => item.y)));
  const connectedIds = new Set(edges.flatMap(edge => [edge.source.id, edge.target.id]));
  const connectedItems = boardItems.filter(item => connectedIds.has(item.id));
  const isolatedItems = boardItems.filter(item => !connectedIds.has(item.id)).sort((left, right) => left.y - right.y || left.x - right.x);

  let graphBounds = { right: originX, bottom: originY };
  if (connectedItems.length) {
    const outgoing = new Map(connectedItems.map(item => [item.id, []]));
    const indegree = new Map(connectedItems.map(item => [item.id, 0]));
    edges.forEach(edge => {
      outgoing.get(edge.source.id)?.push(edge.target.id);
      indegree.set(edge.target.id, (indegree.get(edge.target.id) || 0) + 1);
    });
    const layerById = new Map(connectedItems.map(item => [item.id, 0]));
    const queue = connectedItems.filter(item => indegree.get(item.id) === 0).sort((left, right) => left.y - right.y);
    const processed = new Set();
    while (queue.length) {
      const item = queue.shift();
      if (processed.has(item.id)) continue;
      processed.add(item.id);
      for (const targetId of outgoing.get(item.id) || []) {
        layerById.set(targetId, Math.max(layerById.get(targetId) || 0, (layerById.get(item.id) || 0) + 1));
        indegree.set(targetId, indegree.get(targetId) - 1);
        if (indegree.get(targetId) === 0) queue.push(itemById(targetId));
      }
    }
    // 循环关系无法形成严格 DAG，保留其相对顺序并放入最浅层，避免布局失败。
    connectedItems.filter(item => !processed.has(item.id)).forEach(item => layerById.set(item.id, 0));
    const layers = new Map();
    connectedItems.forEach(item => {
      const layer = layerById.get(item.id) || 0;
      if (!layers.has(layer)) layers.set(layer, []);
      layers.get(layer).push(item);
    });
    const orderedLayers = [...layers.entries()].sort((left, right) => left[0] - right[0]);
    orderedLayers.forEach(([, items]) => items.sort((left, right) => {
      const leftSources = relationSourceIds(left).map(itemById).filter(Boolean);
      const rightSources = relationSourceIds(right).map(itemById).filter(Boolean);
      const leftWeight = leftSources.length ? leftSources.reduce((sum, item) => sum + item.y, 0) / leftSources.length : left.y;
      const rightWeight = rightSources.length ? rightSources.reduce((sum, item) => sum + item.y, 0) / rightSources.length : right.y;
      return leftWeight - rightWeight;
    }));
    const layerWidths = orderedLayers.map(([, items]) => Math.max(...items.map(item => item.width)));
    const layerHeights = orderedLayers.map(([, items]) => items.reduce((sum, item) => sum + item.height, 0) + Math.max(0, items.length - 1) * 56);
    const graphHeight = Math.max(...layerHeights);
    let x = originX;
    orderedLayers.forEach(([, items], layerIndex) => {
      let y = originY + Math.max(0, (graphHeight - layerHeights[layerIndex]) / 2);
      items.forEach(item => {
        item.x = x;
        item.y = y;
        y += item.height + 56;
      });
      x += layerWidths[layerIndex] + 104;
    });
    graphBounds = { right: x - 104, bottom: originY + graphHeight };
  }

  if (isolatedItems.length) {
    const gridY = connectedItems.length ? graphBounds.bottom + 88 : originY;
    gridLayout(
      isolatedItems,
      originX,
      gridY
    );
  }

  for (const item of boardItems) {
    item.x = Math.round(item.x);
    item.y = Math.round(item.y);
    item.updatedAt = Date.now();
    const element = itemElement(item.id);
    if (!element) continue;
    element.style.left = `${item.x}px`;
    element.style.top = `${item.y}px`;
  }
  ensureBoardContains(boardItems);
  renderConnections();
  renderMinimap();
  positionSelectionActions();
  commitHistory();
  scheduleSave();
  console.info("[pagedock-layout] optimized", { itemCount: boardItems.length, relationCount: edges.length });
}

function groupSelection() {
  if (selectedIds.size < 2) return;
  const groupId = db.makeId("group");
  selectedIds.forEach(id => {
    const item = itemById(id);
    if (item) item.groupId = groupId;
    itemElement(id)?.classList.add("grouped");
  });
  updateSelectionUi();
  commitHistory();
  scheduleSave();
}

function ungroupSelection() {
  selectedIds.forEach(id => {
    const item = itemById(id);
    if (item) item.groupId = "";
    itemElement(id)?.classList.remove("grouped");
  });
  updateSelectionUi();
  commitHistory();
  scheduleSave();
}

function historySnapshot() {
  return JSON.stringify(boardItems);
}

function resetHistory() {
  clearTimeout(historyTimer);
  historyEntries = [historySnapshot()];
  historyIndex = 0;
  updateHistoryButtons();
}

function commitHistory() {
  if (applyingHistory) return;
  clearTimeout(historyTimer);
  const snapshot = historySnapshot();
  if (historyEntries[historyIndex] === snapshot) return;
  historyEntries = historyEntries.slice(0, historyIndex + 1);
  historyEntries.push(snapshot);
  if (historyEntries.length > 80) historyEntries.shift();
  historyIndex = historyEntries.length - 1;
  updateHistoryButtons();
}

function queueHistoryCommit() {
  clearTimeout(historyTimer);
  historyTimer = setTimeout(commitHistory, HISTORY_DELAY_MS);
}

function updateHistoryButtons() {
  document.getElementById("undo").disabled = historyIndex <= 0;
  document.getElementById("redo").disabled = historyIndex >= historyEntries.length - 1;
}

function applyHistory(index) {
  if (index < 0 || index >= historyEntries.length) return;
  applyingHistory = true;
  historyIndex = index;
  boardItems = JSON.parse(historyEntries[historyIndex]);
  selectedIds.clear();
  renderAllItems();
  applyingHistory = false;
  updateHistoryButtons();
  scheduleSave();
}

function scheduleSave() {
  if (!currentBoard) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveBoardNow, SAVE_DELAY_MS);
}

async function saveBoardNow() {
  if (!currentBoard) return;
  clearTimeout(saveTimer);
  saveTimer = undefined;
  const boardReference = currentBoard;
  const boardId = boardReference.id;
  const baseBoard = clone(boardReference);
  const snapshot = {
    ...clone(boardReference),
    name: boardNameEl.value.trim() || boardReference.name || "未命名白板",
    items: clone(boardItems),
    viewport: {
      zoom,
      scrollLeft: viewportEl.scrollLeft,
      scrollTop: viewportEl.scrollTop,
      canvasWidth: boardWidth,
      canvasHeight: boardHeight
    }
  };
  let operation;
  try {
    if (navigator.storage?.estimate && Date.now() - lastStorageEstimateAt > 30_000) {
      lastStorageEstimateAt = Date.now();
      const estimate = await navigator.storage.estimate();
      if (estimate.quota && estimate.usage / estimate.quota > 0.9) {
        setStatus("本地存储空间接近上限，建议先备份并清理大型视频或图片", true);
        console.warn("[pagedock-storage] quota pressure", { usage: estimate.usage, quota: estimate.quota });
      }
    }
    operation = enqueueBoardWrite(boardId, () => db.commitBoardSnapshot(snapshot, {
      baseBoard,
      preserveArchived: boardId === db.INBOX_ID,
      actor: { id: "owner", name: "白板用户" },
      reason: "编辑白板"
    }));
    saveInFlight = operation;
    const saved = await operation;
    if (currentBoard?.id === boardId) {
      const mergedExternalChanges = Number(saved.revision) > Number(baseBoard.revision || 0) + 1
        || saved.items.length !== snapshot.items.length;
      Object.assign(currentBoard, saved, { items: clone(saved.items) });
      if (mergedExternalChanges) {
        // IndexedDB 已完成字段级合并，画布必须采用完整结果，不能让下一次旧快照删除外部新增卡片。
        boardItems = clone(saved.items);
        renderAllItems();
        ensureBoardContains(boardItems);
        renderConnections();
        renderMinimap();
      } else {
        const savedItems = new Map(saved.items.map(item => [String(item.id), item]));
        for (const item of boardItems) item.revision = Number(savedItems.get(String(item.id))?.revision) || item.revision;
      }
    }
    chrome.runtime.sendMessage({
      type: "pagedock-data-changed",
      boardIds: [boardId],
      reason: "owner-board-save",
      source: messageSource
    }).catch(() => {});
    return saved;
  } catch (error) {
    console.error("[pagedock-board] save failed", error);
    setStatus(error?.code === "BOARD_CONFLICT"
      ? "检测到协作冲突：已保留当前编辑，请重新打开白板后合并"
      : "白板未能保存，请检查存储空间后重试", true);
    return null;
  } finally {
    if (saveInFlight === operation) saveInFlight = undefined;
  }
}

async function flushSave() {
  const hasPendingTerminalSave = terminalSaveTimers.size > 0;
  for (const timer of terminalSaveTimers.values()) clearTimeout(timer);
  terminalSaveTimers.clear();
  if ((saveTimer || hasPendingTerminalSave) && currentBoard) await saveBoardNow();
  if (saveInFlight) await saveInFlight.catch(() => {});
}

function setZoom(nextZoom, preserveCenter = true) {
  const previous = zoom;
  const center = {
    x: (viewportEl.scrollLeft + viewportEl.clientWidth / 2) / previous,
    y: (viewportEl.scrollTop + viewportEl.clientHeight / 2) / previous
  };
  zoom = clamp(Number(nextZoom) || 1, MIN_ZOOM, MAX_ZOOM);
  boardEl.style.transform = `scale(${zoom})`;
  stageEl.style.width = `${boardWidth * zoom}px`;
  stageEl.style.height = `${boardHeight * zoom}px`;
  zoomLabelEl.textContent = `${Math.round(zoom * 100)}%`;
  if (preserveCenter) {
    viewportEl.scrollLeft = center.x * zoom - viewportEl.clientWidth / 2;
    viewportEl.scrollTop = center.y * zoom - viewportEl.clientHeight / 2;
  }
  updateMinimapViewport();
  positionSelectionActions();
  scheduleSave();
}

function blockBrowserPageZoomShortcut(event) {
  if (!currentBoard || !(event.metaKey || event.ctrlKey)) return false;
  if (!["+", "=", "-", "0"].includes(event.key)) return false;
  // 白板缩放只由画布手势和右下角控件控制，页面框架始终保持 100%。
  event.preventDefault();
  return true;
}

function blockBrowserPageZoomOutsideCanvas(event) {
  if (!currentBoard || !(event.metaKey || event.ctrlKey)) return;
  if (viewportEl.contains(event.target)) return;
  // 阻止 Chrome 在工具栏、侧栏和浮层上执行整页缩放。
  event.preventDefault();
}

function fitBoard() {
  if (!boardItems.length) {
    setZoom(1, false);
    viewportEl.scrollLeft = 0;
    viewportEl.scrollTop = 0;
    return;
  }
  const padding = 80;
  const minX = Math.max(0, Math.min(...boardItems.map(item => item.x)) - padding);
  const minY = Math.max(0, Math.min(...boardItems.map(item => item.y)) - padding);
  const maxX = Math.max(...boardItems.map(item => item.x + item.width)) + padding;
  const maxY = Math.max(...boardItems.map(item => item.y + item.height)) + padding;
  const next = clamp(
    Math.min(viewportEl.clientWidth / Math.max(1, maxX - minX), viewportEl.clientHeight / Math.max(1, maxY - minY)),
    MIN_ZOOM,
    1
  );
  setZoom(next, false);
  viewportEl.scrollLeft = minX * zoom;
  viewportEl.scrollTop = minY * zoom;
  updateMinimapViewport();
}

function renderMinimap() {
  if (minimapRenderFrame) return;
  minimapRenderFrame = requestAnimationFrame(() => {
    minimapRenderFrame = undefined;
    renderMinimapNow();
  });
}

function renderMinimapNow() {
  minimapItemsEl.replaceChildren();
  const scaleX = minimapEl.clientWidth / boardWidth;
  const scaleY = minimapEl.clientHeight / boardHeight;
  for (const item of boardItems) {
    const marker = document.createElement("div");
    marker.className = "minimap-item";
    marker.style.left = `${item.x * scaleX}px`;
    marker.style.top = `${item.y * scaleY}px`;
    marker.style.width = `${Math.max(2, item.width * scaleX)}px`;
    marker.style.height = `${Math.max(2, item.height * scaleY)}px`;
    minimapItemsEl.appendChild(marker);
  }
  updateMinimapViewport();
}

function updateMinimapViewport() {
  if (!minimapEl.clientWidth || !viewportEl.clientWidth) return;
  const scaleX = minimapEl.clientWidth / boardWidth;
  const scaleY = minimapEl.clientHeight / boardHeight;
  minimapViewportEl.style.left = `${viewportEl.scrollLeft / zoom * scaleX}px`;
  minimapViewportEl.style.top = `${viewportEl.scrollTop / zoom * scaleY}px`;
  minimapViewportEl.style.width = `${Math.min(minimapEl.clientWidth, viewportEl.clientWidth / zoom * scaleX)}px`;
  minimapViewportEl.style.height = `${Math.min(minimapEl.clientHeight, viewportEl.clientHeight / zoom * scaleY)}px`;
}

function initializeBoardDimensions(board) {
  const contentMaxX = boardItems.length ? Math.max(...boardItems.map(item => item.x + item.width)) : 0;
  const contentMaxY = boardItems.length ? Math.max(...boardItems.map(item => item.y + item.height)) : 0;
  const requiredWidth = contentMaxX + BOARD_GROW_GUTTER;
  const requiredHeight = contentMaxY + BOARD_GROW_GUTTER;
  boardWidth = Math.max(
    INITIAL_BOARD_WIDTH,
    Number(board.viewport?.canvasWidth) || 0,
    Math.ceil(requiredWidth / BOARD_EXPANSION_STEP) * BOARD_EXPANSION_STEP
  );
  boardHeight = Math.max(
    INITIAL_BOARD_HEIGHT,
    Number(board.viewport?.canvasHeight) || 0,
    Math.ceil(requiredHeight / BOARD_EXPANSION_STEP) * BOARD_EXPANSION_STEP
  );
  applyBoardDimensions();
}

function restoreRunningTasksForBoard(board) {
  for (const item of boardItems) {
    if (item.type !== "task" || item.taskStatus !== "running") continue;
    const runId = String(item.taskRunId || "");
    const messages = normalizeTaskMessages(item.taskMessages, item);
    const lastUserMessage = [...messages].reverse().find(message => message.role === "user");
    const workflowPlanning = item.taskWorkflowRole === "controller" && item.taskWorkflowTitle === "正在规划";
    if (runId.startsWith("scheduled-")) continue;
    if (!runId || !codexActiveTaskIds.has(runId)) {
      item.taskStatus = "error";
      item.taskProgress = "";
      item.taskRunId = "";
      item.taskCompletedAt = Date.now();
      item.taskError = item.taskWorkflowRole === "controller"
        ? "页面刷新中断了工作流调度，已有内容已保留，请点击重试继续执行"
        : "任务连接已中断，原始内容已经保留，可以重新执行";
      item.text = String(item.text || lastUserMessage?.text || "");
      appendTaskEvent(item, { stage: "interrupted", label: "任务连接已中断", status: "error" });
      continue;
    }
    const task = {
      id: runId,
      itemId: item.id,
      taskItemId: item.id,
      boardId: board.id,
      boardName: board.name,
      mode: workflowPlanning ? "workflow-plan" : item.taskLastMode,
      selectionIds: [...(item.taskSourceIds || [])],
      sourceCount: item.taskSourceCount || 0,
      point: aiResultPoint([item]),
      materials: [],
      userMessageId: lastUserMessage?.id || "",
      userPrompt: lastUserMessage?.text || "",
      messagesBefore: messages.slice(0, -1),
      conversationMessages: messages,
      contextSnapshot: item.taskGenerationSnapshot || null,
      taskEvents: item.taskEvents || [],
      resumed: true
    };
    if (workflowPlanning || ["text", "image", "image-gen", "video", "video-post"].includes(item.taskLastMode)) whiteboardCodexTasks.set(runId, task);
    else boardCardCodexTasks.set(runId, task);
    item.taskProgress = item.taskProgress || "正在恢复任务进度";
    appendTaskEvent(item, { stage: "resumed", label: "已恢复任务连接", status: "running" });
    console.info("[pagedock-task] resumed", { taskId: runId, itemId: item.id, mode: item.taskLastMode });
  }
}

async function openBoard(boardId, updateUrl = true) {
  await flushSave();
  const board = await db.getBoard(boardId);
  if (!board) {
    await renderHome(updateUrl);
    return;
  }
  if (currentBoard?.id && currentBoard.id !== board.id) {
    await Promise.all([...terminalSessions.values()].map(session => closeTerminalSession(session.item)));
    disposeTerminalRenderers();
  }
  currentBoard = board;
  lastBoardPoint = undefined;
  insertionCascade = 0;
  boardItems = board.items.map(item => {
    const taskMessages = item.type === "task" ? normalizeTaskMessages(item.taskMessages, item) : [];
    const migratedLegacyTask = item.type === "task"
      && !Array.isArray(item.taskMessages)
      && Boolean(item.taskResult);
    return {
      ...item,
      text: migratedLegacyTask ? "" : item.text,
      taskMessages,
      taskStatus: item.taskStatus,
      terminalStatus: item.type === "terminal"
        && ["running", "connecting", "connected"].includes(item.terminalStatus)
        && !codexActiveTaskIds.has(item.terminalTaskId)
        ? (item.terminalStatus === "running" ? "cancelled" : "closed")
        : item.terminalStatus,
      terminalTaskId: item.type === "terminal"
        && item.terminalStatus === "running"
        && !codexActiveTaskIds.has(item.terminalTaskId)
        ? ""
        : item.terminalTaskId,
      taskProgress: String(item.taskProgress || ""),
      taskEvents: compactTaskEvents(item.taskEvents),
      taskGenerationScope: ["latest", "conversation", "sources", "message"].includes(item.taskGenerationScope)
        ? item.taskGenerationScope
        : "",
      taskGenerationMessageId: String(item.taskGenerationMessageId || ""),
      taskReplyMessageId: String(item.taskReplyMessageId || ""),
      taskGenerationSnapshot: item.taskGenerationSnapshot ? clone(item.taskGenerationSnapshot) : null
    };
  });
  restoreRunningTasksForBoard(board);
  for (const [taskId, terminalTask] of terminalTasks) {
    if (terminalTask.boardId === board.id) terminalTasks.delete(taskId);
  }
  for (const item of boardItems) {
    if (item.type === "terminal" && item.terminalStatus === "running" && item.terminalTaskId) {
      terminalTasks.set(item.terminalTaskId, { boardId: board.id, item });
    }
  }
  initializeBoardDimensions(board);
  selectedIds.clear();
  setView("board");
  if (updateUrl) history.pushState({}, "", `${location.pathname}?board=${encodeURIComponent(board.id)}`);
  document.title = `${board.name} · 拾作`;
  boardNameEl.value = board.name;
  renderAllItems();
  setZoom(board.viewport?.zoom || 1, false);
  resetHistory();
  requestAnimationFrame(() => {
    viewportEl.scrollLeft = Number(board.viewport?.scrollLeft) || 0;
    viewportEl.scrollTop = Number(board.viewport?.scrollTop) || 0;
    updateMinimapViewport();
  });
}

function pastedImageSource(clipboardData) {
  const html = clipboardData?.getData("text/html");
  if (!html) return "";
  const parsed = new DOMParser().parseFromString(html, "text/html");
  return parsed.querySelector("img")?.getAttribute("src") || "";
}

async function addClipboardToInbox(event) {
  const imageFiles = [...(event.clipboardData?.items || [])]
    .filter(item => item.type.startsWith("image/"))
    .map(item => item.getAsFile())
    .filter(Boolean);
  if (imageFiles.length) {
    for (const file of imageFiles) {
      const src = await readFileAsDataUrl(file);
      await db.addItem(db.INBOX_ID, { type: "image", src, alt: file.name });
    }
    return true;
  }
  const imageSrc = pastedImageSource(event.clipboardData);
  if (imageSrc) {
    await db.addItem(db.INBOX_ID, { type: "image", src: imageSrc });
    return true;
  }
  const text = event.clipboardData?.getData("text/plain")?.trim();
  if (text) {
    await db.addItem(db.INBOX_ID, { type: "text", text });
    return true;
  }
  return false;
}

function isEditableClipboardTarget(target) {
  return Boolean(target?.closest?.(
    'input,textarea,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'
  ));
}

async function handlePaste(event) {
  // 输入框、文档/代码编辑器和 xterm 的隐藏 textarea 必须优先使用浏览器原生粘贴。
  // 只有焦点位于非编辑区域时，拾作才把剪贴板内容转换成白板卡片。
  if (isEditableClipboardTarget(event.target)) return;
  if (!currentBoard) {
    if (await addClipboardToInbox(event)) {
      event.preventDefault();
      await renderHome(false);
    }
    return;
  }
  const internal = event.clipboardData?.getData(CLIPBOARD_TYPE);
  if (internal) {
    event.preventDefault();
    try {
      const copied = JSON.parse(internal);
      const groupMap = new Map();
      const idMap = new Map(copied.map(item => [String(item.id), db.makeId()]));
      copied.forEach((item, index) => {
        const groupId = item.groupId
          ? groupMap.get(item.groupId) || db.makeId("group")
          : "";
        if (item.groupId) groupMap.set(item.groupId, groupId);
        addBoardItem({
          ...item,
          id: idMap.get(String(item.id)),
          x: item.x + 34 + index * 3,
          y: item.y + 34 + index * 3,
          groupId,
          terminalSessionId: item.type === "terminal" ? "" : item.terminalSessionId,
          terminalStatus: item.type === "terminal" ? "closed" : item.terminalStatus,
          taskSourceIds: (item.taskSourceIds || []).map(id => idMap.get(String(id)) || String(id)),
          relationSourceIds: (item.relationSourceIds || []).map(id => idMap.get(String(id)) || String(id)),
          card: item.card ? {
            ...item.card,
            inputs: (item.card.inputs || []).map(connection => ({
              ...connection,
              id: db.makeId("connection"),
              sourceId: idMap.get(String(connection.sourceId)) || String(connection.sourceId),
              targetId: idMap.get(String(connection.targetId)) || idMap.get(String(item.id))
            }))
          } : undefined
        });
      });
      return;
    } catch (_) { /* fall through to normal clipboard content */ }
  }
  const imageFiles = [...(event.clipboardData?.items || [])]
    .filter(item => item.type.startsWith("image/"))
    .map(item => item.getAsFile())
    .filter(Boolean);
  if (imageFiles.length) {
    event.preventDefault();
    await addImageFiles(imageFiles);
    return;
  }
  const imageSrc = pastedImageSource(event.clipboardData);
  if (imageSrc) {
    event.preventDefault();
    await addImageSource(imageSrc);
    return;
  }
  const text = event.clipboardData?.getData("text/plain") || "";
  if (text) {
    event.preventDefault();
    if (/^https?:\/\/\S+$/i.test(text.trim())) addLinkItem(text.trim());
    else addTextItem(text);
  }
}

function handleCopy(event) {
  const selection = window.getSelection();
  const selectedText = selection && !selection.isCollapsed ? selection.toString() : "";
  const editingText = isEditableClipboardTarget(event.target);
  if (editingText) return;
  // 显式覆盖拾作自定义卡片格式，避免文字复制后再次粘贴时仍命中整卡片数据。
  if (selectedText) {
    event.clipboardData.clearData();
    event.clipboardData.setData("text/plain", selectedText);
    event.preventDefault();
    return;
  }
  if (!currentBoard || !selectedIds.size || editingText) return;
  const copied = boardItems.filter(item => selectedIds.has(item.id));
  event.clipboardData.setData(CLIPBOARD_TYPE, JSON.stringify(copied));
  event.clipboardData.setData("text/plain", copied.map(itemLabel).join("\n\n"));
  event.preventDefault();
  setStatus(`已复制 ${copied.length} 项`);
}

function startMarquee(event) {
  if (event.button !== 0 || event.target !== boardEl || spacePressed) return;
  event.preventDefault();
  const pointerId = event.pointerId;
  const start = boardPointFromEvent(event);
  const startClient = { x: event.clientX, y: event.clientY };
  const baseSelection = event.shiftKey ? new Set(selectedIds) : new Set();
  let dragging = false;
  boardEl.setPointerCapture(event.pointerId);
  const move = moveEvent => {
    if (!boardEl.hasPointerCapture(moveEvent.pointerId)) return;
    if (!dragging) {
      const distance = Math.hypot(
        moveEvent.clientX - startClient.x,
        moveEvent.clientY - startClient.y
      );
      if (distance < MARQUEE_DRAG_THRESHOLD_PX) return;
      dragging = true;
      marqueeEl.classList.remove("hidden");
    }
    const end = boardPointFromEvent(moveEvent);
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const right = Math.max(start.x, end.x);
    const bottom = Math.max(start.y, end.y);
    marqueeEl.style.left = `${left * zoom}px`;
    marqueeEl.style.top = `${top * zoom}px`;
    marqueeEl.style.width = `${(right - left) * zoom}px`;
    marqueeEl.style.height = `${(bottom - top) * zoom}px`;
    const matches = boardItems
      .filter(item => item.x < right && item.x + item.width > left && item.y < bottom && item.y + item.height > top)
      .map(item => item.id);
    selectItems([...new Set([...baseSelection, ...matches])]);
  };
  const finish = finishEvent => {
    if (finishEvent?.pointerId !== undefined && finishEvent.pointerId !== pointerId) return;
    marqueeEl.classList.add("hidden");
    marqueeEl.removeAttribute("style");
    boardEl.removeEventListener("pointermove", move);
    boardEl.removeEventListener("pointerup", finish);
    boardEl.removeEventListener("pointercancel", finish);
    boardEl.removeEventListener("lostpointercapture", finish);
    window.removeEventListener("blur", finish);
    document.removeEventListener("visibilitychange", finish);
    if (boardEl.hasPointerCapture(pointerId)) boardEl.releasePointerCapture(pointerId);
  };
  boardEl.addEventListener("pointermove", move);
  boardEl.addEventListener("pointerup", finish);
  boardEl.addEventListener("pointercancel", finish);
  boardEl.addEventListener("lostpointercapture", finish);
  window.addEventListener("blur", finish);
  document.addEventListener("visibilitychange", finish);
  if (!event.shiftKey) selectItems([]);
}

function setupPanning() {
  let pan;
  viewportEl.addEventListener("pointerdown", event => {
    if (!(event.button === 1 || (event.button === 0 && spacePressed))) return;
    event.preventDefault();
    event.stopPropagation();
    pan = {
      clientX: event.clientX,
      clientY: event.clientY,
      scrollLeft: viewportEl.scrollLeft,
      scrollTop: viewportEl.scrollTop
    };
    viewportEl.setPointerCapture(event.pointerId);
  }, true);
  viewportEl.addEventListener("pointermove", event => {
    if (!pan || !viewportEl.hasPointerCapture(event.pointerId)) return;
    let nextLeft = pan.scrollLeft - (event.clientX - pan.clientX);
    let nextTop = pan.scrollTop - (event.clientY - pan.clientY);
    const edge = 80;
    if (nextLeft < edge && event.clientX > pan.clientX) {
      prependBoardSpace(BOARD_EXPANSION_STEP, 0);
      pan.scrollLeft += BOARD_EXPANSION_STEP * zoom;
      nextLeft += BOARD_EXPANSION_STEP * zoom;
    }
    if (nextTop < edge && event.clientY > pan.clientY) {
      prependBoardSpace(0, BOARD_EXPANSION_STEP);
      pan.scrollTop += BOARD_EXPANSION_STEP * zoom;
      nextTop += BOARD_EXPANSION_STEP * zoom;
    }
    let expanded = false;
    while (nextLeft + viewportEl.clientWidth > boardWidth * zoom - edge) {
      boardWidth += BOARD_EXPANSION_STEP;
      expanded = true;
    }
    while (nextTop + viewportEl.clientHeight > boardHeight * zoom - edge) {
      boardHeight += BOARD_EXPANSION_STEP;
      expanded = true;
    }
    if (expanded) applyBoardDimensions();
    viewportEl.scrollLeft = nextLeft;
    viewportEl.scrollTop = nextTop;
    scheduleConnectionRender();
    renderMinimap();
  });
  const finish = event => {
    if (!pan || !viewportEl.hasPointerCapture(event.pointerId)) return;
    viewportEl.releasePointerCapture(event.pointerId);
    pan = undefined;
    scheduleSave();
  };
  viewportEl.addEventListener("pointerup", finish);
  viewportEl.addEventListener("pointercancel", finish);
}
