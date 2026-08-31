#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const extensionIdPattern = /^[a-p]{32}$/;

function normalizedPath(value) {
  const absolute = path.resolve(String(value || ""));
  try {
    return fs.realpathSync.native(absolute);
  } catch {
    return absolute;
  }
}

function browserRoots() {
  const override = String(process.env.SHIZUO_CHROMIUM_ROOTS || "").trim();
  if (override) return override.split(path.delimiter).filter(Boolean);
  return [
    path.join(os.homedir(), "Library/Application Support/Google/Chrome"),
    path.join(os.homedir(), "Library/Application Support/Microsoft Edge")
  ];
}

function profileDirectories(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && (entry.name === "Default" || /^Profile \d+$/.test(entry.name)))
    .map(entry => path.join(root, entry.name));
}

function extensionSettings(profileDirectory) {
  const settings = [];
  for (const filename of ["Preferences", "Secure Preferences"]) {
    try {
      const parsed = JSON.parse(fs.readFileSync(path.join(profileDirectory, filename), "utf8"));
      settings.push(parsed?.extensions?.settings || {});
    } catch {
      // Chrome may rewrite one preference file while installation is running; the other file can still identify the extension.
    }
  }
  return settings;
}

function possiblePaths(rawPath, root, profileDirectory) {
  if (!rawPath) return [];
  if (path.isAbsolute(rawPath)) return [rawPath];
  return [path.resolve(profileDirectory, rawPath), path.resolve(root, rawPath)];
}

export function detectExtensionIds(projectDirectory, roots = browserRoots()) {
  const expectedPath = normalizedPath(projectDirectory);
  const matches = new Set();
  for (const root of roots) {
    for (const profileDirectory of profileDirectories(root)) {
      for (const settings of extensionSettings(profileDirectory)) {
        for (const [extensionId, details] of Object.entries(settings)) {
          if (!extensionIdPattern.test(extensionId)) continue;
          const paths = possiblePaths(details?.path, root, profileDirectory).map(normalizedPath);
          if (paths.includes(expectedPath)) matches.add(extensionId);
        }
      }
    }
  }
  return [...matches].sort();
}

if (fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || "")) {
  const projectDirectory = process.argv[2];
  if (!projectDirectory) {
    console.error("用法：detect-extension-id.mjs <拾作扩展目录>");
    process.exit(2);
  }
  const matches = detectExtensionIds(projectDirectory);
  if (matches.length === 1) {
    process.stdout.write(`${matches[0]}\n`);
  } else if (matches.length > 1) {
    console.error(`检测到多个拾作扩展 ID：${matches.join(", ")}`);
    process.exit(2);
  } else {
    process.exit(1);
  }
}
