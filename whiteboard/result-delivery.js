// Module: AI result delivery into cards, provenance, and relations.
async function addWhiteboardAiResult(task, answer) {
  // 任务卡是 Codex 输出的直接上游；没有任务卡时，输出直接连接到原始圈选素材。
  const relationSourceIds = task.taskItemId ? [task.taskItemId] : task.selectionIds;
  const provenance = {
    version: 1,
    operation: `codex-generate-${task.mode}`,
    actor: { id: "codex", name: "Codex" },
    parents: task.parentSnapshots || [],
    createdAt: Date.now()
  };
  if (task.mode === "knowledge") {
    const item = {
      type: "document",
      text: String(answer || "# 知识卡\n\n未识别到可提炼的内容").trim(),
      documentLanguage: "markdown",
      x: task.point.x,
      y: task.point.y,
      width: 520,
      height: 420,
      knowledgeState: "success",
      relationSourceIds,
      generationContext: task.contextSnapshot,
      provenance
    };
    if (currentBoard?.id === task.boardId) {
      const placeholder = itemById(task.resultItemId);
      if (placeholder) {
        Object.assign(placeholder, item, { id: placeholder.id, updatedAt: Date.now() });
        placeholder.card = cardProtocol.normalizeMeta(placeholder);
        itemElement(placeholder.id)?.replaceWith(createItemElement(placeholder));
        updateSelectionUi();
        renderConnections();
        renderMinimap();
        scheduleSave();
        return;
      }
      addBoardItem(item, false, taskMatchesCurrentSelection(task));
      return;
    }
    await db.addItem(task.boardId, item);
    notifyDataChanged([task.boardId], "whiteboard-ai-knowledge-result");
    return;
  }
  if (["video", "video-post"].includes(task.mode)) {
    const artifact = task.videoArtifact;
    if (!artifact?.ready || !artifact.chunks?.length || artifact.chunks.some(chunk => !chunk)) {
      throw new Error("视频文件回传不完整，请重试");
    }
    const src = `data:${artifact.mimeType || "video/mp4"};base64,${artifact.chunks.join("")}`;
    const filename = safeFilename(artifact.filename || `${task.boardName}-AI-Video.mp4`);
    const item = {
      type: "video",
      src,
      alt: task.mode === "video-post" ? `Kokoro 口播视频：${task.boardName}` : `AI 视频：${task.boardName}`,
      filename: filename.endsWith(".mp4") ? filename : `${filename}.mp4`,
      x: task.point.x,
      y: task.point.y,
      width: 640,
      height: 440,
      relationSourceIds,
      generationContext: task.contextSnapshot,
      provenance
    };
    task.videoArtifact = undefined;
    if (currentBoard?.id === task.boardId) {
      const selectResult = taskMatchesCurrentSelection(task);
      addBoardItem(item, false, selectResult);
      return;
    }
    await db.addItem(task.boardId, item);
    notifyDataChanged([task.boardId], "whiteboard-ai-video-result");
    return;
  }
  if (task.mode === "image-gen") {
    const artifact = task.imageArtifact;
    if (!artifact?.ready || !artifact.chunks?.length || artifact.chunks.some(chunk => !chunk)) {
      throw new Error("AI 自由绘图文件回传不完整，请重试");
    }
    const src = `data:${artifact.mimeType || "image/png"};base64,${artifact.chunks.join("")}`;
    const alt = `Codex AI 自由绘图：${safeFilename(artifact.filename || task.boardName)}`;
    task.imageArtifact = undefined;
    if (currentBoard?.id === task.boardId) {
      const selectResult = taskMatchesCurrentSelection(task);
      await addImageSource(src, alt, task.point, null, selectResult, relationSourceIds, {
        generationContext: task.contextSnapshot,
        provenance
      });
      return;
    }
    const dimensions = await imageDimensions(src);
    const naturalWidth = Math.max(1, Number(dimensions.width) || 1);
    const naturalHeight = Math.max(1, Number(dimensions.height) || 1);
    const width = clamp(naturalWidth, 240, 560);
    await db.addItem(task.boardId, {
      type: "image",
      src,
      alt,
      x: task.point.x,
      y: task.point.y,
      width,
      height: Math.min(760, Math.max(80, Math.round(width * naturalHeight / naturalWidth)) + 58),
      relationSourceIds,
      generationContext: task.contextSnapshot,
      provenance
    });
    notifyDataChanged([task.boardId], "whiteboard-ai-image-gen-result");
    return;
  }
  if (task.mode === "image") {
    const visual = await renderVisualSummary(task, answer);
    if (currentBoard?.id === task.boardId) {
      const selectResult = taskMatchesCurrentSelection(task);
      await addImageSource(visual.dataUrl, `Codex 图片：${visual.title}`, task.point, null, selectResult, relationSourceIds, {
        generationContext: task.contextSnapshot,
        provenance
      });
      return;
    }
    const width = 560;
    await db.addItem(task.boardId, {
      type: "image",
      src: visual.dataUrl,
      alt: `Codex 图片：${visual.title}`,
      x: task.point.x,
      y: task.point.y,
      width,
      height: Math.round(width / visual.aspectRatio) + 58,
      relationSourceIds,
      generationContext: task.contextSnapshot,
      provenance
    });
    notifyDataChanged([task.boardId], "whiteboard-ai-visual-result");
    return;
  }
  const text = `Codex 总结\n\n${String(answer || "Codex 没有返回内容").trim()}`;
  const lineEstimate = text.split("\n").length + Math.ceil(text.length / 34);
  const item = {
    type: "text",
    text,
    x: task.point.x,
    y: task.point.y,
    width: 420,
    height: clamp(120 + lineEstimate * 18, 180, 620),
    relationSourceIds,
    generationContext: task.contextSnapshot,
    provenance
  };
  if (currentBoard?.id === task.boardId) {
    const selectResult = taskMatchesCurrentSelection(task);
    addBoardItem(item, false, selectResult);
    return;
  }
  await db.addItem(task.boardId, item);
  notifyDataChanged([task.boardId], "whiteboard-ai-result");
}

function handleWhiteboardCodexEvent(message) {
  const task = whiteboardCodexTasks.get(String(message?.id || ""));
  if (!task) return;
  if (message.type === "done" && task.mode === "workflow-plan") {
    completeDynamicWorkflowPlan(task, message.answer).catch(error => {
      whiteboardCodexTasks.delete(task.id);
      const controller = currentBoard?.id === task.boardId ? itemById(task.taskItemId) : null;
      if (!controller) return;
      controller.taskMessages = task.messagesBefore;
      controller.text = task.userPrompt;
      controller.taskStatus = "error";
      controller.taskError = error?.message || "动态工作流规划失败";
      controller.taskProgress = "";
      controller.taskRunId = "";
      controller.taskCompletedAt = Date.now();
      updateTaskItemElement(controller);
      scheduleSave();
      console.error("[pagedock-dynamic-workflow] planning failed", error);
    });
    return;
  }
  if (message.type === "artifact-start" && task.mode === "image-gen" && message.artifactType === "image") {
    const totalChunks = Number(message.totalChunks) || 0;
    if (totalChunks < 1 || totalChunks > MAX_CODEX_IMAGE_CHUNKS) {
      updateWhiteboardCodexStatus(task, "生成图片过大，无法回传到白板");
      return;
    }
    task.imageArtifact = {
      mimeType: String(message.mimeType || "image/png"),
      filename: String(message.filename || "拾作-AI-Image.png"),
      size: Number(message.size) || 0,
      chunks: new Array(totalChunks),
      received: 0,
      ready: false
    };
    updateWhiteboardCodexStatus(task, "正在将图片添加到白板");
    return;
  }
  if (message.type === "artifact-chunk" && message.artifactType === "image" && task.imageArtifact) {
    const index = Number(message.index);
    if (!Number.isInteger(index) || index < 0 || index >= task.imageArtifact.chunks.length) return;
    if (!task.imageArtifact.chunks[index]) task.imageArtifact.received += 1;
    task.imageArtifact.chunks[index] = String(message.data || "");
    const percent = Math.round(task.imageArtifact.received / task.imageArtifact.chunks.length * 100);
    updateWhiteboardCodexStatus(task, `正在将图片添加到白板 · ${percent}%`);
    return;
  }
  if (message.type === "artifact-done" && message.artifactType === "image" && task.imageArtifact) {
    task.imageArtifact.ready = task.imageArtifact.received === task.imageArtifact.chunks.length;
    updateWhiteboardCodexStatus(task, "正在将图片添加到白板");
    return;
  }
  if (message.type === "artifact-start" && ["video", "video-post"].includes(task.mode)) {
    const totalChunks = Number(message.totalChunks) || 0;
    if (totalChunks < 1 || totalChunks > MAX_CODEX_VIDEO_CHUNKS) {
      updateWhiteboardCodexStatus(task, "视频文件过大，无法回传到白板");
      return;
    }
    task.videoArtifact = {
      mimeType: String(message.mimeType || "video/mp4"),
      filename: String(message.filename || "拾作-AI-Video.mp4"),
      size: Number(message.size) || 0,
      chunks: new Array(totalChunks),
      received: 0,
      ready: false
    };
    updateWhiteboardCodexStatus(task, "正在导出视频");
    return;
  }
  if (message.type === "artifact-chunk" && task.videoArtifact) {
    const index = Number(message.index);
    if (!Number.isInteger(index) || index < 0 || index >= task.videoArtifact.chunks.length) return;
    if (!task.videoArtifact.chunks[index]) task.videoArtifact.received += 1;
    task.videoArtifact.chunks[index] = String(message.data || "");
    const percent = Math.round(task.videoArtifact.received / task.videoArtifact.chunks.length * 100);
    updateWhiteboardCodexStatus(task, `正在导出视频 · ${percent}%`);
    return;
  }
  if (message.type === "artifact-done" && task.videoArtifact) {
    task.videoArtifact.ready = task.videoArtifact.received === task.videoArtifact.chunks.length;
    updateWhiteboardCodexStatus(task, "正在导出视频");
    return;
  }
  if (message.type === "started" || message.type === "progress") {
    const taskItem = task.taskItemId && currentBoard?.id === task.boardId ? itemById(task.taskItemId) : null;
    if (taskItem) {
      recordTaskProgress(taskItem, message, "正在理解素材");
      task.taskEvents = taskItem.taskEvents;
      task.status = taskItem.taskProgress;
    } else {
      updateWhiteboardCodexStatus(task, friendlyCodexProgress(message, "正在理解素材"));
      if (task.taskItemId) {
        const event = normalizeTaskEvent({
          stage: message.stage,
          label: friendlyCodexProgress(message, "正在理解素材"),
          detail: message.detail,
          status: message.status,
          createdAt: message.createdAt
        });
        task.taskEvents = compactTaskEvents([...(task.taskEvents || []), event]);
        applyBoardCardTaskPatch(task, { taskProgress: event.label, taskEvents: task.taskEvents }).catch(error => {
          console.warn("[pagedock-whiteboard-ai] inactive progress save failed", error);
        });
      }
    }
    return;
  }
  if (message.type === "done") {
    updateWhiteboardCodexStatus(task, ["video", "video-post"].includes(task.mode)
      ? "正在导出视频"
      : task.mode === "image-gen"
        ? "正在将图片添加到白板"
        : task.mode === "image" ? "正在生成图片…" : task.mode === "knowledge" ? "正在整理知识卡…" : "正在生成文字卡片…");
    const linkedTaskResult = task.mode === "text"
      ? String(message.answer || "Codex 没有返回内容")
      : ["image", "image-gen"].includes(task.mode)
        ? "图片已生成并添加到白板"
        : task.mode === "video-post" ? "口播与字幕已添加到新视频" : "视频已生成并添加到白板";
    const resultWork = task.taskItemId && task.mode === "text"
      ? Promise.resolve()
      : addWhiteboardAiResult(task, message.answer);
    resultWork
      .then(() => task.taskItemId
        ? applyBoardCardTaskPatch(task, {
            taskStatus: "success",
            taskResult: linkedTaskResult,
            taskMessages: task.mode === "text"
              ? appendTaskMessage(task.conversationMessages, "assistant", linkedTaskResult)
              : task.messagesBefore,
            taskError: "",
            taskProgress: "",
            taskRunId: "",
            taskGenerationScope: "latest",
            taskGenerationMessageId: "",
            taskCompletedAt: Date.now(),
            taskEvents: [...(task.taskEvents || []), normalizeTaskEvent({ stage: "completed", label: "任务执行完成", status: "success" })].slice(-MAX_TASK_EVENTS)
          })
        : undefined)
      .then(() => {
        whiteboardCodexTasks.delete(task.id);
        console.info("[pagedock-whiteboard-ai] finished", {
          taskId: task.id,
          taskItemId: task.taskItemId || "",
          mode: task.mode
        });
        updateSelectionUi();
        updateCodexChatControls();
        if (!task.taskItemId && task.mode === "knowledge") setStatus("知识卡已生成", false, "success");
        task.finishTask?.({ status: "success", reason: "" });
      })
      .catch(error => {
        whiteboardCodexTasks.delete(task.id);
        console.error("[pagedock-whiteboard-ai] result save failed", error);
        if (task.taskItemId) {
          const taskItem = currentBoard?.id === task.boardId ? itemById(task.taskItemId) : null;
          applyBoardCardTaskPatch(task, {
            taskStatus: "error",
            taskMessages: task.messagesBefore,
            text: String(taskItem?.text || "").trim() ? taskItem.text : task.userPrompt,
            taskError: error?.message || "AI 结果保存失败",
            taskProgress: "",
            taskRunId: "",
            taskCompletedAt: Date.now(),
            taskEvents: [...(task.taskEvents || []), normalizeTaskEvent({ stage: "failed", label: "结果保存失败", detail: error?.message || "", status: "error" })].slice(-MAX_TASK_EVENTS)
          }).catch(saveError => console.error("[pagedock-selection-task] failure save failed", saveError));
        }
        if (!task.taskItemId) setStatus("结果保存失败", true);
        finishKnowledgeCardPlaceholder(task, "error", error?.message || "知识卡保存失败，请重试");
        updateSelectionUi();
        updateCodexChatControls();
        task.finishTask?.({ status: "error", reason: error?.message || "AI 结果保存失败" });
      });
    return;
  }
  if (message.type === "error" || message.type === "cancelled") {
    whiteboardCodexTasks.delete(task.id);
    const status = message.type === "cancelled"
      ? "已停止"
      : (message.error || "AI 总结失败");
    if (task.taskItemId) {
      const taskItem = currentBoard?.id === task.boardId ? itemById(task.taskItemId) : null;
      applyBoardCardTaskPatch(task, {
        taskStatus: message.type === "cancelled" ? "cancelled" : "error",
        taskMessages: task.messagesBefore,
        text: String(taskItem?.text || "").trim() ? taskItem.text : task.userPrompt,
        taskError: message.type === "error" ? status : "",
        taskProgress: "",
        taskRunId: "",
        taskCompletedAt: Date.now(),
        taskEvents: [...(task.taskEvents || []), normalizeTaskEvent({
          stage: message.type === "cancelled" ? "cancelled" : "failed",
          label: message.type === "cancelled" ? "任务已停止" : "任务执行失败",
          detail: message.type === "error" ? status : "",
          status: message.type === "cancelled" ? "cancelled" : "error"
        })].slice(-MAX_TASK_EVENTS)
      }).catch(error => console.error("[pagedock-selection-task] final state save failed", error));
    }
    if (!task.taskItemId) setStatus(status, message.type === "error");
    finishKnowledgeCardPlaceholder(task, message.type === "cancelled" ? "cancelled" : "error", status);
    updateSelectionUi();
    updateCodexChatControls();
    task.finishTask?.({ status: message.type === "cancelled" ? "cancelled" : "error", reason: status });
  }
}
