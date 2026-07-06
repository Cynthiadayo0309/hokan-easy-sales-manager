# ドキュメント一覧

Codexは、リポジトリ直下の `CODEX.md` から読み始めてください。

| ファイル | 内容 |
|---|---|
| `01_PRODUCT_REQUIREMENTS.md` | アプリの目的、利用者、業務要件、対象範囲 |
| `02_UI_UX_SPEC.md` | 画面構成、入力フロー、分かりやすさの要件 |
| `03_DATA_MODEL_AND_CALCULATIONS.md` | データ項目、期間生成、計算式、入力状態 |
| `04_TECHNICAL_ARCHITECTURE.md` | Electron、Vue、SQLite、配布・バックアップ設計 |
| `05_IMPLEMENTATION_ROADMAP.md` | Codexが進める実装順序と各フェーズの完了条件 |
| `06_TEST_AND_ACCEPTANCE.md` | 自動テスト、手動確認、受入条件 |

## Codexへ最初に渡す指示文

```text
リポジトリ直下のCODEX.mdを読み、そこから参照されているdocs配下のMDファイルを番号順に確認してください。

「訪看かんたん売上管理」を、Electron + Vue 3 + TypeScript + SQLiteで実装してください。まず既存ファイルを確認し、05_IMPLEMENTATION_ROADMAP.mdのフェーズ0から着手してください。

利用者は機械操作に不慣れです。操作の簡単さ、入力ミス防止、データ保全を最優先にしてください。実装前に作業計画を提示し、実装後は変更内容・テスト結果・残課題を報告してください。
```
