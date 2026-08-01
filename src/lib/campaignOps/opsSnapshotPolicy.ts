/** Latest municipality_update rows per municipality in the ops snapshot (OH3 benchmark). */
export const OPS_MUNICIPALITY_UPDATE_LIMIT_PER_MUNICIPALITY = 50

/** Gzip budget for full ops sync (ops-hibrido spec). */
export const OPS_SNAPSHOT_GZIP_TARGET_BYTES = 2 * 1024 * 1024

/**
 * Prod JSON size measured 2026-08-01 (ops-hibrido spec) — anchor for OH3 projection.
 * @see docs/plans/ops-hibrido-rsc-local-spec.md
 */
export const OPS_SNAPSHOT_PROD_MEASURED_JSON_BYTES = 4 * 1024 * 1024

/** Conservative gzip ratio for prod ops JSON (text-heavy updates). */
export const OPS_SNAPSHOT_PROD_GZIP_RATIO_ESTIMATE = 0.5

type TruncatableMunicipalityUpdate = {
  municipality: number
  updatedAt: string
}

/** Keep the latest N municipality_update rows per municipality (updatedAt desc). */
export const truncateMunicipalityUpdates = <TUpdate extends TruncatableMunicipalityUpdate>(
  updates: TUpdate[],
  limitPerMunicipality: number = OPS_MUNICIPALITY_UPDATE_LIMIT_PER_MUNICIPALITY,
): TUpdate[] => {
  if (limitPerMunicipality <= 0) return []

  const byMunicipality = new Map<number, TUpdate[]>()

  for (const update of updates) {
    const bucket = byMunicipality.get(update.municipality) ?? []
    bucket.push(update)
    byMunicipality.set(update.municipality, bucket)
  }

  const kept: TUpdate[] = []
  for (const bucket of byMunicipality.values()) {
    bucket.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    kept.push(...bucket.slice(0, limitPerMunicipality))
  }

  return kept
}
