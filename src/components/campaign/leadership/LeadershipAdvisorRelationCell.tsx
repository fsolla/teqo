'use client'

import { useCallback } from 'react'

import type { RelationChipCellCopy } from '@/components/campaign/shared/RelationChipCell'
import {
  RelationOptionCell,
  type RelationCellOption,
} from '@/components/campaign/shared/RelationOptionCell'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

type LeadershipAdvisorRelationCellProps = {
  leadershipId: number
  leadershipName: string
  /** Assigned advisors, names resolved server-side (C99). */
  advisors: Array<{ id: number; name: string }>
  /** The addable staff catalog (`loadEligibleAdvisorOptions`). Empty when read-only. */
  options: RelationCellOption[]
  membershipAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  /**
   * Read-only for staff who may see but not assign (C99): linked chips lose
   * their href — `/campanha/assessores/[id]` is unrestricted-only, so a link
   * would send the read-only viewer into a redirect dead-end (B156 rule).
   */
  readOnly?: boolean
}

type LeadershipAdvisorCopy = RelationChipCellCopy & {
  drawerTitle: string
  updateErrorMessage: string
}

const ADVISOR_COPY: LeadershipAdvisorCopy = {
  drawerTitle: 'Assessores responsáveis da liderança',
  searchPlaceholder: 'Buscar assessor…',
  searchLabel: 'Buscar assessor',
  suggestionsLabel: 'Sugestões de assessores',
  emptyDrawerMessage: 'Nenhum assessor vinculado.',
  savingMessage: 'Salvando assessores…',
  savedMessage: 'Assessores salvos.',
  removedMessage: (count: number) =>
    count === 1 ? 'Assessor removido.' : `${count} assessores removidos.`,
  updateErrorMessage: 'Não foi possível atualizar os assessores. Tente novamente.',
}

/**
 * `Leadership.advisors` cell (C99) — the third thin wrapper over the shared
 * `RelationOptionCell` (same shape as `StateDeputyAdvisorRelationCell`, B156):
 * chips link to `/campanha/assessores/[id]` (unless read-only), search resolves
 * the eligible staff catalog, and the write sends
 * `leadershipId`/`advisorId`/`assigned` through the unrestricted-only
 * membership action. Serves the "Assessores responsáveis" section of the
 * leadership detail page.
 */
export const LeadershipAdvisorRelationCell = ({
  leadershipId,
  leadershipName,
  advisors,
  options,
  membershipAction,
  readOnly = false,
}: LeadershipAdvisorRelationCellProps) => {
  const buildFormData = useCallback(
    (changedIds: number[], assigned: boolean) => {
      const formData = new FormData()
      formData.set('leadershipId', String(leadershipId))
      formData.set('advisorId', String(changedIds[0]))
      formData.set('assigned', assigned ? 'true' : 'false')
      return formData
    },
    [leadershipId],
  )

  return (
    <RelationOptionCell
      ownerId={leadershipId}
      ownerName={leadershipName}
      items={advisors.map((advisor) => ({
        id: advisor.id,
        label: advisor.name,
        ...(readOnly ? {} : { href: `/campanha/assessores/${advisor.id}` }),
      }))}
      options={options}
      buildFormData={buildFormData}
      commitAction={membershipAction}
      copy={ADVISOR_COPY}
      drawerTitle={ADVISOR_COPY.drawerTitle}
      triggerLabel={`Editar assessores de ${leadershipName}`}
      updateErrorMessage={ADVISOR_COPY.updateErrorMessage}
      readOnly={readOnly}
    />
  )
}
