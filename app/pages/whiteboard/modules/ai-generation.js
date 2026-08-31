// Module: AI context serialization and visual-summary generation.
function addLinkItem(url, title = "", point = insertionPoint(), source = null) {
  return addBoardItem({
    type: "link",
    text: title || url,
    src: url,
    x: point.x,
    y: point.y,
    width: 360,
    height: 112,
    source: source || { url, title, capturedAt: Date.now() }
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function imageDimensions(src) {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({ width: 420, height: 280 });
    image.src = src;
  });
}

async function addImageSource(src, alt = "", point = insertionPoint(), source = null, selectResult = true, relationSourceIds = [], metadata = {}) {
  if (!/^(data:image\/|blob:|https?:\/\/)/i.test(src || "")) return;
  const dimensions = await imageDimensions(src);
  const naturalWidth = Math.max(1, Number(dimensions.width) || 1);
  const naturalHeight = Math.max(1, Number(dimensions.height) || 1);
  const width = clamp(naturalWidth, 240, 560);
  const contentHeight = Math.max(80, Math.round(width * naturalHeight / naturalWidth));
  return addBoardItem({
    type: "image",
    src,
    alt,
    x: point.x,
    y: point.y,
    width,
    height: Math.min(760, contentHeight + 58 + (source ? 28 : 0)),
    source,
    relationSourceIds,
    ...metadata
  }, false, selectResult);
}

async function addImageFiles(files, point = insertionPoint()) {
  let offset = 0;
  for (const file of files) {
    if (!file?.type?.startsWith("image/")) continue;
    const src = await readFileAsDataUrl(file);
    await addImageSource(src, file.name, { x: point.x + offset, y: point.y + offset });
    offset += 26;
  }
}

function selectionTextForCodex(items) {
  return items
    .filter(item => ["text", "document", "code", "file", "folder", "link", "page", "video", "task", "terminal"].includes(item.type) && itemLabel(item).trim())
    .map((item, index) => {
      const source = item.source?.url ? `\n来源：${item.source.url}` : "";
      const link = item.type === "link" && item.src ? `\n链接：${item.src}` : "";
      const page = item.type === "page" && item.src
        ? `\n页面：${item.src}${item.pageContent ? `\n页面正文（${item.pageContentMode || "已渲染"}）：\n${item.pageContent}` : ""}`
        : "";
      const taskOutput = item.type === "task" ? cardTextOutput(item).trim() : "";
      const result = taskOutput ? `\n最新回答：${taskOutput.slice(0, 40_000)}` : "";
      const terminal = item.type === "terminal"
        ? `\n命令：${item.text || ""}\n控制台输出：${String(item.terminalOutput || "").slice(-20_000)}`
        : "";
      const local = ["file", "folder"].includes(item.type) ? `\n内容：\n${cardTextOutput(item).slice(0, 40_000)}` : "";
      const document = ["document", "code"].includes(item.type) ? `\n内容：\n${String(item.text || "").slice(0, 40_000)}` : "";
      return `[${index + 1}] ${itemTypeLabel(item)}卡片\n${itemLabel(item)}${result}${terminal}${local}${document}${link}${page}${source}`;
    })
    .join("\n\n");
}

function selectionContextForCodex(items) {
  const textContent = selectionTextForCodex(items);
  const images = items.filter(item => item.type === "image" && item.src);
  const imageMetadata = images
    .map((item, index) => `[图片 ${index + 1}] ${item.alt || item.source?.title || "未命名图片"}${item.source?.url ? `\n来源：${item.source.url}` : ""}`)
    .join("\n\n");
  return [
    `圈选内容共 ${items.length} 项：${items.filter(item => item.type === "text").length} 个文字、${items.filter(item => item.type === "document").length} 个文档、${items.filter(item => item.type === "code").length} 个代码、${items.filter(item => ["file", "folder"].includes(item.type)).length} 个本地文件、${images.length} 张图片、${items.filter(item => item.type === "link").length} 个链接、${items.filter(item => item.type === "page").length} 个页面、${items.filter(item => item.type === "video").length} 个视频卡片、${items.filter(item => item.type === "task").length} 个任务、${items.filter(item => item.type === "terminal").length} 个控制台。`,
    textContent ? `文字、链接、页面与控制台：\n\n${textContent}` : "",
    imageMetadata ? `图片名称与来源：\n\n${imageMetadata}` : ""
  ].filter(Boolean).join("\n\n---\n\n");
}

async function imageDataForCodex(item) {
  const response = await fetch(item.src);
  if (!response.ok) throw new Error(`图片读取失败：HTTP ${response.status}`);
  const blob = await response.blob();
  if (!/^image\/(png|jpe?g|webp)$/i.test(blob.type)) {
    throw new Error(`“${itemLabel(item)}”不是 Codex 支持的 PNG、JPEG 或 WebP 图片`);
  }
  if (blob.size > MAX_CODEX_IMAGE_BYTES) throw new Error(`“${itemLabel(item)}”超过 10 MB`);
  return readFileAsDataUrl(blob);
}

async function videoDataForCodex(item) {
  const response = await fetch(item.src);
  if (!response.ok) throw new Error(`视频读取失败：HTTP ${response.status}`);
  const blob = await response.blob();
  if (blob.type !== "video/mp4") throw new Error("当前只支持 MP4 视频后期");
  if (blob.size > MAX_CODEX_VIDEO_BYTES) throw new Error("视频超过 48 MB，无法添加口播");
  return readFileAsDataUrl(blob);
}

async function runWhiteboardCodex(mode, taskItem = null, contextOptions = {}) {
  if (!currentBoard) return;
  const generationContext = taskItem
    ? taskGenerationContext(taskItem, contextOptions)
    : { scope: "sources", label: "圈选内容", messages: [], messageIds: [], messageId: "" };
  const selectedVideoEngine = taskVideoEngine(taskItem?.taskVideoEngine || contextOptions.videoEngine);
  if (taskItem) {
    taskItem.taskLastMode = mode;
    cardProtocol.grant(taskItem, "codex-run");
    updatePermissionChip(taskItem);
  }
  if (taskItem && (preparingTaskItemIds.has(taskItem.id) || boardCardTaskForItem(taskItem.id) || whiteboardTaskForItem(taskItem.id))) return;
  if (!taskItem && standaloneWhiteboardTask()) return;
  if (codexAtCapacity()) {
    const error = codexCapacityReason();
    if (taskItem) {
      taskItem.taskStatus = "error";
      taskItem.taskError = error;
      updateTaskItemElement(taskItem);
      scheduleSave();
    }
    if (!taskItem) setStatus(error, true);
    return;
  }
  const selection = taskItem
    ? generationContext.scope === "sources"
      ? (taskItem.taskSourceIds || []).map(itemById).filter(Boolean)
      : []
    : Array.isArray(contextOptions.sourceIds)
      ? contextOptions.sourceIds.map(itemById).filter(Boolean)
      : attachedSelectionItems();
  if (!selection.length && generationContext.scope === "sources") {
    if (taskItem) {
      taskItem.taskStatus = "error";
      taskItem.taskError = "原始素材已不存在，请重新圈选，或改为基于当前回答";
      taskItem.taskProgress = "";
      updateTaskItemElement(taskItem);
      scheduleSave();
    }
    return;
  }
  if (taskItem) {
    cancellingPreparedTaskItemIds.delete(taskItem.id);
    preparingTaskItemIds.add(taskItem.id);
    taskItem.taskStatus = "running";
    taskItem.taskError = "";
    taskItem.taskProgress = selection.some(item => item.type === "page")
      ? "正在读取页面内容"
      : `正在理解${generationContext.label}`;
    taskItem.taskStartedAt = Date.now();
    taskItem.taskCompletedAt = 0;
    taskItem.taskEvents = [];
    appendTaskEvent(taskItem, { stage: "preparing", label: taskItem.taskProgress, status: "running" });
    updateTaskItemElement(taskItem);
    updateCodexChatControls();
  }
  try {
    await hydratePageCardsForCodex(selection, progress => {
      if (taskItem) {
        if (cancellingPreparedTaskItemIds.has(taskItem.id)) return;
        taskItem.taskProgress = progress;
        updateTaskItemElement(taskItem);
      } else {
        setStatus(progress);
      }
    });
  } catch (error) {
    if (taskItem) {
      const cancelled = completePreparingTaskCancellation(taskItem);
      if (cancelled) return cancelled;
      preparingTaskItemIds.delete(taskItem.id);
      taskItem.taskStatus = "error";
      taskItem.taskError = error?.message || "页面内容读取失败";
      taskItem.taskProgress = "";
      updateTaskItemElement(taskItem);
      scheduleSave();
      updateCodexChatControls();
    } else {
      setStatus(error?.message || "页面内容读取失败", true);
    }
    return;
  }
  if (taskItem) {
    const cancelled = completePreparingTaskCancellation(taskItem);
    if (cancelled) return cancelled;
  }
  const imageItems = selection.filter(item => item.type === "image" && item.src);
  if (imageItems.length > MAX_CODEX_IMAGES) {
    const error = `单次最多分析 ${MAX_CODEX_IMAGES} 张图片，请减少圈选内容`;
    if (taskItem) {
      preparingTaskItemIds.delete(taskItem.id);
      taskItem.taskStatus = "error";
      taskItem.taskError = error;
      taskItem.taskProgress = "";
      updateTaskItemElement(taskItem);
      scheduleSave();
    } else {
      selectionAiStatusEl.textContent = error;
      selectionAiStatusEl.classList.remove("hidden");
    }
    if (!taskItem) setStatus(error, true);
    return;
  }

  const shortcutLabels = {
    text: `总结${generationContext.label}`,
    image: `基于${generationContext.label}生成手稿信息图`,
    "image-gen": `基于${generationContext.label}进行 AI 自由绘图`,
    video: `基于${generationContext.label}生成视频`,
    "video-post": "为视频添加口播与字幕"
  };
  const additionalInstruction = String(taskItem?.text || taskItem?.taskGenerationSnapshot?.instruction || "").trim();
  const messagesBefore = taskItem ? normalizeTaskMessages(taskItem.taskMessages, taskItem) : [];
  const shortcutUserMessage = taskItem && mode === "text"
    ? normalizeTaskMessage({
        role: "user",
        text: additionalInstruction
          ? `${shortcutLabels[mode]}\n\n补充要求：${additionalInstruction}`
          : shortcutLabels[mode],
        kind: "conversation"
      })
    : null;
  const conversationMessages = shortcutUserMessage
    ? [...messagesBefore, shortcutUserMessage].slice(-MAX_TASK_MESSAGES)
    : messagesBefore;
  // 派生创作只读取用户明确选择的上下文，避免原始素材和后续话题被静默混合。
  const primaryContext = taskItem ? taskGenerationContextText(generationContext) : "";
  const sourceContext = selection.length ? selectionContextForCodex(selection) : "";
  const contextSnapshot = {
    scope: generationContext.scope,
    label: generationContext.label,
    messageIds: [...generationContext.messageIds],
    sourceIds: selection.map(item => item.id),
    primaryText: primaryContext,
    instruction: additionalInstruction,
    workflowId: String(taskItem?.taskWorkflowId || ""),
    workflowStepId: String(taskItem?.taskWorkflowStepId || ""),
    createdAt: Date.now()
  };
  let finishTask;
  const completion = new Promise(resolve => { finishTask = resolve; });

  const task = {
    id: db.makeId("board-codex"),
    itemId: taskItem?.id || "",
    taskItemId: taskItem?.id || "",
    boardId: currentBoard.id,
    boardName: currentBoard.name,
    mode,
    selectionIds: selection.map(item => item.id),
    point: taskItem ? aiResultPoint([taskItem]) : aiResultPoint(selection),
    materials: selection.map(item => ({
      type: item.type,
      text: item.text || "",
      alt: item.alt || "",
      src: ["link", "page"].includes(item.type) ? item.src || "" : "",
      source: item.source ? { ...item.source } : null
    })),
    userPrompt: additionalInstruction,
    messagesBefore,
    conversationMessages,
    userMessageId: shortcutUserMessage?.id || "",
    contextSnapshot,
    resultItemId: String(contextOptions.resultItemId || ""),
    parentSnapshots: (taskItem ? [taskItem] : selection).map(source => ({
      kind: "card",
      boardId: String(source.boardId || currentBoard.id),
      cardId: String(source.id),
      cardRevision: Math.max(1, Number(source.revision) || 1),
      relation: "generated-from"
    })),
    taskEvents: taskItem?.taskEvents || [],
    completion,
    finishTask
  };
  whiteboardCodexTasks.set(task.id, task);
  if (taskItem) preparingTaskItemIds.delete(taskItem.id);
  if (!taskItem) codexAttachedSelectionIds = [...task.selectionIds];
  if (taskItem) {
    taskItem.taskStatus = "running";
    taskItem.taskRunId = task.id;
    taskItem.taskLastMode = mode;
    taskItem.taskError = "";
    taskItem.taskMessages = conversationMessages;
    taskItem.taskGenerationScope = generationContext.scope;
    taskItem.taskGenerationMessageId = generationContext.messageId;
    taskItem.taskGenerationSnapshot = contextSnapshot;
    taskItem.text = "";
    taskItem.taskProgress = `正在理解${generationContext.label}`;
    appendTaskEvent(taskItem, { stage: "thinking", label: taskItem.taskProgress, status: "running" });
    taskItem.updatedAt = Date.now();
    const promptElement = itemElement(taskItem.id)?.querySelector(".task-prompt");
    if (promptElement) promptElement.value = "";
    updateTaskItemElement(taskItem);
    scheduleSave();
  }
  updateWhiteboardCodexStatus(task, `正在理解${generationContext.label}`);
  updateSelectionUi();
  updateCodexChatControls();
  if (!taskItem) setStatus("正在理解素材");

  try {
    const images = await Promise.all(imageItems.map(imageDataForCodex));
    task.images = images;
    updateWhiteboardCodexStatus(task, `正在理解${generationContext.label}`);
    const shortcutPrompts = {
      text: "请把指定输入作为一个整体理解。输出文字总结：先给出一句话结论，再列出关键观点、重要信息、内容之间的关系、冲突点和可执行事项。不要遗漏输入信息，也不要臆测。",
      knowledge: "请把指定输入提炼成一张结论优先、可长期复用的业务知识卡，只输出 Markdown。若输入是任务卡，以“最新回答”为主体，忽略任务标题、状态和执行回执。严格结构：# 标题（不超过16字）；紧接一个引用块 > 一句话结论（不超过60字）；## 核心要点（3到5条，每条只写一个有依据的事实或判断，不超过50字）；仅在输入确有依据时增加 ## 业务规则、## 关键指标、## 风险与待确认，每节1到3条；最后写 ## 来源，最多5条，只列可确认的卡片名、文件名或 URL。除来源 URL 外，总字数不超过 500 个中文字符。省略没有可靠信息的章节，禁止重复、空话、背景铺垫和“未识别”占位章节，不得补造事实、规则、指标或来源。若输入含文件夹，只能把目录名和文件名视为索引，不能推断文件正文，并在风险中用一句话说明边界。",
      image: `请把指定输入作为一个整体理解，并为一张重点突出、吸引人眼球的手稿信息图制定内容方案。成图采用粗粝纸张纹理与明显的手写字感，只呈现内容、结构和关系，可使用便签、手绘箭头、圈画、马克笔高亮和少量涂鸦修饰，但装饰不能压过信息。只输出合法 JSON，不要 Markdown 或代码块。格式必须是：{"title":"不超过24字","summary":"不超过120字","highlights":["3到6个按逻辑顺序排列的核心内容节点，每条不超过40字，第一条是最重要结论"],"relations":[{"from":"起点概念，不超过16字","to":"终点概念，不超过16字","label":"关系说明，不超过12字"}],"imageNotes":["按输入图片顺序给出每张图不超过24字的说明"],"theme":"ocean、violet、warm、forest 四选一"}。relations 提取 2 到 5 条最关键的因果、层级、流程或依赖关系。内容层级必须清楚，重点突出，文字精炼。禁止加入产品或品牌眉标、AI 生成说明、用户原始输入、内容摘录、白板名称、来源、时间、生成方式、页脚或水印。提炼内容关系与结论，不要臆测。`,
      "image-gen": "请把指定输入作为一个整体理解，使用 Codex 内置 image-gen 直接创作一张完整图片。允许根据内容自由构图，但视觉语言必须与模板做图一致：明亮温暖的米白或暖奶油纸面、明显但克制的纸纤维与手绘笔触、深蓝或深棕墨线、珊瑚/蓝/橙少量重点色、清晰居中的文字区块，以及便签、手绘箭头、圈画和马克笔高亮。画面要重点突出、吸引人，并准确呈现核心内容、结构和关系；中文要有自然手写感且清楚易读，装饰不能压过信息。禁止暗黑科技风、黑色或深色大底、霓虹光效、赛博朋克、玻璃拟态、金属质感、强烈渐变和阴郁低对比画面。不要照搬固定模板排版，不要加入无用眉标、来源脚注、水印或生成说明，也不要臆造事实。",
      video: "请把指定输入作为一个整体理解，提炼一条清晰叙事主线，并制作成解释型视频。只使用本次明确提供的内容作为事实依据，不要回到未选择的旧话题，也不要臆造事实。",
      "video-post": "使用输入的口播文案，为指定视频添加本地 Kokoro 配音与同步字幕。"
    };
    const prompt = additionalInstruction
      ? `${shortcutPrompts[mode]}\n\n用户补充要求：${additionalInstruction}`
      : shortcutPrompts[mode];
    const sourceVideo = mode === "video-post" ? selection.find(item => item.type === "video" && item.src) : null;
    if (mode === "video-post" && !sourceVideo) throw new Error("原视频已不存在，请重新选择视频");
    const response = await chrome.runtime.sendMessage({
      type: CODEX_RUN_REQUEST,
      id: task.id,
      runtime: aiRuntime,
      mode: mode === "video"
        ? selectedVideoEngine === "remotion" ? "remotion-video" : "hyperframes-video"
        : mode === "video-post" ? "video-post"
        : mode === "image-gen" ? "image-gen" : "analysis",
      prompt,
      page: {
        title: `${task.boardName} · 任务`,
        url: "",
        content: [
          primaryContext ? `${generationContext.label}：\n\n${primaryContext}` : "",
          sourceContext ? `${generationContext.label}：\n\n${sourceContext}` : ""
        ].filter(Boolean).join("\n\n---\n\n")
      },
      images,
      video: sourceVideo ? await videoDataForCodex(sourceVideo) : undefined,
      narration: mode === "video-post" ? additionalInstruction : undefined
    });
    console.info("[pagedock-whiteboard-ai] context frozen", {
      taskId: task.id,
      taskItemId: task.taskItemId,
      scope: contextSnapshot.scope,
      messageCount: contextSnapshot.messageIds.length,
      sourceCount: contextSnapshot.sourceIds.length
    });
    if (!response?.ok) throw new Error(response?.error || "Codex 任务启动失败");
    return completion;
  } catch (error) {
    whiteboardCodexTasks.delete(task.id);
    console.error("[pagedock-whiteboard-ai] task failed", error);
    if (taskItem) {
      taskItem.taskMessages = messagesBefore;
      taskItem.text = additionalInstruction;
      taskItem.taskStatus = "error";
      taskItem.taskError = error?.message || "AI 任务启动失败";
      taskItem.taskProgress = "";
      taskItem.taskRunId = "";
      taskItem.taskCompletedAt = Date.now();
      appendTaskEvent(taskItem, { stage: "failed", label: "任务启动失败", detail: taskItem.taskError, status: "error" });
      const promptElement = itemElement(taskItem.id)?.querySelector(".task-prompt");
      if (promptElement) promptElement.value = additionalInstruction;
      updateTaskItemElement(taskItem);
      scheduleSave();
    }
    if (!taskItem) setStatus(error?.message || "任务启动失败", true);
    finishKnowledgeCardPlaceholder(task, "error", error?.message || "知识卡生成失败，请重试");
    updateSelectionUi();
    updateCodexChatControls();
    finishTask({ status: "error", reason: error?.message || "任务启动失败" });
    return completion;
  }
}

function parseVisualSummary(answer) {
  const fallback = String(answer || "").trim();
  try {
    const start = fallback.indexOf("{");
    const end = fallback.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("没有 JSON");
    const parsed = JSON.parse(fallback.slice(start, end + 1));
    return {
      title: String(parsed.title || "内容总结").trim().slice(0, 36),
      summary: String(parsed.summary || "").trim().slice(0, 300),
      highlights: (Array.isArray(parsed.highlights) ? parsed.highlights : [])
        .map(item => String(item || "").trim().slice(0, 80))
        .filter(Boolean)
        .slice(0, 6),
      relations: (Array.isArray(parsed.relations) ? parsed.relations : [])
        .map(relation => ({
          from: String(relation?.from || "").trim().slice(0, 32),
          to: String(relation?.to || "").trim().slice(0, 32),
          label: String(relation?.label || "关联").trim().slice(0, 24)
        }))
        .filter(relation => relation.from && relation.to)
        .slice(0, 5),
      imageNotes: (Array.isArray(parsed.imageNotes) ? parsed.imageNotes : [])
        .map(item => String(item || "").trim().slice(0, 60))
        .slice(0, MAX_CODEX_IMAGES),
      theme: ["ocean", "violet", "warm", "forest"].includes(parsed.theme) ? parsed.theme : "ocean"
    };
  } catch (_) {
    return {
      title: "内容总结",
      summary: fallback.slice(0, 300) || "Codex 没有返回内容",
      highlights: [],
      relations: [],
      imageNotes: [],
      theme: "ocean"
    };
  }
}

function wrappedCanvasLines(context, value, maxWidth, maxLines) {
  const lines = [];
  for (const paragraph of String(value || "").split(/\n/)) {
    let line = "";
    for (const character of paragraph) {
      const next = line + character;
      if (line && context.measureText(next).width > maxWidth) {
        lines.push(line);
        line = character;
        if (lines.length >= maxLines) return lines;
      } else {
        line = next;
      }
    }
    if (line || !paragraph) lines.push(line);
    if (lines.length >= maxLines) return lines;
  }
  return lines;
}

function drawCanvasText(context, value, x, y, maxWidth, lineHeight, maxLines) {
  const lines = wrappedCanvasLines(context, value, maxWidth, maxLines);
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

function drawCenteredCanvasText(context, value, x, y, width, height, lineHeight, maxLines) {
  const lines = wrappedCanvasLines(context, value, width, maxLines);
  const blockHeight = Math.max(0, (lines.length - 1) * lineHeight);
  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";
  const startY = y + height / 2 - blockHeight / 2;
  lines.forEach((line, index) => {
    const seed = [...line].reduce((sum, character) => sum + character.charCodeAt(0), index * 47 + line.length * 13);
    const offsetX = (seed % 7 - 3) * .32;
    const offsetY = (seed % 5 - 2) * .28;
    const rotation = (seed % 9 - 4) * .0009;
    context.save();
    context.translate(x + width / 2 + offsetX, startY + index * lineHeight + offsetY);
    context.rotate(rotation);
    context.strokeStyle = context.fillStyle;
    context.lineWidth = .7 + seed % 3 * .12;
    context.globalAlpha = .2;
    context.strokeText(line, .6, .5);
    context.globalAlpha = 1;
    context.fillText(line, 0, 0);
    context.restore();
  });
  context.restore();
  return lines.length;
}

function paperTextureValue(index, salt = 1) {
  const raw = Math.sin((index + 1) * (12.9898 + salt * 17.731)) * 43758.5453;
  return raw - Math.floor(raw);
}

function drawPaperTexture(context, width, height, palette) {
  const wash = context.createLinearGradient(0, 0, width, height);
  wash.addColorStop(0, palette.paperRaised);
  wash.addColorStop(.38, palette.paper);
  wash.addColorStop(.72, palette.paperRaised);
  wash.addColorStop(1, palette.paper);
  context.fillStyle = wash;
  context.fillRect(0, 0, width, height);

  const stains = [
    [.17, .14, .34, "rgba(165,112,57,.075)"],
    [.82, .28, .27, "rgba(110,77,45,.055)"],
    [.34, .78, .31, "rgba(184,132,72,.052)"],
    [.88, .9, .25, "rgba(120,86,50,.06)"]
  ];
  for (const [x, y, radius, color] of stains) {
    const stain = context.createRadialGradient(width * x, height * y, 0, width * x, height * y, Math.min(width, height) * radius);
    stain.addColorStop(0, color);
    stain.addColorStop(1, "rgba(150,100,50,0)");
    context.fillStyle = stain;
    context.fillRect(0, 0, width, height);
  }

  context.strokeStyle = `${palette.ink}18`;
  context.lineWidth = 1;
  for (let lineY = 42; lineY < height; lineY += 42) {
    context.beginPath();
    context.moveTo(30, lineY + lineY % 3);
    context.quadraticCurveTo(width * .52, lineY - 1, width - 30, lineY + 1);
    context.stroke();
  }
  context.strokeStyle = "rgba(190,87,73,.12)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(62, 26);
  context.lineTo(62, height - 26);
  context.stroke();

  // paper-fiber: deterministic short fibers keep exports stable while making the sheet visibly tactile.
  context.lineCap = "round";
  for (let index = 0; index < 520; index += 1) {
    const x = paperTextureValue(index, 1) * width;
    const y = paperTextureValue(index, 2) * height;
    const length = 3 + paperTextureValue(index, 3) * 19;
    const bend = (paperTextureValue(index, 4) - .5) * 4;
    context.strokeStyle = `rgba(91,68,43,${(.018 + paperTextureValue(index, 5) * .045).toFixed(3)})`;
    context.lineWidth = .35 + paperTextureValue(index, 6) * .75;
    context.beginPath();
    context.moveTo(x, y);
    context.quadraticCurveTo(x + length * .52, y + bend, x + length, y + bend * .35);
    context.stroke();
  }
  for (let index = 0; index < 760; index += 1) {
    const x = paperTextureValue(index, 7) * width;
    const y = paperTextureValue(index, 8) * height;
    const radius = .25 + paperTextureValue(index, 9) * 1.05;
    context.fillStyle = `rgba(72,55,38,${(.018 + paperTextureValue(index, 10) * .05).toFixed(3)})`;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  const vignette = context.createRadialGradient(width / 2, height / 2, Math.min(width, height) * .18, width / 2, height / 2, Math.max(width, height) * .69);
  vignette.addColorStop(.62, "rgba(75,48,27,0)");
  vignette.addColorStop(1, "rgba(75,48,27,.14)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, width, height);
}

function drawSketchCard(context, x, y, width, height, options = {}) {
  const radius = options.radius || 18;
  context.save();
  context.translate(x + width / 2, y + height / 2);
  context.rotate(Number(options.rotate) || 0);
  context.translate(-width / 2, -height / 2);
  context.fillStyle = options.fill || "#fffaf0";
  context.beginPath();
  context.roundRect(0, 0, width, height, radius);
  context.fill();
  context.strokeStyle = options.stroke || "#243746";
  context.lineWidth = options.lineWidth || 3;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.roundRect(1.5, -1, width - 2, height + 1, radius);
  context.stroke();
  context.globalAlpha = .36;
  context.lineWidth = Math.max(1, (options.lineWidth || 3) - 1);
  context.beginPath();
  context.roundRect(-1, 1.5, width + 1, height - 2, radius + 2);
  context.stroke();
  context.restore();
}

function drawSketchArrow(context, x1, y1, x2, y2, color) {
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineCap = "round";
  context.lineWidth = 4;
  for (const offset of [-1.5, 1.5]) {
    context.globalAlpha = offset < 0 ? .95 : .4;
    context.beginPath();
    context.moveTo(x1, y1 + offset);
    context.quadraticCurveTo((x1 + x2) / 2, y1 - 5 - offset, x2, y2 + offset);
    context.stroke();
  }
  context.globalAlpha = 1;
  context.beginPath();
  context.moveTo(x2 + 2, y2);
  context.lineTo(x2 - 18, y2 - 11);
  context.lineTo(x2 - 14, y2 + 13);
  context.closePath();
  context.fill();
  context.restore();
}

function drawSketchEmphasis(context, x, y, width, height, color, variant = 0) {
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  context.lineCap = "round";
  if (variant % 3 === 0) {
    context.globalAlpha = .22;
    context.lineWidth = Math.max(12, height * .42);
    context.beginPath();
    context.moveTo(x + 8, y + height * .64);
    context.quadraticCurveTo(x + width * .5, y + height * .54, x + width - 8, y + height * .62);
    context.stroke();
  } else if (variant % 3 === 1) {
    context.globalAlpha = .85;
    context.lineWidth = 3;
    context.setLineDash([10, 7]);
    context.beginPath();
    context.ellipse(x + width / 2, y + height / 2, width / 2, height / 2, -.03, 0, Math.PI * 2);
    context.stroke();
  } else {
    context.globalAlpha = .9;
    context.lineWidth = 3;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    for (let index = 0; index < 8; index += 1) {
      const angle = Math.PI * 2 * index / 8;
      context.beginPath();
      context.moveTo(centerX + Math.cos(angle) * 14, centerY + Math.sin(angle) * 14);
      context.lineTo(centerX + Math.cos(angle) * 26, centerY + Math.sin(angle) * 26);
      context.stroke();
    }
  }
  context.restore();
}

function drawImageCover(context, image, x, y, width, height) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.naturalWidth - sourceWidth) / 2;
  const sourceY = (image.naturalHeight - sourceHeight) / 2;
  context.save();
  context.beginPath();
  context.roundRect(x, y, width, height, 22);
  context.clip();
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  context.restore();
}

async function renderVisualSummary(task, answer) {
  const plan = parseVisualSummary(answer);
  const themes = {
    ocean: { paper: "#f7f0df", paperRaised: "#fffaf0", ink: "#17324d", accent: "#2779d8", accent2: "#f0ad3d", soft: "#dbeaff", contrast: "#e86652" },
    violet: { paper: "#f5efe4", paperRaised: "#fff9f2", ink: "#33284f", accent: "#7557c5", accent2: "#efb54a", soft: "#e9ddff", contrast: "#d95d7b" },
    warm: { paper: "#f8eddf", paperRaised: "#fff8ee", ink: "#4c2e25", accent: "#d65f3c", accent2: "#e8a72f", soft: "#ffe0ce", contrast: "#247c78" },
    forest: { paper: "#f1f0df", paperRaised: "#fbfaed", ink: "#24483d", accent: "#2f8269", accent2: "#e5ad3d", soft: "#d8eadc", contrast: "#cb5b4d" }
  };
  const palette = themes[plan.theme] || themes.ocean;
  const imageCount = task.images?.length || 0;
  const imageColumns = imageCount <= 1 ? 1 : imageCount <= 4 ? 2 : 3;
  const imageRows = Math.ceil(imageCount / imageColumns);
  const imageHeight = imageRows ? 72 + imageRows * 260 + (imageRows - 1) * 24 + 28 : 0;
  const highlights = plan.highlights.length ? plan.highlights : [plan.summary || plan.title].filter(Boolean);
  const relations = plan.relations.length
    ? plan.relations
    : highlights.slice(1, 5).map((highlight, index) => ({
        from: highlights[index],
        to: highlight,
        label: "关联"
      }));
  const highlightRows = Math.ceil(Math.max(1, highlights.length) / 2);
  const highlightHeight = 72 + highlightRows * 174 + 20;
  const relationHeight = relations.length ? 72 + relations.length * 130 + 24 : 0;
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = Math.max(820, 470 + imageHeight + highlightHeight + relationHeight + 84);
  const context = canvas.getContext("2d", { alpha: false });
  const fontFamily = "'HanziPen SC', 'Xingkai SC', 'STXingkai', 'Kaiti SC', 'STKaiti', 'PingFang SC', sans-serif";
  drawPaperTexture(context, canvas.width, canvas.height, palette);
  context.strokeStyle = palette.ink;
  context.lineWidth = 3;
  context.globalAlpha = .72;
  context.strokeRect(24, 22, canvas.width - 48, canvas.height - 44);
  context.globalAlpha = .22;
  context.strokeRect(28, 18, canvas.width - 52, canvas.height - 38);
  context.globalAlpha = 1;

  const padding = 74;
  context.fillStyle = palette.ink;
  context.font = `700 64px ${fontFamily}`;
  drawCenteredCanvasText(context, plan.title, padding, 54, canvas.width - padding * 2, 138, 68, 2);
  drawSketchEmphasis(context, canvas.width * .23, 167, canvas.width * .54, 28, palette.accent, 0);
  drawSketchEmphasis(context, canvas.width - 114, 78, 34, 34, palette.contrast, 2);

  let y = 218;
  const summaryHeight = 150;
  drawSketchCard(context, padding + 30, y, canvas.width - padding * 2 - 60, summaryHeight, {
    fill: palette.soft,
    stroke: palette.ink,
    rotate: -.004,
    lineWidth: 3
  });
  drawSketchEmphasis(context, padding + 68, y + 47, canvas.width - padding * 2 - 136, 50, palette.accent2, 0);
  context.fillStyle = palette.ink;
  context.font = `500 27px ${fontFamily}`;
  drawCenteredCanvasText(context, plan.summary, padding + 70, y + 18, canvas.width - padding * 2 - 140, summaryHeight - 36, 38, 4);
  y += summaryHeight + 48;

  if (imageCount) {
    drawSketchCard(context, padding, y, 170, 48, { fill: palette.accent, stroke: palette.ink, rotate: -.012 });
    context.fillStyle = palette.paperRaised;
    context.font = `700 24px ${fontFamily}`;
    drawCenteredCanvasText(context, "视觉素材", padding, y, 170, 48, 30, 1);
    y += 72;
    const gap = 24;
    const cellWidth = (canvas.width - padding * 2 - gap * (imageColumns - 1)) / imageColumns;
    const cellHeight = 260;
    const images = await Promise.all(task.images.map(loadCanvasImage));
    images.forEach((image, index) => {
      const column = index % imageColumns;
      const row = Math.floor(index / imageColumns);
      const x = padding + column * (cellWidth + gap);
      const top = y + row * (cellHeight + gap);
      drawSketchCard(context, x, top, cellWidth, cellHeight, { fill: palette.paperRaised, stroke: palette.ink, rotate: index % 2 ? .006 : -.006 });
      if (image) drawImageCover(context, image, x + 10, top + 10, cellWidth - 20, cellHeight - 66);
      const note = plan.imageNotes[index] || task.materials.filter(item => item.type === "image")[index]?.alt || `素材 ${index + 1}`;
      context.fillStyle = palette.ink;
      context.font = `600 19px ${fontFamily}`;
      drawCenteredCanvasText(context, String(note).slice(0, 32), x + 18, top + cellHeight - 54, cellWidth - 36, 44, 24, 2);
    });
    y += imageRows * cellHeight + (imageRows - 1) * gap + 38;
  }

  drawSketchCard(context, padding, y, 170, 48, { fill: palette.accent, stroke: palette.ink, rotate: .01 });
  context.fillStyle = palette.paperRaised;
  context.font = `700 24px ${fontFamily}`;
  drawCenteredCanvasText(context, "内容结构", padding, y, 170, 48, 30, 1);
  drawSketchEmphasis(context, padding + 186, y + 8, 36, 30, palette.accent2, 2);
  y += 72;
  highlights.forEach((highlight, index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const gap = 28;
    const width = (canvas.width - padding * 2 - gap) / 2;
    const x = padding + column * (width + gap);
    const top = y + row * 174;
    const isPrimary = index === 0;
    drawSketchCard(context, x, top, width, 148, {
      fill: isPrimary ? palette.soft : palette.paperRaised,
      stroke: isPrimary ? palette.accent : palette.ink,
      rotate: (index % 2 ? 1 : -1) * .005,
      lineWidth: isPrimary ? 5 : 3
    });
    if (isPrimary) drawSketchEmphasis(context, x + 58, top + 44, width - 116, 58, palette.accent2, 0);
    context.fillStyle = isPrimary ? palette.accent : palette.ink;
    context.beginPath();
    context.arc(x + 28, top + 28, 23, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = palette.paperRaised;
    context.font = `700 18px ${fontFamily}`;
    drawCenteredCanvasText(context, String(index + 1).padStart(2, "0"), x + 5, top + 5, 46, 46, 22, 1);
    context.fillStyle = palette.ink;
    context.font = `${isPrimary ? 700 : 600} ${isPrimary ? 25 : 23}px ${fontFamily}`;
    drawCenteredCanvasText(context, highlight, x + 62, top + 20, width - 104, 108, 33, 3);
    if (isPrimary) drawSketchEmphasis(context, x + width - 56, top + 14, 30, 30, palette.contrast, 2);
  });
  y += Math.ceil(highlights.length / 2) * 174 + 24;

  if (relations.length) {
    drawSketchCard(context, padding, y, 170, 48, { fill: palette.contrast, stroke: palette.ink, rotate: -.008 });
    context.fillStyle = palette.paperRaised;
    context.font = `700 24px ${fontFamily}`;
    drawCenteredCanvasText(context, "关键关系", padding, y, 170, 48, 30, 1);
    y += 72;
    const rowWidth = canvas.width - padding * 2;
    const nodeWidth = 380;
    relations.forEach((relation, index) => {
      const top = y + index * 130;
      const leftX = padding + 12;
      const rightX = padding + rowWidth - nodeWidth - 12;
      drawSketchCard(context, leftX, top + 18, nodeWidth, 88, { fill: palette.paperRaised, stroke: palette.ink, rotate: -.006 });
      drawSketchCard(context, rightX, top + 18, nodeWidth, 88, { fill: palette.soft, stroke: palette.ink, rotate: .006 });
      context.fillStyle = palette.ink;
      context.font = `600 22px ${fontFamily}`;
      drawCenteredCanvasText(context, relation.from, leftX + 24, top + 28, nodeWidth - 48, 68, 28, 2);
      drawCenteredCanvasText(context, relation.to, rightX + 24, top + 28, nodeWidth - 48, 68, 28, 2);
      const arrowStart = leftX + nodeWidth + 24;
      const arrowEnd = rightX - 24;
      const arrowY = top + 68;
      drawSketchArrow(context, arrowStart, arrowY, arrowEnd, arrowY, palette.accent);
      const labelWidth = Math.min(190, Math.max(112, context.measureText(relation.label || "关联").width + 42));
      const labelX = (arrowStart + arrowEnd - labelWidth) / 2;
      drawSketchCard(context, labelX, top + 8, labelWidth, 42, { fill: palette.accent2, stroke: palette.ink, rotate: index % 2 ? .018 : -.018, radius: 10, lineWidth: 2 });
      context.fillStyle = palette.ink;
      context.font = `700 18px ${fontFamily}`;
      drawCenteredCanvasText(context, relation.label || "关联", labelX + 8, top + 12, labelWidth - 16, 34, 22, 1);
    });
    y += relations.length * 130 + 24;
  }

  drawSketchEmphasis(context, canvas.width - 104, y - 18, 28, 28, palette.accent2, 2);
  const outputHeight = Math.min(canvas.height, Math.max(820, Math.ceil(y + 58)));
  context.strokeStyle = palette.ink;
  context.lineWidth = 3;
  context.globalAlpha = .72;
  context.beginPath();
  context.moveTo(24, outputHeight - 22);
  context.lineTo(canvas.width - 24, outputHeight - 22);
  context.stroke();
  context.globalAlpha = 1;
  const outputCanvas = outputHeight === canvas.height ? canvas : document.createElement("canvas");
  if (outputCanvas !== canvas) {
    outputCanvas.width = canvas.width;
    outputCanvas.height = outputHeight;
    outputCanvas.getContext("2d", { alpha: false }).drawImage(canvas, 0, 0);
  }
  const blob = await canvasBlob(outputCanvas, "image/png");
  return {
    dataUrl: await readFileAsDataUrl(blob),
    title: plan.title,
    aspectRatio: outputCanvas.width / outputCanvas.height
  };
}
