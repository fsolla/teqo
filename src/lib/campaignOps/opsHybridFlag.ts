type OpsHybridEnv = Record<string, string | undefined>

/** Compile-time env gate for the ops hybrid mirror (OH1). Truthy only for `'1'` or `'true'`. */
export const resolveOpsHybridEnabled = (env: OpsHybridEnv = process.env): boolean => {
  const value = env.OPS_HYBRID
  return value === '1' || value === 'true'
}
