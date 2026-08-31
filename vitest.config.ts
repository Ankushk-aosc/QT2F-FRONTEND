import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react() as any],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules/**", "e2e/**", "test-results/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "vitest.setup.ts", "**/*.config.ts", "**/*.d.ts", "**/types.ts", "**/*.test.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
      // Lets server-side modules (connector adapters, the http client) be unit
      // tested. See the stub for why this does not weaken the production guard.
      "server-only": path.resolve(__dirname, "./vitest.server-only.stub.ts"),
    },
  },
})
