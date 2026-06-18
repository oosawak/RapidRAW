let processorPromise = null;
const WASM_DRAW_REV = 'b1f3a9c2';

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
    console.info('[wasm-draw] importing rapidraw_wasm', { version: WASM_DRAW_REV });
    const mod = await import("./rapidraw_wasm.js?rev=b1f3a9c2");
    if (typeof mod.default === "function") {
      await mod.default();
    }
    console.info('[wasm-draw] wasm module loaded', { version: WASM_DRAW_REV });
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
      const plan = mod.prepare_stroke(
        flatInput,
        spacing,
        brush?.color ?? "#f08c46",
        brush?.size ?? 8,
      );
      const rendered = {
        points: unflattenPoints(plan.points),
        color: plan.color,
        size: plan.size,
      };
      if (typeof plan.free === 'function') {
        plan.free();
      }
      return rendered;
    },
    rasterizeStroke(points, brush, width, height, spacing = 6, opacity = 1) {
      const flatInput = flattenPoints(points);
      if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
        console.warn('[wasm-draw] skipping rasterize due to invalid size', {
          version: WASM_DRAW_REV,
          width,
          height,
          points: flatInput.length / 2,
          spacing,
          opacity,
        });
        return {
          width,
          height,
          pixels: new Uint8ClampedArray(0),
        };
      }
      console.info('[wasm-draw] rasterize', {
        version: WASM_DRAW_REV,
        width,
        height,
        points: flatInput.length / 2,
        spacing,
        opacity,
      });
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
