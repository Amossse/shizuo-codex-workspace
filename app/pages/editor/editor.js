const metaEl   = document.getElementById("meta");
const statusEl = document.getElementById("status");
const statEl   = document.getElementById("stat");
const previewEl = document.getElementById("preview");
const modeSwitch = document.getElementById("modeSwitch");
const mainEl = document.querySelector("main");
const splitterEl = document.getElementById("splitter");

const DRAFT_KEY   = "__editor_draft__";
const CAPTURE_KEY = "__page_capture__";
const MODE_KEY    = "__editor_mode__";
const SPLIT_RATIO_KEY = "__editor_split_ratio__";
const MIN_SPLIT_RATIO = 20;
const MAX_SPLIT_RATIO = 80;

function setStatus(msg) {
  statusEl.textContent = `${new Date().toLocaleTimeString()} · ${msg}`;
}
function setStat(text) {
  statEl.textContent = text;
}

// ============== HTML → Markdown (Turndown) ==============
function buildTurndown(baseUrl) {
  const td = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
    linkStyle: "inlined",
    hr: "---",
    br: "  "
  });
  if (typeof turndownPluginGfm !== "undefined") {
    td.use(turndownPluginGfm.gfm);
  }
  td.addRule("absoluteLinks", {
    filter: "a",
    replacement(content, node) {
      const href = node.getAttribute("href");
      if (!href || href.startsWith("javascript:") || href.startsWith("#")) return content;
      let abs = href;
      try { abs = new URL(href, baseUrl).toString(); } catch (_) {}
      const title = node.getAttribute("title");
      return title ? `[${content}](${abs} "${title}")` : `[${content}](${abs})`;
    }
  });
  td.addRule("absoluteImages", {
    filter: "img",
    replacement(_, node) {
      const src = node.getAttribute("src") || node.getAttribute("data-src");
      if (!src || src.startsWith("data:")) return "";
      let abs = src;
      try { abs = new URL(src, baseUrl).toString(); } catch (_) {}
      const alt = node.getAttribute("alt") || "";
      return `![${alt}](${abs})`;
    }
  });
  td.addRule("fencedCode", {
    filter(node) {
      return node.nodeName === "PRE"
          && node.firstChild
          && node.firstChild.nodeName === "CODE";
    },
    replacement(_, node) {
      const code = node.firstChild;
      const className = code.getAttribute("class") || "";
      const m = className.match(/language-(\S+)/);
      const lang = m ? m[1] : "";
      const text = code.textContent.replace(/\n$/, "");
      return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
    }
  });
  return td;
}

// ============== Markdown → HTML (marked + DOMPurify) ==============
function renderMarkdown(md) {
  if (!md) return "";
  try {
    marked.setOptions({
      gfm: true,
      breaks: false,
      headerIds: false,
      mangle: false
    });
    const rawHtml = marked.parse(md);
    return DOMPurify.sanitize(rawHtml, {
      ADD_ATTR: ["target", "rel"]
    });
  } catch (e) {
    return `<pre class="preview-error">预览渲染失败：${e.message}</pre>`;
  }
}

function updatePreview(md) {
  previewEl.innerHTML = renderMarkdown(md);
  // 所有外链新窗口打开
  previewEl.querySelectorAll("a[href]").forEach(a => {
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener noreferrer");
  });
}

// ============== 模式切换 ==============
async function setMode(mode) {
  document.body.classList.remove("mode-code", "mode-split", "mode-preview");
  document.body.classList.add(`mode-${mode}`);
  modeSwitch.querySelectorAll("button").forEach(b => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });
  await chrome.storage.local.set({ [MODE_KEY]: mode });
  // Monaco 在被显示后需要 layout
  if (window.__editor && mode !== "preview") {
    requestAnimationFrame(() => window.__editor.layout());
  }
}

modeSwitch.addEventListener("click", e => {
  const m = e.target.dataset?.mode;
  if (m) setMode(m);
});

// ============== 分屏比例调整 ==============
function normalizedSplitRatio(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 50;
  return Math.min(MAX_SPLIT_RATIO, Math.max(MIN_SPLIT_RATIO, number));
}

function applySplitRatio(value) {
  const ratio = normalizedSplitRatio(value);
  mainEl.style.setProperty("--editor-ratio", `${ratio}%`);
  splitterEl.setAttribute("aria-valuenow", String(Math.round(ratio)));
  if (window.__editor) requestAnimationFrame(() => window.__editor.layout());
  return ratio;
}

async function saveSplitRatio(value) {
  const ratio = applySplitRatio(value);
  await chrome.storage.local.set({ [SPLIT_RATIO_KEY]: ratio });
}

function ratioFromPointer(event) {
  const rect = mainEl.getBoundingClientRect();
  if (!rect.width) return 50;
  return ((event.clientX - rect.left) / rect.width) * 100;
}

splitterEl.addEventListener("pointerdown", event => {
  if (event.button !== 0 || !document.body.classList.contains("mode-split")) return;
  event.preventDefault();
  splitterEl.setPointerCapture(event.pointerId);
  splitterEl.classList.add("is-resizing");
  document.body.classList.add("is-resizing");
  applySplitRatio(ratioFromPointer(event));
});

splitterEl.addEventListener("pointermove", event => {
  if (!splitterEl.hasPointerCapture(event.pointerId)) return;
  applySplitRatio(ratioFromPointer(event));
});

async function finishSplitResize(event) {
  if (!splitterEl.hasPointerCapture(event.pointerId)) return;
  splitterEl.releasePointerCapture(event.pointerId);
  splitterEl.classList.remove("is-resizing");
  document.body.classList.remove("is-resizing");
  const ratio = event.type === "pointercancel"
    ? splitterEl.getAttribute("aria-valuenow")
    : ratioFromPointer(event);
  await saveSplitRatio(ratio);
}

splitterEl.addEventListener("pointerup", finishSplitResize);
splitterEl.addEventListener("pointercancel", finishSplitResize);
splitterEl.addEventListener("dblclick", () => saveSplitRatio(50));
splitterEl.addEventListener("keydown", event => {
  const current = normalizedSplitRatio(splitterEl.getAttribute("aria-valuenow"));
  let next;
  if (event.key === "ArrowLeft") next = current - 2;
  if (event.key === "ArrowRight") next = current + 2;
  if (event.key === "Home") next = MIN_SPLIT_RATIO;
  if (event.key === "End") next = MAX_SPLIT_RATIO;
  if (next === undefined) return;
  event.preventDefault();
  saveSplitRatio(next);
});

// ============== Monaco ==============
function bootMonaco() {
  self.MonacoEnvironment = {
    getWorkerUrl(_moduleId, _label) {
      const baseUrl = chrome.runtime.getURL("vendor/monaco/min/");
      const code = `
        self.MonacoEnvironment = { baseUrl: "${baseUrl}" };
        importScripts("${baseUrl}vs/base/worker/workerMain.js");
      `;
      return URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
    }
  };
  require.config({
    paths: { vs: chrome.runtime.getURL("vendor/monaco/min/vs") }
  });
  return new Promise((resolve, reject) => {
    require(["vs/editor/editor.main"], () => resolve(monaco), reject);
  });
}

// ============== 主流程 ==============
(async function main() {
  const {
    [CAPTURE_KEY]: cap,
    [DRAFT_KEY]: draft,
    [MODE_KEY]: savedMode,
    [SPLIT_RATIO_KEY]: savedSplitRatio
  } = await chrome.storage.local.get([
    CAPTURE_KEY,
    DRAFT_KEY,
    MODE_KEY,
    SPLIT_RATIO_KEY
  ]);

  // 元信息
  if (cap) {
    const tags = {
      readability: "[正文]",
      virtualized: "[完整页面]",
      fallback: "[全页]"
    };
    const tag = tags[cap.mode] || "[页面]";
    metaEl.textContent = `${tag} ${cap.title || cap.url || "未知"}`;
    metaEl.title = cap.url || "";
  } else {
    metaEl.textContent = "未捕获页面";
  }

  // HTML → MD
  let markdown = "";
  if (cap?.html) {
    try {
      const td = buildTurndown(cap.url || location.href);
      markdown = td.turndown(cap.html);
      const header = [];
      if (cap.title)  header.push(`# ${cap.title}`);
      if (cap.url)    header.push(`> 来源：<${cap.url}>`);
      if (cap.byline) header.push(`> 作者：${cap.byline}`);
      markdown = (header.join("\n\n") + "\n\n" + markdown).trim();
    } catch (e) {
      markdown = `[HTML→MD 转换失败] ${e.message}`;
    }
  } else if (draft?.text) {
    markdown = draft.text;
  }

  // 应用保存的分屏比例和模式
  applySplitRatio(savedSplitRatio);
  await setMode(savedMode || "split");

  // 立即渲染一次预览（不依赖 Monaco）
  updatePreview(markdown);

  // 加载 Monaco
  setStatus("正在加载 Monaco…");
  try {
    await bootMonaco();
  } catch (e) {
    statusEl.textContent = "Monaco 加载失败: " + (e?.message || e);
    return;
  }

  const editor = monaco.editor.create(document.getElementById("editor"), {
    value: markdown,
    language: "markdown",
    // 使用 Monaco 自带浅色主题，外层纸张色由共享设计令牌统一控制。
    theme: "vs",
    automaticLayout: true,
    wordWrap: "on",
    minimap: { enabled: false },
    fontSize: 14,
    scrollBeyondLastLine: false,
    renderWhitespace: "selection",
    tabSize: 2
  });
  window.__editor = editor;

  setStatus(`已载入 ${markdown.length} 字`);
  setStat(`${cap?.mode || "draft"} · ${markdown.split("\n").length} 行`);

  // 防抖：自动保存 + 更新预览
  let saveTimer, renderTimer;
  editor.onDidChangeModelContent(() => {
    const text = editor.getValue();

    // 预览实时刷新（150ms 防抖）
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => updatePreview(text), 150);

    // 草稿保存（600ms 防抖）
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      await chrome.storage.local.set({
        [DRAFT_KEY]: { text, updatedAt: Date.now() }
      });
      setStatus("草稿已自动保存");
      setStat(`${cap?.mode || "draft"} · ${text.split("\n").length} 行`);
    }, 600);
  });

  // 快捷键：Cmd/Ctrl + 1/2/3 切换模式
  document.addEventListener("keydown", (e) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.key === "1") { e.preventDefault(); setMode("code"); }
    if (e.key === "2") { e.preventDefault(); setMode("split"); }
    if (e.key === "3") { e.preventDefault(); setMode("preview"); }
  });
})();
