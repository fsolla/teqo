/**
 * CL2 — feature flag for the unified list factory (CL3+).
 *
 * When disabled, existing list routes keep their current implementation.
 */

const TRUTHY = new Set(['1', 'true'])

export const resolveListUnifiedEnabled = (
  env: Record<string, string | undefined> = process.env,
): boolean => TRUTHY.has(env.LIST_UNIFIED ?? '')
