# レシピ帳（デモ版）

URLを貼り付けるだけでAIが自動でレシピを抽出・登録できるWebアプリです。
レシピはブラウザの **localStorage** に保存されます（端末ごとに個別のデータ）。

## 機能

- **URLから追加** — レシピサイトやYouTubeのURLを貼るだけでAIが自動抽出
- **画像表示** — レシピサイトのOGP画像・YouTubeサムネイルを自動取得して表示
- **手動で追加** — フォームから直接入力
- **編集 / 削除** — レシピ詳細画面から操作
- **検索** — タイトル・材料・メモでフィルタリング
- **localStorage 保存** — データはブラウザに保存（端末ごとに独立）

> **注意**: ブラウザのデータを削除するとレシピも消えます。複数端末での共有はできません。

## 使い方

1. 「✨ URLから追加」をタップ
2. レシピサイトまたはYouTubeのURLを貼り付け
3. 「抽出する」をタップ（数秒かかります）
4. 内容を確認して「保存」

YouTube URLの場合は動画の概要欄からレシピを抽出します。
概要欄にレシピが記載されていない動画は抽出できません。

## アーキテクチャ

\`\`\`
ブラウザ (localStorage)
        ↓
Cloud Run (Express + React)
        ↓
YouTube Data API v3（YouTube URLの場合）
Web fetch（その他のURLの場合）
        ↓
Gemini 2.5 Flash Lite（レシピ抽出）
\`\`\`

- フロントエンド: React + Vite（データは localStorage）
- バックエンド: Express（/api/extract のみ・Firestore なし）
- AI: Google Gemini 2.5 Flash Lite
- デプロイ: GitHub Actions → Artifact Registry → Cloud Run（main ブランチへの push で自動）

## 開発

\`\`\`bash
npm install
npm run dev    # ローカル起動
npm run build  # ビルド
\`\`\`

## 自分用にデプロイする手順

### 前提条件

- Google アカウント・GitHub アカウント
- [Google Cloud SDK（gcloud）](https://cloud.google.com/sdk/docs/install) インストール済み

### 1. リポジトリをフォーク

GitHub でこのリポジトリを **Fork** します。

### 2. GCP プロジェクトを作成

\`\`\`bash
gcloud projects create PROJECT_ID
gcloud config set project PROJECT_ID
\`\`\`

請求先アカウントを [Cloud Console](https://console.cloud.google.com/billing) で紐付けてください（Gemini API の利用に必要）。
意図しない課金を防ぐため [予算アラート](https://console.cloud.google.com/billing/budgets) で上限設定を推奨します。

### 3. API を有効化

\`\`\`bash
gcloud services enable \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  youtube.googleapis.com \
  iam.googleapis.com \
  iamcredentials.googleapis.com
\`\`\`

### 4. Artifact Registry リポジトリを作成

\`\`\`bash
gcloud artifacts repositories create cloud-run-images \
  --repository-format=docker \
  --location=asia-northeast1
\`\`\`

### 5. API キーを取得

**Gemini API キー**
\`\`\`bash
gcloud alpha services api-keys create \
  --display-name="Gemini API Key" \
  --api-target=service=generativelanguage.googleapis.com
# 出力の keyString をメモする
\`\`\`

**YouTube Data API キー**
\`\`\`bash
gcloud alpha services api-keys create \
  --display-name="YouTube Data API Key" \
  --api-target=service=youtube.googleapis.com
# 出力の keyString をメモする
\`\`\`

### 6. Workload Identity Federation を設定

\`\`\`bash
PROJECT_ID=$(gcloud config get-value project)
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
GITHUB_USER=あなたのGitHubユーザー名
REPO_NAME=recipe-book-demo

# Pool 作成
gcloud iam workload-identity-pools create github-pool \
  --location=global \
  --display-name="GitHub Actions Pool"

# Provider 作成
gcloud iam workload-identity-pools providers create-oidc github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --display-name="GitHub Provider" \
  --issuer-uri=https://token.actions.githubusercontent.com \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='${GITHUB_USER}/${REPO_NAME}'"

# サービスアカウント作成
gcloud iam service-accounts create github-actions-sa \
  --display-name="GitHub Actions SA"

# 権限付与
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/run.admin"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/iam.serviceAccountUser"

# WIF バインディング
gcloud iam service-accounts add-iam-policy-binding \
  github-actions-sa@${PROJECT_ID}.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-pool/attribute.repository/${GITHUB_USER}/${REPO_NAME}"
\`\`\`

Provider のリソース名を確認：
\`\`\`bash
gcloud iam workload-identity-pools providers describe github-provider \
  --location=global \
  --workload-identity-pool=github-pool \
  --format='value(name)'
\`\`\`

### 7. GitHub Secrets を設定

フォークしたリポジトリの **Settings → Secrets and variables → Actions** で追加：

| Secret 名 | 値 |
|-----------|---|
| `WIF_PROVIDER` | 上で確認した Provider のリソース名 |
| `WIF_SERVICE_ACCOUNT` | `github-actions-sa@PROJECT_ID.iam.gserviceaccount.com` |
| `GEMINI_API_KEY` | 手順5で取得した Gemini API キー |
| `YOUTUBE_API_KEY` | 手順5で取得した YouTube API キー |

### 8. ワークフローファイルを修正

`.github/workflows/deploy.yml` の PROJECT_ID を書き換えます：

\`\`\`yaml
env:
  PROJECT_ID: PROJECT_ID   # 手順2で決めたプロジェクトID
  REGION: asia-northeast1
  IMAGE: asia-northeast1-docker.pkg.dev/PROJECT_ID/cloud-run-images/recipe-book-demo
\`\`\`

### 9. デプロイ

`main` ブランチに push すると自動デプロイされます：

\`\`\`bash
git add .
git commit -m "Set up my instance"
git push origin main
\`\`\`

デプロイ後の URL を確認：
\`\`\`bash
gcloud run services describe recipe-book-demo \
  --region=asia-northeast1 \
  --format='value(status.url)'
\`\`\`
