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

#[wasm_bindgen]
pub struct StrokePlan {
    points: Vec<f32>,
    color: String,
    size: f32,
}

#[wasm_bindgen]
impl StrokePlan {
    #[wasm_bindgen(getter)]
    pub fn points(&self) -> Vec<f32> {
        self.points.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn color(&self) -> String {
        self.color.clone()
    }

    #[wasm_bindgen(getter)]
    pub fn size(&self) -> f32 {
        self.size
    }
}

#[wasm_bindgen]
pub fn prepare_stroke(points: Vec<f32>, spacing: f32, color: String, size: f32) -> StrokePlan {
    let size = size.clamp(1.0, 64.0);
    let spacing = spacing.max((size * 0.55).max(0.25));
    StrokePlan {
        points: interpolate_points(points, spacing),
        color: normalize_color(&color),
        size,
    }
}

#[wasm_bindgen]
pub fn interpolate_stroke(points: Vec<f32>, spacing: f32) -> Vec<f32> {
    interpolate_points(points, spacing.max(0.25))
}

fn interpolate_points(points: Vec<f32>, spacing: f32) -> Vec<f32> {
    let mut output = Vec::new();
    if points.len() < 4 {
        return output;
    }

    let mut last_point: Option<(f32, f32)> = None;

    for chunk in points.chunks_exact(2) {
        let current = (chunk[0], chunk[1]);
        if let Some(prev) = last_point {
            let dx = current.0 - prev.0;
            let dy = current.1 - prev.1;
            let distance = (dx * dx + dy * dy).sqrt();
            let steps = (distance / spacing).ceil().max(1.0) as usize;

            for step in 1..=steps {
                let t = step as f32 / steps as f32;
                let x = prev.0 + dx * t;
                let y = prev.1 + dy * t;
                output.push(x);
                output.push(y);
            }
        } else {
            output.push(current.0);
            output.push(current.1);
        }
        last_point = Some(current);
    }

    output
}

fn normalize_color(color: &str) -> String {
    let trimmed = color.trim();
    if let Some(expanded) = expand_hex_color(trimmed) {
        return expanded;
    }
    "#f08c46".to_string()
}

fn expand_hex_color(color: &str) -> Option<String> {
    let hex = color.strip_prefix('#')?;
    match hex.len() {
        3 => {
            let chars: Vec<char> = hex.chars().collect();
            Some(format!(
                "#{0}{0}{1}{1}{2}{2}",
                chars[0].to_ascii_uppercase(),
                chars[1].to_ascii_uppercase(),
                chars[2].to_ascii_uppercase()
            ))
        }
        6 => Some(format!("#{}", hex.to_ascii_uppercase())),
        _ => None,
    }
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
