let processorPromise = null;

export async function createProcessor() {
  if (!processorPromise) {
    processorPromise = loadProcessor();
  }
  return processorPromise;
}

async function loadProcessor() {
  const wasmModule = await tryLoadWasmModule();
  if (wasmModule) {
    return createWasmProcessor(wasmModule);
  }
  return createJsProcessor();
}

async function tryLoadWasmModule() {
  try {
    const mod = await import("./rapidraw_wasm.js");
    if (typeof mod.default === "function") {
      await mod.default();
    }
    return mod;
  } catch {
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
  };
}

function createJsProcessor() {
  return {
    kind: "js",
    grade(imageData, width, height, state) {
      const data = imageData.data;
      const cx = width * 0.5;
      const cy = height * 0.5;
      const maxDistance = Math.hypot(cx, cy) || 1;
      const exposureMul = 1 + state.exposure / 140;
      const contrastMul = 1 + state.contrast / 140;
      const saturationMul = 1 + state.saturation / 120;
      const shadowLift = state.shadows / 220;
      const warmth = state.temperature / 100;
      const vignetteStrength = Math.max(0, Math.min(1, state.vignette / 100));
      const grainStrength = Math.max(0, Math.min(1, state.grain / 100));

      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const index = (y * width + x) * 4;
          let red = clamp255(data[index] * exposureMul);
          let green = clamp255(data[index + 1] * exposureMul);
          let blue = clamp255(data[index + 2] * exposureMul);
          const gray = (red + green + blue) / 3;

          red = gray + (red - gray) * saturationMul;
          green = gray + (green - gray) * saturationMul;
          blue = gray + (blue - gray) * saturationMul;

          red = ((red - 128) * contrastMul) + 128;
          green = ((green - 128) * contrastMul) + 128;
          blue = ((blue - 128) * contrastMul) + 128;

          if (gray < 160) {
            const boost = shadowLift * (1 - gray / 255) * 120;
            red += boost;
            green += boost;
            blue += boost;
          }

          if (warmth > 0) {
            red += warmth * 22;
            blue -= warmth * 12;
          } else if (warmth < 0) {
            red += warmth * 12;
            blue -= warmth * 24;
          }

          const distance = Math.hypot(x - cx, y - cy) / maxDistance;
          const vignetteMul = 1 - vignetteStrength * Math.pow(distance, 1.7) * 0.7;
          red *= vignetteMul;
          green *= vignetteMul;
          blue *= vignetteMul;

          if (grainStrength > 0) {
            const noise = pseudoNoise(x, y, grainStrength);
            red += noise;
            green += noise;
            blue += noise;
          }

          data[index] = clamp255(red);
          data[index + 1] = clamp255(green);
          data[index + 2] = clamp255(blue);
        }
      }

      return imageData;
    },
  };
}

function clamp255(value) {
  return Math.max(0, Math.min(255, value));
}

function pseudoNoise(x, y, grainStrength) {
  const seed = ((x * 374761393) ^ (y * 668265263) ^ 0x9e3779b9) >>> 0;
  const mixed = (seed ^ (seed >>> 13) ^ (seed << 17)) >>> 0;
  const normalized = (mixed & 0xffff) / 65535;
  return (normalized - 0.5) * 36 * grainStrength;
}

