'use client'

import { useCallback } from 'react'

import type { RelationChipCellCopy } from '@/components/campaign/shared/RelationChipCell'
import {
  RelationOptionCell,
  type RelationCellOption,
} from '@/components/campaign/shared/RelationOptionCell'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

const ASSESSORADO_COPY: RelationChipCellCopy = {
  searchPlaceholder: 'Buscar assessor…',
  searchLabel: 'Buscar assessor',
  suggestionsLabel: 'Sugestões de assessores',
  emptyDrawerMessage: 'Nenhum assessor vinculado.',
  savingMessage: 'Salvando assessores…',
  savedMessage: 'Assessores salvos.',
  removedMessage: (count: number) =>
    count === 1 ? 'Assessor removido.' : `${count} assessores removidos.`,
}

type PeopleAssessoradoCellProps = {
  /** The person (`contactID`) — the write is person-centric, not per entity. */
  ownerId: number | null
  ownerName: string
  /** Assigned advisors, names resolved server-side (union of the person's entities). */
  assessorados: Array<{ id: number; name: string }>
  /** The addable staff catalog (`loadEligibleAdvisorOptions`). Empty when read-only. */
  options: RelationCellOption[]
  commitAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  /**
   * Read-only for staff who may see but not assign (B156 rule): linked chips
   * lose their href — `/campanha/assessores/[id]` is unrestricted-only.
   */
  readOnly?: boolean
}

/**
 * C116 — the "Assessorado" column of `/campanha/pessoas`: the union of the
 * person's advisor links (leadership + dobradinha), edited person-centrically —
 * the commit writes the advisor delta on EVERY entity the person has, in one
 * transaction. Same `RelationOptionCell` machine as the C99/B156 advisor cells,
 * in the `quiet` transparent form.
 */
export const PeopleAssessoradoCell = ({
  ownerId,
  ownerName,
  assessorados,
  options,
  commitAction,
  readOnly = false,
}: PeopleAssessoradoCellProps) => {
  const buildFormData = useCallback(
    (changedIds: number[], assigned: boolean) => {
      const formData = new FormData()
      formData.set('contactId', String(ownerId))
      formData.set('advisorId', String(changedIds[0]))
      formData.set('assigned', assigned ? 'true' : 'false')
      return formData
    },
    [ownerId],
  )

  return (
    <RelationOptionCell
      ownerId={ownerId}
      ownerName={ownerName}
      items={assessorados.map((advisor) => ({
        id: advisor.id,
        label: advisor.name,
        ...(readOnly ? {} : { href: `/campanha/assessores/${advisor.id}` }),
      }))}
      options={options}
      buildFormData={buildFormData}
      commitAction={commitAction}
      copy={ASSESSORADO_COPY}
      drawerTitle="Assessores da pessoa"
      triggerLabel={`Editar assessores de ${ownerName}`}
      updateErrorMessage="Não foi possível atualizar os assessores. Tente novamente."
      readOnly={readOnly}
      quiet
      overflowToggleLabel={(count) => `+${count}`}
    />
  )
}
