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
    if (!response?.ok) throw new Error(response?.error || "操作确认失败");
    externalCodexApprovals.delete(String(approval.id || ""));
    renderExternalCollaboration();
    setStatus(allow ? (allowMode === "session" ? `本次会话已允许 ${approval.client?.name || "Codex"} 编辑` : `已允许 ${approval.client?.name || "Codex"} 执行一次`) : "已拒绝外部修改");
  } catch (error) {
    buttons.forEach(button => { button.disabled = false; });
    setStatus(error?.message || "操作确认失败", true);
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
  boardCollaborationEl.textContent = visible ? "收起协作" : `协作与会话${unread ? ` · ${unread}` : ""}`;
  homeCollaborationEl.disabled = !available;
  homeCollaborationEl.textContent = visible ? "收起协作" : `协作与会话${unread ? ` · ${unread}` : ""}`;
  if (!visible) return;
  collaborationSessionsEl.hidden = !localCodexSessionsAvailable;
  if (localCodexSessionsAvailable && collaborationSessionsEl.open) void loadLocalCodexSessions();
  const activeNames = externalCodexClients.map(client => String(client.name || "Codex"));
  const humanNames = externalCodexClients.filter(client => client.type === "human").map(client => String(client.name || "协作者"));
  const humanConnected = humanNames.length > 0;
  const activeTasks = externalCodexTasks.filter(task => EXTERNAL_TASK_ACTIVE_PHASES.has(task.phase));
  const automaticTask = localCodexSessionStatus.active ? {
    id: `local-session:${localCodexSessionStatus.threadId || "active"}`,
    phase: "running",
    title: localCodexSessionStatus.title || "Codex 正在工作",
    message: localCodexSessionStatus.activeCount > 1
      ? `${localCodexSessionStatus.activeCount} 个本地 Codex 任务正在执行`
      : "正在执行本地 Codex 任务",
    client: { id: "owner-local", name: "本地 Codex", scope: "local" },
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
  collaborationTitleEl.textContent = humanConnected ? "白板协作" : activeNames.length > 1 ? `${activeNames.length} 个 Codex` : "Codex 工作伙伴";
  collaborationClientsEl.textContent = visibleActiveTasks.length > 1
    ? `${visibleActiveTasks.length} 个任务正在执行`
    : primaryTask?.title || (humanConnected ? `${humanNames.join("、")} 正在协作` : codexConnected ? "已连接，随时待命" : "等待接入");
  collaborationLiveEl.textContent = primaryClientIsLocal ? "本机" : externalCodexScope === "lan" ? "内网" : codexConnected ? "本机" : "历史";

  const petState = externalTaskPetState(primaryTask);
  collaborationPetStageEl.dataset.state = petState;
  collaborationPetStatusEl.textContent = externalPetStatusText(petState, codexConnected);
  collaborationPetTitleEl.textContent = primaryTask?.title || (humanConnected ? "协作者已加入白板" : codexConnected ? "随时可以开始" : "等待 Codex 接入");
  collaborationPetMessageEl.textContent = primaryTask ? externalTaskSummary(primaryTask, codexConnected) : humanConnected ? "对方可以实时查看白板，修改仍受你的权限设置控制" : externalTaskSummary(primaryTask, codexConnected);
  collaborationPetMetaEl.textContent = primaryTask
    ? [primaryClientIsLocal ? "本地 Codex" : (primaryTask.client?.name || "Codex"), formatTime(primaryTask.updatedAt || primaryTask.createdAt)].filter(Boolean).join(" · ")
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
  collaborationConnectionCountEl.textContent = manageableClients.length ? `${manageableClients.length} 个` : "";
  manageableClients.forEach(client => {
    const row = document.createElement("div");
    row.className = "collaboration-client-row";
    const name = document.createElement("span");
    name.textContent = client.name || "Codex";
    const policy = document.createElement("select");
    [["read", "只读"], ["ask", "每次询问"], ["edit", "可编辑"]].forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      policy.appendChild(option);
    });
    policy.value = externalClientPolicies[client.id] || (client.type === "human" ? "edit" : "ask");
    policy.addEventListener("change", async () => {
      const response = await chrome.runtime.sendMessage({ type: BRIDGE_CLIENT_POLICY_REQUEST, clientId: client.id, policy: policy.value });
      if (!response?.ok) setStatus(response?.error || "权限更新失败", true);
      else externalClientPolicies = { ...externalClientPolicies, [client.id]: policy.value };
    });
    const revoke = document.createElement("button");
    revoke.type = "button";
    revoke.className = "collaboration-client-revoke";
    revoke.textContent = "撤销";
    revoke.title = `撤销 ${client.name || "Codex"} 的连接令牌`;
    revoke.addEventListener("click", async () => {
      revoke.disabled = true;
      try {
        const response = await chrome.runtime.sendMessage({ type: BRIDGE_CLIENT_REVOKE_REQUEST, clientId: client.id });
        if (!response?.ok) throw new Error(response?.error || "撤销失败");
        externalCodexClients = externalCodexClients.filter(entry => entry.id !== client.id);
        externalCodexPresence.delete(client.id);
        renderExternalCollaboration();
        renderRemotePresence();
        setStatus(`已撤销 ${client.name || "Codex"} 的连接`);
      } catch (error) {
        revoke.disabled = false;
        setStatus(error?.message || "撤销接入者失败", true);
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
    title.textContent = `${approval.client?.name || "Codex"} 请求${approval.label || "修改白板"}`;
    const summary = document.createElement("span");
    summary.textContent = approval.summary || "此操作会修改拾作白板";
    const actions = document.createElement("div");
    actions.className = "collaboration-approval-actions";
    const reject = document.createElement("button");
    reject.type = "button";
    reject.textContent = "拒绝";
    const allow = document.createElement("button");
    allow.type = "button";
    allow.className = "allow";
    allow.textContent = "允许一次";
    const allowSession = document.createElement("button");
    allowSession.type = "button";
    allowSession.className = "allow";
    allowSession.textContent = "本次会话允许";
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
  collaborationActivityCountEl.textContent = externalCodexActivities.length ? `${Math.min(10, externalCodexActivities.length)} 条` : "";
  if (!externalCodexActivities.length) {
    const empty = document.createElement("div");
    empty.className = "collaboration-activity-title";
    empty.textContent = "接入后的读取和修改会实时显示在这里";
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
      ? activity.label || "操作白板"
      : `${activity.client?.name || "Codex"} · ${activity.label || "操作白板"}`;
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
