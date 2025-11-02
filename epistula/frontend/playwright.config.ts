import { defineConfig, devices } from '@playwright/test';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const BASE_URL = process.env.EPISTULA_E2E_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: 'tests-e2e',
  timeout: 30_000,
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 60_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
