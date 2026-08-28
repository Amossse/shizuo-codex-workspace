(function initPageDockDatabase(global) {
  "use strict";

  const DB_NAME = "pagedock";
  const DB_VERSION = 6;
  const BOARD_STORE = "boards";
  const ITEM_STORE = "items";
  const HANDLE_STORE = "localHandles";
  const REVISION_STORE = "revisions";
  const SEARCH_STORE = "searchDocs";
  const TEMPLATE_STORE = "templates";
  const PAGE_CHAT_STORE = "pageChats";
  const INBOX_ID = "inbox";
  const PAGE_CHAT_LIMIT = 200;

  let databasePromise;
  let searchIndexReady = false;

  function makeId(prefix = "item") {
    return global.crypto?.randomUUID?.()
      || `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IndexedDB 请求失败"));
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("IndexedDB 事务失败"));
      transaction.onabort = () => reject(transaction.error || new Error("IndexedDB 事务已取消"));
    });
  }

  function cursorResults(request, limit, predicate = () => true) {
    return new Promise((resolve, reject) => {
      const results = [];
      request.onerror = () => reject(request.error || new Error("IndexedDB 游标读取失败"));
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor || results.length >= limit) {
          resolve(results);
          return;
        }
        if (predicate(cursor.value)) results.push(cursor.value);
        cursor.continue();
      };
    });
  }

  function openDatabase() {
    if (databasePromise) return databasePromise;
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        const boardStore = database.objectStoreNames.contains(BOARD_STORE)
          ? request.transaction.objectStore(BOARD_STORE)
          : database.createObjectStore(BOARD_STORE, { keyPath: "id" });
        if (!boardStore.indexNames.contains("updatedAt")) {
          boardStore.createIndex("updatedAt", "updatedAt");
        }
        const itemStore = database.objectStoreNames.contains(ITEM_STORE)
          ? request.transaction.objectStore(ITEM_STORE)
          : database.createObjectStore(ITEM_STORE, { keyPath: "id" });
        if (!itemStore.indexNames.contains("boardId")) itemStore.createIndex("boardId", "boardId");
        if (!itemStore.indexNames.contains("createdAt")) itemStore.createIndex("createdAt", "createdAt");
        if (!itemStore.indexNames.contains("updatedAt")) itemStore.createIndex("updatedAt", "updatedAt");
        const handleStore = database.objectStoreNames.contains(HANDLE_STORE)
          ? request.transaction.objectStore(HANDLE_STORE)
          : database.createObjectStore(HANDLE_STORE, { keyPath: "id" });
        if (!handleStore.indexNames.contains("boardId")) handleStore.createIndex("boardId", "boardId");
        const revisionStore = database.objectStoreNames.contains(REVISION_STORE)
          ? request.transaction.objectStore(REVISION_STORE)
          : database.createObjectStore(REVISION_STORE, { keyPath: "id" });
        if (!revisionStore.indexNames.contains("boardId")) revisionStore.createIndex("boardId", "boardId");
        if (!revisionStore.indexNames.contains("boardRevision")) revisionStore.createIndex("boardRevision", ["boardId", "revision"], { unique: true });
        const searchStore = database.objectStoreNames.contains(SEARCH_STORE)
          ? request.transaction.objectStore(SEARCH_STORE)
          : database.createObjectStore(SEARCH_STORE, { keyPath: "id" });
        if (!searchStore.indexNames.contains("boardId")) searchStore.createIndex("boardId", "boardId");
        if (!searchStore.indexNames.contains("updatedAt")) searchStore.createIndex("updatedAt", "updatedAt");
        const templateStore = database.objectStoreNames.contains(TEMPLATE_STORE)
          ? request.transaction.objectStore(TEMPLATE_STORE)
          : database.createObjectStore(TEMPLATE_STORE, { keyPath: "id" });
        if (!templateStore.indexNames.contains("updatedAt")) templateStore.createIndex("updatedAt", "updatedAt");
        const pageChatStore = database.objectStoreNames.contains(PAGE_CHAT_STORE)
          ? request.transaction.objectStore(PAGE_CHAT_STORE)
          : database.createObjectStore(PAGE_CHAT_STORE, { keyPath: "id" });
        if (!pageChatStore.indexNames.contains("normalizedUrl")) pageChatStore.createIndex("normalizedUrl", "normalizedUrl", { unique: true });
        if (!pageChatStore.indexNames.contains("updatedAt")) pageChatStore.createIndex("updatedAt", "updatedAt");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("无法打开拾作数据库"));
      request.onblocked = () => reject(new Error("拾作数据库升级被其他页面阻塞"));
    });
    return databasePromise;
  }

  function boardPreview(items) {
    const first = items.find(item => item.text || item.alt || item.source?.title);
    return String(first?.text || first?.alt || first?.source?.title || "暂无内容")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 90);
  }

  function normalizePageChatUrl(rawUrl) {
    try {
      const url = new URL(String(rawUrl || ""));
      url.username = "";
      url.password = "";
      const trackingKeys = new Set(["fbclid", "gclid", "dclid", "msclkid", "mc_cid", "mc_eid"]);
      for (const key of [...url.searchParams.keys()]) {
        if (key.toLowerCase().startsWith("utm_") || trackingKeys.has(key.toLowerCase())) url.searchParams.delete(key);
      }
      url.searchParams.sort();
      if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
      // Hash routes identify SPA pages; ordinary anchors identify a position inside the same page.
      if (!/^#!?\//.test(url.hash)) url.hash = "";
      return url.href;
    } catch {
      return String(rawUrl || "").trim().slice(0, 4_000);
    }
  }

  function normalizedPageChatMessages(messages) {
    return (Array.isArray(messages) ? messages : []).slice(-30).map(message => ({
      role: ["user", "assistant", "error"].includes(message?.role) ? message.role : "assistant",
      text: String(message?.text || "").trim().slice(0, 24_000),
      quote: String(message?.quote || "").trim().slice(0, 2_000),
      imageCount: Math.min(4, Math.max(0, Number(message?.imageCount) || 0))
    })).filter(message => message.text);
  }

  async function getPageChat(rawUrl) {
    const normalizedUrl = normalizePageChatUrl(rawUrl);
    if (!normalizedUrl) return null;
    const database = await openDatabase();
    const transaction = database.transaction(PAGE_CHAT_STORE, "readonly");
    const record = await requestResult(transaction.objectStore(PAGE_CHAT_STORE).index("normalizedUrl").get(normalizedUrl));
    return record ? structuredClone(record) : null;
  }

  async function savePageChat(input = {}) {
    const normalizedUrl = normalizePageChatUrl(input.url);
    if (!normalizedUrl) throw new Error("页面会话缺少 URL");
    const database = await openDatabase();
    const transaction = database.transaction(PAGE_CHAT_STORE, "readwrite");
    const store = transaction.objectStore(PAGE_CHAT_STORE);
    const existing = await requestResult(store.index("normalizedUrl").get(normalizedUrl));
    const now = Date.now();
    const record = {
      id: existing?.id || makeId("page-chat"),
      normalizedUrl,
      url: String(input.url || normalizedUrl).slice(0, 4_000),
      title: String(input.title || existing?.title || "当前页面").trim().slice(0, 240),
      messages: normalizedPageChatMessages(input.messages),
      createdAt: Number(existing?.createdAt) || now,
      updatedAt: now
    };
    store.put(record);
    let retained = 0;
    store.index("updatedAt").openCursor(null, "prev").onsuccess = event => {
      const cursor = event.target.result;
      if (!cursor) return;
      retained += 1;
      if (retained > PAGE_CHAT_LIMIT) cursor.delete();
      cursor.continue();
    };
    await transactionDone(transaction);
    return structuredClone(record);
  }

  async function deletePageChat(rawUrl) {
    const normalizedUrl = normalizePageChatUrl(rawUrl);
    if (!normalizedUrl) return false;
    const database = await openDatabase();
    const transaction = database.transaction(PAGE_CHAT_STORE, "readwrite");
    const store = transaction.objectStore(PAGE_CHAT_STORE);
    const key = await requestResult(store.index("normalizedUrl").getKey(normalizedUrl));
    if (key !== undefined) store.delete(key);
    await transactionDone(transaction);
    return key !== undefined;
  }

  function normalizedBoard(board, items = board.items || []) {
    const now = Date.now();
    const activeItems = items.filter(item => !item.archivedAt);
    return {
      id: String(board.id || makeId("board")),
      name: String(board.name || "未命名白板").trim().slice(0, 80) || "未命名白板",
      createdAt: Number(board.createdAt) || now,
      updatedAt: Number(board.updatedAt) || now,
      revision: Math.max(0, Number(board.revision) || 0),
      itemCount: activeItems.length,
      preview: boardPreview(activeItems),
      viewport: {
        zoom: Number(board.viewport?.zoom) || 1,
        scrollLeft: Number(board.viewport?.scrollLeft) || 0,
        scrollTop: Number(board.viewport?.scrollTop) || 0,
        canvasWidth: Math.max(3200, Number(board.viewport?.canvasWidth) || 3200),
        canvasHeight: Math.max(2200, Number(board.viewport?.canvasHeight) || 2200)
      }
    };
  }

  function normalizeProvenance(item, boardId, now = Date.now()) {
    const existing = item?.provenance && typeof item.provenance === "object" ? item.provenance : {};
    const parents = Array.isArray(existing.parents)
      ? existing.parents.map(parent => ({
          kind: parent?.kind === "external" ? "external" : "card",
          boardId: String(parent?.boardId || boardId || ""),
          cardId: String(parent?.cardId || ""),
          cardRevision: Math.max(0, Number(parent?.cardRevision) || 0),
          relation: String(parent?.relation || "source").slice(0, 80),
          url: String(parent?.url || "").slice(0, 4_000),
          title: String(parent?.title || "").slice(0, 500),
          capturedAt: Math.max(0, Number(parent?.capturedAt) || 0)
        })).filter(parent => parent.kind === "external" ? parent.url : parent.cardId)
      : [];
    if (!parents.length && item?.source?.url) {
      parents.push({
        kind: "external",
        boardId: "",
        cardId: "",
        cardRevision: 0,
        relation: "capture",
        url: String(item.source.url).slice(0, 4_000),
        title: String(item.source.title || "").slice(0, 500),
        capturedAt: Math.max(0, Number(item.source.capturedAt) || now)
      });
    }
    if (!parents.some(parent => parent.kind === "card")) {
      for (const cardId of Array.isArray(item?.relationSourceIds) ? item.relationSourceIds : []) {
        parents.push({ kind: "card", boardId: String(boardId || ""), cardId: String(cardId), cardRevision: 0, relation: "input", url: "", title: "", capturedAt: 0 });
      }
    }
    return {
      version: 1,
      operation: String(existing.operation || (item?.source?.url ? "collect" : "manual")).slice(0, 80),
      actor: existing.actor ? { id: String(existing.actor.id || ""), name: String(existing.actor.name || "").slice(0, 80) } : null,
      template: existing.template ? { id: String(existing.template.id || ""), name: String(existing.template.name || "").slice(0, 80) } : null,
      parents: parents.slice(0, 100),
      createdAt: Math.max(0, Number(existing.createdAt) || Number(item?.createdAt) || now)
    };
  }

  function normalizedItem(item, boardId) {
    const now = Date.now();
    const supportedTypes = ["text", "document", "code", "image", "link", "page", "file", "folder", "video", "task", "terminal"];
    const type = supportedTypes.includes(item.type) ? item.type : "text";
    const protocolItem = { ...item, type };
    const protocol = global.PageDockCardProtocol?.normalizeMeta(protocolItem) || item.card || null;
    // 旧版本页面卡在协议引入前已经由用户主动添加并持续联网；迁移时保留这一既有授权。
    if (!item.card && type === "page" && global.PageDockCardProtocol && protocol) {
      protocolItem.card = protocol;
      global.PageDockCardProtocol.grant(protocolItem, "network-read");
    }
    return {
      ...item,
      id: String(item.id || makeId()),
      boardId,
      // 页面、视频卡片与其它白板素材一起存入 IndexedDB，保证刷新页面后仍可恢复。
      type,
      card: protocolItem.card || protocol,
      text: String(item.text || ""),
      src: String(item.src || ""),
      alt: String(item.alt || ""),
      // 页面正文由用户按域授权后临时采集；保存有限 Markdown 便于任务重试和离线回看。
      pageContent: String(item.pageContent || "").slice(0, 600_000),
      pageContentUrl: String(item.pageContentUrl || ""),
      pageContentMode: String(item.pageContentMode || "").slice(0, 80),
      pageContentCapturedAt: Math.max(0, Number(item.pageContentCapturedAt) || 0),
      x: Number(item.x) || 0,
      y: Number(item.y) || 0,
      width: Number(item.width) || 320,
      height: Number(item.height) || 120,
      z: Number(item.z) || 1,
      groupId: item.groupId ? String(item.groupId) : "",
      // 圈选任务保存来源卡片 ID 和数量，不复制图片内容，便于重新执行且避免存储膨胀。
      taskSourceIds: Array.isArray(item.taskSourceIds) ? item.taskSourceIds.map(String) : [],
      taskSourceCount: Math.max(0, Number(item.taskSourceCount) || 0),
      taskWorkflowId: String(item.taskWorkflowId || "").slice(0, 160),
      taskWorkflowStepId: String(item.taskWorkflowStepId || "").slice(0, 80),
      taskWorkflowRole: ["controller", "step"].includes(item.taskWorkflowRole) ? item.taskWorkflowRole : "",
      taskWorkflowMode: ["coding", "text", "image-gen", "video"].includes(item.taskWorkflowMode) ? item.taskWorkflowMode : "",
      // taskVideoEngine 决定视频执行容器使用 HyperFrames 还是 Remotion，默认保持现有 HyperFrames 行为。
      taskVideoEngine: item.taskVideoEngine === "remotion" ? "remotion" : "hyperframes",
      taskWorkflowTitle: String(item.taskWorkflowTitle || "").slice(0, 80),
      taskWorkflowInstruction: String(item.taskWorkflowInstruction || item.text || "").slice(0, 8_000),
      taskWorkflowRunId: String(item.taskWorkflowRunId || "").slice(0, 160),
      taskWorkflowStepIds: (Array.isArray(item.taskWorkflowStepIds) ? item.taskWorkflowStepIds : []).map(String).slice(0, 8),
      taskWorkflowLens: global.PageDockBoardDomain?.workflowLens(item.taskWorkflowLens).id || "general",
      // 定时规则跟随任务卡持久化；Chrome 后台按 nextRunAt 触发并把结果写回原卡片。
      taskSchedule: global.PageDockBoardDomain?.normalizeTaskSchedule(item.taskSchedule),
      // taskMessages 保存任务卡的多轮问答；每条只记录角色、正文与时间，最多保留最近 30 条。
      taskMessages: (Array.isArray(item.taskMessages) ? item.taskMessages : [])
        .map(message => ({
          id: String(message?.id || makeId("task-message")),
          role: message?.role === "user" ? "user" : "assistant",
          kind: ["conversation", "generation-request", "generation-result"].includes(message?.kind)
            ? message.kind
            : "conversation",
          text: String(message?.text || message?.content || "").slice(0, 40_000),
          createdAt: Number(message?.createdAt) || now
        }))
        .filter(message => message.text)
        .slice(-30),
      // taskLastMode 记录最近一次任务类型，失败后可在原卡片按原方式重试。
      taskLastMode: ["coding", "conversation", "text", "image", "image-gen", "video", "video-post"].includes(item.taskLastMode) ? item.taskLastMode : "coding",
      // 创作上下文单独记录，避免任务初始素材永久覆盖后续对话主题。
      taskGenerationScope: ["latest", "conversation", "sources", "message"].includes(item.taskGenerationScope)
        ? item.taskGenerationScope
        : "",
      taskGenerationMessageId: String(item.taskGenerationMessageId || "").slice(0, 200),
      // taskReplyMessageId 记录下一轮明确引用的历史回答；发送后即清空。
      taskReplyMessageId: String(item.taskReplyMessageId || "").slice(0, 200),
      taskGenerationSnapshot: item.taskGenerationSnapshot ? {
        scope: ["latest", "conversation", "sources", "message"].includes(item.taskGenerationSnapshot.scope)
          ? item.taskGenerationSnapshot.scope
          : "sources",
        label: String(item.taskGenerationSnapshot.label || "").slice(0, 80),
        messageIds: (Array.isArray(item.taskGenerationSnapshot.messageIds) ? item.taskGenerationSnapshot.messageIds : []).map(String).slice(-16),
        sourceIds: (Array.isArray(item.taskGenerationSnapshot.sourceIds) ? item.taskGenerationSnapshot.sourceIds : []).map(String).slice(0, 100),
        primaryText: String(item.taskGenerationSnapshot.primaryText || "").slice(-80_000),
        instruction: String(item.taskGenerationSnapshot.instruction || "").slice(0, 8_000),
        workflowId: String(item.taskGenerationSnapshot.workflowId || "").slice(0, 160),
        workflowStepId: String(item.taskGenerationSnapshot.workflowStepId || "").slice(0, 80),
        createdAt: Math.max(0, Number(item.taskGenerationSnapshot.createdAt) || 0)
      } : null,
      generationContext: item.generationContext ? {
        scope: ["latest", "conversation", "sources", "message"].includes(item.generationContext.scope)
          ? item.generationContext.scope
          : "sources",
        label: String(item.generationContext.label || "").slice(0, 80),
        messageIds: (Array.isArray(item.generationContext.messageIds) ? item.generationContext.messageIds : []).map(String).slice(-16),
        sourceIds: (Array.isArray(item.generationContext.sourceIds) ? item.generationContext.sourceIds : []).map(String).slice(0, 100),
        primaryText: String(item.generationContext.primaryText || "").slice(-80_000),
        instruction: String(item.generationContext.instruction || "").slice(0, 8_000),
        workflowId: String(item.generationContext.workflowId || "").slice(0, 160),
        workflowStepId: String(item.generationContext.workflowStepId || "").slice(0, 80),
        createdAt: Math.max(0, Number(item.generationContext.createdAt) || 0)
      } : null,
      // 运行 ID 和阶段事件用于刷新页面后重新接管仍在 Native Host 中执行的任务。
      taskRunId: String(item.taskRunId || "").slice(0, 160),
      taskProgress: String(item.taskProgress || "").slice(0, 500),
      taskStartedAt: Math.max(0, Number(item.taskStartedAt) || 0),
      taskCompletedAt: Math.max(0, Number(item.taskCompletedAt) || 0),
      taskEvents: (Array.isArray(item.taskEvents) ? item.taskEvents : [])
        .map(event => ({
          id: String(event?.id || makeId("task-event")),
          stage: String(event?.stage || "working").slice(0, 80),
          label: String(event?.label || "正在处理任务").slice(0, 300),
          detail: String(event?.detail || "").slice(0, 1_500),
          status: ["running", "success", "error", "cancelled"].includes(event?.status) ? event.status : "running",
          createdAt: Number(event?.createdAt) || now
        }))
        .filter(event => event.label)
        .slice(-60),
      // 控制台仅持久化用户命令与有限输出；执行进程始终由受信任的 Native Host 管理。
      terminalOutput: String(item.terminalOutput || "").slice(-120_000),
      terminalStatus: ["idle", "connecting", "connected", "running", "done", "closed", "error", "cancelled"].includes(item.terminalStatus) ? item.terminalStatus : "idle",
      terminalTaskId: String(item.terminalTaskId || ""),
      terminalSessionId: String(item.terminalSessionId || ""),
      terminalCwd: String(item.terminalCwd || ""),
      terminalExitCode: Number.isInteger(item.terminalExitCode) ? item.terminalExitCode : null,
      terminalHistory: (Array.isArray(item.terminalHistory) ? item.terminalHistory : [])
        .map(command => String(command || "").trim().slice(0, 8_000))
        .filter(Boolean)
        .slice(-30),
      // 本地文件句柄单独保存在 localHandles store；白板与导出文件只保留引用和可展示元数据。
      localHandleId: String(item.localHandleId || ""),
      localName: String(item.localName || "").slice(0, 500),
      localKind: ["file", "directory"].includes(item.localKind) ? item.localKind : "",
      localMime: String(item.localMime || "").slice(0, 200),
      localSize: Math.max(0, Number(item.localSize) || 0),
      localModified: Math.max(0, Number(item.localModified) || 0),
      localEntries: (Array.isArray(item.localEntries) ? item.localEntries : [])
        .map(entry => ({ name: String(entry?.name || "").slice(0, 500), kind: entry?.kind === "directory" ? "directory" : "file" }))
        .filter(entry => entry.name)
        .slice(0, 200),
      localPreview: String(item.localPreview || "").slice(0, 120_000),
      localPermissionState: ["granted", "prompt", "denied", "missing"].includes(item.localPermissionState) ? item.localPermissionState : "missing",
      documentLanguage: String(item.documentLanguage || (type === "code" ? "plaintext" : "markdown")).slice(0, 80),
      knowledgeState: ["loading", "success", "error", "cancelled"].includes(item.knowledgeState) ? item.knowledgeState : "",
      // 通用模块关系只保存来源卡片 ID；连线和自动布局均由白板根据该字段恢复。
      relationSourceIds: Array.isArray(item.relationSourceIds) ? item.relationSourceIds.map(String) : [],
      revision: Math.max(1, Number(item.revision) || 1),
      provenance: normalizeProvenance(item, boardId, now),
      createdAt: Number(item.createdAt) || now,
      updatedAt: Number(item.updatedAt) || now,
      archivedAt: Number(item.archivedAt) || 0,
      source: item.source ? {
        url: String(item.source.url || ""),
        title: String(item.source.title || ""),
        capturedAt: Number(item.source.capturedAt) || now
      } : null
    };
  }

  async function ensureInbox() {
    const database = await openDatabase();
    const readTransaction = database.transaction(BOARD_STORE, "readonly");
    const readDone = transactionDone(readTransaction);
    const existing = await requestResult(readTransaction.objectStore(BOARD_STORE).get(INBOX_ID));
    await readDone;
    if (existing) return INBOX_ID;
    const writeTransaction = database.transaction(BOARD_STORE, "readwrite");
    const writeDone = transactionDone(writeTransaction);
    const now = Date.now();
    writeTransaction.objectStore(BOARD_STORE).put({
      id: INBOX_ID,
      name: "收件箱",
      createdAt: now,
      updatedAt: now,
      itemCount: 0,
      preview: "右键或粘贴内容到这里",
      viewport: { zoom: 1, scrollLeft: 0, scrollTop: 0 }
    });
    await writeDone;
    return INBOX_ID;
  }

  async function listBoards() {
    await ensureInbox();
    const database = await openDatabase();
    const transaction = database.transaction(BOARD_STORE, "readonly");
    const done = transactionDone(transaction);
    const boards = await requestResult(transaction.objectStore(BOARD_STORE).getAll());
    await done;
    return boards.sort((left, right) => {
      if (left.id === INBOX_ID) return -1;
      if (right.id === INBOX_ID) return 1;
      return right.updatedAt - left.updatedAt;
    });
  }

  async function getBoard(boardId, options = {}) {
    const database = await openDatabase();
    const boardTransaction = database.transaction(BOARD_STORE, "readonly");
    const boardDone = transactionDone(boardTransaction);
    const board = await requestResult(boardTransaction.objectStore(BOARD_STORE).get(boardId));
    await boardDone;
    if (!board) return null;
    const itemTransaction = database.transaction(ITEM_STORE, "readonly");
    const itemDone = transactionDone(itemTransaction);
    const items = await requestResult(itemTransaction.objectStore(ITEM_STORE).index("boardId").getAll(boardId));
    await itemDone;
    const visibleItems = options.includeArchived
      ? items
      : items.filter(item => !item.archivedAt);
    visibleItems.sort((left, right) => left.z - right.z || left.createdAt - right.createdAt);
    return { ...board, items: visibleItems };
  }

  async function createBoard(name = "新白板") {
    const board = normalizedBoard({ id: makeId("board"), name }, []);
    return commitBoardSnapshot({ ...board, items: [] }, { force: true, reason: "创建白板" });
  }

  function comparableBoard(board) {
    if (!board) return null;
    const copy = { ...board };
    delete copy.updatedAt;
    delete copy.revision;
    delete copy.itemCount;
    delete copy.preview;
    copy.items = (copy.items || []).map(item => {
      const next = { ...item };
      delete next.revision;
      return next;
    });
    return copy;
  }

  async function commitBoardSnapshot(board, options = {}) {
    if (!board?.id) throw new Error("白板缺少 id");
    const domain = global.PageDockBoardDomain;
    if (!domain) throw new Error("白板领域模块未加载");
    const database = await openDatabase();
    const transaction = database.transaction([BOARD_STORE, ITEM_STORE, REVISION_STORE, SEARCH_STORE], "readwrite");
    const done = transactionDone(transaction);
    const boardStore = transaction.objectStore(BOARD_STORE);
    const itemStore = transaction.objectStore(ITEM_STORE);
    const revisionStore = transaction.objectStore(REVISION_STORE);
    const searchStore = transaction.objectStore(SEARCH_STORE);
    const [storedBoard, storedItems, storedRevisions] = await Promise.all([
      requestResult(boardStore.get(String(board.id))),
      requestResult(itemStore.index("boardId").getAll(String(board.id))),
      requestResult(revisionStore.index("boardId").getAll(String(board.id)))
    ]);
    const current = storedBoard ? { ...storedBoard, items: storedItems } : null;
    let sourceItems = Array.isArray(board.items) ? board.items : [];
    if (options.preserveArchived && current) {
      const incomingIds = new Set(sourceItems.map(item => String(item.id)));
      sourceItems = sourceItems.concat(current.items.filter(item => item.archivedAt && !incomingIds.has(String(item.id))));
    }
    const requested = { ...board, items: sourceItems };
    let resolved = requested;
    if (current && options.baseBoard && !options.force) {
      const merged = domain.mergeBoard(options.baseBoard, current, requested);
      if (merged.conflicts.length) {
        await done;
        const error = new Error("白板已被其他协作者更新，请重新打开后合并修改");
        error.code = "BOARD_CONFLICT";
        error.conflicts = merged.conflicts;
        throw error;
      }
      resolved = merged.board;
    }
    const now = Date.now();
    const previousById = new Map((current?.items || []).map(item => [String(item.id), item]));
    const items = (resolved.items || []).map((item, index) => {
      const normalized = normalizedItem({ ...item, z: Number(item.z) || index + 1 }, board.id);
      const previous = previousById.get(String(normalized.id));
      const changed = !previous || JSON.stringify({ ...normalized, revision: previous.revision }) !== JSON.stringify(previous);
      normalized.revision = previous ? Math.max(1, Number(previous.revision) || 1) + (changed ? 1 : 0) : 1;
      return normalized;
    });
    const nextRevision = current ? Math.max(0, Number(current.revision) || 0) + 1 : Math.max(1, Number(board.revision) || 1);
    const metadata = normalizedBoard({ ...resolved, updatedAt: now, revision: nextRevision }, items);
    const after = { ...metadata, items };
    if (current && JSON.stringify(comparableBoard(current)) === JSON.stringify(comparableBoard(after))) {
      await done;
      return current;
    }
    const revision = domain.createRevision(current || { id: board.id, items: [] }, after, {
      revision: nextRevision,
      actor: options.actor || { id: "owner", name: "白板用户" },
      reason: options.reason || "更新白板",
      createdAt: now
    });
    const nextIds = new Set(items.map(item => String(item.id)));
    for (const previous of current?.items || []) {
      if (!nextIds.has(String(previous.id))) {
        itemStore.delete(previous.id);
        searchStore.delete(previous.id);
      }
    }
    for (const item of items) {
      itemStore.put(item);
      searchStore.put(domain.toSearchDocument(metadata, item));
    }
    boardStore.put(metadata);
    revisionStore.put(revision);
    const retained = [...storedRevisions, revision].sort((left, right) => Number(left.revision) - Number(right.revision));
    for (const entry of retained.slice(0, Math.max(0, retained.length - 100))) revisionStore.delete(entry.id);
    await done;
    console.info("[pagedock-db] board mutation committed", {
      boardId: metadata.id,
      revision: metadata.revision,
      changedCards: revision.itemChanges.length,
      reason: revision.reason
    });
    return after;
  }

  async function deleteBoard(boardId) {
    if (boardId === INBOX_ID) throw new Error("收件箱不能删除");
    const database = await openDatabase();
    const readTransaction = database.transaction([ITEM_STORE, HANDLE_STORE, REVISION_STORE, SEARCH_STORE], "readonly");
    const readDone = transactionDone(readTransaction);
    const [keys, handleKeys, revisionKeys, searchKeys] = await Promise.all([
      requestResult(readTransaction.objectStore(ITEM_STORE).index("boardId").getAllKeys(boardId)),
      requestResult(readTransaction.objectStore(HANDLE_STORE).index("boardId").getAllKeys(boardId)),
      requestResult(readTransaction.objectStore(REVISION_STORE).index("boardId").getAllKeys(boardId)),
      requestResult(readTransaction.objectStore(SEARCH_STORE).index("boardId").getAllKeys(boardId))
    ]);
    await readDone;
    const transaction = database.transaction([BOARD_STORE, ITEM_STORE, HANDLE_STORE, REVISION_STORE, SEARCH_STORE], "readwrite");
    const done = transactionDone(transaction);
    const itemStore = transaction.objectStore(ITEM_STORE);
    keys.forEach(key => itemStore.delete(key));
    const handleStore = transaction.objectStore(HANDLE_STORE);
    handleKeys.forEach(key => handleStore.delete(key));
    const revisionStore = transaction.objectStore(REVISION_STORE);
    revisionKeys.forEach(key => revisionStore.delete(key));
    const searchStore = transaction.objectStore(SEARCH_STORE);
    searchKeys.forEach(key => searchStore.delete(key));
    transaction.objectStore(BOARD_STORE).delete(boardId);
    await done;
  }

  async function addItem(boardId, item) {
    if (boardId === INBOX_ID) await ensureInbox();
    const board = await getBoard(boardId, { includeArchived: true });
    if (!board) throw new Error("目标白板不存在");
    const baseBoard = global.structuredClone ? structuredClone(board) : JSON.parse(JSON.stringify(board));
    const count = board.items.filter(item => !item.archivedAt).length;
    const next = normalizedItem({
      x: 72 + (count % 5) * 38,
      y: 72 + (count % 7) * 38,
      z: count + 1,
      ...item
    }, boardId);
    board.items.push(next);
    const saved = await commitBoardSnapshot({ ...board, id: boardId }, { baseBoard, reason: "添加卡片" });
    return saved.items.find(item => item.id === next.id) || next;
  }

  async function listBoardItems(boardId, options = {}) {
    const database = await openDatabase();
    const transaction = database.transaction(ITEM_STORE, "readonly");
    const done = transactionDone(transaction);
    const items = await requestResult(
      transaction.objectStore(ITEM_STORE).index("boardId").getAll(boardId)
    );
    await done;
    const archived = Boolean(options.archived);
    const limit = options.limit === undefined
      ? items.length
      : Math.max(0, Number(options.limit) || 0);
    return items
      .filter(item => Boolean(item.archivedAt) === archived)
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, limit);
  }

  // Inbox 批量操作通过完整白板快照保存，确保卡片和白板计数始终一致。
  async function setItemsArchived(itemIds, archived) {
    const ids = new Set(itemIds.map(String));
    if (!ids.size) return 0;
    const inbox = await getBoard(INBOX_ID, { includeArchived: true });
    if (!inbox) throw new Error("收件箱不存在");
    const baseBoard = global.structuredClone ? global.structuredClone(inbox) : JSON.parse(JSON.stringify(inbox));
    const now = Date.now();
    let changed = 0;
    inbox.items = inbox.items.map(item => {
      if (!ids.has(item.id) || Boolean(item.archivedAt) === Boolean(archived)) return item;
      changed += 1;
      return { ...item, archivedAt: archived ? now : 0, updatedAt: now };
    });
    if (changed) await commitBoardSnapshot(inbox, { baseBoard, reason: archived ? "归档卡片" : "恢复卡片" });
    console.info("[pagedock-db] inbox archive state updated", { changed, archived });
    return changed;
  }

  async function deleteItems(boardId, itemIds) {
    const ids = new Set(itemIds.map(String));
    if (!ids.size) return 0;
    const board = await getBoard(boardId, { includeArchived: true });
    if (!board) throw new Error("白板不存在");
    const baseBoard = global.structuredClone ? global.structuredClone(board) : JSON.parse(JSON.stringify(board));
    const before = board.items.length;
    board.items = board.items.filter(item => !ids.has(item.id));
    const changed = before - board.items.length;
    if (changed) await commitBoardSnapshot(board, { baseBoard, reason: "删除卡片" });
    console.info("[pagedock-db] items deleted", { boardId, changed });
    return changed;
  }

  async function moveItems(itemIds, targetBoardId) {
    if (targetBoardId === INBOX_ID) return 0;
    const ids = new Set(itemIds.map(String));
    if (!ids.size) return 0;
    const [inbox, target] = await Promise.all([
      getBoard(INBOX_ID, { includeArchived: true }),
      getBoard(targetBoardId, { includeArchived: true })
    ]);
    if (!inbox) throw new Error("收件箱不存在");
    if (!target) throw new Error("目标白板不存在");
    const inboxBase = global.structuredClone ? global.structuredClone(inbox) : JSON.parse(JSON.stringify(inbox));
    const targetBase = global.structuredClone ? global.structuredClone(target) : JSON.parse(JSON.stringify(target));
    const moving = inbox.items.filter(item => ids.has(item.id));
    if (!moving.length) return 0;
    const now = Date.now();
    const activeTargetCount = target.items.filter(item => !item.archivedAt).length;
    target.items.push(...moving.map((item, index) => ({
      ...item,
      boardId: targetBoardId,
      archivedAt: 0,
      x: 72 + ((activeTargetCount + index) % 5) * 38,
      y: 72 + ((activeTargetCount + index) % 7) * 38,
      z: target.items.length + index + 1,
      updatedAt: now
    })));
    inbox.items = inbox.items.filter(item => !ids.has(item.id));
    // 先写目标白板；若第二步失败，卡片仍已安全落到目标白板，不会从两边同时丢失。
    await commitBoardSnapshot(target, { baseBoard: targetBase, reason: "从收件箱移入卡片" });
    await commitBoardSnapshot(inbox, { baseBoard: inboxBase, reason: "移出收件箱卡片" });
    console.info("[pagedock-db] inbox items moved", {
      targetBoardId,
      changed: moving.length
    });
    return moving.length;
  }

  async function recentItems(limit = 20) {
    const database = await openDatabase();
    const transaction = database.transaction(ITEM_STORE, "readonly");
    const done = transactionDone(transaction);
    const items = await cursorResults(
      transaction.objectStore(ITEM_STORE).index("createdAt").openCursor(null, "prev"),
      Math.max(0, limit),
      item => !item.archivedAt
    );
    await done;
    return items;
  }

  async function saveLocalHandle(boardId, handle, kind = handle?.kind) {
    if (!handle || !["file", "directory"].includes(kind)) throw new Error("本地文件授权无效");
    const database = await openDatabase();
    const transaction = database.transaction(HANDLE_STORE, "readwrite");
    const done = transactionDone(transaction);
    const record = {
      id: makeId("handle"),
      boardId: String(boardId || ""),
      kind,
      name: String(handle.name || ""),
      handle,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    transaction.objectStore(HANDLE_STORE).put(record);
    await done;
    console.info("[pagedock-db] local handle saved", { id: record.id, boardId: record.boardId, kind });
    return record;
  }

  async function getLocalHandle(id) {
    if (!id) return null;
    const database = await openDatabase();
    const transaction = database.transaction(HANDLE_STORE, "readonly");
    const done = transactionDone(transaction);
    const record = await requestResult(transaction.objectStore(HANDLE_STORE).get(String(id)));
    await done;
    return record || null;
  }

  async function replaceLocalHandle(id, boardId, handle, kind = handle?.kind) {
    if (!id) return saveLocalHandle(boardId, handle, kind);
    const database = await openDatabase();
    const transaction = database.transaction(HANDLE_STORE, "readwrite");
    const done = transactionDone(transaction);
    const store = transaction.objectStore(HANDLE_STORE);
    const existing = await requestResult(store.get(String(id)));
    const record = {
      ...(existing || {}),
      id: String(id),
      boardId: String(boardId || existing?.boardId || ""),
      kind,
      name: String(handle?.name || ""),
      handle,
      createdAt: Number(existing?.createdAt) || Date.now(),
      updatedAt: Date.now()
    };
    store.put(record);
    await done;
    return record;
  }

  async function rebuildSearchIndex() {
    const domain = global.PageDockBoardDomain;
    const database = await openDatabase();
    const readTransaction = database.transaction([BOARD_STORE, ITEM_STORE], "readonly");
    const readDone = transactionDone(readTransaction);
    const [boards, items] = await Promise.all([
      requestResult(readTransaction.objectStore(BOARD_STORE).getAll()),
      requestResult(readTransaction.objectStore(ITEM_STORE).getAll())
    ]);
    await readDone;
    const boardById = new Map(boards.map(board => [String(board.id), board]));
    const writeTransaction = database.transaction(SEARCH_STORE, "readwrite");
    const writeDone = transactionDone(writeTransaction);
    const store = writeTransaction.objectStore(SEARCH_STORE);
    store.clear();
    for (const item of items) store.put(domain.toSearchDocument(boardById.get(String(item.boardId)), item));
    await writeDone;
    searchIndexReady = true;
    console.info("[pagedock-db] search index rebuilt", { boardCount: boards.length, cardCount: items.length });
    return items.length;
  }

  async function searchBoards(query, options = {}) {
    if (!String(query || "").trim()) return [];
    if (!searchIndexReady) await rebuildSearchIndex();
    const database = await openDatabase();
    const transaction = database.transaction(SEARCH_STORE, "readonly");
    const done = transactionDone(transaction);
    const documents = await requestResult(transaction.objectStore(SEARCH_STORE).getAll());
    await done;
    return global.PageDockBoardDomain.searchDocuments(documents, query, options);
  }

  async function listBoardRevisions(boardId, options = {}) {
    const database = await openDatabase();
    const transaction = database.transaction(REVISION_STORE, "readonly");
    const done = transactionDone(transaction);
    const revisions = await requestResult(transaction.objectStore(REVISION_STORE).index("boardId").getAll(String(boardId)));
    await done;
    const limit = Math.min(100, Math.max(1, Number(options.limit) || 50));
    return revisions
      .sort((left, right) => Number(right.revision) - Number(left.revision))
      .slice(0, limit)
      .map(revision => ({
        id: revision.id,
        boardId: revision.boardId,
        revision: revision.revision,
        actor: revision.actor,
        reason: revision.reason,
        createdAt: revision.createdAt,
        changedCardIds: (revision.itemChanges || []).map(change => String(change.cardId)),
        changedCardCount: (revision.itemChanges || []).length
      }));
  }

  async function restoreBoardRevision(boardId, targetRevision, options = {}) {
    const current = await getBoard(String(boardId), { includeArchived: true });
    if (!current) throw new Error("白板不存在");
    const target = Math.max(0, Number(targetRevision) || 0);
    if (target >= Number(current.revision)) return current;
    const database = await openDatabase();
    const transaction = database.transaction(REVISION_STORE, "readonly");
    const done = transactionDone(transaction);
    const revisions = await requestResult(transaction.objectStore(REVISION_STORE).index("boardId").getAll(String(boardId)));
    await done;
    const applicable = revisions
      .filter(revision => Number(revision.revision) > target && Number(revision.revision) <= Number(current.revision))
      .sort((left, right) => Number(right.revision) - Number(left.revision));
    if (!applicable.length || Number(applicable.at(-1).revision) !== target + 1) {
      throw new Error("目标版本已超出本地保留范围");
    }
    let restored = current;
    for (const revision of applicable) restored = global.PageDockBoardDomain.applyRevision(restored, revision, "backward");
    return commitBoardSnapshot(restored, {
      baseBoard: current,
      actor: options.actor || { id: "owner", name: "白板用户" },
      reason: `恢复到版本 ${target}`
    });
  }

  async function saveTemplateFromBoard(boardId, options = {}) {
    const board = await getBoard(String(boardId), { includeArchived: false });
    if (!board) throw new Error("白板不存在");
    const template = global.PageDockBoardDomain.createTemplate(board, options);
    const database = await openDatabase();
    const transaction = database.transaction(TEMPLATE_STORE, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(TEMPLATE_STORE).put({ ...template, updatedAt: Date.now() });
    await done;
    console.info("[pagedock-db] workflow template saved", { templateId: template.id, cardCount: template.cards.length });
    return template;
  }

  async function listTemplates() {
    const database = await openDatabase();
    const transaction = database.transaction(TEMPLATE_STORE, "readonly");
    const done = transactionDone(transaction);
    const templates = await requestResult(transaction.objectStore(TEMPLATE_STORE).getAll());
    await done;
    return templates.sort((left, right) => Number(right.updatedAt || right.createdAt) - Number(left.updatedAt || left.createdAt));
  }

  async function createBoardFromTemplate(templateId, options = {}) {
    const database = await openDatabase();
    const transaction = database.transaction(TEMPLATE_STORE, "readonly");
    const done = transactionDone(transaction);
    const template = await requestResult(transaction.objectStore(TEMPLATE_STORE).get(String(templateId)));
    await done;
    if (!template) throw new Error("工作流模板不存在");
    const board = global.PageDockBoardDomain.instantiateTemplate(template, {
      ...options,
      makeId,
      now: Date.now()
    });
    return commitBoardSnapshot(board, { reason: `从模板“${template.name}”创建` });
  }

  async function deleteTemplate(templateId) {
    const database = await openDatabase();
    const transaction = database.transaction(TEMPLATE_STORE, "readwrite");
    const done = transactionDone(transaction);
    transaction.objectStore(TEMPLATE_STORE).delete(String(templateId));
    await done;
  }

  async function exportAll() {
    const boards = await listBoards();
    const fullBoards = [];
    for (const board of boards) {
      fullBoards.push(await getBoard(board.id, { includeArchived: true }));
    }
    return {
      kind: "pagedock-backup",
      version: 2,
      exportedAt: Date.now(),
      boards: fullBoards
    };
  }

  function importedCard(item) {
    const card = global.PageDockCardProtocol?.normalizeMeta(item) || item.card || null;
    if (!card) return null;
    return {
      ...card,
      permissions: {
        ...(card.permissions || {}),
        // 拾作备份文件是内容，不是授权载体。
        granted: []
      }
    };
  }

  async function importData(payload) {
    if (!payload || !["pagedock-board", "pagedock-backup"].includes(payload.kind)) {
      throw new Error("不是有效的拾作备份文件");
    }
    if (payload.kind === "pagedock-board") {
      const source = payload.board;
      if (!source) throw new Error("拾作备份文件缺少白板数据");
      const id = makeId("board");
      const idMap = new Map((source.items || []).map(item => [String(item.id), makeId()]));
      const items = (source.items || []).map(item => {
        const card = importedCard(item);
        return {
          ...item,
          id: idMap.get(String(item.id)),
          boardId: id,
          localHandleId: "",
          localPermissionState: ["file", "folder"].includes(item.type) ? "missing" : item.localPermissionState,
          terminalSessionId: "",
          terminalStatus: item.type === "terminal" ? "closed" : item.terminalStatus,
          taskRunId: "",
          taskProgress: "",
          taskStatus: item.type === "task" && item.taskStatus === "running" ? "error" : item.taskStatus,
          taskError: item.type === "task" && item.taskStatus === "running" ? "导入后需要重新执行此任务" : item.taskError,
          taskSourceIds: (item.taskSourceIds || []).map(sourceId => idMap.get(String(sourceId)) || String(sourceId)),
          relationSourceIds: (item.relationSourceIds || []).map(sourceId => idMap.get(String(sourceId)) || String(sourceId)),
          card: card ? {
            ...card,
            inputs: (card.inputs || []).map(connection => ({
              ...connection,
              id: makeId("connection"),
              sourceId: idMap.get(String(connection.sourceId)) || String(connection.sourceId),
              targetId: idMap.get(String(connection.targetId)) || idMap.get(String(item.id))
            }))
          } : undefined
        };
      });
      const imported = await commitBoardSnapshot({
        ...source,
        id,
        name: `${source.name || "导入白板"}（导入）`,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        items
      }, { reason: `导入白板“${source.name || "未命名白板"}”` });
      return [imported];
    }

    const imported = [];
    for (const source of payload.boards || []) {
      if (!source?.id) continue;
      imported.push(await commitBoardSnapshot({
        ...source,
        items: (source.items || []).map(item => ({
          ...item,
          localHandleId: "",
          localPermissionState: ["file", "folder"].includes(item.type) ? "missing" : item.localPermissionState,
          terminalSessionId: "",
          terminalStatus: item.type === "terminal" ? "closed" : item.terminalStatus,
          taskRunId: "",
          taskProgress: "",
          taskStatus: item.type === "task" && item.taskStatus === "running" ? "error" : item.taskStatus,
          taskError: item.type === "task" && item.taskStatus === "running" ? "导入后需要重新执行此任务" : item.taskError,
          card: importedCard(item) || undefined
        }))
      }, {
        // 全量备份沿用原白板 id；显式覆盖保留既有“恢复备份”语义，不让普通调用意外继承强制写入。
        force: true,
        reason: `恢复备份白板“${source.name || "未命名白板"}”`
      }));
    }
    await ensureInbox();
    return imported;
  }

  global.PageDockDB = Object.freeze({
    INBOX_ID,
    makeId,
    ensureInbox,
    listBoards,
    getBoard,
    createBoard,
    deleteBoard,
    addItem,
    listBoardItems,
    setItemsArchived,
    deleteItems,
    moveItems,
    recentItems,
    saveLocalHandle,
    getLocalHandle,
    replaceLocalHandle,
    commitBoardSnapshot,
    searchBoards,
    listBoardRevisions,
    restoreBoardRevision,
    saveTemplateFromBoard,
    listTemplates,
    createBoardFromTemplate,
    deleteTemplate,
    normalizePageChatUrl,
    getPageChat,
    savePageChat,
    deletePageChat,
    exportAll,
    importData
  });
})(globalThis);
