# s3-athena

S3 をデータレイクとして、Athena でアドホッククエリを実行するためのインフラ構成です。

## 構成リソース

```
S3 Bucket (1つ)
├── data/          ← 分析対象データを格納
└── athena-results/ ← Athena クエリ結果（30日で自動削除）

Glue Database      ← Athena のテーブル定義を管理
Athena Workgroup   ← クエリ実行設定・コスト管理（1GBスキャン上限）
IAM Role           ← Athena が S3/Glue にアクセスするためのロール
```

## 設定

[app-config.json](./app-config.json) で名前を管理しています。

| キー | 説明 | デフォルト値 |
|------|------|------------|
| `project.stage` | 環境名（バケット名サフィックスに使用） | `dev` |
| `bucket.bucketName` | S3 バケット名（`-{stage}` が付与される） | `hituji-datalake` |
| `athena.workgroupName` | Athena ワークグループ名 | `hituji-analytics` |
| `athena.databaseName` | Glue データベース名 | `hituji_analytics_db` |
| `athena.dataPrefix` | データ格納の S3 プレフィックス | `data/` |
| `athena.resultsPrefix` | クエリ結果の S3 プレフィックス | `athena-results/` |

## セットアップ

```bash
cd s3-athena
npm install
```

## デプロイ

```bash
# 初回のみ（CDK Bootstrap が未実施の場合）
npx cdk bootstrap

# 差分確認
npx cdk diff

# デプロイ
npx cdk deploy
```

デプロイ後、以下の値が出力されます。

| Output | 内容 |
|--------|------|
| `BucketName` | S3 バケット名 |
| `BucketDataPrefix` | データ格納先の S3 パス |
| `GlueDatabaseName` | Glue データベース名 |
| `AthenaWorkgroupName` | Athena ワークグループ名 |
| `AthenaResultsLocation` | クエリ結果の格納先 |
| `AthenaExecutionRoleArn` | Athena 実行ロールの ARN |

## サンプルデータ

[sample-data/](./sample-data/) に 3 種類のトイデータを用意しています。  
パーティション構成（`year=YYYY/month=MM`）になっているので、そのまま S3 にアップロードして試せます。

### データ一覧

| フォルダ | 内容 | カラム |
|----------|------|--------|
| `events/` | ユーザーの行動ログ（PV・クリック・購入） | user_id, event_type, page, session_id, created_at |
| `orders/` | 注文データ | order_id, user_id, product_id, product_name, quantity, unit_price, total_price, status, ordered_at |
| `access_logs/` | API アクセスログ | request_id, method, path, status_code, response_time_ms, user_agent, ip_address, requested_at |

## データの格納とクエリ実行

### 1. サンプルデータをアップロード

```bash
# sample-data/ 以下をまとめてアップロード
aws s3 cp sample-data/ s3://hituji-datalake-dev/data/ --recursive
```

### 2. Athena コンソールを開く

1. AWS コンソール → 検索バーで **「Athena」** を開く
2. 右上の `Workgroup` をクリックし、`hituji-analytics-dev` に切り替える
3. 左パネルの **Database** ドロップダウンで `hituji_analytics_db` を選択する

> **初回のみ:** 「set up a query result location」という警告が出た場合は、  
> **Settings タブ** → **Query result location** に  
> `s3://hituji-datalake-dev/athena-results/` を入力して保存してください。

### 3. Athena でテーブルを作成

クエリエディタに以下の DDL を貼り付けて **Run**（または `Ctrl+Enter`）で実行します。  
テーブルごとに `CREATE TABLE` → `MSCK REPAIR TABLE` の順で実行してください。

**events テーブル**

```sql
CREATE EXTERNAL TABLE events (
  user_id     STRING,
  event_type  STRING,
  page        STRING,
  session_id  STRING,
  created_at  STRING
)
PARTITIONED BY (year STRING, month STRING)
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
STORED AS TEXTFILE
LOCATION 's3://hituji-datalake-dev/data/events/'
TBLPROPERTIES ('skip.header.line.count'='1');

MSCK REPAIR TABLE events;
```

**orders テーブル**

```sql
CREATE EXTERNAL TABLE orders (
  order_id     STRING,
  user_id      STRING,
  product_id   STRING,
  product_name STRING,
  quantity     INT,
  unit_price   INT,
  total_price  INT,
  status       STRING,
  ordered_at   STRING
)
PARTITIONED BY (year STRING, month STRING)
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
STORED AS TEXTFILE
LOCATION 's3://hituji-datalake-dev/data/orders/'
TBLPROPERTIES ('skip.header.line.count'='1');

MSCK REPAIR TABLE orders;
```

**access_logs テーブル**

```sql
CREATE EXTERNAL TABLE access_logs (
  request_id       STRING,
  method           STRING,
  path             STRING,
  status_code      INT,
  response_time_ms INT,
  user_agent       STRING,
  ip_address       STRING,
  requested_at     STRING
)
PARTITIONED BY (year STRING, month STRING)
ROW FORMAT DELIMITED
FIELDS TERMINATED BY ','
STORED AS TEXTFILE
LOCATION 's3://hituji-datalake-dev/data/access_logs/'
TBLPROPERTIES ('skip.header.line.count'='1');

MSCK REPAIR TABLE access_logs;
```

### 4. クエリ実行例

```sql
-- イベント種別ごとの件数
SELECT event_type, COUNT(*) AS cnt
FROM events
WHERE year = '2024' AND month = '01'
GROUP BY event_type
ORDER BY cnt DESC;

-- 商品別売上ランキング
SELECT product_name, SUM(total_price) AS revenue
FROM orders
WHERE year = '2024' AND month = '01'
  AND status != 'cancelled'
GROUP BY product_name
ORDER BY revenue DESC;

-- エラーレート（4xx/5xx の割合）
SELECT
  CASE WHEN status_code >= 400 THEN 'error' ELSE 'ok' END AS result,
  COUNT(*) AS cnt,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS pct
FROM access_logs
WHERE year = '2024' AND month = '01'
GROUP BY 1
ORDER BY 1;
```

## テスト

```bash
npm test
```

## 削除

S3 バケットは `RemovalPolicy.RETAIN` のため、スタック削除後もデータは残ります。  
バケットを削除する場合は AWS コンソールまたは CLI で手動削除してください。

```bash
npx cdk destroy
```
