FROM node:22-bookworm-slim AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY drizzle ./drizzle
RUN npm run build

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

RUN groupadd --gid 10001 lorekit \
  && useradd --uid 10001 --gid 10001 --no-create-home --shell /usr/sbin/nologin lorekit

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts=false \
  && npm cache clean --force

COPY --from=build --chown=10001:10001 /app/dist ./dist
COPY --from=build --chown=10001:10001 /app/drizzle ./drizzle

USER 10001:10001
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]

CMD ["node", "dist/main.js"]
