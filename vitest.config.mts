import path from 'node:path'

import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

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
    // Cap forks so each worker's Payload pg pool stays under Docker Postgres
    // max_connections=100 on high-core laptops (default worker count ≈ CPUs;
    // 16× pool-max-10 ≈ 160 clients → "too many clients already", which then
    // cascades into unrelated QueryError noise). CI runners have fewer CPUs.
    maxWorkers: 8,
    // Int specs hit a real Postgres under a parallel suite, so wall time is
    // dominated by pool contention, not by the code under test. The 5s
    // default made legitimately heavy RSC-composition tests flake as the
    // suite grew (municipalityPageData was the first); one global budget
    // beats per-test overrides. Genuinely hung tests still fail — just 10s
    // later. The unit suite keeps the 5s default.
    testTimeout: 15_000,
  },
})
