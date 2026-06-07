# Oekaki Chat Pages

`docs/` 配下に置いた GitHub Pages 向けの静的 UI です。

## 使い方

- `docs/index.html` は入口ページです
- `docs/rapidraw.html` は RapidRAW 風の確認用画面です
- `docs/wasm-lab.html` は Canvas 描画ページです
- `docs/wasm-draw.html` はこれから作る WASM 描画ページです
- `index.html` はプロジェクト説明を含む入口ページです
- `index.html` のリンクは別ページを開く形です
- GitHub Pages の公開先を `docs/` に設定してください

## できること

- RapidRAW 風の確認用画面
- Canvas 描画ページ
- これから作る WASM 描画ページ
- ローカルで描いたストロークの保存
- 相手側ストロークのサンプル追加
- フィードの確認

## 次の拡張候補

- 複数ユーザーの接続を WebSocket で同期
- ブラシ設定の拡張
- 送受信イベントの可視化
- 共有ルームの切り替え

## 記録

- [Decision Log](./decision-log.md)
- [Pages Structure](./pages-structure.md)
- [Patch Tool](./patch-tool.md)
