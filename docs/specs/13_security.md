# 第13章: セキュリティ設計

## 13.1 OAuth

- `access_token` をフロントに置かない
- `state` チェックを必須にする

## 13.2 Bot Token

- バックエンドのみ保持する

## 13.3 WebSocket

- 認証必須
- 不正メッセージは切断する

## 13.4 XSS / CSRF

- チャットは HTML エスケープする

