import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => readFileSync(path.join(root, file), "utf8");
const packageJson = JSON.parse(read("package.json"));
const manifest = JSON.parse(read("manifest.json"));
const version = packageJson.version;

assert.equal(manifest.version, version);
const readme = read("README.md");
assert.match(readme, /releases\/latest/);
assert.match(readme, /docs\/local-codex-setup\.md/);
assert.match(read("CHANGELOG.md"), new RegExp(`## \\[${version.replaceAll(".", "\\.")}\\]`));
assert(existsSync(path.join(root, `docs/release-v${version}.md`)));
assert.match(read("SECURITY.md"), new RegExp(`\\| ${version.split(".").slice(0, 2).join("\\.")}\\.x \\| ✅ \\|`));

const privacy = read("PRIVACY.md");
for (const permission of manifest.permissions) assert(privacy.includes(`\`${permission}\``), `PRIVACY.md 缺少 ${permission} 权限说明`);
assert(privacy.includes("`<all_urls>`"));
assert(privacy.includes("Optional `http://*/*` / `https://*/*`"));

for (const file of [
  ".github/workflows/ci.yml",
  ".github/workflows/release.yml",
  ".github/ISSUE_TEMPLATE/bug.yml",
  ".github/ISSUE_TEMPLATE/feature.yml",
  ".github/ISSUE_TEMPLATE/setup.yml",
  ".github/ISSUE_TEMPLATE/config.yml",
  ".github/pull_request_template.md"
]) assert(existsSync(path.join(root, file)), `缺少开源治理文件：${file}`);

assert.match(read("scripts/package-release.mjs"), /git[\s\S]+archive/);
assert.match(read("scripts/package-release.mjs"), /rootFiles/);
assert.match(read(".github/workflows/release.yml"), /--require-tag/);
assert.match(read(".github/workflows/release.yml"), /SHA256SUMS\.txt/);
assert.match(read(".github/workflows/release.yml"), /cd artifacts && sha256sum --check SHA256SUMS\.txt/);
assert.match(readme, /^## 快速开始$/m);
assert.match(readme, /^## 工程结构$/m);

console.log(`拾作 ${version} 发布契约验证通过`);
