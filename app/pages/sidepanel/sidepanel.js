const db = globalThis.PageDockDB;
const inboxListEl = document.getElementById("inboxList");
const inboxCountEl = document.getElementById("inboxCount");
const quickTextEl = document.getElementById("quickText");
const batchBarEl = document.getElementById("batchBar");
const selectedCountEl = document.getElementById("selectedCount");
const targetBoardEl = document.getElementById("targetBoard");
const selectAllEl = document.getElementById("selectAll");
const noticeEl = document.getElementById("notice");
const messageSource = db.makeId("sidepanel");
const CODEX_PAGE_CONTEXT_REQUEST = "pagedock-codex-page-context";
const CODEX_PAGE_ATTACHMENT_KEY = "__pagedock_codex_page_attachment_v1__";
const extensionVersion = chrome.runtime.getManifest().version;

let currentItems = [];
let currentBoards = [];
let selectedIds = new Set();
let showArchived = false;
let rendering;

function setNotice(message = "", isError = false) {
  noticeEl.textContent = String(message || "");
  noticeEl.dataset.state = isError ? "error" : "default";
}

function setBatchBusy(busy) {
  ["moveSelected", "archiveSelected", "restoreSelected", "deleteSelected"]
    .forEach(id => { document.getElementById(id).disabled = busy; });
  targetBoardEl.disabled = busy;
  selectAllEl.disabled = busy;
}

function labelForItem(item) {
  return item.text || item.alt || item.source?.title || item.src || "未命名内容";
}

function openBoard(boardId) {
  chrome.tabs.create({ url: chrome.runtime.getURL(`app/pages/whiteboard/index.html?board=${encodeURIComponent(boardId)}`) });
}

function emptyState(text) {
  const element = document.createElement("div");
  element.className = "empty";
  element.textContent = text;
  return element;
}

function notifyDataChanged(boardIds, reason) {
  chrome.runtime.sendMessage({
    type: "pagedock-data-changed",
    boardIds,
    reason,
    source: messageSource
  }).catch(() => {});
}

function updateSelectionUi() {
  selectedIds = new Set([...selectedIds].filter(id => currentItems.some(item => item.id === id)));
  const count = selectedIds.size;
  batchBarEl.classList.toggle("hidden", !count);
  selectedCountEl.textContent = `已选 ${count} 项`;
  selectAllEl.textContent = currentItems.length && count === currentItems.length ? "取消全选" : "全选";
  document.getElementById("moveSelected").disabled = !count || showArchived || !targetBoardEl.value;
  document.getElementById("archiveSelected").hidden = showArchived;
  document.getElementById("restoreSelected").hidden = !showArchived;
  inboxListEl.querySelectorAll(".item").forEach(row => {
    const selected = selectedIds.has(row.dataset.itemId);
    row.classList.toggle("selected", selected);
    const checkbox = row.querySelector(".item-check");
    if (checkbox) checkbox.checked = selected;
  });
}

function createInboxItem(item) {
  const row = document.createElement("article");
  row.className = "item";
  row.dataset.itemId = item.id;

  const checkbox = document.createElement("input");
  checkbox.className = "item-check";
  checkbox.type = "checkbox";
  checkbox.setAttribute("aria-label", `选择 ${labelForItem(item)}`);
  checkbox.addEventListener("click", event => event.stopPropagation());
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) selectedIds.add(item.id);
    else selectedIds.delete(item.id);
    updateSelectionUi();
  });

  const copy = document.createElement("div");
  copy.className = "item-copy";
  const title = document.createElement("strong");
  title.textContent = labelForItem(item).replace(/\s+/g, " ").slice(0, 100);
  const footer = document.createElement("div");
  footer.className = "item-footer";
  const source = document.createElement("span");
  source.textContent = item.source?.title || item.source?.url
    || (item.type === "image" ? "图片" : item.type === "video" ? "视频" : "手动添加");
  footer.appendChild(source);
  if (/^https?:\/\//i.test(item.source?.url || "")) {
    const link = document.createElement("a");
    link.className = "source-link";
    link.href = item.source.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "打开来源 ↗";
    link.title = item.source.url;
    link.addEventListener("click", event => event.stopPropagation());
    footer.appendChild(link);
  }
  copy.append(title, footer);
  row.append(checkbox, copy);
  row.addEventListener("click", event => {
    if (event.target.closest("a,input")) return;
    if (selectedIds.size) {
      if (selectedIds.has(item.id)) selectedIds.delete(item.id);
      else selectedIds.add(item.id);
      updateSelectionUi();
      return;
    }
    openBoard(db.INBOX_ID);
  });
  return row;
}

function renderBoardTargets() {
  const selectable = currentBoards.filter(board => board.id !== db.INBOX_ID);
  const previous = targetBoardEl.value;
  targetBoardEl.replaceChildren();
  if (!selectable.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "暂无目标白板";
    targetBoardEl.appendChild(option);
  } else {
    selectable.forEach(board => {
      const option = document.createElement("option");
      option.value = board.id;
      option.textContent = board.name;
      targetBoardEl.appendChild(option);
    });
    if (selectable.some(board => board.id === previous)) targetBoardEl.value = previous;
  }
}

async function render() {
  if (rendering) await rendering;
  rendering = (async () => {
    const [items, boards] = await Promise.all([
      db.listBoardItems(db.INBOX_ID, { archived: showArchived }),
      db.listBoards()
    ]);
    currentItems = items;
    currentBoards = boards;
    inboxListEl.replaceChildren();
    inboxCountEl.textContent = `${items.length} 项${showArchived ? "已归档" : "待整理"}`;
    items.forEach(item => inboxListEl.appendChild(createInboxItem(item)));
    if (!items.length) {
      inboxListEl.appendChild(emptyState(showArchived
        ? "还没有已归档内容"
        : "右键网页中的文字、图片或链接即可收集"));
    }

    renderBoardTargets();
    updateSelectionUi();
  })();
  try {
    await rendering;
  } finally {
    rendering = undefined;
  }
}

async function runBatch(action, reason, boardIds) {
  const ids = [...selectedIds];
  if (!ids.length) return;
  setNotice();
  setBatchBusy(true);
  try {
    await action(ids);
    selectedIds.clear();
    notifyDataChanged(boardIds, reason);
    await render();
  } catch (error) {
    console.error(`[pagedock-sidepanel] ${reason} failed`, error);
    setNotice(error?.message || "批量操作失败，请重试", true);
  } finally {
    setBatchBusy(false);
    updateSelectionUi();
  }
}

async function addQuickText() {
  const text = quickTextEl.value.trim();
  if (!text) return;
  const button = document.getElementById("quickAdd");
  button.disabled = true;
  button.dataset.state = "loading";
  setNotice();
  try {
    const isLink = /^https?:\/\/\S+$/i.test(text);
    await db.addItem(db.INBOX_ID, {
      type: isLink ? "link" : "text",
      text,
      src: isLink ? text : ""
    });
    quickTextEl.value = "";
    notifyDataChanged([db.INBOX_ID], "quick-add");
    await render();
  } catch (error) {
    setNotice(error?.message || "内容未能保存，请重试", true);
  } finally {
    button.disabled = false;
    button.dataset.state = "default";
  }
}

document.getElementById("quickAdd").addEventListener("click", addQuickText);
quickTextEl.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    addQuickText();
  }
});
document.getElementById("openCodex").addEventListener("click", async event => {
  const button = event.currentTarget;
  button.disabled = true;
  button.textContent = "读取中…";
  setNotice();
  try {
    const response = await chrome.runtime.sendMessage({ type: CODEX_PAGE_CONTEXT_REQUEST });
    if (!response?.ok) throw new Error(response?.error || "无法读取当前网页");
    await chrome.storage.local.set({
      [CODEX_PAGE_ATTACHMENT_KEY]: {
        title: String(response.title || "当前网页").slice(0, 200),
        url: String(response.url || "").slice(0, 2000),
        content: String(response.content || "").slice(0, 80_000),
        createdAt: Date.now()
      }
    });
    await chrome.tabs.create({ url: chrome.runtime.getURL("app/pages/whiteboard/index.html?codex=page") });
  } catch (error) {
    console.error("[pagedock-sidepanel] attach page to Codex failed", error);
    setNotice(error?.message || "无法读取当前网页，请刷新页面后重试", true);
  } finally {
    button.disabled = false;
    button.textContent = "问 Codex";
  }
});
document.getElementById("activeTab").addEventListener("click", async () => {
  showArchived = false;
  selectedIds.clear();
  document.getElementById("activeTab").classList.add("active");
  document.getElementById("archivedTab").classList.remove("active");
  document.getElementById("activeTab").setAttribute("aria-pressed", "true");
  document.getElementById("archivedTab").setAttribute("aria-pressed", "false");
  await render();
});
document.getElementById("archivedTab").addEventListener("click", async () => {
  showArchived = true;
  selectedIds.clear();
  document.getElementById("archivedTab").classList.add("active");
  document.getElementById("activeTab").classList.remove("active");
  document.getElementById("archivedTab").setAttribute("aria-pressed", "true");
  document.getElementById("activeTab").setAttribute("aria-pressed", "false");
  await render();
});
selectAllEl.addEventListener("click", () => {
  if (selectedIds.size === currentItems.length) selectedIds.clear();
  else selectedIds = new Set(currentItems.map(item => item.id));
  updateSelectionUi();
});
targetBoardEl.addEventListener("change", updateSelectionUi);
document.addEventListener("pointerdown", event => {
  if (event.target.closest?.(".item,button,input,select,a")) return;
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  if (selectedIds.size) {
    selectedIds.clear();
    updateSelectionUi();
  }
});
document.addEventListener("keydown", event => {
  if (event.key !== "Escape") return;
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  selectedIds.clear();
  updateSelectionUi();
});
document.getElementById("moveSelected").addEventListener("click", () => {
  const targetBoardId = targetBoardEl.value;
  if (!targetBoardId) return;
  runBatch(
    ids => db.moveItems(ids, targetBoardId),
    "move-items",
    [db.INBOX_ID, targetBoardId]
  );
});
document.getElementById("archiveSelected").addEventListener("click", () => {
  runBatch(ids => db.setItemsArchived(ids, true), "archive-items", [db.INBOX_ID]);
});
document.getElementById("restoreSelected").addEventListener("click", () => {
  runBatch(ids => db.setItemsArchived(ids, false), "restore-items", [db.INBOX_ID]);
});
document.getElementById("deleteSelected").addEventListener("click", () => {
  if (!confirm(`确定永久删除选中的 ${selectedIds.size} 项吗？此操作无法撤销。`)) return;
  runBatch(ids => db.deleteItems(db.INBOX_ID, ids), "delete-items", [db.INBOX_ID]);
});
chrome.runtime.onMessage.addListener(message => {
  if (message?.type === "pagedock-data-changed" && message.source !== messageSource) {
    render().catch(error => setNotice(error?.message || "收件箱刷新失败", true));
  }
});
window.addEventListener("focus", () => {
  render().catch(error => setNotice(error?.message || "收件箱刷新失败", true));
});

document.getElementById("versionMeta").textContent = `收件箱 · v${extensionVersion}`;
db.ensureInbox().then(render).catch(error => {
  console.error("[pagedock-sidepanel] load failed", error);
  inboxListEl.replaceChildren(emptyState("收件箱载入失败"));
  setNotice(error?.message || "收件箱载入失败，请重新打开侧栏", true);
});
