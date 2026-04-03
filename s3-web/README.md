# s3-web

S3 + CloudFront を使った静的ウェブサイトホスティングの CDK テンプレート。

## 概要

`app-config.json` の `buckets` 配列にエントリを追加するだけで、複数の静的ウェブサイト環境を一括構築できます。

各バケットに以下のリソースが作成されます：

- **S3 バケット** — コンテンツ格納用（パブリックアクセス完全ブロック）
- **CloudFront Distribution** — OAC 経由で S3 にアクセス、HTTPS 強制

## 使い方

### 1. バケットを設定する

`app-config.json` の `buckets` にバケット定義を追加します。

```json
{
  "project": {
    "name": "s3-web",
    "stage": "dev",
    "description": "S3 Static Website Hosting with CloudFront"
  },
  "buckets": [
    {
      "id": "MainSite",
      "bucketName": "my-website",
      "indexDocument": "index.html",
      "errorDocument": "error.html",
      "cloudfront": {
        "enabled": true,
        "priceClass": "PriceClass_100",
        "defaultTtlSeconds": 86400,
        "maxTtlSeconds": 31536000
      }
    }
  ]
}
```

| プロパティ | 説明 |
|---|---|
| `id` | CDK リソースの論理 ID（スタック内で一意） |
| `bucketName` | S3 バケット名（`-{stage}` が自動付与される） |
| `indexDocument` | トップページのファイル名 |
| `errorDocument` | エラー時に表示するファイル名 |
| `cloudfront.enabled` | CloudFront Distribution を作成するか |
| `cloudfront.priceClass` | `PriceClass_100`（北米/欧州）/ `PriceClass_200` / `PriceClass_All` |
| `cloudfront.defaultTtlSeconds` | デフォルトキャッシュ時間（秒） |
| `cloudfront.maxTtlSeconds` | 最大キャッシュ時間（秒） |

### 2. デプロイする

```bash
npm install
npx cdk deploy
```

デプロイ完了後、ターミナルに URL が表示されます。

```
Outputs:
S3WebStack.MainSiteDistributionUrl = https://d1234abcd5678.cloudfront.net
S3WebStack.MainSiteDistributionId  = E1ABCDEFGHIJKL
S3WebStack.MainSiteBucketName      = my-website-dev
```

### 3. コンテンツをアップロードする

```bash
aws s3 sync ./dist s3://my-website-dev/
```

### 4. キャッシュを削除する（コンテンツ更新時）

```bash
aws cloudfront create-invalidation \
  --distribution-id E1ABCDEFGHIJKL \
  --paths "/*"
```

## 複数バケットの追加

`buckets` 配列にエントリを追加するだけで、バケットと CloudFront Distribution がまとめて作成されます。

```json
"buckets": [
  { "id": "MainSite", "bucketName": "my-main-site", ... },
  { "id": "LandingPage", "bucketName": "my-landing-page", ... }
]
```

## 削除

```bash
npx cdk destroy
```

> S3 バケットは `removalPolicy: RETAIN` のため、スタック削除後も残ります。手動で削除する場合は AWS コンソールまたは CLI を使用してください。
