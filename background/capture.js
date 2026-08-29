// Module: page context, Markdown, screenshot, and PDF capture adapters.
async function captureMarkdown(request) {
  return runExclusive(request.tabId, "Markdown 解析", async () => {
    const tab = await validateSourceTab(request);
    console.info("[capture-markdown] collecting page content", { tabId: tab.id });
    const extracted = await collectPageContent(tab);

    const payload = {
      url: tab.url,
      title: tab.title,
      sourceTabId: tab.id,
      capturedAt: Date.now(),
      ...extracted
    };
    await chrome.storage.local.set({ [CAPTURE_KEY]: payload });
    await chrome.tabs.create({ url: chrome.runtime.getURL("editor.html") });

    console.info("[capture-markdown] editor opened", {
      tabId: tab.id,
      mode: payload.mode,
      textLength: payload.textLength,
      blockCount: payload.blockCount
    });
    return {
      mode: payload.mode,
      textLength: payload.textLength || 0,
      blockCount: payload.blockCount || 0,
      reachedEnd: payload.reachedEnd !== false
    };
  });
}

async function captureCodexPageContext() {
  const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (!activeTab?.id) throw new Error("找不到当前网页");
  return runExclusive(activeTab.id, "Codex 网页分析", async () => {
    const tab = await validateSourceTab({ tabId: activeTab.id, expectedUrl: activeTab.url });
    console.info("[pagedock-codex] collecting current page", { tabId: tab.id });
    const extracted = await collectPageContent(tab);
    const markdown = await convertCapturedHtmlToMarkdown(tab.id, extracted.html, tab.url);
    console.info("[pagedock-codex] current page collected", {
      tabId: tab.id,
      mode: extracted.mode,
      textLength: extracted.textLength,
      markdownLength: markdown.length,
      reachedEnd: extracted.reachedEnd !== false
    });
    const limitedMarkdown = markdown.length > CODEX_PAGE_CONTENT_LIMIT
      ? `${markdown.slice(0, CODEX_PAGE_CONTENT_LIMIT)}\n\n[拾作：网页内容超过分析上限，已截断]`
      : markdown;
    return {
      title: extracted.title || tab.title || "",
      url: tab.url || "",
      content: limitedMarkdown,
      mode: extracted.mode || "",
      reachedEnd: extracted.reachedEnd !== false
    };
  });
}

function pageOriginPattern(value) {
  const url = new URL(String(value || ""));
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("页面卡地址不是可读取的 HTTP(S) 网页");
  return `${url.protocol}//${url.host}/*`;
}

function waitForTabComplete(tabId, timeoutMs = 45_000) {
  return new Promise((resolve, reject) => {
    let timer;
    const cleanup = () => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      chrome.tabs.onRemoved.removeListener(onRemoved);
    };
    const finish = value => {
      cleanup();
      resolve(value);
    };
    const fail = error => {
      cleanup();
      reject(error);
    };
    const onUpdated = (updatedTabId, changeInfo, tab) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") finish(tab);
    };
    const onRemoved = removedTabId => {
      if (removedTabId === tabId) fail(new Error("页面读取标签页已关闭"));
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    chrome.tabs.onRemoved.addListener(onRemoved);
    timer = setTimeout(() => fail(new Error("页面加载超过 45 秒，请确认网页可以正常打开")), timeoutMs);
    chrome.tabs.get(tabId).then(tab => {
      if (tab?.status === "complete") finish(tab);
    }).catch(fail);
  });
}

async function capturePageCardContext(request) {
  const requestedUrl = new URL(String(request?.url || ""));
  const requestedOrigin = pageOriginPattern(requestedUrl);
  const allowed = await chrome.permissions.contains({ origins: [requestedOrigin] });
  if (!allowed) throw new Error(`尚未允许读取 ${requestedUrl.host} 的页面内容`);

  const created = await chrome.tabs.create({ url: requestedUrl.toString(), active: false });
  if (!created?.id) throw new Error("无法创建页面读取标签页");
  try {
    await waitForTabComplete(created.id);
    // 给动态页面首屏请求和组件渲染留出时间，随后复用完整滚动采集器读取虚拟列表。
    await wait(1_500);
    const tab = await chrome.tabs.get(created.id);
    const finalOrigin = pageOriginPattern(tab.url || requestedUrl);
    if (!await chrome.permissions.contains({ origins: [finalOrigin] })) {
      const error = new Error(`页面跳转到了 ${new URL(tab.url).host}，需要重新授权后读取`);
      error.code = "page-permission-required";
      error.requiredOrigin = finalOrigin;
      error.requiredHost = new URL(tab.url).host;
      throw error;
    }
    console.info("[pagedock-page] collecting page-card content", {
      tabId: tab.id,
      requestedUrl: requestedUrl.toString(),
      finalUrl: tab.url
    });
    const extracted = await collectPageContent(tab);
    const markdown = await convertCapturedHtmlToMarkdown(tab.id, extracted.html, tab.url);
    if (!markdown.trim()) throw new Error("页面没有提取到可分析的正文");
    const content = markdown.length > CODEX_PAGE_CONTENT_LIMIT
      ? `${markdown.slice(0, CODEX_PAGE_CONTENT_LIMIT)}\n\n[拾作：网页内容超过分析上限，已截断]`
      : markdown;
    console.info("[pagedock-page] page-card content collected", {
      tabId: tab.id,
      mode: extracted.mode,
      markdownLength: content.length,
      reachedEnd: extracted.reachedEnd !== false
    });
    return {
      title: extracted.title || tab.title || "",
      url: tab.url || requestedUrl.toString(),
      content,
      mode: extracted.mode || "",
      reachedEnd: extracted.reachedEnd !== false
    };
  } finally {
    await chrome.tabs.remove(created.id).catch(() => {});
  }
}

async function collectPageContent(tab) {
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: [
      "vendor/readability/Readability.js",
      "vendor/turndown/turndown.js",
      "vendor/turndown/turndown-plugin-gfm.js",
      "content-capture.js"
    ]
  });

  // 虚拟滚动页面按区段累计结构化内容；普通页面继续走 Readability。
  const virtualCapture = await callContentCapture(tab.id, "captureMarkdown");
  if (virtualCapture?.html) return virtualCapture;
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractArticle
  });
  return {
    ...result,
    reachedEnd: virtualCapture?.reachedEnd,
    scrollTarget: virtualCapture?.scrollTarget
  };
}

async function convertCapturedHtmlToMarkdown(tabId, html, baseUrl) {
  if (!html) throw new Error("当前网页没有可分析的正文");
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (capturedHtml, pageUrl) => {
      if (typeof TurndownService === "undefined") throw new Error("Markdown 转换器未载入");
      const service = new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
        bulletListMarker: "-"
      });
      if (typeof turndownPluginGfm !== "undefined") service.use(turndownPluginGfm.gfm);
      service.addRule("pagedockAbsoluteLinks", {
        filter: "a",
        replacement(content, node) {
          const href = node.getAttribute("href");
          if (!href || href.startsWith("javascript:") || href.startsWith("#")) return content;
          let absolute = href;
          try { absolute = new URL(href, pageUrl).toString(); } catch (_) {}
          return `[${content}](${absolute})`;
        }
      });
      service.addRule("pagedockAbsoluteImages", {
        filter: "img",
        replacement(_, node) {
          const source = node.getAttribute("src") || node.getAttribute("data-src");
          if (!source || source.startsWith("data:")) return "";
          let absolute = source;
          try { absolute = new URL(source, pageUrl).toString(); } catch (_) {}
          return `![${node.getAttribute("alt") || ""}](${absolute})`;
        }
      });
      return service.turndown(capturedHtml);
    },
    args: [html, baseUrl]
  });
  return String(result || "").trim();
}

async function captureFullPage(request) {
  return runExclusive(request.tabId, "整页截图", async () => {
    const tab = await validateSourceTab(request);
    const [activeTab] = await chrome.tabs.query({ active: true, windowId: tab.windowId });
    if (activeTab?.id !== tab.id) {
      throw new Error("截图期间请保持原网页为当前标签页");
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content-capture.js"]
    });

    console.info("[capture-screenshot] starting scroll capture", { tabId: tab.id });
    const session = await callContentCapture(tab.id, "startScreenshotCapture");
    let offscreenOpen = true;
    let tileCount = 0;
    let totalHeight = session.scrollHeight;
    let reachedEnd = false;
    let stitched;

    try {
      await openScreenshotStitchSession(session.sessionId);
      let nextTop = 0;
      for (let index = 0; index < 200; index += 1) {
        const state = await callContentCapture(
          tab.id,
          "scrollScreenshotCapture",
          [session.sessionId, nextTop, SCREENSHOT_RENDER_SETTLE_MS]
        );
        const [currentActive] = await chrome.tabs.query({
          active: true,
          windowId: tab.windowId
        });
        if (currentActive?.id !== tab.id) {
          throw new Error("截图被中断：请在截图完成前保持原网页为当前标签页");
        }

        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: "png"
        });
        await addScreenshotTile(session.sessionId, { ...state, dataUrl });
        tileCount += 1;
        totalHeight = Math.max(totalHeight, state.scrollHeight);

        if (state.atBottom) {
          const measured = await callContentCapture(
            tab.id,
            "measureScreenshotCapture",
            [session.sessionId, SCREENSHOT_RENDER_SETTLE_MS]
          );
          totalHeight = Math.max(totalHeight, measured.scrollHeight);
          if (measured.scrollHeight <= state.scrollHeight + 1) {
            reachedEnd = true;
            break;
          }
        }

        nextTop = Math.min(
          state.scrollTop + state.clientHeight,
          Math.max(0, totalHeight - state.clientHeight)
        );
        // captureVisibleTab 每秒最多调用两次。
        await wait(550);
      }
      if (!tileCount) throw new Error("浏览器没有捕获到截图画面");
      stitched = await finishScreenshotStitchSession(session.sessionId, totalHeight);
      offscreenOpen = false;
    } finally {
      await callContentCapture(
        tab.id,
        "finishScreenshotCapture",
        [session.sessionId, session.originalScrollTop]
      ).catch(error => {
        console.warn("[capture-screenshot] failed to restore scroll position", error);
      });
      if (offscreenOpen) await chrome.offscreen.closeDocument().catch(() => {});
    }

    const { filename, downloadId } = await downloadScreenshotPdf(
      stitched.dataUrl,
      tab.title
    );

    console.info("[capture-screenshot] download created", {
      tabId: tab.id,
      downloadId,
      pageCount: stitched.pageCount,
      tileCount,
      width: stitched.width,
      height: stitched.height,
      effectiveCssScale: stitched.effectiveCssScale,
      reachedEnd
    });
    return {
      downloadId,
      filename,
      fileCount: 1,
      pageCount: stitched.pageCount,
      width: stitched.width,
      height: stitched.height,
      tileCount,
      reachedEnd
    };
  });
}

async function validateSourceTab(request) {
  if (!Number.isInteger(request.tabId)) {
    throw new Error("找不到当前网页，请关闭菜单后重试");
  }
  const tab = await chrome.tabs.get(request.tabId);
  if (!/^https?:/.test(tab.url || "")) {
    throw new Error("当前页面不支持该操作");
  }
  if (request.expectedUrl && comparableUrl(tab.url) !== comparableUrl(request.expectedUrl)) {
    throw new Error("网页已跳转，请重新打开工具菜单");
  }
  return tab;
}

async function runExclusive(tabId, label, task) {
  if (activeTasks.has(tabId)) {
    throw new Error(`该网页已有任务运行中，请等待完成后再执行${label}`);
  }
  activeTasks.add(tabId);
  try {
    return await task();
  } finally {
    activeTasks.delete(tabId);
  }
}

async function callContentCapture(tabId, method, args = []) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: (methodName, methodArgs) => {
      const api = globalThis.__markdownifyCaptureApi;
      if (!api?.[methodName]) throw new Error(`页面采集器不可用：${methodName}`);
      return api[methodName](...methodArgs);
    },
    args: [method, args]
  });
  return result;
}

async function openScreenshotStitchSession(sessionId) {
  await ensureOffscreenDocument();
  const result = await chrome.runtime.sendMessage({
    type: STITCH_INIT_REQUEST,
    sessionId
  });
  if (!result?.ok) throw new Error(result?.error || "截图拼接器初始化失败");
}

async function addScreenshotTile(sessionId, tile) {
  const result = await chrome.runtime.sendMessage({
    type: STITCH_TILE_REQUEST,
    sessionId,
    tile
  });
  if (!result?.ok) throw new Error(result?.error || "截图分片保存失败");
}

async function finishScreenshotStitchSession(sessionId, totalHeight) {
  let result;
  try {
    result = await chrome.runtime.sendMessage({
      type: STITCH_REQUEST,
      sessionId,
      totalHeight
    });
    if (!result?.ok) throw new Error(result?.error || "截图拼接失败");
    return result;
  } finally {
    await chrome.offscreen.closeDocument().catch(() => {});
  }
}

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL("offscreen.html");
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [offscreenUrl]
    });
    if (!contexts.length) await createOffscreenDocument();
  } else {
    await createOffscreenDocument();
  }
}

async function createOffscreenDocument() {
  try {
    await chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["BLOBS"],
      justification: "拼接滚动页面截图并生成本地 PDF"
    });
  } catch (error) {
    if (!/single offscreen document/i.test(error?.message || "")) throw error;
  }
}

function comparableUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch (_) {
    return url || "";
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function buildScreenshotPdfFilename(title) {
  let safeTitle = String(title || "webpage")
    .normalize("NFKC")
    // Chrome 会拒绝双向控制符、零宽字符等 Unicode 控制/格式字符。
    .replace(/[\p{Cc}\p{Cf}\p{Cs}]/gu, "")
    .replace(/[<>:"/\\|?*]/g, "_")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/^\.+|[. ]+$/g, "");
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(safeTitle)) {
    safeTitle = `webpage-${safeTitle}`;
  }
  safeTitle = truncateUtf8(safeTitle, 160).replace(/[. ]+$/g, "") || "webpage";
  const stamp = screenshotTimestamp();
  return `拾作/${safeTitle}-${stamp}.pdf`;
}

function truncateUtf8(value, maxBytes) {
  const encoder = new TextEncoder();
  let bytes = 0;
  let result = "";
  for (const character of value) {
    const length = encoder.encode(character).length;
    if (bytes + length > maxBytes) break;
    result += character;
    bytes += length;
  }
  return result;
}

function screenshotTimestamp() {
  return new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
}

async function downloadScreenshotPdf(dataUrl, title) {
  const filename = buildScreenshotPdfFilename(title);
  try {
    const downloadId = await chrome.downloads.download({
      url: dataUrl,
      filename,
      saveAs: true
    });
    return { filename, downloadId };
  } catch (error) {
    if (!/invalid filename/i.test(error?.message || "")) throw error;

    // 极端站点标题仍被平台拒绝时，使用纯 ASCII 文件名兜底，不让截图结果丢失。
    const fallbackFilename = `拾作-${screenshotTimestamp()}.pdf`;
    console.warn("[capture-screenshot] retrying with fallback filename", {
      rejectedFilename: filename,
      fallbackFilename
    });
    const downloadId = await chrome.downloads.download({
      url: dataUrl,
      filename: fallbackFilename,
      saveAs: true
    });
    return { filename: fallbackFilename, downloadId };
  }
}

// 注入到页面上下文执行
function extractArticle() {
  function cleanClone(root) {
    const clone = root.cloneNode(true);
    clone.querySelectorAll("script,style,noscript,iframe,svg,canvas,link,meta")
         .forEach(n => n.remove());
    return clone;
  }

  // 先尝试 Readability
  try {
    const docClone = document.cloneNode(true);
    // 同步剔除噪声节点，避免污染正文识别
    docClone.querySelectorAll("script,style,noscript,iframe,svg,canvas")
            .forEach(n => n.remove());
    const article = new Readability(docClone, { keepClasses: false }).parse();
    if (article && article.content) {
      return {
        mode: "readability",
        title: article.title || document.title,
        byline: article.byline || "",
        excerpt: article.excerpt || "",
        html: article.content,
        textLength: article.textContent?.length || 0
      };
    }
  } catch (_) { /* fall through */ }

  // Fallback：清理后整 body
  const clone = cleanClone(document.body);
  return {
    mode: "fallback",
    title: document.title,
    html: clone.innerHTML,
    textLength: clone.innerText?.length || 0
  };
}
