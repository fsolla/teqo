'use client'

import { useCallback, type ComponentProps } from 'react'

import type { LeadershipListMunicipalitiesResponse } from '@/app/(campaign)/campanha/(app)/liderancas/municipalities/types'
import { MunicipalityPortfolioCell } from '@/components/campaign/shared/MunicipalityPortfolioCell'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

const MUNICIPALITIES_ENDPOINT = '/campanha/liderancas/municipalities'
const SAVE_ERROR_MESSAGE = 'Não foi possível atualizar os municípios. Tente novamente.'

type Props = Omit<ComponentProps<typeof MunicipalityPortfolioCell>, 'commitAction'>

/**
 * Thin adapter (B155+): wraps `MunicipalityPortfolioCell` with a route-based
 * `commitAction` that posts JSON to `POST /campanha/liderancas/municipalities`
 * — the cell sends `ownerId`, which is the leadership id on this call site.
 */
export const LeadershipMunicipalitiesColumnCell = (props: Props) => {
  const commitAction = useCallback(
    async (
      _state: CampaignFormActionState,
      formData: FormData,
    ): Promise<CampaignFormActionState> => {
      const leadershipId = Number(formData.get('ownerId'))
      const assigned = formData.get('assigned') === 'true'
      const municipalityIds = formData.getAll('municipalityIds').map(Number)

      try {
        const { ok, payload } = await postCampaignJson<LeadershipListMunicipalitiesResponse>(
          MUNICIPALITIES_ENDPOINT,
          { leadershipId, municipalityIds, assigned },
        )

        if (!ok || payload.status !== 'success') {
          return {
            message: payload.status === 'error' ? payload.message : SAVE_ERROR_MESSAGE,
          }
        }
        return { status: 'success' as const, message: payload.message }
      } catch {
        return { message: SAVE_ERROR_MESSAGE }
      }
    },
    [],
  )

  return <MunicipalityPortfolioCell {...props} commitAction={commitAction} />
}
