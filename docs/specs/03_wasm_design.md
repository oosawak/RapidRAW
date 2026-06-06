# 第3章: WASM ブラシエンジン設計

## 3.1 役割

- ストローク補間
- ブラシテクスチャ生成
- Undo / Redo の履歴管理

## 3.2 Rust -> WASM

- `wasm-bindgen` を使用する
- JS から呼び出し可能な API を提供する
- 実装手順は `rustgames` の既存 WASM 資産を参照して揃える

## 3.3 API 例

- `begin_stroke(x, y)`
- `add_point(x, y)`
- `end_stroke()`

