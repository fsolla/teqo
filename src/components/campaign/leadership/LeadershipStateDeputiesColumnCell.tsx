'use client'

import { useCallback, type ComponentProps } from 'react'

import type { LeadershipListStateDeputiesResponse } from '@/app/(campaign)/campanha/(app)/liderancas/state-deputies/types'
import { LeadershipStateDeputyRelationCell } from '@/components/campaign/shared/LeadershipStateDeputyRelationCell'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

const STATE_DEPUTIES_ENDPOINT = '/campanha/liderancas/state-deputies'
const SAVE_ERROR_MESSAGE = 'Não foi possível atualizar as dobradinhas. Tente novamente.'

type Props = Omit<ComponentProps<typeof LeadershipStateDeputyRelationCell>, 'membershipAction'> & {
  /** B36 — the `fromStateDeputy` side speaks of "lideranças", not "dobradinhas". */
  saveErrorMessage?: string
}

/**
 * Thin adapter (B155+): wraps `LeadershipStateDeputyRelationCell` with a
 * route-based `membershipAction` that posts JSON to
 * `POST /campanha/liderancas/state-deputies` — same `(state, formData)`
 * contract the cell already calls, transport swapped from server action.
 */
export const LeadershipStateDeputiesColumnCell = ({ saveErrorMessage, ...props }: Props) => {
  const membershipAction = useCallback(
    async (
      _state: CampaignFormActionState,
      formData: FormData,
    ): Promise<CampaignFormActionState> => {
      const leadershipId = Number(formData.get('leadershipId'))
      const stateDeputyId = Number(formData.get('stateDeputyId'))
      const assigned = formData.get('assigned') === 'true'

      try {
        const { ok, payload } = await postCampaignJson<LeadershipListStateDeputiesResponse>(
          STATE_DEPUTIES_ENDPOINT,
          { leadershipId, stateDeputyId, assigned },
        )

        if (!ok || payload.status !== 'success') {
          return {
            message:
              payload.status === 'error'
                ? payload.message
                : (saveErrorMessage ?? SAVE_ERROR_MESSAGE),
          }
        }
        return { status: 'success' as const, message: payload.message }
      } catch {
        return { message: saveErrorMessage ?? SAVE_ERROR_MESSAGE }
      }
    },
    [saveErrorMessage],
  )

  return <LeadershipStateDeputyRelationCell {...props} membershipAction={membershipAction} />
}
