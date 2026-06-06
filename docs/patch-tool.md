# Patch Tool

`scripts/patch-file.mjs` は、リポジトリー内ファイルの安全な更新を行うための小さな補助ツールです。

## 使い方

```bash
node scripts/patch-file.mjs patch.json
node scripts/patch-file.mjs patch.json --dry-run
node scripts/patch-file.mjs patch.json --backup
```

## patch.json 形式

```json
{
  "file": "docs/specs/index.md",
  "operations": [
    { "op": "replace", "find": "old", "replace": "new", "count": 1 },
    { "op": "insertAfter", "anchor": "needle", "content": "text" },
    { "op": "insertBefore", "anchor": "needle", "content": "text" },
    { "op": "append", "content": "text" }
  ]
}
```

## メモ

- 置換対象やアンカーが見つからない場合は失敗します。
- `--dry-run` で実際に書かずに確認できます。
- `--backup` で元ファイルの `.bak` を作ります。
