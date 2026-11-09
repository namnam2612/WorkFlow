# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM base AS runtime
COPY package.json package-lock.json ./
# Giữ cả devDependencies (cài trước khi đặt NODE_ENV): cần Prisma CLI để migrate và ts-node để chạy seed trong container
RUN npm ci
ENV NODE_ENV=production
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY tsconfig.json ./
EXPOSE 3000
USER node
# Áp dụng migration rồi chạy server
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
