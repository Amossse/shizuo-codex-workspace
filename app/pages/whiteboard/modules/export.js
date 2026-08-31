// Module: board backup, import, and image/PDF export adapters.
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportCurrentBoard() {
  await flushSave();
  const board = await db.getBoard(currentBoard.id);
  const payload = { kind: "pagedock-board", version: 1, exportedAt: Date.now(), board };
  downloadBlob(
    new Blob([JSON.stringify(payload)], { type: "application/json" }),
    `${safeFilename(board.name)}-${timestamp()}.pagedock`
  );
  setStatus("已导出当前白板");
}

async function backupAllBoards() {
  await flushSave();
  const payload = await db.exportAll();
  downloadBlob(
    new Blob([JSON.stringify(payload)], { type: "application/json" }),
    `拾作-backup-${timestamp()}.pagedock`
  );
  setStatus("已备份全部白板");
}

function wrapCanvasText(context, text, x, y, maxWidth, lineHeight, maxLines) {
  const paragraphs = String(text || "").split(/\n/);
  let lineCount = 0;
  for (const paragraph of paragraphs) {
    let line = "";
    for (const character of paragraph) {
      const next = line + character;
      if (line && context.measureText(next).width > maxWidth) {
        context.fillText(line, x, y + lineCount * lineHeight);
        lineCount += 1;
        if (lineCount >= maxLines) return;
        line = character;
      } else {
        line = next;
      }
    }
    context.fillText(line, x, y + lineCount * lineHeight);
    lineCount += 1;
    if (lineCount >= maxLines) return;
  }
}

function loadCanvasImage(src) {
  return new Promise(resolve => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

async function renderBoardCanvas() {
  if (!boardItems.length) throw new Error("当前白板没有可导出的内容");
  const minX = Math.max(0, Math.min(...boardItems.map(item => item.x)) - 48);
  const minY = Math.max(0, Math.min(...boardItems.map(item => item.y)) - 48);
  const maxX = Math.max(...boardItems.map(item => item.x + item.width)) + 48;
  const maxY = Math.max(...boardItems.map(item => item.y + item.height)) + 48;
  const sourceWidth = Math.max(1, maxX - minX);
  const sourceHeight = Math.max(1, maxY - minY);
  const exportScale = Math.min(2, 12000 / sourceWidth, 12000 / sourceHeight, Math.sqrt(40000000 / (sourceWidth * sourceHeight)));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * exportScale));
  canvas.height = Math.max(1, Math.round(sourceHeight * exportScale));
  const context = canvas.getContext("2d", { alpha: false });
  context.scale(exportScale, exportScale);
  context.fillStyle = "#171a1e";
  context.fillRect(0, 0, sourceWidth, sourceHeight);
  context.strokeStyle = "#2d333c";
  context.lineWidth = 1;
  for (let x = 0; x < sourceWidth; x += 24) {
    for (let y = 0; y < sourceHeight; y += 24) {
      context.beginPath();
      context.arc(x, y, 1, 0, Math.PI * 2);
      context.fillStyle = "#343b45";
      context.fill();
    }
  }
  context.save();
  context.strokeStyle = "#d98f7e";
  context.fillStyle = "#d98f7e";
  context.lineWidth = 2;
  context.globalAlpha = .72;
  for (const { source, target } of relationEdges()) {
    const geometry = relationGeometry(source, target);
    const startX = geometry.start.x - minX;
    const startY = geometry.start.y - minY;
    const endX = geometry.end.x - minX;
    const endY = geometry.end.y - minY;
    const control1X = geometry.control1.x - minX;
    const control1Y = geometry.control1.y - minY;
    const control2X = geometry.control2.x - minX;
    const control2Y = geometry.control2.y - minY;
    context.beginPath();
    context.moveTo(startX, startY);
    context.bezierCurveTo(control1X, control1Y, control2X, control2Y, endX, endY);
    context.stroke();
    const angle = Math.atan2(endY - control2Y, endX - control2X);
    context.beginPath();
    context.moveTo(endX, endY);
    context.lineTo(endX - 10 * Math.cos(angle - Math.PI / 6), endY - 10 * Math.sin(angle - Math.PI / 6));
    context.lineTo(endX - 10 * Math.cos(angle + Math.PI / 6), endY - 10 * Math.sin(angle + Math.PI / 6));
    context.closePath();
    context.fill();
  }
  context.restore();
  const ordered = [...boardItems].sort((left, right) => left.z - right.z);
  for (const item of ordered) {
    const x = item.x - minX;
    const y = item.y - minY;
    context.fillStyle = "#22262c";
    context.strokeStyle = "#424a55";
    context.lineWidth = 1;
    context.fillRect(x, y, item.width, item.height);
    context.strokeRect(x, y, item.width, item.height);
    context.fillStyle = "#292e35";
    context.fillRect(x, y, item.width, 30);
    context.fillStyle = "#9aa4b1";
    context.font = "11px sans-serif";
    context.fillText(itemTypeLabel(item), x + 10, y + 20);
    if (item.type === "image") {
      const image = await loadCanvasImage(item.src);
      if (image) {
        const contentHeight = Math.max(30, item.height - 40 - (item.source ? 24 : 0));
        const scale = Math.min((item.width - 20) / image.naturalWidth, contentHeight / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        context.drawImage(image, x + (item.width - width) / 2, y + 36 + (contentHeight - height) / 2, width, height);
      } else {
        context.fillStyle = "#818b98";
        context.fillText("图片无法离线导出", x + 16, y + 58);
      }
    } else if (item.type === "video") {
      context.fillStyle = "#15191f";
      context.fillRect(x + 10, y + 40, item.width - 20, Math.max(80, item.height - 60));
      context.fillStyle = "#77b7ff";
      context.font = "28px sans-serif";
      context.fillText("▶", x + item.width / 2 - 12, y + item.height / 2);
      context.fillStyle = "#aeb8c5";
      context.font = "12px sans-serif";
      context.fillText("视频请在拾作白板中播放", x + 16, y + item.height - 18);
    } else if (item.type === "page") {
      context.fillStyle = "#f7f3ed";
      context.fillRect(x + 10, y + 40, item.width - 20, Math.max(80, item.height - 60));
      context.fillStyle = "#77b7ff";
      context.font = "14px sans-serif";
      wrapCanvasText(context, item.src, x + 18, y + 64, item.width - 36, 21, 3);
      context.fillStyle = "#68727f";
      context.font = "12px sans-serif";
      context.fillText("网页请在拾作白板中浏览", x + 18, y + 128);
    } else if (item.type === "terminal") {
      context.fillStyle = "#211d1a";
      context.fillRect(x + 10, y + 40, item.width - 20, Math.max(80, item.height - 60));
      context.fillStyle = "#f7eee6";
      context.font = "11px monospace";
      wrapCanvasText(
        context,
        String(item.terminalOutput || `$ ${item.text || ""}`).slice(-6_000),
        x + 18,
        y + 62,
        item.width - 36,
        17,
        Math.max(1, Math.floor((item.height - 82) / 17))
      );
    } else if (["document", "code"].includes(item.type)) {
      if (item.type === "code") {
        context.fillStyle = "#211d1a";
        context.fillRect(x + 10, y + 40, item.width - 20, Math.max(80, item.height - 60));
      }
      context.fillStyle = item.type === "code" ? "#f7eee6" : "#e3e8ee";
      context.font = item.type === "code" ? "11px monospace" : "13px sans-serif";
      wrapCanvasText(
        context,
        String(item.text || ""),
        x + 16,
        y + 54,
        item.width - 32,
        item.type === "code" ? 17 : 21,
        Math.max(1, Math.floor((item.height - 68) / (item.type === "code" ? 17 : 21)))
      );
    } else if (["file", "folder"].includes(item.type)) {
      context.fillStyle = "#e3e8ee";
      context.font = "600 13px sans-serif";
      context.fillText(item.localName || itemTypeLabel(item), x + 16, y + 54);
      context.fillStyle = "#aeb8c5";
      context.font = "11px monospace";
      wrapCanvasText(
        context,
        cardTextOutput(item),
        x + 16,
        y + 78,
        item.width - 32,
        17,
        Math.max(1, Math.floor((item.height - 92) / 17))
      );
    } else {
      context.fillStyle = item.type === "link" ? "#77b7ff" : "#e3e8ee";
      context.font = item.type === "link" ? "14px sans-serif" : "13px sans-serif";
      wrapCanvasText(context, itemLabel(item), x + 16, y + 52, item.width - 32, 21, Math.max(1, Math.floor((item.height - 52) / 21)));
    }
    if (item.source?.url) {
      context.fillStyle = "#778391";
      context.font = "10px sans-serif";
      context.fillText(`来源：${item.source.title || item.source.url}`.slice(0, 90), x + 12, y + item.height - 10);
    }
  }
  return canvas;
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("画布导出失败")), type, quality);
  });
}

function buildJpegPdf(jpegBytes, pixelWidth, pixelHeight) {
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let length = 0;
  const add = bytes => { chunks.push(bytes); length += bytes.byteLength; };
  const text = value => add(encoder.encode(value));
  const object = (id, parts) => {
    offsets[id] = length;
    text(`${id} 0 obj\n`);
    parts.forEach(part => typeof part === "string" ? text(part) : add(part));
    text("\nendobj\n");
  };
  text("%PDF-1.7\n%Shizuo\n");
  const pageScale = Math.min(0.75, 14000 / pixelWidth, 14000 / pixelHeight);
  const width = Number((pixelWidth * pageScale).toFixed(3));
  const height = Number((pixelHeight * pageScale).toFixed(3));
  const content = encoder.encode(`q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`);
  object(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  object(2, ["<< /Type /Pages /Count 1 /Kids [3 0 R] >>"]);
  object(3, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`]);
  object(4, [`<< /Length ${content.byteLength} >>\nstream\n`, content, "endstream"]);
  object(5, [`<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.byteLength} >>\nstream\n`, jpegBytes, "\nendstream"]);
  const xref = length;
  text("xref\n0 6\n0000000000 65535 f \n");
  for (let id = 1; id <= 5; id += 1) text(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  text(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(chunks, { type: "application/pdf" });
}

async function exportBoardImage(type) {
  setStatus(type === "png" ? "正在生成 PNG…" : "正在生成 PDF…");
  try {
    const canvas = await renderBoardCanvas();
    if (type === "png") {
      downloadBlob(await canvasBlob(canvas, "image/png"), `${safeFilename(currentBoard.name)}-${timestamp()}.png`);
    } else {
      const jpeg = await canvasBlob(canvas, "image/jpeg", .94);
      const pdf = buildJpegPdf(new Uint8Array(await jpeg.arrayBuffer()), canvas.width, canvas.height);
      downloadBlob(pdf, `${safeFilename(currentBoard.name)}-${timestamp()}.pdf`);
    }
    setStatus(`已导出 ${type.toUpperCase()}`);
  } catch (error) {
    console.error("[pagedock-export] failed", error);
    setStatus(error?.message || "导出失败", true);
  }
}

async function importSelectedFile() {
  const file = importInputEl.files?.[0];
  importInputEl.value = "";
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    const imported = await db.importData(payload);
    notifyDataChanged(imported.map(board => board.id), "import-boards");
    if (imported.length === 1) await openBoard(imported[0].id);
    else await renderHome();
    setStatus(`已导入 ${imported.length} 个白板`);
  } catch (error) {
    console.error("[pagedock-import] failed", error);
    setStatus(error?.message || "导入失败，请检查文件后重试", true);
  }
}

async function deleteCurrentBoard() {
  if (!currentBoard) return;
  if (currentBoard.id === db.INBOX_ID) {
    if (!confirm("收件箱会保留为默认入口。确定清空其中全部内容吗？")) return;
    const removed = await db.clearInbox();
    notifyDataChanged([db.INBOX_ID], "clear-inbox");
    await openBoard(db.INBOX_ID, false);
    setStatus(removed ? `已清空收件箱（${removed} 项）` : "收件箱已经为空");
    return;
  }
  if (!confirm(`确定删除“${currentBoard.name}”吗？此操作无法撤销。`)) return;
  await db.deleteBoard(currentBoard.id);
  notifyDataChanged([currentBoard.id], "delete-board");
  await renderHome();
}
