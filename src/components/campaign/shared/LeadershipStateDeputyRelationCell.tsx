'use client'

import { useCallback, useMemo } from 'react'

import type { RelationChipCellCopy } from '@/components/campaign/shared/RelationChipCell'
import {
  RelationOptionCell,
  type RelationCellItem,
  type RelationCellOption,
} from '@/components/campaign/shared/RelationOptionCell'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

export type {
  RelationCellItem,
  RelationCellOption,
} from '@/components/campaign/shared/RelationOptionCell'

type LeadershipStateDeputyRelationDirection = 'fromLeadership' | 'fromStateDeputy'

export type LeadershipStateDeputyRelationCellProps = {
  direction: LeadershipStateDeputyRelationDirection
  fixedId: number
  /** Whose relation this is — spoken in the aria-labels and the Drawer. */
  ownerName: string
  items: RelationCellItem[]
  options: RelationCellOption[]
  membershipAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  /** Clamp rest chips to 3 rows + "Ver mais…". Default true; pass false when few chips are expected. */
  measureOverflow?: boolean
}

const DIRECTION_COPY: Record<
  LeadershipStateDeputyRelationDirection,
  {
    drawerTitle: string
    triggerVerb: string
    emptyDrawerMessage: string
    searchPlaceholder: string
    searchLabel: string
    suggestionsLabel: string
    savingMessage: string
    savedMessage: string
    removedMessage: (count: number) => string
    updateErrorMessage: string
  }
> = {
  fromLeadership: {
    drawerTitle: 'Dobradinhas da liderança',
    triggerVerb: 'dobradinhas',
    emptyDrawerMessage: 'Nenhuma dobradinha vinculada.',
    searchPlaceholder: 'Buscar deputado estadual…',
    searchLabel: 'Buscar deputado estadual',
    suggestionsLabel: 'Sugestões de deputados estaduais',
    savingMessage: 'Salvando dobradinhas.',
    savedMessage: 'Dobradinhas salvas.',
    removedMessage: (count) =>
      count === 1 ? 'Dobradinha removida.' : `${count} dobradinhas removidas.`,
    updateErrorMessage: 'Não foi possível atualizar as dobradinhas. Tente novamente.',
  },
  fromStateDeputy: {
    drawerTitle: 'Lideranças da dobradinha',
    triggerVerb: 'lideranças',
    emptyDrawerMessage: 'Nenhuma liderança vinculada.',
    searchPlaceholder: 'Buscar liderança…',
    searchLabel: 'Buscar liderança',
    suggestionsLabel: 'Sugestões de lideranças',
    savingMessage: 'Salvando lideranças.',
    savedMessage: 'Lideranças salvas.',
    removedMessage: (count) =>
      count === 1 ? 'Liderança removida.' : `${count} lideranças removidas.`,
    updateErrorMessage: 'Não foi possível atualizar as lideranças. Tente novamente.',
  },
}

/**
 * Bidirectional `leadership.stateDeputies` edge (B36), now a thin wrapper over
 * the shared `RelationOptionCell` (extracted at B156). Both directions write
 * `leadershipId`/`stateDeputyId`/`assigned` through the same membership action;
 * every chip is a single item — no batch, no floor/ceiling.
 */
export const LeadershipStateDeputyRelationCell = ({
  direction,
  fixedId,
  ownerName,
  items,
  options,
  membershipAction,
  measureOverflow = true,
}: LeadershipStateDeputyRelationCellProps) => {
  const copy = DIRECTION_COPY[direction]

  const buildFormData = useCallback(
    (changedIds: number[], assigned: boolean) => {
      const itemId = changedIds[0]
      const formData = new FormData()
      if (direction === 'fromLeadership') {
        formData.set('leadershipId', String(fixedId))
        formData.set('stateDeputyId', String(itemId))
      } else {
        formData.set('leadershipId', String(itemId))
        formData.set('stateDeputyId', String(fixedId))
      }
      formData.set('assigned', assigned ? 'true' : 'false')
      return formData
    },
    [direction, fixedId],
  )

  const chipCellCopy = useMemo<RelationChipCellCopy>(
    () => ({
      searchPlaceholder: copy.searchPlaceholder,
      searchLabel: copy.searchLabel,
      suggestionsLabel: copy.suggestionsLabel,
      emptyDrawerMessage: copy.emptyDrawerMessage,
      savingMessage: copy.savingMessage,
      savedMessage: copy.savedMessage,
      removedMessage: copy.removedMessage,
    }),
    [copy],
  )

  return (
    <RelationOptionCell
      ownerId={fixedId}
      ownerName={ownerName}
      items={items}
      options={options}
      buildFormData={buildFormData}
      commitAction={membershipAction}
      copy={chipCellCopy}
      drawerTitle={copy.drawerTitle}
      triggerLabel={`Editar ${copy.triggerVerb} de ${ownerName}`}
      updateErrorMessage={copy.updateErrorMessage}
      measureOverflow={measureOverflow}
    />
  )
}
