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
#[wasm_bindgen]
pub fn rasterize_stroke_rgba(
    width: u32,
    height: u32,
    points: Vec<f32>,
    spacing: f32,
    color: String,
    size: f32,
    opacity: f32,
) -> Vec<u8> {
    let plan = prepare_stroke(points, spacing, color, size);
    rasterize_points(&plan.points, width, height, &plan.color, plan.size, opacity)
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

fn rasterize_points(
    points: &[f32],
    width: u32,
    height: u32,
    color: &str,
    size: f32,
    opacity: f32,
) -> Vec<u8> {
    let mut output = vec![0u8; width.saturating_mul(height) as usize * 4];
    if width == 0 || height == 0 || points.len() < 2 {
        return output;
    }

    let (red, green, blue) = parse_hex_rgb(color).unwrap_or((240, 140, 70));
    let opacity = opacity.clamp(0.0, 1.0);
    let radius = size.clamp(1.0, 64.0) * 0.5;
    let padding = radius + 1.5;

    let mut last_point: Option<(f32, f32)> = None;
    for chunk in points.chunks_exact(2) {
        let current = (chunk[0], chunk[1]);
        draw_circle(
            &mut output,
            width,
            height,
            current,
            radius,
            red,
            green,
            blue,
            opacity,
        );

        if let Some(previous) = last_point {
            draw_segment(
                &mut output,
                width,
                height,
                previous,
                current,
                radius,
                red,
                green,
                blue,
                opacity,
                padding,
            );
        }
        last_point = Some(current);
    }

    output
}

fn draw_segment(
    output: &mut [u8],
    width: u32,
    height: u32,
    start: (f32, f32),
    end: (f32, f32),
    radius: f32,
    red: u8,
    green: u8,
    blue: u8,
    opacity: f32,
    padding: f32,
) {
    let min_x = ((start.0.min(end.0) - padding).floor().max(0.0)) as u32;
    let min_y = ((start.1.min(end.1) - padding).floor().max(0.0)) as u32;
    let max_x = ((start.0.max(end.0) + padding).ceil().min(width.saturating_sub(1) as f32)) as u32;
    let max_y = ((start.1.max(end.1) + padding).ceil().min(height.saturating_sub(1) as f32)) as u32;

    if min_x > max_x || min_y > max_y {
        return;
    }

    for y in min_y..=max_y {
        for x in min_x..=max_x {
            let dist = distance_to_segment(x as f32 + 0.5, y as f32 + 0.5, start, end);
            let coverage = coverage_for_distance(dist, radius);
            if coverage <= 0.0 {
                continue;
            }
            let alpha = (coverage * opacity * 255.0).round().clamp(0.0, 255.0) as u8;
            blend_pixel(output, width, x, y, red, green, blue, alpha);
        }
    }
}

fn draw_circle(
    output: &mut [u8],
    width: u32,
    height: u32,
    center: (f32, f32),
    radius: f32,
    red: u8,
    green: u8,
    blue: u8,
    opacity: f32,
) {
    let padding = radius + 1.5;
    let min_x = ((center.0 - padding).floor().max(0.0)) as u32;
    let min_y = ((center.1 - padding).floor().max(0.0)) as u32;
    let max_x = ((center.0 + padding).ceil().min(width.saturating_sub(1) as f32)) as u32;
    let max_y = ((center.1 + padding).ceil().min(height.saturating_sub(1) as f32)) as u32;

    if min_x > max_x || min_y > max_y {
        return;
    }

    for y in min_y..=max_y {
        for x in min_x..=max_x {
            let dx = x as f32 + 0.5 - center.0;
            let dy = y as f32 + 0.5 - center.1;
            let dist = (dx * dx + dy * dy).sqrt();
            let coverage = coverage_for_distance(dist, radius);
            if coverage <= 0.0 {
                continue;
            }
            let alpha = (coverage * opacity * 255.0).round().clamp(0.0, 255.0) as u8;
            blend_pixel(output, width, x, y, red, green, blue, alpha);
        }
    }
}

fn blend_pixel(output: &mut [u8], width: u32, x: u32, y: u32, red: u8, green: u8, blue: u8, alpha: u8) {
    let index = ((y * width + x) * 4) as usize;
    if index + 3 >= output.len() || alpha == 0 {
        return;
    }

    let dst_a = output[index + 3] as f32 / 255.0;
    let src_a = alpha as f32 / 255.0;
    let out_a = src_a + dst_a * (1.0 - src_a);
    if out_a <= f32::EPSILON {
        return;
    }

    let dst_r = output[index] as f32;
    let dst_g = output[index + 1] as f32;
    let dst_b = output[index + 2] as f32;
    let src_r = red as f32;
    let src_g = green as f32;
    let src_b = blue as f32;

    output[index] = ((src_r * src_a + dst_r * dst_a * (1.0 - src_a)) / out_a).round().clamp(0.0, 255.0) as u8;
    output[index + 1] = ((src_g * src_a + dst_g * dst_a * (1.0 - src_a)) / out_a).round().clamp(0.0, 255.0) as u8;
    output[index + 2] = ((src_b * src_a + dst_b * dst_a * (1.0 - src_a)) / out_a).round().clamp(0.0, 255.0) as u8;
    output[index + 3] = (out_a * 255.0).round().clamp(0.0, 255.0) as u8;
}

fn coverage_for_distance(distance: f32, radius: f32) -> f32 {
    let inner = (radius - 0.75).max(0.0);
    let outer = radius + 0.75;
    if distance <= inner {
        return 1.0;
    }
    if distance >= outer {
        return 0.0;
    }
    1.0 - smoothstep(inner, outer, distance)
}

fn smoothstep(edge0: f32, edge1: f32, x: f32) -> f32 {
    if (edge1 - edge0).abs() <= f32::EPSILON {
        return if x < edge0 { 0.0 } else { 1.0 };
    }
    let t = ((x - edge0) / (edge1 - edge0)).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

fn distance_to_segment(px: f32, py: f32, start: (f32, f32), end: (f32, f32)) -> f32 {
    let vx = end.0 - start.0;
    let vy = end.1 - start.1;
    let length_sq = vx * vx + vy * vy;
    if length_sq <= f32::EPSILON {
        let dx = px - start.0;
        let dy = py - start.1;
        return (dx * dx + dy * dy).sqrt();
    }

    let t = (((px - start.0) * vx) + ((py - start.1) * vy)) / length_sq;
    let t = t.clamp(0.0, 1.0);
    let proj_x = start.0 + vx * t;
    let proj_y = start.1 + vy * t;
    let dx = px - proj_x;
    let dy = py - proj_y;
    (dx * dx + dy * dy).sqrt()
}

fn parse_hex_rgb(color: &str) -> Option<(u8, u8, u8)> {
    let hex = color.strip_prefix('#')?;
    if hex.len() != 6 {
        return None;
    }

    let red = u8::from_str_radix(&hex[0..2], 16).ok()?;
    let green = u8::from_str_radix(&hex[2..4], 16).ok()?;
    let blue = u8::from_str_radix(&hex[4..6], 16).ok()?;
    Some((red, green, blue))
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
