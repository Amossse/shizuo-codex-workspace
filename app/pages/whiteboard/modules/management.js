// Module: templates, revisions, health checks, and provenance management.
function managementEmpty(text) {
  const empty = document.createElement("div");
  empty.className = "empty-home";
  empty.textContent = text;
  return empty;
}

function updateWorkflowTemplateEntry(count) {
  const total = Math.max(0, Number(count) || 0);
  homeTemplatesEl.textContent = ui("模板库 · {0}", total);
  homeTemplatesEl.title = total ? ui("查看 {0} 个工作流模板", total) : ui("暂无模板，可先新建或打开白板后保存");
  homeTemplatesEl.setAttribute("aria-label", total ? ui("模板库，{0} 个模板", total) : ui("模板库，暂无模板"));
}

function createWorkflowTemplateEmpty() {
  const empty = managementEmpty("");
  empty.classList.add("template-empty");
  const title = document.createElement("strong");
  title.textContent = ui("暂无工作流模板");
  const detail = document.createElement("span");
  detail.textContent = currentBoard
    ? ui("填写上方名称，将当前白板保存为可复用模板。")
    : ui("新建或打开一块白板后，可从右上角“更多”中保存为模板。");
  empty.append(title, detail);
  if (!currentBoard) {
    const create = document.createElement("button");
    create.type = "button";
    create.className = "button primary";
    create.textContent = ui("新建白板");
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
  workflowTemplateCountEl.textContent = ui("{0} 个", templates.length);
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
    name.textContent = template.name || ui("未命名工作流");
    const detail = document.createElement("span");
    detail.textContent = ui("{0} 张卡片 · {1}", (template.cards || []).length, formatTime(template.updatedAt || template.createdAt));
    copy.append(name, detail);
    const actions = document.createElement("div");
    actions.className = "management-row-actions";
    const create = document.createElement("button");
    create.type = "button";
    create.textContent = ui("新建白板");
    create.addEventListener("click", async () => {
      create.disabled = true;
      try {
        const board = await db.createBoardFromTemplate(template.id);
        workflowTemplateDialogEl.close();
        notifyDataChanged([board.id], "template-instantiate");
        await openBoard(board.id);
      } catch (error) {
        setStatus(error?.message || ui("从模板创建失败"), true);
        create.disabled = false;
      }
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "danger";
    remove.textContent = ui("删除");
    remove.addEventListener("click", async () => {
      if (!confirm(ui("删除工作流模板“{0}”吗？", template.name))) return;
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
  workflowTemplateNameEl.value = currentBoard ? ui("{0} 工作流", currentBoard.name) : "";
  if (!workflowTemplateDialogEl.open) workflowTemplateDialogEl.showModal();
  try {
    await renderWorkflowTemplates();
  } catch (error) {
    workflowTemplateListEl.replaceChildren(managementEmpty(error?.message || ui("模板库读取失败")));
  }
}

async function saveCurrentWorkflowTemplate() {
  if (!currentBoard) return;
  await flushSave();
  const name = workflowTemplateNameEl.value.trim() || ui("{0} 工作流", currentBoard.name);
  const cardIds = selectedIds.size ? [...selectedIds] : undefined;
  const template = await db.saveTemplateFromBoard(currentBoard.id, {
    name,
    cardIds,
    description: selectedIds.size ? ui("来自 {0} 的所选卡片", currentBoard.name) : ui("来自 {0}", currentBoard.name)
  });
  setStatus(ui("已保存工作流模板“{0}”", template.name));
  await renderWorkflowTemplates();
}

async function openVersionHistory() {
  if (!currentBoard) return;
  await flushSave();
  versionHistoryListEl.replaceChildren(managementEmpty(ui("正在读取版本…")));
  if (!versionHistoryDialogEl.open) versionHistoryDialogEl.showModal();
  try {
    const revisions = await db.listBoardRevisions(currentBoard.id, { limit: 100 });
    versionHistoryListEl.replaceChildren();
    if (!revisions.length) {
      versionHistoryListEl.appendChild(managementEmpty(ui("当前白板还没有可恢复版本。")));
      return;
    }
    for (const revision of revisions) {
      const row = document.createElement("div");
      row.className = "management-row";
      const copy = document.createElement("div");
      copy.className = "management-row-copy";
      const title = document.createElement("strong");
      title.textContent = ui("版本 {0} · {1}", revision.revision, revision.reason || ui("更新白板"));
      const detail = document.createElement("span");
      detail.textContent = ui("{0} · {1} 张卡片 · {2}", revision.actor?.name || ui("白板用户"), revision.changedCardCount, new Date(revision.createdAt).toLocaleString());
      copy.append(title, detail);
      const actions = document.createElement("div");
      actions.className = "management-row-actions";
      if (revision.revision < Number(currentBoard.revision || 0)) {
        const restore = document.createElement("button");
        restore.type = "button";
        restore.textContent = ui("恢复到此版本");
        restore.addEventListener("click", async () => {
          if (!confirm(ui("恢复到版本 {0}？当前状态也会作为新版本保留。", revision.revision))) return;
          restore.disabled = true;
          try {
            await db.restoreBoardRevision(currentBoard.id, revision.revision);
            versionHistoryDialogEl.close();
            notifyDataChanged([currentBoard.id], "revision-restore");
            await openBoard(currentBoard.id, false);
            setStatus(ui("已恢复到版本 {0}", revision.revision));
          } catch (error) {
            setStatus(error?.message || ui("版本恢复失败"), true);
            restore.disabled = false;
          }
        });
        actions.appendChild(restore);
      }
      row.append(copy, actions);
      versionHistoryListEl.appendChild(row);
    }
  } catch (error) {
    versionHistoryListEl.replaceChildren(managementEmpty(error?.message || ui("版本历史读取失败")));
  }
}

async function runHealthCheck() {
  healthCheckListEl.replaceChildren(managementEmpty(ui("正在检查本地连接…")));
  try {
    const snapshot = await chrome.runtime.sendMessage({ type: CODEX_STATUS_REQUEST, runtime: aiRuntime });
    const health = snapshot?.health || {};
    const videoEngines = [health.hyperframes ? "HyperFrames" : "", health.remotion ? "Remotion" : ""].filter(Boolean);
    const checks = [
      [ui("扩展页面"), true, ui("当前页面运行正常"), true],
      ["Native Host", health.nativeHost, health.nativeHost ? ui("版本 {0}", health.nativeHostVersion || "unknown") : ui("未连接；请运行 ./install.sh --core"), true],
      ["Codex CLI", health.codex, health.codex ? ui("已就绪") : ui("未找到或未登录"), aiRuntime === "codex"],
      ["AGY CLI", health.agy, health.agy ? ui("已就绪") : ui("未找到或未登录"), aiRuntime === "agy"],
      ["Claude Code CLI", health.claude, health.claude ? ui("已就绪") : ui("未找到或未登录"), aiRuntime === "claude"],
      [ui("交互终端"), health.terminal, health.terminal ? ui("已就绪") : ui("可选；运行 ./install.sh --terminal"), false],
      [ui("视频创作"), videoEngines.length > 0, videoEngines.length ? ui("{0} 已就绪", videoEngines.join("、")) : ui("可选；运行 ./install.sh --video"), false],
      [ui("MCP 桥接"), health.bridge, health.bridge ? `${health.bridgeScope || "local"} · ${health.bridgePort || ""}` : ui("未启用"), false]
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
    healthCheckListEl.replaceChildren(managementEmpty(ui("健康检查失败：{0}", error?.message || ui("无法连接扩展后台"))));
  }
}

function openHealthCheck() {
  if (!healthCheckDialogEl.open) healthCheckDialogEl.showModal();
  runHealthCheck();
}

function connectionGuideStep(title, detail) {
  const step = document.createElement("li");
  const copy = document.createElement("div");
  const heading = document.createElement("strong");
  const description = document.createElement("span");
  heading.textContent = title;
  description.textContent = detail;
  copy.append(heading, description);
  step.append(copy);
  return step;
}

function openConnectionGuide({ snapshot = lastCodexStatusSnapshot, resume } = {}) {
  // 首次执行未就绪时在这里承接，避免先把用户的任务标成失败。
  if (typeof resume === "function") pendingConnectionAction = resume;
  const health = snapshot?.health || {};
  const bridgeInstalled = Boolean(health.nativeHost);
  const runtimeReady = Boolean(health[aiRuntime]);
  const runtimeName = aiRuntimeLabel();
  const extensionId = chrome.runtime.id;
  const installCommand = `PAGEDOCK_EXTENSION_ID=${extensionId} ./install.sh --core`;
  connectionGuideStepsEl.replaceChildren();
  if (!bridgeInstalled) {
    connectionGuideTitleEl.textContent = ui("先连接本地 {0}", runtimeName);
    connectionGuideIntroEl.textContent = ui("只需完成一次设置。完成后会自动继续刚才的任务。");
    connectionGuideStepsEl.append(
      connectionGuideStep(ui("加载拾作扩展"), ui("打开 chrome://extensions，开启开发者模式并加载解压后的拾作文件夹。")),
      connectionGuideStep(ui("运行安装命令"), ui("复制下方命令，在该文件夹的终端中运行。命令已包含当前扩展 ID。")),
      connectionGuideStep(ui("重新加载扩展"), ui("回到 chrome://extensions 点击拾作的重新加载，再回来检查连接。"))
    );
    connectionGuideCommandEl.hidden = false;
    connectionGuideCommandTextEl.textContent = installCommand;
  } else if (!runtimeReady) {
    connectionGuideTitleEl.textContent = ui("完成 {0} 登录", runtimeName);
    connectionGuideIntroEl.textContent = ui("本地桥接已就绪，只差命令行登录。完成后会自动继续刚才的任务。");
    connectionGuideStepsEl.append(
      connectionGuideStep(ui("打开 {0} CLI", runtimeName), ui("在终端运行 {0} 并按提示完成登录。", aiRuntimeCommand())),
      connectionGuideStep(ui("回到拾作检查连接"), ui("登录完成后无需重新创建任务。"))
    );
    connectionGuideCommandEl.hidden = true;
  } else {
    connectionGuideTitleEl.textContent = ui("{0} 正在连接", runtimeName);
    connectionGuideIntroEl.textContent = ui("请稍候，然后检查连接。");
    connectionGuideCommandEl.hidden = true;
  }
  connectionGuideStatusEl.textContent = "";
  if (!connectionGuideDialogEl.open) connectionGuideDialogEl.showModal();
}

async function checkConnectionGuide() {
  connectionGuideStatusEl.textContent = ui("正在检查本地连接…");
  await connectCodexChat();
  if (!codexChatReady) {
    openConnectionGuide({ snapshot: lastCodexStatusSnapshot });
    connectionGuideStatusEl.textContent = codexConnectionHint || ui("暂时还未连接，请完成上面的步骤后重试。");
    return;
  }
  connectionGuideDialogEl.close();
  connectionGuideStatusEl.textContent = "";
  const resume = pendingConnectionAction;
  pendingConnectionAction = null;
  if (resume) {
    setStatus(ui("本地 Codex 已连接，正在继续刚才的任务。"));
    await resume();
  } else {
    setStatus(ui("本地 Codex 已连接，可以开始执行任务。"));
  }
}

function openProvenance(item) {
  const provenance = item?.provenance || {};
  provenanceSummaryEl.textContent = ui("卡片版本 {0} · {1}", item?.revision || 1, provenance.operation || "manual");
  provenanceChainEl.replaceChildren();
  if (provenance.template?.id) {
    const row = document.createElement("div");
    row.className = "management-row";
    row.textContent = ui("工作流模板 · {0}", provenance.template.name || provenance.template.id);
    provenanceChainEl.appendChild(row);
  }
  for (const parent of provenance.parents || []) {
    const row = document.createElement("div");
    row.className = "management-row";
    const copy = document.createElement("div");
    copy.className = "management-row-copy";
    const title = document.createElement("strong");
    title.textContent = parent.kind === "external" ? (parent.title || ui("网页来源")) : ui("上游卡片 · {0}", parent.cardId);
    const detail = document.createElement("span");
    detail.textContent = parent.kind === "external" ? parent.url : ui("{0} · 版本 {1}", parent.boardId || currentBoard?.id, parent.cardRevision || ui("未知"));
    copy.append(title, detail);
    const actions = document.createElement("div");
    actions.className = "management-row-actions";
    const open = document.createElement("button");
    open.type = "button";
    open.textContent = ui("打开");
    open.addEventListener("click", () => {
      provenanceDialogEl.close();
      if (parent.kind === "external") window.open(parent.url, "_blank", "noopener,noreferrer");
      else focusExternalActivity({ boardId: parent.boardId || currentBoard?.id, cardId: parent.cardId });
    });
    actions.appendChild(open);
    row.append(copy, actions);
    provenanceChainEl.appendChild(row);
  }
  if (!provenanceChainEl.children.length) provenanceChainEl.appendChild(managementEmpty(ui("此卡片由用户直接创建，没有上游来源。")));
  provenanceDialogEl.showModal();
}
