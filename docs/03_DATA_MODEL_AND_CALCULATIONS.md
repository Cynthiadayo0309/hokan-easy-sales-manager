# 03. データモデル・計算仕様

## 1. 基本方針

- 画面表示の金額単位は千円
- DB内部の金額は円の整数値を推奨
- 人数と件数は0以上の整数
- 割合は計算時に小数を保持し、画面表示時に丸める
- 集計値は原則として都度計算し、保存値との不整合を避ける
- スナップショットが必要な場合も元データを正とする

## 2. 主要エンティティ

### users

将来拡張用。MVPでは初期管理者を1件自動作成し、画面には表示しない。

- id
- name
- role (`admin`, `general`)
- is_active
- created_at
- updated_at

### facilities

- id
- name
- display_order
- is_active
- created_at
- updated_at

### nursing_categories

初期データを固定マスターとして投入する。

- id
- code (`medical`, `psychiatric`, `long_term_care`)
- name
- display_order
- is_active

### rate_settings

訪問回数別の売上単価。

- id
- facility_id nullable
- nursing_category_id
- visit_frequency (`1`, `2`, `3`)
- amount_yen
- valid_from
- valid_to nullable
- created_at
- updated_at

初期要件では全施設共通単価でもよいが、将来施設別設定が可能な構造にする。施設別設定がない場合は共通設定を使用する。

### monthly_targets

- id
- target_month (`YYYY-MM-01`)
- facility_id
- nursing_category_id
- target_people_count
- target_visit_count
- target_sales_yen
- created_by
- updated_by
- created_at
- updated_at

`target_month + facility_id + nursing_category_id` を一意にする。

### monthly_periods

対象月内の日曜始まり期間を保存または生成する。

- id
- target_month
- period_index
- start_date
- end_date
- day_count
- created_at

`target_month + period_index` を一意にする。

### weekly_entries

施設・期間単位の入力ヘッダー。

- id
- target_month
- monthly_period_id
- facility_id
- status (`not_started`, `draft`, `completed`)
- completed_at nullable
- created_by
- updated_by
- created_at
- updated_at

`monthly_period_id + facility_id` を一意にする。

### weekly_entry_details

- id
- weekly_entry_id
- nursing_category_id
- one_visit_people
- two_visit_people
- three_visit_people
- rate_one_yen
- rate_two_yen
- rate_three_yen
- created_at
- updated_at

単価の変更が過去データへ影響しないよう、入力保存時点の単価をスナップショットとして保持する。

### app_settings

- key
- value
- updated_at

例:

- 初回設定完了
- 最終表示月
- 自動保存の有無
- DBスキーマバージョン

### month_closings

- id
- target_month
- status (`open`, `closed`)
- closed_at
- closed_by
- reopened_at nullable
- reopened_by nullable
- created_at
- updated_at

### monthly_confirmed_sales

全施設・全看護区分を合算した月全体の確定売上。対象月につき1件とする。

- id
- target_month (`YYYY-MM-01`, unique)
- confirmed_sales_yen
- created_by
- updated_by
- created_at
- updated_at

レコードなしは未入力を表し、0円を保存したレコードとは区別する。

このテーブルは旧入力の月全体値として保持し、施設別入力へ自動配賦しない。

### monthly_overall_sales_targets

全施設・全看護区分を合算した月全体の売上目標。対象月につき1件とする。

- id
- target_month (`YYYY-MM-01`, unique)
- target_sales_yen
- created_by
- updated_by
- created_at
- updated_at

レコードなしは未入力を表し、0円を保存したレコードとは区別する。

このテーブルは旧入力の月全体値として保持し、施設別入力へ自動配賦しない。

### monthly_facility_sales_targets

対象月・施設ごとの売上目標。`target_month, facility_id` を一意とする。

- id
- target_month
- facility_id
- target_sales_yen
- created_by / updated_by
- created_at / updated_at

### monthly_facility_confirmed_sales

対象月・施設ごとの確定売上。`target_month, facility_id` を一意とする。

- id
- target_month
- facility_id
- confirmed_sales_yen
- created_by / updated_by
- created_at / updated_at

## 3. 日曜始まりの月内期間生成

対象月の1日から末日までを、日曜～土曜の境界で分割する。

### アルゴリズム

1. `current = 月初日`
2. `current` から最初の土曜日までを期間とする
3. 次の日曜日から7日ごとに期間を作る
4. 最終期間の終了日は月末日を超えない
5. `period_index` は1から連番
6. `day_count = end_date - start_date + 1`

### 2026年7月

- 7/1（水）～7/4（土）
- 7/5（日）～7/11（土）
- 7/12（日）～7/18（土）
- 7/19（日）～7/25（土）
- 7/26（日）～7/31（金）

### 2026年8月（6期間の例）

- 8/1（土）
- 8/2（日）～8/8（土）
- 8/9（日）～8/15（土）
- 8/16（日）～8/22（土）
- 8/23（日）～8/29（土）
- 8/30（日）～8/31（月）

## 4. 訪問人数

区分別人数:

```text
people_count = one_visit_people + two_visit_people + three_visit_people
```

これは対象期間内の延べ人数である。

## 5. 訪問件数

```text
visit_count =
  one_visit_people * 1
  + two_visit_people * 2
  + three_visit_people * 3
```

例:

- 1回訪問人数: 10
- 2回訪問人数: 3
- 3回訪問人数: 2

```text
人数 = 10 + 3 + 2 = 15人
件数 = 10*1 + 3*2 + 2*3 = 22件
```

## 6. 売上見込み

各訪問回数区分の単価は、その区分の1人あたり合計売上とする。

```text
sales_yen =
  one_visit_people * rate_one_yen
  + two_visit_people * rate_two_yen
  + three_visit_people * rate_three_yen
```

2回訪問単価、3回訪問単価へ、さらに2または3を掛けない。

例:

- 1回訪問単価: 8,500円
- 2回訪問単価: 16,000円
- 3回訪問単価: 23,000円
- 人数: 10人、3人、2人

```text
売上 = 10*8,500 + 3*16,000 + 2*23,000
     = 179,000円
     = 179千円
```

## 7. 集計階層

### 期間・施設・看護区分

`weekly_entry_detail` の計算結果。

### 期間・施設

医療、精神科、介護の合計。

### 月間・施設・看護区分

対象月内の全期間を合計。

### 月間・施設

3看護区分を合計。

### 月間・看護区分

5施設を合計。

### 月間全体

すべての施設・看護区分を合計。

## 8. 達成率

施設別・月全体の正式な達成率には施設別確定売上を使用する。

正式な目標額は次の優先順位で決定する。

1. `monthly_facility_sales_targets.target_sales_yen`
2. 施設別目標が未入力の場合は、その施設の `monthly_targets.target_sales_yen` 合計

施設別目標として0円が保存されている場合は内訳合計へフォールバックしない。施設別目標が1件もない既存月だけ、旧月全体目標を全体表示の互換値として使用する。

```text
confirmed_achievement_rate = confirmed_sales_yen / target_sales_yen * 100
```

施設別達成率はその施設の確定売上で算出する。月全体達成率は全施設の確定売上が入力済みの場合だけ施設合計から算出する。看護区分別には確定売上を配賦せず、概算売上による「概算達成率」を表示する。

表示は原則として小数第1位まで。ただし整数表示でも読みやすい場合は、UI上で四捨五入した整数を主要表示し、詳細に小数第1位を表示してもよい。

### 目標が0円の場合

- 0除算をしない
- 達成率は `－` と表示
- 実績がある場合は `目標未設定` と表示

## 9. 目標差額

```text
remaining_yen = target_sales_yen - confirmed_sales_yen
```

- 正数: 目標までの残額
- 0: 目標達成
- 負数: 絶対値を目標超過額として表示

## 10. 月末売上予測

基本式:

```text
forecast_yen = actual_sales_yen / completed_day_count * days_in_month
```

### completed_day_count

入力完了となった期間の日数だけを合計する。

一時保存は日数へ含めない。期間内の一部施設だけが完了している場合、全体予測では不完全になるため、次のいずれかを採用する。

MVPの既定:

- 5施設すべてが入力完了した期間だけを、全体の完了日数へ含める
- 施設別予測では、その施設が入力完了した期間の日数を使用する

### 完了日数が0の場合

予測は表示しない。

### 注意表示

予測は確定値ではないため、必ず `予測` と表記する。

## 11. 千円表示への変換

内部円額から表示値へ:

```text
display_thousand_yen = amount_yen / 1000
```

- 1,250,000円 → `1,250千円`
- 8,500円 → `8.5千円`

入力値から内部円額へ:

```text
amount_yen = round(input_thousand_yen * 1000)
```

小数は最大1桁または最大3桁に制限する。MVPでは小数第1位までを推奨する。

## 12. 丸め

- DB: 円単位の整数
- 千円表示: 1千円単位を基本、1千円未満が必要な単価は小数第1位
- 達成率: 小数第1位で四捨五入
- 月末予測: 画面では1千円単位に四捨五入
- CSV: 円と千円の両方を出力してもよいが、列名に単位を明記する

## 13. 入力チェック

### 人数

- 必須
- 0以上の整数
- 最大値は現実的な上限を設定する。初期値は99,999
- 空欄は未入力として扱い、勝手に0へ変換しない
- `すべて0件` 操作で明示的に0を設定できる

### 金額

- 0以上
- 千円入力
- 数字、小数点のみ
- カンマ付き入力も受け付け、内部で除去してよい

### 目標

- 0を許可するが、達成率は算出不可として扱う

## 14. 入力状態

### not_started

- 入力を開始していない
- 詳細行がない、またはすべて未入力

### draft

- 一部または全部の値がある
- コピー直後
- 自動保存済みだが完了操作をしていない

### completed

- すべての人数欄が0以上で確定
- 利用者が入力完了操作を行った

## 15. 前期間コピー

- 同じ施設の直前期間を対象とする
- 人数のみコピーする
- 単価はコピー先期間の有効単価を再取得する
- 状態は `draft`
- 対象日数が異なる場合に警告する
- 元データは変更しない

## 16. 月締め

月を締める前に確認する。

- 月内全期間が存在する
- 全施設・全期間がcompleted
- 目標が未設定の場合は警告
- 施設別目標が未入力の場合は警告するが、施設内訳目標合計を使用して確認後の月締めは許可
- 確定売上が未入力の場合は警告するが、確認後の月締めは許可
- 単価未設定の入力がない

締め後:

- 通常入力画面は読み取り専用
- 管理者の再開操作で編集可能
- 再開履歴を保存する

## 17. 単価変更

単価には適用開始日を持たせる。

- 新規入力時は対象期間開始日時点の有効単価を使用
- 保存済み入力はスナップショット単価を使用
- 過去の単価変更で、過去実績を自動再計算しない

## 18. CSV出力

最低限、次の列を出力する。

- 対象年月
- 対象期間開始日
- 対象期間終了日
- 施設名
- 訪問看護区分
- 1回訪問人数
- 2回訪問人数
- 3回訪問人数
- 人数計
- 件数計
- 売上円
- 売上千円
- 入力状態

月間集計CSVでは、目標、概算売上、確定売上、概算達成率、確定達成率、各差額も出力する。施設別行には施設の確定値を出力し、看護区分別行の確定値は空欄とする。

## 19. 個人情報

このアプリでは、患者名、住所、電話番号、保険番号、病名などを保存しない。
