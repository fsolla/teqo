import type { OpsMunicipality } from '@/lib/campaignOps/opsContract'

/** Presentational header slice shared by RSC detail and Local offline (OH9). */
export type MunicipalityDetailHeaderViewModel = {
  name: string
  kind: OpsMunicipality['kind']
  region: string
  zoneNumber: number | null
  lastUpdateAt: string | null
}

export const toDetailHeaderView = (
  municipality: Pick<OpsMunicipality, 'name' | 'kind' | 'region' | 'zoneNumber' | 'lastUpdateAt'>,
): MunicipalityDetailHeaderViewModel => ({
  name: municipality.name,
  kind: municipality.kind,
  region: municipality.region,
  zoneNumber: municipality.zoneNumber ?? null,
  lastUpdateAt: municipality.lastUpdateAt ?? null,
})
