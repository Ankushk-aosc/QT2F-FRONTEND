# Docker Configuration

## Location
- `dockerfile` (root)

## Image Structure
The repository contains a standard `node:22-alpine` multi-stage Dockerfile, optimized for a Next.js production build.

## Key Instructions
1. **Package Manager:** It explicitly enables and activates `pnpm@10.33.3` via `corepack`.
2. **Dependencies:** Installs using `pnpm install --frozen-lockfile`.
3. **Build Context:** `pnpm build` is run during the image build process with expanded memory (`NODE_OPTIONS="--max-old-space-size=4096"`).
4. **Execution:** The server is started explicitly targeting the Next.js binary instead of `npm run start` to improve stability in cloud environments (like Azure App Services):
   ```dockerfile
   CMD ["sh", "-c", "node ./node_modules/next/dist/bin/next start --hostname 0.0.0.0 --port ${PORT}"]
   ```

## Missing Optimizations
- **Standalone Output:** Next.js supports `output: "standalone"` in `next.config.mjs` which drastically reduces Docker image size by tracing dependencies. This is not currently enabled.
