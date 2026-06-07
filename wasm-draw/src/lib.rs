use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
pub fn processor_name() -> String {
    "rapidraw-wasm-draw".to_string()
}

#[wasm_bindgen]
#[derive(Clone)]
pub struct StrokePlan {
    points: Vec<f32>,
    color: String,
    size: f32,
}

#[wasm_bindgen]
impl StrokePlan {
    #[wasm_bindgen(constructor)]
    pub fn new(points: Vec<f32>, color: String, size: f32) -> StrokePlan {
        StrokePlan { points, color, size }
    }

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
    let normalized = interpolate_stroke(points, spacing);
    StrokePlan::new(normalized, color, size)
}

#[wasm_bindgen]
pub fn interpolate_stroke(points: Vec<f32>, spacing: f32) -> Vec<f32> {
    interpolate_points(points, spacing)
}

#[wasm_bindgen]
pub fn interpolate_points(points: Vec<f32>, spacing: f32) -> Vec<f32> {
    let path = unpack_points(&points);
    if path.len() < 2 {
        return points;
    }

    let mut out = Vec::with_capacity(points.len().saturating_mul(2));
    let mut prev = path[0];
    out.extend_from_slice(&[prev.0, prev.1]);

    let step = if spacing.is_finite() && spacing > 0.0 {
        spacing
    } else {
        1.0
    };

    for &(x, y) in &path[1..] {
        let dx = x - prev.0;
        let dy = y - prev.1;
        let dist = (dx * dx + dy * dy).sqrt();
        let segments = (dist / step).ceil().max(1.0) as usize;

        for i in 1..=segments {
            let t = i as f32 / segments as f32;
            out.push(prev.0 + dx * t);
            out.push(prev.1 + dy * t);
        }

        prev = (x, y);
    }

    out
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
) -> js_sys::Uint8Array {
    let pixel_count = match width.checked_mul(height).and_then(|px| px.checked_mul(4)) {
        Some(px) => px as usize,
        None => return js_sys::Uint8Array::new_with_length(0),
    };
    let mut buffer = vec![0u8; pixel_count];
    if width == 0 || height == 0 {
        return js_sys::Uint8Array::new_with_length(0);
    }

    let path = interpolate_points(points, spacing);
    let rgb = parse_hex_rgb(&color).unwrap_or((0, 0, 0));
    let alpha = opacity.clamp(0.0, 1.0);
    let radius = (size.max(1.0) * 0.5).max(0.5);

    rasterize_points(
        &mut buffer,
        width,
        height,
        &path,
        rgb,
        radius,
        alpha,
    );

    let pixels = js_sys::Uint8Array::from(buffer.as_slice());
    std::mem::forget(buffer);
    pixels
}

fn unpack_points(points: &[f32]) -> Vec<(f32, f32)> {
    let mut out = Vec::with_capacity(points.len() / 2);
    let mut chunks = points.chunks_exact(2);
    for pair in &mut chunks {
        let x = pair[0];
        let y = pair[1];
        if x.is_finite() && y.is_finite() {
            out.push((x, y));
        }
    }
    out
}

fn rasterize_points(
    buffer: &mut [u8],
    width: u32,
    height: u32,
    points: &[f32],
    rgb: (u8, u8, u8),
    radius: f32,
    opacity: f32,
) {
    let vertices = unpack_points(points);
    if vertices.is_empty() {
        return;
    }

    if vertices.len() == 1 {
        draw_circle(buffer, width, height, vertices[0], radius, rgb, opacity);
        return;
    }

    draw_circle(buffer, width, height, vertices[0], radius, rgb, opacity);

    for segment in vertices.windows(2) {
        draw_segment(buffer, width, height, segment[0], segment[1], radius, rgb, opacity);
    }

    if let Some(&last) = vertices.last() {
        draw_circle(buffer, width, height, last, radius, rgb, opacity);
    }
}

fn draw_segment(
    buffer: &mut [u8],
    width: u32,
    height: u32,
    a: (f32, f32),
    b: (f32, f32),
    radius: f32,
    rgb: (u8, u8, u8),
    opacity: f32,
) {
    let min_x = a.0.min(b.0) - radius - 1.0;
    let max_x = a.0.max(b.0) + radius + 1.0;
    let min_y = a.1.min(b.1) - radius - 1.0;
    let max_y = a.1.max(b.1) + radius + 1.0;

    let x0 = min_x.floor().max(0.0) as u32;
    let y0 = min_y.floor().max(0.0) as u32;
    let x1 = max_x.ceil().min(width.saturating_sub(1) as f32) as u32;
    let y1 = max_y.ceil().min(height.saturating_sub(1) as f32) as u32;

    for y in y0..=y1 {
        for x in x0..=x1 {
            let px = x as f32 + 0.5;
            let py = y as f32 + 0.5;
            let distance = distance_to_segment((px, py), a, b);
            let coverage = coverage_for_distance(distance, radius);
            if coverage > 0.0 {
                blend_pixel(buffer, width, x, y, rgb, coverage * opacity);
            }
        }
    }
}

fn draw_circle(
    buffer: &mut [u8],
    width: u32,
    height: u32,
    center: (f32, f32),
    radius: f32,
    rgb: (u8, u8, u8),
    opacity: f32,
) {
    let min_x = (center.0 - radius - 1.0).floor().max(0.0) as u32;
    let max_x = (center.0 + radius + 1.0).ceil().min(width.saturating_sub(1) as f32) as u32;
    let min_y = (center.1 - radius - 1.0).floor().max(0.0) as u32;
    let max_y = (center.1 + radius + 1.0).ceil().min(height.saturating_sub(1) as f32) as u32;

    for y in min_y..=max_y {
        for x in min_x..=max_x {
            let px = x as f32 + 0.5;
            let py = y as f32 + 0.5;
            let dx = px - center.0;
            let dy = py - center.1;
            let distance = (dx * dx + dy * dy).sqrt();
            let coverage = coverage_for_distance(distance, radius);
            if coverage > 0.0 {
                blend_pixel(buffer, width, x, y, rgb, coverage * opacity);
            }
        }
    }
}

fn blend_pixel(
    buffer: &mut [u8],
    width: u32,
    x: u32,
    y: u32,
    rgb: (u8, u8, u8),
    alpha: f32,
) {
    if alpha <= 0.0 {
        return;
    }

    let idx = ((y * width + x) * 4) as usize;
    if idx + 3 >= buffer.len() {
        return;
    }

    let src_a = alpha.clamp(0.0, 1.0);
    let dst_a = buffer[idx + 3] as f32 / 255.0;
    let out_a = src_a + dst_a * (1.0 - src_a);
    if out_a <= 0.0 {
        return;
    }

    let src_r = rgb.0 as f32 / 255.0;
    let src_g = rgb.1 as f32 / 255.0;
    let src_b = rgb.2 as f32 / 255.0;

    let dst_r = buffer[idx] as f32 / 255.0;
    let dst_g = buffer[idx + 1] as f32 / 255.0;
    let dst_b = buffer[idx + 2] as f32 / 255.0;

    let out_r = (src_r * src_a + dst_r * dst_a * (1.0 - src_a)) / out_a;
    let out_g = (src_g * src_a + dst_g * dst_a * (1.0 - src_a)) / out_a;
    let out_b = (src_b * src_a + dst_b * dst_a * (1.0 - src_a)) / out_a;

    buffer[idx] = (out_r.clamp(0.0, 1.0) * 255.0).round() as u8;
    buffer[idx + 1] = (out_g.clamp(0.0, 1.0) * 255.0).round() as u8;
    buffer[idx + 2] = (out_b.clamp(0.0, 1.0) * 255.0).round() as u8;
    buffer[idx + 3] = (out_a.clamp(0.0, 1.0) * 255.0).round() as u8;
}

fn distance_to_segment(p: (f32, f32), a: (f32, f32), b: (f32, f32)) -> f32 {
    let abx = b.0 - a.0;
    let aby = b.1 - a.1;
    let apx = p.0 - a.0;
    let apy = p.1 - a.1;
    let ab_len_sq = abx * abx + aby * aby;

    if ab_len_sq <= f32::EPSILON {
        return (apx * apx + apy * apy).sqrt();
    }

    let t = ((apx * abx + apy * aby) / ab_len_sq).clamp(0.0, 1.0);
    let closest_x = a.0 + abx * t;
    let closest_y = a.1 + aby * t;
    let dx = p.0 - closest_x;
    let dy = p.1 - closest_y;
    (dx * dx + dy * dy).sqrt()
}

fn coverage_for_distance(distance: f32, radius: f32) -> f32 {
    if distance >= radius + 1.0 {
        return 0.0;
    }

    let edge = 1.0;
    let t = ((radius - distance) / edge).clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

fn parse_hex_rgb(input: &str) -> Option<(u8, u8, u8)> {
    let value = input.trim().trim_start_matches('#');
    match value.len() {
        6 => {
            let r = u8::from_str_radix(&value[0..2], 16).ok()?;
            let g = u8::from_str_radix(&value[2..4], 16).ok()?;
            let b = u8::from_str_radix(&value[4..6], 16).ok()?;
            Some((r, g, b))
        }
        3 => {
            let chars: Vec<char> = value.chars().collect();
            let r = u8::from_str_radix(&format!("{0}{0}", chars[0]), 16).ok()?;
            let g = u8::from_str_radix(&format!("{0}{0}", chars[1]), 16).ok()?;
            let b = u8::from_str_radix(&format!("{0}{0}", chars[2]), 16).ok()?;
            Some((r, g, b))
        }
        _ => None,
    }
}
