# WinPost Manager — プロジェクト概要

ウイニングポスト10 2025 のプレイ支援ツール。
種牡馬・繁殖牝馬・幼駒の管理、配合シミュレーション、OCR取込みをワンストップで行う。

---

## モノレポ構成 (pnpm workspaces + Turborepo)

```
apps/
  client/   React フロントエンド (Vite, React 19, React Router v7)
  server/   Express API サーバー (Node 20, tsx)
  ocr/      EasyOCR サービス (Python 3.11 + FastAPI, Docker)
packages/
  shared/   型定義・配合計算ロジック・スコアリングロジック
  database/ Prisma クライアント (PostgreSQL)
```

---

## 各アプリの役割

### `apps/client` — フロントエンド
- React 19 + Vite + TypeScript
- TanStack Query でサーバー状態管理
- React Hook Form + Zod でフォームバリデーション
- React Router v7 でページ遷移
- ポート: 5173 (dev)

### `apps/server` — REST API
- Express 5 + TypeScript (tsx で開発起動)
- ポート: 3001
- エンドポイント一覧:
  - `GET/POST /api/stallions` — 種牡馬 CRUD
  - `GET/POST /api/mares` — 繁殖牝馬 CRUD
  - `GET/POST /api/lineages` — 系統マスタ
  - `GET/POST /api/foals` — 幼駒 CRUD
  - `POST /api/breeding/calculate` — 配合計算
  - `POST /api/ocr` — スクリーンショット OCR 取込み

### `apps/ocr` — OCR サービス
- Python 3.11 + FastAPI + EasyOCR (日本語/英語)
- Docker コンテナで動作
- ゲームのスクリーンショットから馬情報をテキスト抽出してサーバーに返す

---

## コアロジック (`packages/shared/src`)

### `breeding.ts` — 配合計算
ウイニングポストの配合理論を純粋関数として実装。サーバー/クライアント両方から使用。

| 関数 | 内容 |
|---|---|
| `calcNicks` | ニックス判定（シングル〜フォース） |
| `calcInbreed` | インブリード判定（4代以内の共通先祖） |
| `calcBloodActivation` | 血脈活性化（3代前の親系統種類数） |
| `calcLineBreed` | ラインブリード（子系統・親系統・爆発型） |
| `calcVitalityComplement` | 活力補完（名種牡馬型・名牝型・完全型） |
| `calcAtavism` | 隔世遺伝 |
| `calcDamSireBonus` | 母父○ |
| `calculateBreeding` | 上記を統合して `BreedingResult` を返すメイン関数 |

爆発力 `totalPower` に応じてランク D / C / B / A / S / S+ を返す。

### `scoring.ts` — スピードスコア推測
河童木・美香の評価印（◎○▲－）と成長型から、幼駒のスピード期待値を推算する。
美香の印に 1.5 倍の重みを付与。晩成/超晩成はボーナス、早熟/超早熟は割引。

### `constants.ts`
ゲーム固有の定数・Enum を定義（`EvalMark`, `GrowthType`, `FactorType`, `FlagType`, `PlanStatus`）。

---

## データベース (PostgreSQL + Prisma)

主要モデル:

| モデル | 用途 |
|---|---|
| `Stallion` | 種牡馬（系統・能力値・因子） |
| `Mare` | 繁殖牝馬 |
| `Foal` | 幼駒（印・成長型・フラグ） |
| `PedigreeEntry` | 血統表（`position` 文字列で最大5代管理） |
| `NicksRelation` | ニックス相性テーブル（系統ペア × レベル1〜3） |
| `BreedingPlan` | 配合計画（年度・状態管理） |
| `Factor` | 因子（種牡馬/牝馬にアタッチ） |

血統の位置は `"F"`, `"FF"`, `"MF"` などの文字列で表現（F=父側, M=母側）。

---

## テスト

```bash
pnpm --filter @winpost/shared test       # vitest run (29テスト)
pnpm --filter @winpost/shared test:watch # ウォッチモード
```

配合計算ロジック全関数のユニットテストが `packages/shared/src/__tests__/breeding.test.ts` にある。

---

## 開発起動

```bash
pnpm dev          # client + server を並列起動 (Turborepo)
docker compose up # ocr サービス起動 (別途)
```

環境変数はルートの `.env` を参照（`DATABASE_URL` 必須）。
