# 第12章: Discord 連携を含む全体アーキテクチャ

## 12.1 統合構成

```text
React (WASM + WebGPU + WS)
  ↓
API (OAuth + WS + Bot)
  ↓
Discord (Voice)
```

## 12.2 データフロー

1. OAuth
2. ルーム作成
3. Bot がボイスチャンネルを作成
4. UI に参加ボタンを表示

