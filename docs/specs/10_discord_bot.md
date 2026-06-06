# 第10章: Discord Bot によるボイスチャンネル自動生成

## 10.1 Bot の役割

- ルーム作成時にボイスチャンネルを作成する
- 必要に応じて削除する

## 10.2 API 例

```http
POST /guilds/{guild_id}/channels
type: 2
```

## 10.3 UI 連携

- React に `channelId` を返す

