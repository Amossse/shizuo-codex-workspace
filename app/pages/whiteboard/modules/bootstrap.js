// Module: event wiring and application bootstrap; load last.
function wireEvents() {
  const transientMenus = [addMenuEl, exportMenuEl, homeMoreMenuEl, selectionMoreMenuEl];
  transientMenus.forEach(menu => {
    menu.addEventListener("toggle", () => {
      if (!menu.open) return;
      for (const other of transientMenus) {
        if (other !== menu) other.open = false;
      }
      if (menu === selectionMoreMenuEl) requestAnimationFrame(positionSelectionActions);
    });
  });
  document.addEventListener("pointerdown", event => {
    if (event.target.closest?.("details.menu")) return;
    transientMenus.forEach(menu => { menu.open = false; });
  }, true);
  codexChatLauncherEl.addEventListener("click", () => {
    setCodexChatOpen(true);
    if (!codexChatReady) connectCodexChat();
  });
  document.getElementById("codexChatClose").addEventListener("click", () => setCodexChatOpen(false));
  codexChatNewEl.addEventListener("click", () => {
    if (codexChatTask) return;
    codexChatMessages = [];
    localPluginCodexTaskStatus = undefined;
    renderExternalCollaboration();
    renderCodexChatMessages();
    persistCodexChatMessages().catch(error => {
      console.warn("[pagedock-codex-chat] clear history failed", error);
    });
    setCodexChatStatus(codexChatReady ? ui("新会话 · 已连接") : ui("新会话 · 未连接"), codexChatReady ? "success" : "error");
    codexChatInputEl.focus();
  });
  codexChatSendEl.addEventListener("click", sendCodexChatMessage);
  codexChatInputEl.addEventListener("input", () => {
    resizeCodexChatInput();
    updateCodexChatControls();
  });
  resizeCodexChatInput();
  codexChatInputEl.addEventListener("keydown", event => {
    if (event.key === "Escape") setCodexChatOpen(false);
    if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    sendCodexChatMessage();
  });
  codexChatStopEl.addEventListener("click", () => {
    const task = codexChatTask;
    if (!task || task.cancelRequested) return;
    task.cancelRequested = true;
    task.progressBeforeCancel = task.progressText;
    updateCodexChatProgress(task, ui("正在停止本地任务…"));
    updateCodexChatControls();
    chrome.runtime.sendMessage({ type: CODEX_CANCEL_REQUEST, id: task.id })
      .then(response => {
        if (!response?.ok) throw new Error(response?.error || ui("停止会话失败"));
        if (codexChatTask?.id === task.id && response.activeTaskId !== task.id) {
          stopCodexChatProgress(task);
          codexChatTask = undefined;
          syncLocalPluginCodexTask(task, "cancelled", { message: ui("任务已停止") });
          renderCodexChatMessages();
          setCodexChatStatus(ui("已停止 · 可继续提问"));
          updateCodexChatControls();
          updateSelectionUi();
        }
      })
      .catch(error => {
        if (codexChatTask?.id === task.id) {
          task.cancelRequested = false;
          updateCodexChatProgress(task, task.progressBeforeCancel || ui("Codex 正在处理…"));
          setCodexChatStatus(error?.message || ui("停止会话失败"), "error");
          updateCodexChatControls();
        }
      });
  });
  shareBridgeButtonEl.addEventListener("click", createBridgeShare);
  const setCollaborationPanelOpen = open => {
    collaborationPanelDismissed = !open;
    sessionStorage.setItem("__pagedock_collaboration_closed__", open ? "0" : "1");
    renderExternalCollaboration();
  };
  collaborationCloseEl.addEventListener("click", () => setCollaborationPanelOpen(false));
  boardCollaborationEl.addEventListener("click", () => {
    exportMenuEl.open = false;
    setCollaborationPanelOpen(collaborationPanelEl.hidden);
  });
  homeCollaborationEl.addEventListener("click", () => {
    homeMoreMenuEl.open = false;
    setCollaborationPanelOpen(collaborationPanelEl.hidden);
  });
  collaborationSessionsEl.addEventListener("toggle", () => {
    if (collaborationSessionsEl.open) void loadLocalCodexSessions(true);
  });
  codexSessionBackEl.addEventListener("click", closeLocalCodexSessionPreview);
  copyBridgeShareEl.addEventListener("click", async () => {
    if (!shareBridgeTextEl.value) return;
    try {
      await copyTaskAnswer(shareBridgeTextEl.value);
      setBridgeShareDialogStatus(ui("协作链接已复制"));
    } catch (error) {
      setBridgeShareDialogStatus(error?.message || ui("复制失败，请手动复制"), "error");
    }
  });
  copyCodexShareEl.addEventListener("click", async () => {
    if (!shareCodexTextEl.value) return;
    try {
      await copyTaskAnswer(shareCodexTextEl.value);
      setBridgeShareDialogStatus(ui("Codex 接入指令已复制"));
    } catch (error) {
      setBridgeShareDialogStatus(error?.message || ui("复制失败，请手动复制"), "error");
    }
  });
  stopBridgeShareEl.addEventListener("click", stopBridgeShare);
  document.getElementById("closeBridgeShare").addEventListener("click", () => shareBridgeDialogEl.close());
  shareBridgeDialogEl.addEventListener("click", closeDialogFromBackdrop);
  workflowTemplateDialogEl.addEventListener("click", closeDialogFromBackdrop);
  versionHistoryDialogEl.addEventListener("click", closeDialogFromBackdrop);
  healthCheckDialogEl.addEventListener("click", closeDialogFromBackdrop);
  connectionGuideDialogEl.addEventListener("click", closeDialogFromBackdrop);
  taskScheduleDialogEl.addEventListener("click", closeDialogFromBackdrop);
  provenanceDialogEl.addEventListener("click", closeDialogFromBackdrop);
  document.getElementById("closeWorkflowTemplates").addEventListener("click", () => workflowTemplateDialogEl.close());
  document.getElementById("closeVersionHistory").addEventListener("click", () => versionHistoryDialogEl.close());
  document.getElementById("closeHealthCheck").addEventListener("click", () => healthCheckDialogEl.close());
  document.getElementById("closeConnectionGuide").addEventListener("click", () => connectionGuideDialogEl.close());
  document.getElementById("checkConnectionGuide").addEventListener("click", checkConnectionGuide);
  document.getElementById("copyConnectionGuideCommand").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(connectionGuideCommandTextEl.textContent);
      connectionGuideStatusEl.textContent = ui("安装命令已复制。");
    } catch (_error) {
      connectionGuideStatusEl.textContent = ui("复制失败，请手动复制上面的命令。");
    }
  });
  document.getElementById("cancelTaskSchedule").addEventListener("click", () => taskScheduleDialogEl.close());
  document.getElementById("closeProvenance").addEventListener("click", () => provenanceDialogEl.close());
  document.getElementById("taskScheduleForm").addEventListener("submit", event => {
    event.preventDefault();
    const item = itemById(scheduledTaskItemId);
    const nextRunAt = new Date(taskScheduleAtEl.value).getTime();
    const prompt = String(item?.text || [...(item?.taskMessages || [])].reverse().find(message => message.role === "user")?.text || "").trim();
    if (!prompt) {
      setStatus(ui("请先填写任务内容，再设置定时执行"), true);
      return;
    }
    if (!item || !Number.isFinite(nextRunAt) || nextRunAt <= Date.now()) {
      setStatus(ui("请选择未来的执行时间"), true);
      return;
    }
    const previous = PageDockBoardDomain.normalizeTaskSchedule(item.taskSchedule);
    persistTaskSchedule(item, {
      ...previous,
      enabled: true,
      repeat: taskScheduleRepeatEl.value,
      execution: item.taskWorkflowRole === "controller" ? "workflow" : taskScheduleExecutionEl.value,
      nextRunAt,
      retryAt: 0,
      lastStatus: "",
      lastError: ""
    }).then(() => {
      taskScheduleDialogEl.close();
      setStatus(ui("已设置{0}", taskScheduleLabel(item.taskSchedule)));
    }).catch(error => setStatus(error?.message || ui("定时设置失败"), true));
  });
  clearTaskScheduleEl.addEventListener("click", () => {
    const item = itemById(scheduledTaskItemId);
    if (!item) return;
    persistTaskSchedule(item, null).then(() => {
      taskScheduleDialogEl.close();
      setStatus(ui("已取消定时执行"));
    }).catch(error => setStatus(error?.message || ui("取消定时失败"), true));
  });
  document.getElementById("confirmSaveWorkflowTemplate").addEventListener("click", () => {
    saveCurrentWorkflowTemplate().catch(error => setStatus(error?.message || ui("模板保存失败"), true));
  });
  document.getElementById("runWorkflow").addEventListener("click", runCurrentWorkflow);
  document.getElementById("rerunHealthCheck").addEventListener("click", runHealthCheck);
  document.getElementById("homeButton").addEventListener("click", () => renderHome());
  document.getElementById("backBoards").addEventListener("click", () => renderHome());
  document.getElementById("newBoard").addEventListener("click", openCreateBoardDialog);
  document.getElementById("journeyCapture").addEventListener("click", () => {
    console.info("[pagedock-onboarding] quick capture selected");
    quickTextEl.focus();
    quickTextEl.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  document.getElementById("journeyCreateBoard").addEventListener("click", () => {
    console.info("[pagedock-onboarding] first board selected");
    openCreateBoardDialog();
  });
  document.getElementById("cancelNewBoard").addEventListener("click", () => newBoardDialogEl.close());
  newBoardDialogEl.addEventListener("click", closeDialogFromBackdrop);
  pageDialogEl.addEventListener("click", closeDialogFromBackdrop);
  document.getElementById("newBoardForm").addEventListener("submit", async event => {
    event.preventDefault();
    const name = newBoardNameEl.value.trim();
    if (!name) {
      newBoardNameEl.setCustomValidity(ui("请输入白板名称"));
      newBoardNameEl.reportValidity();
      return;
    }
    newBoardNameEl.setCustomValidity("");
    try {
      const board = await db.createBoard(name);
      notifyDataChanged([board.id], "create-board");
      newBoardDialogEl.close();
      await openBoard(board.id);
    } catch (error) {
      setStatus(error?.message || ui("白板创建失败"), true);
    }
  });
  newBoardNameEl.addEventListener("input", () => newBoardNameEl.setCustomValidity(""));
  document.getElementById("cancelPage").addEventListener("click", () => pageDialogEl.close());
  document.getElementById("pageForm").addEventListener("submit", event => {
    event.preventDefault();
    try {
      addPageItem(pageUrlEl.value, insertionPoint());
      pageUrlEl.setCustomValidity("");
      pageDialogEl.close();
    } catch (error) {
      pageUrlEl.setCustomValidity(error.message || ui("网页地址无效"));
      pageUrlEl.reportValidity();
    }
  });
  pageUrlEl.addEventListener("input", () => pageUrlEl.setCustomValidity(""));
  document.getElementById("openInbox").addEventListener("click", () => openBoard(db.INBOX_ID));
  homeSearchEl.addEventListener("input", scheduleHomeFilter);
  document.getElementById("quickAdd").addEventListener("click", async () => {
    const text = quickTextEl.value.trim();
    if (!text) return;
    const button = document.getElementById("quickAdd");
    const firstRun = document.body.dataset.onboarding === "first-run";
    button.disabled = true;
    button.dataset.state = "loading";
    button.textContent = ui("保存中…");
    try {
      const savedItem = await db.addItem(db.INBOX_ID, { type: /^https?:\/\/\S+$/i.test(text) ? "link" : "text", text, src: /^https?:\/\//i.test(text) ? text : "" });
      quickTextEl.value = "";
      await finishHomeCapture([savedItem], firstRun, ui("已保存到收件箱"));
    } catch (error) {
      setStatus(error?.message || ui("内容未能保存到收件箱"), true);
    } finally {
      button.disabled = false;
      button.dataset.state = "default";
      button.textContent = firstRun ? ui("开始收集") : ui("存入收件箱");
    }
  });
  quickTextEl.addEventListener("keydown", event => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing || event.keyCode === 229) return;
    event.preventDefault();
    document.getElementById("quickAdd").click();
  });
  quickTextEl.addEventListener("paste", event => {
    const imageFiles = [...(event.clipboardData?.items || [])]
      .filter(item => item.type.startsWith("image/"))
      .map(item => item.getAsFile())
      .filter(Boolean);
    if (!imageFiles.length) return;
    event.preventDefault();
    captureHomeImages(imageFiles);
  });
  quickCaptureWrapEl.addEventListener("dragover", event => {
    if (![...(event.dataTransfer?.items || [])].some(item => item.type.startsWith("image/"))) return;
    event.preventDefault();
    quickCaptureWrapEl.dataset.dragging = "true";
  });
  quickCaptureWrapEl.addEventListener("dragleave", event => {
    if (!quickCaptureWrapEl.contains(event.relatedTarget)) delete quickCaptureWrapEl.dataset.dragging;
  });
  quickCaptureWrapEl.addEventListener("drop", event => {
    delete quickCaptureWrapEl.dataset.dragging;
    const imageFiles = [...(event.dataTransfer?.files || [])].filter(file => file.type.startsWith("image/"));
    if (!imageFiles.length) return;
    event.preventDefault();
    captureHomeImages(imageFiles);
  });
  document.getElementById("emptyAddText").addEventListener("click", () => {
    console.info("[pagedock-onboarding] empty board text selected", { boardId: currentBoard?.id });
    addTextItem("", insertionPoint(), true);
  });
  document.getElementById("emptyAddImage").addEventListener("click", () => {
    console.info("[pagedock-onboarding] empty board image selected", { boardId: currentBoard?.id });
    imageInputEl.click();
  });
  document.getElementById("emptyAddTask").addEventListener("click", () => {
    console.info("[pagedock-onboarding] empty board task selected", { boardId: currentBoard?.id });
    addTaskItem(taskInsertionPoint());
  });
  document.getElementById("addText").addEventListener("click", () => {
    addMenuEl.open = false;
    addTextItem("", insertionPoint(), true);
  });
  document.getElementById("addDocument").addEventListener("click", () => {
    addMenuEl.open = false;
    addDocumentItem(insertionPoint());
  });
  document.getElementById("addCode").addEventListener("click", () => {
    addMenuEl.open = false;
    addCodeItem(insertionPoint());
  });
  document.getElementById("addImage").addEventListener("click", () => {
    addMenuEl.open = false;
    imageInputEl.click();
  });
  document.getElementById("addFile").addEventListener("click", async () => {
    addMenuEl.open = false;
    try { await chooseLocalCard("file"); } catch (error) {
      if (error?.name !== "AbortError") setStatus(error?.message || ui("添加文件失败"), true);
    }
  });
  document.getElementById("addFolder").addEventListener("click", async () => {
    addMenuEl.open = false;
    try { await chooseLocalCard("folder"); } catch (error) {
      if (error?.name !== "AbortError") setStatus(error?.message || ui("添加文件夹失败"), true);
    }
  });
  document.getElementById("addPage").addEventListener("click", () => {
    addMenuEl.open = false;
    openPageDialog();
  });
  document.getElementById("addTerminal").addEventListener("click", () => {
    addMenuEl.open = false;
    addTerminalItem(insertionPoint());
  });
  document.getElementById("addTask").addEventListener("click", () => {
    addMenuEl.open = false;
    addTaskItem(taskInsertionPoint());
  });
  imageInputEl.addEventListener("change", async () => {
    await addImageFiles([...imageInputEl.files]);
    imageInputEl.value = "";
  });
  localFileInputEl.addEventListener("change", async () => {
    const file = localFileInputEl.files?.[0];
    if (!file) return;
    const draft = await snapshotFileForCard(file);
    draft.card = cardProtocol.normalizeMeta(draft);
    cardProtocol.grant(draft, "local-file-read");
    const target = itemById(localRelinkTargetId);
    if (target?.type === "file") {
      Object.assign(target, draft, { localHandleId: "", updatedAt: Date.now() });
      updateLocalCardElement(target);
      scheduleSave();
    } else {
      const point = insertionPoint();
      addBoardItem({ ...draft, x: point.x, y: point.y, width: 480, height: 320 });
    }
    localRelinkTargetId = "";
    localFileInputEl.value = "";
  });
  localFolderInputEl.addEventListener("change", () => {
    const files = [...(localFolderInputEl.files || [])];
    if (!files.length) return;
    const root = files[0].webkitRelativePath?.split("/")[0] || ui("文件夹");
    const draft = {
      type: "folder",
      localName: root,
      localKind: "directory",
      localPermissionState: "granted",
      localEntries: files.slice(0, 200).map(file => ({ name: file.webkitRelativePath || file.name, kind: "file" }))
    };
    draft.card = cardProtocol.normalizeMeta(draft);
    cardProtocol.grant(draft, "local-folder-read");
    const target = itemById(localRelinkTargetId);
    if (target?.type === "folder") {
      Object.assign(target, draft, { localHandleId: "", updatedAt: Date.now() });
      updateLocalCardElement(target);
      scheduleSave();
    } else {
      const point = insertionPoint();
      addBoardItem({ ...draft, x: point.x, y: point.y, width: 440, height: 360 });
    }
    localRelinkTargetId = "";
    localFolderInputEl.value = "";
  });
  document.getElementById("undo").addEventListener("click", () => applyHistory(historyIndex - 1));
  document.getElementById("redo").addEventListener("click", () => applyHistory(historyIndex + 1));
  optimizeLayoutEl.addEventListener("click", () => {
    exportMenuEl.open = false;
    optimizeBoardLayout();
  });
  askSelectionWithCodexEl.addEventListener("click", createSelectionCodexTask);
  extractKnowledgeCardEl.addEventListener("click", extractKnowledgeCardFromSelection);
  codexSelectionClearEl.addEventListener("click", () => {
    if (codexChatTask) return;
    codexAttachedSelectionIds = [];
    codexAttachedPage = undefined;
    updateCodexSelectionContext();
  });
  document.getElementById("alignLeft").addEventListener("click", () => {
    document.getElementById("selectionMoreMenu").open = false;
    alignSelection("x");
  });
  document.getElementById("alignTop").addEventListener("click", () => {
    document.getElementById("selectionMoreMenu").open = false;
    alignSelection("y");
  });
  document.getElementById("connectItems").addEventListener("click", () => {
    document.getElementById("selectionMoreMenu").open = false;
    connectSelectedItems();
  });
  document.getElementById("groupItems").addEventListener("click", () => {
    document.getElementById("selectionMoreMenu").open = false;
    groupSelection();
  });
  document.getElementById("ungroupItems").addEventListener("click", () => {
    document.getElementById("selectionMoreMenu").open = false;
    ungroupSelection();
  });
  summarizeSelectionTextEl.addEventListener("click", () => {
    if (codexAttachedPage?.content) {
      codexChatInputEl.value = ui("请总结当前网页：先给出一句话结论，再列出关键观点、重要数据和可执行事项。不要遗漏正文后半部分。");
      resizeCodexChatInput();
      sendCodexChatMessage();
      return;
    }
    runWhiteboardCodex("text");
  });
  summarizeSelectionImagesEl.addEventListener("click", () => runWhiteboardCodex("image"));
  summarizeSelectionVideoEl.addEventListener("click", () => runWhiteboardCodex("video", null, { videoEngine: selectionVideoEngineEl.value }));
  selectionAiCancelEl.addEventListener("click", () => {
    cancelWhiteboardTask(standaloneWhiteboardTask());
  });
  document.getElementById("zoomOut").addEventListener("click", () => setZoom(zoom - .1));
  document.getElementById("zoomIn").addEventListener("click", () => setZoom(zoom + .1));
  document.getElementById("zoomReset").addEventListener("click", fitBoard);
  document.getElementById("exportBoard").addEventListener("click", exportCurrentBoard);
  document.getElementById("backupAll").addEventListener("click", backupAllBoards);
  document.getElementById("openWorkflowTemplates").addEventListener("click", openWorkflowTemplates);
  document.getElementById("homeTemplates").addEventListener("click", () => {
    homeMoreMenuEl.open = false;
    openWorkflowTemplates();
  });
  document.getElementById("openVersionHistory").addEventListener("click", openVersionHistory);
  document.getElementById("openHealthCheck").addEventListener("click", openHealthCheck);
  document.getElementById("homeHealthCheck").addEventListener("click", () => {
    homeMoreMenuEl.open = false;
    openHealthCheck();
  });
  document.getElementById("exportPng").addEventListener("click", () => exportBoardImage("png"));
  document.getElementById("exportPdf").addEventListener("click", () => exportBoardImage("pdf"));
  document.getElementById("importBoard").addEventListener("click", () => importInputEl.click());
  document.getElementById("homeImport").addEventListener("click", () => {
    homeMoreMenuEl.open = false;
    importInputEl.click();
  });
  document.getElementById("deleteBoard").addEventListener("click", deleteCurrentBoard);
  importInputEl.addEventListener("change", importSelectedFile);
  boardNameEl.addEventListener("input", scheduleSave);
  boardNameEl.addEventListener("change", async () => {
    if (!currentBoard) return;
    document.title = ui("{0} · 拾作", boardNameEl.value || ui("未命名白板"));
    await saveBoardNow();
    notifyDataChanged([currentBoard.id], "rename-board");
  });

  document.addEventListener("paste", handlePaste);
  document.addEventListener("copy", handleCopy);
  document.addEventListener("keydown", event => {
    if (blockBrowserPageZoomShortcut(event)) return;
    if (event.key === "Escape") {
      if (focusedItemId) {
        event.preventDefault();
        exitItemFocus();
        return;
      }
      addMenuEl.open = false;
      exportMenuEl.open = false;
      homeMoreMenuEl.open = false;
      selectionMoreMenuEl.open = false;
      if (currentBoard) selectItems([]);
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      return;
    }
    const editing = event.target.closest?.(".text-content,input,textarea");
    if (event.code === "Space" && !editing) {
      spacePressed = true;
      if (currentBoard) event.preventDefault();
    }
    if (!currentBoard || editing) return;
    const command = event.metaKey || event.ctrlKey;
    if (command && event.key.toLowerCase() === "z") {
      event.preventDefault();
      applyHistory(historyIndex + (event.shiftKey ? 1 : -1));
      return;
    }
    if (command && event.key.toLowerCase() === "a") {
      event.preventDefault();
      selectItems(boardItems.map(item => item.id));
      return;
    }
    if (command && event.key.toLowerCase() === "g") {
      event.preventDefault();
      if (event.shiftKey) ungroupSelection();
      else groupSelection();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      if (selectedIds.size) {
        event.preventDefault();
        removeItems([...selectedIds]);
      }
    }
  });
  document.addEventListener("keyup", event => {
    if (event.code === "Space") spacePressed = false;
  });
  window.addEventListener("blur", () => { spacePressed = false; });
  window.addEventListener("popstate", () => {
    const id = new URLSearchParams(location.search).get("board");
    if (id) openBoard(id, false);
    else renderHome(false);
  });
  // 不在 window focus 时替换白板卡片，否则首次点击可能在 pointerdown 与 click 之间丢失。
  document.addEventListener("visibilitychange", refreshHomeWhenVisible);
  globalThis.chrome?.runtime?.onMessage?.addListener(message => {
    if (message?.type === TERMINAL_EVENT) {
      handleTerminalEvent(message.event);
      return;
    }
    if (message?.type === CODEX_EVENT) {
      if (message.event?.type === "external-codex-status") {
        updateExternalCodexStatus(message.event);
        return;
      }
      if (["local-codex-session-status", "external-codex-activity", "external-codex-task", "external-codex-approval", "external-codex-presence", "external-card-stream"].includes(message.event?.type)) {
        handleExternalCollaborationEvent(message.event);
        return;
      }
      trackCodexEvent(message.event);
      // 定时任务由后台持久化，画布只展示全局运行态并等待数据库变更通知刷新卡片。
      if (message.event?.scheduled) return;
      handleWhiteboardCodexEvent(message.event);
      handleBoardCardCodexEvent(message.event);
      handleCodexChatEvent(message.event);
      return;
    }
    if (message?.type !== "pagedock-data-changed") return;
    if (message.source === messageSource) return;
    if (!currentBoard) {
      renderHome(false);
      return;
    }
    if (!message.boardIds?.includes(currentBoard.id)) return;
    if (saveTimer) {
      setStatus(ui("检测到外部更新，完成当前编辑后请重新打开白板"));
      return;
    }
    openBoard(currentBoard.id, false);
  });

  // Canvas interaction should return transient toolbar controls to their resting state.
  cardFocusLayerEl.addEventListener("pointerdown", event => {
    if (event.target === cardFocusLayerEl) exitItemFocus();
  });
  viewportEl.addEventListener("pointerdown", resetBoardSurfaceUi, true);
  boardEl.addEventListener("pointerdown", startMarquee);
  boardEl.addEventListener("dblclick", event => {
    if (event.target === boardEl) addTextItem("", boardPointFromEvent(event), true);
  });
  viewportEl.addEventListener("pointermove", event => { lastBoardPoint = boardPointFromEvent(event); });
  viewportEl.addEventListener("scroll", () => {
    updateMinimapViewport();
    positionSelectionActions();
    scheduleSave();
  });
  viewportEl.addEventListener("wheel", event => {
    if (!(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    // Trackpads emit many small wheel events, so scale proportionally instead of jumping 10% each time.
    const normalizedDelta = clamp(event.deltaY, -100, 100);
    setZoom(zoom * Math.exp(-normalizedDelta * .01));
  }, { passive: false });
  document.addEventListener("wheel", blockBrowserPageZoomOutsideCanvas, { capture: true, passive: false });
  viewportEl.addEventListener("dragover", event => event.preventDefault());
  viewportEl.addEventListener("drop", async event => {
    event.preventDefault();
    await addDroppedItems(event.dataTransfer, boardPointFromEvent(event));
  });
  minimapEl.addEventListener("click", event => {
    const rect = minimapEl.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * boardWidth;
    const y = (event.clientY - rect.top) / rect.height * boardHeight;
    viewportEl.scrollLeft = x * zoom - viewportEl.clientWidth / 2;
    viewportEl.scrollTop = y * zoom - viewportEl.clientHeight / 2;
  });
  window.addEventListener("resize", positionSelectionActions);
  setupPanning();
}

async function boot() {
  await ShizuoI18n.ready;
  if (!db) throw new Error(ui("拾作数据库模块未载入"));
  wireEvents();
  await loadAiRuntime();
  const params = new URLSearchParams(location.search);
  if (params.get("codex") === "page") {
    const stored = (await chrome.storage.local.get(CODEX_PAGE_ATTACHMENT_KEY))[CODEX_PAGE_ATTACHMENT_KEY];
    if (stored?.content && Date.now() - Number(stored.createdAt || 0) < 10 * 60 * 1000) {
      codexAttachedPage = stored;
    }
    await chrome.storage.local.remove(CODEX_PAGE_ATTACHMENT_KEY);
  }
  await loadCodexChatMessages();
  setCodexChatOpen(Boolean(codexAttachedPage) || sessionStorage.getItem("__pagedock_codex_chat_open__") === "1");
  await connectCodexChat();
  await db.ensureInbox();
  await migrateLegacyBoard();
  const boardId = params.get("board");
  if (boardId) await openBoard(boardId, false);
  else await renderHome(false);
  setInterval(refreshTaskElapsedLabels, 1000);
}

boot().catch(error => {
  console.error("[pagedock] boot failed", error);
  setStatus(error?.message || ui("拾作载入失败"), true);
});
