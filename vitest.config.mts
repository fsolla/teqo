import os from 'node:os'
import path from 'node:path'

import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

// Cap forks on high-core local machines so Payload pools stay under Docker
// Postgres max_connections (default worker count ≈ CPUs; 16× pool-max-10 ≈
// 160 clients → "too many clients already"). Do NOT set a literal
// `maxWorkers: 8` on CI: Vitest treats that as "use up to 8" even on 2–4
// vCPU runners, which starves shared advisory leases (invite/consent) and
// times out at 15s. Leave CI on Vitest's CPU-relative default — except on
// self-hosted high-core runners (Forgejo homeserver: 8 CPUs → 8 forks ×
// pool-10 already overflows the service Postgres' 100 clients), where the
// workflow pins VITEST_MAX_WORKERS=4 (the "too many clients" failure mode
// landed there in CI run 180).
const maxWorkers = process.env.VITEST_MAX_WORKERS
  ? Number(process.env.VITEST_MAX_WORKERS)
  : process.env.CI
    ? undefined
    : Math.min(8, os.availableParallelism())

export default defineConfig({
  resolve: {
    alias: {
      'server-only': path.resolve(process.cwd(), 'tests/helpers/serverOnly.ts'),
    },
  },
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: ['tests/int/**/*.int.spec.ts'],
    ...(maxWorkers === undefined ? {} : { maxWorkers }),
    // Int specs hit a real Postgres under a parallel suite, so wall time is
    // dominated by pool contention, not by the code under test. The 5s
    // default made legitimately heavy RSC-composition tests flake as the
    // suite grew (municipalityPageData was the first); one global budget
    // beats per-test overrides. Genuinely hung tests still fail — just 10s
    // later. The unit suite keeps the 5s default.
    testTimeout: 15_000,
    // High-core local machines run up to 8 parallel forks against one
    // Postgres (gate:ci, OPS98). Cross-file DB contention makes a few
    // wall-clock-sensitive specs flake intermittently (C113/C115 calendar
    // family) even at low system load — each run picks different victims.
    // One retry gives the contended transaction a second chance without
    // hiding real failures (CI on 2–4 vCPU rarely needs it; the unit suite
    // stays at 0 retries).
    retry: 1,
  },
})
