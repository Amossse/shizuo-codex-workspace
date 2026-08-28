import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const directory = mkdtempSync(join(tmpdir(), "shizuo-session-preview-"));
const now = new Date();
const sessionsDirectory = join(
  directory,
  String(now.getFullYear()),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0")
);
mkdirSync(sessionsDirectory, { recursive: true });
const threadId = "019feeaa-265e-74c0-816c-55cc9122db05";
const sessionPath = join(sessionsDirectory, `rollout-test-${threadId}.jsonl`);
const event = (type, payload = {}) => JSON.stringify({
  timestamp: now.toISOString(),
  type: "event_msg",
  payload: { type, ...payload }
});
writeFileSync(sessionPath, [
  event("task_started"),
  event("user_message", { message: "实现 Session Preview" }),
  event("agent_reasoning", { text: "secret hidden reasoning" }),
  event("patch_apply_end", { stdout: "API_TOKEN=secret" }),
  event("agent_message", { phase: "commentary", message: "正在读取公开消息" }),
  event("agent_message", { phase: "final_answer", message: "Session Preview 已完成" }),
  event("task_complete")
].join("\n"));

const host = spawn(process.execPath, [join(root, "native-host/pagedock-codex-host.mjs")], {
  cwd: root,
  env: {
    ...process.env,
    PAGEDOCK_CODEX_BIN: "/usr/bin/true",
    PAGEDOCK_CODEX_SESSIONS_DIR: directory
  },
  stdio: ["pipe", "pipe", "pipe"]
});

let buffer = Buffer.alloc(0);
const messages = [];
host.stdout.on("data", chunk => {
  buffer = Buffer.concat([buffer, chunk]);
  while (buffer.length >= 4) {
    const length = buffer.readUInt32LE(0);
    if (buffer.length < length + 4) break;
    messages.push(JSON.parse(buffer.subarray(4, length + 4).toString("utf8")));
    buffer = buffer.subarray(length + 4);
  }
});

function send(message) {
  const payload = Buffer.from(JSON.stringify(message));
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  host.stdin.write(Buffer.concat([header, payload]));
}

async function waitFor(predicate, label) {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const result = messages.find(predicate);
    if (result) return result;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error(`${label} timed out`);
}

try {
  send({ type: "ping", id: "ping" });
  await waitFor(message => message.type === "pong", "native host handshake");
  send({ type: "codex-session-list", id: "list", limit: 12 });
  const list = await waitFor(message => message.type === "codex-session-list-result" && message.id === "list", "session list");
  assert.equal(list.sessions.length, 1);
  assert.equal(list.sessions[0].threadId, threadId);
  assert.equal(list.sessions[0].title, "实现 Session Preview");
  assert.equal(list.sessions[0].state, "completed");

  send({ type: "codex-session-preview", id: "preview", threadId });
  const preview = await waitFor(message => message.type === "codex-session-preview-result" && message.id === "preview", "session preview");
  assert.deepEqual(preview.session.entries.map(entry => entry.role), ["user", "assistant", "assistant"]);
  assert(preview.session.entries.some(entry => entry.phase === "final_answer" && entry.text === "Session Preview 已完成"));
  assert(!JSON.stringify(preview.session).includes("secret"), "Session Preview leaked hidden reasoning or tool output");
  console.log("Codex Session List / Preview 契约验证通过");
} finally {
  host.kill("SIGTERM");
  rmSync(directory, { recursive: true, force: true });
}
