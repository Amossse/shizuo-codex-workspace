function pageShell(title, body, script, nonce) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="referrer" content="no-referrer">
  <title>${title}</title>
  <style>
    :root { color-scheme: light; --paper:#fffaf2; --paper-2:#f7ecde; --ink:#30231d; --muted:#78685f; --line:#dbc8b5; --accent:#b62f1b; --accent-soft:#f8dcd3; --success:#19713a; --shadow:0 18px 48px #53382b20; font-family:Inter,"PingFang SC","Microsoft YaHei",sans-serif; }
    * { box-sizing:border-box; }
    body { margin:0; min-height:100vh; background:var(--paper); color:var(--ink); }
    button,input,textarea,select { font:inherit; }
    button { min-height:40px; padding:0 14px; border:1px solid var(--line); border-radius:10px; background:#fffaf5; color:var(--ink); cursor:pointer; }
    button:hover { border-color:#bda38d; }
    button.primary { border-color:var(--accent); background:var(--accent); color:white; }
    button:disabled { cursor:not-allowed; opacity:.5; }
    .landing { width:min(520px,calc(100% - 32px)); margin:12vh auto 0; padding:32px; border:1px solid var(--line); border-radius:22px; background:#fffdf9; box-shadow:var(--shadow); }
    .brand { display:flex; align-items:center; gap:14px; }
    .mark { width:48px; height:48px; display:grid; place-items:center; border-radius:14px; background:var(--accent); color:white; font-size:24px; font-weight:800; }
    h1 { margin:0; font-size:25px; }
    .landing p { margin:18px 0 24px; color:var(--muted); line-height:1.7; }
    .landing form { display:flex; justify-content:flex-end; }
    header { height:68px; display:flex; align-items:center; gap:14px; padding:0 18px; border-bottom:1px solid var(--line); background:#fffaf5e8; backdrop-filter:blur(14px); position:relative; z-index:5; }
    header .mark { width:38px; height:38px; border-radius:11px; font-size:18px; }
    .heading { min-width:0; flex:1; }
    .heading strong,.heading span { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .heading span { margin-top:2px; color:var(--muted); font-size:12px; }
    .status { display:flex; align-items:center; gap:7px; color:var(--muted); font-size:12px; }
    .status::before { content:""; width:8px; height:8px; border-radius:50%; background:#d19b23; }
    .status[data-state="ready"]::before { background:var(--success); }
    .status[data-state="error"]::before { background:var(--accent); }
    .tools { display:flex; align-items:center; gap:8px; }
    .tools button { min-height:36px; padding:0 11px; }
    #viewport { position:absolute; inset:68px 0 0; overflow:auto; cursor:grab; background-color:#f8f0e5; background-image:radial-gradient(#cdbba9 1px,transparent 1px); background-size:24px 24px; }
    #viewport[data-panning="true"] { cursor:grabbing; }
    #stage { position:relative; min-width:100%; min-height:100%; }
    #canvas { position:absolute; left:0; top:0; transform-origin:0 0; }
    #links { position:absolute; inset:0; overflow:visible; pointer-events:none; }
    #links path { fill:none; stroke:#c97661; stroke-width:2; marker-end:url(#arrow); }
    #cards { position:absolute; inset:0; }
    .card { position:absolute; min-width:160px; min-height:100px; overflow:hidden; border:1px solid var(--line); border-radius:14px; background:#fffdf9; box-shadow:0 7px 20px #5b3c2c18; cursor:grab; user-select:none; }
    .card:active { cursor:grabbing; }
    .card[data-selected="true"] { border-color:var(--accent); box-shadow:0 0 0 3px #b62f1b20,0 10px 24px #5b3c2c22; }
    .card-head { height:34px; display:flex; align-items:center; gap:7px; padding:0 11px; border-bottom:1px solid #eadccd; background:var(--paper-2); color:var(--muted); font-size:11px; }
    .card-type { flex:1; font-weight:700; }
    .card-body { height:calc(100% - 34px); padding:13px; overflow:auto; color:var(--ink); font-size:14px; line-height:1.55; white-space:pre-wrap; user-select:text; }
    .card-body pre { margin:0; white-space:pre-wrap; font:12px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace; }
    .card-body img { display:block; width:100%; max-height:100%; object-fit:contain; border-radius:8px; }
    .card-body video { display:block; width:100%; max-height:100%; border-radius:8px; background:#1f1713; }
    .card-body a { color:var(--accent); word-break:break-all; }
    .task-status { margin-bottom:10px; color:var(--muted); font-size:12px; }
    .task-message { margin:0 0 9px; padding:9px 10px; border-radius:9px; background:#f7ecde; white-space:pre-wrap; }
    .task-message[data-role="assistant"] { background:#fff8ef; border:1px solid #eadccd; }
    .task-result { margin-top:10px; padding-top:10px; border-top:1px solid var(--line); }
    .resize { position:absolute; right:2px; bottom:2px; width:18px; height:18px; min-height:0; padding:0; border:0; background:linear-gradient(135deg,transparent 48%,#a98c78 50%,#a98c78 58%,transparent 60%); cursor:nwse-resize; }
    .empty { position:absolute; inset:0; display:grid; place-items:center; color:var(--muted); }
    .toast { position:fixed; left:50%; bottom:22px; z-index:20; max-width:min(560px,calc(100% - 32px)); transform:translateX(-50%); padding:11px 15px; border:1px solid var(--line); border-radius:11px; background:#fffaf5; box-shadow:var(--shadow); color:var(--muted); font-size:13px; }
    .toast[data-state="error"] { border-color:#de9a8d; color:var(--accent); }
    .connect-tip { position:fixed; left:18px; top:82px; z-index:8; padding:10px 13px; border:1px solid #d9a78e; border-radius:10px; background:#fff5ed; color:var(--accent); font-size:13px; }
    dialog { width:min(520px,calc(100% - 32px)); padding:0; border:1px solid var(--line); border-radius:18px; background:#fffaf5; color:var(--ink); box-shadow:var(--shadow); }
    dialog::backdrop { background:#3e2b2040; backdrop-filter:blur(3px); }
    .dialog { display:grid; gap:13px; padding:22px; }
    .dialog h2 { margin:0; font-size:19px; }
    .dialog label { display:grid; gap:6px; color:var(--muted); font-size:12px; }
    .dialog input,.dialog textarea,.dialog select { width:100%; padding:10px 11px; border:1px solid var(--line); border-radius:9px; outline:0; background:white; color:var(--ink); }
    .dialog textarea { min-height:150px; resize:vertical; line-height:1.55; }
    .dialog-actions { display:flex; justify-content:flex-end; gap:8px; }
    body[data-ended="true"] #viewport,body[data-ended="true"] .tools button:not(#name) { pointer-events:none; opacity:.55; }
    @media (max-width:720px) { header { height:auto; min-height:68px; flex-wrap:wrap; padding:10px 12px; } #viewport { top:116px; } .status { order:3; width:100%; } .tools { gap:5px; } .tools button { padding:0 8px; } }
  </style>
</head>
<body>${body}<script nonce="${nonce}">${script}</script></body>
</html>`;
}

export function collaborationLandingPage(code, nonce) {
  return pageShell("加入拾作协作", `<main class="landing">
    <div class="brand"><span class="mark">拾</span><div><h1>加入白板协作</h1></div></div>
    <p>你将通过同一可信内网进入一块拾作白板，可直接协作编辑；不会获得其他白板、终端或本地文件权限。</p>
    <form method="post" action="/v1/collaborate/${String(code || "")}/claim"><button class="primary" type="submit">进入协作白板</button></form>
  </main>`, "", nonce);
}

export function collaborationBoardPage({ boardId, nonce }) {
  const safeBoardId = JSON.stringify(String(boardId || ""));
  const body = `<header>
    <span class="mark">拾</span>
    <div class="heading"><strong id="boardName">正在打开白板…</strong><span>浏览器协作 · 可直接编辑</span></div>
    <div class="status" id="status">正在连接</div>
    <div class="tools">
      <button id="name" type="button">协作者</button>
      <button id="add" type="button">＋ 卡片</button>
      <button id="connect" type="button">连接</button>
      <button id="zoomOut" type="button" aria-label="缩小">－</button>
      <button id="fit" type="button">适应</button>
      <button id="zoomIn" type="button" aria-label="放大">＋</button>
    </div>
  </header>
  <main id="viewport"><div id="stage"><div id="canvas"><svg id="links"><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#c97661"></path></marker></defs></svg><div id="cards"></div></div></div></main>
  <div class="connect-tip" id="connectTip" hidden>先选择来源卡片，再选择目标卡片</div>
  <div class="toast" id="toast" hidden></div>
  <dialog id="editDialog"><form class="dialog" id="editForm" method="dialog"><h2>编辑卡片</h2><label>内容<textarea id="editText"></textarea></label><label id="editSrcRow">链接地址<input id="editSrc" type="url"></label><div class="dialog-actions"><button id="cancelEdit" type="button">取消</button><button class="primary" type="submit">保存修改</button></div></form></dialog>
  <dialog id="createDialog"><form class="dialog" id="createForm" method="dialog"><h2>新建卡片</h2><label>类型<select id="createType"><option value="text">文字</option><option value="document">文档</option><option value="code">代码</option><option value="task">任务</option><option value="link">链接</option><option value="image">图片</option><option value="page">页面</option></select></label><label>内容<textarea id="createText"></textarea></label><label id="createSrcRow" hidden>链接地址<input id="createSrc" type="url"></label><div class="dialog-actions"><button id="cancelCreate" type="button">取消</button><button class="primary" type="submit">创建卡片</button></div></form></dialog>`;
  const script = String.raw`
    const BOARD_ID = ${safeBoardId};
    const byId = id => document.getElementById(id);
    const viewport = byId("viewport");
    const stage = byId("stage");
    const canvas = byId("canvas");
    const cards = byId("cards");
    const links = byId("links");
    const statusEl = byId("status");
    const toast = byId("toast");
    const state = { board:null, zoom:1, interacting:false, selected:"", connectSource:"", ended:false, editingId:"", cursor:0, viewReady:false };
    let guestName = localStorage.getItem("shizuo-collaborator-name") || "协作者";
    byId("name").textContent = guestName;

    function setStatus(text, kind) { statusEl.textContent = text; statusEl.dataset.state = kind || ""; }
    function notify(text, kind) { toast.textContent = text; toast.dataset.state = kind || ""; toast.hidden = false; clearTimeout(notify.timer); notify.timer = setTimeout(() => { toast.hidden = true; }, 3200); }
    function safeUrl(value) { try { const url = new URL(String(value || "")); return ["http:","https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; } }
    function itemById(id) { return state.board?.items?.find(item => String(item.id) === String(id)); }
    function labelFor(type) { return ({ text:"文字", document:"文档", code:"代码", image:"图片", link:"链接", page:"页面", task:"任务" })[type] || "卡片"; }

    async function rpc(method, params) {
      const response = await fetch("/v1/collaboration/rpc", {
        method:"POST",
        headers:{ "content-type":"application/json", "x-shizuo-collaboration":"1", "x-shizuo-client-name":encodeURIComponent(guestName) },
        body:JSON.stringify({ method, params:{ boardId:BOARD_ID, ...(params || {}) } })
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401 || response.status === 410) {
        state.ended = true;
        document.body.dataset.ended = "true";
        setStatus("共享已结束", "error");
      }
      if (!response.ok || !payload.ok) throw new Error(payload.error || "协作请求失败");
      return payload.result;
    }

    function boardBounds() {
      const items = state.board?.items || [];
      const padding = 180;
      const minX = items.length ? Math.min(...items.map(item => Number(item.x || 0))) : 0;
      const minY = items.length ? Math.min(...items.map(item => Number(item.y || 0))) : 0;
      const maxX = items.length ? Math.max(...items.map(item => Number(item.x || 0) + Number(item.width || 320))) : 800;
      const maxY = items.length ? Math.max(...items.map(item => Number(item.y || 0) + Number(item.height || 160))) : 600;
      return {
        minX:Math.max(0, minX - padding), minY:Math.max(0, minY - padding),
        maxX:maxX + padding, maxY:maxY + padding,
        width:Math.max(viewport.clientWidth / state.zoom, Number(state.board?.viewport?.canvasWidth) || 0, maxX + padding),
        height:Math.max(viewport.clientHeight / state.zoom, Number(state.board?.viewport?.canvasHeight) || 0, maxY + padding)
      };
    }

    function applyZoom() {
      const bounds = boardBounds();
      canvas.style.width = bounds.width + "px";
      canvas.style.height = bounds.height + "px";
      canvas.style.transform = "scale(" + state.zoom + ")";
      stage.style.width = Math.max(viewport.clientWidth, bounds.width * state.zoom) + "px";
      stage.style.height = Math.max(viewport.clientHeight, bounds.height * state.zoom) + "px";
      links.setAttribute("width", bounds.width);
      links.setAttribute("height", bounds.height);
    }

    function assetUrl(item) {
      return item.embeddedContentOmitted ? "/v1/collaboration/assets/" + encodeURIComponent(item.id) + "?v=" + encodeURIComponent(item.updatedAt || 0) : safeUrl(item.src);
    }

    function cardContent(item, body) {
      if (item.type === "image" && assetUrl(item)) {
        const image = document.createElement("img");
        image.src = assetUrl(item);
        image.alt = item.alt || item.text || "图片";
        image.loading = "lazy";
        image.referrerPolicy = "no-referrer";
        body.appendChild(image);
        return;
      }
      if (item.type === "video" && assetUrl(item)) {
        const video = document.createElement("video");
        video.src = assetUrl(item);
        video.controls = true;
        video.preload = "metadata";
        body.appendChild(video);
        return;
      }
      if (item.type === "task") {
        const status = document.createElement("div");
        status.className = "task-status";
        status.textContent = ({ idle:"待处理", queued:"排队中", running:"执行中", success:"已完成", completed:"已完成", error:"失败", cancelled:"已停止" })[item.taskStatus] || "任务";
        body.appendChild(status);
        const messages = item.taskMessages || [];
        for (const message of messages) {
          const bubble = document.createElement("div");
          bubble.className = "task-message";
          bubble.dataset.role = message.role;
          bubble.textContent = message.text || "";
          body.appendChild(bubble);
        }
        if (!messages.length && item.text) body.append(item.text);
        if (item.taskResult) {
          const result = document.createElement("div");
          result.className = "task-result";
          result.textContent = item.taskResult;
          body.appendChild(result);
        }
        return;
      }
      if (["link","page"].includes(item.type) && safeUrl(item.src)) {
        const text = document.createElement("div");
        text.textContent = item.text || item.alt || "链接";
        const anchor = document.createElement("a");
        anchor.href = safeUrl(item.src);
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
        anchor.textContent = item.src;
        body.append(text, document.createElement("br"), anchor);
        return;
      }
      if (item.type === "code") {
        const pre = document.createElement("pre");
        pre.textContent = item.text || "";
        body.appendChild(pre);
        return;
      }
      body.textContent = item.text || item.pageContent || item.alt || (item.type === "task" ? "待处理任务" : "空卡片");
    }

    function renderLinks() {
      links.querySelectorAll("path[data-link]").forEach(path => path.remove());
      const items = state.board?.items || [];
      const map = new Map(items.map(item => [String(item.id), item]));
      for (const target of items) for (const sourceId of target.relationSourceIds || []) {
        const source = map.get(String(sourceId));
        if (!source) continue;
        const x1 = Number(source.x || 0) + Number(source.width || 320);
        const y1 = Number(source.y || 0) + Number(source.height || 160) / 2;
        const x2 = Number(target.x || 0);
        const y2 = Number(target.y || 0) + Number(target.height || 160) / 2;
        const bend = Math.max(60, Math.abs(x2 - x1) / 2);
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.dataset.link = "true";
        path.setAttribute("d", "M " + x1 + " " + y1 + " C " + (x1 + bend) + " " + y1 + ", " + (x2 - bend) + " " + y2 + ", " + x2 + " " + y2);
        path.setAttribute("marker-end", "url(#arrow)");
        links.appendChild(path);
      }
    }

    function render() {
      byId("boardName").textContent = state.board?.name || "共享白板";
      cards.replaceChildren();
      const items = state.board?.items || [];
      for (const item of items) {
        const card = document.createElement("article");
        card.className = "card";
        card.dataset.id = item.id;
        card.dataset.selected = String(state.selected === String(item.id) || state.connectSource === String(item.id));
        card.style.left = Number(item.x || 0) + "px";
        card.style.top = Number(item.y || 0) + "px";
        card.style.width = Math.max(160, Number(item.width || 320)) + "px";
        card.style.height = Math.max(100, Number(item.height || 160)) + "px";
        const head = document.createElement("div");
        head.className = "card-head";
        const type = document.createElement("span");
        type.className = "card-type";
        type.textContent = item.taskWorkflowRole === "controller"
          ? "动态工作流 · " + (({ efficiency:"工作提效", skill:"技能提升", perspective:"视野拓展", strategy:"格局提升" })[item.taskWorkflowLens] || "通用") + " · " + (item.taskWorkflowTitle || "执行中")
          : item.taskWorkflowRole === "step"
            ? "执行容器 · " + (({ coding:"Codex", text:"文字", "image-gen":"图片", video:"视频" })[item.taskWorkflowMode] || "任务") + " · " + (item.taskWorkflowTitle || "未命名步骤")
            : labelFor(item.type);
        if (item.taskSchedule?.enabled) type.textContent += " · 已定时";
        const hint = document.createElement("span");
        hint.textContent = "双击编辑";
        head.append(type, hint);
        const body = document.createElement("div");
        body.className = "card-body";
        cardContent(item, body);
        const resize = document.createElement("button");
        resize.type = "button";
        resize.className = "resize";
        resize.setAttribute("aria-label", "调整卡片大小");
        card.append(head, body, resize);
        card.addEventListener("pointerdown", event => beginCardPointer(event, item, card));
        card.addEventListener("dblclick", event => { if (!event.target.closest("a")) openEditor(item); });
        cards.appendChild(card);
      }
      if (!items.length) { const empty = document.createElement("div"); empty.className = "empty"; empty.textContent = "白板还是空的，可以新建第一张卡片"; cards.appendChild(empty); }
      applyZoom();
      renderLinks();
    }

    async function refresh(force) {
      if (state.ended || state.interacting) return;
      try {
        const firstPage = await rpc("boards.get", { offset:0, limit:100 });
        const fingerprint = String(firstPage.revision) + ":" + String(firstPage.updatedAt) + ":" + String(firstPage.itemCount || firstPage.items?.length || 0);
        if (force || fingerprint !== state.fingerprint) {
          const board = { ...firstPage, items:[...(firstPage.items || [])] };
          let offset = firstPage.nextOffset;
          while (offset !== null && offset !== undefined && board.items.length < 500) {
            const page = await rpc("boards.get", { offset, limit:100 });
            board.items.push(...(page.items || []));
            offset = page.nextOffset;
          }
          state.board = board;
          state.fingerprint = fingerprint;
          render();
        }
        setStatus("实时协作中", "ready");
      } catch (error) {
        if (!state.ended) setStatus(error.message, "error");
      }
    }

    async function mutate(method, params, message) {
      state.interacting = true;
      setStatus("正在同步…", "");
      try {
        await rpc(method, params);
        notify(message || "修改已保存");
        state.interacting = false;
        await refresh(true);
      } catch (error) {
        state.interacting = false;
        notify(error.message, "error");
        await refresh(true);
      }
    }

    function beginCardPointer(event, item, card) {
      if (event.button !== 0 || event.target.closest("a")) return;
      if (state.connectMode) { event.preventDefault(); chooseConnection(item); return; }
      const resizing = Boolean(event.target.closest(".resize"));
      event.preventDefault();
      state.selected = String(item.id);
      card.dataset.selected = "true";
      state.interacting = true;
      const startX = event.clientX;
      const startY = event.clientY;
      const original = { x:Number(item.x || 0), y:Number(item.y || 0), width:Number(item.width || 320), height:Number(item.height || 160) };
      card.setPointerCapture(event.pointerId);
      const move = moveEvent => {
        const dx = (moveEvent.clientX - startX) / state.zoom;
        const dy = (moveEvent.clientY - startY) / state.zoom;
        if (resizing) {
          card.style.width = Math.max(160, original.width + dx) + "px";
          card.style.height = Math.max(100, original.height + dy) + "px";
        } else {
          card.style.left = Math.max(0, original.x + dx) + "px";
          card.style.top = Math.max(0, original.y + dy) + "px";
        }
      };
      const end = endEvent => {
        card.removeEventListener("pointermove", move);
        card.removeEventListener("pointerup", end);
        card.removeEventListener("pointercancel", end);
        state.interacting = false;
        const patch = resizing
          ? { width:parseFloat(card.style.width), height:parseFloat(card.style.height) }
          : { x:parseFloat(card.style.left), y:parseFloat(card.style.top) };
        const changed = Object.keys(patch).some(key => Math.abs(Number(patch[key]) - Number(original[key])) > 1);
        if (changed) void mutate("cards.update", { cardId:item.id, expectedUpdatedAt:item.updatedAt, patch }, resizing ? "卡片尺寸已更新" : "卡片位置已更新");
        else render();
      };
      card.addEventListener("pointermove", move);
      card.addEventListener("pointerup", end);
      card.addEventListener("pointercancel", end);
    }

    function openEditor(item) {
      state.editingId = String(item.id);
      byId("editText").value = item.text || item.pageContent || "";
      byId("editSrc").value = safeUrl(item.src) || "";
      byId("editSrcRow").hidden = !["link","image","page"].includes(item.type);
      byId("editDialog").showModal();
      requestAnimationFrame(() => byId("editText").focus());
    }

    function chooseConnection(item) {
      if (!state.connectSource) {
        state.connectSource = String(item.id);
        byId("connectTip").textContent = "已选来源，再选择目标卡片";
        render();
        return;
      }
      const sourceId = state.connectSource;
      state.connectSource = "";
      state.connectMode = false;
      byId("connectTip").hidden = true;
      byId("connect").classList.remove("primary");
      if (sourceId === String(item.id)) { render(); return; }
      void mutate("cards.connect", { sourceCardId:sourceId, targetCardId:item.id, expectedTargetUpdatedAt:item.updatedAt }, "卡片已连接");
    }

    function setZoom(next, clientX = viewport.getBoundingClientRect().left + viewport.clientWidth / 2, clientY = viewport.getBoundingClientRect().top + viewport.clientHeight / 2) {
      const old = state.zoom;
      const rect = viewport.getBoundingClientRect();
      const offsetX = clientX - rect.left;
      const offsetY = clientY - rect.top;
      const anchor = { x:(viewport.scrollLeft + offsetX) / old, y:(viewport.scrollTop + offsetY) / old };
      state.zoom = Math.min(1.6, Math.max(.35, next));
      applyZoom();
      viewport.scrollLeft = anchor.x * state.zoom - offsetX;
      viewport.scrollTop = anchor.y * state.zoom - offsetY;
    }

    function fitContent() {
      const bounds = boardBounds();
      const contentWidth = Math.max(1, bounds.maxX - bounds.minX);
      const contentHeight = Math.max(1, bounds.maxY - bounds.minY);
      state.zoom = Math.min(1, Math.max(.35, Math.min(viewport.clientWidth / contentWidth, viewport.clientHeight / contentHeight)));
      applyZoom();
      viewport.scrollLeft = Math.max(0, bounds.minX * state.zoom - (viewport.clientWidth - contentWidth * state.zoom) / 2);
      viewport.scrollTop = Math.max(0, bounds.minY * state.zoom - (viewport.clientHeight - contentHeight * state.zoom) / 2);
    }

    function beginCanvasPan(event) {
      if (event.button !== 0 || event.target.closest(".card") || event.target.closest("button,a,input,textarea,select")) return;
      const start = { x:event.clientX, y:event.clientY, left:viewport.scrollLeft, top:viewport.scrollTop };
      viewport.dataset.panning = "true";
      viewport.setPointerCapture(event.pointerId);
      const move = moveEvent => {
        viewport.scrollLeft = start.left - (moveEvent.clientX - start.x);
        viewport.scrollTop = start.top - (moveEvent.clientY - start.y);
      };
      const end = () => {
        viewport.dataset.panning = "false";
        viewport.removeEventListener("pointermove", move);
        viewport.removeEventListener("pointerup", end);
        viewport.removeEventListener("pointercancel", end);
      };
      viewport.addEventListener("pointermove", move);
      viewport.addEventListener("pointerup", end);
      viewport.addEventListener("pointercancel", end);
    }

    async function watchChanges() {
      while (!state.ended) {
        try {
          const update = await rpc("collaboration.watch", { after:state.cursor, timeoutMs:25000 });
          state.cursor = Math.max(state.cursor, Number(update?.cursor) || 0);
          if (update?.events?.some(event => event.type === "board")) await refresh(false);
        } catch (error) {
          if (!state.ended) await new Promise(resolve => setTimeout(resolve, 1500));
        }
      }
    }

    byId("name").addEventListener("click", () => {
      const next = prompt("协作中显示的名字", guestName);
      if (!next?.trim()) return;
      guestName = next.trim().slice(0, 40);
      localStorage.setItem("shizuo-collaborator-name", guestName);
      byId("name").textContent = guestName;
      void refresh(true);
    });
    byId("add").addEventListener("click", () => { byId("createForm").reset(); byId("createSrcRow").hidden = true; byId("createDialog").showModal(); });
    byId("connect").addEventListener("click", () => { state.connectMode = !state.connectMode; state.connectSource = ""; byId("connectTip").hidden = !state.connectMode; byId("connect").classList.toggle("primary", state.connectMode); render(); });
    byId("zoomOut").addEventListener("click", () => setZoom(state.zoom - .1));
    byId("zoomIn").addEventListener("click", () => setZoom(state.zoom + .1));
    byId("fit").addEventListener("click", fitContent);
    byId("cancelEdit").addEventListener("click", () => byId("editDialog").close());
    byId("cancelCreate").addEventListener("click", () => byId("createDialog").close());
    byId("createType").addEventListener("change", event => { byId("createSrcRow").hidden = !["link","image","page"].includes(event.target.value); });
    byId("editForm").addEventListener("submit", event => {
      event.preventDefault();
      const item = itemById(state.editingId);
      if (!item) return;
      const patch = { text:byId("editText").value };
      if (["link","image","page"].includes(item.type)) patch.src = byId("editSrc").value.trim();
      byId("editDialog").close();
      void mutate("cards.update", { cardId:item.id, expectedUpdatedAt:item.updatedAt, patch }, "卡片内容已更新");
    });
    byId("createForm").addEventListener("submit", event => {
      event.preventDefault();
      const rect = viewport.getBoundingClientRect();
      const type = byId("createType").value;
      const card = { type, text:byId("createText").value, x:(viewport.scrollLeft + rect.width / 2) / state.zoom - 160, y:(viewport.scrollTop + rect.height / 2) / state.zoom - 80 };
      if (["link","image","page"].includes(type)) card.src = byId("createSrc").value.trim();
      byId("createDialog").close();
      void mutate("cards.create", { card }, "卡片已创建");
    });
    viewport.addEventListener("pointerdown", beginCanvasPan);
    viewport.addEventListener("wheel", event => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setZoom(state.zoom * (event.deltaY > 0 ? .9 : 1.1), event.clientX, event.clientY);
    }, { passive:false });
    window.addEventListener("resize", applyZoom);
    void refresh(true).then(() => {
      if (!state.board) return;
      fitContent();
      state.viewReady = true;
      void watchChanges();
    });
    setInterval(() => void refresh(false), 15000);
  `;
  return pageShell("拾作协作白板", body, script, nonce);
}
