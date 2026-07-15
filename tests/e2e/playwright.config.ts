import { defineConfig, devices } from "@playwright/test";

// E2E against the running all-in-one stack (python up.py). Fully self-contained in ulibotlocal.
//   npm install && npx playwright install chromium
//   npx playwright test
export default defineConfig({
  testDir: ".",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:8080",
    trace: "on-first-retry",
    ...devices["Desktop Chrome"],
  },
});
