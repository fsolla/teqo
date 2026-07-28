'use client'

import { MapPinIcon, XIcon } from 'lucide-react'
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
} from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/Popover'
import {
  buildMunicipalityPortfolioChips,
  searchMunicipalityPortfolio,
  type MunicipalityPortfolioChip,
  type MunicipalityPortfolioIndexEntry,
  type MunicipalityPortfolioSearchHit,
} from '@/lib/municipalityPortfolio'
import { sameIdSet } from '@/lib/sameIdSet'
import { cn } from '@/lib/utils'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

const COLLAPSED_CHIP_ROWS = 3
/** Matches `gap-1.5` on the chip row, and `max-h-18` (72px) is this math at a 20px chip. */
const CHIP_GAP_PX = 6

const SEARCH_PLACEHOLDER = 'Buscar município, território ou ZE…'
const SEARCH_LABEL = 'Buscar município, território de identidade ou zona eleitoral'
/** Distinct from `SEARCH_LABEL`: two controls must not share one accessible name. */
const SUGGESTIONS_LABEL = 'Sugestões de municípios'

const hitDescription = (hit: MunicipalityPortfolioSearchHit): string => {
  if (hit.kind === 'municipality') return 'Município'
  if (hit.kind === 'territory') return `Território · ${hit.count} municípios`
  return `Zona eleitoral · ${hit.count} municípios`
}

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

type MunicipalityPortfolioCellProps = {
  /** `null` in draft mode (a row that does not exist yet). */
  ownerId: number | null
  /** Whose portfolio this is — spoken in the aria-labels and the Drawer. */
  ownerName: string
  municipalityIds: number[]
  municipalityIndex: readonly MunicipalityPortfolioIndexEntry[]
  /**
   * Ids the actor may ADD. Omit for "the whole catalog". Chips always render from
   * the full index: an advisor must see (and be able to drop) a link outside
   * their portfolio, they just cannot create one.
   */
  addableIds?: ReadonlySet<number>
  /** Floor the relation enforces server-side — 1 for `leadership.municipalities`. */
  minItems?: number
  /**
   * Ceiling the relation enforces server-side. Checked here so a território that
   * would blow the cap is refused with the reason BEFORE the optimistic apply —
   * the server rejection would otherwise revert a whole batch with a message
   * that never says which limit was hit.
   */
  maxItems?: number
  /** Draft mode (new row): keep changes local and report them upward. */
  draft?: boolean
  onDraftChange?: (municipalityIds: number[]) => void
  /** Sends `ownerId`, repeated `municipalityIds` and `assigned`. */
  commitAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  drawerTitle: string
  updateErrorMessage: string
}

export const MunicipalityPortfolioCell = ({
  ownerId,
  ownerName,
  municipalityIds,
  municipalityIndex,
  addableIds,
  minItems = 0,
  maxItems,
  draft = false,
  onDraftChange,
  commitAction,
  drawerTitle,
  updateErrorMessage,
}: MunicipalityPortfolioCellProps) => {
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
  const baseId = useId()
  const listboxId = (surface: SuggestionSurface) => `${baseId}-${surface}-listbox`
  const optionId = useCallback(
    (surface: SuggestionSurface, index: number) => `${baseId}-${surface}-option-${index}`,
    [baseId],
  )

  useEffect(() => {
    setOptimistic((current) => {
      if (!current) return null
      return sameIdSet(current, municipalityIds) ? null : current
    })
  }, [municipalityIds])

  const effectiveIds = optimistic ?? municipalityIds

  const assignedIds = useMemo(() => new Set(effectiveIds), [effectiveIds])
  const chips = useMemo(
    () => buildMunicipalityPortfolioChips(effectiveIds, municipalityIndex),
    [effectiveIds, municipalityIndex],
  )
  /**
   * Suggestions are scoped, chips are not: filtering the index the search reads
   * also shrinks the território / ZE hits to what the actor may actually add,
   * instead of offering a batch the server would reject halfway.
   */
  const searchIndex = useMemo(
    () =>
      addableIds
        ? municipalityIndex.filter((entry) => addableIds.has(entry.id))
        : municipalityIndex,
    [addableIds, municipalityIndex],
  )
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
    () => (suggesting ? searchMunicipalityPortfolio(query, searchIndex, assignedIds) : []),
    [suggesting, query, searchIndex, assignedIds],
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
    invalidateMeasurement()
  }, [chipsKey, invalidateMeasurement])

  useEffect(() => {
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
  }, [invalidateMeasurement])

  /**
   * Runs on the frames where every chip is in the DOM, so the packing of the
   * three visible rows — and the room the toggle needs on the third one — is
   * read from the real layout instead of estimated from label lengths.
   */
  useEffect(() => {
    if (visibleChipCount !== null) return
    const row = chipRowRef.current
    if (!row) return

    const chipElements = [...row.querySelectorAll<HTMLElement>('[data-portfolio-chip]')]
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
      row.querySelector<HTMLElement>('[data-portfolio-toggle]')?.getBoundingClientRect().width ?? 0
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
  }, [measureToken, visibleChipCount])

  /**
   * Every delta is applied functionally, forward and back: two chips toggled in
   * the same burst — or an "Desfazer" pressed after a later add — would otherwise
   * each compute from the set their own render captured and drop the other's work.
   */
  const commit = (changedIds: number[], assigned: boolean) => {
    if (changedIds.length === 0) return

    if (draft) onDraftChange?.(withDelta(effectiveIds, changedIds, assigned))
    else setOptimistic((current) => withDelta(current ?? municipalityIds, changedIds, assigned))
    setQuery('')
    setOpen(false)
    setFeedback(null)

    if (draft) return
    if (ownerId === null) return

    const formData = new FormData()
    formData.set('ownerId', String(ownerId))
    formData.set('assigned', assigned ? 'true' : 'false')
    for (const id of changedIds) formData.append('municipalityIds', String(id))

    startTransition(async () => {
      const result = await commitAction({}, formData)
      if (result.status === 'success') {
        setFeedback({ kind: 'saved' })
        // A território/ZE removal drops up to 30 links in one tap, and the row
        // it left behind carries no trace of what was there. Single removals
        // are one search away from being restored and get no toast.
        if (!assigned && changedIds.length > 1) {
          toast.success(`${changedIds.length} municípios removidos.`, {
            action: { label: 'Desfazer', onClick: () => commit(changedIds, true) },
          })
        }
        return
      }
      // Undo only THIS delta: reverting to the server baseline would also wipe
      // a sibling toggle from the same burst that already saved.
      setOptimistic((current) => withDelta(current ?? municipalityIds, changedIds, !assigned))
      const message = result.message ?? updateErrorMessage
      setFeedback({ kind: 'error', message })
      toast.error(message)
    })
  }

  const chipMunicipalityIds = (chip: MunicipalityPortfolioChip): number[] =>
    chip.kind === 'territory' ? chip.municipalityIds : [chip.municipalityId]

  /** The relation's floor, refused here so the server never has to say no. */
  const removalFloorReason = (chip: MunicipalityPortfolioChip): string | null =>
    assignedIds.size - chipMunicipalityIds(chip).length < minItems
      ? `${ownerName} precisa de pelo menos ${minItems === 1 ? 'um município' : `${minItems} municípios`}`
      : null

  const additionCapReason = (additions: number[]): string | null =>
    maxItems !== undefined && assignedIds.size + additions.length > maxItems
      ? `${ownerName} aceita no máximo ${maxItems} municípios.`
      : null

  /** A batch chip says how much it removes, in the label a screen reader reads. */
  const chipScopeLabel = (chip: MunicipalityPortfolioChip): string =>
    chip.kind === 'territory'
      ? `${chip.label} — ${chip.municipalityIds.length} municípios`
      : chip.label

  const chipRemoveLabel = (chip: MunicipalityPortfolioChip, floorReason: string | null): string =>
    floorReason
      ? `${floorReason} — não é possível remover ${chip.label}`
      : `Remover ${chipScopeLabel(chip)}`

  /**
   * Refusals explain themselves on attempt instead of going silent: the control
   * keeps `aria-disabled` (so it stays in the tab order and can still be
   * activated) rather than `disabled`, which would hide the only copy of the
   * reason from every keyboard user.
   */
  const attemptRemove = (chip: MunicipalityPortfolioChip) => {
    const floorReason = removalFloorReason(chip)
    if (floorReason) {
      toast.error(`${floorReason}.`)
      return
    }
    commit(chipMunicipalityIds(chip), false)
  }

  const hitMunicipalityIds = (hit: MunicipalityPortfolioSearchHit): number[] =>
    hit.kind === 'municipality' ? [hit.municipalityId] : hit.municipalityIds

  const pickHit = (hit: MunicipalityPortfolioSearchHit) => {
    const additions = hitMunicipalityIds(hit)
    const capReason = additionCapReason(additions)
    if (capReason) {
      toast.error(capReason)
      return
    }
    commit(additions, true)
  }

  const closeSuggestions = () => {
    setOpen(false)
    setQuery('')
  }

  /**
   * ARIA 1.2 combobox keyboard contract, shared by the inline input and the
   * Drawer's: Up/Down/Home/End move the active option, Enter picks it, Escape
   * abandons the search. Without it the suggestions are mouse-only.
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
  const showAllChips = expanded || open
  const measuring = visibleChipCount === null
  const hasHiddenChips = visibleChipCount !== null && visibleChipCount < chips.length
  const visibleChips = showAllChips || measuring ? chips : chips.slice(0, visibleChipCount)
  /**
   * Only the pre-measurement render needs a height cap; once the chip list is
   * trimmed the row is three lines tall on its own, and capping it again would
   * clip whatever shares the last line (the search input is taller than a chip).
   */
  const clamping = measuring && !showAllChips

  /**
   * One region, four things to say, in this order: a save in flight outranks
   * everything; a failure outranks the search; and the search outranks a past
   * success, otherwise "Municípios salvos." would shadow every later result
   * count for the rest of the session.
   */
  const statusMessage = isPending
    ? 'Salvando municípios…'
    : feedback?.kind === 'error'
      ? feedback.message
      : suggesting
        ? resultsMessage(hits.length)
        : feedback?.kind === 'saved'
          ? 'Municípios salvos.'
          : ''

  /**
   * Mounted while measuring so its width is reserved on the last line, but kept
   * out of the tab order and the accessibility tree until the overflow it
   * announces is known. On a coarse pointer the cell-wide Drawer trigger sits
   * above it, so a tap opens the full list instead of expanding in place.
   */
  const expandToggle =
    measuring || hasHiddenChips ? (
      <button
        type="button"
        data-portfolio-toggle
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

  const chipBody = (chip: MunicipalityPortfolioChip) => (
    <>
      {chip.kind === 'territory' ? (
        <MapPinIcon className="size-3 shrink-0 opacity-70" aria-hidden="true" />
      ) : null}
      <span className="truncate">{chip.label}</span>
      {chip.kind === 'territory' ? (
        <span className="shrink-0 text-xs tabular-nums opacity-70">
          {chip.municipalityIds.length}
        </span>
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
  const inlineChip = (chip: MunicipalityPortfolioChip) => {
    const floorReason = removalFloorReason(chip)
    return (
      <span
        key={chip.key}
        data-portfolio-chip
        className="group/chip relative inline-flex max-w-full"
      >
        {chip.kind === 'municipality' ? (
          <Badge variant="secondary" className="max-w-full font-normal" asChild>
            <Link
              href={`/campanha/municipios/${chip.slug}`}
              className="truncate underline-offset-4 hover:underline"
            >
              {chip.label}
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

  const suggestionOption = (
    hit: MunicipalityPortfolioSearchHit,
    index: number,
    surface: SuggestionSurface,
  ) => {
    const capped = additionCapReason(hitMunicipalityIds(hit)) !== null
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
          <span className="block text-xs text-muted-foreground">
            {hitDescription(hit)}
            {capped ? ' · excede o limite' : ''}
          </span>
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
      <div role="listbox" id={listboxId(surface)} aria-label={SUGGESTIONS_LABEL}>
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
              aria-controls={listboxId('inline')}
              aria-autocomplete="list"
              aria-activedescendant={inlineSuggesting ? activeOptionId : undefined}
              onChange={(event) => {
                setQuery(event.currentTarget.value)
                setFeedback(null)
                setOpen(true)
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => {
                window.setTimeout(() => {
                  if (!rootRef.current?.contains(document.activeElement)) {
                    closeSuggestions()
                  }
                }, 120)
              }}
              onKeyDown={onSearchKeyDown}
              placeholder={chips.length ? 'Adicionar…' : SEARCH_PLACEHOLDER}
              aria-label={SEARCH_LABEL}
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
       * table cannot be asked to tell "open the município" from "delete it". The
       * links it covers come back inside the Drawer.
       */}
      <button
        type="button"
        className="absolute inset-0 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none pointer-fine:hidden"
        aria-label={`Editar municípios de ${ownerName}`}
        onClick={(event) => {
          event.stopPropagation()
          setDrawerOpen(true)
        }}
      />

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          {/* Eager JSX: allocated on every render of every row, including the fine
           * pointer where this never opens. The portal already skips the DOM. */}
          {drawerOpen ? (
            <>
              <DrawerHeader>
                <DrawerTitle>{drawerTitle}</DrawerTitle>
                <DrawerDescription>{ownerName}</DrawerDescription>
              </DrawerHeader>
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 pb-2">
                {chips.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum município vinculado.</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {chips.map((chip) => {
                      const floorReason = removalFloorReason(chip)
                      return (
                        <li
                          key={chip.key}
                          className="flex min-h-11 items-center justify-between gap-2 rounded-md border px-2"
                        >
                          {chip.kind === 'municipality' ? (
                            <Link
                              href={`/campanha/municipios/${chip.slug}`}
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
                  aria-controls={listboxId('drawer')}
                  aria-autocomplete="list"
                  aria-activedescendant={drawerSuggesting ? activeOptionId : undefined}
                  onChange={(event) => {
                    setQuery(event.currentTarget.value)
                    setFeedback(null)
                  }}
                  onKeyDown={onSearchKeyDown}
                  placeholder={SEARCH_PLACEHOLDER}
                  aria-label={SEARCH_LABEL}
                  className="min-h-11"
                />
                {searching ? (
                  <div className="flex flex-col gap-1">{suggestionList('drawer')}</div>
                ) : null}
              </div>
              <DrawerFooter>
                <DrawerClose
                  render={<Button type="button" variant="outline" className="min-h-11 w-full" />}
                >
                  Fechar
                </DrawerClose>
              </DrawerFooter>
            </>
          ) : null}
        </DrawerContent>
      </Drawer>

      <p className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </p>
    </div>
  )
}
