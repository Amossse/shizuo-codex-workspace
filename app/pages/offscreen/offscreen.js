const STITCH_INIT_REQUEST = "init-screenshot-stitch";
const STITCH_TILE_REQUEST = "add-screenshot-tile";
const STITCH_REQUEST = "stitch-screenshot-tiles";
const screenshotSessions = new Map();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === STITCH_INIT_REQUEST) {
    screenshotSessions.set(message.sessionId, []);
    sendResponse({ ok: true });
    return;
  }
  if (message?.type === STITCH_TILE_REQUEST) {
    const tiles = screenshotSessions.get(message.sessionId);
    if (!tiles) {
      sendResponse({ ok: false, error: "截图拼接会话不存在" });
      return;
    }
    tiles.push(message.tile);
    sendResponse({ ok: true });
    return;
  }
  if (message?.type !== STITCH_REQUEST) return;

  const tiles = screenshotSessions.get(message.sessionId);
  screenshotSessions.delete(message.sessionId);
  stitchTiles(tiles, message.totalHeight)
    .then(result => sendResponse({ ok: true, ...result }))
    .catch(error => {
      console.error("[screenshot-stitcher] stitch failed", error);
      sendResponse({ ok: false, error: error?.message || String(error) });
    });
  return true;
});

async function decodeImage(dataUrl) {
  const response = await fetch(dataUrl);
  return createImageBitmap(await response.blob());
}

function buildOutputPlan(sourceWidth, totalHeightCss, scaleX, scaleY) {
  const maxDimension = 16000;
  const maxPixels = 16000000;
  // 保留浏览器截图的原生像素密度；超长页面只分片，不再通过缩放牺牲文字清晰度。
  const scale = 1;
  const width = Math.max(1, Math.floor(sourceWidth * scale));
  if (width > maxDimension || width > maxPixels) {
    throw new Error(`页面宽度过大，无法生成高清截图：${width}px`);
  }

  const totalHeight = Math.max(1, Math.ceil(totalHeightCss * scaleY * scale));
  const maxPartHeight = Math.max(
    1,
    Math.min(maxDimension, Math.floor(maxPixels / width))
  );
  const partCount = Math.ceil(totalHeight / maxPartHeight);
  return {
    scale,
    width,
    totalHeight,
    maxPartHeight,
    partCount,
    effectiveCssScale: scaleY * scale
  };
}

async function stitchTiles(tiles, totalHeightCss) {
  if (!Array.isArray(tiles) || !tiles.length) throw new Error("没有可拼接的截图分片");

  const firstImage = await decodeImage(tiles[0].dataUrl);
  const scaleX = firstImage.width / tiles[0].viewportWidth;
  const scaleY = firstImage.height / tiles[0].viewportHeight;
  const sourceWidth = tiles[0].crop.width * scaleX;
  const plan = buildOutputPlan(
    sourceWidth,
    totalHeightCss,
    scaleX,
    scaleY
  );
  firstImage.close();

  const segments = [];
  let coveredUntil = 0;
  for (const tile of tiles) {
    const segmentStart = Math.max(coveredUntil, tile.contentTop);
    const segmentEnd = Math.min(
      totalHeightCss,
      tile.contentTop + tile.visibleHeight
    );
    if (segmentEnd > segmentStart) {
      if (segmentStart > coveredUntil + 2) {
        throw new Error(`截图分片之间存在空缺：${coveredUntil} - ${segmentStart}`);
      }
      segments.push({ tile, start: segmentStart, end: segmentEnd });
      coveredUntil = segmentEnd;
    }
  }

  if (coveredUntil < totalHeightCss - 2) {
    throw new Error(`截图未覆盖完整页面：${coveredUntil} / ${totalHeightCss}`);
  }

  const pages = [];
  for (let partIndex = 0; partIndex < plan.partCount; partIndex += 1) {
    const outputStart = partIndex * plan.maxPartHeight;
    const outputEnd = Math.min(plan.totalHeight, outputStart + plan.maxPartHeight);
    const height = outputEnd - outputStart;
    const canvas = document.createElement("canvas");
    canvas.width = plan.width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    context.imageSmoothingEnabled = false;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, plan.width, height);

    const partStartCss = outputStart / plan.effectiveCssScale;
    const partEndCss = outputEnd / plan.effectiveCssScale;
    for (const segment of segments) {
      const drawStart = Math.max(segment.start, partStartCss);
      const drawEnd = Math.min(segment.end, partEndCss);
      if (drawEnd <= drawStart) continue;

      const { tile } = segment;
      const image = await decodeImage(tile.dataUrl);
      const sourceX = tile.crop.left * scaleX;
      const sourceY = (tile.crop.top + drawStart - tile.contentTop) * scaleY;
      const sourceHeight = (drawEnd - drawStart) * scaleY;
      context.drawImage(
        image,
        sourceX,
        sourceY,
        tile.crop.width * scaleX,
        sourceHeight,
        0,
        drawStart * plan.effectiveCssScale - outputStart,
        plan.width,
        sourceHeight * plan.scale
      );
      image.close();
    }

    pages.push({
      data: await canvasToPdfPage(canvas, context),
      width: plan.width,
      height
    });
  }

  const dataUrl = await buildPdfDataUrl(pages);
  return {
    dataUrl,
    pageCount: pages.length,
    width: plan.width,
    height: plan.totalHeight,
    scale: plan.scale,
    effectiveCssScale: plan.effectiveCssScale
  };
}

async function canvasToPdfPage(canvas, context) {
  if (typeof CompressionStream !== "function") {
    throw new Error("当前 Chrome 版本不支持本地 PDF 压缩");
  }

  const { width, height } = canvas;
  const rgba = context.getImageData(0, 0, width, height).data;
  const rowLength = width * 3;
  const predicted = new Uint8Array((rowLength + 1) * height);

  // PDF Predictor 15：每行使用 PNG Up 过滤器，提高页面截图的无损压缩率。
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (rowLength + 1);
    predicted[rowStart] = 2;
    for (let x = 0; x < width; x += 1) {
      const rgbaIndex = (y * width + x) * 4;
      const previousRgbaIndex = rgbaIndex - width * 4;
      const outputIndex = rowStart + 1 + x * 3;
      for (let channel = 0; channel < 3; channel += 1) {
        const current = rgba[rgbaIndex + channel];
        const previous = y ? rgba[previousRgbaIndex + channel] : 0;
        predicted[outputIndex + channel] = (current - previous + 256) % 256;
      }
    }
  }

  const compressedStream = new Blob([predicted])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(compressedStream).arrayBuffer());
}

async function buildPdfDataUrl(pages) {
  if (!pages.length) throw new Error("没有可写入 PDF 的截图页面");

  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [];
  let byteLength = 0;
  const addBytes = bytes => {
    chunks.push(bytes);
    byteLength += bytes.byteLength;
  };
  const addText = value => addBytes(encoder.encode(value));
  const addObject = (id, parts) => {
    offsets[id] = byteLength;
    addText(`${id} 0 obj\n`);
    for (const part of parts) {
      if (typeof part === "string") addText(part);
      else addBytes(part);
    }
    addText("\nendobj\n");
  };

  addBytes(new Uint8Array([
    37, 80, 68, 70, 45, 49, 46, 55, 10,
    37, 255, 255, 255, 255, 10
  ]));

  const pageIds = pages.map((_, index) => 3 + index * 3);
  const maxPageWidth = Math.max(...pages.map(page => page.width));
  const maxPageHeight = Math.max(...pages.map(page => page.height));
  const documentScale = Math.min(1, 14000 / maxPageWidth, 14000 / maxPageHeight);
  addObject(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  addObject(2, [
    `<< /Type /Pages /Count ${pages.length} /Kids [${pageIds
      .map(id => `${id} 0 R`)
      .join(" ")}] >>`
  ]);

  pages.forEach((page, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const imageId = pageId + 2;
    const pageWidth = pdfNumber(page.width * documentScale);
    const pageHeight = pdfNumber(page.height * documentScale);
    const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`;
    const contentBytes = encoder.encode(content);

    addObject(pageId, [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] `,
      `/Resources << /XObject << /Im0 ${imageId} 0 R >> >> `,
      `/Contents ${contentId} 0 R >>`
    ]);
    addObject(contentId, [
      `<< /Length ${contentBytes.byteLength} >>\nstream\n`,
      contentBytes,
      "endstream"
    ]);
    addObject(imageId, [
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} `,
      "/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode ",
      `/DecodeParms << /Predictor 15 /Colors 3 /BitsPerComponent 8 /Columns ${page.width} >> `,
      `/Length ${page.data.byteLength} >>\nstream\n`,
      page.data,
      "\nendstream"
    ]);
  });

  const xrefOffset = byteLength;
  const objectCount = 2 + pages.length * 3;
  addText(`xref\n0 ${objectCount + 1}\n`);
  addText("0000000000 65535 f \n");
  for (let id = 1; id <= objectCount; id += 1) {
    addText(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  addText(
    `trailer\n<< /Size ${objectCount + 1} /Root 1 0 R >>\n` +
    `startxref\n${xrefOffset}\n%%EOF\n`
  );

  const blob = new Blob(chunks, { type: "application/pdf" });
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("PDF 读取失败"));
    reader.readAsDataURL(blob);
  });
}

function pdfNumber(value) {
  return Number(value.toFixed(3)).toString();
}
