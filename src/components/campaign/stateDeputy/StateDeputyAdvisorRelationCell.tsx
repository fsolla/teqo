'use client'

import { useCallback } from 'react'

import type { RelationChipCellCopy } from '@/components/campaign/shared/RelationChipCell'
import {
  RelationOptionCell,
  type RelationCellOption,
} from '@/components/campaign/shared/RelationOptionCell'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

type StateDeputyAdvisorRelationCellProps = {
  stateDeputyId: number
  stateDeputyName: string
  /** Assigned advisors, names resolved server-side (B156). */
  advisors: Array<{ id: number; name: string }>
  /** The addable staff catalog (`loadEligibleAdvisorOptions`). Empty when read-only. */
  options: RelationCellOption[]
  membershipAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  /**
   * Read-only for staff who may see but not assign (B156): linked chips lose
   * their href — `/campanha/assessores/[id]` is unrestricted-only, so a link
   * would send the read-only viewer into a redirect dead-end.
   */
  readOnly?: boolean
  /** Clamp rest chips to 3 rows + "Ver mais…". Default true. */
  measureOverflow?: boolean
}

type StateDeputyAdvisorCopy = RelationChipCellCopy & {
  drawerTitle: string
  updateErrorMessage: string
}

const ADVISOR_COPY: StateDeputyAdvisorCopy = {
  drawerTitle: 'Assessores da dobradinha',
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
 * `StateDeputy.advisors` cell (B156) — the second thin wrapper over the shared
 * `RelationOptionCell` extracted at B156: chips link to
 * `/campanha/assessores/[id]` (unless read-only), search resolves the eligible
 * staff catalog, and the write sends `stateDeputyId`/`advisorId`/`assigned`
 * through the unrestricted-only membership action. Serves the "Assessores"
 * column of the list and the section of the detail page.
 */
export const StateDeputyAdvisorRelationCell = ({
  stateDeputyId,
  stateDeputyName,
  advisors,
  options,
  membershipAction,
  readOnly = false,
  measureOverflow = true,
}: StateDeputyAdvisorRelationCellProps) => {
  const buildFormData = useCallback(
    (changedIds: number[], assigned: boolean) => {
      const formData = new FormData()
      formData.set('stateDeputyId', String(stateDeputyId))
      formData.set('advisorId', String(changedIds[0]))
      formData.set('assigned', assigned ? 'true' : 'false')
      return formData
    },
    [stateDeputyId],
  )

  return (
    <RelationOptionCell
      ownerId={stateDeputyId}
      ownerName={stateDeputyName}
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
      triggerLabel={`Editar assessores de ${stateDeputyName}`}
      updateErrorMessage={ADVISOR_COPY.updateErrorMessage}
      measureOverflow={measureOverflow}
      readOnly={readOnly}
    />
  )
}
