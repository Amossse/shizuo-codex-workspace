import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CODEX_SESSION_STARTED_EVENT = "task_started";
const CODEX_SESSION_FINISHED_EVENTS = new Set(["task_complete", "turn_aborted"]);
const CODEX_SESSION_POLL_MS = 1_000;
const CODEX_SESSION_RECENT_DAYS = 3;
const CODEX_SESSION_TAIL_BYTES = 8 * 1024 * 1024;
const CODEX_SESSION_STALE_ACTIVE_MS = 24 * 60 * 60 * 1000;
const CODEX_SESSION_PREVIEW_MAX_ENTRIES = 40;
const CODEX_SESSION_PREVIEW_MAX_TEXT = 6_000;
const CODEX_SESSION_PREVIEW_MAX_TOTAL_TEXT = 40_000;

// Owns Codex session discovery, lifecycle parsing, list state, and previews.
export function createCodexSessionObserver({ sessionsRoot: codexSessionsRoot, log }) {
  let observedCodexSessions = [];
  function codexSessionThreadId(filePath) {
    return /([0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\.jsonl$/i.exec(filePath)?.[1] || "";
  }
  
  function cleanCodexTaskTitle(value) {
    let text = String(value || "").trim();
    const request = /## My request:\s*([\s\S]*)/i.exec(text);
    if (request?.[1]) text = request[1].trim();
    text = text
      .replace(/<image\b[^>]*>[\s\S]*?<\/image>/gi, " ")
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line && !line.startsWith("#") && !/^[-*]\s+.*(?:\.png|\.jpe?g|\.webp)(?:\s|$)/i.test(line))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return text.length > 96 ? `${text.slice(0, 93)}…` : text;
  }
  
  function cleanCodexPreviewText(value, maxLength = CODEX_SESSION_PREVIEW_MAX_TEXT) {
    return String(value || "")
      .replace(/<oai-mem-citation>[\s\S]*?<\/oai-mem-citation>/gi, "")
      .replace(/^::[a-z][a-z-]*\{.*\}\s*$/gim, "")
      .trim()
      .slice(0, maxLength);
  }
  
  function appendCodexPreviewEntry(entries, entry) {
    const text = cleanCodexPreviewText(entry.text);
    if (!text) return;
    entries.push({
      role: ["user", "assistant", "status"].includes(entry.role) ? entry.role : "status",
      phase: ["commentary", "final_answer", "completed", "cancelled"].includes(entry.phase) ? entry.phase : "",
      text,
      createdAt: Math.max(0, Number(entry.createdAt) || 0)
    });
    while (entries.length > CODEX_SESSION_PREVIEW_MAX_ENTRIES
      || entries.reduce((total, current) => total + current.text.length, 0) > CODEX_SESSION_PREVIEW_MAX_TOTAL_TEXT) {
      entries.shift();
    }
  }
  
  function readCodexSessionTail(filePath, maxBytes = CODEX_SESSION_TAIL_BYTES) {
    const stat = fs.statSync(filePath);
    const length = Math.min(stat.size, maxBytes);
    const start = Math.max(0, stat.size - length);
    const descriptor = fs.openSync(filePath, "r");
    try {
      const buffer = Buffer.alloc(length);
      fs.readSync(descriptor, buffer, 0, length, start);
      let text = buffer.toString("utf8");
      // 从文件中段读取时丢弃第一条不完整 JSONL，避免把截断内容误判为事件。
      if (start > 0) text = text.slice(Math.max(0, text.indexOf("\n") + 1));
      return { text, stat };
    } finally {
      fs.closeSync(descriptor);
    }
  }
  
  function parseCodexSessionLifecycle(filePath) {
    const { text, stat } = readCodexSessionTail(filePath);
    const state = {
      active: false,
      sawLifecycle: false,
      threadId: codexSessionThreadId(filePath),
      title: "",
      state: "completed",
      startedAt: 0,
      updatedAt: stat.mtimeMs,
      modifiedAt: stat.mtimeMs,
      entries: [],
      filePath
    };
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      let entry;
      try { entry = JSON.parse(line); } catch { continue; }
      if (entry?.type !== "event_msg" || !entry.payload) continue;
      const eventType = String(entry.payload.type || "");
      const eventAt = Date.parse(entry.timestamp) || stat.mtimeMs;
      if (eventType === CODEX_SESSION_STARTED_EVENT) {
        state.active = true;
        state.sawLifecycle = true;
        state.state = "running";
        state.title = "";
        state.startedAt = eventAt;
        state.updatedAt = eventAt;
        continue;
      }
      if (eventType === "user_message" && state.active) {
        const message = cleanCodexPreviewText(entry.payload.message);
        state.title = cleanCodexTaskTitle(message) || state.title;
        state.updatedAt = eventAt;
        appendCodexPreviewEntry(state.entries, { role: "user", text: message, createdAt: eventAt });
        continue;
      }
      if (eventType === "agent_message" && ["commentary", "final_answer"].includes(entry.payload.phase)) {
        state.updatedAt = eventAt;
        appendCodexPreviewEntry(state.entries, {
          role: "assistant",
          phase: entry.payload.phase,
          text: entry.payload.message,
          createdAt: eventAt
        });
        continue;
      }
      if (CODEX_SESSION_FINISHED_EVENTS.has(eventType)) {
        state.active = false;
        state.sawLifecycle = true;
        state.state = eventType === "turn_aborted" ? "cancelled" : "completed";
        state.updatedAt = eventAt;
        if (eventType === "turn_aborted") {
          appendCodexPreviewEntry(state.entries, { role: "status", phase: "cancelled", text: "任务已取消", createdAt: eventAt });
        }
      }
    }
    return state;
  }
  
  function publicCodexSessionSummary(session) {
    const latest = session.entries[session.entries.length - 1];
    return {
      threadId: session.threadId,
      title: session.title || "未命名 Codex 会话",
      state: session.active ? "running" : session.state,
      startedAt: session.startedAt,
      updatedAt: session.updatedAt,
      modifiedAt: session.modifiedAt,
      messageCount: session.entries.length,
      latestText: latest?.text ? cleanCodexTaskTitle(latest.text) : ""
    };
  }
  
  function listObservedCodexSessions(limit = 12) {
    return observedCodexSessions
      .filter(session => session.sawLifecycle && session.threadId)
      .sort((left, right) => right.modifiedAt - left.modifiedAt)
      .slice(0, Math.min(30, Math.max(1, Number(limit) || 12)))
      .map(publicCodexSessionSummary);
  }
  
  function previewObservedCodexSession(threadId) {
    const session = observedCodexSessions.find(entry => entry.threadId === String(threadId || ""));
    if (!session) throw new Error("Codex Session 不存在或已超出最近会话范围");
    return {
      ...publicCodexSessionSummary(session),
      entries: session.entries.map(entry => ({ ...entry }))
    };
  }
  
  function codexSessionDateDirectory(now, offset) {
    const date = new Date(now - offset * 24 * 60 * 60 * 1000);
    return path.join(
      codexSessionsRoot,
      String(date.getFullYear()),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    );
  }
  
  function recentCodexSessionFiles(now = Date.now()) {
    const files = [];
    for (let offset = 0; offset < CODEX_SESSION_RECENT_DAYS; offset += 1) {
      const directory = codexSessionDateDirectory(now, offset);
      if (!fs.existsSync(directory)) continue;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".jsonl")) continue;
        const filePath = path.join(directory, entry.name);
        try {
          const stat = fs.statSync(filePath);
          files.push({ filePath, modifiedAt: stat.mtimeMs });
        } catch {}
      }
    }
    return files.sort((left, right) => right.modifiedAt - left.modifiedAt).slice(0, 64);
  }
  
  function startCodexSessionMonitorInternal(onStatus, options = {}) {
    const pollMs = Math.max(100, Number(options.pollMs) || CODEX_SESSION_POLL_MS);
    const sessionStates = new Map();
    let lastFingerprint = "";
    let lastSessionsFingerprint = "";
    let stopped = false;
  
    const poll = () => {
      if (stopped) return;
      const now = Date.now();
      const files = recentCodexSessionFiles(now);
      const visibleFiles = new Set(files.map(entry => entry.filePath));
      for (const { filePath, modifiedAt } of files) {
        const previous = sessionStates.get(filePath);
        if (previous?.modifiedAt === modifiedAt) continue;
        try {
          const parsed = parseCodexSessionLifecycle(filePath);
          sessionStates.set(filePath, { ...parsed, modifiedAt });
        } catch (error) {
          log("Codex session monitor skipped unreadable session", { filePath, reason: error.message });
        }
      }
      for (const [filePath, state] of sessionStates) {
        if (!visibleFiles.has(filePath) || (state.active && now - state.updatedAt > CODEX_SESSION_STALE_ACTIVE_MS)) {
          sessionStates.delete(filePath);
        }
      }
      const active = [...sessionStates.values()]
        .filter(state => state.active)
        .sort((left, right) => right.startedAt - left.startedAt);
      const primary = active[0];
      const status = Object.freeze({
        active: active.length > 0,
        activeCount: active.length,
        threadId: primary?.threadId || "",
        title: primary?.title || (active.length > 0 ? "Codex 正在工作" : ""),
        startedAt: primary?.startedAt || 0,
        updatedAt: primary?.updatedAt || 0
      });
      const fingerprint = JSON.stringify(status);
      if (fingerprint !== lastFingerprint) {
        lastFingerprint = fingerprint;
        onStatus(status);
      }
      const sessions = [...sessionStates.values()].sort((left, right) => right.modifiedAt - left.modifiedAt);
      const sessionsFingerprint = JSON.stringify(sessions.map(session => ({
        threadId: session.threadId,
        state: session.state,
        active: session.active,
        title: session.title,
        updatedAt: session.updatedAt,
        messageCount: session.entries.length
      })));
      if (sessionsFingerprint !== lastSessionsFingerprint) {
        lastSessionsFingerprint = sessionsFingerprint;
        options.onSessions?.(sessions);
      }
    };
  
    poll();
    const timer = setInterval(poll, pollMs);
    timer.unref?.();
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }
  
  function codexSessionMonitorSelfTest() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pagedock-codex-session-"));
    const filePath = path.join(directory, "rollout-2026-08-12T00-00-00-019feeaa-265e-74c0-816c-55cc9122db05.jsonl");
    const event = (type, payload = {}) => JSON.stringify({
      timestamp: "2026-08-12T10:00:00.000Z",
      type: "event_msg",
      payload: { type, ...payload }
    });
    try {
      fs.writeFileSync(filePath, `${event(CODEX_SESSION_STARTED_EVENT)}\n${event("user_message", { message: "修复插件状态" })}\n${event("agent_reasoning", { text: "不得展示的隐藏推理" })}\n${event("agent_message", { phase: "commentary", message: "正在检查状态链路" })}\n`);
      const running = parseCodexSessionLifecycle(filePath);
      if (!running.active || running.title !== "修复插件状态") throw new Error("started event was not recognized");
      if (running.entries.length !== 2 || running.entries.some(entry => entry.text.includes("隐藏推理"))) throw new Error("session preview whitelist leaked hidden events");
      fs.appendFileSync(filePath, `${event("task_complete")}\n`);
      if (parseCodexSessionLifecycle(filePath).active) throw new Error("completed event was not recognized");
      fs.appendFileSync(filePath, `${event(CODEX_SESSION_STARTED_EVENT)}\n${event("turn_aborted")}\n`);
      if (parseCodexSessionLifecycle(filePath).active) throw new Error("aborted event was not recognized");
      return "ok";
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }

  function startCodexSessionMonitor(onStatus, options = {}) {
    return startCodexSessionMonitorInternal(onStatus, {
      ...options,
      onSessions: sessions => {
        observedCodexSessions = sessions;
        options.onSessions?.(sessions);
      }
    });
  }

  return Object.freeze({ listObservedCodexSessions, previewObservedCodexSession, startCodexSessionMonitor, codexSessionMonitorSelfTest });
}
