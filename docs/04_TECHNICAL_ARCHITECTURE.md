# 04. 技術構成・アーキテクチャ

## 1. 採用構成

| 区分 | 技術 |
|---|---|
| デスクトップ | Electron |
| UI | Vue 3 |
| 言語 | TypeScript |
| ビルド | Vite |
| 状態管理 | Pinia |
| ルーティング | Vue Router |
| DB | SQLite |
| DBドライバー | better-sqlite3 |
| パッケージ | electron-builder |
| 単体テスト | Vitest |
| E2E候補 | Playwright |

## 2. 実行環境

- Windows 10 / 11 64bit
- オフライン動作
- Node.jsの別途インストール不要
- SQLiteの別途インストール不要
- 管理者権限なしのユーザー単位インストールを目標とする

## 3. プロセス分離

### Main Process

担当:

- ウィンドウ生成
- SQLite操作
- マイグレーション
- ファイル選択
- バックアップ・復元
- CSV出力
- ログ保存
- アプリ情報取得

### Preload

- Rendererへ必要最小限の型付きAPIを公開
- IPCチャンネルを固定
- 任意コマンド実行を許可しない

### Renderer

- Vue画面
- 入力チェック
- 状態表示
- 集計結果表示
- Mainへ型付きAPIで依頼

RendererからNode.js APIやSQLiteへ直接アクセスしない。

## 4. Electronセキュリティ

必須設定:

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true` を可能な範囲で使用
- remote moduleを使用しない
- 外部URLを同一ウィンドウで開かない
- CSPを設定する
- IPC引数をMain側でも検証する
- ローカルコンテンツのみ読み込む

## 5. 推奨ディレクトリ構成

```text
hokan-easy-sales-manager/
├─ CODEX.md
├─ README.md
├─ package.json
├─ electron-builder.yml
├─ src/
│  ├─ main/
│  │  ├─ index.ts
│  │  ├─ window.ts
│  │  ├─ ipc/
│  │  ├─ db/
│  │  │  ├─ connection.ts
│  │  │  ├─ migrations/
│  │  │  ├─ repositories/
│  │  │  └─ seeds/
│  │  ├─ services/
│  │  ├─ backup/
│  │  ├─ export/
│  │  └─ logging/
│  ├─ preload/
│  │  ├─ index.ts
│  │  └─ api.ts
│  ├─ renderer/
│  │  ├─ main.ts
│  │  ├─ App.vue
│  │  ├─ router/
│  │  ├─ stores/
│  │  ├─ views/
│  │  ├─ components/
│  │  ├─ composables/
│  │  ├─ styles/
│  │  └─ utils/
│  └─ shared/
│     ├─ types/
│     ├─ schemas/
│     ├─ constants/
│     └─ calculations/
├─ tests/
│  ├─ unit/
│  ├─ integration/
│  └─ e2e/
└─ docs/
```

## 6. レイヤー分離

### UI Layer

画面表示と利用者操作のみを担当する。

### Application Service Layer

- 週次入力保存
- 入力完了
- 前期間コピー
- 月締め
- バックアップ
- CSV出力

### Domain Layer

- 期間生成
- 人数計算
- 件数計算
- 売上計算
- 達成率計算
- 月末予測

副作用を持たない関数として実装し、単体テスト可能にする。

### Repository Layer

SQLite操作を隠蔽する。

将来、共有APIへ置き換える際にUIとドメイン計算を変更しなくてよい構成にする。

## 7. DB保存場所

データベースは `app.getPath('userData')` 配下へ保存する。

例:

```text
C:\Users\<user>\AppData\Roaming\HokanEasySalesManager\data\application.db
```

インストールディレクトリへ保存しない。

## 8. DB初期化

初回起動時:

1. データフォルダーを作成
2. SQLiteファイルを作成
3. マイグレーション実行
4. 初期マスターを投入
5. 初期管理者を作成
6. 初回設定未完了フラグを設定

初期マスター:

- 医療訪問看護
- 精神科訪問看護
- 介護訪問看護
- 初期施設A～E

## 9. マイグレーション

- スキーマ変更は番号付きSQLまたはTypeScriptマイグレーションで管理する
- 適用済みバージョンをDBへ保存する
- 起動時に未適用マイグレーションを順番に実行する
- 失敗時はトランザクションをロールバックする
- 失敗時にDBを初期化しない
- アップデート前の自動バックアップを検討する

## 10. SQLite設定

- WALモードを検討する
- foreign keysを有効にする
- トランザクションを使用する
- 定期的にintegrity checkを実行できるようにする
- DB接続はMain Process内で一元管理する

## 11. IPC API例

Preloadから次のようなAPIを公開する。

```ts
interface AppApi {
  facilities: {
    list(): Promise<Facility[]>;
    save(input: SaveFacilityInput): Promise<Facility>;
  };
  periods: {
    listByMonth(month: string): Promise<MonthlyPeriod[]>;
  };
  entries: {
    get(input: GetEntryInput): Promise<WeeklyEntry | null>;
    saveDraft(input: SaveWeeklyEntryInput): Promise<WeeklyEntry>;
    complete(input: CompleteWeeklyEntryInput): Promise<WeeklyEntry>;
    copyPrevious(input: CopyPreviousInput): Promise<WeeklyEntry>;
  };
  dashboard: {
    getMonthly(month: string): Promise<MonthlyDashboard>;
  };
  backup: {
    create(): Promise<BackupResult>;
    restore(): Promise<RestoreResult>;
  };
  export: {
    monthlyCsv(month: string): Promise<ExportResult>;
  };
}
```

実際の名前は変更可能だが、型安全なAPIにする。

## 12. 自動保存

推奨方式:

- 入力変更後、500～1000msのデバウンスでdraft保存
- 画面遷移前に未保存変更を保存
- 保存中、保存済み、保存失敗を表示
- 完了状態は利用者の明示操作でのみ設定

DB保存はトランザクションで行う。

## 13. バックアップ

### 作成

- 保存先を利用者が選択
- DBへcheckpointを実行して整合性を確保
- SQLiteのbackup APIまたは安全なコピーを使用
- 日付付きファイル名を初期表示

例:

```text
訪看かんたん売上管理_バックアップ_20260731_153000.db
```

### 復元

1. 復元ファイルを選択
2. ファイル形式とDB整合性を確認
3. 現在DBを自動バックアップ
4. アプリのDB接続を停止
5. 復元
6. マイグレーション実行
7. 再起動または再読み込み

失敗時は元DBへ戻す。

## 14. CSV出力

- UTF-8 BOM付きCSVを推奨
- WindowsのExcelで文字化けしにくくする
- ファイル名へ対象年月を含める
- 列名に単位を含める

例:

```text
訪看かんたん売上管理_2026年07月.csv
```

## 15. ログ

- アプリログはuserData配下へ保存
- 個人情報を記録しない
- DBパスなどの機密性が低い情報も利用者画面には不用意に表示しない
- ログローテーションを行う
- 利用者向けには「エラー内容をコピー」ではなく、必要なら「ログ保存場所を開く」を設定画面に用意する

## 16. インストーラー

`electron-builder` のNSISターゲットを使用する。

要件:

- 64bit Windows
- ユーザー単位インストール
- デスクトップショートカット
- スタートメニュー登録
- アンインストーラー
- 上書きインストール可能
- userData配下のDBを削除しない

推奨ファイル名:

```text
訪看かんたん売上管理_Setup_1.0.0.exe
```

## 17. アプリアイコン・署名

MVPでは署名なしでもビルド可能とする。ただしWindows SmartScreenの警告が出る可能性をREADMEへ明記する。

将来はコード署名証明書を導入できる設定にする。

## 18. 将来の複数利用者対応

初期バージョンのSQLiteをネットワーク共有フォルダーへ置いて複数人で直接使用してはならない。

複数人共有が必要になった場合は、次の構成へ移行する。

- 共通API
- PostgreSQL等の共有DB
- 利用者認証
- 権限管理
- 担当施設制御
- 競合制御
- 監査ログ

そのため、現在から次を守る。

- Repositoryインターフェースを使用する
- `created_by`、`updated_by` を持つ
- UIから保存方式を切り離す
- ドメイン計算を純粋関数にする
- 施設IDをすべての実績に保持する

## 19. バージョニング

Semantic Versioningを使用する。

- MAJOR: 互換性のない変更
- MINOR: 後方互換の機能追加
- PATCH: 不具合修正

アプリ画面の設定欄にバージョンを表示する。
