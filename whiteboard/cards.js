// Module: common card shell, creation, drops, and material intake.
function createItemElement(item) {
  const element = document.createElement("article");
  element.className = `board-item ${item.type}-item`;
  element.classList.toggle("grouped", Boolean(item.groupId));
  element.dataset.id = item.id;
  element.tabIndex = 0;
  element.setAttribute("role", "group");
  element.setAttribute("aria-label", `${itemTypeLabel(item)}卡片`);
  element.style.left = `${item.x}px`;
  element.style.top = `${item.y}px`;
  element.style.width = `${item.width || 320}px`;
  if (item.height) element.style.height = `${item.height}px`;
  element.style.zIndex = item.z;

  const handle = document.createElement("div");
  handle.className = "item-handle";
  handle.tabIndex = 0;
  handle.setAttribute("role", "button");
  handle.setAttribute("aria-label", "拖动卡片，方向键可微调位置");
  const grip = document.createElement("span");
  grip.className = "grip";
  grip.textContent = "⠿";
  const kind = document.createElement("span");
  kind.className = "item-kind";
  kind.textContent = itemTypeLabel(item);
  const permission = permissionSummary(item);
  const permissionChip = permission ? document.createElement("span") : null;
  if (permissionChip) {
    permissionChip.className = "permission-chip";
    permissionChip.dataset.state = permission.state;
    permissionChip.dataset.risk = permission.risk;
    permissionChip.textContent = permission.state === "granted" ? `已允许 · ${permission.label}` : `需允许 · ${permission.label}`;
    permissionChip.title = permission.state === "granted"
      ? `此卡片已获得：${permission.label}`
      : `只会在你主动操作时请求：${permission.label}`;
  }
  const source = document.createElement("button");
  source.className = "item-source";
  source.type = "button";
  source.textContent = "↗";
  source.title = "查看卡片来源与版本";
  source.setAttribute("aria-label", "查看卡片来源与版本");
  source.addEventListener("pointerdown", event => event.stopPropagation());
  source.addEventListener("click", () => openProvenance(item));
  const focus = document.createElement("button");
  focus.className = "item-focus";
  focus.type = "button";
  focus.innerHTML = [
    '<svg data-icon="expand" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"/></svg>',
    '<svg data-icon="collapse" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5"/></svg>'
  ].join("");
  setItemFocusButtonState(focus, false);
  focus.addEventListener("pointerdown", event => event.stopPropagation());
  focus.addEventListener("click", () => enterItemFocus(item, element));
  const remove = document.createElement("button");
  remove.className = "delete-item";
  remove.type = "button";
  setItemCloseButtonState(remove, false);
  remove.textContent = "×";
  remove.addEventListener("pointerdown", event => event.stopPropagation());
  remove.addEventListener("click", () => {
    if (focusedItemId === item.id) {
      exitItemFocus();
      return;
    }
    if (item.type === "terminal" && ["connected", "connecting"].includes(item.terminalStatus)) closeTerminalSession(item);
    else if (item.type === "terminal" && item.terminalStatus === "running") cancelTerminalItem(item);
    removeItems([item.id]);
  });
  handle.append(grip, kind);
  if (permissionChip) handle.appendChild(permissionChip);
  handle.append(source, focus, remove);
  element.appendChild(handle);

  if (item.type === "image") {
    const content = document.createElement("div");
    content.className = "image-content";
    const image = document.createElement("img");
    image.src = item.src;
    image.alt = item.alt || "白板图片";
    image.loading = "lazy";
    image.decoding = "async";
    content.appendChild(image);
    element.appendChild(content);
  } else if (item.type === "video") {
    const content = document.createElement("div");
    content.className = "video-content";
    const video = document.createElement("video");
    video.src = item.src;
    video.controls = true;
    video.preload = "metadata";
    video.setAttribute("aria-label", item.alt || "AI 生成视频");
    const download = document.createElement("a");
    download.className = "video-download";
    download.href = item.src;
    download.download = item.filename || `${safeFilename(item.alt || "拾作-AI-Video")}.mp4`;
    download.textContent = "下载 MP4";
    const narrate = document.createElement("button");
    narrate.className = "video-narrate";
    narrate.type = "button";
    narrate.textContent = "添加口播与字幕";
    narrate.addEventListener("click", () => {
      const narration = window.prompt("输入口播文案。拾作会按句生成字幕，并使用本地 Kokoro 配音。", "");
      if (!String(narration || "").trim()) return;
      const task = addTaskItem(aiResultPoint([item]), {
        text: String(narration).trim(),
        sourceIds: [item.id],
        sourceCount: 1,
        focus: false
      });
      task.taskLastMode = "video-post";
      runWhiteboardCodex("video-post", task, { scope: "sources" });
    });
    const actions = document.createElement("div");
    actions.className = "video-actions";
    actions.append(narrate, download);
    content.append(video, actions);
    content.addEventListener("pointerdown", event => event.stopPropagation());
    element.appendChild(content);
  } else if (item.type === "page") {
    let pageSrc = "about:blank";
    try {
      pageSrc = normalizedPageUrl(item.src);
    } catch {}
    const content = document.createElement("div");
    content.className = "page-content";
    const address = document.createElement("div");
    address.className = "page-address";
    const open = document.createElement("a");
    if (pageSrc !== "about:blank") {
      open.href = pageSrc;
      open.target = "_blank";
      open.rel = "noopener noreferrer";
    } else {
      open.setAttribute("aria-disabled", "true");
    }
    open.textContent = pageSrc === "about:blank" ? "网页地址不可用" : pageSrc;
    open.title = "在新标签页打开";
    const refresh = document.createElement("button");
    refresh.className = "page-refresh";
    refresh.type = "button";
    refresh.textContent = "↻";
    refresh.title = "重新加载页面";
    refresh.setAttribute("aria-label", "重新加载页面");
    refresh.disabled = pageSrc === "about:blank";
    const frame = document.createElement("iframe");
    frame.className = "page-frame";
    frame.src = pageSrc;
    frame.title = item.text || item.src || "白板页面";
    frame.loading = "lazy";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    // 标题栏仍负责拖拽；网页交互只发生在正文 iframe 中，并限制可用浏览器能力。
    frame.setAttribute("sandbox", "allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-presentation allow-same-origin allow-scripts");
    frame.setAttribute("allow", "clipboard-read; clipboard-write; fullscreen");
    refresh.addEventListener("click", () => {
      frame.src = "about:blank";
      requestAnimationFrame(() => { frame.src = pageSrc; });
    });
    address.append(open, refresh);
    content.append(address, frame);
    content.addEventListener("pointerdown", event => event.stopPropagation());
    element.appendChild(content);
  } else if (item.type === "link") {
    const link = document.createElement("a");
    link.className = "link-content";
    link.href = item.src || item.source?.url || "#";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = item.text || item.source?.title || item.src || "打开链接";
    link.addEventListener("pointerdown", event => event.stopPropagation());
    element.appendChild(link);
  } else if (item.type === "document") {
    createDocumentContent(item, element, false);
  } else if (item.type === "code") {
    createDocumentContent(item, element, true);
  } else if (["file", "folder"].includes(item.type)) {
    createLocalCardContent(item, element);
  } else if (item.type === "task") {
    createTaskContent(item, element);
  } else if (item.type === "terminal") {
    createTerminalContent(item, element);
  } else {
    const content = document.createElement("div");
    content.className = "text-content";
    content.setAttribute("contenteditable", "plaintext-only");
    content.spellcheck = true;
    content.dataset.placeholder = "输入文字…";
    content.setAttribute("aria-label", "白板文字内容");
    content.textContent = item.text || "";
    content.addEventListener("input", () => {
      item.text = content.innerText;
      item.updatedAt = Date.now();
      syncItemSize(item, element);
      scheduleSave();
      queueHistoryCommit();
    });
    element.appendChild(content);
  }
  if (item.type !== "page") appendSource(element, item);

  element.addEventListener("pointerdown", event => {
    if (event.target.closest("a,button,select,.text-content,.document-content,.code-content,.local-card-content,.task-content,.page-content,.terminal-content")) return;
    selectFromPointer(item, event);
  });
  element.addEventListener("focus", () => {
    if (!selectedIds.has(item.id)) selectItems([item.id]);
  });
  element.addEventListener("pointerup", () => {
    if (focusedItemId === item.id) return;
    syncItemSize(item, element);
    commitHistory();
    scheduleSave();
    renderMinimap();
  });
  handle.addEventListener("keydown", event => {
    const distance = event.shiftKey ? 24 : 8;
    let dx = 0;
    let dy = 0;
    if (event.key === "ArrowLeft") dx = -distance;
    if (event.key === "ArrowRight") dx = distance;
    if (event.key === "ArrowUp") dy = -distance;
    if (event.key === "ArrowDown") dy = distance;
    if (!dx && !dy) return;
    event.preventDefault();
    moveSelectedBy(dx, dy);
  });
  enableDragging(handle, element, item);
  new ResizeObserver(() => {
    if (!element.isConnected || applyingHistory || focusedItemId === item.id) return;
    const previousWidth = item.width;
    const previousHeight = item.height;
    syncItemSize(item, element);
    if (previousWidth !== item.width || previousHeight !== item.height) {
      ensureBoardContains([item]);
      scheduleSave();
      renderMinimap();
      scheduleConnectionRender();
      positionSelectionActions();
    }
  }).observe(element);
  return element;
}

function renderAllItems() {
  exitItemFocus(false, false);
  disposeTerminalRenderers();
  boardEl.replaceChildren(connectionLayerEl, remotePresenceLayerEl);
  highestZ = 1;
  for (const item of boardItems) {
    item.z = Number(item.z) || ++highestZ;
    highestZ = Math.max(highestZ, item.z);
    boardEl.appendChild(createItemElement(item));
  }
  updateEmptyState();
  renderRemotePresence();
  updateSelectionUi();
  renderConnections();
  renderMinimap();
}

function addBoardItem(item, focusText = false, selectResult = true) {
  const now = Date.now();
  const taskMessages = item.type === "task" ? normalizeTaskMessages(item.taskMessages, item) : [];
  const migratedLegacyTask = item.type === "task"
    && !Array.isArray(item.taskMessages)
    && Boolean(item.taskResult);
  const next = {
    id: item.id || db.makeId(),
    type: item.type || "text",
    text: migratedLegacyTask ? "" : (item.text || ""),
    src: item.src || "",
    alt: item.alt || "",
    pageContent: String(item.pageContent || "").slice(0, 600_000),
    pageContentUrl: String(item.pageContentUrl || ""),
    pageContentMode: String(item.pageContentMode || ""),
    pageContentCapturedAt: Math.max(0, Number(item.pageContentCapturedAt) || 0),
    x: Number(item.x) || 0,
    y: Number(item.y) || 0,
    width: Number(item.width) || 320,
    height: Number(item.height) || 120,
    z: ++highestZ,
    groupId: item.groupId || "",
    source: item.source || null,
    taskResult: String(item.taskResult || ""),
    // 每张任务卡独立保存对话历史，刷新或切换白板后仍可继续追问。
    taskMessages,
    taskStatus: ["idle", "running", "success", "error", "cancelled"].includes(item.taskStatus) ? item.taskStatus : "idle",
    // 记录最近一次执行方式，让失败卡片可以原位重试同一种任务。
    taskLastMode: ["coding", "conversation", "text", "image", "image-gen", "video", "video-post"].includes(item.taskLastMode) ? item.taskLastMode : "coding",
    // 视频任务在卡片级保存引擎，保证重试、工作流和定时执行使用同一选择。
    taskVideoEngine: taskVideoEngine(item.taskVideoEngine),
    taskError: String(item.taskError || ""),
    taskRunId: String(item.taskRunId || ""),
    taskProgress: String(item.taskProgress || ""),
    taskStartedAt: Math.max(0, Number(item.taskStartedAt) || 0),
    taskCompletedAt: Math.max(0, Number(item.taskCompletedAt) || 0),
    taskEvents: compactTaskEvents(item.taskEvents),
    // 圈选任务只保存来源卡片 ID，避免复制图片 data URL 导致 IndexedDB 膨胀。
    taskSourceIds: Array.isArray(item.taskSourceIds) ? item.taskSourceIds.map(String) : [],
    taskSourceCount: Math.max(0, Number(item.taskSourceCount) || 0),
    taskWorkflowId: String(item.taskWorkflowId || ""),
    taskWorkflowStepId: String(item.taskWorkflowStepId || ""),
    taskWorkflowRole: ["controller", "step"].includes(item.taskWorkflowRole) ? item.taskWorkflowRole : "",
    taskWorkflowMode: ["coding", "text", "image-gen", "video"].includes(item.taskWorkflowMode) ? item.taskWorkflowMode : "",
    taskWorkflowTitle: String(item.taskWorkflowTitle || ""),
    taskWorkflowInstruction: String(item.taskWorkflowInstruction || item.text || "").slice(0, 8_000),
    taskWorkflowRunId: String(item.taskWorkflowRunId || ""),
    taskWorkflowStepIds: (Array.isArray(item.taskWorkflowStepIds) ? item.taskWorkflowStepIds : []).map(String).slice(0, 8),
    taskWorkflowLens: PageDockBoardDomain.workflowLens(item.taskWorkflowLens).id,
    taskSchedule: PageDockBoardDomain.normalizeTaskSchedule(item.taskSchedule),
    // 派生创作与最初素材解耦；失败重试仍使用发起时明确选择的回答或素材。
    taskGenerationScope: ["latest", "conversation", "sources", "message"].includes(item.taskGenerationScope)
      ? item.taskGenerationScope
      : "",
    taskGenerationMessageId: String(item.taskGenerationMessageId || ""),
    taskReplyMessageId: String(item.taskReplyMessageId || ""),
    taskGenerationSnapshot: item.taskGenerationSnapshot ? clone(item.taskGenerationSnapshot) : null,
    generationContext: item.generationContext ? clone(item.generationContext) : null,
    terminalOutput: String(item.terminalOutput || "").slice(-MAX_TERMINAL_OUTPUT_CHARS),
    terminalStatus: ["idle", "connecting", "connected", "running", "done", "closed", "error", "cancelled"].includes(item.terminalStatus) ? item.terminalStatus : "idle",
    terminalTaskId: String(item.terminalTaskId || ""),
    terminalSessionId: String(item.terminalSessionId || ""),
    terminalCwd: String(item.terminalCwd || ""),
    terminalExitCode: Number.isInteger(item.terminalExitCode) ? item.terminalExitCode : null,
    terminalHistory: (Array.isArray(item.terminalHistory) ? item.terminalHistory : [])
      .map(command => String(command || "").trim().slice(0, 8_000))
      .filter(Boolean)
      .slice(-30),
    localHandleId: String(item.localHandleId || ""),
    localName: String(item.localName || ""),
    localKind: String(item.localKind || ""),
    localMime: String(item.localMime || ""),
    localSize: Math.max(0, Number(item.localSize) || 0),
    localModified: Math.max(0, Number(item.localModified) || 0),
    localEntries: Array.isArray(item.localEntries) ? item.localEntries.slice(0, 200) : [],
    localPreview: String(item.localPreview || "").slice(0, 120_000),
    localPermissionState: String(item.localPermissionState || "missing"),
    knowledgeState: ["loading", "success", "error", "cancelled"].includes(item.knowledgeState) ? item.knowledgeState : "",
    documentLanguage: String(item.documentLanguage || (item.type === "code" ? "plaintext" : "markdown")),
    relationSourceIds: Array.isArray(item.relationSourceIds) ? item.relationSourceIds.map(String) : [],
    createdAt: item.createdAt || now,
    updatedAt: now
  };
  next.card = cardProtocol.normalizeMeta({ ...item, ...next });
  boardItems.push(next);
  ensureBoardContains([next]);
  const element = createItemElement(next);
  boardEl.appendChild(element);
  if (selectResult) selectItems([next.id], true);
  else updateSelectionUi();
  updateEmptyState();
  renderConnections();
  renderMinimap();
  positionSelectionActions();
  commitHistory();
  scheduleSave();
  if (focusText) requestAnimationFrame(() => element.querySelector(".text-content")?.focus());
  return next;
}

function addTextItem(text = "", point = insertionPoint(), focus = false, source = null) {
  return addBoardItem({
    type: "text",
    text,
    x: point.x,
    y: point.y,
    width: 340,
    height: text ? 130 : 112,
    source
  }, focus);
}

function addDocumentItem(point = insertionPoint()) {
  return addBoardItem({
    type: "document",
    text: "",
    documentLanguage: "markdown",
    x: point.x,
    y: point.y,
    width: 520,
    height: 420
  });
}

function addCodeItem(point = insertionPoint()) {
  return addBoardItem({
    type: "code",
    text: "",
    documentLanguage: "plaintext",
    x: point.x,
    y: point.y,
    width: 560,
    height: 420
  });
}

async function localItemDraftFromHandle(handle, type, existing = null) {
  const permission = type === "folder" ? "local-folder-read" : "local-file-read";
  const record = existing?.localHandleId
    ? await db.replaceLocalHandle(existing.localHandleId, currentBoard.id, handle, handle.kind)
    : await db.saveLocalHandle(currentBoard.id, handle, handle.kind);
  const draft = {
    ...(existing || {}),
    type,
    localHandleId: record.id,
    localName: handle.name,
    localKind: handle.kind,
    localPermissionState: "granted"
  };
  draft.card = cardProtocol.normalizeMeta(draft);
  cardProtocol.grant(draft, permission);
  if (type === "file") {
    const file = await handle.getFile();
    draft.localMime = file.type;
    draft.localSize = file.size;
    draft.localModified = file.lastModified;
    if (file.size <= 512_000 && (/^(text\/|application\/(json|javascript|xml))/i.test(file.type) || /\.(md|txt|json|ya?ml|js|ts|tsx|jsx|py|go|rs|java|css|html|xml|sql|sh|zsh)$/i.test(file.name))) {
      draft.localPreview = (await file.text()).slice(0, 120_000);
    }
  } else {
    const entries = [];
    for await (const [name, child] of handle.entries()) {
      entries.push({ name, kind: child.kind });
      if (entries.length >= 200) break;
    }
    draft.localEntries = entries;
  }
  return draft;
}

async function addLocalHandleCard(handle, type, point = insertionPoint()) {
  const draft = await localItemDraftFromHandle(handle, type);
  const item = addBoardItem({
    ...draft,
    x: point.x,
    y: point.y,
    width: type === "folder" ? 440 : 480,
    height: type === "folder" ? 360 : 320
  });
  console.info("[pagedock-local-card] added", { itemId: item.id, type, name: item.localName });
  return item;
}

async function chooseLocalCard(type) {
  if (type === "file" && globalThis.showOpenFilePicker) {
    const [handle] = await globalThis.showOpenFilePicker({ multiple: false });
    if (handle) await addLocalHandleCard(handle, type);
    return;
  }
  if (type === "folder" && globalThis.showDirectoryPicker) {
    const handle = await globalThis.showDirectoryPicker({ mode: "read" });
    if (handle) await addLocalHandleCard(handle, type);
    return;
  }
  (type === "folder" ? localFolderInputEl : localFileInputEl).click();
}

async function relinkLocalCard(item) {
  const type = item.type;
  if (type === "file" && globalThis.showOpenFilePicker) {
    const [handle] = await globalThis.showOpenFilePicker({ multiple: false });
    if (!handle) return;
    Object.assign(item, await localItemDraftFromHandle(handle, type, item), { updatedAt: Date.now() });
    updateLocalCardElement(item);
    scheduleSave();
    return;
  }
  if (type === "folder" && globalThis.showDirectoryPicker) {
    const handle = await globalThis.showDirectoryPicker({ mode: "read" });
    if (!handle) return;
    Object.assign(item, await localItemDraftFromHandle(handle, type, item), { updatedAt: Date.now() });
    updateLocalCardElement(item);
    scheduleSave();
    return;
  }
  localRelinkTargetId = item.id;
  (type === "folder" ? localFolderInputEl : localFileInputEl).click();
}

async function snapshotFileForCard(file) {
  let preview = "";
  if (file.size <= 512_000 && (/^(text\/|application\/(json|javascript|xml))/i.test(file.type) || /\.(md|txt|json|ya?ml|js|ts|tsx|jsx|py|go|rs|java|css|html|xml|sql|sh|zsh)$/i.test(file.name))) {
    preview = (await file.text()).slice(0, 120_000);
  }
  return {
    type: "file",
    localName: file.name,
    localKind: "file",
    localMime: file.type,
    localSize: file.size,
    localModified: file.lastModified,
    localPermissionState: "granted",
    localPreview: preview
  };
}

function fileFromDropEntry(entry) {
  return new Promise((resolve, reject) => entry.file(resolve, reject));
}

async function snapshotFolderFromDropEntry(entry) {
  const reader = entry.createReader();
  const entries = [];
  while (entries.length < 200) {
    const batch = await new Promise((resolve, reject) => reader.readEntries(resolve, reject));
    if (!batch.length) break;
    entries.push(...batch.slice(0, 200 - entries.length));
  }
  return {
    type: "folder",
    localName: entry.name || "文件夹",
    localKind: "directory",
    localPermissionState: "granted",
    localEntries: entries.map(child => ({
      name: child.name,
      kind: child.isDirectory ? "directory" : "file"
    }))
  };
}

function addDroppedLocalSnapshot(draft, point) {
  draft.card = cardProtocol.normalizeMeta(draft);
  cardProtocol.grant(draft, draft.type === "folder" ? "local-folder-read" : "local-file-read");
  return addBoardItem({
    ...draft,
    x: point.x,
    y: point.y,
    width: draft.type === "folder" ? 440 : 480,
    height: draft.type === "folder" ? 360 : 320
  });
}

async function addDroppedFile(file, point) {
  if (file.type?.startsWith("image/")) {
    const src = await readFileAsDataUrl(file);
    return addImageSource(src, file.name, point);
  }
  return addDroppedLocalSnapshot(await snapshotFileForCard(file), point);
}

async function addDroppedHandle(handle, point) {
  if (handle.kind === "file") {
    const file = await handle.getFile();
    if (file.type?.startsWith("image/")) return addDroppedFile(file, point);
    return addLocalHandleCard(handle, "file", point);
  }
  if (handle.kind === "directory") return addLocalHandleCard(handle, "folder", point);
  throw new Error("不支持的本地项目类型");
}

async function addDroppedItems(dataTransfer, point) {
  const transferItems = [...(dataTransfer?.items || [])].filter(item => item.kind === "file");
  // Chrome 要求在 drop 事件的当前调用栈内取得句柄，不能等到第一个 await 之后再调用。
  const descriptors = transferItems.map(item => {
    let handlePromise = Promise.resolve(null);
    try {
      if (typeof item.getAsFileSystemHandle === "function") {
        handlePromise = Promise.resolve(item.getAsFileSystemHandle()).catch(() => null);
      }
    } catch (error) {
      handlePromise = Promise.resolve(null);
    }
    return {
      handlePromise,
      entry: item.webkitGetAsEntry?.() || null,
      file: item.getAsFile?.() || null
    };
  });
  if (!descriptors.length) {
    descriptors.push(...[...(dataTransfer?.files || [])].map(file => ({
      handlePromise: Promise.resolve(null),
      entry: null,
      file
    })));
  }

  let added = 0;
  const failures = [];
  for (const [index, descriptor] of descriptors.entries()) {
    const itemPoint = { x: point.x + index * 28, y: point.y + index * 28 };
    try {
      const handle = await descriptor.handlePromise;
      if (handle) {
        await addDroppedHandle(handle, itemPoint);
      } else if (descriptor.entry?.isDirectory) {
        addDroppedLocalSnapshot(await snapshotFolderFromDropEntry(descriptor.entry), itemPoint);
      } else {
        const file = descriptor.entry?.isFile ? await fileFromDropEntry(descriptor.entry) : descriptor.file;
        if (!file) throw new Error("无法读取拖入的文件");
        await addDroppedFile(file, itemPoint);
      }
      added += 1;
    } catch (error) {
      failures.push(error?.message || "读取失败");
      console.warn("[shizuo-drop] local item failed", { index, reason: error?.message || String(error) });
    }
  }
  if (failures.length) setStatus(`已添加 ${added} 项，${failures.length} 项读取失败`, true);
  else if (added) setStatus(`已添加 ${added} 项到白板`);
}

function addPageItem(value, point = insertionPoint()) {
  const src = normalizedPageUrl(value);
  const url = new URL(src);
  const title = url.hostname.replace(/^www\./i, "") || src;
  const draft = {
    type: "page",
    text: title,
    src,
    x: point.x,
    y: point.y,
    width: 720,
    height: 520,
    source: { url: src, title, capturedAt: Date.now() }
  };
  draft.card = cardProtocol.normalizeMeta(draft);
  // 提交 URL 本身就是用户对该页面卡联网的明确授权。
  cardProtocol.grant(draft, "network-read");
  const item = addBoardItem(draft);
  console.info("[pagedock-page] added", { itemId: item.id, origin: url.origin });
  return item;
}

function addTerminalItem(point = insertionPoint()) {
  const draft = {
    type: "terminal",
    text: "",
    terminalOutput: "",
    terminalStatus: "idle",
    x: point.x,
    y: point.y,
    width: 640,
    height: 420
  };
  draft.card = cardProtocol.normalizeMeta(draft);
  const item = addBoardItem(draft);
  console.info("[pagedock-terminal] card added", { itemId: item.id });
  return item;
}

function addTaskItem(point = insertionPoint(), options = {}) {
  const item = addBoardItem({
    type: "task",
    text: String(options.text || ""),
    taskResult: "",
    taskStatus: "idle",
    taskRunId: "",
    taskProgress: "",
    taskStartedAt: 0,
    taskCompletedAt: 0,
    taskEvents: [],
    taskSourceIds: Array.isArray(options.sourceIds) ? options.sourceIds : [],
    taskSourceCount: Number(options.sourceCount) || 0,
    x: point.x,
    y: point.y,
    width: 480,
    height: 320
  });
  if (options.focus !== false) {
    requestAnimationFrame(() => itemElement(item.id)?.querySelector(".task-prompt")?.focus());
  }
  return item;
}

async function applyBoardCardTaskPatch(task, patch) {
  if (Array.isArray(patch.taskEvents)) patch = { ...patch, taskEvents: compactTaskEvents(patch.taskEvents) };
  if (currentBoard?.id === task.boardId) {
    const item = itemById(task.itemId);
    if (!item) return;
    Object.assign(item, patch, { updatedAt: Date.now() });
    updateTaskItemElement(item);
    commitHistory();
    scheduleSave();
    return;
  }
  await enqueueBoardWrite(task.boardId, async () => {
    const board = await db.getBoard(task.boardId, { includeArchived: true });
    const baseBoard = board ? structuredClone(board) : null;
    if (!board) return;
    const item = board.items.find(candidate => candidate.id === task.itemId);
    if (!item) return;
    Object.assign(item, patch, { updatedAt: Date.now() });
    await db.commitBoardSnapshot(board, {
      baseBoard,
      preserveArchived: task.boardId === db.INBOX_ID,
      reason: "保存 Codex 任务结果"
    });
  });
  notifyDataChanged([task.boardId], "codex-task-result");
}
