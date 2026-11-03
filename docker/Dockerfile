# syntax=docker/dockerfile:1.7
# 빌드 컨텍스트는 리포지토리 루트다.
#   docker build -f docker/Dockerfile -t nest-vue-server .

ARG NODE_IMAGE=node:22.22-alpine
ARG PNPM_VERSION=11.25.0

# ---------------------------------------------------------------- base
FROM ${NODE_IMAGE} AS base
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

# --------------------------------------------------- 매니페스트만 먼저 복사
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY web/package.json ./web/

# ------------------------------------------------------------ 전체 의존성
FROM manifests AS deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @nest-vue/server... --filter @nest-vue/shared...

# ------------------------------------------------------- 프로덕션 의존성만
FROM manifests AS prod-deps
# 루트 prepare는 husky다. 프로덕션 설치에는 그 패키지가 없어 스크립트를 실행하면 실패한다.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --filter @nest-vue/server... --ignore-scripts

# ------------------------------------------------------------------ build
FROM deps AS build
COPY tsconfig.base.json ./
COPY shared ./shared
COPY server ./server
RUN pnpm --filter @nest-vue/server build

# -------------------------------------------------------------------- dev
# docker-compose.dev.yaml 에서 소스를 bind mount 해서 사용한다.
FROM base AS dev
ENV NODE_ENV=development
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY shared/package.json ./shared/
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile
COPY . .
EXPOSE 3000
CMD ["pnpm", "--filter", "@nest-vue/server", "dev"]

# ----------------------------------------------------------------- runner
FROM ${NODE_IMAGE} AS runner
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app

RUN apk add --no-cache tini

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/server/node_modules ./server/node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/drizzle ./server/drizzle
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/shared ./shared
COPY package.json pnpm-workspace.yaml ./

WORKDIR /app/server
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "--enable-source-maps", "dist/server/src/main.js"]
