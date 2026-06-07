# Oekaki Chat Pages

`docs/` 配下に置いた GitHub Pages 向けの静的 UI です。

## 使い方

- `docs/index.html` は入口ページです
- `docs/demo.html` は今作っているコラボ描画の確認用画面です
- `docs/rapidraw.html` は RapidRAW 風の確認用画面です
- `docs/wasm-lab.html` は WASM 専用の別画面です
- `index.html` はプロジェクト説明を含む入口ページです
- `index.html` のリンクは別ページを開く形です
- GitHub Pages の公開先を `docs/` に設定してください

## できること

- コラボ描画の確認用画面
- RapidRAW 風の確認用画面
- WASM 専用の描画確認画面
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
