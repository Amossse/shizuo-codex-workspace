(function initPageDockBoardDomain(global) {
  "use strict";

  const clone = value => global.structuredClone
    ? global.structuredClone(value)
    : JSON.parse(JSON.stringify(value));
  const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const ITEM_IGNORED_FIELDS = new Set(["updatedAt", "revision"]);

  function changedFields(base = {}, next = {}, ignored = new Set()) {
    const fields = new Set([...Object.keys(base), ...Object.keys(next)]);
    return [...fields].filter(field => !ignored.has(field) && !equal(base[field], next[field]));
  }

  function mergeRecord(base, current, next, ignored = new Set()) {
    const merged = clone(current || {});
    const conflicts = [];
    for (const field of changedFields(base, next, ignored)) {
      const currentChanged = !equal(current?.[field], base?.[field]);
      if (currentChanged && !equal(current?.[field], next?.[field])) conflicts.push(field);
      else if (next[field] === undefined) delete merged[field];
      else merged[field] = clone(next[field]);
    }
    return { merged, conflicts };
  }

  function mergeBoard(baseBoard, currentBoard, nextBoard) {
    const base = clone(baseBoard || { items: [] });
    const current = clone(currentBoard || { items: [] });
    const next = clone(nextBoard || { items: [] });
    const boardMerge = mergeRecord(base, current, next, new Set(["items", "updatedAt", "revision", "itemCount", "preview"]));
    const conflicts = boardMerge.conflicts.map(field => ({ scope: "board", fields: [field] }));
    const baseItems = new Map((base.items || []).map(item => [String(item.id), item]));
    const currentItems = new Map((current.items || []).map(item => [String(item.id), item]));
    const nextItems = new Map((next.items || []).map(item => [String(item.id), item]));
    const mergedItems = new Map([...currentItems].map(([id, item]) => [id, clone(item)]));

    for (const [id, baseItem] of baseItems) {
      const currentItem = currentItems.get(id);
      const nextItem = nextItems.get(id);
      if (!nextItem) {
        if (currentItem && !equal(currentItem, baseItem)) conflicts.push({ scope: "card", cardId: id, fields: ["deleted"] });
        else mergedItems.delete(id);
        continue;
      }
      if (!currentItem) {
        conflicts.push({ scope: "card", cardId: id, fields: ["deleted"] });
        continue;
      }
      const itemMerge = mergeRecord(baseItem, currentItem, nextItem, ITEM_IGNORED_FIELDS);
      if (itemMerge.conflicts.length) conflicts.push({ scope: "card", cardId: id, fields: itemMerge.conflicts });
      else {
        itemMerge.merged.updatedAt = Math.max(Number(currentItem.updatedAt) || 0, Number(nextItem.updatedAt) || 0);
        mergedItems.set(id, itemMerge.merged);
      }
    }
    for (const [id, nextItem] of nextItems) {
      if (baseItems.has(id)) continue;
      if (currentItems.has(id) && !equal(currentItems.get(id), nextItem)) conflicts.push({ scope: "card", cardId: id, fields: ["created"] });
      else mergedItems.set(id, clone(nextItem));
    }

    boardMerge.merged.items = [...mergedItems.values()];
    return { board: boardMerge.merged, conflicts };
  }

  function createRevision(beforeBoard, afterBoard, metadata = {}) {
    const before = clone(beforeBoard || { items: [] });
    const after = clone(afterBoard || { items: [] });
    const beforeItems = new Map((before.items || []).map(item => [String(item.id), item]));
    const afterItems = new Map((after.items || []).map(item => [String(item.id), item]));
    const itemChanges = [];
    for (const id of new Set([...beforeItems.keys(), ...afterItems.keys()])) {
      const previous = beforeItems.get(id) || null;
      const next = afterItems.get(id) || null;
      if (!equal(previous, next)) {
        const beforeItem = clone(previous);
        const afterItem = clone(next);
        const sharedEmbeddedSrc = previous?.src === next?.src && String(previous?.src || "").startsWith("data:")
          ? previous.src
          : "";
        if (sharedEmbeddedSrc) {
          delete beforeItem.src;
          delete afterItem.src;
        }
        itemChanges.push({ cardId: id, before: beforeItem, after: afterItem, sharedEmbeddedSrc });
      }
    }
    const boardFields = changedFields(before, after, new Set(["items", "updatedAt", "revision", "itemCount", "preview"]));
    const boardBefore = {};
    const boardAfter = {};
    for (const field of boardFields) {
      boardBefore[field] = clone(before[field]);
      boardAfter[field] = clone(after[field]);
    }
    return {
      id: String(metadata.id || global.crypto?.randomUUID?.() || `revision-${Date.now()}-${Math.random().toString(36).slice(2)}`),
      boardId: String(after.id || before.id || ""),
      revision: Math.max(1, Number(metadata.revision) || Number(after.revision) || 1),
      actor: clone(metadata.actor || { id: "owner", name: "白板用户" }),
      reason: String(metadata.reason || "更新白板").slice(0, 200),
      createdAt: Number(metadata.createdAt) || Date.now(),
      boardBefore,
      boardAfter,
      itemChanges
    };
  }

  function applyRevision(board, revision, direction = "backward") {
    const result = clone(board || { items: [] });
    const useBefore = direction !== "forward";
    const boardPatch = useBefore ? revision.boardBefore : revision.boardAfter;
    for (const [field, value] of Object.entries(boardPatch || {})) {
      if (value === undefined) delete result[field];
      else result[field] = clone(value);
    }
    const items = new Map((result.items || []).map(item => [String(item.id), item]));
    for (const change of revision.itemChanges || []) {
      const value = clone(useBefore ? change.before : change.after);
      if (value && change.sharedEmbeddedSrc && !value.src) value.src = change.sharedEmbeddedSrc;
      if (value) items.set(String(change.cardId), clone(value));
      else items.delete(String(change.cardId));
    }
    result.items = [...items.values()];
    return result;
  }

  function searchableText(item) {
    const messageText = (Array.isArray(item?.taskMessages) ? item.taskMessages : [])
      .map(message => message?.text || "")
      .join("\n");
    return [
      item?.text,
      item?.alt,
      item?.taskResult,
      messageText,
      item?.localName,
      item?.localPreview,
      String(item?.pageContent || "").slice(0, 40_000),
      item?.source?.title,
      item?.source?.url,
      String(item?.src || "").startsWith("data:") ? "" : item?.src
    ].filter(Boolean).join("\n").replace(/\s+/g, " ").trim().slice(0, 80_000);
  }

  function toSearchDocument(board, item) {
    const label = String(item?.text || item?.alt || item?.localName || item?.source?.title || item?.type || "卡片")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 160);
    return {
      id: String(item?.id || ""),
      boardId: String(item?.boardId || board?.id || ""),
      boardName: String(board?.name || ""),
      type: String(item?.type || "text"),
      label,
      searchText: searchableText(item),
      sourceTitle: String(item?.source?.title || "").slice(0, 500),
      sourceUrl: String(item?.source?.url || "").slice(0, 4_000),
      updatedAt: Number(item?.updatedAt) || 0,
      archivedAt: Number(item?.archivedAt) || 0
    };
  }

  function searchDocuments(documents, query, options = {}) {
    const tokens = String(query || "").toLocaleLowerCase().split(/\s+/).filter(Boolean).slice(0, 12);
    if (!tokens.length) return [];
    const limit = Math.min(200, Math.max(1, Number(options.limit) || 50));
    const boardId = String(options.boardId || "");
    return (Array.isArray(documents) ? documents : [])
      .filter(document => !document.archivedAt && (!boardId || document.boardId === boardId))
      .map(document => {
        const haystack = `${document.boardName || ""} ${document.label || ""} ${document.searchText || ""}`.toLocaleLowerCase();
        if (!tokens.every(token => haystack.includes(token))) return null;
        const score = tokens.reduce((total, token) => total
          + (String(document.label || "").toLocaleLowerCase().includes(token) ? 4 : 0)
          + (String(document.boardName || "").toLocaleLowerCase().includes(token) ? 2 : 0)
          + 1, 0);
        const first = Math.max(0, Math.min(...tokens.map(token => haystack.indexOf(token)).filter(index => index >= 0)) - 60);
        return { ...clone(document), score, snippet: String(document.searchText || "").slice(first, first + 220) };
      })
      .filter(Boolean)
      .sort((left, right) => right.score - left.score || right.updatedAt - left.updatedAt)
      .slice(0, limit);
  }

  function sanitizeTemplateCard(item, includedIds) {
    const card = clone(item);
    card.localHandleId = "";
    card.localPermissionState = ["file", "folder"].includes(card.type) ? "missing" : card.localPermissionState;
    card.taskRunId = "";
    card.taskWorkflowRunId = "";
    card.taskProgress = "";
    card.taskResult = "";
    card.taskError = "";
    card.taskStatus = card.type === "task" ? "idle" : card.taskStatus;
    card.taskStartedAt = 0;
    card.taskCompletedAt = 0;
    card.taskEvents = [];
    card.taskMessages = [];
    card.taskGenerationSnapshot = null;
    card.generationContext = null;
    card.taskSchedule = null;
    card.terminalOutput = "";
    card.terminalHistory = [];
    card.terminalSessionId = "";
    card.terminalTaskId = "";
    card.terminalStatus = card.type === "terminal" ? "closed" : card.terminalStatus;
    card.relationSourceIds = (card.relationSourceIds || []).map(String).filter(id => includedIds.has(id));
    card.taskSourceIds = (card.taskSourceIds || []).map(String).filter(id => includedIds.has(id));
    if (card.card) {
      card.card.permissions = { ...(card.card.permissions || {}), granted: [] };
      card.card.inputs = (card.card.inputs || []).filter(input => includedIds.has(String(input.sourceId)));
    }
    return card;
  }

  function createTemplate(board, options = {}) {
    const selected = Array.isArray(options.cardIds) && options.cardIds.length
      ? new Set(options.cardIds.map(String))
      : new Set((board?.items || []).map(item => String(item.id)));
    const cards = (board?.items || [])
      .filter(item => selected.has(String(item.id)))
      .map(item => sanitizeTemplateCard(item, selected));
    return {
      kind: "pagedock-template",
      version: 1,
      id: String(options.id || global.crypto?.randomUUID?.() || `template-${Date.now()}-${Math.random().toString(36).slice(2)}`),
      name: String(options.name || board?.name || "未命名工作流").trim().slice(0, 80) || "未命名工作流",
      description: String(options.description || "").trim().slice(0, 500),
      createdAt: Number(options.createdAt) || Date.now(),
      sourceBoardId: String(board?.id || ""),
      viewport: clone(board?.viewport || {}),
      cards
    };
  }

  function instantiateTemplate(template, options = {}) {
    if (!template || template.kind !== "pagedock-template" || Number(template.version) !== 1) {
      throw new Error("不是有效的拾作工作流模板");
    }
    const makeId = options.makeId || (prefix => global.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const now = Number(options.now) || Date.now();
    const boardId = String(options.boardId || makeId("board"));
    const idMap = new Map((template.cards || []).map(card => [String(card.id), String(makeId("card"))]));
    const items = (template.cards || []).map(source => {
      const item = clone(source);
      const originalId = String(source.id);
      item.id = idMap.get(originalId);
      item.boardId = boardId;
      item.relationSourceIds = (item.relationSourceIds || []).map(id => idMap.get(String(id))).filter(Boolean);
      item.taskSourceIds = (item.taskSourceIds || []).map(id => idMap.get(String(id))).filter(Boolean);
      if (item.card) {
        item.card.inputs = (item.card.inputs || []).map(input => ({
          ...input,
          id: String(makeId("connection")),
          sourceId: idMap.get(String(input.sourceId)),
          targetId: idMap.get(String(input.targetId)) || item.id,
          createdAt: now
        })).filter(input => input.sourceId && input.targetId);
      }
      item.createdAt = now;
      item.updatedAt = now;
      item.revision = 1;
      item.provenance = {
        version: 1,
        operation: "template-instantiate",
        template: { id: String(template.id), name: String(template.name || "") },
        parents: [],
        createdAt: now
      };
      return item;
    });
    return {
      id: boardId,
      name: String(options.name || `${template.name || "工作流"}（副本）`).slice(0, 80),
      createdAt: now,
      updatedAt: now,
      revision: 0,
      viewport: clone(template.viewport || {}),
      items
    };
  }

  function planWorkflow(items = []) {
    const tasks = (items || []).filter(item => item?.type === "task" && item.id);
    const order = new Map(tasks.map((task, index) => [String(task.id), index]));
    const taskIds = new Set(order.keys());
    const dependencies = new Map(tasks.map(task => {
      const ids = [...(task.taskSourceIds || []), ...(task.relationSourceIds || [])]
        .map(String)
        .filter(id => taskIds.has(id) && id !== String(task.id));
      return [String(task.id), new Set(ids)];
    }));
    const remaining = new Set(taskIds);
    const completed = new Set();
    const waves = [];
    while (remaining.size) {
      const wave = [...remaining]
        .filter(id => [...dependencies.get(id)].every(dependency => completed.has(dependency)))
        .sort((left, right) => order.get(left) - order.get(right));
      if (!wave.length) break;
      waves.push(wave);
      wave.forEach(id => {
        remaining.delete(id);
        completed.add(id);
      });
    }
    return { waves, cycles: [...remaining].sort((left, right) => order.get(left) - order.get(right)) };
  }

  function partitionWorkflowWave(ids = [], resolveMode = () => "coding") {
    const parallel = [];
    const serial = [];
    for (const id of ids) {
      const mode = resolveMode(id);
      // ponytail: media jobs share scarce local runtimes; split lanes only if measured throughput requires it.
      if (mode === "image-gen" || mode === "video") serial.push(id);
      else parallel.push(id);
    }
    return { parallel, serial };
  }

  function normalizeWorkflowPlan(input = {}) {
    const rawSteps = Array.isArray(input.steps) ? input.steps : [];
    if (!rawSteps.length) throw new Error("动态工作流至少需要一个步骤");
    if (rawSteps.length > 8) throw new Error("动态工作流最多支持 8 个步骤");
    const used = new Set();
    const rawIds = new Set();
    const idMap = new Map();
    const steps = rawSteps.map((raw, index) => {
      const rawId = String(raw?.id || `step-${index + 1}`);
      if (rawIds.has(rawId)) throw new Error(`动态工作流步骤 ID 重复：${rawId}`);
      rawIds.add(rawId);
      const id = rawId.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 60) || `step-${index + 1}`;
      if (used.has(id)) throw new Error(`动态工作流步骤 ID 冲突：${rawId}`);
      used.add(id);
      idMap.set(rawId, id);
      if (raw?.mode && !["coding", "text", "image-gen", "video"].includes(raw.mode)) {
        throw new Error(`动态工作流步骤 ${rawId} 使用了不支持的执行方式：${raw.mode}`);
      }
      const mode = raw?.mode || "coding";
      const title = String(raw?.title || raw?.instruction || `步骤 ${index + 1}`).trim().slice(0, 80);
      const instruction = String(raw?.instruction || raw?.title || "").trim().slice(0, 8_000);
      if (!instruction) throw new Error(`动态工作流步骤 ${index + 1} 缺少执行内容`);
      return { id, title, instruction, mode, dependsOn: [] };
    });
    const ids = new Set(steps.map(step => step.id));
    steps.forEach((step, index) => {
      const requested = [...new Set((Array.isArray(rawSteps[index]?.dependsOn) ? rawSteps[index].dependsOn : [])
        .map(id => idMap.get(String(id)) || String(id)))];
      if (requested.length > 6) throw new Error(`动态工作流步骤 ${step.title} 最多支持 6 个依赖`);
      const unknown = requested.filter(id => !ids.has(id));
      if (unknown.length) throw new Error(`动态工作流步骤 ${step.title} 引用了不存在的依赖：${unknown.join("、")}`);
      if (requested.includes(step.id)) throw new Error(`动态工作流步骤 ${step.title} 不能依赖自身`);
      step.dependsOn = requested;
    });
    const graph = planWorkflow(steps.map(step => ({
      id: step.id,
      type: "task",
      relationSourceIds: step.dependsOn
    })));
    if (graph.cycles.length) throw new Error(`动态工作流存在循环依赖：${graph.cycles.join("、")}`);
    return {
      title: String(input.title || "动态工作流").trim().slice(0, 80) || "动态工作流",
      steps,
      waves: graph.waves
    };
  }

  function normalizeTaskSchedule(input) {
    if (!input || typeof input !== "object") return null;
    return {
      enabled: Boolean(input.enabled),
      execution: input.execution === "workflow" ? "workflow" : "task",
      repeat: ["once", "daily", "weekly"].includes(input.repeat) ? input.repeat : "once",
      nextRunAt: Math.max(0, Number(input.nextRunAt) || 0),
      retryAt: Math.max(0, Number(input.retryAt) || 0),
      lastRunAt: Math.max(0, Number(input.lastRunAt) || 0),
      lastStatus: ["success", "error"].includes(input.lastStatus) ? input.lastStatus : "",
      lastError: String(input.lastError || "").slice(0, 2_000)
    };
  }

  function workflowLens(input) {
    const id = ["efficiency", "skill", "perspective", "strategy"].includes(input) ? input : "general";
    return ({
      general: { id, label: "通用", guidance: "围绕目标选择最短可验证路径，最终产出可以直接使用的结果。" },
      efficiency: { id, label: "工作提效", guidance: "识别重复劳动、等待和交接，优先自动化与复用，并用节省时间或减少步骤验证结果。" },
      skill: { id, label: "技能提升", guidance: "先诊断能力缺口，再安排方法讲解、刻意练习、反馈纠错和可复用方法沉淀。" },
      perspective: { id, label: "视野拓展", guidance: "扩大来源与观点差异，核对事实冲突、趋势变化和跨领域类比，最后说明机会与风险。" },
      strategy: { id, label: "格局提升", guidance: "连接长期目标、利益相关方、约束和备选方案，分析二阶影响与取舍，形成可验证的决策记录。" }
    })[id];
  }

  function workflowPlanningPrompt(goal, lensInput) {
    const lens = workflowLens(lensInput);
    return [
      "你是拾作动态工作流编排器。把用户目标拆成可执行 DAG，只输出合法 JSON，不要 Markdown 或解释。",
      "格式：{\"title\":\"工作流名称\",\"steps\":[{\"id\":\"英文短标识\",\"title\":\"容器标题\",\"instruction\":\"可独立执行的完整指令\",\"mode\":\"coding|text|image-gen|video\",\"dependsOn\":[\"上游 id\"]}]}。",
      "最多 8 步；查询、检索、分析和调用工具用 coding；纯文字整理用 text；直接绘图用 image-gen；生成视频用 video。依赖必须准确，不得循环。",
      `成长视角：${lens.label}。${lens.guidance}`,
      `用户目标：${String(goal || "").trim()}`
    ].join("\n\n");
  }

  function advanceTaskSchedule(input, now = Date.now()) {
    const schedule = normalizeTaskSchedule(input);
    if (!schedule) return null;
    if (schedule.repeat === "once") return { ...schedule, enabled: false, nextRunAt: 0, retryAt: 0 };
    const next = new Date(schedule.nextRunAt || now);
    do {
      next.setDate(next.getDate() + (schedule.repeat === "weekly" ? 7 : 1));
    } while (next.getTime() <= now);
    return { ...schedule, enabled: true, nextRunAt: next.getTime(), retryAt: 0 };
  }

  function beginTaskScheduleRun(input, now = Date.now()) {
    const schedule = normalizeTaskSchedule(input);
    if (!schedule) return null;
    if (!schedule.retryAt) return advanceTaskSchedule(schedule, now);
    if (schedule.repeat === "once") return { ...schedule, enabled: false, nextRunAt: 0, retryAt: 0 };
    return { ...schedule, enabled: true, retryAt: 0 };
  }

  global.PageDockBoardDomain = Object.freeze({
    applyRevision,
    advanceTaskSchedule,
    beginTaskScheduleRun,
    createTemplate,
    createRevision,
    instantiateTemplate,
    mergeBoard,
    normalizeWorkflowPlan,
    normalizeTaskSchedule,
    workflowLens,
    workflowPlanningPrompt,
    planWorkflow,
    partitionWorkflowWave,
    searchDocuments,
    toSearchDocument
  });
})(globalThis);
