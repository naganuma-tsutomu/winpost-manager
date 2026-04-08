FROM node:22-alpine AS base

FROM base AS builder
RUN apk update && apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo pnpm
COPY . .
# server に関連するファイルだけを抽出
RUN turbo prune @winpost/server --docker

FROM base AS installer
RUN apk update && apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# 依存関係のインストール
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# ソースコードのコピーとビルド
COPY --from=builder /app/out/full/ .
RUN pnpm turbo run build --filter=@winpost/server...

FROM base AS runner
WORKDIR /app
# pnpmを再度有効化
RUN corepack enable && corepack prepare pnpm@latest --activate

# ビルド結果を含んだディレクトリ全体をコピー
COPY --from=installer /app .

# 作業ディレクトリを server に移動
WORKDIR /app/apps/server

# Expressのデフォルトポート（適宜環境変数で上書きされる想定）
EXPOSE 3000

# package.json の start スクリプト ("node dist/index.js") を実行
CMD ["pnpm", "start"]
