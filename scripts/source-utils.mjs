import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export const projectRoot = path.resolve(import.meta.dirname, "..");

export function readSource(file) {
  return readFileSync(path.join(projectRoot, file), "utf8");
}

function referencedFiles(source, pattern) {
  return [...source.matchAll(pattern)].map(match => match[1]);
}

export function whiteboardScriptFiles() {
  return referencedFiles(readSource("whiteboard.html"), /<script src="(whiteboard\/[^"]+\.js)"><\/script>/g);
}

export function readWhiteboardSource() {
  return whiteboardScriptFiles().map(readSource).join("\n");
}

export function backgroundScriptFiles() {
  return referencedFiles(readSource("background.js"), /"(background\/[^"]+\.js)"/g);
}

export function readBackgroundSource() {
  return ["background.js", ...backgroundScriptFiles()].map(readSource).join("\n");
}

export function readWhiteboardStyles() {
  return readSource("whiteboard/whiteboard.css");
}

export function nativeHostModuleFiles() {
  return readdirSync(path.join(projectRoot, "native-host"))
    .filter(file => file.endsWith(".mjs"))
    .map(file => `native-host/${file}`)
    .sort();
}

export function readNativeHostSource() {
  return nativeHostModuleFiles().map(readSource).join("\n");
}
