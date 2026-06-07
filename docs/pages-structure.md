# Pages Structure

このページは、現在の GitHub Pages 構成を短くまとめたものです。

## 入口

- `docs/index.html`
- ここを最初の導線にする
- `Demo` と `RapidRAW` は別ページとして用意する
- ボタンは `innerHTML` を差し替えるのではなく、別ページを読み込む

## 画面の役割

- `docs/demo.html`
  - お絵かきチャットの確認用画面
  - WASM ベースの描画確認
  - ブラシ色・太さの確認
  - JSON ログの確認

- `docs/rapidraw.html`
  - RapidRAW 風の確認用画面
  - 写真編集 UI の雰囲気確認
  - PNG 書き出しの導線確認

## 使い方

- まず `index.html` を開く
- `Demo` を選ぶと `demo.html` を表示する
- `RapidRAW` を選ぶと `rapidraw.html` を表示する
- どちらも GitHub Pages 内だけで完結させる

## この構成にした理由

- 入口を 1 つに集約すると説明しやすい
- デモと RapidRAW を別ページとして見せやすい
- 画面ごとの役割が分かれ、更新しやすい
- 追加した内容を GitHub Pages 上で確認しやすい

## 補足

- この構成は、RapidRAW をベースに改造していく前提に合っている
- `WASM` は描画の中身を担当し、画面の案内や表示は Pages 側で扱う

