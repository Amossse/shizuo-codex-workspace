import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const directory = mkdtempSync(join(tmpdir(), "shizuo-process-stream-"));
const fakeCodex = join(directory, "codex");
writeFileSync(fakeCodex, `#!/usr/bin/env node
const fs = require("node:fs");
const path = require("node:path");
let prompt = "";
process.stdin.on("data", chunk => { prompt += chunk.toString("utf8"); });
process.stdin.on("end", () => {
  if (prompt.includes("AI 自由绘图任务")) {
    fs.mkdirSync(path.join(process.cwd(), "output"), { recursive: true });
    fs.writeFileSync(path.join(process.cwd(), "output", "generated.png"), Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+XIPY1QAAAABJRU5ErkJggg==", "base64"));
  }
  const events = [
    { type: "thread.started", thread_id: "thread-test" },
    { type: "item.started", item: { type: "reasoning" } },
    { type: "item.completed", item: { type: "reasoning" } },
    { type: "item.started", item: { type: "command_execution", command: "API_TOKEN=secret npm test" } },
    { type: "item.completed", item: { type: "command_execution", command: "API_TOKEN=secret npm test", exit_code: 0 } },
    { type: "item.completed", item: { type: "agent_message", text: "完成" } }
  ];
  process.stdout.write(events.map(event => JSON.stringify(event)).join("\\n") + "\\n");
});
`);
chmodSync(fakeCodex, 0o755);

const host = spawn(process.execPath, [join(root, "native-host/pagedock-codex-host.mjs")], {
  cwd: root,
  env: {
    ...process.env,
    PAGEDOCK_CODEX_BIN: fakeCodex,
    PAGEDOCK_CODEX_WORKSPACE: root,
    PAGEDOCK_CODING_WORKSPACE: root
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

const payload = Buffer.from(JSON.stringify({
  type: "run",
  id: "process-test",
  mode: "coding",
  prompt: "运行测试",
  page: { title: "测试", content: "测试素材" }
}));
const header = Buffer.alloc(4);
header.writeUInt32LE(payload.length, 0);
host.stdin.write(Buffer.concat([header, payload]));

function sendNativeMessage(message) {
  const body = Buffer.from(JSON.stringify(message));
  const frameHeader = Buffer.alloc(4);
  frameHeader.writeUInt32LE(body.length, 0);
  host.stdin.write(Buffer.concat([frameHeader, body]));
}

try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Native Host process stream test timed out")), 5_000);
    const poll = setInterval(() => {
      if (!messages.some(message => message.type === "done")) return;
      clearTimeout(timeout);
      clearInterval(poll);
      resolve();
    }, 20);
  });
  const progress = messages.filter(message => message.type === "progress");
  assert(progress.some(message => message.stage === "thinking"), "missing thinking progress");
  assert(progress.some(message => message.stage === "running-command" && /npm test/.test(message.detail)), "missing command progress");
  assert(progress.every(message => !JSON.stringify(message).includes("API_TOKEN=secret")), "process events leaked a secret");
  assert.equal(messages.find(message => message.type === "done")?.answer, "完成");

  sendNativeMessage({
    type: "run",
    id: "image-gen-test",
    mode: "image-gen",
    prompt: "生成一张强调结构关系的图片",
    page: { title: "图片测试", content: "节点 A 推动节点 B" }
  });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Native Host image-gen artifact test timed out")), 5_000);
    const poll = setInterval(() => {
      if (!messages.some(message => message.id === "image-gen-test" && ["done", "error"].includes(message.type))) return;
      clearTimeout(timeout);
      clearInterval(poll);
      resolve();
    }, 20);
  });
  const imageMessages = messages.filter(message => message.id === "image-gen-test");
  assert(!imageMessages.some(message => message.type === "error"), "image-gen artifact flow returned an error");
  assert(imageMessages.some(message => message.type === "progress" && message.stage === "generating-image"), "missing image-gen progress");
  assert.equal(imageMessages.find(message => message.type === "artifact-start")?.artifactType, "image");
  assert(imageMessages.some(message => message.type === "artifact-chunk" && message.data), "missing image artifact chunk");
  assert(imageMessages.some(message => message.type === "artifact-done"), "missing image artifact completion");
  assert(imageMessages.some(message => message.type === "done"), "missing image-gen completion");
  console.log(`Native Host 过程流验证通过：${progress.length} 个过程事件，image-gen 图片产物回传通过`);
} finally {
  host.kill("SIGTERM");
  rmSync(directory, { recursive: true, force: true });
}
