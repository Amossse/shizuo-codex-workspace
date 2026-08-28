(() => {
  if (window.top !== window || globalThis.__shizuoCodexQuickEntry) return;
  globalThis.__shizuoCodexQuickEntry = true;

  const CODEX_STATUS_REQUEST = "pagedock-codex-status";
  const CODEX_RUN_REQUEST = "pagedock-codex-run";
  const CODEX_CANCEL_REQUEST = "pagedock-codex-cancel";
  const CODEX_EVENT = "pagedock-codex-event";
  const PAGE_CHAT_GET_REQUEST = "pagedock-page-chat-get";
  const PAGE_CHAT_PUT_REQUEST = "pagedock-page-chat-put";
  const PAGE_CHAT_DELETE_REQUEST = "pagedock-page-chat-delete";
  const POSITION_KEY = "__pagedock_page_codex_entry_v1__";
  const MAX_CONTEXT_CHARS = 80_000;
  const MAX_SELECTION_CHARS = 20_000;
  const MAX_IMAGE_COUNT = 4;
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
  const MAX_IMAGE_TOTAL_BYTES = 25 * 1024 * 1024;
  const host = document.createElement("div");
  host.id = "__shizuo_codex_quick_entry__";
  host.setAttribute("data-shizuo-ui", "codex-quick-entry");
  host.style.cssText = "all:initial;position:fixed;inset:0;width:0;height:0;z-index:2147483645;pointer-events:none;contain:layout style;";
  const shadow = host.attachShadow({ mode: "closed" });
  const style = document.createElement("style");
  style.textContent = String.raw`
    :host { all: initial; }
    *, *::before, *::after { box-sizing: border-box; }
    button, textarea { font: inherit; }
    .dock, .panel, .selection-menu {
      --paper: #fffaf3;
      --paper-2: #f8eee2;
      --ink: #31241f;
      --muted: #796a61;
      --line: #d9c6b4;
      --accent: #b62f1c;
      --accent-soft: #f7ded6;
      --success: #267443;
      --danger: #a52525;
      color: var(--ink);
      font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", sans-serif;
    }
    .dock { position: fixed; z-index: 2147483645; display: flex; align-items: center; pointer-events: auto; user-select: none; }
    .launcher { height: 48px; display: flex; align-items: center; gap: 7px; padding: 5px 6px; border: 1px solid var(--line); border-radius: 24px; background: color-mix(in srgb, var(--paper) 96%, transparent); box-shadow: 0 8px 24px rgba(73, 46, 31, .16); backdrop-filter: blur(10px); }
    .launcher-main { height: 36px; min-width: 0; display: flex; align-items: center; gap: 8px; padding: 0 7px 0 0; border: 0; border-radius: 18px; background: transparent; color: inherit; cursor: grab; touch-action: none; }
    .launcher-main:active { cursor: grabbing; }
    .mark { width: 36px; height: 36px; display: grid; place-items: center; flex: none; border-radius: 12px; background: #c66557; color: #fffaf3; font-weight: 750; }
    .name { font-size: 15px; font-weight: 700; white-space: nowrap; }
    .connection { max-width: 116px; padding: 3px 7px; overflow: hidden; border: 1px solid var(--line); border-radius: 999px; color: var(--muted); font-size: 10px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
    .dot { width: 8px; height: 8px; flex: none; border-radius: 50%; background: #b99979; }
    .dock[data-state="ready"] .dot { background: var(--success); }
    .dock[data-state="ready"] .connection { border-color: #b8d4c1; color: var(--success); }
    .dock[data-state="error"] .dot { background: var(--danger); }
    .launcher-action { width: 32px; height: 32px; display: grid; place-items: center; border: 0; border-radius: 50%; background: transparent; color: var(--muted); cursor: pointer; font-size: 17px; }
    .launcher-action:hover { background: var(--paper-2); color: var(--accent); }
    .dock[data-collapsed="true"] .launcher { width: 48px; padding: 5px; }
    .dock[data-collapsed="true"] .launcher-main { width: 36px; padding: 0; }
    .dock[data-collapsed="true"] .name,
    .dock[data-collapsed="true"] .connection,
    .dock[data-collapsed="true"] .dot,
    .dock[data-collapsed="true"] .launcher-action { display: none; }
    .panel { position: fixed; z-index: 2147483646; width: min(372px, calc(100vw - 24px)); height: min(540px, calc(100vh - 24px)); display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--line); border-radius: 16px; background: var(--paper); box-shadow: 0 18px 52px rgba(58, 36, 24, .23); pointer-events: auto; }
    .panel[hidden], .selection-menu[hidden] { display: none; }
    .panel-head { height: 52px; display: flex; align-items: center; gap: 9px; flex: none; padding: 8px 10px; border-bottom: 1px solid var(--line); background: var(--paper-2); }
    .panel-head .mark { width: 32px; height: 32px; border-radius: 10px; }
    .heading { min-width: 0; flex: 1; display: grid; gap: 1px; }
    .heading strong { font-size: 14px; }
    .heading span { overflow: hidden; color: var(--muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
    .head-button { min-height: 32px; padding: 0 8px; border: 0; border-radius: 8px; background: transparent; color: var(--muted); cursor: pointer; font-size: 11px; }
    .head-button:hover { background: var(--paper); color: var(--accent); }
    .messages { min-height: 0; flex: 1; display: flex; flex-direction: column; gap: 11px; padding: 13px; overflow: auto; overscroll-behavior: contain; }
    .empty { margin: auto; max-width: 260px; color: var(--muted); text-align: center; }
    .empty strong, .empty span { display: block; }
    .empty strong { color: var(--ink); font-size: 14px; }
    .empty span { margin-top: 5px; font-size: 11px; }
    .message { display: grid; gap: 3px; }
    .message-label { color: var(--muted); font-size: 9px; font-weight: 700; }
    .message-body { max-width: 92%; padding: 8px 10px; border: 1px solid var(--line); border-radius: 10px; background: #fffdf9; color: var(--ink); line-height: 1.6; overflow-wrap: anywhere; white-space: pre-wrap; user-select: text; }
    .message.user { justify-items: end; }
    .message.user .message-body { background: var(--accent-soft); }
    .message-quote { width: min(92%, 310px); max-height: 82px; margin: 0; padding: 7px 9px 7px 11px; overflow: auto; border-left: 3px solid #c58576; border-radius: 0 8px 8px 0; background: #fff7ee; color: var(--muted); font-size: 10px; line-height: 1.55; overflow-wrap: anywhere; white-space: pre-wrap; user-select: text; }
    .message.error .message-body { border-color: #e2aaaa; color: var(--danger); }
    .progress { display: flex; align-items: center; gap: 7px; color: var(--muted); font-size: 11px; }
    .progress::before { content: ""; width: 12px; height: 12px; border: 2px solid var(--line); border-top-color: var(--accent); border-radius: 50%; animation: spin .8s linear infinite; }
    .compose { flex: none; display: grid; gap: 7px; padding: 10px; border-top: 1px solid var(--line); background: var(--paper-2); }
    .compose textarea { width: 100%; min-height: 68px; max-height: 130px; padding: 9px 10px; resize: none; border: 1px solid var(--line); border-radius: 10px; outline: 2px solid transparent; background: #fffdf9; color: var(--ink); line-height: 1.5; }
    .compose textarea:focus { border-color: #c58576; outline-color: rgba(182, 47, 28, .16); }
    .compose-images { display: flex; gap: 7px; overflow-x: auto; }
    .compose-images[hidden] { display: none; }
    .compose-image { position: relative; width: 54px; height: 54px; flex: none; overflow: hidden; border: 1px solid var(--line); border-radius: 9px; background: #fffdf9; }
    .compose-image img { width: 100%; height: 100%; display: block; object-fit: cover; }
    .compose-image button { position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; padding: 0; border: 0; border-radius: 50%; background: rgba(49, 36, 31, .82); color: #fff; cursor: pointer; line-height: 18px; }
    .message-images { display: flex; gap: 5px; color: var(--muted); font-size: 9px; }
    .message-images::before { content: "▧"; color: var(--accent); }
    .compose-row { min-width: 0; min-height: 36px; display: flex; align-items: center; gap: 6px; }
    .compose-hint { min-width: 0; flex: 1; overflow: hidden; color: var(--muted); font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }
    .compose-hint[hidden], .compose-context[hidden], .compose-quick-actions[hidden] { display: none; }
    .compose-context { min-width: 0; flex: 1; display: flex; align-items: center; gap: 2px; overflow: hidden; color: var(--muted); font-size: 9px; white-space: nowrap; }
    .compose-context span { overflow: hidden; text-overflow: ellipsis; }
    .compose-context button { width: 20px; height: 20px; flex: none; padding: 0; border: 0; border-radius: 50%; background: transparent; color: var(--muted); cursor: pointer; }
    .compose-context button:hover { background: var(--paper); color: var(--accent); }
    .compose-quick-actions { display: flex; flex: none; align-items: center; gap: 2px; }
    .quick-action { min-height: 32px; padding: 0 7px; border: 0; border-radius: 7px; background: transparent; color: var(--muted); cursor: pointer; font-size: 10px; white-space: nowrap; }
    .quick-action:hover { background: var(--paper); color: var(--accent); }
    .send, .stop { min-height: 34px; padding: 0 12px; border: 1px solid var(--line); border-radius: 9px; background: var(--paper); color: var(--ink); cursor: pointer; }
    .send { margin-left: auto; padding-inline: 16px; border-color: var(--accent); background: var(--accent); color: #fffaf3; font-weight: 700; }
    .send:disabled, .stop:disabled, .quick-action:disabled { opacity: .45; cursor: default; }
    .stop { color: var(--danger); }
    .selection-menu { position: fixed; z-index: 2147483647; display: flex; gap: 4px; padding: 5px; border: 1px solid var(--line); border-radius: 11px; background: var(--paper); box-shadow: 0 10px 30px rgba(58, 36, 24, .2); pointer-events: auto; }
    .selection-menu button { min-height: 32px; padding: 0 8px; border: 0; border-radius: 7px; background: transparent; color: var(--ink); cursor: pointer; font-size: 10px; white-space: nowrap; }
    .selection-menu button:first-child { background: var(--accent); color: #fffaf3; font-weight: 700; }
    .selection-menu button:hover { background: var(--accent-soft); color: var(--accent); }
    .launcher-main:focus-visible, .launcher-action:focus-visible, .head-button:focus-visible, .quick-action:focus-visible, .selection-menu button:focus-visible, .send:focus-visible, .stop:focus-visible { outline: 2px solid #c66557; outline-offset: 2px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @media (max-width: 620px) {
      .selection-menu { max-width: calc(100vw - 16px); overflow-x: auto; }
      .panel { width: calc(100vw - 16px); height: min(560px, calc(100vh - 16px)); }
    }
    @media (prefers-reduced-motion: reduce) { .progress::before { animation: none; } }
  `;

  const dock = document.createElement("div");
  dock.className = "dock";
  dock.dataset.state = "loading";
  dock.dataset.collapsed = "false";
  dock.innerHTML = `
    <div class="launcher">
      <button class="launcher-main" id="launcherMain" type="button" aria-label="打开 Codex 快捷入口">
        <span class="mark">C</span><span class="name">Codex</span><span class="connection" id="connection">自动连接中</span><span class="dot" aria-hidden="true"></span>
      </button>
      <button class="launcher-action" id="collapse" type="button" aria-label="向右收起 Codex 快捷入口" title="向右收起">›</button>
    </div>`;

  const panel = document.createElement("aside");
  panel.className = "panel";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Codex 网页快捷面板");
  panel.innerHTML = `
    <header class="panel-head">
      <span class="mark">C</span>
      <div class="heading"><strong>问问 Codex</strong><span id="panelStatus">正在自动连接本地 Codex…</span></div>
      <button class="head-button" id="clear" type="button">新会话</button>
      <button class="head-button" id="close" type="button">关闭</button>
    </header>
    <div class="messages" id="messages" aria-live="polite"></div>
    <div class="compose">
      <textarea id="input" maxlength="8000" placeholder="输入问题或粘贴图片，回车发送，Shift + 回车换行"></textarea>
      <div class="compose-images" id="composeImages" aria-label="待发送图片" hidden></div>
      <div class="compose-row">
        <span class="compose-context" id="composeContext" hidden><span id="composeContextLabel"></span><button id="removeContext" type="button" aria-label="移除引用" title="移除引用">×</button></span>
        <span class="compose-hint" id="composeHint">打开页面即自动连接</span>
        <span class="compose-quick-actions" id="composeQuickActions">
          <button class="quick-action" data-action="translate" type="button" title="翻译中文">翻译</button>
          <button class="quick-action" data-action="summary" type="button" title="内容总结">总结</button>
          <button class="quick-action" data-action="analysis" type="button" title="内容分析">分析</button>
          <button class="quick-action" data-action="inspire" type="button" title="启发">启发</button>
        </span>
        <button class="stop" id="stop" type="button" hidden>停止</button><button class="send" id="send" type="button">发送</button>
      </div>
    </div>`;

  const selectionMenu = document.createElement("div");
  selectionMenu.className = "selection-menu";
  selectionMenu.hidden = true;
  selectionMenu.setAttribute("role", "toolbar");
  selectionMenu.setAttribute("aria-label", "选中文字快捷操作");
  selectionMenu.innerHTML = `
    <button data-action="ask" type="button">问问 Codex</button>
    <button data-action="translate" type="button">翻译中文</button>
    <button data-action="summary" type="button">内容总结</button>
    <button data-action="analysis" type="button">内容分析</button>
    <button data-action="inspire" type="button">启发</button>`;

  shadow.append(style, dock, panel, selectionMenu);
  (document.documentElement || document.body).appendChild(host);

  const element = id => shadow.getElementById(id);
  const launcherMain = element("launcherMain");
  const connection = element("connection");
  const panelStatus = element("panelStatus");
  const composeContext = element("composeContext");
  const composeContextLabel = element("composeContextLabel");
  const composeQuickActions = element("composeQuickActions");
  const messagesEl = element("messages");
  const input = element("input");
  const composeImages = element("composeImages");
  const send = element("send");
  const stop = element("stop");
  let position = { x: Math.max(12, innerWidth - 290), y: Math.max(12, innerHeight - 76) };
  let collapsed = false;
  let ready = false;
  let busy = false;
  let taskId = "";
  let progressText = "";
  let attachedSelection = "";
  let attachedImages = [];
  let savedSelection = null;
  let messages = [];
  let saveTimer;
  let chatPersistTimer;
  let pageChatLoaded = false;
  let currentPageUrl = location.href;
  let currentPageTitle = document.title || "当前页面";
  let pendingPageUrl = "";
  let switchingPageConversation = false;
  let pageChatLoadPromise = Promise.resolve();
  let dragged = false;

  const prompts = {
    translate: target => `请将${target}翻译成自然、准确的中文，保留原有段落、语气、数字和专有名词；只输出译文，不添加额外分析。`,
    summary: target => `请总结${target}：先给一句话结论，再列出 3 到 6 个关键信息；忠于原文，不臆测。`,
    analysis: target => `请深入分析${target}：说明核心观点、论证结构、关键依据、隐含假设、可能的局限和需要进一步核实之处。`,
    inspire: target => `请基于${target}给出有价值的启发：提炼可迁移的方法、值得追问的问题、可行动建议和 2 到 3 个新的思考方向；不要脱离原文事实。`
  };

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }

  function persistUi() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      chrome.storage.local.set({ [POSITION_KEY]: { ...position, collapsed } }).catch(() => {});
    }, 120);
  }

  function positionPanel() {
    if (panel.hidden) return;
    const margin = 10;
    const rect = dock.getBoundingClientRect();
    const panelWidth = panel.offsetWidth || Math.min(372, innerWidth - 24);
    const panelHeight = panel.offsetHeight || Math.min(540, innerHeight - 24);
    const left = clamp(position.x + rect.width - panelWidth, 8, Math.max(8, innerWidth - panelWidth - 8));
    const below = position.y + rect.height + margin;
    const top = below + panelHeight <= innerHeight - 8
      ? below
      : clamp(position.y - panelHeight - margin, 8, Math.max(8, innerHeight - panelHeight - 8));
    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
  }

  function applyPosition(next = position) {
    const width = dock.offsetWidth || (collapsed ? 48 : 250);
    const height = dock.offsetHeight || 48;
    position = {
      x: clamp(Number(next.x) || 12, 8, Math.max(8, innerWidth - width - 8)),
      y: clamp(Number(next.y) || 12, 8, Math.max(8, innerHeight - height - 8))
    };
    dock.style.left = `${Math.round(position.x)}px`;
    dock.style.top = `${Math.round(position.y)}px`;
    positionPanel();
  }

  function setCollapsed(value) {
    const nextCollapsed = Boolean(value);
    if (collapsed === nextCollapsed) return;
    // Keep the right edge fixed so the launcher folds toward the right and expands back from it.
    const rightEdge = position.x + (dock.offsetWidth || (collapsed ? 48 : 250));
    collapsed = nextCollapsed;
    dock.dataset.collapsed = String(collapsed);
    if (collapsed) panel.hidden = true;
    launcherMain.setAttribute("aria-label", collapsed ? "展开 Codex 快捷入口" : "打开 Codex 快捷面板");
    requestAnimationFrame(() => {
      const width = dock.offsetWidth || (collapsed ? 48 : 250);
      applyPosition({ x: rightEdge - width, y: position.y });
      persistUi();
    });
  }

  function setConnection(state, text) {
    dock.dataset.state = state;
    connection.textContent = text;
    panelStatus.textContent = text;
    launcherMain.title = text;
    ready = state === "ready";
    updateControls();
  }

  function updateControls() {
    send.disabled = busy || !ready || (!input.value.trim() && !attachedImages.length);
    stop.hidden = !busy;
    stop.disabled = !busy;
    // Quick actions are page-level capabilities: use the quote when present, otherwise use the current page.
    composeQuickActions.hidden = busy;
    shadow.querySelectorAll(".quick-action").forEach(button => { button.disabled = busy || !ready; });
    const composeHint = element("composeHint");
    composeHint.hidden = !busy;
    composeHint.textContent = busy ? (progressText || "Codex 正在处理…") : ready ? "本地 Codex 已自动连接" : "正在自动连接本地 Codex";
  }

  function openPanel() {
    if (collapsed) setCollapsed(false);
    panel.hidden = false;
    launcherMain.setAttribute("aria-expanded", "true");
    requestAnimationFrame(() => {
      positionPanel();
      input.focus({ preventScroll: true });
    });
  }

  function closePanel() {
    panel.hidden = true;
    launcherMain.setAttribute("aria-expanded", "false");
  }

  function setAttachedSelection(text = "") {
    attachedSelection = String(text || "").trim().slice(0, MAX_SELECTION_CHARS);
    composeContext.hidden = !attachedSelection;
    composeContextLabel.textContent = attachedSelection ? `引用 · ${attachedSelection.length} 字` : "";
    updateControls();
  }

  function renderAttachedImages() {
    composeImages.replaceChildren();
    composeImages.hidden = !attachedImages.length;
    attachedImages.forEach((image, index) => {
      const preview = document.createElement("span");
      preview.className = "compose-image";
      const thumbnail = document.createElement("img");
      thumbnail.src = image.dataUrl;
      thumbnail.alt = image.name || `待发送图片 ${index + 1}`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.disabled = busy;
      remove.setAttribute("aria-label", `移除图片 ${index + 1}`);
      remove.addEventListener("click", () => {
        attachedImages.splice(index, 1);
        renderAttachedImages();
        updateControls();
      });
      preview.append(thumbnail, remove);
      composeImages.appendChild(preview);
    });
  }

  function fileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("图片读取失败"));
      reader.readAsDataURL(file);
    });
  }

  async function attachImageFiles(files) {
    const supported = [...files].filter(file => /^image\/(png|jpe?g|webp)$/i.test(file.type));
    if (!supported.length) {
      panelStatus.textContent = "仅支持 PNG、JPEG 或 WebP 图片";
      return;
    }
    for (const file of supported) {
      if (attachedImages.length >= MAX_IMAGE_COUNT) {
        panelStatus.textContent = `一次最多发送 ${MAX_IMAGE_COUNT} 张图片`;
        break;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        panelStatus.textContent = `单张图片不能超过 ${MAX_IMAGE_BYTES / 1024 / 1024} MB`;
        continue;
      }
      if (attachedImages.reduce((total, image) => total + image.size, 0) + file.size > MAX_IMAGE_TOTAL_BYTES) {
        panelStatus.textContent = "图片总大小不能超过 25 MB";
        break;
      }
      attachedImages.push({ dataUrl: await fileAsDataUrl(file), name: file.name || "剪贴板图片", size: file.size });
    }
    renderAttachedImages();
    updateControls();
    if (ready) panelStatus.textContent = attachedImages.length ? `已添加 ${attachedImages.length} 张图片` : "本地已连接";
  }

  function addMessage(role, text, quote = "", imageCount = 0) {
    const rawQuote = String(quote || "").trim();
    messages.push({
      role,
      text: String(text || "").trim().slice(0, 60_000),
      quote: rawQuote ? `${rawQuote.slice(0, 2_000)}${rawQuote.length > 2_000 ? "…" : ""}` : "",
      imageCount: Math.min(MAX_IMAGE_COUNT, Math.max(0, Number(imageCount) || 0))
    });
    messages = messages.slice(-30);
    renderMessages();
    schedulePageChatPersist();
  }

  function renderMessages() {
    messagesEl.replaceChildren();
    if (!messages.length && !busy) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.innerHTML = "<strong>在当前网页直接问 Codex</strong><span>选中文字可翻译、总结、分析或继续发问。</span>";
      messagesEl.appendChild(empty);
      return;
    }
    for (const message of messages) {
      const article = document.createElement("article");
      article.className = `message ${message.role}`;
      const label = document.createElement("span");
      label.className = "message-label";
      label.textContent = message.role === "user" ? "你" : message.role === "error" ? "未完成" : "Codex";
      const body = document.createElement("div");
      body.className = "message-body";
      body.textContent = message.text;
      article.appendChild(label);
      if (message.quote) {
        const quote = document.createElement("blockquote");
        quote.className = "message-quote";
        quote.textContent = message.quote;
        article.appendChild(quote);
      }
      if (message.imageCount) {
        const images = document.createElement("span");
        images.className = "message-images";
        images.textContent = `${message.imageCount} 张图片`;
        article.appendChild(images);
      }
      article.appendChild(body);
      messagesEl.appendChild(article);
    }
    if (busy) {
      const progress = document.createElement("div");
      progress.className = "progress";
      progress.textContent = progressText || "Codex 正在处理…";
      messagesEl.appendChild(progress);
    }
    requestAnimationFrame(() => { messagesEl.scrollTop = messagesEl.scrollHeight; });
  }

  function pageText() {
    const text = String(document.body?.innerText || "").replace(/\n{4,}/g, "\n\n\n").trim();
    return text.slice(0, MAX_CONTEXT_CHARS);
  }

  function conversationContext() {
    return messages.slice(-8).map(message => `${message.role === "user" ? "用户" : "Codex"}：${message.text}${message.imageCount ? `\n[附带 ${message.imageCount} 张图片]` : ""}`).join("\n\n---\n\n").slice(-20_000);
  }

  async function restorePageChat(url) {
    pageChatLoaded = false;
    try {
      const response = await chrome.runtime.sendMessage({ type: PAGE_CHAT_GET_REQUEST, url });
      if (!response?.ok) throw new Error(response?.error || "页面会话读取失败");
      if (currentPageUrl !== url) return;
      messages = (Array.isArray(response.result?.messages) ? response.result.messages : []).map(message => ({
        role: ["user", "assistant", "error"].includes(message?.role) ? message.role : "assistant",
        text: String(message?.text || "").slice(0, 24_000),
        quote: String(message?.quote || "").slice(0, 2_000),
        imageCount: Math.min(MAX_IMAGE_COUNT, Math.max(0, Number(message?.imageCount) || 0))
      })).filter(message => message.text).slice(-30);
      renderMessages();
    } catch (error) {
      console.warn("[shizuo-page-codex] page conversation restore failed", { reason: error?.message || String(error) });
    } finally {
      if (currentPageUrl === url) pageChatLoaded = true;
    }
  }

  async function persistPageChat(url = currentPageUrl) {
    if (!pageChatLoaded || !messages.length) return;
    const response = await chrome.runtime.sendMessage({
      type: PAGE_CHAT_PUT_REQUEST,
      url,
      title: currentPageTitle,
      messages
    });
    if (!response?.ok) throw new Error(response?.error || "页面会话保存失败");
  }

  function schedulePageChatPersist() {
    if (!pageChatLoaded) return;
    clearTimeout(chatPersistTimer);
    chatPersistTimer = setTimeout(() => {
      persistPageChat().catch(error => {
        console.warn("[shizuo-page-codex] page conversation save failed", { reason: error?.message || String(error) });
      });
    }, 180);
  }

  async function switchPageConversation(nextUrl = location.href) {
    const url = String(nextUrl || location.href);
    if (url === currentPageUrl) {
      pendingPageUrl = "";
      return pageChatLoadPromise;
    }
    if (busy || switchingPageConversation) {
      pendingPageUrl = url;
      return;
    }
    switchingPageConversation = true;
    try {
      clearTimeout(chatPersistTimer);
      await persistPageChat(currentPageUrl).catch(error => {
        console.warn("[shizuo-page-codex] previous page conversation save failed", { reason: error?.message || String(error) });
      });
      currentPageUrl = url;
      currentPageTitle = document.title || "当前页面";
      pendingPageUrl = "";
      messages = [];
      setAttachedSelection("");
      attachedImages = [];
      renderAttachedImages();
      renderMessages();
      pageChatLoadPromise = restorePageChat(url);
      return await pageChatLoadPromise;
    } finally {
      switchingPageConversation = false;
      if (!busy && pendingPageUrl && pendingPageUrl !== currentPageUrl) void switchPageConversation(pendingPageUrl);
    }
  }

  async function refreshStatus() {
    if (busy) return;
    setConnection("loading", "自动连接中");
    try {
      const response = await chrome.runtime.sendMessage({ type: CODEX_STATUS_REQUEST });
      if (!response?.ok) throw new Error(response?.error || "本地桥接不可用");
      if (!response.ready) throw new Error(response.health?.nativeHost ? "Codex CLI 不可用" : "本地桥接未连接");
      setConnection("ready", "本地已连接");
    } catch (error) {
      setConnection("error", "等待本地连接");
      panelStatus.textContent = error?.message || "本地 Codex 未连接";
    }
  }

  async function sendPrompt(prompt, selectedText = attachedSelection) {
    const pendingImages = attachedImages.map(image => ({ ...image }));
    const imageBatch = pendingImages.map(image => image.dataUrl);
    const userPrompt = String(prompt || "").trim() || (imageBatch.length ? "请分析这些图片。" : "");
    if (!userPrompt || busy) return;
    openPanel();
    if (location.href !== currentPageUrl) await switchPageConversation(location.href);
    await pageChatLoadPromise;
    currentPageTitle = document.title || currentPageTitle;
    const selectionText = String(selectedText || "").trim().slice(0, MAX_SELECTION_CHARS);
    if (selectionText) setAttachedSelection(selectionText);
    if (!ready) await refreshStatus();
    if (!ready) return;
    addMessage("user", userPrompt, selectionText, imageBatch.length);
    input.value = "";
    attachedImages = [];
    renderAttachedImages();
    panelStatus.textContent = "本地已连接";
    progressText = "正在理解网页内容…";
    busy = true;
    taskId = `page-codex-${crypto.randomUUID()}`;
    renderMessages();
    updateControls();
    const context = selectionText
      ? `选中文字：\n${selectionText}`
      : `当前页面可见内容：\n${pageText() || "（当前页面没有可提取的正文）"}`;
    // 引用已经固化到本轮用户消息，输入区不再重复展示。
    if (selectionText) setAttachedSelection("");
    try {
      const response = await chrome.runtime.sendMessage({
        type: CODEX_RUN_REQUEST,
        id: taskId,
        runtime: imageBatch.length ? "codex" : undefined,
        mode: "analysis",
        prompt: userPrompt,
        page: {
          title: document.title || "当前网页",
          url: currentPageUrl,
          content: [context, conversationContext()].filter(Boolean).join("\n\n---\n\n").slice(0, MAX_CONTEXT_CHARS)
        },
        images: imageBatch
      });
      if (!response?.ok) throw new Error(response?.error || "Codex 任务启动失败");
      reconcileTaskSnapshot(response);
    } catch (error) {
      busy = false;
      taskId = "";
      if (!attachedImages.length) {
        attachedImages = pendingImages;
        renderAttachedImages();
      }
      addMessage("error", error?.message || "Codex 任务启动失败");
      progressText = "";
      updateControls();
    }
  }

  function quickAction(action, selectionText) {
    if (action === "ask") {
      setAttachedSelection(selectionText);
      openPanel();
      return;
    }
    const text = String(selectionText || "").trim();
    const prompt = prompts[action]?.(text ? "选中文字" : "当前页面正文");
    if (prompt) void sendPrompt(prompt, text);
  }

  function hideSelectionMenu() { selectionMenu.hidden = true; }

  function showSelectionMenu() {
    const selection = getSelection();
    const text = String(selection?.toString() || "").trim();
    if (!text || selection.rangeCount === 0 || host.contains(selection.anchorNode)) {
      hideSelectionMenu();
      return;
    }
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect.width && !rect.height) return hideSelectionMenu();
    savedSelection = { text: text.slice(0, MAX_SELECTION_CHARS), rect };
    selectionMenu.hidden = false;
    requestAnimationFrame(() => {
      const width = selectionMenu.offsetWidth;
      const height = selectionMenu.offsetHeight;
      const left = clamp(rect.left + rect.width / 2 - width / 2, 8, Math.max(8, innerWidth - width - 8));
      const below = rect.bottom + 8;
      const top = below + height <= innerHeight - 8 ? below : Math.max(8, rect.top - height - 8);
      selectionMenu.style.left = `${Math.round(left)}px`;
      selectionMenu.style.top = `${Math.round(top)}px`;
    });
  }

  launcherMain.addEventListener("pointerdown", event => {
    if (event.button !== 0) return;
    const start = { x: event.clientX, y: event.clientY, left: position.x, top: position.y };
    dragged = false;
    launcherMain.setPointerCapture(event.pointerId);
    const move = moveEvent => {
      const dx = moveEvent.clientX - start.x;
      const dy = moveEvent.clientY - start.y;
      if (Math.hypot(dx, dy) > 4) dragged = true;
      if (!dragged) return;
      applyPosition({ x: start.left + dx, y: start.top + dy });
      persistUi();
    };
    const finish = finishEvent => {
      launcherMain.removeEventListener("pointermove", move);
      launcherMain.removeEventListener("pointerup", finish);
      launcherMain.removeEventListener("pointercancel", finish);
      if (launcherMain.hasPointerCapture(finishEvent.pointerId)) launcherMain.releasePointerCapture(finishEvent.pointerId);
    };
    launcherMain.addEventListener("pointermove", move);
    launcherMain.addEventListener("pointerup", finish);
    launcherMain.addEventListener("pointercancel", finish);
  });
  launcherMain.addEventListener("click", event => {
    if (dragged) { event.preventDefault(); dragged = false; return; }
    if (collapsed) setCollapsed(false);
    else if (panel.hidden) openPanel();
    else closePanel();
  });
  element("collapse").addEventListener("click", () => setCollapsed(true));
  element("close").addEventListener("click", closePanel);
  element("clear").addEventListener("click", async () => {
    if (busy) return;
    messages = [];
    setAttachedSelection("");
    attachedImages = [];
    renderAttachedImages();
    renderMessages();
    const response = await chrome.runtime.sendMessage({ type: PAGE_CHAT_DELETE_REQUEST, url: currentPageUrl }).catch(() => null);
    if (!response?.ok) console.warn("[shizuo-page-codex] page conversation clear failed", { reason: response?.error || "消息通道不可用" });
  });
  element("removeContext").addEventListener("click", () => setAttachedSelection(""));
  send.addEventListener("click", () => void sendPrompt(input.value));
  stop.addEventListener("click", async () => {
    if (!busy || !taskId) return;
    stop.disabled = true;
    await chrome.runtime.sendMessage({ type: CODEX_CANCEL_REQUEST, id: taskId }).catch(() => {});
  });
  input.addEventListener("input", updateControls);
  input.addEventListener("paste", event => {
    if (busy) return;
    const images = [...(event.clipboardData?.items || [])]
      .filter(item => item.kind === "file" && item.type.startsWith("image/"))
      .map(item => item.getAsFile())
      .filter(Boolean);
    if (!images.length) return;
    event.preventDefault();
    void attachImageFiles(images).catch(error => { panelStatus.textContent = error?.message || "图片读取失败"; });
  });
  input.addEventListener("keydown", event => {
    if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    void sendPrompt(input.value);
  });
  shadow.querySelectorAll(".quick-action").forEach(button => {
    button.addEventListener("click", () => quickAction(button.dataset.action, attachedSelection));
  });
  selectionMenu.addEventListener("pointerdown", event => event.preventDefault());
  selectionMenu.querySelectorAll("button").forEach(button => {
    button.addEventListener("click", () => {
      const text = savedSelection?.text || "";
      hideSelectionMenu();
      quickAction(button.dataset.action, text);
    });
  });

  document.addEventListener("pointerup", event => {
    if (event.composedPath().includes(host)) return;
    setTimeout(showSelectionMenu, 0);
  }, true);
  document.addEventListener("keyup", event => {
    if (!["Shift", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
    setTimeout(showSelectionMenu, 0);
  }, true);
  document.addEventListener("pointerdown", event => {
    if (event.composedPath().includes(host)) return;
    hideSelectionMenu();
  }, true);
  addEventListener("resize", () => applyPosition(position));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && !ready) void refreshStatus(); });
  addEventListener("pagehide", () => { void persistPageChat().catch(() => {}); });
  function applyTaskEvent(event) {
    if (!event || event.id !== taskId) return;
    if (event.type === "started") progressText = "正在理解并组织回答…";
    else if (event.type === "progress") progressText = String(event.label || event.stage || "正在处理…").slice(0, 120);
    else if (event.type === "done") {
      busy = false;
      taskId = "";
      progressText = "";
      addMessage("assistant", event.answer || "Codex 没有返回内容");
    } else if (event.type === "error") {
      busy = false;
      taskId = "";
      progressText = "";
      addMessage("error", event.error || "Codex 任务失败");
    } else if (event.type === "cancelled") {
      busy = false;
      taskId = "";
      progressText = "";
      addMessage("error", "任务已停止");
    }
    renderMessages();
    updateControls();
    if (["done", "error", "cancelled"].includes(event.type) && pendingPageUrl) void switchPageConversation(pendingPageUrl);
  }

  function reconcileTaskSnapshot(snapshot) {
    if (!busy || !taskId || !snapshot) return;
    const terminalEvent = snapshot.taskEvent
      || (snapshot.lastEvent?.id === taskId ? snapshot.lastEvent : null);
    if (terminalEvent) {
      applyTaskEvent(terminalEvent);
      return;
    }
    const activeTaskIds = Array.isArray(snapshot.activeTaskIds) ? snapshot.activeTaskIds : [];
    if (!activeTaskIds.includes(taskId)) {
      applyTaskEvent({
        type: "error",
        id: taskId,
        error: "任务已结束，但没有收到结果。请重试。"
      });
    }
  }

  async function reconcileActiveTask() {
    const currentTaskId = taskId;
    if (!busy || !currentTaskId) return;
    try {
      const response = await chrome.runtime.sendMessage({ type: CODEX_STATUS_REQUEST, taskId: currentTaskId });
      if (!response?.ok) throw new Error(response?.error || "无法确认任务状态");
      if (taskId === currentTaskId) reconcileTaskSnapshot(response);
    } catch (error) {
      if (taskId === currentTaskId) {
        applyTaskEvent({ type: "error", id: currentTaskId, error: error?.message || "任务连接已中断，请重试" });
      }
    }
  }

  function handleCodexMessage(message) {
    if (message?.type === CODEX_EVENT) applyTaskEvent(message.event);
  }
  // A dedicated port wakes the service worker on page open and avoids duplicate task events.
  const pagePort = chrome.runtime.connect({ name: "pagedock-page-codex" });
  pagePort.onMessage.addListener(handleCodexMessage);

  chrome.storage.local.get(POSITION_KEY).then(stored => {
    const saved = stored[POSITION_KEY];
    if (saved && typeof saved === "object") {
      position = { x: Number(saved.x), y: Number(saved.y) };
      collapsed = Boolean(saved.collapsed);
      dock.dataset.collapsed = String(collapsed);
    }
    requestAnimationFrame(() => applyPosition(position));
  }).catch(() => requestAnimationFrame(() => applyPosition(position)));
  renderMessages();
  updateControls();
  pageChatLoadPromise = restorePageChat(currentPageUrl);
  void refreshStatus();
  setInterval(() => { if (document.visibilityState === "visible" && !busy) void refreshStatus(); }, 30_000);
  setInterval(() => { if (document.visibilityState === "visible" && busy) void reconcileActiveTask(); }, 3_000);
  // pushState/replaceState run in the page world, so lightweight URL observation also covers SPA navigation.
  setInterval(() => { void switchPageConversation(location.href); }, 1_000);
})();
