let wasmProcessor = null;
let wasmProcessorPromise = null;

const state = {
  strokes: [],
  activeStroke: null,
  pointerDown: false,
  seq: 0,
  brush: { size: 8, color: '#f08c46' },
  fpsValue: 0,
  lastFpsTick: performance.now(),
  frameCount: 0,
  renderScale: 1,
  lastPointerType: 'none',
  lastPointerMeta: 'pointer events waiting',
  pointerLog: '-',
};

window.addEventListener('load', async () => {
  const canvas = document.getElementById('annotationCanvas');
  const shell = document.getElementById('canvasShell');
  const brushSizeInput = document.getElementById('brushSizeInput');
  const brushColorInput = document.getElementById('brushColorInput');
  const undoButton = document.getElementById('undoButton');
  const clearButton = document.getElementById('clearButton');
  const statusPill = document.getElementById('statusPill');
  const statusGrid = document.getElementById('statusGrid');
  const fpsValue = document.getElementById('fpsValue');
  const drawMeta = document.getElementById('drawMeta');
  const brushSummary = document.getElementById('brushSummary');
  const pointerState = document.getElementById('pointerState');
  const pointerType = document.getElementById('pointerType');
  const pointerMeta = document.getElementById('pointerMeta');
  const pointerLog = document.getElementById('pointerLog');

  if (!canvas || !shell || !brushSizeInput || !brushColorInput || !undoButton || !clearButton || !statusPill || !statusGrid || !fpsValue || !drawMeta || !brushSummary || !pointerState || !pointerType || !pointerMeta || !pointerLog) {
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
    return;
  }

  const context = canvas.getContext('2d', { alpha: true });
  const scratchCanvas = document.createElement('canvas');
  const scratchContext = scratchCanvas.getContext('2d', { alpha: true });
  if (!context || !scratchContext) {
    statusPill.textContent = 'Canvas error';
    statusPill.dataset.state = 'error';
    return;
  }

  canvas.style.touchAction = 'none';
  canvas.style.pointerEvents = 'auto';
  state.strokes = [];
  syncBrushUi();

  brushSizeInput.addEventListener('input', () => {
    const size = Number(brushSizeInput.value);
    if (Number.isFinite(size)) {
      state.brush.size = size;
      if (state.activeStroke) {
        state.activeStroke.size = size;
        state.activeStroke.raster = null;
      }
    }
    syncBrushUi();
    render();
  });

  brushColorInput.addEventListener('input', () => {
    state.brush.color = brushColorInput.value || state.brush.color;
    if (state.activeStroke) {
      state.activeStroke.color = state.brush.color;
      state.activeStroke.raster = null;
    }
    syncBrushUi();
    render();
  });

  undoButton.addEventListener('click', () => {
    state.strokes.pop();
    shell.classList.toggle('has-drawn', state.strokes.length > 0 || Boolean(state.activeStroke));
    render();
  });

  clearButton.addEventListener('click', () => {
    state.strokes = [];
    state.activeStroke = null;
    shell.classList.remove('has-drawn');
    render();
  });

  const resize = () => {
    const width = shell.clientWidth;
    const height = shell.clientHeight;
    const dpr = window.devicePixelRatio || 1;
    state.renderScale = dpr;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    scratchCanvas.width = canvas.width;
    scratchCanvas.height = canvas.height;
    invalidateRasters();
    render();
  };

  const onPointerDown = (event) => {
    event.preventDefault();
    if (!event.isPrimary) return;
    state.pointerDown = true;
    canvas.setPointerCapture(event.pointerId);
    recordPointer('down', event);
    state.activeStroke = createStroke(pointerToPoint(event, canvas), { ...state.brush });
    shell.classList.toggle('has-drawn', true);
    render();
  };

  const onPointerMove = (event) => {
    if (!state.pointerDown || !state.activeStroke) return;
    recordPointer('move', event);
    appendPoint(state.activeStroke, pointerToPoint(event, canvas));
    state.activeStroke.raster = null;
    render();
  };

  const finishStroke = (event) => {
    if (!state.pointerDown) return;
    state.pointerDown = false;
    if (state.activeStroke) {
      recordPointer('up', event);
      appendPoint(state.activeStroke, pointerToPoint(event, canvas));
      state.strokes.push(state.activeStroke);
      state.activeStroke = null;
    }
    render();
  };

  const onPointerCancel = (event) => {
    if (event) {
      recordPointer('cancel', event);
    }
    state.pointerDown = false;
    state.activeStroke = null;
    shell.classList.toggle('has-drawn', state.strokes.length > 0);
    render();
  };

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', finishStroke);
  canvas.addEventListener('pointercancel', onPointerCancel);
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);

  resize();
  startFpsLoop();

  function syncBrushUi() {
    brushSizeInput.value = String(state.brush.size);
    brushColorInput.value = state.brush.color;
    brushSummary.textContent = `${state.brush.size}px / ${state.brush.color}`;
  }

  function render() {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    const allStrokes = [...state.strokes];
    if (state.activeStroke) {
      allStrokes.push(state.activeStroke);
    }
    for (const stroke of allStrokes) {
      const raster = rasterizeStroke(stroke, canvas.width, canvas.height);
      if (raster) {
        scratchContext.putImageData(raster, 0, 0);
        context.drawImage(scratchCanvas, 0, 0);
      }
    }

    shell.classList.toggle('has-drawn', state.strokes.length > 0 || Boolean(state.activeStroke));
    statusGrid.innerHTML = [
      ['Strokes', String(state.strokes.length)],
      ['Active', state.activeStroke ? 'yes' : 'no'],
      ['Brush', `${state.brush.size}px`],
      ['Color', state.brush.color],
      ['WASM', wasmProcessor?.kind || 'loading'],
      ['Scale', String(state.renderScale.toFixed(2))],
    ].map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
    drawMeta.textContent = state.activeStroke ? 'WASM が入力中の線を描画しています' : 'Rust 側で線をラスタライズして Canvas に表示します';
    pointerState.textContent = state.pointerDown ? 'drawing' : 'idle';
    pointerType.textContent = state.lastPointerType || 'none';
    pointerMeta.textContent = state.lastPointerMeta || 'pointer events waiting';
    pointerLog.textContent = state.pointerLog || '-';
  }

  function rasterizeStroke(stroke, width, height) {
    if (!wasmProcessor || typeof wasmProcessor.rasterizeStroke !== 'function') {
      return null;
    }
    const key = `${width}x${height}:${stroke.color}:${stroke.size}:${stroke.points.length}`;
    if (stroke.raster && stroke.raster.key === key) {
      return stroke.raster.imageData;
    }
    const raster = wasmProcessor.rasterizeStroke(
      stroke.points,
      { color: stroke.color, size: stroke.size },
      width,
      height,
      Math.max(4, Math.round(stroke.size * 0.75)),
      stroke === state.activeStroke ? 1 : 0.95,
    );
    const imageData = new ImageData(new Uint8ClampedArray(raster.pixels), raster.width, raster.height);
    stroke.raster = { key, imageData };
    return imageData;
  }

  function recordPointer(kind, event) {
    const pressure = typeof event.pressure === 'number' ? event.pressure.toFixed(2) : 'n/a';
    const type = event.pointerType || 'unknown';
    const pt = pointerToPoint(event, canvas);
    state.lastPointerType = type;
    state.lastPointerMeta = `${kind} / ${type} / pressure ${pressure} / x ${Math.round(pt.x)} y ${Math.round(pt.y)}`;
    state.pointerLog = `${kind} id=${event.pointerId} type=${type} pressure=${pressure} buttons=${event.buttons}`;
  }

  function invalidateRasters() {
    for (const stroke of state.strokes) stroke.raster = null;
    if (state.activeStroke) state.activeStroke.raster = null;
  }

  function startFpsLoop() {
    const tick = (now) => {
      state.frameCount += 1;
      const elapsed = now - state.lastFpsTick;
      if (elapsed >= 1000) {
        state.fpsValue = Math.round((state.frameCount * 1000) / elapsed);
        state.frameCount = 0;
        state.lastFpsTick = now;
        fpsValue.textContent = String(state.fpsValue);
      }
      window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  }
});

async function loadWasmProcessor() {
  if (!wasmProcessorPromise) {
    wasmProcessorPromise = import('./bridge.js').then(async (module) => {
      wasmProcessor = await module.createProcessor();
      return wasmProcessor;
    });
  }
  return wasmProcessorPromise;
}

function createStroke(firstPoint, brush) {
  return {
    stroke_id: `draw-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    points: firstPoint ? [firstPoint] : [],
    color: brush.color,
    size: brush.size,
    raster: null,
  };
}

function appendPoint(stroke, point) {
  stroke.points.push(point);
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
