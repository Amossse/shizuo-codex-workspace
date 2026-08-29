import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { appendBoundedOutput, commandAvailable, errorTail, truncate } from "./runtime-utils.mjs";

const IMAGE_CHUNK_BYTES = 384 * 1024;
const VIDEO_CHUNK_BYTES = 384 * 1024;
const MAX_GENERATED_IMAGE_BYTES = 24 * 1024 * 1024;
const MAX_VIDEO_BYTES = 48 * 1024 * 1024;
const MAX_NARRATION_CHARS = 8_000;
const MAX_RESULT_CHARS = 200_000;
const TASK_TIMEOUT_MS = 24 * 60 * 60 * 1000;
const MAX_CONCURRENT_JOBS = 3;
const VIDEO_STAGE_TIMEOUT_MS = Object.freeze({ "generating-narration": TASK_TIMEOUT_MS, "adding-subtitles": TASK_TIMEOUT_MS });
const DEFAULT_VIDEO_STAGE_TIMEOUT_MS = TASK_TIMEOUT_MS;
const VIDEO_STAGE_LABELS = Object.freeze({ "generating-narration": "Kokoro 正在生成口播", "adding-subtitles": "正在合成口播与字幕" });

// Owns CLI event adaptation and binary artifact delivery, including Kokoro post-production.
export function createTaskArtifacts(dependencies) {
  const { activeJobs, agyBrainRoot, codexWorkspace, hyperframesBinary, ffmpegBinary, ffprobeBinary, codexEnvironment, materializeVideo, terminateChildTree, send, log, cleanupJob, agyFailureDetail } = dependencies;

  function runNarrationCommand(job, binary, args, cwd = job.workDirectory) {
    return new Promise((resolve, reject) => {
      if (job.cancelled) return reject(new Error("视频任务已停止"));
      const child = spawn(binary, args, { cwd, env: codexEnvironment(), detached: process.platform !== "win32", stdio: ["ignore", "pipe", "pipe"] });
      job.child = child;
      let output = "";
      child.stdout.on("data", chunk => { output = appendBoundedOutput(output, chunk.toString("utf8"), 12_000); });
      child.stderr.on("data", chunk => { output = appendBoundedOutput(output, chunk.toString("utf8"), 12_000); });
      child.on("error", reject);
      child.on("close", code => resolve({ code, output: output.trim() }));
    });
  }

  function extractAgentMessage(event) {
    if (event?.type !== "item.completed") return "";
    if (event.item?.type !== "agent_message") return "";
    return String(event.item.text || event.item.content || "");
  }
  
  function compactCommand(value) {
    return String(value || "")
      .replace(/\b([A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*)=([^\s]+)/gi, "$1=[已隐藏]")
      .replace(/\bBearer\s+[^\s]+/gi, "Bearer [已隐藏]")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 180);
  }
  
  function codexActivity(event) {
    if (!["item.started", "item.completed"].includes(event?.type)) return null;
    const item = event.item || {};
    const completed = event.type === "item.completed";
    const status = completed
      ? (Number.isInteger(item.exit_code) && item.exit_code !== 0 ? "error" : "success")
      : "running";
    if (item.type === "reasoning") {
      return { stage: "thinking", label: completed ? "已完成本轮分析" : "正在分析并规划下一步", status };
    }
    if (item.type === "command_execution") {
      const command = compactCommand(item.command);
      return {
        stage: "running-command",
        label: completed ? (status === "error" ? "命令执行失败" : "命令执行完成") : "正在运行命令",
        detail: command,
        status
      };
    }
    if (["mcp_tool_call", "tool_call"].includes(item.type)) {
      const tool = compactCommand(item.tool || item.name || item.server);
      return {
        stage: "using-tool",
        label: completed ? "工具调用完成" : "正在调用工具",
        detail: tool,
        status
      };
    }
    if (["file_change", "file_edit"].includes(item.type)) {
      return { stage: "updating-files", label: completed ? "文件更新完成" : "正在更新文件", status };
    }
    if (["web_search", "search"].includes(item.type)) {
      return { stage: "searching", label: completed ? "资料检索完成" : "正在检索资料", status };
    }
    if (["todo_list", "plan"].includes(item.type)) {
      return { stage: "planning", label: completed ? "执行计划已更新" : "正在更新执行计划", status };
    }
    return null;
  }
  
  function sendJobActivity(job, id, activity) {
    if (!activity) return;
    const signature = `${activity.stage}:${activity.label}:${activity.detail || ""}:${activity.status}`;
    if (job.lastActivity === signature) return;
    job.lastActivity = signature;
    send({
      type: "progress",
      id,
      stage: activity.stage,
      label: activity.label,
      detail: activity.detail || "",
      status: activity.status,
      createdAt: Date.now()
    });
  }
  
  function consumeCodexLine(job, id, line) {
    if (!line.trim()) return;
    try {
      const event = JSON.parse(line);
      const answer = extractAgentMessage(event);
      if (answer) job.answer = answer;
      if (event.type === "thread.started" && event.thread_id) {
        send({ type: "progress", id, stage: "thinking", label: "正在理解任务", status: "running", threadId: event.thread_id, createdAt: Date.now() });
      }
      sendJobActivity(job, id, codexActivity(event));
      const command = String(event.item?.command || "");
      if (job.mode === "hyperframes-video" && /(audio\/scripts\/audio\.mjs|wait-bgm\.mjs|hyperframes\s+tts)/.test(command)) {
        sendJobProgress(job, id, "building-audio");
      } else if (job.mode === "hyperframes-video" && /hyperframes\s+render/.test(command)) {
        sendJobProgress(job, id, "rendering-video");
      } else if (job.mode === "hyperframes-video" && /hyperframes\s+check/.test(command)) {
        sendJobProgress(job, id, "checking-video");
      } else if (job.mode === "hyperframes-video" && /hyperframes\s+init/.test(command)) {
        sendJobProgress(job, id, "building-video");
      }
    } catch (error) {
      log("ignored malformed codex event", { id, reason: error.message });
    }
  }
  
  function consumeAgyLine(job, id, line) {
    if (!line.trim()) return;
    try {
      const event = JSON.parse(line);
      if (event.event === "init") {
        job.agyConversationId = String(event.conversation_id || event.init?.conversation_id || "");
        sendJobActivity(job, id, { stage: "thinking", label: "AGY 正在理解任务", status: "running" });
        return;
      }
      if (event.event === "result") {
        job.answer = String(event.result?.response || job.answer || "");
        if (event.result?.status !== "SUCCESS") job.runtimeError = String(event.result?.error || "AGY 执行失败");
        return;
      }
      if (event.event !== "step_update") return;
      const step = event.step_update || {};
      if (step.step_type === "agent_response") {
        sendJobActivity(job, id, { stage: "thinking", label: "AGY 正在生成回答", status: step.state === "ERROR" ? "error" : "running" });
      } else if (step.step_type === "tool") {
        sendJobActivity(job, id, {
          stage: "using-tool",
          label: step.state === "DONE" ? "AGY 工具调用完成" : step.state === "ERROR" ? "AGY 工具调用失败" : "AGY 正在调用工具",
          detail: compactCommand(step.tool_name),
          status: step.state === "DONE" ? "success" : step.state === "ERROR" ? "error" : "running"
        });
      }
    } catch (error) {
      log("ignored malformed AGY event", { id, reason: error.message });
    }
  }
  
  function sendJobProgress(job, id, stage, metadata = {}) {
    if (job.lastStage === stage) return;
    job.lastStage = stage;
    if (["hyperframes-video", "remotion-video"].includes(job.mode)) {
      const timeoutMs = VIDEO_STAGE_TIMEOUT_MS[stage] || DEFAULT_VIDEO_STAGE_TIMEOUT_MS;
      const stageLabel = VIDEO_STAGE_LABELS[stage] || "视频处理";
      clearTimeout(job.timer);
      job.timer = setTimeout(() => {
        job.cancelled = true;
        terminateChildTree(job.child);
        send({
          type: "error",
          id,
          error: `视频任务在“${stageLabel}”阶段超过 ${Math.round(timeoutMs / 3_600_000)} 小时，已自动停止`
        });
        log("video stage timeout", { id, stage, timeoutMs });
      }, timeoutMs);
    }
    send({ type: "progress", id, stage, ...metadata });
  }
  
  function findRenderedVideo(workDirectory) {
    const exact = path.join(workDirectory, "project", "output.mp4");
    if (fs.existsSync(exact)) return exact;
    const queue = [{ directory: workDirectory, depth: 0 }];
    while (queue.length) {
      const { directory, depth } = queue.shift();
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isFile() && /\.mp4$/i.test(entry.name)) return target;
        if (entry.isDirectory() && depth < 3 && !entry.name.startsWith(".")) {
          queue.push({ directory: target, depth: depth + 1 });
        }
      }
    }
    return "";
  }
  
  function sendVideoArtifact(job, id) {
    const videoPath = findRenderedVideo(job.workDirectory);
    if (!videoPath) {
      const detail = truncate(job.answer, 1_200).trim();
      throw new Error(`Codex 已结束，但没有生成 HyperFrames MP4${detail ? `：${detail}` : ""}`);
    }
    const realWorkDirectory = fs.realpathSync(job.workDirectory);
    const realVideoPath = fs.realpathSync(videoPath);
    if (!realVideoPath.startsWith(`${realWorkDirectory}${path.sep}`)) {
      throw new Error("视频输出不在任务工作目录内");
    }
    const size = fs.statSync(realVideoPath).size;
    if (!size) throw new Error("HyperFrames 生成了空视频文件");
    if (size > MAX_VIDEO_BYTES) throw new Error("生成的视频超过 48 MB，请减少圈选内容后重试");
    const bytes = fs.readFileSync(realVideoPath);
    const totalChunks = Math.ceil(bytes.length / VIDEO_CHUNK_BYTES);
    const filename = `${String(job.boardTitle || "拾作-AI-Video").replace(/[<>:\"/\\|?*]/g, "_").slice(0, 80) || "拾作-AI-Video"}.mp4`;
    send({ type: "artifact-start", id, artifactType: "video", mimeType: "video/mp4", filename, size, totalChunks });
    for (let index = 0; index < totalChunks; index += 1) {
      const start = index * VIDEO_CHUNK_BYTES;
      const data = bytes.subarray(start, start + VIDEO_CHUNK_BYTES).toString("base64");
      send({ type: "artifact-chunk", id, index, data });
    }
    send({ type: "artifact-done", id, artifactType: "video", size, totalChunks });
    return { filename, size, totalChunks };
  }
  
  function narrationLines(value) {
    return String(value || "")
      .split(/\n+|(?<=[。！？!?；;])\s*/u)
      .map(text => text.trim())
      .filter(Boolean)
      .flatMap(text => text.match(/[\s\S]{1,180}/g) || [])
      .slice(0, 80);
  }
  
  function srtTime(seconds) {
    const milliseconds = Math.max(0, Math.round(Number(seconds) * 1000));
    const hours = Math.floor(milliseconds / 3_600_000);
    const minutes = Math.floor(milliseconds % 3_600_000 / 60_000);
    const secs = Math.floor(milliseconds % 60_000 / 1000);
    const millis = milliseconds % 1000;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
  }
  
  async function mediaDuration(job, filePath) {
    const probe = await runNarrationCommand(job, ffprobeBinary, [
      "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", filePath
    ]);
    const duration = Number.parseFloat(probe.output);
    if (probe.code !== 0 || !Number.isFinite(duration) || duration <= 0) {
      throw new Error(`媒体时长读取失败：${errorTail(probe.output, 800)}`);
    }
    return duration;
  }
  
  async function finishVideoPostJob(job, id, narration) {
    try {
      const projectDirectory = path.join(job.workDirectory, "project");
      const voiceDirectory = path.join(projectDirectory, "voice");
      fs.mkdirSync(voiceDirectory, { recursive: true });
      const lines = narrationLines(narration);
      if (!lines.length) throw new Error("请输入口播文案");
      const cues = [];
      let cursor = 0;
      sendJobProgress(job, id, "generating-narration", { label: "Kokoro 正在生成口播", status: "running", createdAt: Date.now() });
      for (let index = 0; index < lines.length; index += 1) {
        const output = path.join(voiceDirectory, `voice-${index + 1}.wav`);
        const speech = await runHyperframesCommand(job, [
          "tts", lines[index], "--voice", "zf_xiaobei", "--lang", "zh", "--speed", "1.0", "--output", output
        ]);
        if (speech.code !== 0 || !fs.existsSync(output) || fs.statSync(output).size < 1_000) {
          throw new Error(`Kokoro 第 ${index + 1} 段口播生成失败：${errorTail(speech.output, 1_200)}`);
        }
        const duration = await mediaDuration(job, output);
        cues.push({ text: lines[index], start: cursor, end: cursor + duration });
        cursor += duration;
      }
  
      const concatPath = path.join(projectDirectory, "voice.txt");
      fs.writeFileSync(concatPath, cues.map((_, index) => `file 'voice/voice-${index + 1}.wav'`).join("\n"));
      const narrationPath = path.join(projectDirectory, "narration.wav");
      const concat = await runFfmpegCommand(job, ["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c:a", "pcm_s16le", narrationPath]);
      if (concat.code !== 0 || !fs.existsSync(narrationPath)) throw new Error(`口播合并失败：${errorTail(concat.output, 1_200)}`);
  
      const captionsPath = path.join(projectDirectory, "captions.srt");
      fs.writeFileSync(captionsPath, cues.map((cue, index) => [
        index + 1,
        `${srtTime(cue.start)} --> ${srtTime(cue.end)}`,
        cue.text,
        ""
      ].join("\n")).join("\n"));
  
      sendJobProgress(job, id, "adding-subtitles", { label: "正在合成口播与字幕", status: "running", createdAt: Date.now() });
      const sourcePath = path.join(projectDirectory, "source.mp4");
      const outputPath = path.join(projectDirectory, "output.mp4");
      const videoDuration = await mediaDuration(job, sourcePath);
      const finalDuration = Math.max(videoDuration, cursor);
      const extend = Math.max(0, finalDuration - videoDuration).toFixed(3);
      const filter = `[0:v]tpad=stop_mode=clone:stop_duration=${extend},subtitles=project/captions.srt:force_style='FontName=PingFang SC,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H80000000,BorderStyle=1,Outline=2,Shadow=0,MarginV=36'[v]`;
      let mux = await runFfmpegCommand(job, [
        "-y", "-i", sourcePath, "-i", narrationPath, "-filter_complex", filter,
        "-map", "[v]", "-map", "1:a:0", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k", "-t", finalDuration.toFixed(3), "-movflags", "+faststart", outputPath
      ]);
      if (mux.code !== 0) {
        // 字幕滤镜缺失时仍保留可开关的 MP4 字幕轨，避免整条后置链路失败。
        mux = await runFfmpegCommand(job, [
          "-y", "-i", sourcePath, "-i", narrationPath, "-i", captionsPath,
          "-map", "0:v:0", "-map", "1:a:0", "-map", "2:0", "-vf", `tpad=stop_mode=clone:stop_duration=${extend}`,
          "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "aac", "-b:a", "192k",
          "-c:s", "mov_text", "-metadata:s:s:0", "language=chi", "-t", finalDuration.toFixed(3),
          "-movflags", "+faststart", outputPath
        ]);
      }
      if (mux.code !== 0 || !fs.existsSync(outputPath) || !fs.statSync(outputPath).size) {
        throw new Error(`视频后期合成失败：${errorTail(mux.output, 2_000)}`);
      }
      sendJobProgress(job, id, "packaging-video");
      const artifact = sendVideoArtifact(job, id);
      send({ type: "done", id, answer: "Kokoro 口播与字幕已添加", artifact });
      log("video post job completed", { id, lines: lines.length, duration: finalDuration, size: artifact.size });
    } catch (error) {
      if (!job.cancelled) {
        send({ type: "error", id, error: error.message });
        log("video post job failed", { id, reason: error.message });
      }
    } finally {
      clearTimeout(job.timer);
      activeJobs.delete(id);
      cleanupJob(job);
    }
  }
  
  function runVideoPost(message) {
    const id = String(message.id || "").slice(0, 120);
    if (!id) throw new Error("任务缺少 id");
    if (activeJobs.has(id)) throw new Error("任务已经在运行");
    if (activeJobs.size >= MAX_CONCURRENT_JOBS) throw new Error(`最多可同时执行 ${MAX_CONCURRENT_JOBS} 个本地任务`);
    if ([...activeJobs.values()].some(job => ["hyperframes-video", "remotion-video", "video-post"].includes(job.mode))) {
      throw new Error("同时只能处理 1 个视频，请等待当前视频完成");
    }
    if (!commandAvailable(hyperframesBinary)) throw new Error("本机未找到 HyperFrames CLI，无法调用 Kokoro");
    if (!commandAvailable(ffmpegBinary) || !commandAvailable(ffprobeBinary)) throw new Error("本机未找到 FFmpeg，无法合成视频");
    const narration = String(message.narration || "").trim();
    if (!narration) throw new Error("请输入口播文案");
    if (narration.length > MAX_NARRATION_CHARS) throw new Error(`口播文案不能超过 ${MAX_NARRATION_CHARS} 字`);
    const safeId = id.replace(/[^a-z0-9_-]/gi, "-").slice(0, 60) || "task";
    const workDirectory = fs.mkdtempSync(path.join(codexWorkspace, `.pagedock-video-post-${safeId}-`));
    const projectDirectory = path.join(workDirectory, "project");
    try {
      materializeVideo(message, projectDirectory);
    } catch (error) {
      fs.rmSync(workDirectory, { recursive: true, force: true });
      throw error;
    }
    const job = { child: null, cancelled: false, workDirectory, imageDirectory: "", mode: "video-post", boardTitle: message.page?.title || "拾作-口播视频" };
    job.timer = setTimeout(() => {
      job.cancelled = true;
      terminateChildTree(job.child);
      send({ type: "error", id, error: "视频后期任务超过 24 小时，已自动停止" });
    }, TASK_TIMEOUT_MS);
    activeJobs.set(id, job);
    send({ type: "started", id, mode: "video-post", runtime: "local" });
    finishVideoPostJob(job, id, narration);
  }
  
  function findGeneratedImage(workDirectory) {
    const outputDirectory = path.join(workDirectory, "output");
    if (!fs.existsSync(outputDirectory)) return "";
    return fs.readdirSync(outputDirectory, { withFileTypes: true })
      .filter(entry => entry.isFile() && /\.(?:png|jpe?g|webp)$/i.test(entry.name))
      .map(entry => path.join(outputDirectory, entry.name))
      .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0] || "";
  }
  
  function stageAgyGeneratedImage(job, brainRoot = agyBrainRoot) {
    const agyConversationId = String(job.agyConversationId || "");
    if (!/^[a-z0-9-]{20,80}$/i.test(agyConversationId)) throw new Error("AGY 没有返回可识别的生图会话");
    const conversationDirectory = path.join(brainRoot, agyConversationId);
    if (!fs.existsSync(conversationDirectory)) throw new Error("AGY 生图会话没有生成 artifact 目录");
    const realBrainRoot = fs.realpathSync(brainRoot);
    const realConversationDirectory = fs.realpathSync(conversationDirectory);
    if (!realConversationDirectory.startsWith(`${realBrainRoot}${path.sep}`)) throw new Error("AGY artifact 路径越界");
    const queue = [{ directory: realConversationDirectory, depth: 0 }];
    const candidates = [];
    while (queue.length) {
      const { directory, depth } = queue.shift();
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const target = path.join(directory, entry.name);
        if (entry.isFile() && /\.(?:png|jpe?g|webp)$/i.test(entry.name)) candidates.push(target);
        else if (entry.isDirectory() && depth < 4 && entry.name !== ".system_generated") queue.push({ directory: target, depth: depth + 1 });
      }
    }
    const source = candidates.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0];
    if (!source) throw new Error("AGY 已结束，但 generate_image 没有交付图片");
    const outputDirectory = path.join(job.workDirectory, "output");
    fs.mkdirSync(outputDirectory, { recursive: true });
    fs.copyFileSync(source, path.join(outputDirectory, `generated${path.extname(source).toLowerCase()}`));
  }
  
  function agyImageArtifactSelfTest() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pagedock-agy-image-self-test-"));
    try {
      const brainRoot = path.join(directory, "brain");
      const conversationId = "12345678-1234-1234-1234-123456789abc";
      const artifactDirectory = path.join(brainRoot, conversationId, "artifacts");
      const workDirectory = path.join(directory, "work");
      fs.mkdirSync(artifactDirectory, { recursive: true });
      fs.mkdirSync(workDirectory, { recursive: true });
      fs.writeFileSync(path.join(artifactDirectory, "result.png"), Buffer.from("89504e470d0a1a0a", "hex"));
      stageAgyGeneratedImage({ agyConversationId: conversationId, workDirectory }, brainRoot);
      return fs.existsSync(path.join(workDirectory, "output", "generated.png")) ? "ok" : "failed";
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
  
  function agyFailureDetailSelfTest() {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "pagedock-agy-error-self-test-"));
    try {
      const logPath = path.join(directory, "agy.log");
      fs.writeFileSync(logPath, "agent executor error: pre-invocation hook: FAILED_PRECONDITION (code 400): User location is not supported for the API use.\n");
      const recovered = agyFailureDetail({ runtimeError: "Agent execution terminated due to error.", agyLogPath: logPath });
      const preserved = agyFailureDetail({ runtimeError: "generate_image tool is unavailable" });
      return recovered.includes("当前网络所在地区") && preserved === "generate_image tool is unavailable" ? "ok" : "failed";
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  }
  
  function sendImageArtifact(job, id) {
    const imagePath = findGeneratedImage(job.workDirectory);
    if (!imagePath) {
      const detail = truncate(job.answer, 1_200).trim();
      throw new Error(`${job.runtime === "agy" ? "AGY" : "Codex"} 已结束，但生图工具没有交付图片${detail ? `：${detail}` : ""}`);
    }
    const realWorkDirectory = fs.realpathSync(job.workDirectory);
    const realImagePath = fs.realpathSync(imagePath);
    if (!realImagePath.startsWith(`${realWorkDirectory}${path.sep}`)) {
      throw new Error("图片输出不在任务工作目录内");
    }
    const size = fs.statSync(realImagePath).size;
    if (!size) throw new Error("内置 image-gen 生成了空图片文件");
    if (size > MAX_GENERATED_IMAGE_BYTES) throw new Error("生成的图片超过 24 MB，请简化绘图要求后重试");
    const extension = path.extname(realImagePath).toLowerCase();
    const mimeType = extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
    const normalizedExtension = extension === ".jpeg" ? ".jpg" : extension;
    const bytes = fs.readFileSync(realImagePath);
    const totalChunks = Math.ceil(bytes.length / IMAGE_CHUNK_BYTES);
    const basename = String(job.boardTitle || "拾作-AI-Image").replace(/[<>:\"/\\|?*]/g, "_").slice(0, 80) || "拾作-AI-Image";
    const filename = `${basename}${normalizedExtension}`;
    send({ type: "artifact-start", id, artifactType: "image", mimeType, filename, size, totalChunks });
    for (let index = 0; index < totalChunks; index += 1) {
      const start = index * IMAGE_CHUNK_BYTES;
      const data = bytes.subarray(start, start + IMAGE_CHUNK_BYTES).toString("base64");
      send({ type: "artifact-chunk", id, artifactType: "image", index, data });
    }
    send({ type: "artifact-done", id, artifactType: "image", size, totalChunks });
    return { filename, mimeType, size, totalChunks };
  }
  
  function runHyperframesCommand(job, args, extraEnvironment = {}) {
    return new Promise((resolve, reject) => {
      if (job.cancelled) return reject(new Error("视频任务已停止"));
      const child = spawn(hyperframesBinary, args, {
        cwd: job.workDirectory,
        env: { ...codexEnvironment(), NO_COLOR: "1", HYPERFRAMES_SKIP_SKILLS: "1", ...extraEnvironment },
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"]
      });
      job.child = child;
      let output = "";
      child.stdout.on("data", chunk => { output = appendBoundedOutput(output, chunk.toString("utf8"), 30_000); });
      child.stderr.on("data", chunk => { output = appendBoundedOutput(output, chunk.toString("utf8"), 30_000); });
      child.on("error", reject);
      child.on("close", code => resolve({ code, output: output.trim() }));
    });
  }
  
  function runNodeScript(job, args, extraEnvironment = {}) {
    return new Promise((resolve, reject) => {
      if (job.cancelled) return reject(new Error("视频任务已停止"));
      const child = spawn(process.execPath, args, {
        cwd: job.workDirectory,
        env: { ...codexEnvironment(), NO_COLOR: "1", ...extraEnvironment },
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"]
      });
      job.child = child;
      let output = "";
      child.stdout.on("data", chunk => { output = appendBoundedOutput(output, chunk.toString("utf8"), 30_000); });
      child.stderr.on("data", chunk => { output = appendBoundedOutput(output, chunk.toString("utf8"), 30_000); });
      child.on("error", reject);
      child.on("close", code => resolve({ code, output: output.trim() }));
    });
  }
  
  function runFfmpegCommand(job, args) {
    return new Promise((resolve, reject) => {
      if (job.cancelled) return reject(new Error("视频任务已停止"));
      const child = spawn(ffmpegBinary, args, {
        cwd: job.workDirectory,
        env: codexEnvironment(),
        detached: process.platform !== "win32",
        stdio: ["ignore", "pipe", "pipe"]
      });
      job.child = child;
      let output = "";
      child.stdout.on("data", chunk => { output = appendBoundedOutput(output, chunk.toString("utf8"), 20_000); });
      child.stderr.on("data", chunk => { output = appendBoundedOutput(output, chunk.toString("utf8"), 20_000); });
      child.on("error", reject);
      child.on("close", code => resolve({ code, output: output.trim() }));
    });
  }

  return Object.freeze({ consumeCodexLine, consumeAgyLine, sendJobProgress, sendVideoArtifact, runVideoPost, stageAgyGeneratedImage, agyImageArtifactSelfTest, agyFailureDetailSelfTest, sendImageArtifact, runHyperframesCommand, runNodeScript, runFfmpegCommand });
}
