# ---- 构建阶段 ----
FROM node:22-slim AS builder

# better-sqlite3 需要编译工具
RUN apt-get update && \
    apt-get install -y --no-install-recommends build-essential python3 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先拷贝依赖声明，利用 Docker 缓存（源码变了不用重新 npm install）
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# ---- 运行阶段 ----
FROM node:22-slim

WORKDIR /app

# 从构建阶段拷贝编译好的 node_modules
COPY --from=builder /app/node_modules ./node_modules

# 拷贝应用源码
COPY package.json ./
COPY server/ ./server/
COPY public/ ./public/
COPY bots/ ./bots/

# 数据目录（SQLite 数据库存放位置）
RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 3030

CMD ["node", "server/index.js"]
