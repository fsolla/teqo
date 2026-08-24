'use client'

import { useMemo, type ComponentProps } from 'react'

import type { LeadershipListStateDeputiesResponse } from '@/app/(campaign)/campanha/(app)/liderancas/state-deputies/types'
import { LeadershipStateDeputyRelationCell } from '@/components/campaign/shared/LeadershipStateDeputyRelationCell'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

const ENDPOINT = '/campanha/liderancas/state-deputies'
const GENERIC_ERROR = 'Não foi possível atualizar as dobradinhas. Tente novamente.'

type Props = Omit<ComponentProps<typeof LeadershipStateDeputyRelationCell>, 'membershipAction'>

/**
 * Thin adapter (B155+): wraps `LeadershipStateDeputyRelationCell` with a
 * route-based `membershipAction` that posts JSON to
 * `POST /campanha/liderancas/state-deputies` — same `(state, formData)`
 * contract the cell already calls, transport swapped from server action.
 */
export const LeadershipStateDeputiesColumnCell = (props: Props) => {
  const membershipAction = useMemo(
    () =>
      async (
        _state: CampaignFormActionState,
        formData: FormData,
      ): Promise<CampaignFormActionState> => {
        const leadershipId = Number(formData.get('leadershipId'))
        const stateDeputyId = Number(formData.get('stateDeputyId'))
        const assigned = formData.get('assigned') === 'true'

        try {
          const { ok, payload } = await postCampaignJson<LeadershipListStateDeputiesResponse>(
            ENDPOINT,
            { leadershipId, stateDeputyId, assigned },
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

  return <LeadershipStateDeputyRelationCell {...props} membershipAction={membershipAction} />
}
