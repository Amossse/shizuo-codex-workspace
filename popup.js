const savePageButton = document.getElementById("savePage");
const saveMarkdownButton = document.getElementById("saveMarkdown");
const savePdfButton = document.getElementById("savePdf");
const openWorkspaceButton = document.getElementById("openWorkspace");
const formatMenuEl = document.getElementById("formatMenu");
const formatMenuSummaryEl = formatMenuEl.querySelector("summary");
const statusEl = document.getElementById("status");
const SAVE_FORMAT_KEY = "__pagedock_popup_save_format__";
// Resolve the current installation ID so unpacked and signed builds open their own workspace.
const WHITEBOARD_URL = chrome.runtime.getURL("whiteboard.html");
let preferredCaptureType = "capture-markdown";

function formatLabel(type) {
  return type === "capture-screenshot" ? "PDF" : "Markdown";
}

function renderPreferredFormat() {
  savePageButton.textContent = `保存当前页 · ${formatLabel(preferredCaptureType)}`;
  saveMarkdownButton.setAttribute("aria-checked", String(preferredCaptureType === "capture-markdown"));
  savePdfButton.setAttribute("aria-checked", String(preferredCaptureType === "capture-screenshot"));
}

function setBusy(busy) {
  savePageButton.disabled = busy;
  saveMarkdownButton.disabled = busy;
  savePdfButton.disabled = busy;
  openWorkspaceButton.disabled = busy;
  formatMenuEl.dataset.disabled = String(busy);
  formatMenuSummaryEl.setAttribute("aria-disabled", String(busy));
  formatMenuSummaryEl.tabIndex = busy ? -1 : 0;
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

async function runCapture(type, remember = false) {
  if (remember) {
    preferredCaptureType = type;
    renderPreferredFormat();
    chrome.storage.local.set({ [SAVE_FORMAT_KEY]: type }).catch(() => {});
  }
  formatMenuEl.open = false;
  setBusy(true);
  setStatus(type === "capture-markdown" ? "正在解析完整页面…" : "正在滚动并生成 PDF…");

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("找不到当前网页");
    const result = await chrome.runtime.sendMessage({
      type,
      tabId: tab.id,
      expectedUrl: tab.url
    });
    if (!result?.ok) throw new Error(result?.error || "操作失败");

    if (type === "capture-markdown") {
      const amount = result.blockCount
        ? `${result.blockCount} 个内容块`
        : `${result.textLength || 0} 字`;
      setStatus(`已解析 ${amount}`);
    } else {
      const warning = result.reachedEnd ? "" : "（无限滚动页可能未到终点）";
      setStatus(`已生成 1 个高清 PDF（${result.pageCount} 页）${warning}`);
    }
    setTimeout(() => window.close(), 800);
  } catch (error) {
    setStatus(error?.message || String(error), true);
    setBusy(false);
  }
}

savePageButton.addEventListener("click", () => runCapture(preferredCaptureType));
saveMarkdownButton.addEventListener("click", () => runCapture("capture-markdown", true));
savePdfButton.addEventListener("click", () => runCapture("capture-screenshot", true));
openWorkspaceButton.addEventListener("click", async () => {
  setBusy(true);
  setStatus("正在打开拾作…");
  try {
    await chrome.tabs.create({ url: WHITEBOARD_URL });
    window.close();
  } catch (error) {
    setStatus(error?.message || String(error), true);
    setBusy(false);
  }
});

document.addEventListener("pointerdown", event => {
  if (!event.target.closest?.("#formatMenu")) formatMenuEl.open = false;
});
document.addEventListener("keydown", event => {
  if (event.key !== "Escape" || !formatMenuEl.open) return;
  formatMenuEl.open = false;
  formatMenuSummaryEl.focus();
});

chrome.storage.local.get(SAVE_FORMAT_KEY).then(stored => {
  const value = stored[SAVE_FORMAT_KEY];
  if (["capture-markdown", "capture-screenshot"].includes(value)) preferredCaptureType = value;
  renderPreferredFormat();
}).catch(() => renderPreferredFormat());
