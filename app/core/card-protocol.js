(function initPageDockCardProtocol(global) {
  "use strict";

  const VERSION = 1;
  const PERMISSIONS = Object.freeze({
    "network-read": { label: "访问网络", risk: "standard" },
    "page-content-read": { label: "读取页面内容", risk: "sensitive" },
    "local-file-read": { label: "读取本地文件", risk: "sensitive" },
    "local-folder-read": { label: "读取本地文件夹", risk: "sensitive" },
    "local-shell": { label: "执行本地命令", risk: "dangerous" },
    "codex-run": { label: "运行 Codex", risk: "sensitive" }
  });
  const TYPES = Object.freeze({
    text: { label: "文字", accepts: ["text/plain", "text/markdown"], outputs: ["text/plain"] },
    document: { label: "文档", accepts: ["text/plain", "text/markdown", "text/code"], outputs: ["text/markdown", "text/plain"] },
    code: { label: "代码", accepts: ["text/plain", "text/code", "application/json"], outputs: ["text/code", "text/plain"] },
    image: { label: "图片", accepts: [], outputs: ["image/*"] },
    video: { label: "视频", accepts: [], outputs: ["video/*"] },
    link: { label: "链接", accepts: [], outputs: ["text/uri-list", "text/plain"] },
    page: { label: "页面", accepts: [], outputs: ["text/uri-list", "text/plain"], permissions: ["network-read", "page-content-read"] },
    file: { label: "文件", accepts: [], outputs: ["application/x-pagedock-file", "text/plain"], permissions: ["local-file-read"] },
    folder: { label: "文件夹", accepts: [], outputs: ["application/x-pagedock-folder", "text/plain"], permissions: ["local-folder-read"] },
    task: { label: "任务", accepts: ["text/plain", "text/markdown", "text/code", "text/uri-list", "image/*", "application/x-pagedock-file", "application/x-pagedock-folder"], outputs: ["text/markdown", "text/plain", "image/*", "video/*"], permissions: ["codex-run"] },
    // 控制台可以作为输出来源，但连线不会把素材静默送入 Shell，避免数据连接变成隐式命令执行。
    terminal: { label: "控制台", accepts: [], outputs: ["text/plain", "application/x-pagedock-terminal"], permissions: ["local-shell"] }
  });

  function uniqueStrings(values) {
    return [...new Set((Array.isArray(values) ? values : []).map(String).filter(Boolean))];
  }

  function definition(type) {
    return TYPES[type] || TYPES.text;
  }

  function normalizeConnection(connection, targetId = "") {
    const sourceId = String(connection?.sourceId || connection?.from || "");
    const target = String(connection?.targetId || connection?.to || targetId || "");
    if (!sourceId || !target || sourceId === target) return null;
    return {
      id: String(connection?.id || `connection:${sourceId}:${target}`),
      sourceId,
      targetId: target,
      output: String(connection?.output || "content"),
      input: String(connection?.input || "context"),
      contentType: String(connection?.contentType || "text/plain"),
      createdAt: Number(connection?.createdAt) || Date.now()
    };
  }

  function normalizeMeta(item) {
    const type = TYPES[item?.type] ? item.type : "text";
    const requested = uniqueStrings([
      ...(definition(type).permissions || []),
      ...(item?.card?.permissions?.requested || [])
    ]).filter(permission => PERMISSIONS[permission]);
    const granted = uniqueStrings(item?.card?.permissions?.granted)
      .filter(permission => requested.includes(permission));
    const legacySources = uniqueStrings([
      ...(item?.relationSourceIds || []),
      ...(type === "task" ? item?.taskSourceIds || [] : [])
    ]);
    const connections = (Array.isArray(item?.card?.inputs) ? item.card.inputs : [])
      .map(connection => normalizeConnection(connection, item?.id))
      .filter(Boolean);
    for (const sourceId of legacySources) {
      const connection = normalizeConnection({ sourceId }, item?.id);
      if (connection && !connections.some(entry => entry.sourceId === sourceId)) connections.push(connection);
    }
    return {
      version: VERSION,
      state: String(item?.card?.state || "ready"),
      permissions: { requested, granted },
      inputs: connections,
      outputs: definition(type).outputs.map((contentType, index) => ({
        id: index ? `content-${index + 1}` : "content",
        contentType
      }))
    };
  }

  function connectionSources(item) {
    return uniqueStrings(normalizeMeta(item).inputs.map(connection => connection.sourceId));
  }

  function connect(source, target, contentType) {
    if (!source?.id || !target?.id || source.id === target.id) throw new Error("请选择两个不同的卡片");
    const sourceDefinition = definition(source.type);
    const targetDefinition = definition(target.type);
    const resolvedType = contentType || sourceDefinition.outputs.find(type => accepts(targetDefinition.accepts, type));
    if (!resolvedType) throw new Error(`${targetDefinition.label}卡片不能接收${sourceDefinition.label}卡片的内容`);
    const card = normalizeMeta(target);
    if (!card.inputs.some(connection => connection.sourceId === source.id)) {
      card.inputs.push(normalizeConnection({
        id: global.crypto?.randomUUID?.() || `connection-${Date.now()}`,
        sourceId: source.id,
        targetId: target.id,
        contentType: resolvedType
      }, target.id));
    }
    target.card = card;
    target.relationSourceIds = connectionSources(target);
    if (target.type === "task") target.taskSourceIds = target.relationSourceIds;
    const existingProvenance = target.provenance && typeof target.provenance === "object" ? target.provenance : {};
    const parents = (Array.isArray(existingProvenance.parents) ? existingProvenance.parents : [])
      .filter(parent => !(parent?.kind === "card" && String(parent.cardId) === String(source.id)));
    parents.push({
      kind: "card",
      boardId: String(source.boardId || target.boardId || ""),
      cardId: String(source.id),
      cardRevision: Math.max(1, Number(source.revision) || 1),
      relation: "input",
      url: "",
      title: "",
      capturedAt: 0
    });
    target.provenance = {
      ...existingProvenance,
      version: 1,
      operation: "connect",
      parents: parents.slice(-100),
      createdAt: Number(existingProvenance.createdAt) || Number(target.createdAt) || Date.now()
    };
    return target;
  }

  function accepts(acceptedTypes, outputType) {
    return (acceptedTypes || []).some(accepted => accepted === outputType
      || accepted === "*/*"
      || (accepted.endsWith("/*") && outputType.startsWith(accepted.slice(0, -1))));
  }

  function grant(item, permission) {
    const card = normalizeMeta(item);
    if (!card.permissions.requested.includes(permission)) throw new Error("卡片未声明该权限");
    card.permissions.granted = uniqueStrings([...card.permissions.granted, permission]);
    item.card = card;
    return item;
  }

  function revoke(item, permission) {
    const card = normalizeMeta(item);
    card.permissions.granted = card.permissions.granted.filter(value => value !== permission);
    item.card = card;
    return item;
  }

  global.PageDockCardProtocol = Object.freeze({
    VERSION,
    PERMISSIONS,
    TYPES,
    accepts,
    connect,
    connectionSources,
    definition,
    grant,
    normalizeConnection,
    normalizeMeta,
    revoke
  });
})(globalThis);
