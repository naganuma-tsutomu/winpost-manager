FROM node:22-alpine AS base

# 1. Prune
FROM base AS builder
# node-alpine に必要な libc6-compat をインストール
RUN apk update && apk add --no-cache libc6-compat
WORKDIR /app
RUN npm install -g turbo pnpm
COPY . .
# client に関連するファイルだけを抽出
RUN turbo prune @winpost/client --docker

# 2. Add dependencies and build
FROM base AS installer
RUN apk update && apk add --no-cache libc6-compat
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

# 依存関係のインストール（Pnpmを使用）
COPY .gitignore .gitignore
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# ソースコードのコピーとビルド
COPY --from=builder /app/out/full/ .
RUN pnpm turbo run build --filter=@winpost/client...

# 3. Serve via Nginx
FROM nginx:alpine AS runner
# ビルド成果物をNginxにコピー
COPY --from=installer /app/apps/client/dist /usr/share/nginx/html

# SPA（シングルページアプリーケーション）用のルーティング設定
RUN echo "server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files \$uri \$uri/ /index.html; \
    } \
}" > /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
