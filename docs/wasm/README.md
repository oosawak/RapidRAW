# WASM Bridge

このディレクトリは、`docs/app.js` から利用する WASM 連携の入口です。

## 期待する構成

- `bridge.js`: 実行時に WASM モジュールを読み込む薄い橋渡し
- `rapidraw_wasm.js`: `wasm-bindgen` で生成される ES module
- `rapidraw_wasm_bg.wasm`: 実体のバイナリ

## ビルド元

Rust 実装はルートの [`wasm/`](../../wasm) に置いてあります。
`wasm-pack build --target web` などで生成した成果物をこのフォルダへ配置する運用を想定しています。

