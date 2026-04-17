import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Integration test config — only picks up tests under src/__tests__/integration/**.
 * Needs TEST_DATABASE_URL pointed at a migrated Postgres test database; the
 * suites skip themselves when that env var is missing so CI jobs without a DB
 * still pass.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/__tests__/integration/**/*.test.{js,jsx,ts,tsx}"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
