import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { appendBoundedOutput, commandAvailable, truncate } from "./runtime-utils.mjs";

const TASK_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const ANALYSIS_JOB_TIMEOUT_MS = TASK_TIMEOUT_MS;
const CODING_JOB_TIMEOUT_MS = TASK_TIMEOUT_MS;
const MAX_CONCURRENT_JOBS = 3;
const MAX_CONCURRENT_IMAGE_JOBS = 1;
const MAX_CONCURRENT_VIDEO_JOBS = 1;
const MAX_RESULT_CHARS = 200_000;

// Selects a Runtime Adapter and supervises one local task from start through cleanup.
export function createTaskRunner(dependencies) {
  const { activeJobs, codexBinary, agyBinary, hyperframesBinary, remotionBinary, codexWorkspace, codingWorkspace, agyBrainRoot, codexEnvironment, send, log, materializeImages, cleanupImages, cleanupJob, terminateChildTree, buildAnalysisPrompt, buildConversationPrompt, buildCodingPrompt, buildImageGenPrompt, buildAgyImagePrompt, buildHyperframesVideoPrompt, buildRemotionVideoPrompt, consumeCodexLine, consumeAgyLine, sendJobProgress, runVideoPost, finishVideoJob, finishRemotionVideoJob, finishImageGenJob } = dependencies;
  async function runCodex(message) {
    if (message.mode === "video-post") return runVideoPost(message);
    const id = String(message.id || "").slice(0, 120);
    if (!id) throw new Error("任务缺少 id");
    if (activeJobs.has(id)) throw new Error("任务已经在运行");
    let mode = message.mode === "hyperframes-video"
      ? "hyperframes-video"
      : message.mode === "remotion-video"
        ? "remotion-video"
      : message.mode === "image-gen"
        ? "image-gen"
        : message.mode === "coding"
          ? "coding"
        : message.mode === "conversation" ? "conversation" : "analysis";
    const requestedVideoMode = mode;
    if (["hyperframes-video", "remotion-video"].includes(mode)) {
      const hyperframesReady = commandAvailable(hyperframesBinary);
      const remotionReady = commandAvailable(remotionBinary);
      if (mode === "hyperframes-video" && !hyperframesReady && remotionReady) mode = "remotion-video";
      else if (mode === "remotion-video" && !remotionReady && hyperframesReady) mode = "hyperframes-video";
      else if (!hyperframesReady && !remotionReady) {
        throw new Error("本机未找到可用的视频引擎，请重新运行视频档本地桥接安装器");
      }
      if (mode !== requestedVideoMode) {
        log("video engine fallback", { requestedMode: requestedVideoMode, actualMode: mode });
      }
    }
    const runtime = message.runtime === "agy" ? "agy" : "codex";
    if (runtime === "agy" && !["analysis", "conversation", "image-gen"].includes(mode)) {
      throw new Error("AGY 当前支持分析、对话和生图；编码和视频请切换到 Codex");
    }
    if (runtime === "agy" && mode !== "image-gen" && Array.isArray(message.images) && message.images.length) {
      throw new Error("AGY 当前不支持图片输入，请切换到 Codex");
    }
    if (runtime === "agy" && !commandAvailable(agyBinary)) throw new Error("本机未找到 AGY CLI");
    if (activeJobs.size >= MAX_CONCURRENT_JOBS) {
      throw new Error(`最多可同时执行 ${MAX_CONCURRENT_JOBS} 个 Codex 任务`);
    }
    const activeVideoJobs = [...activeJobs.values()]
      .filter(job => ["hyperframes-video", "remotion-video"].includes(job.mode)).length;
    const activeImageJobs = [...activeJobs.values()]
      .filter(job => job.mode === "image-gen").length;
    if (mode === "image-gen" && activeImageJobs >= MAX_CONCURRENT_IMAGE_JOBS) {
      throw new Error("同时只能执行 1 个 AI 自由绘图任务，请等待当前图片完成");
    }
    if (["hyperframes-video", "remotion-video"].includes(mode) && activeVideoJobs >= MAX_CONCURRENT_VIDEO_JOBS) {
      throw new Error("同时只能生成 1 个视频，请等待当前视频完成");
    }
    if (!fs.existsSync(codexWorkspace)) throw new Error("Codex 安全工作目录不存在，请重新安装本地桥接");
    if (mode === "coding" && !fs.existsSync(codingWorkspace)) {
      throw new Error("Codex 编码工作区不存在，请重新安装本地桥接或配置 PAGEDOCK_CODING_WORKSPACE");
    }
    if (mode === "hyperframes-video" && !commandAvailable(hyperframesBinary)) {
      throw new Error("本机未找到 HyperFrames CLI，请重新安装本地桥接");
    }
    if (mode === "remotion-video" && !commandAvailable(remotionBinary)) {
      throw new Error("本机未找到 Remotion CLI，请重新运行视频档本地桥接安装器");
    }
    const safeId = id.replace(/[^a-z0-9_-]/gi, "-").slice(0, 60) || "task";
    const workDirectory = ["hyperframes-video", "remotion-video"].includes(mode)
      ? fs.mkdtempSync(path.join(codexWorkspace, `.pagedock-video-${safeId}-`))
      : mode === "image-gen"
        ? fs.mkdtempSync(path.join(codexWorkspace, `.pagedock-image-${safeId}-`))
        : "";
    let imageBundle;
    let prompt;
    try {
      imageBundle = materializeImages(
        message,
        id,
        workDirectory ? path.join(workDirectory, "inputs") : ""
      );
      prompt = runtime === "agy" && mode === "image-gen"
        ? buildAgyImagePrompt(message, imageBundle.paths)
        : mode === "hyperframes-video"
        ? buildHyperframesVideoPrompt(message, imageBundle.paths, workDirectory)
        : mode === "remotion-video"
          ? buildRemotionVideoPrompt(message, imageBundle.paths, workDirectory)
        : mode === "image-gen"
          ? buildImageGenPrompt(message, imageBundle.paths, workDirectory)
          : mode === "coding"
            ? buildCodingPrompt(message)
            : mode === "conversation" ? buildConversationPrompt(message) : buildAnalysisPrompt(message);
      if (runtime === "agy" && Buffer.byteLength(prompt, "utf8") > 120_000) {
        throw new Error("AGY 输入超过 120 KB，请缩小上下文或切换到 Codex");
      }
    } catch (error) {
      if (workDirectory) fs.rmSync(workDirectory, { recursive: true, force: true });
      throw error;
    }
    const executionDirectory = workDirectory || (mode === "coding" ? codingWorkspace : codexWorkspace);
    const agyLogDirectory = runtime === "agy" ? fs.mkdtempSync(path.join(os.tmpdir(), "pagedock-agy-log-")) : "";
    const agyLogPath = agyLogDirectory ? path.join(agyLogDirectory, "agy.log") : "";
    const args = runtime === "agy"
      ? [
        "--print", prompt,
        "--output-format", "stream-json",
        "--mode", mode === "image-gen" ? "accept-edits" : "plan",
        "--sandbox",
        ...(mode === "image-gen" ? ["--dangerously-skip-permissions"] : []),
        "--log-file", agyLogPath,
        "--print-timeout", "24h"
      ]
      : [
        "--sandbox", ["coding", "hyperframes-video", "remotion-video", "image-gen"].includes(mode) ? "workspace-write" : "read-only",
        "--ask-for-approval", "never",
        ...(["analysis", "conversation"].includes(mode) ? ["--disable", "shell_tool", "--disable", "unified_exec"] : []),
        "exec",
        ...imageBundle.paths.flatMap(imagePath => ["--image", imagePath]),
        "--json",
        "--ephemeral",
        "--skip-git-repo-check",
        ...(mode === "coding" ? [] : ["--ignore-user-config"]),
        "--color", "never",
        ...(mode === "coding" ? [] : ["--ignore-rules"]),
        "--cd", executionDirectory,
        "-"
      ];
    let child;
    try {
      child = spawn(runtime === "agy" ? agyBinary : codexBinary, args, {
        cwd: executionDirectory,
        // Chrome 启动 Native Host 时不会继承 NVM 的 PATH；Codex 的 env-node shebang 需要当前 Node 目录。
        env: { ...codexEnvironment(), NO_COLOR: "1", HYPERFRAMES_SKIP_SKILLS: "1" },
        detached: process.platform !== "win32",
        stdio: ["pipe", "pipe", "pipe"]
      });
    } catch (error) {
      if (agyLogDirectory) fs.rmSync(agyLogDirectory, { recursive: true, force: true });
      if (workDirectory) fs.rmSync(workDirectory, { recursive: true, force: true });
      else if (imageBundle.directory) fs.rmSync(imageBundle.directory, { recursive: true, force: true });
      throw error;
    }
    const job = {
      child,
      cancelled: false,
      stderr: "",
      stdoutBuffer: "",
      answer: "",
      imageDirectory: imageBundle.directory,
      workDirectory,
      mode,
      requestedVideoMode,
      runtime,
      runtimeError: "",
      agyConversationId: "",
      agyLogDirectory,
      agyLogPath,
      boardTitle: message.page?.title || "拾作-AI-Video",
      lastStage: "",
      lastActivity: ""
    };
    activeJobs.set(id, job);
    send({ type: "started", id, mode, runtime });
    if (["hyperframes-video", "remotion-video"].includes(mode)) {
      const engineLabel = mode === "remotion-video" ? "Remotion" : "HyperFrames";
      const fallbackLabel = mode !== requestedVideoMode ? `（原引擎不可用，已自动切换）` : "";
      sendJobProgress(job, id, "building-video", { label: `${engineLabel} 正在创建画面${fallbackLabel}`, status: "running", createdAt: Date.now() });
    }
    if (mode === "image-gen") sendJobProgress(job, id, "generating-image", { label: `${runtime === "agy" ? "AGY" : "Codex"} 正在自由绘图`, status: "running", createdAt: Date.now() });
    log("job started", { id, mode, runtime, imageCount: imageBundle.paths.length });
  
    if (!["hyperframes-video", "remotion-video"].includes(mode)) {
      const timeoutMs = mode === "coding" ? CODING_JOB_TIMEOUT_MS : ANALYSIS_JOB_TIMEOUT_MS;
      job.timer = setTimeout(() => {
        job.cancelled = true;
        terminateChildTree(job.child);
        send({ type: "error", id, error: `${runtime === "agy" ? "AGY" : "Codex"} 任务超过 24 小时，已自动停止` });
        log("job timeout", { id, mode, timeoutMs });
      }, timeoutMs);
    }
  
    child.stdout.on("data", chunk => {
      job.stdoutBuffer += chunk.toString("utf8");
      const lines = job.stdoutBuffer.split("\n");
      job.stdoutBuffer = lines.pop() || "";
      for (const line of lines) (runtime === "agy" ? consumeAgyLine : consumeCodexLine)(job, id, line);
    });
    child.stderr.on("data", chunk => {
      job.stderr = truncate(job.stderr + chunk.toString("utf8"), 20_000);
    });
    child.on("error", error => {
      job.spawnFailed = true;
      clearTimeout(job.timer);
      activeJobs.delete(id);
      cleanupJob(job);
      send({ type: "error", id, error: `无法启动${runtime === "agy" ? " AGY" : " Codex"}：${error.message}` });
      log("job spawn failed", { id, reason: error.message });
    });
    child.on("close", code => {
      if (job.stdoutBuffer.trim()) (runtime === "agy" ? consumeAgyLine : consumeCodexLine)(job, id, job.stdoutBuffer);
      if (job.cancelled || job.spawnFailed) {
        clearTimeout(job.timer);
        activeJobs.delete(id);
        cleanupJob(job);
        log("job cancelled", { id });
        return;
      }
      if (job.mode === "hyperframes-video") {
        finishVideoJob(job, id, code);
        return;
      }
      if (job.mode === "remotion-video") {
        finishRemotionVideoJob(job, id, code);
        return;
      }
      if (job.mode === "image-gen") {
        finishImageGenJob(job, id, code);
        return;
      }
      const succeeded = code === 0 && !job.runtimeError && job.answer.trim();
      const detail = succeeded ? "" : runtime === "agy" ? agyFailureDetail(job) : job.runtimeError || job.stderr.trim();
      clearTimeout(job.timer);
      activeJobs.delete(id);
      cleanupJob(job);
      if (succeeded) {
        send({ type: "done", id, answer: truncate(job.answer, MAX_RESULT_CHARS) });
        log("job completed", { id, answerLength: job.answer.length });
        return;
      }
      const runtimeLabel = runtime === "agy" ? "AGY" : "Codex";
      send({
        type: "error",
        id,
        error: detail ? `${runtimeLabel} 执行失败：${truncate(detail, 1_500)}` : `${runtimeLabel} 执行失败（退出码 ${code}）`
      });
      log("job failed", { id, code });
    });
    child.stdin.end(runtime === "codex" ? prompt : undefined);
  }

  return runCodex;
}
