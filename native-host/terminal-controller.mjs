import { spawn } from "node:child_process";
import fs from "node:fs";
import { commandAvailable, truncate } from "./runtime-utils.mjs";

const MAX_TERMINAL_COMMAND_CHARS = 8_000;
const TERMINAL_OUTPUT_CHUNK_CHARS = 16_000;
const MAX_TERMINAL_SESSIONS = 6;
const MAX_TERMINAL_INPUT_BYTES = 256 * 1024;
const TERMINAL_SESSION_OUTPUT_BATCH_BYTES = 32 * 1024;
const TERMINAL_SESSION_OUTPUT_DELAY_MS = 16;
const MAX_TERMINAL_SESSION_OUTPUT_BUFFER_BYTES = 512 * 1024;

// Owns PTY sessions and one-shot terminal processes behind one controller interface.
export function createTerminalController({ activeJobs, codingWorkspace, terminalShell, pythonBinary, ptyHelper, taskTimeoutMs, codexEnvironment, send, log, terminateChildTree }) {
  const terminalSessions = new Map();
  const TASK_TIMEOUT_MS = taskTimeoutMs;
  function terminalOutputText(value) {
    return String(value || "")
      .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, "")
      .replace(/\u001b\[[0-?]*[ -\/]*[@-~]/g, "")
      .replace(/\r(?!\n)/g, "\n")
      .replace(/[^\t\n\r\x20-\x7e\u0080-\uffff]/g, "");
  }
  
  function sendTerminalOutput(id, stream, value) {
    const output = terminalOutputText(value);
    for (let offset = 0; offset < output.length; offset += TERMINAL_OUTPUT_CHUNK_CHARS) {
      send({
        type: "terminal-output",
        id,
        stream,
        data: output.slice(offset, offset + TERMINAL_OUTPUT_CHUNK_CHARS)
      });
    }
  }
  
  function writeTerminalSessionControl(session, message) {
    if (!session?.child?.stdin?.writable) throw new Error("终端会话已经关闭");
    session.child.stdin.write(`${JSON.stringify(message)}\n`);
  }
  
  function scheduleTerminalSessionOutput(session) {
    if (session.closed || session.outputTimer || session.waitingForDrain) return;
    session.outputTimer = setTimeout(() => {
      session.outputTimer = undefined;
      flushTerminalSessionOutput(session);
    }, TERMINAL_SESSION_OUTPUT_DELAY_MS);
  }
  
  function resumeTerminalSessionOutput(session) {
    if (session.closed || session.outputBytes || session.waitingForDrain) return;
    session.child.stdout.resume();
  }
  
  function flushTerminalSessionOutput(session, force = false) {
    if (session.outputTimer) {
      clearTimeout(session.outputTimer);
      session.outputTimer = undefined;
    }
    if (!session.outputBytes) {
      resumeTerminalSessionOutput(session);
      return;
    }
    const combined = Buffer.concat(session.outputChunks, session.outputBytes);
    const batchSize = force ? combined.length : Math.min(combined.length, TERMINAL_SESSION_OUTPUT_BATCH_BYTES);
    const batch = combined.subarray(0, batchSize);
    const remainder = combined.subarray(batchSize);
    session.outputChunks = remainder.length ? [remainder] : [];
    session.outputBytes = remainder.length;
    if (session.outputDropped && !session.outputBytes) {
      session.outputDropped = false;
      const marker = Buffer.from("\r\n[输出过快，部分终端内容已省略]\r\n", "utf8");
      session.outputChunks.push(marker);
      session.outputBytes += marker.length;
    }
    const writable = send({ type: "terminal-session-output", id: session.id, data: batch.toString("base64") });
    if (!writable && !force) {
      session.waitingForDrain = true;
      process.stdout.once("drain", () => {
        session.waitingForDrain = false;
        if (session.outputBytes) scheduleTerminalSessionOutput(session);
        else resumeTerminalSessionOutput(session);
      });
      return;
    }
    if (session.outputBytes) {
      if (force) flushTerminalSessionOutput(session, true);
      else scheduleTerminalSessionOutput(session);
    } else {
      resumeTerminalSessionOutput(session);
    }
  }
  
  function queueTerminalSessionOutput(session, encodedData) {
    if (session.closed) return;
    const chunk = Buffer.from(String(encodedData || ""), "base64");
    if (!chunk.length) return;
    session.child.stdout.pause();
    const remainingCapacity = MAX_TERMINAL_SESSION_OUTPUT_BUFFER_BYTES - session.outputBytes;
    if (remainingCapacity <= 0) {
      session.outputDropped = true;
    } else {
      const accepted = chunk.subarray(0, remainingCapacity);
      session.outputChunks.push(accepted);
      session.outputBytes += accepted.length;
      if (accepted.length < chunk.length) session.outputDropped = true;
    }
    scheduleTerminalSessionOutput(session);
  }
  
  function clearTerminalSessionOutput(session) {
    if (session.outputTimer) clearTimeout(session.outputTimer);
    session.outputTimer = undefined;
    session.outputChunks = [];
    session.outputBytes = 0;
    session.outputDropped = false;
  }
  
  // 交互终端必须运行在 PTY 中；普通 child_process 管道无法支持方向键、Ctrl+C、vim/top 或窗口尺寸变化。
  function openTerminalSession(message) {
    const id = String(message.id || "").slice(0, 120);
    if (!id) throw new Error("终端会话缺少 id");
    if (terminalSessions.has(id)) {
      send({ type: "terminal-session-started", id, cwd: terminalSessions.get(id).cwd, resumed: true });
      return;
    }
    if (terminalSessions.size >= MAX_TERMINAL_SESSIONS) throw new Error(`最多可同时打开 ${MAX_TERMINAL_SESSIONS} 个终端会话`);
    if (!fs.existsSync(codingWorkspace)) throw new Error("控制台工作目录不存在，请重新安装本地桥接");
    if (!commandAvailable(terminalShell)) throw new Error("本机未找到可用 Shell");
    if (!commandAvailable(pythonBinary) || !fs.existsSync(ptyHelper)) throw new Error("本地 PTY 组件缺失，请重新安装拾作本地桥接");
    const cols = Math.max(2, Math.min(1000, Number(message.cols) || 100));
    const rows = Math.max(2, Math.min(1000, Number(message.rows) || 30));
    const child = spawn(pythonBinary, [ptyHelper, "--shell", terminalShell, "--cwd", codingWorkspace, "--cols", String(cols), "--rows", String(rows)], {
      cwd: codingWorkspace,
      env: codexEnvironment(),
      stdio: ["pipe", "pipe", "pipe"]
    });
    const session = {
      id,
      child,
      cwd: codingWorkspace,
      ready: false,
      closed: false,
      exitCode: null,
      stdoutBuffer: "",
      stderr: "",
      outputChunks: [],
      outputBytes: 0,
      outputTimer: undefined,
      outputDropped: false,
      waitingForDrain: false
    };
    terminalSessions.set(id, session);
    const startupTimer = setTimeout(() => {
      if (session.ready || session.closed) return;
      session.closed = true;
      clearTerminalSessionOutput(session);
      terminalSessions.delete(id);
      terminateChildTree(child);
      send({ type: "terminal-session-error", id, error: "终端会话启动超时" });
    }, 10_000);
  
    child.stdout.on("data", chunk => {
      session.stdoutBuffer += chunk.toString("utf8");
      const lines = session.stdoutBuffer.split("\n");
      session.stdoutBuffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line);
          if (event.type === "ready") {
            session.ready = true;
            clearTimeout(startupTimer);
            send({ type: "terminal-session-started", id, cwd: session.cwd, cols, rows });
            log("terminal session started", { id, cwd: session.cwd, cols, rows });
          } else if (event.type === "output" && event.data) {
            queueTerminalSessionOutput(session, event.data);
          } else if (event.type === "exit") {
            // PTY helper exits immediately after this event; defer the public close event to the
            // child close handler so each session has one deterministic terminal state transition.
            session.exitCode = Number.isInteger(event.exitCode) ? event.exitCode : null;
          } else if (event.type === "error") {
            send({ type: "terminal-session-error", id, error: String(event.error || "PTY 执行失败") });
          }
        } catch (error) {
          log("invalid terminal session event", { id, reason: error.message });
        }
      }
    });
    child.stderr.on("data", chunk => {
      session.stderr = truncate(session.stderr + chunk.toString("utf8"), 8_000);
    });
    child.on("error", error => {
      clearTimeout(startupTimer);
      if (session.closed) return;
      session.closed = true;
      clearTerminalSessionOutput(session);
      terminalSessions.delete(id);
      send({ type: "terminal-session-error", id, error: `无法启动终端：${error.message}` });
      log("terminal session spawn failed", { id, reason: error.message });
    });
    child.on("close", code => {
      clearTimeout(startupTimer);
      terminalSessions.delete(id);
      if (session.closed) return;
      flushTerminalSessionOutput(session, true);
      session.closed = true;
      if (!session.ready && session.stderr.trim()) {
        send({ type: "terminal-session-error", id, error: `终端启动失败：${truncate(session.stderr.trim(), 1_500)}` });
      } else {
        send({ type: "terminal-session-closed", id, exitCode: Number.isInteger(session.exitCode) ? session.exitCode : Number.isInteger(code) ? code : null });
      }
      log("terminal session closed", { id, exitCode: code });
    });
  }
  
  function writeTerminalSession(message) {
    const id = String(message.id || "");
    const session = terminalSessions.get(id);
    if (!session) throw new Error("终端会话不存在，请重新连接");
    const data = String(message.data || "");
    if (Buffer.byteLength(data, "base64") > MAX_TERMINAL_INPUT_BYTES) throw new Error("单次终端输入过大");
    writeTerminalSessionControl(session, { type: "input", data });
  }
  
  function resizeTerminalSession(message) {
    const id = String(message.id || "");
    const session = terminalSessions.get(id);
    if (!session) return;
    writeTerminalSessionControl(session, {
      type: "resize",
      cols: Math.max(2, Math.min(1000, Number(message.cols) || 80)),
      rows: Math.max(2, Math.min(1000, Number(message.rows) || 24))
    });
  }
  
  function closeTerminalSession(message) {
    const id = String(message.id || "");
    const session = terminalSessions.get(id);
    if (!session) return send({ type: "terminal-session-closed", id, exitCode: null });
    session.closed = true;
    clearTerminalSessionOutput(session);
    terminalSessions.delete(id);
    try {
      writeTerminalSessionControl(session, { type: "close" });
    } catch {}
    setTimeout(() => terminateChildTree(session.child), 800);
    send({ type: "terminal-session-closed", id, exitCode: null });
    log("terminal session close requested", { id });
  }
  
  function runTerminal(message) {
    const id = String(message.id || "").slice(0, 120);
    const command = String(message.command || "").trim();
    if (!id) throw new Error("控制台任务缺少 id");
    if (!command) throw new Error("请输入要执行的命令");
    if (command.length > MAX_TERMINAL_COMMAND_CHARS) throw new Error("单条命令不能超过 8000 个字符");
    if (activeJobs.has(id)) throw new Error("控制台任务已经在运行");
    if (activeJobs.size >= MAX_CONCURRENT_JOBS) {
      throw new Error(`最多可同时执行 ${MAX_CONCURRENT_JOBS} 个本地任务`);
    }
    if (!fs.existsSync(codingWorkspace)) throw new Error("控制台工作目录不存在，请重新安装本地桥接");
    if (!commandAvailable(terminalShell)) throw new Error("本机未找到可用 Shell");
  
    let child;
    try {
      child = spawn(terminalShell, ["-lc", command], {
        cwd: codingWorkspace,
        env: { ...codexEnvironment(), TERM: "xterm-256color" },
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"]
      });
    } catch (error) {
      throw new Error(`无法启动控制台：${error.message}`);
    }
    const job = {
      child,
      cancelled: false,
      spawnFailed: false,
      mode: "terminal",
      workDirectory: "",
      imageDirectory: ""
    };
    activeJobs.set(id, job);
    send({ type: "terminal-started", id, cwd: codingWorkspace });
    log("terminal job started", { id, cwd: codingWorkspace, commandLength: command.length });
  
    job.timer = setTimeout(() => {
      if (job.cancelled) return;
      job.cancelled = true;
      terminateChildTree(child);
      send({ type: "terminal-error", id, error: "控制台任务超过 24 小时，已自动停止" });
      log("terminal job timeout", { id, timeoutMs: TASK_TIMEOUT_MS });
    }, TASK_TIMEOUT_MS);
    child.stdout.on("data", chunk => sendTerminalOutput(id, "stdout", chunk.toString("utf8")));
    child.stderr.on("data", chunk => sendTerminalOutput(id, "stderr", chunk.toString("utf8")));
    child.on("error", error => {
      job.spawnFailed = true;
      clearTimeout(job.timer);
      activeJobs.delete(id);
      send({ type: "terminal-error", id, error: `无法启动控制台：${error.message}` });
      log("terminal job spawn failed", { id, reason: error.message });
    });
    child.on("close", code => {
      clearTimeout(job.timer);
      activeJobs.delete(id);
      if (job.cancelled || job.spawnFailed) return;
      send({ type: "terminal-done", id, exitCode: Number.isInteger(code) ? code : null });
      log("terminal job completed", { id, exitCode: code });
    });
  }

  function shutdownTerminalSessions() {
    for (const session of terminalSessions.values()) {
      session.closed = true;
      clearTerminalSessionOutput(session);
      try { writeTerminalSessionControl(session, { type: "close" }); } catch {}
      terminateChildTree(session.child);
    }
    terminalSessions.clear();
  }

  return Object.freeze({ openTerminalSession, writeTerminalSession, resizeTerminalSession, closeTerminalSession, runTerminal, shutdownTerminalSessions });
}
