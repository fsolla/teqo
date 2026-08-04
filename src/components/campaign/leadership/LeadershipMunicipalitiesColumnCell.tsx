'use client'

import { useMemo } from 'react'

import type { LeadershipListMunicipalitiesResponse } from '@/app/(campaign)/campanha/(app)/liderancas/municipalities/types'
import { CampaignListSheetProvider } from '@/components/campaign/shared/CampaignListSheetHost'
import {
  MunicipalityPortfolioCell,
  type MunicipalityPortfolioCellProps,
} from '@/components/campaign/shared/MunicipalityPortfolioCell'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

const ENDPOINT = '/campanha/liderancas/municipalities'
const GENERIC_ERROR = 'Não foi possível atualizar os municípios. Tente novamente.'

type Props = Omit<MunicipalityPortfolioCellProps, 'commitAction'>

/**
 * Thin adapter: wraps `MunicipalityPortfolioCell` with a route-based
 * `commitAction` that posts JSON to `POST /campanha/liderancas/municipalities`.
 */
export const LeadershipMunicipalitiesColumnCell = (props: Props) => {
  const commitAction = useMemo(
    () =>
      async (
        _state: CampaignFormActionState,
        formData: FormData,
      ): Promise<CampaignFormActionState> => {
        const leadershipId = Number(formData.get('ownerId'))
        const assigned = formData.get('assigned') === 'true'
        const municipalityIds = formData.getAll('municipalityIds').map(Number)

        try {
          const { ok, payload } = await postCampaignJson<LeadershipListMunicipalitiesResponse>(
            ENDPOINT,
            { leadershipId, municipalityIds, assigned },
          )

          if (!ok || payload.status !== 'success') {
            return {
              message: payload.status === 'error' ? payload.message : GENERIC_ERROR,
            }
          }
          return { status: 'success' as const, message: payload.message }
        } catch {
          return { message: GENERIC_ERROR }
        }
      },
    [],
  )

  return (
    <CampaignListSheetProvider>
      <MunicipalityPortfolioCell {...props} commitAction={commitAction} />
    </CampaignListSheetProvider>
  )
}
