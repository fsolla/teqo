import type { PoliticalTrendStatusValue } from '@/lib/schemas/municipality'

export type MunicipalityListSavedPoliticalTrend = {
  status: PoliticalTrendStatusValue | null
  note: string | null
}

export type MunicipalityListPoliticalTrendResponse =
  | {
      status: 'success'
      message: string
      savedTrend: MunicipalityListSavedPoliticalTrend
    }
  | {
      status: 'error'
      message: string
    }
