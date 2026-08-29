// Module: canvas coordinates, selection, relationships, and dragging.
function closeDialogFromBackdrop(event) {
  if (event.target === event.currentTarget) event.currentTarget.close();
}

function boardPointFromEvent(event) {
  const rect = viewportEl.getBoundingClientRect();
  return {
    x: clamp((viewportEl.scrollLeft + event.clientX - rect.left) / zoom, 0, boardWidth),
    y: clamp((viewportEl.scrollTop + event.clientY - rect.top) / zoom, 0, boardHeight)
  };
}

function viewportCenter() {
  return {
    x: (viewportEl.scrollLeft + viewportEl.clientWidth / 2) / zoom,
    y: (viewportEl.scrollTop + viewportEl.clientHeight / 2) / zoom
  };
}

function insertionPoint(offset = 0) {
  const point = lastBoardPoint || viewportCenter();
  const cascade = insertionCascade;
  insertionCascade = (insertionCascade + 28) % 168;
  return {
    x: Math.max(12, point.x - 140 + cascade + offset),
    y: Math.max(12, point.y - 70 + cascade + offset)
  };
}

function taskInsertionPoint() {
  const point = insertionPoint();
  // The pointer leaves the canvas through its top edge before the user clicks
  // the toolbar menu. Keep a new task visually separated from that edge.
  const visibleTop = viewportEl.scrollTop / zoom;
  const topGutter = 48 / zoom;
  return { ...point, y: Math.max(point.y, visibleTop + topGutter) };
}

function itemById(id) {
  return boardItems.find(item => item.id === id);
}

function itemElement(id) {
  if (focusedItemId === id && focusedItemElement?.isConnected) return focusedItemElement;
  return boardEl.querySelector(`[data-id="${CSS.escape(id)}"]`);
}

function setItemFocusButtonState(button, active) {
  if (!button) return;
  button.dataset.active = String(active);
  button.setAttribute("aria-label", active ? "退出全屏" : "全屏查看");
  button.title = active ? "退出全屏 (Esc)" : "全屏查看";
}

function setItemCloseButtonState(button, focused) {
  if (!button) return;
  button.setAttribute("aria-label", focused ? "退出全屏" : "删除卡片");
  button.title = focused ? "退出全屏" : "删除卡片";
}

function enterItemFocus(item, element) {
  if (!item || !element) return;
  if (focusedItemId === item.id) {
    exitItemFocus();
    return;
  }
  if (focusedItemId) exitItemFocus();
  focusedItemId = item.id;
  focusedItemElement = element;
  cardFocusLayerEl.hidden = false;
  document.body.classList.add("card-focus-active");
  element.classList.add("item-focused");
  cardFocusLayerEl.appendChild(element);
  setItemFocusButtonState(element.querySelector(".item-focus"), true);
  setItemCloseButtonState(element.querySelector(".delete-item"), true);
  selectItems([item.id], true);
  requestAnimationFrame(() => element.querySelector(".item-focus")?.focus({ preventScroll: true }));
  console.info("[shizuo-card-focus] entered", { itemId: item.id, type: item.type });
}

function exitItemFocus(restore = true, returnFocus = true) {
  if (!focusedItemId) return;
  const itemId = focusedItemId;
  const item = itemById(itemId);
  const element = focusedItemElement;
  focusedItemId = "";
  focusedItemElement = undefined;
  document.body.classList.remove("card-focus-active");
  cardFocusLayerEl.hidden = true;
  if (element) {
    element.classList.remove("item-focused");
    setItemFocusButtonState(element.querySelector(".item-focus"), false);
    setItemCloseButtonState(element.querySelector(".delete-item"), false);
    if (restore && item && currentBoard) {
      element.style.left = `${item.x}px`;
      element.style.top = `${item.y}px`;
      element.style.width = `${item.width}px`;
      element.style.height = `${item.height}px`;
      element.style.zIndex = item.z;
      boardEl.appendChild(element);
      if (returnFocus) requestAnimationFrame(() => element.querySelector(".item-focus")?.focus({ preventScroll: true }));
    } else {
      element.remove();
    }
  }
  updateSelectionUi();
  renderConnections();
  renderMinimap();
  console.info("[shizuo-card-focus] exited", { itemId, restored: Boolean(restore && item && currentBoard) });
}

function selectedItems() {
  return [...selectedIds].map(itemById).filter(Boolean);
}

function relationSourceIds(item) {
  const ids = [
    ...(cardProtocol?.connectionSources(item) || []),
    ...(Array.isArray(item.relationSourceIds) ? item.relationSourceIds : []),
    ...(item.type === "task" && Array.isArray(item.taskSourceIds) ? item.taskSourceIds : [])
  ].map(String);
  return [...new Set(ids)].filter(id => id !== item.id && itemById(id));
}

function relationEdges(items = boardItems) {
  const targets = new Set(items.map(item => item.id));
  return items.flatMap(target => relationSourceIds(target)
    .filter(sourceId => targets.has(sourceId))
    .map(sourceId => ({ source: itemById(sourceId), target }))
    .filter(edge => edge.source));
}

function cardTextOutput(item) {
  if (!item) return "";
  if (item.type === "task") {
    const latest = [...normalizeTaskMessages(item.taskMessages, item)].reverse().find(message => message.role === "assistant");
    return latest?.text || item.taskResult || item.text || "";
  }
  if (item.type === "terminal") return item.terminalOutput || item.text || "";
  if (item.type === "file") return item.localPreview || `${item.localName || "文件"}${item.localMime ? ` (${item.localMime})` : ""}`;
  if (item.type === "folder") return (item.localEntries || []).map(entry => `${entry.kind === "directory" ? "[目录]" : "[文件]"} ${entry.name}`).join("\n");
  if (item.type === "page") {
    return [item.text, item.src, item.pageContent ? `页面正文：\n${item.pageContent}` : ""].filter(Boolean).join("\n\n");
  }
  if (item.type === "link") return [item.text, item.src].filter(Boolean).join("\n");
  if (item.type === "image") return [item.alt || "图片", item.source?.url].filter(Boolean).join("\n");
  if (item.type === "video") return [item.alt || "视频", item.src].filter(Boolean).join("\n");
  return item.text || "";
}

function pagePermissionOrigin(value) {
  const url = new URL(String(value || ""));
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("页面卡地址不是可读取的 HTTP(S) 网页");
  return `${url.protocol}//${url.host}/*`;
}

async function hydratePageCardsForCodex(items, onProgress = () => {}) {
  const pages = items.filter(item => item.type === "page" && item.src);
  if (!pages.length) return;
  const origins = [...new Set(pages.flatMap(item => [
    pagePermissionOrigin(item.src),
    item.pageContentRequiredOrigin
  ].filter(Boolean)))];
  // 必须直接发生在“发送/快捷能力”用户手势中；Chrome 会按实际域名展示一次读取授权。
  const alreadyAllowed = await chrome.permissions.contains({ origins });
  const allowed = alreadyAllowed || await chrome.permissions.request({ origins });
  if (!allowed) {
    pages.forEach(item => {
      cardProtocol.revoke(item, "page-content-read");
      updatePermissionChip(item);
    });
    const hosts = pages.map(item => new URL(item.src).host).join("、");
    throw new Error(`未允许读取 ${hosts} 的页面内容，Codex 尚未收到正文`);
  }
  for (const item of pages) {
    cardProtocol.grant(item, "page-content-read");
    updatePermissionChip(item);
  }
  scheduleSave();

  for (let index = 0; index < pages.length; index += 1) {
    const item = pages[index];
    onProgress(pages.length > 1 ? `正在读取页面 ${index + 1}/${pages.length}` : "正在读取页面内容");
    const response = await chrome.runtime.sendMessage({
      type: PAGE_CARD_CONTEXT_REQUEST,
      url: item.src
    });
    if (!response?.ok) {
      if (response?.requiredOrigin) {
        item.pageContentRequiredOrigin = String(response.requiredOrigin);
        cardProtocol.revoke(item, "page-content-read");
        updatePermissionChip(item);
        item.updatedAt = Date.now();
        scheduleSave();
        throw new Error(`页面跳转到了 ${response.requiredHost || "另一个站点"}，请点击重试并允许读取`);
      }
      throw new Error(response?.error || `无法读取页面：${itemLabel(item)}`);
    }
    const content = String(response.content || "").trim();
    if (!content) throw new Error(`页面“${itemLabel(item)}”没有提取到可分析内容`);
    item.pageContent = content.slice(0, 600_000);
    item.pageContentUrl = String(response.url || item.src);
    item.pageContentMode = String(response.mode || "");
    item.pageContentCapturedAt = Date.now();
    delete item.pageContentRequiredOrigin;
    item.updatedAt = Date.now();
    console.info("[pagedock-page] content collected for Codex", {
      itemId: item.id,
      contentLength: item.pageContent.length,
      mode: item.pageContentMode,
      reachedEnd: response.reachedEnd !== false
    });
  }
  scheduleSave();
}

function connectSelectedItems() {
  const [source, target] = selectedItems();
  if (!source || !target) return;
  try {
    cardProtocol.connect(source, target);
    target.updatedAt = Date.now();
    // 可编辑文本卡在建立连接时接收一次当前内容；任务卡在每轮执行前读取最新上游内容。
    if (["text", "document", "code"].includes(target.type)) {
      const incoming = cardTextOutput(source).trim();
      if (incoming) target.text = target.text ? `${target.text}\n\n${incoming}` : incoming;
      const editor = itemElement(target.id)?.querySelector(".text-content,.document-editor,.code-editor");
      if (editor) {
        if (editor instanceof HTMLTextAreaElement) editor.value = target.text;
        else editor.textContent = target.text;
      }
    }
    renderConnections();
    scheduleSave();
    commitHistory();
    setStatus(`已连接：${itemTypeLabel(source)} → ${itemTypeLabel(target)}`);
    console.info("[pagedock-card] cards connected", { sourceId: source.id, targetId: target.id, targetType: target.type });
  } catch (error) {
    setStatus(error?.message || "卡片连接失败", true);
  }
}

function relationGeometry(source, target) {
  const sourceCenter = { x: source.x + source.width / 2, y: source.y + source.height / 2 };
  const targetCenter = { x: target.x + target.width / 2, y: target.y + target.height / 2 };
  const horizontal = Math.abs(targetCenter.x - sourceCenter.x) >= Math.abs(targetCenter.y - sourceCenter.y);
  if (horizontal) {
    const direction = targetCenter.x >= sourceCenter.x ? 1 : -1;
    const start = { x: sourceCenter.x + direction * source.width / 2, y: sourceCenter.y };
    const end = { x: targetCenter.x - direction * target.width / 2, y: targetCenter.y };
    const control = Math.max(48, Math.abs(end.x - start.x) * .45);
    return {
      start,
      end,
      control1: { x: start.x + direction * control, y: start.y },
      control2: { x: end.x - direction * control, y: end.y }
    };
  }
  const direction = targetCenter.y >= sourceCenter.y ? 1 : -1;
  const start = { x: sourceCenter.x, y: sourceCenter.y + direction * source.height / 2 };
  const end = { x: targetCenter.x, y: targetCenter.y - direction * target.height / 2 };
  const control = Math.max(48, Math.abs(end.y - start.y) * .45);
  return {
    start,
    end,
    control1: { x: start.x, y: start.y + direction * control },
    control2: { x: end.x, y: end.y - direction * control }
  };
}

function renderConnections() {
  cancelAnimationFrame(connectionRenderFrame);
  connectionRenderFrame = undefined;
  const definitions = document.createElementNS(SVG_NS, "defs");
  const marker = document.createElementNS(SVG_NS, "marker");
  marker.setAttribute("id", "relationArrow");
  marker.setAttribute("viewBox", "0 0 8 8");
  marker.setAttribute("refX", "7");
  marker.setAttribute("refY", "4");
  marker.setAttribute("markerWidth", "7");
  marker.setAttribute("markerHeight", "7");
  marker.setAttribute("orient", "auto-start-reverse");
  const arrow = document.createElementNS(SVG_NS, "path");
  arrow.setAttribute("d", "M 0 0 L 8 4 L 0 8 z");
  arrow.setAttribute("fill", "var(--color-accent)");
  marker.appendChild(arrow);
  definitions.appendChild(marker);
  const paths = relationEdges().map(({ source, target }) => {
    const geometry = relationGeometry(source, target);
    const path = document.createElementNS(SVG_NS, "path");
    path.classList.add("relation-line");
    path.dataset.sourceId = source.id;
    path.dataset.targetId = target.id;
    path.setAttribute("marker-end", "url(#relationArrow)");
    path.setAttribute("d", `M ${geometry.start.x} ${geometry.start.y} C ${geometry.control1.x} ${geometry.control1.y}, ${geometry.control2.x} ${geometry.control2.y}, ${geometry.end.x} ${geometry.end.y}`);
    return path;
  });
  connectionLayerEl.replaceChildren(definitions, ...paths);
}

function scheduleConnectionRender() {
  if (connectionRenderFrame) return;
  connectionRenderFrame = requestAnimationFrame(renderConnections);
}

function taskMatchesCurrentSelection(task = standaloneWhiteboardTask()) {
  if (!task || task.boardId !== currentBoard?.id) return false;
  if (task.taskItemId) return selectedIds.has(task.taskItemId);
  // AI progress belongs to the cards that started the task, never to whichever cards are selected later.
  const taskSelectionIds = Array.isArray(task.selectionIds) ? task.selectionIds : [];
  return taskSelectionIds.length === selectedIds.size
    && taskSelectionIds.every(id => selectedIds.has(id));
}

function updateWhiteboardCodexStatus(task, text) {
  if (!task) return;
  task.status = String(text || "");
  if (task.mode === "knowledge" && task.resultItemId) {
    const loading = itemElement(task.resultItemId)?.querySelector(".knowledge-card-loading");
    if (loading) loading.querySelector("span").textContent = task.status;
  }
  if (whiteboardCodexTasks.get(task.id) === task && task.boardId === currentBoard?.id) {
    if (task.taskItemId) {
      const item = itemById(task.taskItemId);
      if (item) {
        item.taskProgress = task.status;
        updateTaskItemElement(item);
      }
    } else {
      selectionAiStatusEl.textContent = task.status;
      selectionAiStatusEl.title = task.status;
      selectionAiStatusEl.classList.toggle("hidden", !task.status);
    }
  }
}

function finishKnowledgeCardPlaceholder(task, state, message) {
  if (task?.mode !== "knowledge" || !task.resultItemId || task.boardId !== currentBoard?.id) return;
  const item = itemById(task.resultItemId);
  if (!item || item.knowledgeState === "success") return;
  item.knowledgeState = state;
  item.text = message;
  item.updatedAt = Date.now();
  const loading = itemElement(item.id)?.querySelector(".knowledge-card-loading");
  if (loading) {
    loading.dataset.state = state;
    loading.querySelector("span").textContent = message;
  }
  scheduleSave();
}

function positionSelectionMenu() {
  const toolbarRect = selectionActionsEl.getBoundingClientRect();
  const gap = 8;
  const viewportMargin = 12;
  const menuHeight = selectionMorePanelEl.scrollHeight || 228;
  const spaceAbove = toolbarRect.top - gap - viewportMargin;
  const spaceBelow = window.innerHeight - toolbarRect.bottom - gap - viewportMargin;
  const opensAbove = spaceBelow < menuHeight && spaceAbove > spaceBelow;
  const availableHeight = Math.max(48, opensAbove ? spaceAbove : spaceBelow);
  selectionActionsEl.dataset.menuPlacement = opensAbove ? "above" : "below";
  selectionActionsEl.style.setProperty("--selection-menu-max-height", `${Math.floor(availableHeight)}px`);
}

function positionSelectionActions() {
  if (selectionActionsEl.classList.contains("hidden")) return;
  const rectangles = [...selectedIds]
    .map(id => itemElement(id)?.getBoundingClientRect())
    .filter(Boolean);
  if (!rectangles.length) {
    selectionActionsEl.classList.add("hidden");
    return;
  }
  const left = Math.min(...rectangles.map(rect => rect.left));
  const right = Math.max(...rectangles.map(rect => rect.right));
  const top = Math.min(...rectangles.map(rect => rect.top));
  const bottom = Math.max(...rectangles.map(rect => rect.bottom));
  const menuWidth = selectionActionsEl.offsetWidth;
  const menuHeight = selectionActionsEl.offsetHeight;
  const nextLeft = clamp((left + right - menuWidth) / 2, 12, window.innerWidth - menuWidth - 12);
  const above = top - menuHeight - 10;
  const nextTop = above >= 66
    ? above
    : clamp(bottom + 10, 66, window.innerHeight - menuHeight - 12);
  selectionActionsEl.style.left = `${Math.round(nextLeft)}px`;
  selectionActionsEl.style.top = `${Math.round(nextTop)}px`;
  positionSelectionMenu();
}

function aiResultPoint(items) {
  const top = Math.min(...items.map(item => item.y));
  const right = Math.max(...items.map(item => item.x + item.width));
  return { x: right + 36, y: top };
}

function updateEmptyState() {
  emptyStateEl.classList.toggle("hidden", boardItems.length > 0);
  optimizeLayoutEl.disabled = boardItems.length < 2;
  optimizeLayoutEl.title = boardItems.length < 2
    ? "至少添加 2 个模块后才能优化布局"
    : "按模块关系自动分层并减少连线交叉";
}

function updateSelectionUi() {
  boardViewEl.querySelectorAll(".board-item").forEach(element => {
    element.classList.toggle("selected", selectedIds.has(element.dataset.id));
  });
  const selection = selectedItems();
  const canAlign = selectedIds.size > 1;
  document.getElementById("alignLeft").disabled = !canAlign;
  document.getElementById("alignTop").disabled = !canAlign;
  document.getElementById("connectItems").disabled = selectedIds.size !== 2;
  document.getElementById("connectItems").title = selectedIds.size === 2
    ? "按选择顺序连接：第一张卡片输出到第二张卡片"
    : "请选择两张卡片";
  document.getElementById("groupItems").disabled = !canAlign;
  document.getElementById("ungroupItems").disabled = ![...selectedIds]
    .some(id => itemById(id)?.groupId);
  selectionActionCountEl.textContent = `已选 ${selection.length} 项`;
  askSelectionWithCodexEl.disabled = !selection.length;
  askSelectionWithCodexEl.title = "基于所选内容继续提问或创作";
  extractKnowledgeCardEl.disabled = !selection.length || codexAtCapacity() || Boolean(standaloneWhiteboardTask());
  extractKnowledgeCardEl.title = selection.some(item => item.type === "folder")
    ? "文件夹仅按当前目录索引提炼，不会读取未明确打开的文件正文"
    : "把所选内容提炼为可编辑、可搜索的知识卡";
  selectionActionsEl.classList.toggle("hidden", !selection.length);
  if (!selection.length) document.getElementById("selectionMoreMenu").open = false;
  updateCodexSelectionContext();
  updateAllTaskItemElements();
  if (selection.length) requestAnimationFrame(positionSelectionActions);
}

function selectItems(ids, bringToFront = false) {
  selectedIds = new Set(ids.filter(id => itemById(id)));
  if (bringToFront && selectedIds.size) {
    for (const id of selectedIds) {
      const item = itemById(id);
      const element = itemElement(id);
      item.z = ++highestZ;
      if (element) element.style.zIndex = item.z;
    }
    scheduleSave();
  }
  updateSelectionUi();
}

function selectFromPointer(item, event) {
  if (event.shiftKey) {
    const next = new Set(selectedIds);
    if (next.has(item.id)) next.delete(item.id);
    else next.add(item.id);
    selectItems([...next], true);
    return;
  }
  if (item.groupId) {
    selectItems(boardItems.filter(candidate => candidate.groupId === item.groupId).map(candidate => candidate.id), true);
    return;
  }
  if (!selectedIds.has(item.id)) selectItems([item.id], true);
}

function syncItemSize(item, element) {
  if (focusedItemId === item.id) return;
  item.width = Math.round(element.offsetWidth);
  item.height = Math.round(element.offsetHeight);
  item.updatedAt = Date.now();
}

function appendSource(element, item) {
  if (!item.source?.url) return;
  const source = document.createElement("div");
  source.className = "source-line";
  const label = document.createElement("span");
  label.textContent = "来源";
  const link = document.createElement("a");
  link.href = item.source.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = item.source.title || item.source.url;
  link.title = item.source.url;
  link.addEventListener("pointerdown", event => event.stopPropagation());
  source.append(label, link);
  element.appendChild(source);
}

function enableDragging(handle, element, item) {
  let dragStart;
  handle.addEventListener("pointerdown", event => {
    if (focusedItemId === item.id || event.button !== 0 || event.target.closest("button")) return;
    event.preventDefault();
    selectFromPointer(item, event);
    const positions = new Map([...selectedIds].map(id => {
      const selected = itemById(id);
      return [id, { x: selected.x, y: selected.y }];
    }));
    dragStart = { clientX: event.clientX, clientY: event.clientY, positions };
    handle.setPointerCapture(event.pointerId);
    selectedIds.forEach(id => itemElement(id)?.classList.add("dragging"));
  });
  handle.addEventListener("pointermove", event => {
    if (!dragStart || !handle.hasPointerCapture(event.pointerId)) return;
    const deltaX = (event.clientX - dragStart.clientX) / zoom;
    const deltaY = (event.clientY - dragStart.clientY) / zoom;
    for (const [id, start] of dragStart.positions) {
      const selected = itemById(id);
      const selectedElement = itemElement(id);
      if (!selected || !selectedElement) continue;
      selected.x = start.x + deltaX;
      selected.y = start.y + deltaY;
      selectedElement.style.left = `${selected.x}px`;
      selectedElement.style.top = `${selected.y}px`;
    }
    ensureBoardContains([...selectedIds].map(itemById).filter(Boolean), dragStart.positions);
    scheduleConnectionRender();
    renderMinimap();
    positionSelectionActions();
  });
  const finish = event => {
    if (!dragStart || !handle.hasPointerCapture(event.pointerId)) return;
    handle.releasePointerCapture(event.pointerId);
    selectedIds.forEach(id => {
      const selected = itemById(id);
      const selectedElement = itemElement(id);
      if (selected && selectedElement) syncItemSize(selected, selectedElement);
      selectedElement?.classList.remove("dragging");
    });
    dragStart = undefined;
    commitHistory();
    scheduleSave();
  };
  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);
}
