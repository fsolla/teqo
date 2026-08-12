'use client'

import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'

import { getPersonCapacityExitManifestAction } from '@/app/(campaign)/campanha/actions/person'
import { PeopleCapacityExitDialog } from '@/components/campaign/people/PeopleCapacityExitDialog'
import { MunicipalityPortfolioCell } from '@/components/campaign/shared/MunicipalityPortfolioCell'
import {
  buildMunicipalityPortfolioChips,
  type MunicipalityPortfolioIndexEntry,
} from '@/lib/municipalityPortfolio'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import type { PersonCapacityExitManifest } from '@/utilities/people/personCapacityExit'

type PeopleMunicipalityCellProps = {
  /** The entity the write targets (`leadership.id`, `stateDeputy.id` or the staff account). */
  ownerId: number | null
  /** Whose relation this is — spoken in the aria-labels and the Drawer. */
  ownerName: string
  /** C128 — the person ficha; the person-centric server actions resolve by it. */
  contactId: number
  /**
   * C128 — the capacity lifecycle policy of the column: when the LAST
   * municipality leaves, `account` and `leadership` confirm the destructive
   * exit through `PeopleCapacityExitDialog`; `stateDeputy` commits straight
   * (the row cleanup is automatic, no own campaign data — intention rabbit
   * hole). Omit for columns without an entity lifecycle.
   */
  exitMode?: 'account' | 'leadership' | 'stateDeputy'
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

const mapManifestError = (error: unknown): string => {
  const message = error instanceof Error ? error.message : ''
  return message || 'Não foi possível carregar o que será encerrado. Tente de novo.'
}

/**
 * C116/C128 — the people-list municipality columns (Assessora, Lidera, Aliada
 * em): the shared `MunicipalityPortfolioCell` in its `quiet` form (transparent,
 * always-input paradigm) plus the batch-chip expansion state — clicking a
 * territory / "Salvador (19)" chip expands it into its member municipalities
 * IN PLACE, and leaving the cell with the mouse collapses complete batches
 * again. Expansion is local presentation: it never touches the commit cycle.
 *
 * C128 — the destructive exit: when a removal would EMPTY the relation, the
 * commit is paused by `commitGuard` and, for `account`/`leadership`, the
 * confirmation dialog lists the manifest before the commit proceeds. The
 * entity (staff account / leadership / dobradinha) is created or deleted by
 * the person-centric server action; the cell commits even with a `null` owner
 * (the entity does not exist yet).
 */
export const PeopleMunicipalityCell = ({
  ownerId,
  ownerName,
  contactId,
  exitMode,
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

  /** The pending destructive exit: the dialog is up, the commit waits for it. */
  const [exitRequest, setExitRequest] = useState<PersonCapacityExitManifest | null>(null)
  const exitResolverRef = useRef<((confirmed: boolean) => void) | null>(null)

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

  /**
   * C128 — the destructive-exit guard, wired into `RelationChipCell` BEFORE
   * the optimistic apply: a removal that empties the relation pauses the
   * commit and (for account/leadership) asks the manifest-backed dialog.
   * Fail-closed: a manifest error aborts the commit — nothing is ever deleted
   * without an explicit confirmation.
   */
  const commitGuard = useCallback(
    async (delta: { changedIds: number[]; assigned: boolean; currentIds: number[] }) => {
      if (!exitMode || delta.assigned) return true
      const remaining = delta.currentIds.filter((id) => !delta.changedIds.includes(id))
      if (remaining.length > 0) return true

      // The dobradinha carries no campaign data of its own beyond the row —
      // the cleanup is automatic (intention rabbit hole), no dialog.
      if (exitMode === 'stateDeputy') return true

      // A second guard while one dialog is already pending is refused: the
      // pending commit must resolve first.
      if (exitResolverRef.current) return false

      let manifest: PersonCapacityExitManifest | null
      try {
        manifest = await getPersonCapacityExitManifestAction({
          capacity: exitMode,
          contactId,
        })
      } catch (error) {
        toast.error(mapManifestError(error))
        return false
      }
      // Nothing to destroy (no entity) — the server no-ops the removal.
      if (manifest === null) return true
      // A leadership with no declared votes and no invites dies silently —
      // there is nothing of its own to lose (intention: "com confirmação se
      // houver votos declarados").
      if (manifest.capacity === 'leadership') {
        if (manifest.declaredVoteCount === 0 && manifest.inviteCount === 0) return true
      }

      return new Promise<boolean>((resolve) => {
        exitResolverRef.current = resolve
        setExitRequest(manifest)
      })
    },
    [exitMode, contactId],
  )

  const resolveExit = useCallback((confirmed: boolean) => {
    exitResolverRef.current?.(confirmed)
    exitResolverRef.current = null
    setExitRequest(null)
  }, [])

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
        extraFormFields={{ contactId }}
        commitWithNullOwner
        commitGuard={exitMode ? commitGuard : undefined}
      />
      {exitRequest ? (
        <PeopleCapacityExitDialog
          open
          personName={ownerName}
          manifest={exitRequest}
          onConfirm={() => resolveExit(true)}
          onCancel={() => resolveExit(false)}
        />
      ) : null}
    </div>
  )
}
