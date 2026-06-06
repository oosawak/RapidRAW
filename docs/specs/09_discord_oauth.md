# 第9章: Discord OAuth 連携設計

## 9.1 フロー

ユーザー -> Discord 認可 -> code -> API -> access_token -> ユーザー情報

## 9.2 セキュリティ

- `access_token` はバックエンドのみ保持する
- `state` による CSRF 対策を行う

## 9.3 必要スコープ

- `identify`
- `guilds`

