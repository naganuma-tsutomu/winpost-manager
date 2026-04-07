# WinPost Manager

[ウイニングポスト10 2025](https://www.gamecity.ne.jp/winningpost10/2025/) のプレイを支援するための管理ツールです。
種牡馬・繁殖牝馬・幼駒の管理、独自のスコアリング推測計算、配合シミュレーション、およびゲーム画面からのOCR取込みをワンストップで行うことができます。

## 🌟 主な機能

- **血統＆馬データ管理**
  - 種牡馬・繁殖牝馬の血統構成（先祖最大5代）や因子の管理
  - 幼駒の情報を管理し、河童木・美香の印や成長型からスピード期待値を推測スコア化
- **配合計画シミュレーター**
  - 指定した種牡馬と繁殖牝馬の血統データから、ウイニングポスト10 2025の配合理論（ニックス、インブリード、血脈活性化、ラインブリード、活力補完、隔世遺伝、母父○など）の成立を自動判定し、爆発力やリスクを算出して評価（S+ 〜 Dランク）
  - 毎年の配合計画をカレンダー形式で残せるプラニング機能
- **OCR連携**
  - ゲームのスクリーンショット画像を読み込ませることで、EasyOCRを用いて血統情報や馬のステータスをテキスト抽出し、シームレスにデータ化

## 🛠 技術スタック

本プロジェクトは **pnpm workspaces + Turborepo** を用いたモノレポ構成で開発されています。

### フロントエンド (`apps/client`)
- React 19 + Vite + TypeScript
- React Router v7
- TanStack Query (サーバー状態管理)
- React Hook Form + Zod

### バックエンド API (`apps/server`)
- Node.js 20 + Express 5 + TypeScript (`tsx`)
- PostgreSQL + Prisma (`packages/database`)
- バリデーションに Zod を使用

### OCR マイクロサービス (`apps/ocr`)
- Python 3.11 + FastAPI + Docker
- EasyOCR による高精度な文字認識

### コアロジック (`packages/shared`)
- 配合理論やスピードスコアの算出ロジックを純粋関数として管理
- `vitest` による堅牢なテストカバー

## 📦 開発環境のセットアップと起動方法

### 前提条件
- Node.js (v20推奨)
- pnpm
- Docker & Docker Compose (OCRサービス用)
- PostgreSQL
- `.env` ファイルに必要事項（`DATABASE_URL`等）を設定済みであること

### セットアップ
```bash
# パッケージのインストール
pnpm install

# データベースのマイグレーションとPrisma Clientの生成
pnpm db:push
pnpm db:generate
```

### 起動 (開発モード)
```bash
# フロントエンドとバックエンドAPIの並列起動
pnpm dev

# OCRサービス（Docker）の起動 (別ターミナルで実行)
docker compose up
```

- クライアント: `http://localhost:5173`
- API サーバー: `http://localhost:3001`
- OCR サービス: `http://localhost:8000`

## 🧪 テストの実行

配合計算ロジックなどのテストを実行するには以下のコマンドを実行します。

```bash
pnpm --filter @winpost/shared test
```