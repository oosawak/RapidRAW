use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn processor_name() -> String {
    "rapidraw_wasm".to_string()
}

#[wasm_bindgen]
pub fn grade_rgba(
    input: Vec<u8>,
    width: u32,
    height: u32,
    exposure: f32,
    contrast: f32,
    saturation: f32,
    temperature: f32,
    shadows: f32,
    vignette: f32,
    grain: f32,
) -> Vec<u8> {
    let mut output = input;
    let total_pixels = width.saturating_mul(height) as usize;
    if total_pixels == 0 {
        return output;
    }

    let exposure_mul = 1.0 + exposure / 140.0;
    let contrast_mul = 1.0 + contrast / 140.0;
    let saturation_mul = 1.0 + saturation / 120.0;
    let shadow_lift = shadows / 220.0;
    let warmth = temperature / 100.0;
    let vignette_strength = (vignette / 100.0).clamp(0.0, 1.0);
    let grain_strength = (grain / 100.0).clamp(0.0, 1.0);
    let cx = width as f32 * 0.5;
    let cy = height as f32 * 0.5;
    let max_distance = (cx * cx + cy * cy).sqrt().max(1.0);

    for y in 0..height {
        for x in 0..width {
            let pixel_index = ((y * width + x) * 4) as usize;
            let r = output[pixel_index] as f32;
            let g = output[pixel_index + 1] as f32;
            let b = output[pixel_index + 2] as f32;

            let mut red = clamp255(r * exposure_mul);
            let mut green = clamp255(g * exposure_mul);
            let mut blue = clamp255(b * exposure_mul);

            let gray = (red + green + blue) / 3.0;
            red = gray + (red - gray) * saturation_mul;
            green = gray + (green - gray) * saturation_mul;
            blue = gray + (blue - gray) * saturation_mul;

            red = ((red - 128.0) * contrast_mul) + 128.0;
            green = ((green - 128.0) * contrast_mul) + 128.0;
            blue = ((blue - 128.0) * contrast_mul) + 128.0;

            if gray < 160.0 {
                let boost = shadow_lift * (1.0 - gray / 255.0) * 120.0;
                red += boost;
                green += boost;
                blue += boost;
            }

            if warmth > 0.0 {
                red += warmth * 22.0;
                blue -= warmth * 12.0;
            } else if warmth < 0.0 {
                red += warmth * 12.0;
                blue -= warmth * 24.0;
            }

            let dx = x as f32 - cx;
            let dy = y as f32 - cy;
            let distance = (dx * dx + dy * dy).sqrt() / max_distance;
            let vignette_mul = 1.0 - vignette_strength * distance.powf(1.7) * 0.7;
            red *= vignette_mul;
            green *= vignette_mul;
            blue *= vignette_mul;

            if grain_strength > 0.0 {
                let noise = pseudo_noise(x, y, grain_strength);
                red += noise;
                green += noise;
                blue += noise;
            }

            output[pixel_index] = clamp255(red) as u8;
            output[pixel_index + 1] = clamp255(green) as u8;
            output[pixel_index + 2] = clamp255(blue) as u8;
        }
    }

    output
}

fn clamp255(value: f32) -> f32 {
    value.clamp(0.0, 255.0)
}

fn pseudo_noise(x: u32, y: u32, grain_strength: f32) -> f32 {
    let seed = x.wrapping_mul(374_761_393) ^ y.wrapping_mul(668_265_263) ^ 0x9E37_79B9;
    let mixed = seed ^ (seed >> 13) ^ (seed << 17);
    let normalized = (mixed & 0xffff) as f32 / 65_535.0;
    (normalized - 0.5) * 36.0 * grain_strength
}

