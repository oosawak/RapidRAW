let wasmProcessor = null;
let wasmProcessorPromise = null;

const STORAGE_KEY = 'rapidraw-wasm-lab-strokes';
const FPS_SAMPLE_MS = 1000;
const MAX_STROKES = 24;

const drawSettings = {
  size: 8,
  color: '#f08c46',
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

window.addEventListener('load', async () => {
  const canvas = document.getElementById('wasmCanvas');
  const shell = document.getElementById('canvasShell');
  const brushSizeInput = document.getElementById('brushSizeInput');
  const brushColorInput = document.getElementById('brushColorInput');
  const addRemoteButton = document.getElementById('addRemoteStrokeButton');
  const demoRemoteButton = document.getElementById('demoRemoteButton');
  const clearButton = document.getElementById('clearStrokesButton');
  const statusPill = document.getElementById('statusPill');
  const canvasTitleLine = document.getElementById('canvasTitleLine');
  const strokeFeed = document.getElementById('strokeFeed');
  const strokeStats = document.getElementById('strokeStats');
  const fpsValue = document.getElementById('fpsValue');
  const collapseButtons = document.querySelectorAll('[data-collapse-target]');

  if (!canvas || !shell || !brushSizeInput || !brushColorInput || !addRemoteButton || !clearButton || !statusPill || !canvasTitleLine || !strokeFeed || !strokeStats || !fpsValue) {
    return;
  }

  try {
    const processor = await loadWasmProcessor();
    statusPill.textContent = `WASM: ${processor.kind}`;
    statusPill.dataset.state = 'ready';
    document.body.dataset.wasmKind = processor.kind;
  } catch (error) {
    console.error('Failed to initialize WASM processor', error);
    statusPill.textContent = 'WASM error';
    statusPill.dataset.state = 'error';
    document.body.dataset.wasmError = error instanceof Error ? error.message : String(error);
    return;
  }

  const context = canvas.getContext('2d', { alpha: true });
  if (!context) {
    statusPill.textContent = 'Canvas error';
    statusPill.dataset.state = 'error';
    return;
  }

  canvas.style.touchAction = 'none';
  strokesState.strokes = loadStrokes();
  strokesState.seq = strokesState.strokes.reduce((max, stroke) => Math.max(max, Number(stroke.seq || 0)), 0);

  brushSizeInput.addEventListener('input', () => {
    const next = Number(brushSizeInput.value);
    if (Number.isFinite(next)) {
      drawSettings.size = next;
      if (strokesState.activeStroke && strokesState.activeStroke.source === 'local') {
        strokesState.activeStroke.inputSize = next;
        strokesState.activeStroke.rendered = null;
      }
    }
    render();
  });

  brushColorInput.addEventListener('input', () => {
    drawSettings.color = brushColorInput.value || drawSettings.color;
    if (strokesState.activeStroke && strokesState.activeStroke.source === 'local') {
      strokesState.activeStroke.inputColor = drawSettings.color;
      strokesState.activeStroke.rendered = null;
    }
    render();
  });

  collapseButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const targetId = button.getAttribute('data-collapse-target');
      const card = button.closest('.collapsible');
      const body = targetId ? document.getElementById(targetId) : null;
      if (!card || !body) {
        return;
      }
      const collapsed = card.dataset.collapsed === 'true';
      card.dataset.collapsed = String(!collapsed);
      button.textContent = collapsed ? '−' : '+';
      button.setAttribute('aria-expanded', String(!collapsed));
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
    render();
  };

  const updateCanvasState = () => {
    const hasDrawing = Boolean(strokesState.activeStroke || strokesState.strokes.length);
    shell.classList.toggle('has-drawn', hasDrawing);
    canvasTitleLine.hidden = false;
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
    const brush = getCurrentBrush();
    strokesState.activeStroke = createStroke('local', 'me', pointerToPoint(event, canvas), brush);
    updateCanvasState();
    persist();
    render();
  };

  const onPointerMove = (event) => {
    if (!strokesState.pointerDown || !strokesState.activeStroke) {
      return;
    }
    appendPoint(strokesState.activeStroke, pointerToPoint(event, canvas));
    strokesState.activeStroke.rendered = null;
    updateCanvasState();
    render();
  };

  const onPointerUp = (event) => {
    if (!strokesState.pointerDown) {
      return;
    }
    strokesState.pointerDown = false;
    if (strokesState.activeStroke) {
      appendPoint(strokesState.activeStroke, pointerToPoint(event, canvas));
      awaitCommitActiveStroke().then(() => {
        updateCanvasState();
        persist();
        render();
      });
      return;
    }
    updateCanvasState();
    persist();
    render();
  };

  const onPointerCancel = () => {
    strokesState.pointerDown = false;
    strokesState.activeStroke = null;
    updateCanvasState();
    render();
  };

  const addRemoteSampleStroke = async () => {
    const width = shell.clientWidth;
    const height = shell.clientHeight;
    const now = Date.now();
    const brush = { color: '#74d6ff', size: 5 };
    const stroke = createStroke('remote', 'remote-demo', null, brush);
    stroke.points = [
      { x: width * 0.18, y: height * 0.55, t: now },
      { x: width * 0.34, y: height * 0.32, t: now + 16 },
      { x: width * 0.52, y: height * 0.47, t: now + 32 },
      { x: width * 0.69, y: height * 0.22, t: now + 48 },
      { x: width * 0.84, y: height * 0.40, t: now + 64 },
    ];
    stroke.inputPoints = stroke.points.slice();
    stroke.rendered = await prepareRenderableStroke(stroke, 6);
    stroke.points = stroke.rendered.points;
    stroke.color = stroke.rendered.color;
    stroke.size = stroke.rendered.size;
    strokesState.strokes = clampStrokes([...strokesState.strokes, stroke]);
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

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('pointerleave', onPointerCancel);
  addRemoteButton.addEventListener('click', () => {
    void addRemoteSampleStroke();
  });
  demoRemoteButton.addEventListener('click', () => {
    void addRemoteSampleStroke();
  });
  clearButton.addEventListener('click', clearStrokes);
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  updateCanvasState();
  resize();
  render();
  startFrameLoop();

  async function awaitCommitActiveStroke() {
    const stroke = strokesState.activeStroke;
    if (!stroke) {
      return;
    }
    const rendered = await prepareRenderableStroke(stroke, Math.max(4, Math.round(drawSettings.size * 0.75)));
    stroke.rendered = rendered;
    stroke.color = rendered.color;
    stroke.size = rendered.size;
    stroke.points = rendered.points;
    strokesState.strokes = clampStrokes([...strokesState.strokes, stroke]);
    strokesState.activeStroke = null;
  }

  async function prepareRenderableStroke(stroke, spacing) {
    const brush = {
      color: stroke.inputColor || stroke.color || drawSettings.color,
      size: stroke.inputSize || stroke.size || drawSettings.size,
    };
    const points = stroke.points.map((point) => ({ x: point.x, y: point.y }));
    const prepared = await Promise.resolve(wasmProcessor.prepareStroke(points, brush, spacing));
    return {
      points: prepared.points,
      color: prepared.color,
      size: prepared.size,
    };
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(strokesState.strokes));
    } catch {
      // Ignore localStorage failures in restricted sessions.
    }
  }

  function render() {
    const width = shell.clientWidth;
    const height = shell.clientHeight;
    context.clearRect(0, 0, width, height);
    renderOverlay(context);
    renderStats(strokeStats, fpsValue);
    renderFeed(strokeFeed);
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

function clampStrokes(strokes) {
  return strokes.slice(-MAX_STROKES);
}

async function loadWasmProcessor() {
  if (!wasmProcessorPromise) {
    wasmProcessorPromise = import('./wasm/bridge.js').then(async (module) => {
      wasmProcessor = await module.createProcessor();
      return wasmProcessor;
    });
  }
  return wasmProcessorPromise;
}

function getCurrentBrush() {
  return {
    color: drawSettings.color,
    size: drawSettings.size,
  };
}

function createStroke(source, userId, firstPoint, brush = null) {
  const seq = ++strokesState.seq;
  const createdAt = new Date().toISOString();
  return {
    source,
    stroke_id: `${source}-${Date.now()}-${seq}`,
    timestamp: createdAt,
    tool: 'brush',
    user_id: userId,
    inputColor: brush?.color ?? drawSettings.color,
    inputSize: brush?.size ?? drawSettings.size,
    color: brush?.color ?? drawSettings.color,
    size: brush?.size ?? drawSettings.size,
    points: firstPoint ? [firstPoint] : [],
    inputPoints: firstPoint ? [firstPoint] : [],
    rendered: null,
  };
}

function appendPoint(stroke, point) {
  stroke.points.push(point);
  stroke.inputPoints = stroke.inputPoints || [];
  stroke.inputPoints.push(point);
}

function pointerToPoint(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  return {
    x: ((event.clientX - rect.left) / width) * canvas.clientWidth,
    y: ((event.clientY - rect.top) / height) * canvas.clientHeight,
    t: Date.now(),
  };
}

function renderOverlay(context) {
  context.save();
  context.lineCap = 'round';
  context.lineJoin = 'round';
  const strokes = [...strokesState.strokes];
  if (strokesState.activeStroke) {
    strokes.push(strokesState.activeStroke);
  }

  for (const stroke of strokes) {
    drawStroke(context, stroke);
  }

  context.restore();
}

function drawStroke(context, stroke) {
  const rendered = stroke.rendered || {
    points: stroke.points.map((point) => ({ x: point.x, y: point.y })),
    color: stroke.color,
    size: stroke.size,
  };

  const points = rendered.points || [];
  if (points.length < 2) {
    return;
  }

  context.beginPath();
  context.strokeStyle = rendered.color || stroke.color || '#f08c46';
  context.lineWidth = Math.max(1, rendered.size || stroke.size || 6);
  context.globalAlpha = stroke.source === 'remote' ? 0.75 : 0.95;
  context.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) {
    context.lineTo(points[i].x, points[i].y);
  }
  context.stroke();
  context.globalAlpha = 1;
}

function renderStats(target, fpsValue) {
  const localCount = strokesState.strokes.filter((stroke) => stroke.source === 'local').length;
  const remoteCount = strokesState.strokes.filter((stroke) => stroke.source === 'remote').length;
  const active = strokesState.activeStroke ? strokesState.activeStroke.stroke_id : 'none';
  const latest = strokesState.strokes.at(-1);
  const items = [
    ['Strokes', String(strokesState.strokes.length)],
    ['Local', String(localCount)],
    ['Remote', String(remoteCount)],
    ['Active', active],
    ['FPS', String(uiState.fpsValue)],
    ['Input color', latest?.inputColor || drawSettings.color],
    ['Output color', latest?.color || drawSettings.color],
    ['Input size', String(latest?.inputSize || drawSettings.size)],
    ['Output size', String(latest?.size || drawSettings.size)],
    ['WASM', wasmProcessor?.kind || 'loading'],
  ];
  target.innerHTML = items
    .map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`)
    .join('');
  fpsValue.textContent = String(uiState.fpsValue);
}

function renderFeed(target) {
  const recent = [...strokesState.strokes].slice(-4).reverse();
  if (recent.length === 0) {
    target.textContent = 'No strokes yet. Draw on the preview to create a local stroke, or add a sample remote stroke.';
    return;
  }

  target.textContent = recent
    .map((stroke) =>
      JSON.stringify(
        {
          stroke_id: stroke.stroke_id,
          user_id: stroke.user_id,
          source: stroke.source,
          inputColor: stroke.inputColor,
          inputSize: stroke.inputSize,
          color: stroke.color,
          size: stroke.size,
          points: stroke.points.length,
          timestamp: stroke.timestamp,
        },
        null,
        2,
      ),
    )
    .join('\n\n');
}
