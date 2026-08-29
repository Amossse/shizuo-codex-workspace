import fs from "node:fs";
import path from "node:path";

/**
 * Build the PATH inherited by local runtimes without mutating process.env.
 * Absolute tool overrides are promoted so child processes can find companion binaries.
 */
export function executionEnvironment({ binaries = [], extra = {}, nodeExecutable = process.execPath, searchPath = process.env.PATH || "/usr/bin:/bin" } = {}) {
  const nodeDirectory = path.dirname(nodeExecutable);
  const toolDirectories = binaries
    .filter(tool => path.isAbsolute(tool))
    .map(tool => path.dirname(tool));
  const pathEntries = [nodeDirectory, ...toolDirectories, ...searchPath.split(path.delimiter)].filter(Boolean);
  return {
    ...process.env,
    ...extra,
    PATH: [...new Set(pathEntries)].join(path.delimiter)
  };
}

export function commandAvailable(command, searchPath = process.env.PATH || "") {
  if (path.isAbsolute(command)) return fs.existsSync(command);
  return searchPath.split(path.delimiter)
    .filter(Boolean)
    .some(directory => fs.existsSync(path.join(directory, command)));
}

export function truncate(value, limit) {
  const text = String(value || "");
  return text.length > limit ? `${text.slice(0, limit)}\n\n[内容已截断]` : text;
}

export function appendBoundedOutput(current, chunk, limit) {
  const combined = current + String(chunk || "");
  if (combined.length <= limit) return combined;
  const marker = "\n\n[中间日志已截断，保留末尾错误]\n\n";
  const headLength = Math.min(4_000, Math.floor((limit - marker.length) / 3));
  return combined.slice(0, headLength) + marker + combined.slice(-(limit - headLength - marker.length));
}

export function errorTail(value, limit) {
  const text = String(value || "").replace(/\u001b\[[0-?]*[ -\/]*[@-~]/g, "").trim();
  return text.length > limit ? `[前序渲染日志已省略]\n${text.slice(-limit)}` : text;
}
