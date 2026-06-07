let processorPromise = null;

export async function createProcessor() {
  if (!processorPromise) {
    processorPromise = loadProcessor();
  }
  return processorPromise;
}

async function loadProcessor() {
  const wasmModule = await tryLoadWasmModule();
  if (!wasmModule) {
    throw new Error("rapidraw_wasm module could not be loaded");
  }
  return createWasmProcessor(wasmModule);
}

async function tryLoadWasmModule() {
  try {
    const mod = await import(`./rapidraw_wasm.js?v=9d874468`);
    if (typeof mod.default === "function") {
      await mod.default();
    }
    return mod;
  } catch (error) {
    console.error("Failed to load rapidraw_wasm", error);
    return null;
  }
}

function createWasmProcessor(mod) {
  return {
    kind: "wasm",
    grade(imageData, width, height, state) {
      const input = new Uint8Array(imageData.data);
      const output = mod.grade_rgba(
        input,
        width,
        height,
        state.exposure,
        state.contrast,
        state.saturation,
        state.temperature,
        state.shadows,
        state.vignette,
        state.grain,
      );
      imageData.data.set(output);
      return imageData;
    },
    prepareStroke(points, brush, spacing = 6) {
      const flatInput = flattenPoints(points);
      const output = mod.prepare_stroke(
        flatInput,
        spacing,
        brush?.color ?? "#f08c46",
        brush?.size ?? 8,
      );
      return {
        points: unflattenPoints(output.points),
        color: output.color,
        size: output.size,
      };
    },
    rasterizeStroke(points, brush, width, height, spacing = 6, opacity = 1) {
      const flatInput = flattenPoints(points);
      const output = mod.rasterize_stroke_rgba(
        width,
        height,
        flatInput,
        spacing,
        brush?.color ?? "#f08c46",
        brush?.size ?? 8,
        opacity,
      );
      return {
        width,
        height,
        pixels: output,
      };
    },
  };
}

function flattenPoints(points) {
  const flat = [];
  for (const point of points || []) {
    flat.push(point.x, point.y);
  }
  return flat;
}

function unflattenPoints(points) {
  const out = [];
  for (let i = 0; i + 1 < points.length; i += 2) {
    out.push({ x: points[i], y: points[i + 1] });
  }
  return out;
}
