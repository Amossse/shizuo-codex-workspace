// Module: collaboration presence, approvals, and activity presentation.
async function settleExternalApproval(approval, allow, buttons, allowMode = "once") {
  buttons.forEach(button => { button.disabled = true; });
  try {
    const response = await chrome.runtime.sendMessage({
      type: BRIDGE_APPROVAL_RESPONSE,
      approvalId: approval.id,
      allow,
      allowMode
    });
    if (!response?.ok) throw new Error(response?.error || ui("操作确认失败"));
    externalCodexApprovals.delete(String(approval.id || ""));
    renderExternalCollaboration();
    setStatus(allow ? (allowMode === "session" ? ui("本次会话已允许 {0} 编辑", approval.client?.name || "Codex") : ui("已允许 {0} 执行一次", approval.client?.name || "Codex")) : ui("已拒绝外部修改"));
  } catch (error) {
    buttons.forEach(button => { button.disabled = false; });
    setStatus(error?.message || ui("操作确认失败"), true);
  }
}

function renderExternalCollaboration() {
  const available = externalCodexScope === "lan" || externalCodexConnected || externalCodexApprovals.size > 0
    || localCodexSessionsAvailable || localCodexSessionStatus.active || localPluginCodexTaskStatus || externalCodexTasks.length > 0 || externalCodexActivities.length > 0;
  const visible = available && !collaborationPanelDismissed;
  const latestSequence = Math.max(0,
    ...externalCodexActivities.map(entry => Number(entry.sequence) || 0),
    ...externalCodexTasks.map(entry => Number(entry.sequence) || 0),
    ...[...externalCodexPresence.values()].map(entry => Number(entry.sequence) || 0)
  );
  const unread = [
    ...externalCodexActivities,
    ...externalCodexTasks,
    ...externalCodexPresence.values()
  ].filter(entry => Number(entry.sequence) > collaborationLastReadSequence).length;
  if (visible && latestSequence > collaborationLastReadSequence) {
    collaborationLastReadSequence = latestSequence;
    sessionStorage.setItem("__pagedock_collaboration_last_read__", String(latestSequence));
  }
  collaborationPanelEl.hidden = !visible;
  boardCollaborationEl.disabled = !available;
  boardCollaborationEl.textContent = visible ? ui("收起协作") : ui("协作与会话{0}", unread ? ` · ${unread}` : "");
  homeCollaborationEl.disabled = !available;
  homeCollaborationEl.textContent = visible ? ui("收起协作") : ui("协作与会话{0}", unread ? ` · ${unread}` : "");
  if (!visible) return;
  collaborationSessionsEl.hidden = !localCodexSessionsAvailable;
  if (localCodexSessionsAvailable && collaborationSessionsEl.open) void loadLocalCodexSessions();
  const activeNames = externalCodexClients.map(client => String(client.name || "Codex"));
  const humanNames = externalCodexClients.filter(client => client.type === "human").map(client => String(client.name || ui("协作者")));
  const humanConnected = humanNames.length > 0;
  const activeTasks = externalCodexTasks.filter(task => EXTERNAL_TASK_ACTIVE_PHASES.has(task.phase));
  const automaticTask = localCodexSessionStatus.active ? {
    id: `local-session:${localCodexSessionStatus.threadId || "active"}`,
    phase: "running",
    title: localCodexSessionStatus.title || ui("Codex 正在工作"),
    message: localCodexSessionStatus.activeCount > 1
      ? ui("{0} 个本地 Codex 任务正在执行", localCodexSessionStatus.activeCount)
      : ui("正在执行本地 Codex 任务"),
    client: { id: "owner-local", name: ui("本地 Codex"), scope: "local" },
    createdAt: localCodexSessionStatus.startedAt,
    updatedAt: localCodexSessionStatus.updatedAt || localCodexSessionStatus.startedAt
  } : null;
  const pluginTask = localPluginCodexTaskStatus || null;
  const visibleActiveTasks = [pluginTask, automaticTask, ...activeTasks].filter(task => EXTERNAL_TASK_ACTIVE_PHASES.has(task?.phase));
  const codexConnected = codexChatReady || localCodexSessionsAvailable || externalCodexConnected || activeNames.length > 0 || localCodexSessionStatus.active || Boolean(pluginTask);
  // 已连接但当前空闲时回到待命，不再把上一次完成任务长期当作当前状态展示。
  // 插件内发起的会话有完整阶段和结果，优先于 Codex Desktop 只能提供标题的泛化状态。
  const primaryTask = pluginTask || automaticTask || activeTasks[0] || (!codexConnected ? externalCodexTasks[0] : null) || null;
  const primaryClientIsLocal = primaryTask?.client?.scope === "local" || primaryTask?.client?.id === "owner-local";
  collaborationAvatarEl.textContent = "C";
  collaborationTitleEl.textContent = humanConnected ? ui("白板协作") : activeNames.length > 1 ? ui("{0} 个 Codex", activeNames.length) : ui("Codex 工作伙伴");
  collaborationClientsEl.textContent = visibleActiveTasks.length > 1
    ? ui("{0} 个任务正在执行", visibleActiveTasks.length)
    : primaryTask?.title || (humanConnected ? ui("{0} 正在协作", humanNames.join("、")) : codexConnected ? ui("已连接，随时待命") : ui("等待接入"));
  collaborationLiveEl.textContent = primaryClientIsLocal ? ui("本机") : externalCodexScope === "lan" ? ui("内网") : codexConnected ? ui("本机") : ui("历史");

  const petState = externalTaskPetState(primaryTask);
  collaborationPetStageEl.dataset.state = petState;
  collaborationPetStatusEl.textContent = externalPetStatusText(petState, codexConnected);
  collaborationPetTitleEl.textContent = primaryTask?.title || (humanConnected ? ui("协作者已加入白板") : codexConnected ? ui("随时可以开始") : ui("等待 Codex 接入"));
  collaborationPetMessageEl.textContent = primaryTask ? externalTaskSummary(primaryTask, codexConnected) : humanConnected ? ui("对方可以实时查看白板，修改仍受你的权限设置控制") : externalTaskSummary(primaryTask, codexConnected);
  collaborationPetMetaEl.textContent = primaryTask
    ? [primaryClientIsLocal ? ui("本地 Codex") : (primaryTask.client?.name || "Codex"), formatTime(primaryTask.updatedAt || primaryTask.createdAt)].filter(Boolean).join(" · ")
    : "";
  const progress = Number(primaryTask?.progress);
  const hasProgress = primaryTask?.progress !== null && primaryTask?.progress !== undefined && Number.isFinite(progress);
  collaborationPetProgressEl.hidden = !hasProgress;
  collaborationPetProgressBarEl.style.width = hasProgress ? `${Math.min(100, Math.max(0, progress))}%` : "0%";
  if (collaborationPetResultEl.dataset.taskId !== String(primaryTask?.id || "")) {
    collaborationPetResultEl.open = false;
    collaborationPetResultEl.dataset.taskId = String(primaryTask?.id || "");
  }
  collaborationPetResultEl.hidden = !primaryTask?.result;
  collaborationPetResultContentEl.textContent = primaryTask?.result || "";
  collaborationPetActionsEl.replaceChildren();
  appendExternalTaskActions(collaborationPetActionsEl, primaryTask);

  collaborationClientControlsEl.replaceChildren();
  const manageableClients = externalCodexClients.filter(client => client.scope !== "local" && client.id !== "owner-local");
  collaborationConnectionsEl.hidden = !manageableClients.length;
  collaborationConnectionCountEl.textContent = manageableClients.length ? ui("{0} 个", manageableClients.length) : "";
  manageableClients.forEach(client => {
    const row = document.createElement("div");
    row.className = "collaboration-client-row";
    const name = document.createElement("span");
    name.textContent = client.name || "Codex";
    const policy = document.createElement("select");
    [["read", ui("只读")], ["ask", ui("每次询问")], ["edit", ui("可编辑")]].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      policy.appendChild(option);
    });
    policy.value = externalClientPolicies[client.id] || (client.type === "human" ? "edit" : "ask");
    policy.addEventListener("change", async () => {
      const response = await chrome.runtime.sendMessage({ type: BRIDGE_CLIENT_POLICY_REQUEST, clientId: client.id, policy: policy.value });
      if (!response?.ok) setStatus(response?.error || ui("权限更新失败"), true);
      else externalClientPolicies = { ...externalClientPolicies, [client.id]: policy.value };
    });
    const revoke = document.createElement("button");
    revoke.type = "button";
    revoke.className = "collaboration-client-revoke";
    revoke.textContent = ui("撤销");
    revoke.title = ui("撤销 {0} 的连接令牌", client.name || "Codex");
    revoke.addEventListener("click", async () => {
      revoke.disabled = true;
      try {
        const response = await chrome.runtime.sendMessage({ type: BRIDGE_CLIENT_REVOKE_REQUEST, clientId: client.id });
        if (!response?.ok) throw new Error(response?.error || ui("撤销失败"));
        externalCodexClients = externalCodexClients.filter(entry => entry.id !== client.id);
        externalCodexPresence.delete(client.id);
        renderExternalCollaboration();
        renderRemotePresence();
        setStatus(ui("已撤销 {0} 的连接", client.name || "Codex"));
      } catch (error) {
        revoke.disabled = false;
        setStatus(error?.message || ui("撤销接入者失败"), true);
      }
    });
    row.append(name, policy, revoke);
    collaborationClientControlsEl.appendChild(row);
  });

  collaborationApprovalsEl.replaceChildren();
  for (const approval of externalCodexApprovals.values()) {
    const card = document.createElement("section");
    card.className = "collaboration-approval";
    const title = document.createElement("strong");
    title.textContent = ui("{0} 请求{1}", approval.client?.name || "Codex", approval.label || ui("修改白板"));
    const summary = document.createElement("span");
    summary.textContent = approval.summary || ui("此操作会修改拾作白板");
    const actions = document.createElement("div");
    actions.className = "collaboration-approval-actions";
    const reject = document.createElement("button");
    reject.type = "button";
    reject.textContent = ui("拒绝");
    const allow = document.createElement("button");
    allow.type = "button";
    allow.className = "allow";
    allow.textContent = ui("允许一次");
    const allowSession = document.createElement("button");
    allowSession.type = "button";
    allowSession.className = "allow";
    allowSession.textContent = ui("本次会话允许");
    const buttons = [reject, allow, allowSession];
    reject.addEventListener("click", () => settleExternalApproval(approval, false, buttons));
    allow.addEventListener("click", () => settleExternalApproval(approval, true, buttons));
    allowSession.addEventListener("click", () => settleExternalApproval(approval, true, buttons, "session"));
    actions.append(reject, allow, allowSession);
    card.append(title, summary, actions);
    collaborationApprovalsEl.appendChild(card);
  }

  collaborationActivityListEl.replaceChildren();
  collaborationActivityEl.hidden = !externalCodexActivities.length;
  collaborationActivityCountEl.textContent = externalCodexActivities.length ? ui("{0} 条", Math.min(10, externalCodexActivities.length)) : "";
  if (!externalCodexActivities.length) {
    const empty = document.createElement("div");
    empty.className = "collaboration-activity-title";
    empty.textContent = ui("接入后的读取和修改会实时显示在这里");
    collaborationActivityListEl.appendChild(empty);
  } else externalCodexActivities.slice(0, 10).forEach(activity => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "collaboration-activity-item";
    row.dataset.phase = String(activity.phase || "");
    row.dataset.locatable = String(Boolean(activity.boardId));
    const dot = document.createElement("span");
    dot.className = "collaboration-activity-dot";
    const copy = document.createElement("span");
    copy.className = "collaboration-activity-copy";
    const title = document.createElement("strong");
    const activityIsLocal = activity.client?.scope === "local" || activity.client?.id === "owner-local";
    title.textContent = activityIsLocal
      ? activity.label || ui("操作白板")
      : `${activity.client?.name || "Codex"} · ${activity.label || ui("操作白板")}`;
    const detail = document.createElement("span");
    detail.textContent = [externalActivityPhaseText(activity), activity.summary].filter(Boolean).join(" · ");
    const time = document.createElement("span");
    time.className = "collaboration-activity-time";
    time.textContent = formatTime(activity.updatedAt || activity.createdAt);
    copy.append(title, detail);
    row.append(dot, copy, time);
    if (activity.boardId) row.addEventListener("click", () => focusExternalActivity(activity));
    collaborationActivityListEl.appendChild(row);
  });

}

function handleExternalCollaborationEvent(event) {
  if (event?.type === "local-codex-session-status") {
    const status = event.status || {};
    localCodexSessionsAvailable = event.available !== false;
    localCodexSessionStatus = {
      active: Boolean(status.active),
      activeCount: Math.max(0, Number(status.activeCount) || 0),
      threadId: String(status.threadId || ""),
      title: String(status.title || ""),
      startedAt: Math.max(0, Number(status.startedAt) || 0),
      updatedAt: Math.max(0, Number(status.updatedAt) || 0)
    };
    renderExternalCollaboration();
    if (collaborationSessionsEl.open && !collaborationPanelDismissed) {
      void loadLocalCodexSessions(true).then(() => {
        if (selectedLocalCodexSessionId) void openLocalCodexSessionPreview(selectedLocalCodexSessionId, true);
      });
    }
    return;
  }
  if (event?.type === "external-codex-task" && event.task?.id) {
    externalCodexTasks = [
      event.task,
      ...externalCodexTasks.filter(task => task.id !== event.task.id)
    ].slice(0, 100);
    renderExternalCollaboration();
    return;
  }
  if (event?.type === "external-codex-presence" && event.presence?.client?.id) {
    externalCodexPresence.set(event.presence.client.id, event.presence);
    renderRemotePresence();
    return;
  }
  if (event?.type === "external-card-stream" && event.boardId === currentBoard?.id) {
    const item = boardItems.find(entry => entry.id === event.cardId);
    const element = itemElement(event.cardId);
    if (item && element) {
      item.text = String(event.text || "");
      const editor = element.querySelector(".text-content,.document-editor,.code-editor,.task-prompt");
      if (editor instanceof HTMLTextAreaElement) editor.value = item.text;
      else if (editor) editor.textContent = item.text;
    }
    return;
  }
  if (event?.type === "external-codex-approval" && event.approval?.id) {
    collaborationPanelDismissed = false;
    sessionStorage.setItem("__pagedock_collaboration_closed__", "0");
    externalCodexApprovals.set(String(event.approval.id), event.approval);
    renderExternalCollaboration();
    return;
  }
  if (event?.type !== "external-codex-activity" || !event.activity?.requestId) return;
  externalCodexActivities = [
    event.activity,
    ...externalCodexActivities.filter(activity => activity.requestId !== event.activity.requestId)
  ].slice(0, 30);
  if (event.activity.phase !== "approval") {
    for (const [id, approval] of externalCodexApprovals) {
      if (approval.requestId === event.activity.requestId) externalCodexApprovals.delete(id);
    }
  }
  renderExternalCollaboration();
}

function renderRemotePresence() {
  remotePresenceLayerEl.replaceChildren();
  document.querySelectorAll(".board-item.remote-selected").forEach(element => element.classList.remove("remote-selected"));
  for (const presence of externalCodexPresence.values()) {
    if (Number(presence.updatedAt) + 45_000 <= Date.now()) {
      externalCodexPresence.delete(String(presence.client?.id || ""));
      continue;
    }
    if (!currentBoard || presence.boardId !== currentBoard.id) continue;
    for (const cardId of presence.cardIds || []) itemElement(cardId)?.classList.add("remote-selected");
    if (!presence.hasPointer) continue;
    const cursor = document.createElement("div");
    cursor.className = "remote-presence";
    cursor.style.left = `${Math.max(0, Number(presence.x) || 0)}px`;
    cursor.style.top = `${Math.max(0, Number(presence.y) || 0)}px`;
    const pointer = document.createElement("div");
    pointer.className = "remote-presence-pointer";
    const label = document.createElement("div");
    label.className = "remote-presence-label";
    label.textContent = [presence.client?.name || "Codex", presence.state].filter(Boolean).join(" · ");
    cursor.append(pointer, label);
    remotePresenceLayerEl.appendChild(cursor);
  }
}
