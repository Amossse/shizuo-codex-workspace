import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const manifest = JSON.parse(readFileSync(path.join(root, "manifest.json"), "utf8"));
const version = String(packageJson.version || "");
const requireTag = process.argv.includes("--require-tag");
const outputArgument = process.argv.find(argument => argument.startsWith("--output="));
const outputDirectory = path.resolve(root, outputArgument ? outputArgument.slice("--output=".length) : "artifacts");

if (!/^\d+\.\d+\.\d+$/.test(version) || manifest.version !== version) {
  throw new Error("package.json 与 manifest.json 必须使用相同的 SemVer 版本");
}

const status = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" }).trim();
if (status) throw new Error("发布打包前工作区必须干净，避免把未提交内容误当成正式版本");

if (requireTag) {
  const currentTag = execFileSync("git", ["describe", "--exact-match", "--tags", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  if (currentTag !== `v${version}`) throw new Error(`当前提交必须由 v${version} 精确标记`);
}

const rootFiles = new Set([
  "LICENSE",
  "PRIVACY.md",
  "README.md",
  "SECURITY.md",
  "THIRD_PARTY_NOTICES.md",
  "background.js",
  "board-domain.js",
  "card-protocol.js",
  "content-capture.js",
  "content-codex.js",
  "editor.html",
  "editor.js",
  "install.sh",
  "manifest.json",
  "offscreen.html",
  "offscreen.js",
  "pagedock-db.js",
  "paper-theme.css",
  "popup.html",
  "popup.js",
  "sidepanel.html",
  "sidepanel.js",
  "tokens.css",
  "whiteboard.html",
  "whiteboard.js"
]);
const runtimeDirectories = ["icons/", "native-host/", "skills/", "vendor/"];
const trackedFiles = execFileSync("git", ["ls-files", "-z"], { cwd: root })
  .toString("utf8")
  .split("\0")
  .filter(Boolean);
const releaseFiles = trackedFiles
  .filter(file => rootFiles.has(file) || runtimeDirectories.some(directory => file.startsWith(directory)))
  .sort();

for (const required of ["manifest.json", "install.sh", "native-host/pagedock-codex-host.mjs", "skills/shizuo/SKILL.md", "vendor/markdown/purify.min.js"]) {
  if (!releaseFiles.includes(required)) throw new Error(`发布包缺少运行文件：${required}`);
}

mkdirSync(outputDirectory, { recursive: true });
const archiveName = `shizuo-codex-workspace-${version}.zip`;
const archivePath = path.join(outputDirectory, archiveName);
const checksumPath = path.join(outputDirectory, "SHA256SUMS.txt");
for (const target of [archivePath, checksumPath]) {
  if (existsSync(target)) rmSync(target);
}

execFileSync("git", [
  "archive",
  "--format=zip",
  `--prefix=shizuo-codex-workspace-${version}/`,
  `--output=${archivePath}`,
  "HEAD",
  "--",
  ...releaseFiles
], { cwd: root, stdio: "inherit" });

const digest = createHash("sha256").update(readFileSync(archivePath)).digest("hex");
writeFileSync(checksumPath, `${digest}  ${archiveName}\n`);
console.log(`发布包已生成：${path.relative(root, archivePath)}（${releaseFiles.length} 个文件）`);
console.log(`SHA-256：${digest}`);
