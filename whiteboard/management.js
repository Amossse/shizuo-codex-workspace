// Module: templates, revisions, health checks, and provenance management.
function managementEmpty(text) {
  const empty = document.createElement("div");
  empty.className = "empty-home";
  empty.textContent = text;
  return empty;
}

function updateWorkflowTemplateEntry(count) {
  const total = Math.max(0, Number(count) || 0);
  homeTemplatesEl.textContent = `模板库 · ${total}`;
  homeTemplatesEl.title = total ? `查看 ${total} 个工作流模板` : "暂无模板，可先新建或打开白板后保存";
  homeTemplatesEl.setAttribute("aria-label", total ? `模板库，${total} 个模板` : "模板库，暂无模板");
}

function createWorkflowTemplateEmpty() {
  const empty = managementEmpty("");
  empty.classList.add("template-empty");
  const title = document.createElement("strong");
  title.textContent = "暂无工作流模板";
  const detail = document.createElement("span");
  detail.textContent = currentBoard
    ? "填写上方名称，将当前白板保存为可复用模板。"
    : "新建或打开一块白板后，可从右上角“更多”中保存为模板。";
  empty.append(title, detail);
  if (!currentBoard) {
    const create = document.createElement("button");
    create.type = "button";
    create.className = "button primary";
    create.textContent = "新建白板";
    create.addEventListener("click", () => {
      workflowTemplateDialogEl.close();
      openCreateBoardDialog();
    });
    empty.appendChild(create);
  }
  return empty;
}

async function renderWorkflowTemplates() {
  const templates = await db.listTemplates();
  workflowTemplateCountEl.textContent = `${templates.length} 个`;
  updateWorkflowTemplateEntry(templates.length);
  workflowTemplateListEl.replaceChildren();
  if (!templates.length) {
    workflowTemplateListEl.appendChild(createWorkflowTemplateEmpty());
    return;
  }
  for (const template of templates) {
    const row = document.createElement("div");
    row.className = "management-row";
    const copy = document.createElement("div");
    copy.className = "management-row-copy";
    const name = document.createElement("strong");
    name.textContent = template.name || "未命名工作流";
    const detail = document.createElement("span");
    detail.textContent = `${(template.cards || []).length} 张卡片 · ${formatTime(template.updatedAt || template.createdAt)}`;
    copy.append(name, detail);
    const actions = document.createElement("div");
    actions.className = "management-row-actions";
    const create = document.createElement("button");
    create.type = "button";
    create.textContent = "新建白板";
    create.addEventListener("click", async () => {
      create.disabled = true;
      try {
        const board = await db.createBoardFromTemplate(template.id);
        workflowTemplateDialogEl.close();
        notifyDataChanged([board.id], "template-instantiate");
        await openBoard(board.id);
      } catch (error) {
        setStatus(error?.message || "从模板创建失败", true);
        create.disabled = false;
      }
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = "删除";
    remove.addEventListener("click", async () => {
      if (!confirm(`删除工作流模板“${template.name}”吗？`)) return;
      await db.deleteTemplate(template.id);
      await renderWorkflowTemplates();
    });
    actions.append(create, remove);
    row.append(copy, actions);
    workflowTemplateListEl.appendChild(row);
  }
}

async function openWorkflowTemplates() {
  templateSaveSectionEl.hidden = !currentBoard;
  workflowTemplateNameEl.value = currentBoard ? `${currentBoard.name} 工作流` : "";
  if (!workflowTemplateDialogEl.open) workflowTemplateDialogEl.showModal();
  try {
    await renderWorkflowTemplates();
  } catch (error) {
    workflowTemplateListEl.replaceChildren(managementEmpty(error?.message || "模板库读取失败"));
  }
}

async function saveCurrentWorkflowTemplate() {
  if (!currentBoard) return;
  await flushSave();
  const name = workflowTemplateNameEl.value.trim() || `${currentBoard.name} 工作流`;
  const cardIds = selectedIds.size ? [...selectedIds] : undefined;
  const template = await db.saveTemplateFromBoard(currentBoard.id, {
    name,
    cardIds,
    description: selectedIds.size ? `来自 ${currentBoard.name} 的所选卡片` : `来自 ${currentBoard.name}`
  });
  setStatus(`已保存工作流模板“${template.name}”`);
  await renderWorkflowTemplates();
}

async function openVersionHistory() {
  if (!currentBoard) return;
  await flushSave();
  versionHistoryListEl.replaceChildren(managementEmpty("正在读取版本…"));
  if (!versionHistoryDialogEl.open) versionHistoryDialogEl.showModal();
  try {
    const revisions = await db.listBoardRevisions(currentBoard.id, { limit: 100 });
    versionHistoryListEl.replaceChildren();
    if (!revisions.length) {
      versionHistoryListEl.appendChild(managementEmpty("当前白板还没有可恢复版本。"));
      return;
    }
    for (const revision of revisions) {
      const row = document.createElement("div");
      row.className = "management-row";
      const copy = document.createElement("div");
      copy.className = "management-row-copy";
      const title = document.createElement("strong");
      title.textContent = `版本 ${revision.revision} · ${revision.reason || "更新白板"}`;
      const detail = document.createElement("span");
      detail.textContent = `${revision.actor?.name || "白板用户"} · ${revision.changedCardCount} 张卡片 · ${new Date(revision.createdAt).toLocaleString()}`;
      copy.append(title, detail);
      const actions = document.createElement("div");
      actions.className = "management-row-actions";
      if (revision.revision < Number(currentBoard.revision || 0)) {
        const restore = document.createElement("button");
        restore.type = "button";
        restore.textContent = "恢复到此版本";
        restore.addEventListener("click", async () => {
          if (!confirm(`恢复到版本 ${revision.revision}？当前状态也会作为新版本保留。`)) return;
          restore.disabled = true;
          try {
            await db.restoreBoardRevision(currentBoard.id, revision.revision);
            versionHistoryDialogEl.close();
            notifyDataChanged([currentBoard.id], "revision-restore");
            await openBoard(currentBoard.id, false);
            setStatus(`已恢复到版本 ${revision.revision}`);
          } catch (error) {
            setStatus(error?.message || "版本恢复失败", true);
            restore.disabled = false;
          }
        });
        actions.appendChild(restore);
      }
      row.append(copy, actions);
      versionHistoryListEl.appendChild(row);
    }
  } catch (error) {
    versionHistoryListEl.replaceChildren(managementEmpty(error?.message || "版本历史读取失败"));
  }
}

async function runHealthCheck() {
  healthCheckListEl.replaceChildren(managementEmpty("正在检查本地连接…"));
  try {
    const snapshot = await chrome.runtime.sendMessage({ type: CODEX_STATUS_REQUEST, runtime: aiRuntime });
    const health = snapshot?.health || {};
    const videoEngines = [health.hyperframes ? "HyperFrames" : "", health.remotion ? "Remotion" : ""].filter(Boolean);
    const checks = [
      ["扩展页面", true, "当前页面运行正常", true],
      ["Native Host", health.nativeHost, health.nativeHost ? `版本 ${health.nativeHostVersion || "unknown"}` : "未连接；请运行 ./install.sh --core", true],
      ["Codex CLI", health.codex, health.codex ? "已就绪" : "未找到或未登录", aiRuntime === "codex"],
      ["AGY CLI", health.agy, health.agy ? "已就绪" : "未找到或未登录", aiRuntime === "agy"],
      ["交互终端", health.terminal, health.terminal ? "已就绪" : "可选；运行 ./install.sh --terminal", false],
      ["视频创作", videoEngines.length > 0, videoEngines.length ? `${videoEngines.join("、")} 已就绪` : "可选；运行 ./install.sh --video", false],
      ["MCP 桥接", health.bridge, health.bridge ? `${health.bridgeScope || "local"} · ${health.bridgePort || ""}` : "未启用", false]
    ];
    healthCheckListEl.replaceChildren();
    for (const [label, passed, detail, required] of checks) {
      const row = document.createElement("div");
      row.className = "health-row";
      row.dataset.state = passed ? "pass" : required ? "fail" : "warn";
      const mark = document.createElement("span");
      mark.className = "health-mark";
      mark.textContent = passed ? "●" : required ? "×" : "!";
      const copy = document.createElement("div");
      copy.className = "management-row-copy";
      const name = document.createElement("strong");
      name.textContent = label;
      const description = document.createElement("span");
      description.textContent = detail;
      copy.append(name, description);
      row.append(mark, copy);
      healthCheckListEl.appendChild(row);
    }
  } catch (error) {
    healthCheckListEl.replaceChildren(managementEmpty(`健康检查失败：${error?.message || "无法连接扩展后台"}`));
  }
}

function openHealthCheck() {
  if (!healthCheckDialogEl.open) healthCheckDialogEl.showModal();
  runHealthCheck();
}

function openProvenance(item) {
  const provenance = item?.provenance || {};
  provenanceSummaryEl.textContent = `卡片版本 ${item?.revision || 1} · ${provenance.operation || "manual"}`;
  provenanceChainEl.replaceChildren();
  if (provenance.template?.id) {
    const row = document.createElement("div");
    row.className = "management-row";
    row.textContent = `工作流模板 · ${provenance.template.name || provenance.template.id}`;
    provenanceChainEl.appendChild(row);
  }
  for (const parent of provenance.parents || []) {
    const row = document.createElement("div");
    row.className = "management-row";
    const copy = document.createElement("div");
    copy.className = "management-row-copy";
    const title = document.createElement("strong");
    title.textContent = parent.kind === "external" ? (parent.title || "网页来源") : `上游卡片 · ${parent.cardId}`;
    const detail = document.createElement("span");
    detail.textContent = parent.kind === "external" ? parent.url : `${parent.boardId || currentBoard?.id} · 版本 ${parent.cardRevision || "未知"}`;
    copy.append(title, detail);
    const actions = document.createElement("div");
    actions.className = "management-row-actions";
    const open = document.createElement("button");
    open.type = "button";
    open.textContent = "打开";
    open.addEventListener("click", () => {
      provenanceDialogEl.close();
      if (parent.kind === "external") window.open(parent.url, "_blank", "noopener,noreferrer");
      else focusExternalActivity({ boardId: parent.boardId || currentBoard?.id, cardId: parent.cardId });
    });
    actions.appendChild(open);
    row.append(copy, actions);
    provenanceChainEl.appendChild(row);
  }
  if (!provenanceChainEl.children.length) provenanceChainEl.appendChild(managementEmpty("此卡片由用户直接创建，没有上游来源。"));
  provenanceDialogEl.showModal();
}
