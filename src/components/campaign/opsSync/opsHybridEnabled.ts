/**
 * OH6 tracer — compile-time `OPS_HYBRID` reader for the estimate outbox island.
 * OH2 owns the canonical `src/lib/campaignOps/opsHybridFlag.ts`; this local
 * helper avoids opening that package while OH2 lands in parallel.
 */
export const resolveOpsHybridEnabled = (
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean => {
  const raw = env.OPS_HYBRID?.trim().toLowerCase()
  return raw === '1' || raw === 'true'
}
