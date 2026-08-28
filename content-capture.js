(() => {
  const API_KEY = "__markdownifyCaptureApi";
  const TARGET_ATTRIBUTE = "data-markdownify-capture-target";
  const screenshotSessions = new Map();
  if (globalThis[API_KEY]) return;

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function isDocumentTarget(target) {
    return target === document.scrollingElement
      || target === document.documentElement
      || target === document.body;
  }

  function getDocumentHeight() {
    return Math.max(
      document.scrollingElement?.scrollHeight || 0,
      document.documentElement?.scrollHeight || 0,
      document.body?.scrollHeight || 0
    );
  }

  function getMetrics(target) {
    if (isDocumentTarget(target)) {
      return {
        scrollTop: window.scrollY,
        scrollHeight: getDocumentHeight(),
        clientHeight: Math.max(window.innerHeight, 1)
      };
    }
    return {
      scrollTop: target.scrollTop,
      scrollHeight: target.scrollHeight,
      clientHeight: Math.max(target.clientHeight, 1)
    };
  }

  function setScrollTop(target, top) {
    if (isDocumentTarget(target)) {
      window.scrollTo(window.scrollX, top);
    } else {
      target.scrollTop = top;
    }
  }

  function findScrollTarget() {
    const documentTarget = document.scrollingElement || document.documentElement;
    const candidates = [documentTarget];
    document.querySelectorAll("*").forEach(element => {
      if (element === documentTarget || element.clientHeight < 200) return;
      const style = getComputedStyle(element);
      if (!["auto", "scroll"].includes(style.overflowY)) return;
      if (element.scrollHeight <= element.clientHeight + 40) return;
      candidates.push(element);
    });

    let best = documentTarget;
    let bestScore = -1;
    for (const candidate of candidates) {
      const metrics = getMetrics(candidate);
      const rect = isDocumentTarget(candidate)
        ? { width: window.innerWidth, height: window.innerHeight }
        : candidate.getBoundingClientRect();
      if (rect.width < 240 || rect.height < 180) continue;

      const scrollable = Math.max(0, metrics.scrollHeight - metrics.clientHeight);
      const className = String(candidate.className || "");
      const mainBoost = /bear-web-x-container|editor|document|article|main/i.test(className)
        || ["MAIN", "ARTICLE"].includes(candidate.tagName)
        ? 2
        : 1;
      const score = scrollable * Math.min(rect.width, window.innerWidth) * mainBoost;
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
    return best;
  }

  function targetDescription(target) {
    return isDocumentTarget(target)
      ? "document"
      : `${target.tagName.toLowerCase()}.${String(target.className || "")
          .trim()
          .split(/\s+/)
          .slice(0, 3)
          .join(".")}`;
  }

  async function settle(delayMs) {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await wait(delayMs);
  }

  function structuredBlocks(target) {
    let elements = [
      ...document.querySelectorAll(
        ".root-render-unit-container > .render-unit-wrapper > .block[data-block-id]"
      )
    ];
    if (!elements.length) {
      elements = [...document.querySelectorAll("[data-block-id]")].filter(element => {
        return !element.parentElement?.closest("[data-block-id]");
      });
    }

    const targetRect = isDocumentTarget(target)
      ? { top: 0 }
      : target.getBoundingClientRect();
    const { scrollTop } = getMetrics(target);
    return elements.map(element => {
      const clone = element.cloneNode(true);
      clone.querySelectorAll("script,style,noscript,iframe,meta,link").forEach(node => node.remove());
      const id = element.getAttribute("data-block-id");
      const top = element.getBoundingClientRect().top - targetRect.top + scrollTop;
      return {
        id,
        top,
        html: clone.outerHTML,
        textLength: (element.innerText || "").length
      };
    });
  }

  async function captureMarkdown(maxSteps = 200, delayMs = 120) {
    const target = findScrollTarget();
    const originalScrollTop = getMetrics(target).scrollTop;
    const blocks = new Map();
    let reachedEnd = false;
    let steps = 0;
    let nextTop = 0;
    let stableBottomChecks = 0;

    try {
      while (steps < maxSteps) {
        setScrollTop(target, nextTop);
        await settle(delayMs);
        steps += 1;

        for (const block of structuredBlocks(target)) {
          const previous = blocks.get(block.id);
          if (!previous || block.html.length > previous.html.length) {
            blocks.set(block.id, block);
          }
        }

        const metrics = getMetrics(target);
        const atBottom = metrics.scrollTop + metrics.clientHeight >= metrics.scrollHeight - 2;
        if (atBottom) {
          await wait(delayMs);
          const measured = getMetrics(target);
          if (measured.scrollHeight <= metrics.scrollHeight + 1) {
            stableBottomChecks += 1;
            if (stableBottomChecks >= 2) {
              reachedEnd = true;
              break;
            }
          } else {
            stableBottomChecks = 0;
          }
        } else {
          stableBottomChecks = 0;
        }

        nextTop = Math.min(
          metrics.scrollTop + Math.max(300, Math.floor(metrics.clientHeight * 0.75)),
          Math.max(0, metrics.scrollHeight - metrics.clientHeight)
        );
      }
    } finally {
      setScrollTop(target, originalScrollTop);
      await settle(80);
    }

    const orderedBlocks = [...blocks.values()].sort((a, b) => a.top - b.top);
    const hasStructuredDocument = orderedBlocks.length >= 5;
    return {
      mode: hasStructuredDocument ? "virtualized" : "",
      html: hasStructuredDocument
        ? `<article data-markdownify-capture="virtualized">${orderedBlocks
            .map(block => block.html)
            .join("\n")}</article>`
        : "",
      blockCount: orderedBlocks.length,
      textLength: orderedBlocks.reduce((sum, block) => sum + block.textLength, 0),
      reachedEnd,
      truncated: !reachedEnd,
      steps,
      scrollTarget: targetDescription(target)
    };
  }

  function captureCrop(target) {
    if (isDocumentTarget(target)) {
      return {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight
      };
    }
    const rect = target.getBoundingClientRect();
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(window.innerWidth, rect.right);
    const bottom = Math.min(window.innerHeight, rect.bottom);
    return {
      left,
      top,
      width: Math.max(1, right - left),
      height: Math.max(1, bottom - top)
    };
  }

  function findSessionTarget(sessionId) {
    const sessionTarget = screenshotSessions.get(sessionId)?.target;
    if (sessionTarget?.isConnected) return sessionTarget;
    const target = [...document.querySelectorAll(`[${TARGET_ATTRIBUTE}]`)]
      .find(element => element.getAttribute(TARGET_ATTRIBUTE) === sessionId);
    if (!target) throw new Error("页面截图会话已失效，请重试");
    return target;
  }

  function startScreenshotCapture() {
    const target = findScrollTarget();
    const metrics = getMetrics(target);
    const sessionId = `capture-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const repeatedOverlays = [...document.querySelectorAll("*")]
      .filter(element => {
        if (element === target || element.contains(target)) return false;
        if (!isDocumentTarget(target) && !target.contains(element)) return false;
        const position = getComputedStyle(element).position;
        return position === "fixed" || position === "sticky";
      })
      .map(element => ({
        element,
        visibility: element.style.visibility
      }));
    target.setAttribute(TARGET_ATTRIBUTE, sessionId);
    screenshotSessions.set(sessionId, { target, repeatedOverlays });
    return {
      sessionId,
      originalScrollTop: metrics.scrollTop,
      scrollHeight: metrics.scrollHeight,
      clientHeight: metrics.clientHeight,
      scrollTarget: targetDescription(target)
    };
  }

  async function scrollScreenshotCapture(sessionId, top, delayMs = 600) {
    const target = findSessionTarget(sessionId);
    const session = screenshotSessions.get(sessionId);
    session?.repeatedOverlays.forEach(item => {
      item.element.style.visibility = top > 0 ? "hidden" : item.visibility;
    });
    setScrollTop(target, top);
    await settle(delayMs);
    const metrics = getMetrics(target);
    const crop = captureCrop(target);
    const targetRect = isDocumentTarget(target)
      ? { top: 0 }
      : target.getBoundingClientRect();
    const clippedTop = Math.max(0, -targetRect.top);

    return {
      scrollTop: metrics.scrollTop,
      contentTop: metrics.scrollTop + clippedTop,
      scrollHeight: metrics.scrollHeight,
      clientHeight: metrics.clientHeight,
      visibleHeight: crop.height,
      atBottom: metrics.scrollTop + metrics.clientHeight >= metrics.scrollHeight - 2,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      crop
    };
  }

  async function measureScreenshotCapture(sessionId, delayMs = 0) {
    const target = findSessionTarget(sessionId);
    if (delayMs) await wait(delayMs);
    const metrics = getMetrics(target);
    return {
      scrollTop: metrics.scrollTop,
      scrollHeight: metrics.scrollHeight,
      clientHeight: metrics.clientHeight
    };
  }

  async function finishScreenshotCapture(sessionId, originalScrollTop) {
    const target = findSessionTarget(sessionId);
    const session = screenshotSessions.get(sessionId);
    session?.repeatedOverlays.forEach(item => {
      item.element.style.visibility = item.visibility;
    });
    screenshotSessions.delete(sessionId);
    target.removeAttribute(TARGET_ATTRIBUTE);
    setScrollTop(target, originalScrollTop);
    await settle(80);
    return true;
  }

  globalThis[API_KEY] = {
    captureMarkdown,
    startScreenshotCapture,
    scrollScreenshotCapture,
    measureScreenshotCapture,
    finishScreenshotCapture
  };
})();
