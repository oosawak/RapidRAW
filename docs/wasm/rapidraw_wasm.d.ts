/* tslint:disable */
/* eslint-disable */

export class StrokePlan {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    readonly color: string;
    readonly points: Float32Array;
    readonly size: number;
}

export function grade_rgba(input: Uint8Array, width: number, height: number, exposure: number, contrast: number, saturation: number, temperature: number, shadows: number, vignette: number, grain: number): Uint8Array;

export function interpolate_stroke(points: Float32Array, spacing: number): Float32Array;

export function prepare_stroke(points: Float32Array, spacing: number, color: string, size: number): StrokePlan;

export function processor_name(): string;

export function start(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_strokeplan_free: (a: number, b: number) => void;
    readonly grade_rgba: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => [number, number];
    readonly interpolate_stroke: (a: number, b: number, c: number) => [number, number];
    readonly prepare_stroke: (a: number, b: number, c: number, d: number, e: number, f: number) => number;
    readonly processor_name: () => [number, number];
    readonly strokeplan_color: (a: number) => [number, number];
    readonly strokeplan_points: (a: number) => [number, number];
    readonly strokeplan_size: (a: number) => number;
    readonly start: () => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
