# Pages Structure

このページは、現在の GitHub Pages 構成を短くまとめたものです。

## 入口

- `docs/index.html`
- ここを最初の導線にする
- `WASM Lab`、`WASM Drawing`、`RapidRAW` は別ページとして用意する
- ボタンは `innerHTML` を差し替えるのではなく、別ページへ直接移動する

## 画面の役割

- `docs/wasm-lab.html`
  - WASM で整形した線を Canvas に描く採用版の画面
  - ブラシ色・太さの確認
  - JSON ログの確認

- `docs/wasm-draw.html`
  - これから作る WASM 直描画の確認ページ
  - WASM でピクセルを描く実装の入口

- `docs/rapidraw.html`
  - RapidRAW 風の確認用画面
  - 写真編集 UI の雰囲気確認
  - PNG 書き出しの導線確認

## 使い方

- まず `index.html` を開く
- `WASM Lab` を選ぶと `wasm-lab.html` を開く
- `WASM Drawing` を選ぶと `wasm-draw.html` を開く
- `RapidRAW` を選ぶと `rapidraw.html` を開く
- どちらも GitHub Pages 内だけで完結させる

## この構成にした理由

- 入口を 1 つに集約すると説明しやすい
- WASM ラボ、WASM Drawing、RapidRAW を別ページとして見せやすい
- 画面ごとの役割が分かれ、更新しやすい
- 追加した内容を GitHub Pages 上で確認しやすい

## 補足

- この構成は、RapidRAW をベースに改造していく前提に合っている
- `WASM` は描画の中身を担当し、画面の案内や表示は Pages 側で扱う
