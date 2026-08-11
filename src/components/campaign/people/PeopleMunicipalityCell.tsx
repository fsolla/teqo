'use client'

import { useCallback, useRef, useState } from 'react'

import { MunicipalityPortfolioCell } from '@/components/campaign/shared/MunicipalityPortfolioCell'
import {
  buildMunicipalityPortfolioChips,
  type MunicipalityPortfolioIndexEntry,
} from '@/lib/municipalityPortfolio'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

type PeopleMunicipalityCellProps = {
  /** The entity the write targets (`leadership.id`, `stateDeputy.id` or the staff account). */
  ownerId: number | null
  /** Whose relation this is — spoken in the aria-labels and the Drawer. */
  ownerName: string
  municipalityIds: number[]
  municipalityIndex: readonly MunicipalityPortfolioIndexEntry[]
  /** Ids the actor may ADD (administered carteira for an advisor). */
  addableIds?: ReadonlySet<number>
  /** Floor the relation enforces server-side — 1 for `leadership.municipalities`. */
  minItems?: number
  /** Read-only chips (actor may see the relation but not edit it). */
  readOnly?: boolean
  commitAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  drawerTitle: string
  updateErrorMessage: string
}

/**
 * C116 — the people-list municipality columns (Assessora, Lidera, Aliada em):
 * the shared `MunicipalityPortfolioCell` in its `quiet` form (transparent,
 * always-input paradigm) plus the batch-chip expansion state — clicking a
 * territory / "Salvador (19)" chip expands it into its member municipalities
 * IN PLACE, and leaving the cell with the mouse collapses complete batches
 * again. Expansion is local presentation: it never touches the commit cycle.
 */
export const PeopleMunicipalityCell = ({
  ownerId,
  ownerName,
  municipalityIds,
  municipalityIndex,
  addableIds,
  minItems,
  readOnly = false,
  commitAction,
  drawerTitle,
  updateErrorMessage,
}: PeopleMunicipalityCellProps) => {
  const [expandedKeys, setExpandedKeys] = useState<ReadonlySet<string>>(() => new Set())
  const idsRef = useRef(municipalityIds)
  idsRef.current = municipalityIds

  const toggleExpand = useCallback((chipKey: string) => {
    setExpandedKeys((current) => {
      const next = new Set(current)
      if (next.has(chipKey)) next.delete(chipKey)
      else next.add(chipKey)
      return next
    })
  }, [])

  /**
   * Leave-with-mouse collapses the expanded batches whose members are ALL
   * still assigned ("se a pessoa ainda tiver todas as cidades do território,
   * colapsa de novo"). A batch whose member was removed via its chip's X no
   * longer exists as a complete group — the chip builder drops it, so the key
   * falls out here and the members keep rendering individually.
   */
  const handleMouseLeave = useCallback(() => {
    setExpandedKeys((current) => {
      if (current.size === 0) return current
      const chips = buildMunicipalityPortfolioChips(idsRef.current, municipalityIndex)
      const assigned = new Set(idsRef.current)
      let changed = false
      const next = new Set(current)
      for (const key of current) {
        const chip = chips.find((candidate) => candidate.key === key)
        if (!chip || (chip.kind !== 'territory' && chip.kind !== 'city')) continue
        if (chip.municipalityIds.every((id) => assigned.has(id))) {
          next.delete(key)
          changed = true
        }
      }
      return changed ? next : current
    })
  }, [municipalityIndex])

  return (
    <div onMouseLeave={handleMouseLeave}>
      <MunicipalityPortfolioCell
        ownerId={ownerId}
        ownerName={ownerName}
        municipalityIds={municipalityIds}
        municipalityIndex={municipalityIndex}
        addableIds={addableIds}
        minItems={minItems}
        commitAction={commitAction}
        drawerTitle={drawerTitle}
        updateErrorMessage={updateErrorMessage}
        quiet
        expandedKeys={expandedKeys}
        onChipClick={toggleExpand}
        overflowToggleLabel={(count) => `+${count}`}
        readOnly={readOnly}
      />
    </div>
  )
}
