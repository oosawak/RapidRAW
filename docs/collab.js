let wasmProcessor = null;
let wasmProcessorPromise = null;

const STORAGE_KEY = "rapidraw-studio-strokes";
const FPS_SAMPLE_MS = 1000;

const drawSettings = {
  size: 8,
  color: "#f08c46",
};

const strokesState = {
  strokes: [],
  activeStroke: null,
  pointerDown: false,
  seq: 0,
};

const uiState = {
  fpsValue: 0,
  lastFpsTick: performance.now(),
  frameCount: 0,
};

window.addEventListener("load", async () => {
  const canvas = document.getElementById("annotationCanvas");
  const shell = document.getElementById("canvasShell");
  const userIdInput = document.getElementById("userIdInput");
  const brushSizeInput = document.getElementById("brushSizeInput");
  const brushColorInput = document.getElementById("brushColorInput");
  const addRemoteStrokeButton = document.getElementById("addRemoteStrokeButton");
  const clearStrokesButton = document.getElementById("clearStrokesButton");
  const guideToggleButton = document.getElementById("guideToggleButton");
  const guidePanel = document.getElementById("guidePanel");
  const statusPill = document.getElementById("statusPill");
  const canvasTitleLine = document.getElementById("canvasTitleLine");
  const strokeFeed = document.getElementById("strokeFeed");
  const strokeStats = document.getElementById("strokeStats");
  const fpsValue = document.getElementById("fpsValue");
  const collapseButtons = document.querySelectorAll("[data-collapse-target]");

  if (!canvas || !shell || !userIdInput || !brushSizeInput || !brushColorInput || !addRemoteStrokeButton || !clearStrokesButton || !guideToggleButton || !guidePanel || !statusPill || !canvasTitleLine || !strokeFeed || !strokeStats || !fpsValue) {
    return;
  }

  try {
    const processor = await loadWasmProcessor();
    statusPill.textContent = `WASM: ${processor.kind}`;
    statusPill.dataset.state = "ready";
    document.body.dataset.wasmKind = processor.kind;
  } catch (error) {
    console.error("Failed to initialize WASM processor", error);
    statusPill.textContent = "WASM error";
    statusPill.dataset.state = "error";
    document.body.dataset.wasmError = error instanceof Error ? error.message : String(error);
    return;
  }

  const context = canvas.getContext("2d", { alpha: true });
  strokesState.strokes = loadStrokes();
  strokesState.seq = strokesState.strokes.reduce((max, stroke) => Math.max(max, Number(stroke.seq || 0)), 0);

  const syncGuideVisibility = (visible) => {
    guidePanel.hidden = !visible;
    guideToggleButton.setAttribute("aria-pressed", String(visible));
    guideToggleButton.textContent = visible ? "Hide Guide" : "Show Guide";
  };

  syncGuideVisibility(false);

  guideToggleButton.addEventListener("click", () => {
    syncGuideVisibility(guidePanel.hidden);
  });

  brushSizeInput.addEventListener("input", () => {
    const value = Number(brushSizeInput.value);
    drawSettings.size = Number.isFinite(value) ? value : drawSettings.size;
    if (strokesState.activeStroke && strokesState.activeStroke.source === "local") {
      strokesState.activeStroke.size = drawSettings.size;
    }
    render();
  });

  brushColorInput.addEventListener("input", () => {
    drawSettings.color = brushColorInput.value || drawSettings.color;
    if (strokesState.activeStroke && strokesState.activeStroke.source === "local") {
      strokesState.activeStroke.color = drawSettings.color;
    }
    render();
  });

  collapseButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("data-collapse-target");
      const card = button.closest(".collapsible");
      const body = targetId ? document.getElementById(targetId) : null;
      if (!card || !body) {
        return;
      }
      const collapsed = card.dataset.collapsed === "true";
      card.dataset.collapsed = String(!collapsed);
      button.textContent = collapsed ? "−" : "+";
      button.setAttribute("aria-expanded", String(!collapsed));
    });
  });

  const resize = () => {
    const width = shell.clientWidth;
    const height = shell.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    renderOverlay(context, width, height);
  };

  const render = () => {
    const width = shell.clientWidth;
    const height = shell.clientHeight;
    context.clearRect(0, 0, width, height);
    renderOverlay(context, width, height);
    renderStats(strokeStats, fpsValue);
    renderFeed(strokeFeed);
  };

  const updateCanvasState = () => {
    const hasDrawing = Boolean(strokesState.activeStroke || strokesState.strokes.length);
    shell.classList.toggle("has-drawn", hasDrawing);
    canvasTitleLine.hidden = hasDrawing;
  };

  const startFrameLoop = () => {
    const tick = (now) => {
      uiState.frameCount += 1;
      const elapsed = now - uiState.lastFpsTick;
      if (elapsed >= FPS_SAMPLE_MS) {
        uiState.fpsValue = Math.round((uiState.frameCount * 1000) / elapsed);
        uiState.frameCount = 0;
        uiState.lastFpsTick = now;
        fpsValue.textContent = String(uiState.fpsValue);
      }
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  };

  const onPointerDown = (event) => {
    event.preventDefault();
    if (!event.isPrimary) {
      return;
    }
    strokesState.pointerDown = true;
    canvas.setPointerCapture(event.pointerId);
    strokesState.activeStroke = createStroke("local", userIdInput.value || "me", pointerToPoint(event, canvas));
    strokesState.strokes = [...strokesState.strokes, strokesState.activeStroke].slice(-24);
    updateCanvasState();
    persist();
    render();
  };

  const onPointerMove = (event) => {
    if (!strokesState.pointerDown || !strokesState.activeStroke) {
      return;
    }
    appendPoint(strokesState.activeStroke, pointerToPoint(event, canvas));
    updateCanvasState();
    persist();
    render();
  };

  const onPointerUp = (event) => {
    if (!strokesState.pointerDown) {
      return;
    }
    strokesState.pointerDown = false;
    if (strokesState.activeStroke) {
      appendPoint(strokesState.activeStroke, pointerToPoint(event, canvas));
      strokesState.activeStroke = null;
      updateCanvasState();
      persist();
    }
    render();
  };

  const onPointerCancel = () => {
    strokesState.pointerDown = false;
    strokesState.activeStroke = null;
    updateCanvasState();
    render();
  };

  const addRemoteSampleStroke = () => {
    const width = shell.clientWidth;
    const height = shell.clientHeight;
    const now = Date.now();
    const stroke = createStroke("remote", "remote-demo", null);
    stroke.color = "#74d6ff";
    stroke.size = 5;
    stroke.points = [
      { x: width * 0.18, y: height * 0.55, t: now },
      { x: width * 0.34, y: height * 0.32, t: now + 16 },
      { x: width * 0.52, y: height * 0.47, t: now + 32 },
      { x: width * 0.69, y: height * 0.22, t: now + 48 },
      { x: width * 0.84, y: height * 0.40, t: now + 64 },
    ];
    strokesState.strokes = [...strokesState.strokes, stroke].slice(-24);
    updateCanvasState();
    persist();
    render();
  };

  const clearStrokes = () => {
    strokesState.strokes = [];
    strokesState.activeStroke = null;
    updateCanvasState();
    persist();
    render();
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerCancel);
  canvas.addEventListener("pointerleave", onPointerCancel);
  addRemoteStrokeButton.addEventListener("click", addRemoteSampleStroke);
  clearStrokesButton.addEventListener("click", clearStrokes);
  userIdInput.addEventListener("input", render);
  window.addEventListener("resize", resize);
  window.addEventListener("orientationchange", resize);

  updateCanvasState();
  resize();
  render();
  startFrameLoop();

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(strokesState.strokes));
    } catch {
      // Ignore localStorage failures in restricted sessions.
    }
  }
});

function loadStrokes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function createStroke(source, userId, firstPoint) {
  const seq = ++strokesState.seq;
  const isRemote = source === "remote";
  return {
    seq,
    stroke_id: `${source}-${Date.now()}-${seq}`,
    user_id: userId,
    tool: "brush",
    color: isRemote ? "#74d6ff" : drawSettings.color,
    size: isRemote ? 5 : drawSettings.size,
    points: firstPoint ? [firstPoint] : [],
    timestamp: new Date().toISOString(),
    source,
  };
}

function appendPoint(stroke, point) {
  stroke.points.push(point);
}

function pointerToPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: clamp(event.clientX - rect.left, 0, rect.width),
    y: clamp(event.clientY - rect.top, 0, rect.height),
    t: Date.now(),
  };
}

async function loadWasmProcessor() {
  if (!wasmProcessorPromise) {
    wasmProcessorPromise = import("./wasm/bridge.js")
      .then((mod) => mod.createProcessor())
      .then((processor) => {
        wasmProcessor = processor;
        return processor;
      });
  }
  return wasmProcessorPromise;
}

function renderOverlay(context, width, height) {
  context.clearRect(0, 0, width, height);
  const strokes = [...strokesState.strokes];
  if (strokesState.activeStroke) {
    strokes.push(strokesState.activeStroke);
  }
  for (const stroke of strokes) {
    drawStroke(context, stroke);
  }
}

function drawStroke(context, stroke) {
  const points = getRenderablePoints(stroke.points || []);
  if (points.length < 2) {
    return;
  }
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = stroke.color || "#f08c46";
  context.lineWidth = stroke.size || 6;
  context.globalAlpha = stroke.source === "remote" ? 0.75 : 0.95;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    context.lineTo(points[i].x, points[i].y);
  }
  context.stroke();
  context.restore();
}

function getRenderablePoints(points) {
  if (!wasmProcessor || typeof wasmProcessor.interpolateStroke !== "function") {
    throw new Error("WASM processor is not ready");
  }
  return wasmProcessor.interpolateStroke(points, 6);
}

function renderStats(target, fpsValue) {
  const localCount = strokesState.strokes.filter((stroke) => stroke.source === "local").length;
  const remoteCount = strokesState.strokes.filter((stroke) => stroke.source === "remote").length;
  const active = strokesState.activeStroke ? strokesState.activeStroke.stroke_id : "none";
  target.replaceChildren();
  [
    ["Local", String(localCount)],
    ["Remote", String(remoteCount)],
    ["Active", active],
    ["Brush", `${drawSettings.size}px`],
    ["Color", drawSettings.color],
    ["FPS", String(uiState.fpsValue)],
  ].forEach(([label, value]) => {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = value;
    target.append(dt, dd);
  });
  fpsValue.textContent = String(uiState.fpsValue);
}

function renderFeed(target) {
  const recent = [...strokesState.strokes].slice(-4).reverse();
  if (!recent.length) {
    target.textContent = "No strokes yet. Draw on the preview to create a local stroke, or add a remote sample.";
    return;
  }

  target.textContent = recent
    .map((stroke) =>
      JSON.stringify(
        {
          stroke_id: stroke.stroke_id,
          user_id: stroke.user_id,
          source: stroke.source,
          points: stroke.points.length,
          timestamp: stroke.timestamp,
        },
        null,
        2,
      ),
    )
    .join("\n\n");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
