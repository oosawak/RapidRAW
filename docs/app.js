const DEFAULT_STATE = {
  exposure: 0,
  contrast: 12,
  saturation: 14,
  temperature: 0,
  shadows: 8,
  vignette: 22,
  grain: 0,
};

const SLIDERS = [
  { key: "exposure", label: "Exposure", min: -100, max: 100, step: 1, suffix: "" },
  { key: "contrast", label: "Contrast", min: -100, max: 100, step: 1, suffix: "" },
  { key: "saturation", label: "Saturation", min: -100, max: 100, step: 1, suffix: "" },
  { key: "temperature", label: "Temperature", min: -100, max: 100, step: 1, suffix: "" },
  { key: "shadows", label: "Shadows", min: -100, max: 100, step: 1, suffix: "" },
  { key: "vignette", label: "Vignette", min: 0, max: 100, step: 1, suffix: "" },
  { key: "grain", label: "Grain", min: 0, max: 100, step: 1, suffix: "" },
];

const DEMO_PRESET = {
  name: "Amber Fade",
  state: {
    exposure: 7,
    contrast: 22,
    saturation: 10,
    temperature: 28,
    shadows: 12,
    vignette: 30,
    grain: 6,
  },
};

const STORAGE_KEYS = {
  state: "rapidraw-studio-state",
  recents: "rapidraw-studio-recents",
  presets: "rapidraw-studio-presets",
};

const canvas = document.getElementById("previewCanvas");
const ctx = canvas.getContext("2d", { alpha: false });
const fileInput = document.getElementById("fileInput");
const dropzone = document.getElementById("dropzone");
const emptyState = document.getElementById("emptyState");
const statusPill = document.getElementById("statusPill");
const imageMeta = document.getElementById("imageMeta");
const recentList = document.getElementById("recentList");
const recentCount = document.getElementById("recentCount");
const presetList = document.getElementById("presetList");
const statusGrid = document.getElementById("statusGrid");
const renderState = document.getElementById("renderState");
const sliderGroup = document.getElementById("sliderGroup");
const canvasShell = document.getElementById("canvasShell");
const resetButton = document.getElementById("resetButton");
const exportButton = document.getElementById("exportButton");
const savePresetButton = document.getElementById("savePresetButton");

const state = {
  ...DEFAULT_STATE,
};

let currentImage = null;
let currentImageName = "";
let recentFiles = loadJSON(STORAGE_KEYS.recents, []);
let presets = loadJSON(STORAGE_KEYS.presets, []);
let renderQueued = false;
let processor = null;
let processorStatus = "js fallback";

init();

function init() {
  hydrateState(loadJSON(STORAGE_KEYS.state, {}));
  buildSliders();
  bindEvents();
  loadProcessor();
  syncUI();
  render();
}

function bindEvents() {
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (file) {
      await loadImageFile(file);
      fileInput.value = "";
    }
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove("dragging");
    });
  });

  dropzone.addEventListener("drop", async (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      await loadImageFile(file);
    }
  });

  resetButton.addEventListener("click", () => {
    Object.assign(state, DEFAULT_STATE);
    syncUI();
    scheduleRender();
    saveState();
  });

  exportButton.addEventListener("click", exportPNG);

  savePresetButton.addEventListener("click", () => {
    const name = prompt("Preset name", `Preset ${presets.length + 1}`)?.trim();
    if (!name) {
      return;
    }

    presets = [{ name, state: getStateSnapshot() }, ...presets].slice(0, 8);
    saveJSON(STORAGE_KEYS.presets, presets);
    renderPresets();
  });


  window.addEventListener("resize", () => {
    scheduleRender();
  });
}

async function loadProcessor() {
  try {
    const module = await import("./wasm/bridge.js");
    processor = await module.createProcessor();
    processorStatus = processor.kind === "wasm" ? "wasm ready" : "js fallback";
    renderState.textContent = processorStatus;
  } catch {
    processor = null;
    processorStatus = "js fallback";
    renderState.textContent = processorStatus;
  }
}

function buildSliders() {
  sliderGroup.replaceChildren();

  for (const config of SLIDERS) {
    const wrap = document.createElement("label");
    wrap.className = "slider";
    wrap.innerHTML = `
      <div class="slider-header">
        <span>${config.label}</span>
        <strong data-value-for="${config.key}">${formatValue(state[config.key], config.suffix)}</strong>
      </div>
      <input
        type="range"
        min="${config.min}"
        max="${config.max}"
        step="${config.step}"
        value="${state[config.key]}"
        data-key="${config.key}"
      />
    `;
    sliderGroup.appendChild(wrap);
  }

  sliderGroup.addEventListener("input", onSliderInput);
}

function onSliderInput(event) {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== "range") {
    return;
  }

  const key = input.dataset.key;
  if (!key) {
    return;
  }

  state[key] = Number(input.value);
  const valueNode = sliderGroup.querySelector(`[data-value-for="${key}"]`);
  if (valueNode) {
    valueNode.textContent = formatValue(state[key]);
  }
  saveState();
  scheduleRender();
}

async function loadImageFile(file) {
  if (!file.type.startsWith("image/")) {
    return;
  }

  renderState.textContent = "loading";
  const dataUrl = await readAsDataURL(file);
  const image = await createImage(dataUrl);

  currentImage = image;
  currentImageName = file.name;
  pushRecentFile(file.name, file.size);
  updateImageMeta();
  renderState.textContent = "ready";
  scheduleRender();
}

function pushRecentFile(name, size) {
  const entry = {
    name,
    sizeLabel: formatBytes(size),
    loadedAt: new Date().toISOString(),
  };
  recentFiles = [entry, ...recentFiles.filter((item) => item.name !== name)].slice(0, 6);
  saveJSON(STORAGE_KEYS.recents, recentFiles);
  renderRecentFiles();
}

function renderRecentFiles() {
  recentList.replaceChildren();
  recentCount.textContent = String(recentFiles.length);

  if (!recentFiles.length) {
    const empty = document.createElement("li");
    empty.innerHTML = `<strong>No recent files</strong><span>Load a photo to start a session.</span>`;
    recentList.appendChild(empty);
    return;
  }

  recentFiles.forEach((file, index) => {
    const item = document.createElement("li");
    if (index === 0) {
      item.classList.add("active");
    }
    item.innerHTML = `<strong>${escapeHtml(file.name)}</strong><span>${file.sizeLabel}</span>`;
    recentList.appendChild(item);
  });
}

function renderPresets() {
  presetList.replaceChildren();

  const items = presets.length ? presets : [{ name: "No saved presets yet", state: null }];

  items.forEach((preset, index) => {
    const item = document.createElement("li");
    const isEmpty = preset.state === null;
    item.innerHTML = `
      <strong>${escapeHtml(preset.name)}</strong>
      <span>${isEmpty ? "Use Save Current to store a look." : summarizeState(preset.state)}</span>
    `;
    if (!isEmpty) {
      item.addEventListener("click", () => applyPreset(preset));
      item.style.cursor = "pointer";
    }
    if (!index) {
      item.classList.add("active");
    }
    presetList.appendChild(item);
  });
}

function renderStatus() {
  const rows = [
    ["Image", currentImageName || "none"],
    ["Exposure", formatValue(state.exposure)],
    ["Contrast", formatValue(state.contrast)],
    ["Saturation", formatValue(state.saturation)],
    ["Temp", formatValue(state.temperature)],
    ["Grain", formatValue(state.grain)],
    ["WASM", processorStatus],
  ];

  statusGrid.replaceChildren();
  rows.forEach(([label, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    statusGrid.append(dt, dd);
  });
}

function render() {
  renderQueued = false;
  const width = canvasShell.clientWidth;
  const height = canvasShell.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(width * dpr));
  canvas.height = Math.max(1, Math.round(height * dpr));
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  drawFrame(ctx, width, height);

  emptyState.classList.toggle("hidden", Boolean(currentImage));
  statusPill.textContent = currentImage ? "Editing image" : "No image loaded";
  renderStatus();
}

function drawFrame(renderContext, width, height) {
  renderContext.save();
  renderContext.fillStyle = "#0a0d12";
  renderContext.fillRect(0, 0, width, height);

  if (!currentImage) {
    drawPlaceholder(renderContext, width, height);
    renderContext.restore();
    return;
  }

  const fit = fitContain(currentImage.width, currentImage.height, width * 0.92, height * 0.92);
  const x = (width - fit.width) / 2;
  const y = (height - fit.height) / 2;

  renderContext.filter = buildFilterString();
  renderContext.drawImage(currentImage, x, y, fit.width, fit.height);
  renderContext.filter = "none";

  renderContext.globalCompositeOperation = "source-over";
  renderContext.fillStyle = buildTemperatureOverlay();
  renderContext.fillRect(x, y, fit.width, fit.height);

  drawVignette(renderContext, width, height);
  drawGrain(renderContext, width, height);
  drawLightFrame(renderContext, width, height, x, y, fit.width, fit.height);

  renderContext.restore();
}

function drawPlaceholder(renderContext, width, height) {
  const gradient = renderContext.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "rgba(116, 214, 255, 0.08)");
  gradient.addColorStop(1, "rgba(240, 140, 70, 0.1)");
  renderContext.fillStyle = gradient;
  renderContext.fillRect(0, 0, width, height);

  renderContext.fillStyle = "rgba(255, 255, 255, 0.03)";
  for (let i = 0; i < width; i += 36) {
    renderContext.fillRect(i, 0, 1, height);
  }

  renderContext.fillStyle = "rgba(255, 255, 255, 0.04)";
  for (let i = 0; i < height; i += 36) {
    renderContext.fillRect(0, i, width, 1);
  }
}

function drawVignette(renderContext, width, height) {
  const alpha = state.vignette / 100;
  const gradient = renderContext.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.16,
    width / 2,
    height / 2,
    Math.min(width, height) * 0.75,
  );
  gradient.addColorStop(0, "rgba(0, 0, 0, 0)");
  gradient.addColorStop(1, `rgba(0, 0, 0, ${alpha * 0.65})`);
  renderContext.fillStyle = gradient;
  renderContext.fillRect(0, 0, width, height);
}

function drawGrain(renderContext, width, height) {
  const amount = state.grain / 100;
  if (amount <= 0) {
    return;
  }

  const tile = document.createElement("canvas");
  tile.width = 128;
  tile.height = 128;
  const tileCtx = tile.getContext("2d");
  const imageData = tileCtx.createImageData(tile.width, tile.height);
  const pixels = imageData.data;

  for (let index = 0; index < pixels.length; index += 4) {
    const value = 128 + Math.round((Math.random() - 0.5) * 255 * amount);
    pixels[index] = value;
    pixels[index + 1] = value;
    pixels[index + 2] = value;
    pixels[index + 3] = Math.round(16 + 100 * amount);
  }

  tileCtx.putImageData(imageData, 0, 0);
  renderContext.globalAlpha = 0.45;
  renderContext.drawImage(tile, 0, 0, width, height);
  renderContext.globalAlpha = 1;
}

function drawLightFrame(renderContext, width, height, x, y, drawWidth, drawHeight) {
  renderContext.strokeStyle = "rgba(255, 255, 255, 0.08)";
  renderContext.lineWidth = 1;
  renderContext.strokeRect(x - 0.5, y - 0.5, drawWidth + 1, drawHeight + 1);

  const glow = renderContext.createLinearGradient(x, y, x + drawWidth, y + drawHeight);
  glow.addColorStop(0, "rgba(255, 255, 255, 0.08)");
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");
  renderContext.fillStyle = glow;
  renderContext.fillRect(x, y, drawWidth, 1);
}

function buildFilterString() {
  const exposure = 1 + state.exposure / 140;
  const contrast = 1 + state.contrast / 140;
  const saturation = 1 + state.saturation / 120;
  const shadowsLift = 1 + state.shadows / 220;
  const warmth = state.temperature / 100;
  const hueShift = warmth * -12;
  const sepia = Math.max(0, warmth) * 0.22;

  return [
    `brightness(${clamp(exposure + state.shadows / 400, 0.2, 2.6)})`,
    `contrast(${clamp(contrast, 0.2, 2.6)})`,
    `saturate(${clamp(saturation, 0, 3.2)})`,
    `sepia(${sepia.toFixed(3)})`,
    `hue-rotate(${hueShift.toFixed(2)}deg)`,
    `opacity(${clamp(shadowsLift, 0.8, 1.2)})`,
  ].join(" ");
}

function buildTemperatureOverlay() {
  const warmth = state.temperature / 100;
  const alpha = Math.abs(warmth) * 0.12;
  if (warmth > 0) {
    return `rgba(255, 168, 91, ${alpha})`;
  }
  if (warmth < 0) {
    return `rgba(98, 160, 255, ${alpha})`;
  }
  return "rgba(255, 255, 255, 0)";
}

function fitContain(srcWidth, srcHeight, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / srcWidth, maxHeight / srcHeight, 1);
  return {
    width: Math.round(srcWidth * scale),
    height: Math.round(srcHeight * scale),
  };
}

function scheduleRender() {
  if (renderQueued) {
    return;
  }
  renderQueued = true;
  requestAnimationFrame(render);
}

async function exportPNG() {
  if (!currentImage) {
    alert("Load an image before exporting.");
    return;
  }

  renderState.textContent = "exporting";
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = currentImage.width;
  exportCanvas.height = currentImage.height;
  const exportContext = exportCanvas.getContext("2d", { alpha: false });
  exportContext.imageSmoothingEnabled = true;
  exportContext.imageSmoothingQuality = "high";

  drawExportFrame(exportContext, exportCanvas.width, exportCanvas.height, Boolean(processor));
  await gradeExportCanvas(exportContext, exportCanvas.width, exportCanvas.height);

  const url = exportCanvas.toDataURL("image/png");
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(currentImageName || "rapidraw-studio")}.png`;
  a.click();
  renderState.textContent = "ready";
}

function drawExportFrame(exportContext, width, height, useProcessor = false) {
  exportContext.fillStyle = "#0a0d12";
  exportContext.fillRect(0, 0, width, height);

  if (useProcessor) {
    exportContext.drawImage(currentImage, 0, 0, width, height);
    return;
  }

  exportContext.filter = buildFilterString();
  exportContext.drawImage(currentImage, 0, 0, width, height);
  exportContext.filter = "none";
  exportContext.fillStyle = buildTemperatureOverlay();
  exportContext.fillRect(0, 0, width, height);
  const vignette = exportContext.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.15,
    width / 2,
    height / 2,
    Math.min(width, height) * 0.75,
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, `rgba(0, 0, 0, ${state.vignette / 160})`);
  exportContext.fillStyle = vignette;
  exportContext.fillRect(0, 0, width, height);
  drawExportGrain(exportContext, width, height);
}

async function gradeExportCanvas(exportContext, width, height) {
  if (!processor) {
    return;
  }

  const imageData = exportContext.getImageData(0, 0, width, height);
  const graded = await processor.grade(imageData, width, height, getStateSnapshot());
  if (graded) {
    exportContext.putImageData(graded, 0, 0);
  }
}

function drawExportGrain(exportContext, width, height) {
  const amount = state.grain / 100;
  if (amount <= 0) {
    return;
  }

  const tile = document.createElement("canvas");
  tile.width = 128;
  tile.height = 128;
  const tileCtx = tile.getContext("2d");
  const imageData = tileCtx.createImageData(tile.width, tile.height);
  const pixels = imageData.data;

  for (let index = 0; index < pixels.length; index += 4) {
    const value = 128 + Math.round((Math.random() - 0.5) * 255 * amount);
    pixels[index] = value;
    pixels[index + 1] = value;
    pixels[index + 2] = value;
    pixels[index + 3] = Math.round(16 + 100 * amount);
  }

  tileCtx.putImageData(imageData, 0, 0);
  exportContext.globalAlpha = 0.4;
  exportContext.drawImage(tile, 0, 0, width, height);
  exportContext.globalAlpha = 1;
}

function updateImageMeta() {
  if (!currentImage) {
    imageMeta.textContent = "Drag a file or open a photo";
    return;
  }
  imageMeta.textContent = `${currentImageName} · ${currentImage.width} × ${currentImage.height}`;
}

function syncUI() {
  for (const config of SLIDERS) {
    const input = sliderGroup.querySelector(`[data-key="${config.key}"]`);
    const valueNode = sliderGroup.querySelector(`[data-value-for="${config.key}"]`);
    if (input) {
      input.value = String(state[config.key]);
    }
    if (valueNode) {
      valueNode.textContent = formatValue(state[config.key], config.suffix);
    }
  }
  updateImageMeta();
  renderRecentFiles();
  renderPresets();
  renderStatus();
}

function applyPreset(preset) {
  if (!preset.state) {
    return;
  }
  Object.assign(state, DEFAULT_STATE, preset.state);
  syncUI();
  saveState();
  scheduleRender();
}

function getStateSnapshot() {
  return {
    exposure: state.exposure,
    contrast: state.contrast,
    saturation: state.saturation,
    temperature: state.temperature,
    shadows: state.shadows,
    vignette: state.vignette,
    grain: state.grain,
  };
}

function hydrateState(source) {
  Object.assign(state, DEFAULT_STATE, source || {});
}

function saveState() {
  saveJSON(STORAGE_KEYS.state, getStateSnapshot());
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage errors in private or restricted sessions.
  }
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function createImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function formatValue(value, suffix = "") {
  return `${value >= 0 ? "+" : ""}${value}${suffix}`;
}

function summarizeState(snapshot) {
  return `Exp ${snapshot.exposure}, Con ${snapshot.contrast}, Sat ${snapshot.saturation}, Tmp ${snapshot.temperature}`;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) {
    return "unknown size";
  }
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

window.addEventListener("load", () => {
  renderRecentFiles();
  renderPresets();
  updateImageMeta();
  render();
});
