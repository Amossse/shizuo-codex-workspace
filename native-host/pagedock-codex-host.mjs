#!/usr/bin/env node

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readActiveBridgeConfig, resolveBridgeConfigPath } from "./bridge-config.mjs";
import { commandAvailable, executionEnvironment, truncate } from "./runtime-utils.mjs";
import { createCodexSessionObserver } from "./codex-session-observer.mjs";
import { createCollaborationBridge } from "./collaboration-bridge.mjs";
import { createTaskPrompts } from "./task-prompts.mjs";
import { createTerminalController } from "./terminal-controller.mjs";
import { createTaskArtifacts } from "./task-artifacts.mjs";
import { createVideoAdapters } from "./video-adapters.mjs";
import { createTaskRunner } from "./task-runner.mjs";

const HOST_VERSION = "1.11.1";
const MAX_INBOUND_BYTES = 70 * 1024 * 1024;
const MAX_OUTBOUND_BYTES = 900 * 1024;
const MAX_IMAGE_COUNT = 12;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_TOTAL_BYTES = 30 * 1024 * 1024;
const MAX_VIDEO_BYTES = 48 * 1024 * 1024;
const TASK_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const VIDEO_STAGE_TIMEOUT_MS = Object.freeze({
  "building-video": TASK_TIMEOUT_MS,
  "building-audio": TASK_TIMEOUT_MS,
  "checking-audio": TASK_TIMEOUT_MS,
  "regenerating-narration": TASK_TIMEOUT_MS,
  "fallback-han": TASK_TIMEOUT_MS,
  "fallback-tingting": TASK_TIMEOUT_MS,
  "fallback-meijia": TASK_TIMEOUT_MS,
  "repairing-audio": TASK_TIMEOUT_MS,
  "checking-content": TASK_TIMEOUT_MS,
  "repairing-content": TASK_TIMEOUT_MS,
  "checking-video": TASK_TIMEOUT_MS,
  "retrying-video-check": TASK_TIMEOUT_MS,
  "repairing-video": TASK_TIMEOUT_MS,
  "rendering-video": TASK_TIMEOUT_MS,
  "repairing-render": TASK_TIMEOUT_MS,
  "normalizing-audio": TASK_TIMEOUT_MS,
  "packaging-video": TASK_TIMEOUT_MS
});
const DEFAULT_VIDEO_STAGE_TIMEOUT_MS = TASK_TIMEOUT_MS;
const VIDEO_STAGE_LABELS = Object.freeze({
  "building-video": "Codex 视频创作",
  "building-audio": "配音与配乐生成",
  "checking-audio": "配音组装检查",
  "regenerating-narration": "高质量旁白重生成",
  "fallback-han": "Han Premium 旁白降级生成",
  "fallback-tingting": "Tingting 旁白降级生成",
  "fallback-meijia": "Meijia 旁白降级生成",
  "repairing-audio": "音频自动修复",
  "checking-content": "成片内容检查",
  "repairing-content": "画面内容自动修复",
  "checking-video": "HyperFrames 工程检查",
  "retrying-video-check": "HyperFrames 运行时重试",
  "repairing-video": "视频工程自动修复",
  "rendering-video": "HyperFrames 渲染",
  "repairing-render": "渲染运行时修复",
  "normalizing-audio": "最终音频归一化",
  "generating-narration": "Kokoro 正在生成口播",
  "adding-subtitles": "正在合成口播与字幕",
  "packaging-video": "视频文件打包"
});
const OFFICIAL_GSAP_CDN_URL = "https://cdn.jsdelivr.net/npm/gsap@3.13.0/dist/gsap.min.js";
const MIN_OFFICIAL_GSAP_BYTES = 60_000;
const MAX_CONCURRENT_JOBS = 3;
const MAX_CONCURRENT_IMAGE_JOBS = 1;
const MAX_CONCURRENT_VIDEO_JOBS = 1;
const MAX_FAILED_VIDEO_WORKSPACES = 3;
const codexBinary = process.env.PAGEDOCK_CODEX_BIN || "codex";
const agyBinary = process.env.PAGEDOCK_AGY_BIN || "agy";
const hyperframesBinary = process.env.PAGEDOCK_HYPERFRAMES_BIN || "hyperframes";
const remotionBinary = process.env.PAGEDOCK_REMOTION_BIN || "remotion";
const hyperframesBrowserPath = process.env.PAGEDOCK_HYPERFRAMES_BROWSER_PATH || process.env.HYPERFRAMES_BROWSER_PATH || "";
const ffmpegBinary = process.env.PAGEDOCK_FFMPEG_BIN || "ffmpeg";
const ffprobeBinary = process.env.PAGEDOCK_FFPROBE_BIN || (path.isAbsolute(ffmpegBinary)
  ? path.join(path.dirname(ffmpegBinary), "ffprobe")
  : "ffprobe");
const terminalShell = process.env.PAGEDOCK_TERMINAL_SHELL || process.env.SHELL || "/bin/zsh";
const pythonBinary = process.env.PAGEDOCK_REAL_PYTHON || "python3";
const ptyHelper = process.env.PAGEDOCK_PTY_HELPER || path.join(path.dirname(fileURLToPath(import.meta.url)), "pagedock-pty.py");
const codexWorkspace = process.env.PAGEDOCK_CODEX_WORKSPACE || process.cwd();
const codingWorkspace = process.env.PAGEDOCK_CODING_WORKSPACE || codexWorkspace;
const agyBrainRoot = process.env.PAGEDOCK_AGY_BRAIN_DIR || path.join(os.homedir(), ".gemini", "antigravity-cli", "brain");
const codexSessionsRoot = process.env.PAGEDOCK_CODEX_SESSIONS_DIR
  || path.join(process.env.CODEX_HOME || path.join(os.homedir(), ".codex"), "sessions");
const expectedOrigin = process.env.PAGEDOCK_ALLOWED_ORIGIN || "";
const callerOrigin = process.argv[2] || "";
const bridgeConfigPath = resolveBridgeConfigPath();
const hostDirectory = path.dirname(fileURLToPath(import.meta.url));
const installedSkillDirectory = path.join(process.env.CODEX_HOME || path.join(process.env.HOME || "", ".codex"), "skills", "shizuo");
const activeJobs = new Map();
let inputBuffer = Buffer.alloc(0);
let stopLocalCodexSessionMonitor;
let observedCodexSessionStatus = Object.freeze({
  active: false,
  activeCount: 0,
  threadId: "",
  title: "",
  startedAt: 0,
  updatedAt: 0
});

const codexSessionObserver = createCodexSessionObserver({ sessionsRoot: codexSessionsRoot, log });
const collaborationBridge = createCollaborationBridge({ bridgeConfigPath, hostDirectory, installedSkillDirectory, hostVersion: HOST_VERSION, send, log });
const taskPrompts = createTaskPrompts({ codingWorkspace });
const terminalController = createTerminalController({ activeJobs, codingWorkspace, terminalShell, pythonBinary, ptyHelper, taskTimeoutMs: TASK_TIMEOUT_MS, codexEnvironment, send, log, terminateChildTree });
const { openTerminalSession, writeTerminalSession, resizeTerminalSession, closeTerminalSession, runTerminal, shutdownTerminalSessions } = terminalController;
const { buildAnalysisPrompt, buildConversationPrompt, buildCodingPrompt, buildImageGenPrompt, buildAgyImagePrompt, buildHyperframesVideoPrompt, buildRemotionVideoPrompt } = taskPrompts;
const taskArtifacts = createTaskArtifacts({ activeJobs, agyBrainRoot, codexWorkspace, hyperframesBinary, ffmpegBinary, ffprobeBinary, codexEnvironment, materializeVideo, terminateChildTree, send, log, cleanupJob, agyFailureDetail });
const { consumeCodexLine, consumeAgyLine, sendJobProgress, sendVideoArtifact, runVideoPost, stageAgyGeneratedImage, agyImageArtifactSelfTest, agyFailureDetailSelfTest, sendImageArtifact, runHyperframesCommand, runNodeScript, runFfmpegCommand } = taskArtifacts;
const videoAdapters = createVideoAdapters({ activeJobs, codexBinary, hyperframesBinary, remotionBinary, ffmpegBinary, codexEnvironment, send, log, cleanupJob, preserveFailedVideoWorkspace, inspectVideoVisualProject, normalizeVideoProjectScript, ensureOfficialGsapRuntime, sendJobProgress, sendVideoArtifact, sendImageArtifact, stageAgyGeneratedImage, agyFailureDetail, runHyperframesCommand, runNodeScript, runFfmpegCommand, terminateChildTree });
const { hyperframesCheckClassificationSelfTest, finishVideoJob, finishRemotionVideoJob, finishImageGenJob } = videoAdapters;
const runCodex = createTaskRunner({ activeJobs, codexBinary, agyBinary, hyperframesBinary, remotionBinary, codexWorkspace, codingWorkspace, agyBrainRoot, codexEnvironment, send, log, materializeImages, cleanupImages, cleanupJob, terminateChildTree, buildAnalysisPrompt, buildConversationPrompt, buildCodingPrompt, buildImageGenPrompt, buildAgyImagePrompt, buildHyperframesVideoPrompt, buildRemotionVideoPrompt, consumeCodexLine, consumeAgyLine, sendJobProgress, runVideoPost, finishVideoJob, finishRemotionVideoJob, finishImageGenJob });
const { revokeBridgeClientRequest, settlePluginRequest, startBridgeServer, createBridgeShare, stopBridgeShare, shutdownCollaborationBridge } = collaborationBridge;
const { listObservedCodexSessions, previewObservedCodexSession, startCodexSessionMonitor, codexSessionMonitorSelfTest } = codexSessionObserver;

function codexEnvironment() {
  return executionEnvironment({
    binaries: [codexBinary, agyBinary, hyperframesBinary, remotionBinary, ffmpegBinary],
    extra: hyperframesBrowserPath ? { HYPERFRAMES_BROWSER_PATH: hyperframesBrowserPath } : {}
  });
}

function log(message, details) {
  const suffix = details ? ` ${JSON.stringify(details)}` : "";
  process.stderr.write(`[pagedock-codex-host] ${message}${suffix}\n`);
}

function readFileTail(filePath, limit = 64 * 1024) {
  if (!filePath || !fs.existsSync(filePath)) return "";
  const size = fs.statSync(filePath).size;
  const length = Math.min(size, limit);
  const buffer = Buffer.alloc(length);
  const descriptor = fs.openSync(filePath, "r");
  try {
    fs.readSync(descriptor, buffer, 0, length, Math.max(0, size - length));
    return buffer.toString("utf8");
  } finally {
    fs.closeSync(descriptor);
  }
}

function agyFailureDetail(job) {
  const runtimeError = String(job?.runtimeError || "").trim();
  const stderr = String(job?.stderr || "").trim();
  let taskLog = "";
  try {
    taskLog = readFileTail(job?.agyLogPath);
  } catch (error) {
    log("AGY failure log could not be read", { reason: error.message });
  }
  const evidence = `${runtimeError}\n${stderr}\n${taskLog}`;
  if (/User location is not supported for the API use/i.test(evidence)) {
    return "AGY 图像服务不支持当前网络所在地区，请切换到受支持的网络或代理后重试";
  }
  if (/RESOURCE_EXHAUSTED|quota exceeded|insufficient (?:credit|quota)|rate limit/i.test(evidence)) {
    return "AGY 服务额度不足或请求过于频繁，请检查额度后稍后重试";
  }
  if (/UNAUTHENTICATED|not logged in|authentication (?:failed|required)|invalid (?:token|credential)/i.test(evidence)) {
    return "AGY 登录状态已失效，请先在终端重新登录 AGY 后重试";
  }
  const genericTermination = /^Agent execution terminated due to error\.?$/i;
  if (runtimeError && !genericTermination.test(runtimeError)) return runtimeError;
  if (stderr) return stderr;
  const errorLine = taskLog.split(/\r?\n/).reverse().find(line => /agent executor error|FAILED_PRECONDITION|PERMISSION_DENIED|\bERROR\b/i.test(line));
  if (errorLine) {
    return truncate(errorLine.trim()
      .replaceAll(os.homedir(), "~")
      .replace(/(api[_-]?key|token|authorization)(["'=:\s]+)[^\s,;]+/ig, "$1$2[已隐藏]"), 1_200);
  }
  return runtimeError || "AGY 未返回详细错误，请在终端运行 AGY 检查登录和网络状态后重试";
}

function normalizedSpeechText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/[\s\p{P}\p{S}]/gu, "");
}

function htmlAttribute(tag, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag);
  return match?.[1] || "";
}

function analyzeVideoAudioArtifacts(request, meta, indexHtml) {
  const narrationBlocking = [];
  const assemblyBlocking = [];
  const quality = [];
  const lines = Array.isArray(request?.lines)
    ? request.lines.map(line => ({ id: String(line?.id || ""), text: String(line?.text || "").trim() })).filter(line => line.id && line.text)
    : [];
  const voices = Array.isArray(meta?.voices) ? meta.voices : [];
  const provider = String(meta?.tts_provider || request?.provider || "");
  const normalizedProvider = provider.trim().toLowerCase();
  const totalCharacters = lines.reduce((sum, line) => sum + normalizedSpeechText(line.text).length, 0);
  const totalDuration = voices.reduce((sum, voice) => sum + Math.max(0, Number(voice?.duration_s) || 0), 0);

  if (!lines.length) narrationBlocking.push("audio_request.json 没有分场景旁白 lines");
  if (!voices.length) narrationBlocking.push("audio_meta.json 没有生成旁白文件");
  if (!normalizedProvider) narrationBlocking.push("audio_meta.json 没有记录实际配音提供方");
  if (/(?:^|[-_])(system|espeak|say|fallback)(?:$|[-_])/.test(normalizedProvider)) {
    narrationBlocking.push(`不接受机械式系统配音 ${provider}，必须重新生成 HeyGen 中文旁白`);
  }
  if (voices.length && voices.length !== lines.length) narrationBlocking.push(`旁白文件数量 ${voices.length} 与脚本段落 ${lines.length} 不一致`);

  const html = String(indexHtml || "");
  const audioTags = html.match(/<audio\b[^>]*>/gi) || [];
  for (const voice of voices) {
    const filename = path.basename(String(voice?.path || ""));
    if (filename && !audioTags.some(tag => htmlAttribute(tag, "src").includes(filename))) {
      assemblyBlocking.push(`旁白文件 ${filename} 没有挂载到 index.html`);
    }
  }
  return {
    blocking: [...narrationBlocking, ...assemblyBlocking],
    narrationBlocking,
    assemblyBlocking,
    quality,
    diagnostics: [],
    provider,
    totalCharacters,
    totalDuration
  };
}

function inspectVideoAudioProject(projectDirectory) {
  const requestPath = path.join(projectDirectory, "audio_request.json");
  const metaPath = path.join(projectDirectory, "audio_meta.json");
  const indexPath = path.join(projectDirectory, "index.html");
  if (!fs.existsSync(requestPath)) return { blocking: ["缺少 audio_request.json"], narrationBlocking: ["缺少 audio_request.json"], assemblyBlocking: [], quality: [], diagnostics: [] };
  if (!fs.existsSync(metaPath)) return { blocking: ["缺少 audio_meta.json"], narrationBlocking: ["缺少 audio_meta.json"], assemblyBlocking: [], quality: [], diagnostics: [] };
  try {
    return analyzeVideoAudioArtifacts(
      JSON.parse(fs.readFileSync(requestPath, "utf8")),
      JSON.parse(fs.readFileSync(metaPath, "utf8")),
      fs.readFileSync(indexPath, "utf8")
    );
  } catch (error) {
    const issue = `音频工程文件无法读取：${error.message}`;
    return { blocking: [issue], narrationBlocking: [issue], assemblyBlocking: [], quality: [], diagnostics: [] };
  }
}

function visibleHtmlTextForInspection(source) {
  return String(source || "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    // Legitimate implementation code may contain template literals; only inspect text that can reach the rendered DOM.
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:dollar|#36|#x24);/gi, "$")
    .replace(/&(?:lbrace|#123|#x7b);/gi, "{")
    .replace(/&(?:rbrace|#125|#x7d);/gi, "}")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function markdownSectionBody(markdown, title) {
  const heading = new RegExp(`^#{1,6}\\s*${title}\\s*$`, "m").exec(String(markdown || ""));
  if (!heading) return "";
  const remainder = String(markdown || "").slice(heading.index + heading[0].length);
  const nextHeading = /^#{1,6}\s+.+$/m.exec(remainder);
  return (nextHeading ? remainder.slice(0, nextHeading.index) : remainder).trim();
}

function projectHtmlFiles(projectDirectory) {
  const files = [];
  const queue = [{ directory: projectDirectory, depth: 0 }];
  while (queue.length) {
    const { directory, depth } = queue.shift();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      const target = path.join(directory, entry.name);
      if (entry.isFile() && /\.html?$/i.test(entry.name)) files.push(target);
      if (entry.isDirectory() && depth < 4 && !entry.name.startsWith(".")) {
        queue.push({ directory: target, depth: depth + 1 });
      }
    }
  }
  return files;
}

function isOfficialGsapRemoteSource(source) {
  return /^https:\/\/(?:cdn\.jsdelivr\.net\/npm\/gsap@\d+\.\d+\.\d+\/dist\/gsap\.min\.js|unpkg\.com\/gsap@\d+\.\d+\.\d+\/dist\/gsap\.min\.js|cdnjs\.cloudflare\.com\/ajax\/libs\/gsap\/\d+\.\d+\.\d+\/gsap\.min\.js)(?:[?#].*)?$/i.test(source);
}

function isOfficialGsapBundle(bundlePath) {
  if (!fs.existsSync(bundlePath) || !fs.statSync(bundlePath).isFile()) return false;
  if (fs.statSync(bundlePath).size < MIN_OFFICIAL_GSAP_BYTES) return false;
  const header = fs.readFileSync(bundlePath, "utf8").slice(0, 600);
  return /GSAP\s+3\.\d+\.\d+/i.test(header)
    && /https:\/\/gsap\.com/i.test(header)
    && /@license[\s\S]{0,160}GreenSock/i.test(header);
}

function localGsapSourceIsOfficial(projectDirectory, htmlPath, source) {
  let decodedSource;
  try {
    decodedSource = decodeURIComponent(String(source || "").split(/[?#]/, 1)[0]);
  } catch {
    return false;
  }
  const bundlePath = path.resolve(path.dirname(htmlPath), decodedSource);
  const projectRoot = path.resolve(projectDirectory);
  if (bundlePath !== projectRoot && !bundlePath.startsWith(`${projectRoot}${path.sep}`)) return false;
  return isOfficialGsapBundle(bundlePath);
}

// HyperFrames expects the complete GSAP runtime. Tiny handwritten Timeline shims can pass lint but fail during browser startup.
function ensureOfficialGsapRuntime(projectDirectory) {
  const repaired = [];
  const checked = [];
  for (const htmlPath of projectHtmlFiles(projectDirectory)) {
    const source = fs.readFileSync(htmlPath, "utf8");
    let changed = false;
    const next = source.replace(/(<script\b[^>]*\bsrc\s*=\s*)(["'])([^"']*gsap[^"']*)\2/gi, (tag, prefix, quote, scriptSource) => {
      checked.push({ htmlPath, scriptSource });
      if (isOfficialGsapRemoteSource(scriptSource)
          || (!/^https?:\/\//i.test(scriptSource) && localGsapSourceIsOfficial(projectDirectory, htmlPath, scriptSource))) {
        return tag;
      }
      changed = true;
      repaired.push({ htmlPath, scriptSource, replacement: OFFICIAL_GSAP_CDN_URL });
      return `${prefix}${quote}${OFFICIAL_GSAP_CDN_URL}${quote}`;
    });
    if (changed) fs.writeFileSync(htmlPath, next);
  }
  return { checked, repaired };
}

function inspectVideoVisualProject(projectDirectory) {
  const blocking = [];
  const indexPath = path.join(projectDirectory, "index.html");
  const scriptPath = path.join(projectDirectory, "SCRIPT.md");
  if (!fs.existsSync(indexPath)) return { blocking: ["缺少 index.html"], diagnostics: [] };

  const visibleText = visibleHtmlTextForInspection(fs.readFileSync(indexPath, "utf8"));
  const leakedTemplate = /\$\s*\{[\s\S]{0,320}/.exec(visibleText);
  if (leakedTemplate) {
    blocking.push(`画面包含未执行的模板表达式：${leakedTemplate[0].replace(/\s+/g, " ").slice(0, 180)}`);
  }

  if (!fs.existsSync(scriptPath)) {
    blocking.push("缺少 SCRIPT.md，无法确认完整片头和片尾");
  } else {
    const script = fs.readFileSync(scriptPath, "utf8");
    const opening = markdownSectionBody(script, "片头钩子");
    const ending = markdownSectionBody(script, "片尾钩子");
    if (opening.replace(/[\s#>*_`-]/g, "").length < 12) blocking.push("SCRIPT.md 缺少完整的“片头钩子”段落");
    if (ending.replace(/[\s#>*_`-]/g, "").length < 12) blocking.push("SCRIPT.md 缺少完整的“片尾钩子”段落");
  }
  return { blocking, diagnostics: [] };
}

function normalizeVideoProjectScript(workDirectory) {
  const projectDirectory = path.join(workDirectory, "project");
  const target = path.join(projectDirectory, "SCRIPT.md");
  if (fs.existsSync(target)) return false;
  const misplaced = [
    path.join(workDirectory, "SCRIPT.md"),
    path.join(workDirectory, "script.md"),
    path.join(projectDirectory, "script.md")
  ].find(candidate => fs.existsSync(candidate));
  if (!misplaced) return false;
  fs.copyFileSync(misplaced, target);
  log("video script normalized into project", { source: misplaced, target });
  return true;
}

function narrationNeedsDeterministicRepair(report) {
  const issues = Array.isArray(report?.narrationBlocking) ? report.narrationBlocking : (report?.blocking || []);
  return issues.some(issue =>
    /机械式系统配音|没有生成旁白文件|没有记录实际配音提供方|旁白文件数量/.test(issue)
  );
}

function disableVideoBackgroundMusic(projectDirectory) {
  const requestPath = path.join(projectDirectory, "audio_request.json");
  const metaPath = path.join(projectDirectory, "audio_meta.json");
  const indexPath = path.join(projectDirectory, "index.html");
  let bgmPath = "";
  if (fs.existsSync(requestPath)) {
    const request = JSON.parse(fs.readFileSync(requestPath, "utf8"));
    request.bgm = { mode: "none" };
    fs.writeFileSync(requestPath, JSON.stringify(request, null, 2));
  }
  if (fs.existsSync(metaPath)) {
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    bgmPath = String(meta?.bgm?.path || "");
    delete meta.bgm;
    meta.bgm_pending = false;
    meta.pagedock_bgm_disabled = true;
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  }
  if (!bgmPath || !fs.existsSync(indexPath)) return;
  const bgmFilename = path.basename(bgmPath);
  const html = fs.readFileSync(indexPath, "utf8");
  const nextHtml = html.replace(/<audio\b[^>]*>(?:\s*<\/audio\s*>)?/gi, tag => {
    const source = htmlAttribute(tag, "src");
    return source.includes(bgmFilename) ? "" : tag;
  });
  if (nextHtml !== html) fs.writeFileSync(indexPath, nextHtml);
}

function materializeImages(message, id, targetDirectory = "") {
  const sources = Array.isArray(message.images) ? message.images : [];
  if (!sources.length) return { directory: "", paths: [] };
  if (sources.length > MAX_IMAGE_COUNT) throw new Error(`单次最多分析 ${MAX_IMAGE_COUNT} 张图片`);

  const safeId = id.replace(/[^a-z0-9_-]/gi, "-").slice(0, 60) || "task";
  const directory = targetDirectory
    ? fs.mkdirSync(targetDirectory, { recursive: true }) || targetDirectory
    : fs.mkdtempSync(path.join(codexWorkspace, `.pagedock-${safeId}-`));
  const paths = [];
  let totalBytes = 0;
  try {
    sources.forEach((source, index) => {
      const matched = String(source || "").match(/^data:image\/(png|jpe?g|webp);base64,([a-z0-9+/=\s]+)$/i);
      if (!matched) throw new Error(`第 ${index + 1} 张图片格式不受支持，请使用 PNG、JPEG 或 WebP`);
      const bytes = Buffer.from(matched[2].replace(/\s/g, ""), "base64");
      if (!bytes.length) throw new Error(`第 ${index + 1} 张图片内容为空`);
      if (bytes.length > MAX_IMAGE_BYTES) throw new Error(`第 ${index + 1} 张图片超过 10 MB`);
      totalBytes += bytes.length;
      if (totalBytes > MAX_IMAGE_TOTAL_BYTES) throw new Error("圈选图片总大小超过 30 MB");
      const extension = matched[1].toLowerCase().replace("jpg", "jpeg");
      const filePath = path.join(directory, `image-${index + 1}.${extension}`);
      fs.writeFileSync(filePath, bytes, { mode: 0o600 });
      paths.push(filePath);
    });
    return { directory, paths };
  } catch (error) {
    fs.rmSync(directory, { recursive: true, force: true });
    throw error;
  }
}

function materializeVideo(message, targetDirectory) {
  const matched = String(message.video || "").match(/^data:video\/mp4;base64,([a-z0-9+/=\s]+)$/i);
  if (!matched) throw new Error("只支持拾作生成的 MP4 视频");
  const bytes = Buffer.from(matched[1].replace(/\s/g, ""), "base64");
  if (!bytes.length) throw new Error("视频内容为空");
  if (bytes.length > MAX_VIDEO_BYTES) throw new Error("视频超过 48 MB，无法添加口播");
  fs.mkdirSync(targetDirectory, { recursive: true });
  const target = path.join(targetDirectory, "source.mp4");
  fs.writeFileSync(target, bytes, { mode: 0o600 });
  return target;
}

function cleanupImages(job) {
  if (!job?.imageDirectory) return;
  fs.rmSync(job.imageDirectory, { recursive: true, force: true });
  job.imageDirectory = "";
}

function cleanupJob(job) {
  if (job?.agyLogDirectory) {
    fs.rmSync(job.agyLogDirectory, { recursive: true, force: true });
    job.agyLogDirectory = "";
    job.agyLogPath = "";
  }
  if (job?.workDirectory) {
    fs.rmSync(job.workDirectory, { recursive: true, force: true });
    job.workDirectory = "";
    job.imageDirectory = "";
    return;
  }
  cleanupImages(job);
}

function preserveFailedVideoWorkspace(job, id) {
  const source = String(job?.workDirectory || "");
  if (!source || !fs.existsSync(path.join(source, "project", "index.html"))) return "";
  const safeId = String(id || "task").replace(/[^a-z0-9_-]/gi, "-").slice(0, 60) || "task";
  const timestamp = new Date().toISOString().replace(/[-:.]/g, "");
  const target = path.join(codexWorkspace, `.pagedock-video-failed-${safeId}-${timestamp}`);
  try {
    fs.renameSync(source, target);
    fs.chmodSync(target, 0o700);
    job.workDirectory = "";
    job.imageDirectory = "";
    const preserved = fs.readdirSync(codexWorkspace, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name.startsWith(".pagedock-video-failed-"))
      .map(entry => {
        const directory = path.join(codexWorkspace, entry.name);
        return { directory, modifiedAt: fs.statSync(directory).mtimeMs };
      })
      .sort((left, right) => right.modifiedAt - left.modifiedAt);
    for (const stale of preserved.slice(MAX_FAILED_VIDEO_WORKSPACES)) {
      fs.rmSync(stale.directory, { recursive: true, force: true });
    }
    return target;
  } catch (error) {
    log("failed video workspace preservation failed", { id, reason: error.message });
    return "";
  }
}

function terminateChildTree(child) {
  if (!child || child.exitCode !== null) return;
  try {
    if (process.platform !== "win32" && child.pid) process.kill(-child.pid, "SIGTERM");
    else child.kill("SIGTERM");
  } catch (_) {
    try { child.kill("SIGTERM"); } catch (_) {}
  }
}

function send(message) {
  let payload = Buffer.from(JSON.stringify(message), "utf8");
  if (payload.length > MAX_OUTBOUND_BYTES) {
    payload = Buffer.from(JSON.stringify({
      type: "error",
      id: message?.id || "",
      error: "Codex 返回内容超过 Native Messaging 单条消息限制"
    }), "utf8");
  }
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  return process.stdout.write(Buffer.concat([header, payload]));
}

function cancelJob(message, missingType = "cancelled") {
  const id = String(message.id || "");
  const job = activeJobs.get(id);
  if (!job) return send({ type: missingType, id });
  job.cancelled = true;
  clearTimeout(job.timer);
  terminateChildTree(job.child);
  activeJobs.delete(id);
  send({ type: job.mode === "terminal" ? "terminal-cancelled" : "cancelled", id });
}

async function handleMessage(message) {
  try {
    if (!message || typeof message !== "object") throw new Error("Native Messaging 请求格式错误");
    if (message.type === "plugin-response") {
      settlePluginRequest(message);
      return;
    }
    if (message.type === "ping") {
      if (!stopLocalCodexSessionMonitor) {
        stopLocalCodexSessionMonitor = startCodexSessionMonitor(status => {
          observedCodexSessionStatus = status;
          send({ type: "local-codex-session-status", status });
        });
      }
      const bridgeConfig = readActiveBridgeConfig(bridgeConfigPath);
      send({
        type: "pong",
        id: String(message.id || ""),
        hostVersion: HOST_VERSION,
        codexAvailable: commandAvailable(codexBinary),
        agyAvailable: commandAvailable(agyBinary),
        hyperframesAvailable: commandAvailable(hyperframesBinary),
        remotionAvailable: commandAvailable(remotionBinary),
        codingWorkspace,
        terminalAvailable: commandAvailable(terminalShell),
        terminalPtyAvailable: commandAvailable(pythonBinary) && fs.existsSync(ptyHelper),
        terminalWorkspace: codingWorkspace,
        externalBridgeEnabled: Boolean(bridgeConfig),
        externalBridgeScope: bridgeConfig?.lan ? "lan" : bridgeConfig ? "local" : "disabled",
        externalBridgePort: bridgeConfig?.port || 0,
        localCodexSessionStatus: observedCodexSessionStatus,
        maxConcurrentTasks: MAX_CONCURRENT_JOBS,
        maxConcurrentImageTasks: MAX_CONCURRENT_IMAGE_JOBS,
        maxConcurrentVideoTasks: MAX_CONCURRENT_VIDEO_JOBS
      });
      return;
    }
    if (message.type === "codex-session-list") {
      send({ type: "codex-session-list-result", id: String(message.id || ""), sessions: listObservedCodexSessions(message.limit) });
      return;
    }
    if (message.type === "codex-session-preview") {
      try {
        send({ type: "codex-session-preview-result", id: String(message.id || ""), session: previewObservedCodexSession(message.threadId) });
      } catch (error) {
        send({ type: "codex-session-error", id: String(message.id || ""), error: error?.message || String(error) });
      }
      return;
    }
    if (message.type === "bridge-share-create") return await createBridgeShare(message);
    if (message.type === "bridge-share-stop") return await stopBridgeShare(message);
    if (message.type === "bridge-client-revoke") return revokeBridgeClientRequest(message);
    if (message.type === "run") return await runCodex(message);
    if (message.type === "terminal-run") return runTerminal(message);
    if (message.type === "terminal-session-open") return openTerminalSession(message);
    if (message.type === "terminal-session-input") return writeTerminalSession(message);
    if (message.type === "terminal-session-resize") return resizeTerminalSession(message);
    if (message.type === "terminal-session-close") return closeTerminalSession(message);
    if (message.type === "cancel") return cancelJob(message);
    if (message.type === "terminal-cancel") return cancelJob(message, "terminal-cancelled");
    throw new Error("不支持的 Native Messaging 请求类型");
  } catch (error) {
    const requestType = String(message?.type || "");
    const type = requestType.startsWith("terminal-")
      ? "terminal-error"
      : requestType.startsWith("bridge-share-") || requestType.startsWith("bridge-client-")
        ? requestType.startsWith("bridge-client-") ? "bridge-client-error" : "bridge-share-error"
        : "error";
    send({ type, id: String(message?.id || ""), error: error.message });
  }
}

function drainInput() {
  while (inputBuffer.length >= 4) {
    const messageLength = inputBuffer.readUInt32LE(0);
    if (messageLength <= 0 || messageLength > MAX_INBOUND_BYTES) {
      log("invalid inbound message length", { messageLength });
      process.exit(1);
    }
    if (inputBuffer.length < messageLength + 4) return;
    const payload = inputBuffer.subarray(4, messageLength + 4);
    inputBuffer = inputBuffer.subarray(messageLength + 4);
    try {
      Promise.resolve(handleMessage(JSON.parse(payload.toString("utf8")))).catch(error => {
        send({ type: "error", id: "", error: `请求执行失败：${error.message}` });
      });
    } catch (error) {
      send({ type: "error", id: "", error: `无法解析请求：${error.message}` });
    }
  }
}

async function commandVersion(binary, options = {}) {
  const child = spawn(binary, ["--version"], {
    env: codexEnvironment(),
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  let errorOutput = "";
  child.stdout.on("data", chunk => { output += chunk.toString("utf8"); });
  child.stderr.on("data", chunk => { errorOutput += chunk.toString("utf8"); });
  const code = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", resolve);
  });
  const versionOutput = `${output}\n${errorOutput}`.trim();
  if (code !== 0 && !(options.acceptOutput instanceof RegExp && options.acceptOutput.test(versionOutput))) {
    throw new Error(errorOutput.trim() || `${path.basename(binary)} 退出码 ${code}`);
  }
  return options.acceptOutput ? versionOutput.match(options.acceptOutput)?.[0] || versionOutput : versionOutput;
}

function videoVisualSelfTest() {
  const directory = fs.mkdtempSync(path.join(process.env.TMPDIR || "/tmp", "shizuo-video-visual-self-test-"));
  const validScript = [
    "## 片头钩子",
    "十二个仓库同时上榜，但真正值得看的，是它们背后的共同方向。",
    "",
    "## 主体",
    "从榜单结构中解释开发者正在关注的能力。",
    "",
    "## 片尾钩子",
    "今天的排序只是切片，下一次变化会来自哪个方向？"
  ].join("\n");
  try {
    const misplacedDirectory = path.join(directory, "misplaced-script");
    fs.mkdirSync(path.join(misplacedDirectory, "project"), { recursive: true });
    fs.writeFileSync(path.join(misplacedDirectory, "SCRIPT.md"), validScript);
    if (!normalizeVideoProjectScript(misplacedDirectory)
        || !fs.existsSync(path.join(misplacedDirectory, "project", "SCRIPT.md"))) {
      throw new Error("任务根目录中的 SCRIPT.md 没有归位到 HyperFrames 工程");
    }

    fs.writeFileSync(path.join(directory, "SCRIPT.md"), validScript);
    fs.writeFileSync(
      path.join(directory, "index.html"),
      '<script>const render = items => `${items.map(item => item.name).join("")}`;</script><main>十二个仓库，一个共同方向。</main>'
    );
    const valid = inspectVideoVisualProject(directory);
    if (valid.blocking.length) throw new Error(`视频画面检查器误伤合法脚本：${valid.blocking.join("；")}`);

    fs.writeFileSync(
      path.join(directory, "index.html"),
      '<main>&#36;&#123;[1,2,3].map((n) => `<span>${n}</span>`).join("")}</main>'
    );
    const leaked = inspectVideoVisualProject(directory);
    if (!leaked.blocking.some(issue => issue.includes("未执行的模板表达式"))) {
      throw new Error("视频画面检查器没有阻断可见模板源码");
    }

    fs.writeFileSync(path.join(directory, "index.html"), "<main>正常画面</main>");
    fs.writeFileSync(path.join(directory, "SCRIPT.md"), "## 主体\n只有主体内容。");
    const incompleteNarrative = inspectVideoVisualProject(directory);
    if (!incompleteNarrative.blocking.some(issue => issue.includes("片头钩子"))
        || !incompleteNarrative.blocking.some(issue => issue.includes("片尾钩子"))) {
      throw new Error("视频画面检查器没有阻断不完整的片头或片尾");
    }
    return "ok";
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

function videoStageTimeoutSelfTest() {
  const configuredTimeouts = [
    ANALYSIS_JOB_TIMEOUT_MS,
    CODING_JOB_TIMEOUT_MS,
    DEFAULT_VIDEO_STAGE_TIMEOUT_MS,
    ...Object.values(VIDEO_STAGE_TIMEOUT_MS)
  ];
  if (configuredTimeouts.some(timeoutMs => timeoutMs !== TASK_TIMEOUT_MS)) {
    throw new Error("拾作用户任务超时没有统一为 24 小时");
  }
  return "ok";
}

async function selfTest() {
  const profile = ["core", "terminal", "video"].includes(process.env.PAGEDOCK_SELF_TEST_PROFILE)
    ? process.env.PAGEDOCK_SELF_TEST_PROFILE
    : "video";
  if (!fs.existsSync(codingWorkspace)) throw new Error(`Codex 编码工作区不存在：${codingWorkspace}`);
  if (!commandAvailable(codexBinary)) throw new Error(`Codex CLI 不可用：${codexBinary}`);
  if (profile !== "core" && !commandAvailable(terminalShell)) throw new Error(`控制台 Shell 不可用：${terminalShell}`);
  if (profile !== "core" && (!commandAvailable(pythonBinary) || !fs.existsSync(ptyHelper))) throw new Error("交互终端 PTY 组件不可用");
  const hyperframesReady = commandAvailable(hyperframesBinary);
  const remotionReady = commandAvailable(remotionBinary);
  if (profile === "video" && !hyperframesReady && !remotionReady) throw new Error("HyperFrames 与 Remotion 均不可用");
  const [codex, hyperframes, remotion, terminal] = await Promise.all([
    commandVersion(codexBinary),
    profile === "video" && hyperframesReady ? commandVersion(hyperframesBinary) : Promise.resolve(profile === "video" ? "not-installed" : "not-required"),
    // Remotion CLI 4 prints its version banner for --version but exits with 1; validate the banner instead of the exit code.
    profile === "video" && remotionReady ? commandVersion(remotionBinary, { acceptOutput: /@remotion\/cli\s+\d+\.\d+\.\d+/ }) : Promise.resolve(profile === "video" ? "not-installed" : "not-required"),
    profile === "core" ? Promise.resolve("not-required") : commandVersion(terminalShell)
  ]);
  const videoVisualValidator = profile === "video" ? videoVisualSelfTest() : "not-required";
  const hyperframesCheckClassifier = profile === "video" ? hyperframesCheckClassificationSelfTest() : "not-required";
  const videoStageTimeouts = profile === "video" ? videoStageTimeoutSelfTest() : "not-required";
  process.stdout.write(JSON.stringify({ ok: true, profile, hostVersion: HOST_VERSION, codex, codingWorkspace, terminal, terminalPty: profile === "core" ? "not-required" : "ok", hyperframes, remotion, audio: profile === "video" ? "kokoro-post" : "not-required", videoVisualValidator, hyperframesCheckClassifier, videoStageTimeouts }));
}

if (process.argv.includes("--agy-image-artifact-self-test")) {
  process.stdout.write(agyImageArtifactSelfTest());
} else if (process.argv.includes("--agy-failure-detail-self-test")) {
  process.stdout.write(agyFailureDetailSelfTest());
} else if (process.argv.includes("--hyperframes-check-self-test")) {
  process.stdout.write(hyperframesCheckClassificationSelfTest());
} else if (process.argv.includes("--codex-session-monitor-self-test")) {
  process.stdout.write(codexSessionMonitorSelfTest());
} else if (process.argv.includes("--video-visual-self-test")) {
  process.stdout.write(videoVisualSelfTest());
} else if (process.argv.includes("--self-test")) {
  selfTest().catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
} else {
  if (expectedOrigin && callerOrigin !== expectedOrigin) {
    log("rejected caller origin", { callerOrigin });
    process.exit(1);
  }
  startBridgeServer().catch(error => {
    log("external bridge failed to start", { reason: error.message });
  });
  process.stdin.on("data", chunk => {
    inputBuffer = Buffer.concat([inputBuffer, chunk]);
    drainInput();
  });
  process.stdin.on("error", error => {
    log("stdin failed", { reason: error.message });
    process.exit(1);
  });
  process.stdin.on("end", () => {
    stopLocalCodexSessionMonitor?.();
    stopLocalCodexSessionMonitor = undefined;
    for (const job of activeJobs.values()) terminateChildTree(job.child);
    // Chrome 关闭 Native Messaging 管道时同时回收所有 PTY。
    shutdownTerminalSessions();
    shutdownCollaborationBridge();
  });
}
