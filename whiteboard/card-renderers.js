// Module: terminal, document, code, and local-file card adapters.
function terminalItemForTask(taskId) {
  return boardItems.find(item => item.type === "terminal" && item.terminalTaskId === String(taskId || ""));
}

function appendTerminalOutput(item, chunk) {
  const next = `${item.terminalOutput || ""}${String(chunk || "")}`;
  if (next.length <= MAX_TERMINAL_OUTPUT_CHARS) {
    item.terminalOutput = next;
    return;
  }
  item.terminalOutput = `[前序输出已截断]\n${next.slice(-(MAX_TERMINAL_OUTPUT_CHARS - 10_000))}`;
}

function clearTerminalSaveTimer(itemId) {
  const timer = terminalSaveTimers.get(itemId);
  if (timer) clearTimeout(timer);
  terminalSaveTimers.delete(itemId);
}

function scheduleTerminalSave(item) {
  clearTerminalSaveTimer(item.id);
  terminalSaveTimers.set(item.id, setTimeout(() => {
    terminalSaveTimers.delete(item.id);
    scheduleSave();
  }, TERMINAL_SAVE_IDLE_MS));
}

function disposeTerminalRenderer(session) {
  if (!session) return;
  if (session.fitFrame) cancelAnimationFrame(session.fitFrame);
  session.observer?.disconnect();
  try { session.terminal?.dispose(); } catch {}
  if (terminalSessions.get(session.item?.terminalSessionId) === session) {
    terminalSessions.delete(session.item.terminalSessionId);
  }
}

function disposeTerminalRenderers() {
  for (const session of terminalSessions.values()) disposeTerminalRenderer(session);
  terminalSessions.clear();
}

function terminalStatusLabel(item) {
  if (item.terminalStatus === "connecting") return "正在连接";
  if (item.terminalStatus === "connected") return "已连接";
  if (item.terminalStatus === "closed") return "已关闭";
  if (item.terminalStatus === "running") return "执行中";
  if (item.terminalStatus === "done") return item.terminalExitCode === 0 ? "已完成" : `退出码 ${item.terminalExitCode}`;
  if (item.terminalStatus === "error") return "执行失败";
  if (item.terminalStatus === "cancelled") return "已停止";
  return "就绪";
}

function updateTerminalItemElement(item, scrollToEnd = true) {
  const element = itemElement(item.id);
  if (!element) return;
  const content = element.querySelector(".terminal-content");
  const connect = element.querySelector(".terminal-connect");
  if (!content || !connect) return;
  content.dataset.state = item.terminalStatus || "idle";
  element.querySelector(".terminal-cwd").textContent = item.terminalCwd || "本地编码工作区";
  element.querySelector(".terminal-cwd").title = item.terminalCwd || "执行目录由本地桥接配置";
  element.querySelector(".terminal-state").textContent = terminalStatusLabel(item);
  const active = ["connected", "connecting"].includes(item.terminalStatus);
  connect.textContent = active ? "关闭" : "连接";
  connect.setAttribute("aria-label", active ? "关闭终端会话" : "连接终端会话");
  if (scrollToEnd) terminalSessions.get(item.terminalSessionId)?.terminal?.scrollToBottom();
  updatePermissionChip(item, element);
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(String(value || ""));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function openTerminalSession(item, element = itemElement(item.id), resumeExisting = false) {
  const session = terminalSessions.get(item.terminalSessionId);
  if (!session || (!resumeExisting && ["connected", "connecting"].includes(item.terminalStatus))) return;
  try {
    session.fitAddon.fit();
    item.terminalStatus = "connecting";
    cardProtocol.grant(item, "local-shell");
    updateTerminalItemElement(item, false);
    scheduleSave();
    const response = await chrome.runtime.sendMessage({
      type: TERMINAL_SESSION_OPEN_REQUEST,
      id: item.terminalSessionId,
      cols: session.terminal.cols,
      rows: session.terminal.rows
    });
    if (!response?.ok) throw new Error(response?.error || "终端会话启动失败");
    updateCodexTaskSnapshot(response);
    if (response.terminalWorkspace) item.terminalCwd = response.terminalWorkspace;
    session.terminal.focus();
    updateTerminalItemElement(item, false);
    console.info("[pagedock-terminal] PTY session requested", { id: item.terminalSessionId, itemId: item.id });
  } catch (error) {
    item.terminalStatus = "error";
    session.terminal.writeln(`\r\n\x1b[31m[拾作] ${error?.message || "终端连接失败"}\x1b[0m`);
    updateTerminalItemElement(item, false);
    scheduleSave();
  }
}

async function closeTerminalSession(item) {
  if (!item?.terminalSessionId) return;
  try {
    await chrome.runtime.sendMessage({ type: TERMINAL_SESSION_CLOSE_REQUEST, id: item.terminalSessionId });
  } catch (error) {
    console.warn("[pagedock-terminal] PTY close failed", { id: item.terminalSessionId, reason: error?.message || String(error) });
  }
  item.terminalStatus = "closed";
  updateTerminalItemElement(item, false);
  scheduleSave();
}

async function runTerminalItem(item) {
  if (!item || item.type !== "terminal" || item.terminalStatus === "running") return;
  const element = itemElement(item.id);
  const input = element?.querySelector(".terminal-input");
  const command = String(input?.value || "").trim();
  if (!command) {
    input?.focus();
    return;
  }
  const taskId = db.makeId("terminal");
  item.text = command;
  item.terminalHistory = [...(item.terminalHistory || []), command].slice(-30);
  item.terminalStatus = "running";
  item.terminalTaskId = taskId;
  item.terminalExitCode = null;
  appendTerminalOutput(item, `${item.terminalOutput && !item.terminalOutput.endsWith("\n") ? "\n" : ""}$ ${command}\n`);
  input.value = "";
  item.updatedAt = Date.now();
  terminalTasks.set(taskId, { boardId: currentBoard.id, item });
  updateTerminalItemElement(item);
  scheduleSave();
  console.info("[pagedock-terminal] command requested", { taskId, itemId: item.id, commandLength: command.length });
  try {
    const response = await chrome.runtime.sendMessage({
      type: TERMINAL_RUN_REQUEST,
      id: taskId,
      command
    });
    if (!response?.ok) throw new Error(response?.error || "控制台任务启动失败");
    updateCodexTaskSnapshot(response);
    updateCodexChatControls();
    if (response.terminalWorkspace) {
      item.terminalCwd = response.terminalWorkspace;
      updateTerminalItemElement(item, false);
      scheduleSave();
    }
  } catch (error) {
    if (item.terminalTaskId !== taskId) return;
    terminalTasks.delete(taskId);
    codexActiveTaskIds.delete(taskId);
    item.terminalStatus = "error";
    item.terminalTaskId = "";
    appendTerminalOutput(item, `\n[错误] ${error?.message || "控制台任务启动失败"}\n`);
    updateTerminalItemElement(item);
    scheduleSave();
  }
}

async function cancelTerminalItem(item) {
  if (!item?.terminalTaskId || item.terminalStatus !== "running") return;
  const taskId = item.terminalTaskId;
  try {
    const response = await chrome.runtime.sendMessage({ type: TERMINAL_CANCEL_REQUEST, id: taskId });
    if (!response?.ok) throw new Error(response?.error || "停止命令失败");
  } catch (error) {
    appendTerminalOutput(item, `\n[错误] ${error?.message || "停止命令失败"}\n`);
    item.terminalStatus = "error";
    item.terminalTaskId = "";
    updateTerminalItemElement(item);
    scheduleSave();
  }
}

function handleTerminalEvent(event) {
  const taskId = String(event?.id || "");
  if (String(event?.type || "").startsWith("terminal-session-")) {
    const session = terminalSessions.get(taskId);
    const item = session?.item || boardItems.find(candidate => candidate.type === "terminal" && candidate.terminalSessionId === taskId);
    if (!item) return;
    if (event.type === "terminal-session-started") {
      item.terminalStatus = "connected";
      item.terminalCwd = String(event.cwd || item.terminalCwd || "");
      cardProtocol.grant(item, "local-shell");
      session?.terminal?.focus();
    } else if (event.type === "terminal-session-output") {
      const bytes = base64ToBytes(event.data);
      session?.terminal?.write(bytes);
      if (session?.decoder) appendTerminalOutput(item, session.decoder.decode(bytes, { stream: true }));
      item.updatedAt = Date.now();
      // Terminal output is already painted by xterm. Persist only after the stream
      // becomes idle; rebuilding card metadata for every fragment can freeze Chrome.
      scheduleTerminalSave(item);
      return;
    } else if (event.type === "terminal-session-closed") {
      item.terminalStatus = "closed";
      item.terminalExitCode = Number.isInteger(event.exitCode) ? event.exitCode : null;
    } else if (event.type === "terminal-session-error") {
      item.terminalStatus = "error";
      session?.terminal?.writeln(`\r\n\x1b[31m[拾作] ${event.error || "终端会话失败"}\x1b[0m`);
    }
    clearTerminalSaveTimer(item.id);
    item.updatedAt = Date.now();
    updateTerminalItemElement(item, false);
    scheduleSave();
    return;
  }
  if (event?.type === "terminal-started" && taskId) codexActiveTaskIds.add(taskId);
  if (["terminal-done", "terminal-error", "terminal-cancelled"].includes(event?.type) && taskId) codexActiveTaskIds.delete(taskId);
  updateCodexChatControls();
  updateSelectionUi();
  const terminalTask = terminalTasks.get(taskId);
  const item = terminalItemForTask(event?.id) || terminalTask?.item;
  if (!item) return;
  if (terminalTask) terminalTask.item = item;
  if (event.type === "terminal-started") {
    item.terminalStatus = "running";
    item.terminalCwd = String(event.cwd || item.terminalCwd || "");
  } else if (event.type === "terminal-output") {
    appendTerminalOutput(item, event.data || "");
  } else if (event.type === "terminal-done") {
    item.terminalExitCode = Number.isInteger(event.exitCode) ? event.exitCode : null;
    item.terminalStatus = item.terminalExitCode === 0 ? "done" : "error";
    item.terminalTaskId = "";
    appendTerminalOutput(item, `\n[退出码 ${item.terminalExitCode ?? "未知"}]\n`);
  } else if (event.type === "terminal-cancelled") {
    item.terminalStatus = "cancelled";
    item.terminalTaskId = "";
    appendTerminalOutput(item, "\n[已停止]\n");
  } else if (event.type === "terminal-error") {
    item.terminalStatus = "error";
    item.terminalTaskId = "";
    appendTerminalOutput(item, `\n[错误] ${event.error || "命令执行失败"}\n`);
  }
  item.updatedAt = Date.now();
  const itemIsVisible = currentBoard?.id === terminalTask?.boardId || boardItems.includes(item);
  if (itemIsVisible) {
    updateTerminalItemElement(item);
    scheduleSave();
  }
  if (["terminal-done", "terminal-error", "terminal-cancelled"].includes(event.type)) {
    terminalTasks.delete(taskId);
    if (!itemIsVisible && terminalTask?.boardId) {
      persistTerminalItem(terminalTask.boardId, item).catch(error => {
        console.error("[pagedock-terminal] inactive card save failed", { taskId, reason: error?.message || String(error) });
      });
    }
  }
}

async function persistTerminalItem(boardId, item) {
  const board = await db.getBoard(boardId, { includeArchived: true });
  const baseBoard = board ? structuredClone(board) : null;
  const stored = board?.items?.find(candidate => candidate.id === item.id);
  if (!stored) return;
  Object.assign(stored, {
    text: item.text,
    terminalOutput: item.terminalOutput,
    terminalStatus: item.terminalStatus,
    terminalTaskId: item.terminalTaskId,
    terminalSessionId: item.terminalSessionId,
    terminalCwd: item.terminalCwd,
    terminalExitCode: item.terminalExitCode,
    terminalHistory: item.terminalHistory,
    updatedAt: item.updatedAt
  });
  await db.commitBoardSnapshot(board, {
    baseBoard,
    preserveArchived: boardId === db.INBOX_ID,
    reason: "保存终端结果"
  });
  notifyDataChanged([boardId], "terminal-result");
}

function createTerminalContent(item, element) {
  const content = document.createElement("div");
  content.className = "terminal-content";
  const meta = document.createElement("div");
  meta.className = "terminal-meta";
  const cwd = document.createElement("span");
  cwd.className = "terminal-cwd";
  const state = document.createElement("span");
  state.className = "terminal-state";
  const clear = document.createElement("button");
  clear.className = "terminal-clear";
  clear.type = "button";
  clear.textContent = "清空";
  clear.addEventListener("click", () => {
    item.terminalOutput = "";
    item.updatedAt = Date.now();
    terminalSessions.get(item.terminalSessionId)?.terminal?.clear();
    clearTerminalSaveTimer(item.id);
    scheduleSave();
  });
  const connect = document.createElement("button");
  connect.className = "terminal-connect";
  connect.type = "button";
  connect.textContent = ["connected", "connecting"].includes(item.terminalStatus) ? "关闭" : "连接";
  connect.addEventListener("click", () => {
    initializeTerminalRenderer();
    if (["connected", "connecting"].includes(item.terminalStatus)) closeTerminalSession(item);
    else openTerminalSession(item, element);
  });
  meta.append(cwd, state, clear, connect);
  const mount = document.createElement("div");
  mount.className = "terminal-mount";
  mount.setAttribute("aria-label", "交互式本地终端");
  content.append(meta, mount);
  content.addEventListener("pointerdown", event => event.stopPropagation());
  element.appendChild(content);
  let initialized = false;
  const initializeTerminalRenderer = () => {
    if (initialized || !element.isConnected) return;
    initialized = true;
  const terminal = new globalThis.Terminal({
    allowProposedApi: false,
    cursorBlink: true,
    cursorStyle: "bar",
    fontFamily: "SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: 12,
    lineHeight: 1.2,
    scrollback: 2000,
    convertEol: false,
    theme: {
      background: "#211914",
      foreground: "#f4ede5",
      cursor: "#e79b7e",
      selectionBackground: "#7d493c99",
      black: "#211914",
      red: "#e2776a",
      green: "#90bd83",
      yellow: "#d9b36c",
      blue: "#83a9c9",
      magenta: "#bc91b7",
      cyan: "#7db8b3",
      white: "#f4ede5"
    }
  });
  const fitAddon = new globalThis.FitAddon.FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(mount);
  if (item.terminalOutput) terminal.write(item.terminalOutput);
  item.terminalSessionId = item.terminalSessionId || `terminal:${item.id}`;
  disposeTerminalRenderer(terminalSessions.get(item.terminalSessionId));
  const terminalSession = {
    item,
    boardId: currentBoard?.id,
    terminal,
    fitAddon,
    decoder: new TextDecoder(),
    element,
    observer: undefined,
    fitFrame: undefined
  };
  terminalSessions.set(item.terminalSessionId, terminalSession);
  terminal.onData(data => {
    if (item.terminalStatus !== "connected") return;
    const bytes = new TextEncoder().encode(data);
    chrome.runtime.sendMessage({
      type: TERMINAL_SESSION_INPUT_REQUEST,
      id: item.terminalSessionId,
      data: bytesToBase64(bytes)
    }).catch(error => setStatus(error?.message || "终端输入发送失败", true));
  });
  terminal.onResize(({ cols, rows }) => {
    if (!item.terminalSessionId || !["connected", "connecting"].includes(item.terminalStatus)) return;
    chrome.runtime.sendMessage({ type: TERMINAL_SESSION_RESIZE_REQUEST, id: item.terminalSessionId, cols, rows }).catch(() => {});
  });
  const observer = new ResizeObserver(() => {
    if (!element.isConnected) {
      observer.disconnect();
      return;
    }
    if (terminalSession.fitFrame) cancelAnimationFrame(terminalSession.fitFrame);
    terminalSession.fitFrame = requestAnimationFrame(() => {
      terminalSession.fitFrame = undefined;
      if (!element.isConnected) return;
      try { fitAddon.fit(); } catch {}
    });
  });
  terminalSession.observer = observer;
  observer.observe(mount);
  requestAnimationFrame(() => {
    fitAddon.fit();
    updateTerminalItemElement(item);
  });
  };
  // 终端是白板中最重的卡片，只在接近视口或用户主动连接时创建渲染器。
  const visibilityObserver = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    visibilityObserver.disconnect();
    initializeTerminalRenderer();
  }, { root: viewportEl, rootMargin: "240px" });
  visibilityObserver.observe(element);
}

function createDocumentContent(item, element, codeMode = false) {
  const content = document.createElement("div");
  content.className = codeMode ? "code-content" : "document-content";
  const isKnowledgeCard = item.provenance?.operation === "codex-generate-knowledge";
  content.classList.toggle("knowledge-card-content", isKnowledgeCard);
  if (!codeMode && item.knowledgeState && item.knowledgeState !== "success") {
    const loading = document.createElement("div");
    loading.className = "knowledge-card-loading";
    loading.dataset.state = item.knowledgeState;
    const status = document.createElement("span");
    status.textContent = item.text || "正在提炼知识卡…";
    loading.appendChild(status);
    content.appendChild(loading);
    element.appendChild(content);
    return;
  }
  const toolbar = document.createElement("div");
  toolbar.className = codeMode ? "code-toolbar" : "document-toolbar";
  const editor = document.createElement("textarea");
  editor.className = codeMode ? "code-editor" : "document-editor";
  editor.value = item.text || "";
  editor.spellcheck = !codeMode;
  editor.placeholder = codeMode ? "输入代码…" : "使用 Markdown 编写文档…";
  editor.setAttribute("aria-label", codeMode ? "代码内容" : "Markdown 文档内容");
  editor.addEventListener("input", () => {
    item.text = editor.value;
    item.updatedAt = Date.now();
    scheduleSave();
    queueHistoryCommit();
  });

  if (codeMode) {
    const language = document.createElement("select");
    language.className = "code-language";
    for (const value of ["plaintext", "javascript", "typescript", "python", "json", "html", "css", "shell", "sql", "go", "markdown"]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      language.appendChild(option);
    }
    language.value = item.documentLanguage || "plaintext";
    language.setAttribute("aria-label", "代码语言");
    language.addEventListener("change", () => {
      item.documentLanguage = language.value;
      item.updatedAt = Date.now();
      scheduleSave();
    });
    toolbar.appendChild(language);
  } else {
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "编辑";
    edit.setAttribute("aria-pressed", "true");
    const previewButton = document.createElement("button");
    previewButton.type = "button";
    previewButton.textContent = "预览";
    previewButton.setAttribute("aria-pressed", "false");
    const preview = document.createElement("div");
    preview.className = `document-preview${isKnowledgeCard ? " knowledge-card-preview" : ""}`;
    preview.hidden = true;
    const setPreview = active => {
      editor.hidden = active;
      preview.hidden = !active;
      edit.setAttribute("aria-pressed", String(!active));
      previewButton.setAttribute("aria-pressed", String(active));
      if (active) renderTaskMarkdown(preview, item.text || "");
      else editor.focus();
    };
    edit.addEventListener("click", () => setPreview(false));
    previewButton.addEventListener("click", () => setPreview(true));
    toolbar.append(edit, previewButton);
    content.append(toolbar, editor, preview);
    setPreview(isKnowledgeCard);
    content.addEventListener("pointerdown", event => event.stopPropagation());
    element.appendChild(content);
    return;
  }

  content.append(toolbar, editor);
  content.addEventListener("pointerdown", event => event.stopPropagation());
  element.appendChild(content);
}

function formatBytes(value) {
  const bytes = Math.max(0, Number(value) || 0);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
}

function localTextFileCanPreview(file) {
  return file.size <= 512_000 && (/^(text\/|application\/(json|javascript|xml))/i.test(file.type) || /\.(md|txt|json|ya?ml|js|ts|tsx|jsx|py|go|rs|java|css|html|xml|sql|sh|zsh)$/i.test(file.name));
}

async function localEntryHandle(item, path, kind) {
  const record = await db.getLocalHandle(item.localHandleId);
  const root = record?.handle;
  if (!root) throw new Error("此卡片只有目录快照，请点击“重新关联”后再打开内容");
  const state = await permissionForHandle(root, true);
  item.localPermissionState = state;
  updatePermissionChip(item);
  if (state !== "granted") throw new Error("需要允许读取此文件夹后才能打开内容");
  cardProtocol.grant(item, "local-folder-read");
  let handle = root;
  for (let index = 0; index < path.length; index += 1) {
    const entryKind = index === path.length - 1 ? kind : "directory";
    handle = entryKind === "directory"
      ? await handle.getDirectoryHandle(path[index])
      : await handle.getFileHandle(path[index]);
  }
  return handle;
}

async function localDirectoryEntries(handle) {
  const entries = [];
  for await (const [name, child] of handle.entries()) {
    entries.push({ name, kind: child.kind });
    if (entries.length >= 200) break;
  }
  return entries.sort((left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name));
}

function closeLocalFilePreview(element) {
  const entries = element.querySelector(".local-card-entries");
  const view = element.querySelector(".local-card-file-view");
  if (!entries || !view) return;
  const objectUrl = view.dataset.objectUrl;
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  delete view.dataset.objectUrl;
  view.hidden = true;
  entries.hidden = false;
}

async function showLocalFilePreview(item, element, path) {
  const entries = element.querySelector(".local-card-entries");
  const view = element.querySelector(".local-card-file-view");
  const fileName = element.querySelector(".local-card-file-name");
  const body = element.querySelector(".local-card-file-body");
  if (!entries || !view || !fileName || !body) return;
  closeLocalFilePreview(element);
  entries.hidden = true;
  view.hidden = false;
  fileName.textContent = path.join(" / ");
  body.textContent = "正在读取文件…";
  try {
    const handle = await localEntryHandle(item, path, "file");
    const file = await handle.getFile();
    body.replaceChildren();
    if (localTextFileCanPreview(file)) {
      const preview = document.createElement("pre");
      preview.textContent = (await file.text()).slice(0, 120_000);
      body.appendChild(preview);
    } else if (file.type.startsWith("image/")) {
      const image = document.createElement("img");
      const objectUrl = URL.createObjectURL(file);
      view.dataset.objectUrl = objectUrl;
      image.src = objectUrl;
      image.alt = file.name;
      body.appendChild(image);
    } else {
      const note = document.createElement("p");
      note.className = "local-card-file-note";
      note.textContent = `${file.type || "未知格式"} · ${formatBytes(file.size)}。当前仅支持直接预览文本和图片文件。`;
      body.appendChild(note);
    }
    console.info("[pagedock-local-card] entry opened", { itemId: item.id, path: path.join("/"), kind: "file", size: file.size });
  } catch (error) {
    body.textContent = error?.message || "文件读取失败";
    setStatus(error?.message || "文件读取失败", true);
  }
}

function renderLocalFolderEntries(item, element, list, entries, parentPath = []) {
  if (!list) return;
  if (!entries.length) {
    const empty = document.createElement("li");
    empty.className = "local-card-file-note";
    empty.textContent = "此文件夹为空";
    list.replaceChildren(empty);
    return;
  }
  list.replaceChildren(...entries.map(entry => {
    const row = document.createElement("li");
    row.className = "local-card-entry";
    const button = document.createElement("button");
    button.type = "button";
    button.className = "local-card-entry-button";
    button.title = entry.kind === "directory" ? `展开 ${entry.name}` : `预览 ${entry.name}`;
    const marker = document.createElement("span");
    marker.className = "local-card-entry-marker";
    marker.textContent = entry.kind === "directory" ? "▸" : "·";
    const label = document.createElement("span");
    label.className = "local-card-entry-name";
    label.textContent = entry.name;
    button.append(marker, label);
    const path = [...parentPath, entry.name];
    if (entry.kind === "directory") {
      button.setAttribute("aria-expanded", "false");
      const children = document.createElement("ol");
      children.className = "local-card-children";
      children.hidden = true;
      button.addEventListener("click", async () => {
        const expanded = button.getAttribute("aria-expanded") === "true";
        if (expanded) {
          button.setAttribute("aria-expanded", "false");
          button.title = `展开 ${entry.name}`;
          marker.textContent = "▸";
          children.hidden = true;
          return;
        }
        if (!children.dataset.loaded) {
          button.disabled = true;
          marker.textContent = "…";
          try {
            const handle = await localEntryHandle(item, path, "directory");
            renderLocalFolderEntries(item, element, children, await localDirectoryEntries(handle), path);
            children.dataset.loaded = "true";
            console.info("[pagedock-local-card] entry opened", { itemId: item.id, path: path.join("/"), kind: "directory" });
          } catch (error) {
            marker.textContent = "▸";
            setStatus(error?.message || "文件夹读取失败", true);
            return;
          } finally {
            button.disabled = false;
          }
        }
        button.setAttribute("aria-expanded", "true");
        button.title = `收起 ${entry.name}`;
        marker.textContent = "▾";
        children.hidden = false;
      });
      row.append(button, children);
    } else {
      button.addEventListener("click", () => showLocalFilePreview(item, element, path));
      row.appendChild(button);
    }
    return row;
  }));
}

async function permissionForHandle(handle, request = false) {
  if (!handle) return "missing";
  const options = { mode: "read" };
  let state = await handle.queryPermission?.(options) || "prompt";
  if (request && state !== "granted") state = await handle.requestPermission?.(options) || state;
  return state;
}

async function refreshLocalCard(item, element, requestPermission = false) {
  const record = await db.getLocalHandle(item.localHandleId);
  const handle = record?.handle;
  const state = await permissionForHandle(handle, requestPermission);
  item.localPermissionState = state;
  if (state === "granted") cardProtocol.grant(item, item.type === "folder" ? "local-folder-read" : "local-file-read");
  else cardProtocol.revoke(item, item.type === "folder" ? "local-folder-read" : "local-file-read");
  if (state === "granted" && item.type === "file") {
    const file = await handle.getFile();
    item.localName = file.name;
    item.localMime = file.type;
    item.localSize = file.size;
    item.localModified = file.lastModified;
    if (file.size <= 512_000 && (/^(text\/|application\/(json|javascript|xml))/i.test(file.type) || /\.(md|txt|json|ya?ml|js|ts|tsx|jsx|py|go|rs|java|css|html|xml|sql|sh|zsh)$/i.test(file.name))) {
      item.localPreview = (await file.text()).slice(0, 120_000);
    }
  } else if (state === "granted" && item.type === "folder") {
    const entries = [];
    for await (const [name, child] of handle.entries()) {
      entries.push({ name, kind: child.kind });
      if (entries.length >= 200) break;
    }
    item.localEntries = entries.sort((left, right) => left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name));
  }
  item.updatedAt = Date.now();
  updateLocalCardElement(item, element);
  scheduleSave();
}

function updatePermissionChip(item, element = itemElement(item.id)) {
  const chip = element?.querySelector(".permission-chip");
  const permission = permissionSummary(item);
  if (!chip || !permission) return;
  chip.dataset.state = permission.state;
  chip.dataset.risk = permission.risk;
  chip.textContent = permission.state === "granted" ? `已允许 · ${permission.label}` : `需允许 · ${permission.label}`;
}

function updateLocalCardElement(item, element = itemElement(item.id)) {
  if (!element) return;
  const name = element.querySelector(".local-card-name");
  const details = element.querySelector(".local-card-details");
  const preview = element.querySelector(".local-card-preview");
  const entries = element.querySelector(".local-card-entries");
  if (name) name.textContent = item.localName || (item.type === "folder" ? "未关联文件夹" : "未关联文件");
  if (details) {
    const permission = item.localPermissionState === "granted" ? "已授权" : item.localHandleId ? "需要授权" : "本地快照";
    details.textContent = item.type === "folder"
      ? `${permission} · ${(item.localEntries || []).length} 项预览`
      : `${permission}${item.localSize ? ` · ${formatBytes(item.localSize)}` : ""}${item.localMime ? ` · ${item.localMime}` : ""}`;
  }
  if (preview) preview.textContent = item.localPreview || "此文件没有可展示的文本预览。";
  if (entries) {
    closeLocalFilePreview(element);
    renderLocalFolderEntries(item, element, entries, item.localEntries || []);
  }
  updatePermissionChip(item, element);
}

function createLocalCardContent(item, element) {
  const content = document.createElement("div");
  content.className = "local-card-content";
  const toolbar = document.createElement("div");
  toolbar.className = "local-card-toolbar";
  const refresh = document.createElement("button");
  refresh.type = "button";
  refresh.textContent = item.localHandleId ? "刷新" : "重新关联";
  refresh.addEventListener("click", async () => {
    try {
      if (!item.localHandleId) {
        await relinkLocalCard(item);
      } else {
        await refreshLocalCard(item, element, true);
      }
    } catch (error) {
      setStatus(error?.message || "读取本地内容失败", true);
    }
  });
  toolbar.appendChild(refresh);
  const summary = document.createElement("div");
  summary.className = "local-card-summary";
  const icon = document.createElement("span");
  icon.className = "local-card-icon";
  icon.textContent = item.type === "folder" ? "▱" : "▰";
  const meta = document.createElement("div");
  meta.className = "local-card-meta";
  const name = document.createElement("strong");
  name.className = "local-card-name";
  const details = document.createElement("span");
  details.className = "local-card-details";
  meta.append(name, details);
  summary.append(icon, meta);
  content.append(toolbar, summary);
  if (item.type === "folder") {
    const entries = document.createElement("ol");
    entries.className = "local-card-entries";
    const fileView = document.createElement("section");
    fileView.className = "local-card-file-view";
    fileView.hidden = true;
    const fileHead = document.createElement("div");
    fileHead.className = "local-card-file-head";
    const back = document.createElement("button");
    back.type = "button";
    back.className = "local-card-file-back";
    back.textContent = "← 文件列表";
    back.addEventListener("click", () => closeLocalFilePreview(element));
    const fileName = document.createElement("strong");
    fileName.className = "local-card-file-name";
    const fileBody = document.createElement("div");
    fileBody.className = "local-card-file-body";
    fileHead.append(back, fileName);
    fileView.append(fileHead, fileBody);
    content.append(entries, fileView);
  } else {
    const preview = document.createElement("pre");
    preview.className = "local-card-preview";
    content.appendChild(preview);
  }
  content.addEventListener("pointerdown", event => event.stopPropagation());
  element.appendChild(content);
  updateLocalCardElement(item, element);
  if (item.localHandleId) refreshLocalCard(item, element, false).catch(error => {
    console.warn("[pagedock-local-card] refresh failed", { itemId: item.id, reason: error?.message || String(error) });
  });
}
