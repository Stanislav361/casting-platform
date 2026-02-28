FROM node:20-alpine

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_MODE=production
ARG NEXT_PUBLIC_TELEGRAM_CHANNEL

ENV DIR=/app \
    MODE=production \
    API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_MODE=$NEXT_PUBLIC_MODE \
    NEXT_PUBLIC_TELEGRAM_CHANNEL=$NEXT_PUBLIC_TELEGRAM_CHANNEL \
    COREPACK_INTEGRITY_KEYS="0" \
    PNPM_HOME="/pnpm" \
    PATH="$PNPM_HOME:$PATH"

RUN corepack enable pnpm && corepack use pnpm@10.0.0
RUN apk add --no-cache libc6-compat

WORKDIR $DIR

COPY . $DIR/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm prebuild 2>/dev/null || true
RUN pnpm build:tma

EXPOSE 3002

CMD ["pnpm", "start:tma"]
