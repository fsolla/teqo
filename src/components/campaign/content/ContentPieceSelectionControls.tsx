'use client'

import { SquareCheckIcon, XIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { useContentPieceSelection } from '@/components/campaign/content/ContentPieceSelectionProvider'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/Checkbox'
import { cn } from '@/lib/utils'

/**
 * C236 — the affordances of the selection mode (approved design scenes 1–3):
 * the single entry at the top of the list, the mode badge with its exit, the
 * per-row checkboxes of the table and the mobile card frame. All of them are
 * client islands reading the one selection context; the table shell and the
 * card bodies stay server-rendered.
 */

/** The opt-in entry ("Selecionar") and the active-mode chrome of the top of the list. */
export const ContentPieceSelectionModeControl = () => {
  const { selectionMode, enterSelection, exitSelection, pendingAction } = useContentPieceSelection()

  if (!selectionMode) {
    return (
      <div className="mt-4 flex items-center justify-end">
        <Button type="button" variant="outline" className="min-h-11" onClick={enterSelection}>
          <SquareCheckIcon data-icon="inline-start" aria-hidden="true" />
          Selecionar
        </Button>
      </div>
    )
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
        <SquareCheckIcon className="size-3.5" aria-hidden="true" />
        Modo de seleção
      </span>
      <Button
        type="button"
        variant="ghost"
        className="min-h-11 text-muted-foreground hover:text-foreground"
        aria-label="Cancelar seleção"
        disabled={pendingAction !== null}
        onClick={exitSelection}
      >
        <XIcon data-icon="inline-start" aria-hidden="true" />
        <span aria-hidden="true" className="max-sm:hidden">
          Cancelar seleção
        </span>
        <span aria-hidden="true" className="sm:hidden">
          Cancelar
        </span>
      </Button>
    </div>
  )
}

/** The header checkbox: all of the visible page, or none. */
export const ContentPieceSelectAllCheckbox = () => {
  const { allSelected, selectedCount, toggleAll, pendingAction } = useContentPieceSelection()

  return (
    <span className="grid size-9 place-items-center">
      <Checkbox
        checked={allSelected ? true : selectedCount > 0 ? 'indeterminate' : false}
        onCheckedChange={() => toggleAll()}
        disabled={pendingAction !== null}
        aria-label="Selecionar todas as peças desta página"
      />
    </span>
  )
}

/**
 * One table-row checkbox. The wrapper carries `data-selection-state`, which the
 * row's `has-[…]:bg-primary/5` class uses to tint the selected line.
 */
export const ContentPieceRowCheckbox = ({
  contentPieceId,
  title,
}: {
  contentPieceId: number
  title: string
}) => {
  const { isSelected, toggle, pendingAction } = useContentPieceSelection()
  const selected = isSelected(contentPieceId)

  return (
    <span
      className="grid size-9 place-items-center"
      data-selection-state={selected ? 'selected' : undefined}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={() => toggle(contentPieceId)}
        disabled={pendingAction !== null}
        aria-label={`Selecionar ${title}`}
      />
    </span>
  )
}

/**
 * The mobile card frame (design scene 3b): in selection mode the article gains
 * the 44px touch target with the checkbox and the primary ring; outside it the
 * frame renders the exact resting article, so the card look at rest does not
 * depend on this island. `header` is the card's title/meta block (which sits
 * beside the checkbox); children are the rest of the card body.
 */
export const ContentPieceCardSelectionFrame = ({
  contentPieceId,
  title,
  header,
  children,
}: {
  contentPieceId: number
  title: string
  header: ReactNode
  children: ReactNode
}) => {
  const { selectionMode, isSelected, toggle, pendingAction } = useContentPieceSelection()
  const selected = selectionMode && isSelected(contentPieceId)

  if (!selectionMode) {
    return (
      <article className="rounded-xl border bg-card p-4">
        {header}
        {children}
      </article>
    )
  }

  return (
    <article
      className={cn(
        'rounded-xl border border-border bg-card p-4',
        selected && 'ring-1 ring-primary/25',
      )}
    >
      <div className="flex items-start gap-2">
        <span className="grid size-11 shrink-0 place-items-center">
          <Checkbox
            checked={selected}
            onCheckedChange={() => toggle(contentPieceId)}
            disabled={pendingAction !== null}
            aria-label={`Selecionar ${title}`}
          />
        </span>
        <div className="min-w-0 flex-1">{header}</div>
      </div>
      {children}
    </article>
  )
}
