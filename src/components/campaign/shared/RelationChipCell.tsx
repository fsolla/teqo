'use client'

import { XIcon } from 'lucide-react'
import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'

import { CampaignCellEditOverlay } from '@/components/campaign/shared/CampaignCellEditOverlay'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/Popover'
import { sameIdSet } from '@/lib/sameIdSet'
import { cn } from '@/lib/utils'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { firstFormActionMessage } from '@/utilities/campaignFormFields'

const COLLAPSED_CHIP_ROWS = 3
/** Matches `gap-1.5` on the chip row, and `max-h-18` (72px) is this math at a 20px chip. */
const CHIP_GAP_PX = 6

const resultsMessage = (count: number): string => {
  if (count === 0) return 'Nenhum resultado.'
  return count === 1 ? '1 resultado.' : `${count} resultados.`
}

const withDelta = (
  base: readonly number[],
  changedIds: readonly number[],
  assigned: boolean,
): number[] => {
  const next = new Set(base)
  for (const id of changedIds) {
    if (assigned) next.add(id)
    else next.delete(id)
  }
  return [...next]
}

type SuggestionSurface = 'inline' | 'drawer'

export type RelationChip = {
  key: string
  label: string
  /** Omit for a chip that is not a link (e.g. a batch/territory chip). */
  href?: string
  /** Rendered before the label, e.g. a territory pin. */
  icon?: ReactNode
  /** Rendered after the label as a small muted count. */
  trailingLabel?: string
  /** Ids removing (or re-adding, on undo) this chip touches — usually one. */
  ids: number[]
  /** Appended to the label in the remove control's aria-label, e.g. ` — 2 municípios`. */
  removalSuffix?: string
}

export type RelationSearchHit = {
  key: string
  label: string
  /** Second line under the suggestion. Omit for a flat, single-line list. */
  description?: string
  ids: number[]
}

export type RelationChipCellCopy = {
  searchPlaceholder: string
  searchLabel: string
  suggestionsLabel: string
  emptyDrawerMessage: string
  savingMessage: string
  savedMessage: string
  removedMessage: (count: number) => string
  /** Only invoked when `minItems` is actually configured. */
  floorMessage?: (min: number) => string
  /** Only invoked when `maxItems` is actually configured. */
  capMessage?: (max: number) => string
}

type RelationChipCellProps = {
  /** `null` in draft mode (a row that does not exist yet). */
  ownerId: number | null
  /** Whose relation this is — spoken in the aria-labels and the Drawer description. */
  ownerName: string
  ids: number[]
  buildChips: (ids: number[]) => RelationChip[]
  searchHits: (query: string, assignedIds: ReadonlySet<number>) => RelationSearchHit[]
  /** Floor the relation enforces server-side. */
  minItems?: number
  /**
   * Ceiling the relation enforces server-side. Checked here so a batch that would
   * blow the cap is refused with the reason BEFORE the optimistic apply — the
   * server rejection would otherwise revert a whole batch with a message that
   * never says which limit was hit.
   */
  maxItems?: number
  /** Draft mode (new row): keep changes local and report them upward. */
  draft?: boolean
  onDraftChange?: (ids: number[]) => void
  buildFormData: (changedIds: number[], assigned: boolean) => FormData
  commitAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  drawerTitle: string
  /** Full aria-label for the coarse-pointer, cell-wide Drawer trigger. */
  triggerLabel: string
  updateErrorMessage: string
  copy: RelationChipCellCopy
  /** Clamp rest chips to 3 rows + "Ver mais…". Default true; pass false when few chips are expected. */
  measureOverflow?: boolean
}

/**
 * Shared interaction machine behind every bounded-set relation edited by chips
 * (município portfolios, leadership↔dobradinha membership): optimistic delta
 * commits that survive concurrent toggles, an undo toast scoped to exactly what
 * changed, an ARIA 1.2 combobox for search/suggestions, a floor/ceiling refused
 * with a spoken reason before the optimistic apply, and a pointer-fine inline
 * editor / pointer-coarse Drawer split. What differs between relations — chip
 * content, search, the write's field names, copy — is entirely prop-driven;
 * nothing domain-specific lives here.
 */
export const RelationChipCell = ({
  ownerId,
  ownerName,
  ids,
  buildChips,
  searchHits,
  minItems = 0,
  maxItems,
  draft = false,
  onDraftChange,
  buildFormData,
  commitAction,
  drawerTitle,
  triggerLabel,
  updateErrorMessage,
  copy,
  measureOverflow = true,
}: RelationChipCellProps) => {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [optimistic, setOptimistic] = useState<number[] | null>(null)
  const [expanded, setExpanded] = useState(false)
  /** `null` means "render every chip so the next effect can measure them". */
  const [visibleChipCount, setVisibleChipCount] = useState<number | null>(null)
  const [measureToken, setMeasureToken] = useState(0)
  const lastRowWidth = useRef(0)
  const [isPending, startTransition] = useTransition()
  const [feedback, setFeedback] = useState<
    { kind: 'saved' } | { kind: 'error'; message: string } | null
  >(null)
  /** Active suggestion (ARIA 1.2 combobox): index 0 is pre-selected, so Enter always picks. */
  const [activeIndex, setActiveIndex] = useState(0)
  /** Only keyboard movement should scroll: the mouse is already where it points. */
  const activeFromKeyboard = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const chipRowRef = useRef<HTMLDivElement>(null)
  /** Blur debounce — cleared on unmount so setState cannot fire after jsdom teardown (CI flake). */
  const blurCloseTimeoutRef = useRef<number | null>(null)
  const baseId = useId()
  const listboxId = (surface: SuggestionSurface) => `${baseId}-${surface}-listbox`
  const optionId = useCallback(
    (surface: SuggestionSurface, index: number) => `${baseId}-${surface}-option-${index}`,
    [baseId],
  )

  useEffect(() => {
    return () => {
      if (blurCloseTimeoutRef.current != null) {
        window.clearTimeout(blurCloseTimeoutRef.current)
        blurCloseTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    setOptimistic((current) => {
      if (!current) return null
      return sameIdSet(current, ids) ? null : current
    })
  }, [ids])

  const effectiveIds = optimistic ?? ids

  /**
   * The baseline a deferred delta falls back to, which cannot be the render's
   * `ids`: the toast's "Desfazer" outlives the render that created it, and by
   * the time it fires the optimistic value has usually reconciled to null — so
   * the functional updater takes the fallback branch and would rebuild the row
   * from a set that predates every edit made since. That divergence is
   * permanent, because the reconcile effect above only clears on an exact match.
   */
  const latestIds = useRef(ids)
  useEffect(() => {
    latestIds.current = effectiveIds
  }, [effectiveIds])

  const assignedIds = useMemo(() => new Set(effectiveIds), [effectiveIds])
  const chips = useMemo(() => buildChips(effectiveIds), [effectiveIds, buildChips])

  const searching = query.trim().length > 0
  /**
   * Per surface, because Radix can close the popover with text still in the
   * input — and because the inline list is PORTALED, so `pointer-coarse:hidden`
   * on the cell would not hide it while the Drawer is up.
   */
  const inlineSuggesting = searching && open && !drawerOpen
  const drawerSuggesting = searching && drawerOpen
  const suggesting = inlineSuggesting || drawerSuggesting
  const hits = useMemo(
    () => (suggesting ? searchHits(query, assignedIds) : []),
    [suggesting, query, searchHits, assignedIds],
  )

  const hitsKey = hits.map((hit) => hit.key).join('|')
  useEffect(() => {
    setActiveIndex(0)
  }, [hitsKey])

  const activeSurface: SuggestionSurface = drawerOpen ? 'drawer' : 'inline'
  useEffect(() => {
    if (!activeFromKeyboard.current) return
    document.getElementById(optionId(activeSurface, activeIndex))?.scrollIntoView({
      block: 'nearest',
    })
  }, [activeIndex, activeSurface, optionId])

  /**
   * The token is what makes a stale measurement recoverable: an invalidation
   * batched with a measurement would otherwise settle back on `null` without
   * changing any dependency, leaving the cell unmeasured forever.
   */
  const invalidateMeasurement = useCallback(() => {
    setVisibleChipCount(null)
    setMeasureToken((token) => token + 1)
  }, [])

  // Keyed by content, not array identity: a re-render that rebuilds the same
  // chips must not throw away a measurement that is still valid. The remove
  // button is absolutely positioned, so revealing it never changes a chip's box.
  const chipsKey = chips.map((chip) => chip.key).join('|')
  useEffect(() => {
    if (!measureOverflow) return
    invalidateMeasurement()
  }, [chipsKey, measureOverflow, invalidateMeasurement])

  useEffect(() => {
    if (!measureOverflow) return
    const row = chipRowRef.current
    if (!row) return
    // Seeded here so the observer's initial callback isn't read as a resize.
    lastRowWidth.current = row.clientWidth
    const observer = new ResizeObserver(() => {
      if (row.clientWidth === lastRowWidth.current) return
      lastRowWidth.current = row.clientWidth
      invalidateMeasurement()
    })
    observer.observe(row)
    return () => observer.disconnect()
  }, [measureOverflow, invalidateMeasurement])

  /**
   * Runs on the frames where every chip is in the DOM, so the packing of the
   * three visible rows — and the room the toggle needs on the third one — is
   * read from the real layout instead of estimated from label lengths.
   */
  useEffect(() => {
    if (!measureOverflow) return
    if (visibleChipCount !== null) return
    const row = chipRowRef.current
    if (!row) return

    const chipElements = [...row.querySelectorAll<HTMLElement>('[data-relation-chip]')]
    if (chipElements.length === 0) {
      setVisibleChipCount(0)
      return
    }

    const rowRect = row.getBoundingClientRect()
    const chipRects = chipElements.map((element) => element.getBoundingClientRect())
    const lastVisibleTop =
      chipRects[0].top + (chipRects[0].height + CHIP_GAP_PX) * (COLLAPSED_CHIP_ROWS - 1)
    let fitting = chipRects.filter((rect) => rect.top <= lastVisibleTop + 1).length

    // The toggle — and the search input — must share the last visible line,
    // otherwise they wrap into a line nobody asked for. The input's box is read
    // as its `min-width`, not its rect: `flex-1` makes the rendered width the
    // leftover of the row, which would reserve the whole line. A zero-width
    // rect means the input is `display: none` (coarse pointer), where the row
    // has no trailing control to make room for at all.
    const toggleWidth =
      row.querySelector<HTMLElement>('[data-relation-toggle]')?.getBoundingClientRect().width ?? 0
    const inputElement = inputRef.current
    const inputWidth =
      inputElement && inputElement.getBoundingClientRect().width > 0
        ? Number.parseFloat(getComputedStyle(inputElement).minWidth) || 0
        : 0
    const trailingWidth = toggleWidth + CHIP_GAP_PX + inputWidth
    while (fitting > 0 && fitting < chipElements.length) {
      const trailing = chipRects[fitting - 1]
      if (trailing.right + CHIP_GAP_PX + trailingWidth <= rowRect.right) break
      fitting -= 1
    }

    setVisibleChipCount(fitting)
  }, [measureOverflow, measureToken, visibleChipCount])

  /**
   * Every delta is applied functionally, forward and back: two chips toggled in
   * the same burst — or an "Desfazer" pressed after a later add — would otherwise
   * each compute from the set their own render captured and drop the other's work.
   */
  const commit = (changedIds: number[], assigned: boolean) => {
    if (changedIds.length === 0) return

    if (draft) {
      // Advanced synchronously as well: the parent holds the draft in state, so
      // two toggles batched into one tick would otherwise both read the prop of
      // the render they were queued from and the second would drop the first.
      const next = withDelta(latestIds.current, changedIds, assigned)
      latestIds.current = next
      onDraftChange?.(next)
    } else {
      setOptimistic((current) => withDelta(current ?? latestIds.current, changedIds, assigned))
    }
    setQuery('')
    setOpen(false)
    setFeedback(null)

    if (draft) return
    if (ownerId === null) return

    const formData = buildFormData(changedIds, assigned)

    startTransition(async () => {
      const result = await commitAction({}, formData)
      if (result.status === 'success') {
        setFeedback({ kind: 'saved' })
        // A batch removal drops several links in one tap, and the row it left
        // behind carries no trace of what was there. Single removals are one
        // search away from being restored and get no toast.
        if (!assigned && changedIds.length > 1) {
          toast.success(copy.removedMessage(changedIds.length), {
            action: { label: 'Desfazer', onClick: () => commit(changedIds, true) },
          })
        }
        return
      }
      // Undo only THIS delta: reverting to the server baseline would also wipe
      // a sibling toggle from the same burst that already saved.
      setOptimistic((current) => withDelta(current ?? latestIds.current, changedIds, !assigned))
      const message = firstFormActionMessage(result) ?? updateErrorMessage
      setFeedback({ kind: 'error', message })
      toast.error(message)
    })
  }

  /** The relation's floor, refused here so the server never has to say no. */
  const removalFloorReason = (chip: RelationChip): string | null =>
    assignedIds.size - chip.ids.length < minItems
      ? (copy.floorMessage ?? ((min) => `${ownerName} precisa de pelo menos ${min}.`))(minItems)
      : null

  const additionCapReason = (additions: number[]): string | null =>
    maxItems !== undefined && assignedIds.size + additions.length > maxItems
      ? (copy.capMessage ?? ((max) => `${ownerName} aceita no máximo ${max}.`))(maxItems)
      : null

  const chipRemoveLabel = (chip: RelationChip, floorReason: string | null): string =>
    floorReason
      ? `${floorReason} — não é possível remover ${chip.label}`
      : `Remover ${chip.label}${chip.removalSuffix ?? ''}`

  /**
   * Refusals explain themselves on attempt instead of going silent: the control
   * keeps `aria-disabled` (so it stays in the tab order and can still be
   * activated) rather than `disabled`, which would hide the only copy of the
   * reason from every keyboard user.
   */
  const attemptRemove = (chip: RelationChip) => {
    const floorReason = removalFloorReason(chip)
    if (floorReason) {
      toast.error(`${floorReason}.`)
      return
    }
    commit(chip.ids, false)
  }

  const pickHit = (hit: RelationSearchHit) => {
    const capReason = additionCapReason(hit.ids)
    if (capReason) {
      toast.error(capReason)
      return
    }
    commit(hit.ids, true)
  }

  const closeSuggestions = () => {
    setOpen(false)
    setQuery('')
  }

  /**
   * ARIA 1.2 combobox keyboard contract, shared by the inline input and the
   * Drawer's: Up/Down/Home/End move the active option, Enter picks it, Escape
   * abandons the search. Without it the suggestions are mouse-only.
   *
   * Kept by hand, against B34+ F5's recommendation to adopt `ui/combobox.tsx`.
   * Two reasons the base-ui `Combobox` cannot take this shape: its `Root` owns
   * exactly ONE input, and this cell has two live at once (the inline row and
   * the Drawer's) driving one set of hits — two Roots would mean a second copy
   * of the state this file has already been bitten by twice; and its `Root` is
   * a value-selection widget, while this one holds no value at all — picking a
   * hit fires a write and clears the query. What it would remove is this
   * handler plus the aria wiring, ~45 lines, in exchange for syncing two
   * external stores back into the cell. `anchor`/`data-chips` do fit, and
   * remain the right call for a chip picker that does hold a value.
   */
  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (hits.length === 0) return
      event.preventDefault()
      const delta = event.key === 'ArrowDown' ? 1 : -1
      activeFromKeyboard.current = true
      setActiveIndex((current) => (current + delta + hits.length) % hits.length)
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      if (hits.length === 0) return
      event.preventDefault()
      activeFromKeyboard.current = true
      setActiveIndex(event.key === 'Home' ? 0 : hits.length - 1)
      return
    }
    if (event.key === 'Enter') {
      const hit = hits[activeIndex]
      if (!hit) return
      event.preventDefault()
      pickHit(hit)
      return
    }
    if (event.key === 'Escape') {
      if (drawerOpen) {
        setQuery('')
        return
      }
      closeSuggestions()
      inputRef.current?.blur()
    }
  }

  // Editing needs every chip reachable, so focusing the cell always expands it.
  const showAllChips = !measureOverflow || expanded || open
  const measuring = measureOverflow && visibleChipCount === null
  const hasHiddenChips =
    measureOverflow && visibleChipCount !== null && visibleChipCount < chips.length
  const visibleChips =
    !measureOverflow || showAllChips || measuring || visibleChipCount === null
      ? chips
      : chips.slice(0, visibleChipCount)
  /**
   * Only the pre-measurement render needs a height cap; once the chip list is
   * trimmed the row is three lines tall on its own, and capping it again would
   * clip whatever shares the last line (the search input is taller than a chip).
   */
  const clamping = measuring && !showAllChips

  /**
   * One region, four things to say, in this order: a save in flight outranks
   * everything; a failure outranks the search; and the search outranks a past
   * success, otherwise the saved message would shadow every later result count
   * for the rest of the session.
   */
  const statusMessage = isPending
    ? copy.savingMessage
    : feedback?.kind === 'error'
      ? feedback.message
      : suggesting
        ? resultsMessage(hits.length)
        : feedback?.kind === 'saved'
          ? copy.savedMessage
          : ''

  /**
   * Mounted while measuring so its width is reserved on the last line, but kept
   * out of the tab order and the accessibility tree until the overflow it
   * announces is known. On a coarse pointer the cell-wide Drawer trigger sits
   * above it, so a tap opens the full list instead of expanding in place.
   */
  const expandToggle =
    measureOverflow && (measuring || hasHiddenChips) ? (
      <button
        type="button"
        data-relation-toggle
        tabIndex={measuring ? -1 : undefined}
        aria-hidden={measuring || undefined}
        className={cn(
          // `min-h-6`: 24px is the SC 2.5.8 target floor for a text button.
          'inline-flex min-h-6 items-center px-1 text-xs font-medium text-primary underline-offset-4 hover:underline',
          measuring && 'invisible pointer-events-none',
        )}
        onClick={(event) => {
          event.stopPropagation()
          const next = !showAllChips
          setExpanded(next)
          // Focus is what keeps the cell open — collapsing must release it.
          if (!next) {
            setOpen(false)
            inputRef.current?.blur()
          }
        }}
      >
        {showAllChips ? 'Ver menos' : 'Ver mais…'}
      </button>
    ) : null

  const chipBody = (chip: RelationChip) => (
    <>
      {chip.icon}
      <span className="truncate">{chip.label}</span>
      {chip.trailingLabel !== undefined ? (
        <span className="shrink-0 text-xs tabular-nums opacity-70">{chip.trailingLabel}</span>
      ) : null}
    </>
  )

  /**
   * The remove button is a sibling of the chip link (never nested in it) and sits
   * absolutely on its corner, so revealing it on hover does not resize the chip
   * or move the row. The `before:` box grows the pointer target to 24×24 (WCAG
   * 2.2 SC 2.5.8) without growing the 16px circle over a 20px chip. Fine
   * pointers only: on touch the whole cell opens the Drawer, where the same "×"
   * is permanently visible at a real tap size.
   */
  const inlineChip = (chip: RelationChip) => {
    const floorReason = removalFloorReason(chip)
    return (
      <span
        key={chip.key}
        data-relation-chip
        className="group/chip relative inline-flex max-w-full"
      >
        {chip.href ? (
          <Badge variant="secondary" className="max-w-full font-normal" asChild>
            <Link href={chip.href} className="truncate underline-offset-4 hover:underline">
              {chipBody(chip)}
            </Link>
          </Badge>
        ) : (
          <Badge variant="secondary" className="max-w-full gap-1 font-normal">
            {chipBody(chip)}
          </Badge>
        )}
        <button
          type="button"
          data-chip-remove
          aria-disabled={floorReason !== null || undefined}
          aria-label={chipRemoveLabel(chip, floorReason)}
          className={cn(
            // `border-muted-foreground/70`: the default 12%-alpha `border` token
            // does not reach 3:1 against a `secondary` chip (SC 1.4.11).
            'absolute -top-1 -right-1 hidden size-4 place-items-center rounded-full border border-muted-foreground/70 bg-background text-muted-foreground opacity-0 transition-opacity pointer-fine:grid',
            "before:absolute before:-inset-1 before:content-['']",
            'group-hover/chip:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
            floorReason
              ? 'cursor-not-allowed'
              : 'hover:border-destructive hover:bg-destructive/10 hover:text-destructive hover:opacity-100',
          )}
          onClick={(event) => {
            event.stopPropagation()
            attemptRemove(chip)
          }}
        >
          <XIcon className="size-2.5" aria-hidden="true" />
        </button>
      </span>
    )
  }

  const suggestionOption = (hit: RelationSearchHit, index: number, surface: SuggestionSurface) => {
    const capped = additionCapReason(hit.ids) !== null
    const active = index === activeIndex
    return (
      <button
        key={hit.key}
        id={optionId(surface, index)}
        type="button"
        role="option"
        aria-selected={active}
        aria-disabled={capped || undefined}
        tabIndex={-1}
        className={cn(
          'flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm',
          active && 'bg-muted',
          capped ? 'opacity-60' : 'hover:bg-muted',
        )}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={() => {
          activeFromKeyboard.current = false
          setActiveIndex(index)
        }}
        onClick={() => pickHit(hit)}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{hit.label}</span>
          {hit.description ? (
            <span className="block text-xs text-muted-foreground">
              {hit.description}
              {capped ? ' · excede o limite' : ''}
            </span>
          ) : null}
        </span>
      </button>
    )
  }

  /**
   * The listbox stays mounted while empty (the input's `aria-controls` must
   * resolve) and the "no results" copy sits OUTSIDE it — inside, a screen
   * reader would count it as a selectable option.
   */
  const suggestionList = (surface: SuggestionSurface) => (
    <>
      <div role="listbox" id={listboxId(surface)} aria-label={copy.suggestionsLabel}>
        {hits.map((hit, index) => suggestionOption(hit, index, surface))}
      </div>
      {hits.length === 0 ? (
        <p className="px-2 py-2 text-sm text-muted-foreground">Nenhum resultado.</p>
      ) : null}
    </>
  )

  const activeOptionId = hits.length > 0 ? optionId(activeSurface, activeIndex) : undefined

  return (
    <div
      ref={rootRef}
      // `aria-busy` + the dimmed row are the only feedback a saved chip gets:
      // the write is fire-and-forget, and a cell that never reacts reads as
      // "nothing happened" until the next navigation proves otherwise.
      aria-busy={isPending || undefined}
      // Same box in both pointer modes so nothing reflows when the row is touched.
      className="relative min-w-56 rounded-md border border-transparent p-1 outline-none pointer-fine:hover:bg-muted/40 pointer-fine:focus-within:bg-muted/40"
      // Reached only on a fine pointer: the coarse overlay below covers the cell
      // and stops the click, so the pointer policy stays in the media queries.
      onClick={(event) => {
        const target = event.target as HTMLElement
        if (target.closest('[data-chip-remove]') || target.closest('a')) return
        inputRef.current?.focus()
        setOpen(true)
      }}
    >
      <Popover open={inlineSuggesting} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div
            ref={chipRowRef}
            className={cn(
              'flex min-h-8 flex-wrap items-center gap-1.5',
              clamping && 'max-h-18 overflow-hidden',
              isPending && 'opacity-60 transition-opacity',
            )}
          >
            {chips.length === 0 && !searching ? (
              <span className="px-1 text-sm text-muted-foreground pointer-fine:hidden">—</span>
            ) : null}
            {visibleChips.map(inlineChip)}
            {expandToggle}
            <input
              ref={inputRef}
              value={query}
              role="combobox"
              aria-expanded={inlineSuggesting}
              // Only while expanded: the listbox lives inside the Popover, which
              // Radix unmounts on close, so an unconditional `aria-controls`
              // points at an id that is not in the document.
              aria-controls={inlineSuggesting ? listboxId('inline') : undefined}
              aria-autocomplete="list"
              aria-activedescendant={inlineSuggesting ? activeOptionId : undefined}
              onChange={(event) => {
                setQuery(event.currentTarget.value)
                setFeedback(null)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => {
                if (blurCloseTimeoutRef.current != null) {
                  window.clearTimeout(blurCloseTimeoutRef.current)
                }
                blurCloseTimeoutRef.current = window.setTimeout(() => {
                  blurCloseTimeoutRef.current = null
                  if (!rootRef.current?.contains(document.activeElement)) {
                    closeSuggestions()
                  }
                }, 120)
              }}
              onKeyDown={onSearchKeyDown}
              placeholder={chips.length ? 'Adicionar…' : copy.searchPlaceholder}
              aria-label={copy.searchLabel}
              className="hidden min-h-8 min-w-32 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground pointer-fine:block"
            />
          </div>
        </PopoverAnchor>
        {/* Portaled: the table's scroll container would clip an in-flow listbox. */}
        <PopoverContent
          align="start"
          className="max-h-64 w-(--radix-popover-trigger-width) overflow-auto p-1"
          // The input owns focus the whole time — the list is a suggestion
          // surface, not a dialog, and must never steal or restore focus.
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
        >
          {suggestionList('inline')}
        </PopoverContent>
      </Popover>

      {/*
       * Coarse pointer: the cell is one big trigger, because a thumb scrolling a
       * table cannot be asked to tell "open the entity" from "delete it". The
       * links it covers come back inside the Drawer.
       *
       * `variant` is hardcoded because the container takes its policy from the
       * call site (B42) — and here the policy is the `pointer:` media query on
       * the trigger, not the viewport, so a touch laptop gets this sheet and a
       * tablet with a mouse gets the inline editor above. `hover:bg-transparent`
       * undoes the shared class's hover: this trigger is an invisible pane over
       * the whole cell, and tinting it would tint the chips it covers.
       */}
      <CampaignCellEditOverlay
        variant="sheet"
        open={drawerOpen}
        // The container's trigger lets the click bubble to the cell root, which
        // opens the inline suggestions — harmless while the sheet is up, but it
        // would surface a portaled listbox on a touch device the moment the
        // sheet closed. Clearing the search on close settles both.
        //
        // Guarded on the sheet having actually been open: a closed Drawer still
        // reports `onOpenChange(false)` when a dismiss elsewhere on the page
        // sweeps the layer stack, and unguarded this erased whatever the fine
        // pointer had typed into the inline input.
        onOpenChange={(next) => {
          setDrawerOpen(next)
          if (!next && drawerOpen) closeSuggestions()
        }}
        title={drawerTitle}
        description={ownerName}
        trigger={null}
        triggerLabel={triggerLabel}
        triggerClassName="absolute inset-0 hover:bg-transparent pointer-fine:hidden"
        triggerBusy={isPending}
        sheetBodyClassName="gap-3"
      >
        {/*
         * Rendered unmounted, like the repo's other in-cell sheets: base-ui
         * keeps the popup mounted through a ~450 ms exit transition, so gating
         * this on `drawerOpen` animated an empty collapsing box out of view. The
         * allocation it saved was measured and is not a cost — the closed portal
         * emits no DOM, and the class string is a tailwind-merge cache hit.
         */}
        <>
          {chips.length === 0 ? (
            <p className="text-sm text-muted-foreground">{copy.emptyDrawerMessage}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {chips.map((chip) => {
                const floorReason = removalFloorReason(chip)
                return (
                  <li
                    key={chip.key}
                    className="flex min-h-11 items-center justify-between gap-2 rounded-md border px-2"
                  >
                    {chip.href ? (
                      <Link
                        href={chip.href}
                        className="flex min-h-11 min-w-0 flex-1 items-center underline-offset-4 hover:underline"
                      >
                        <Badge variant="secondary" className="min-w-0 font-normal">
                          {chipBody(chip)}
                        </Badge>
                      </Link>
                    ) : (
                      <Badge variant="secondary" className="min-w-0 gap-1 font-normal">
                        {chipBody(chip)}
                      </Badge>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className={cn('size-11 shrink-0', floorReason && 'opacity-50')}
                      aria-disabled={floorReason !== null || undefined}
                      aria-label={chipRemoveLabel(chip, floorReason)}
                      onClick={() => attemptRemove(chip)}
                    >
                      <XIcon className="size-4" aria-hidden="true" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
          <Input
            value={query}
            role="combobox"
            aria-expanded={drawerSuggesting}
            // Same as the inline input: the drawer list is only rendered while
            // searching, so a permanent `aria-controls` would dangle.
            aria-controls={drawerSuggesting ? listboxId('drawer') : undefined}
            aria-autocomplete="list"
            aria-activedescendant={drawerSuggesting ? activeOptionId : undefined}
            onChange={(event) => {
              setQuery(event.currentTarget.value)
              setFeedback(null)
            }}
            onKeyDown={onSearchKeyDown}
            placeholder={copy.searchPlaceholder}
            aria-label={copy.searchLabel}
            className="min-h-11"
          />
          {searching ? <div className="flex flex-col gap-1">{suggestionList('drawer')}</div> : null}
        </>
      </CampaignCellEditOverlay>

      <p className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </p>
    </div>
  )
}
