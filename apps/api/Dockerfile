# Build from repo root with:
#   docker build -f apps/api/Dockerfile -t lead-platform-api apps/api
# Or set Render/Fly/Railway "root" / context to apps/api and use Dockerfile only.

FROM node:20-bookworm-slim AS builder
WORKDIR /app
# Many hosts set NODE_ENV=production during `docker build`, which makes `npm install`
# skip devDependencies — but we need @nestjs/cli to run `nest build`.
COPY package.json ./
RUN npm install --include=dev
COPY . .
RUN npm run build

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 5000
CMD ["node", "dist/src/main.js"]
