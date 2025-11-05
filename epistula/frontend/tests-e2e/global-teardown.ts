import { FullConfig } from '@playwright/test';

export default async function globalTeardown(_config: FullConfig) {
  // DO NOT delete E2E University - it should persist between test runs
  // Tests rely on a stable E2E environment with ID 3311
  // If cleanup is needed, manually delete via: npx tsx scripts/setup-e2e-data.ts --cleanup
  console.log('[E2E Teardown] Skipping E2E University cleanup - data persists for next run');
}
