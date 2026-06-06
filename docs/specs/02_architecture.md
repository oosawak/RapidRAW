# 第2章: 全体アーキテクチャ

## 2.1 構成図

```text
フロント (React + WASM + WebGPU)
  ↓ HTTPS / WebSocket
バックエンド (API + WebSocket)
  ↓ Bot Token
Discord (OAuth + Bot + Voice)
```

## 2.2 技術選定理由

- WASM: 高速処理
- WebGPU: GPU 描画
- WebSocket: 低遅延同期
- Discord: 音声通話を統合しやすい

