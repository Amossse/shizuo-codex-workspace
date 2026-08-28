import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform === "win32") {
  console.log("终端输出压力测试已跳过：PTY 仅用于 macOS/Linux");
  process.exit(0);
}

const root = fileURLToPath(new URL("../", import.meta.url));
const host = path.join(root, "native-host/pagedock-codex-host.mjs");
const helper = path.join(root, "native-host/pagedock-pty.py");
const sessionId = "terminal-output-stress";
const targetBytes = 100_000;
const maximumOutputEventsPerSecond = 80;
const maximumMessageBytes = 32 * 1024;
const startedAt = performance.now();
const child = spawn(process.execPath, [host], {
  cwd: root,
  env: {
    ...process.env,
    PAGEDOCK_CODING_WORKSPACE: root,
    PAGEDOCK_CODEX_WORKSPACE: root,
    PAGEDOCK_PTY_HELPER: helper,
    PAGEDOCK_REAL_PYTHON: "python3",
    PAGEDOCK_TERMINAL_SHELL: process.env.SHELL || "/bin/zsh"
  },
  stdio: ["pipe", "pipe", "pipe"]
});

let nativeBuffer = Buffer.alloc(0);
let stderr = "";
let outputEvents = 0;
let outputBytes = 0;
let largestMessageBytes = 0;
let outputTail = Buffer.alloc(0);
let finished = false;

function send(message) {
  const payload = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  child.stdin.write(Buffer.concat([header, payload]));
}

function finish(error) {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  try { send({ type: "terminal-session-close", id: sessionId }); } catch {}
  setTimeout(() => child.kill("SIGTERM"), 100).unref();
  if (error) {
    console.error(error.message);
    if (stderr.trim()) console.error(stderr.trim());
    process.exitCode = 1;
    return;
  }
  const elapsedSeconds = Math.max(0.001, (performance.now() - startedAt) / 1000);
  const eventsPerSecond = outputEvents / elapsedSeconds;
  if (eventsPerSecond > maximumOutputEventsPerSecond) {
    console.error(`终端输出压力测试失败：${eventsPerSecond.toFixed(1)} events/s，预期不超过 ${maximumOutputEventsPerSecond}`);
    process.exitCode = 1;
  } else if (largestMessageBytes > maximumMessageBytes) {
    console.error(`终端输出压力测试失败：单条输出 ${largestMessageBytes} bytes，预期不超过 ${maximumMessageBytes}`);
    process.exitCode = 1;
  } else {
    console.log(`终端输出压力测试通过：${outputBytes.toLocaleString()} bytes / ${outputEvents} events / ${eventsPerSecond.toFixed(1)} events/s`);
  }
}

function handleMessage(message) {
  if (message.type === "terminal-session-started") {
    const command = "stty -onlcr; yes X | head -c 100000; printf '\\n__PAGEDOCK_STRESS_DONE__\\n'\n";
    send({ type: "terminal-session-input", id: sessionId, data: Buffer.from(command).toString("base64") });
    return;
  }
  if (message.type === "terminal-session-error" || message.type === "terminal-error") {
    finish(new Error(message.error || "终端压力测试执行失败"));
    return;
  }
  if (message.type !== "terminal-session-output" || !message.data) return;
  const chunk = Buffer.from(message.data, "base64");
  outputEvents += 1;
  outputBytes += chunk.length;
  largestMessageBytes = Math.max(largestMessageBytes, chunk.length);
  outputTail = Buffer.concat([outputTail, chunk]).subarray(-256);
  if (outputBytes >= targetBytes && outputTail.includes(Buffer.from("__PAGEDOCK_STRESS_DONE__"))) finish();
}

child.stdout.on("data", chunk => {
  nativeBuffer = Buffer.concat([nativeBuffer, chunk]);
  while (nativeBuffer.length >= 4) {
    const messageLength = nativeBuffer.readUInt32LE(0);
    if (nativeBuffer.length < messageLength + 4) break;
    const payload = nativeBuffer.subarray(4, messageLength + 4);
    nativeBuffer = nativeBuffer.subarray(messageLength + 4);
    try { handleMessage(JSON.parse(payload.toString("utf8"))); } catch (error) { finish(error); }
  }
});
child.stderr.on("data", chunk => { stderr += chunk.toString("utf8"); });
child.on("error", error => finish(error));
child.on("close", code => {
  if (!finished) finish(new Error(`终端输出压力测试提前退出（${code ?? "unknown"}）`));
});

const timeout = setTimeout(() => finish(new Error(
  `终端输出压力测试超时：${outputBytes} bytes / ${outputEvents} events`
)), 10_000);

send({ type: "terminal-session-open", id: sessionId, cols: 100, rows: 30 });
