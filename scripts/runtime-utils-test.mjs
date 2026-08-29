import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { appendBoundedOutput, commandAvailable, errorTail, executionEnvironment, truncate } from "../native-host/runtime-utils.mjs";

const nodeDirectory = path.dirname(process.execPath);
const toolDirectory = path.join(os.tmpdir(), "shizuo-runtime-bin");
const environment = executionEnvironment({
  binaries: [path.join(toolDirectory, "ffmpeg"), path.join(toolDirectory, "ffprobe")],
  extra: { SHIZUO_TEST_RUNTIME: "yes" },
  searchPath: ["/usr/bin", nodeDirectory].join(path.delimiter)
});
const pathEntries = environment.PATH.split(path.delimiter);
assert.equal(pathEntries[0], nodeDirectory);
assert.equal(pathEntries[1], toolDirectory);
assert.equal(pathEntries.filter(entry => entry === nodeDirectory).length, 1);
assert.equal(environment.SHIZUO_TEST_RUNTIME, "yes");

assert.equal(commandAvailable(process.execPath), true);
assert.equal(commandAvailable("definitely-not-a-shizuo-command", toolDirectory), false);
assert.equal(truncate("abcdef", 3), "abc\n\n[内容已截断]");
assert.equal(truncate("abc", 3), "abc");

const bounded = appendBoundedOutput("start", "x".repeat(300), 120);
assert(bounded.length <= 120);
assert(bounded.includes("中间日志已截断"));
assert(bounded.endsWith("x".repeat(20)));

assert.equal(errorTail("\u001b[31merror\u001b[0m", 20), "error");
assert.match(errorTail("a".repeat(50), 10), /^\[前序渲染日志已省略\]\n/);

console.log("Native Host 运行时工具验证通过");
