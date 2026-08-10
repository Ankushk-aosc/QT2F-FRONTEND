FROM node:22-alpine

WORKDIR /app

RUN corepack enable
RUN corepack prepare pnpm@10.33.3 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Build once during image build
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN pnpm build

EXPOSE 3000

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

# Start production server (stable for Azure)
CMD ["sh", "-c", "node ./node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port ${PORT}"]
