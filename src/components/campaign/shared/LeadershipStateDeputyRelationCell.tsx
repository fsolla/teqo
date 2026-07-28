'use client'

import { PencilIcon, XIcon } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/Badge'
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/Command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { Spinner } from '@/components/ui/Spinner'
import { sameIdSet } from '@/lib/sameIdSet'
import { cn } from '@/lib/utils'
import { matchesAtWordStart } from '@/lib/wordStartFilter'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

export type RelationCellItem = {
  id: number
  label: string
  href: string
  party?: string
}

export type RelationCellOption = {
  id: number
  searchLabel: string
  item: RelationCellItem
}

type LeadershipStateDeputyRelationDirection = 'fromLeadership' | 'fromStateDeputy'

type LeadershipStateDeputyRelationCellProps = {
  direction: LeadershipStateDeputyRelationDirection
  fixedId: number
  items: RelationCellItem[]
  options: RelationCellOption[]
  membershipAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  /** Clamp rest chips to 3 rows + "Ver mais…". Default true; pass false when few chips are expected. */
  measureOverflow?: boolean
}

const COLLAPSED_CHIP_ROWS = 3
/** Matches `gap-1` on the rest chip row. */
const CHIP_GAP_PX = 4

const COPY = {
  fromLeadership: {
    editLabel: 'Editar dobradinhas',
    title: 'Atribuir dobradinhas',
    description: 'Deputados estaduais em dobradinha com esta liderança.',
    searchPlaceholder: 'Buscar deputado estadual…',
    searchAriaLabel: 'Buscar deputado estadual',
    saving: 'Salvando dobradinhas.',
    savingAria: 'Salvando dobradinhas',
    saveError: 'Não foi possível atualizar as dobradinhas. Tente novamente.',
  },
  fromStateDeputy: {
    editLabel: 'Editar lideranças',
    title: 'Atribuir lideranças',
    description: 'Lideranças em dobradinha com este deputado estadual.',
    searchPlaceholder: 'Buscar liderança…',
    searchAriaLabel: 'Buscar liderança',
    saving: 'Salvando lideranças.',
    savingAria: 'Salvando lideranças',
    saveError: 'Não foi possível atualizar as lideranças. Tente novamente.',
  },
} as const

const itemLabel = (item: RelationCellItem): string =>
  item.party ? `${item.label} (${item.party})` : item.label

/**
 * Bidirectional cell for the `leadership.stateDeputies` edge.
 * Both directions write `leadershipId`/`stateDeputyId`/`assigned` through the
 * same membership action.
 */
export const LeadershipStateDeputyRelationCell = ({
  direction,
  fixedId,
  items,
  options,
  membershipAction,
  measureOverflow = true,
}: LeadershipStateDeputyRelationCellProps) => {
  const copy = COPY[direction]
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<RelationCellItem[]>(items)
  const [query, setQuery] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const lastPropsRef = useRef(items)

  const [expanded, setExpanded] = useState(false)
  const [collapsedHeight, setCollapsedHeight] = useState<number | null>(null)
  /** `null` means "render every chip so the next effect can measure them". */
  const [visibleChipCount, setVisibleChipCount] = useState<number | null>(null)
  const [measureToken, setMeasureToken] = useState(0)
  const lastRowWidth = useRef(0)
  const chipRowRef = useRef<HTMLDivElement>(null)
  const editRef = useRef<HTMLButtonElement>(null)

  // Adopt server props only when they change from outside (navigation / RSC
  // refresh) — an in-flight delta's optimistic state must not be clobbered by
  // a prop identical in content to what we already had.
  useEffect(() => {
    const propIds = items.map((item) => item.id)
    if (
      sameIdSet(
        propIds,
        lastPropsRef.current.map((item) => item.id),
      )
    )
      return
    lastPropsRef.current = items
    setCurrent(items)
  }, [items])

  const currentIds = useMemo(() => new Set(current.map((item) => item.id)), [current])
  const optionById = useMemo(() => new Map(options.map((option) => [option.id, option])), [options])

  const filteredOptions = useMemo(() => {
    if (!open) return []
    return options.filter(
      (option) => !currentIds.has(option.id) && matchesAtWordStart(option.searchLabel, query),
    )
  }, [open, options, currentIds, query])

  const invalidateMeasurement = useCallback(() => {
    setVisibleChipCount(null)
    setMeasureToken((token) => token + 1)
  }, [])

  const chipsKey = current.map((item) => item.id).join('|')
  useEffect(() => {
    if (!measureOverflow) return
    invalidateMeasurement()
  }, [chipsKey, measureOverflow, invalidateMeasurement])

  useEffect(() => {
    if (!measureOverflow) return
    const row = chipRowRef.current
    if (!row) return
    lastRowWidth.current = row.clientWidth
    const observer = new ResizeObserver(() => {
      if (row.clientWidth === lastRowWidth.current) return
      lastRowWidth.current = row.clientWidth
      invalidateMeasurement()
    })
    observer.observe(row)
    return () => observer.disconnect()
  }, [measureOverflow, invalidateMeasurement])

  useEffect(() => {
    if (!measureOverflow || visibleChipCount !== null) return
    const row = chipRowRef.current
    if (!row) return

    const chipElements = [...row.querySelectorAll<HTMLElement>('[data-relation-chip]')]
    if (chipElements.length === 0) {
      setVisibleChipCount(0)
      return
    }

    const rowRect = row.getBoundingClientRect()
    const chipRects = chipElements.map((element) => element.getBoundingClientRect())
    const firstChip = chipRects[0]
    if (!firstChip) {
      setVisibleChipCount(0)
      return
    }
    const chipHeight = firstChip.height
    setCollapsedHeight(chipHeight * COLLAPSED_CHIP_ROWS + CHIP_GAP_PX * (COLLAPSED_CHIP_ROWS - 1))

    const lastVisibleTop = firstChip.top + (chipHeight + CHIP_GAP_PX) * (COLLAPSED_CHIP_ROWS - 1)
    let fitting = chipRects.filter((rect) => rect.top <= lastVisibleTop + 1).length

    // Reserve room on the last visible line for "Ver mais…" (and the sibling pencil).
    const toggleWidth =
      row.querySelector<HTMLElement>('[data-relation-toggle]')?.getBoundingClientRect().width ?? 0
    const pencilWidth = editRef.current?.getBoundingClientRect().width ?? 0
    const trailingWidth = toggleWidth + CHIP_GAP_PX + pencilWidth
    while (fitting > 0 && fitting < chipElements.length) {
      const trailing = chipRects[fitting - 1]
      if (!trailing || trailing.right + CHIP_GAP_PX + trailingWidth <= rowRect.right) break
      fitting -= 1
    }

    setVisibleChipCount(fitting)
  }, [measureOverflow, measureToken, visibleChipCount])

  const toggle = (itemId: number, assigned: boolean) => {
    // The removed summary is captured up front (not re-derived from the
    // catalog) so a failed removal can be undone even for an item that has
    // since dropped out of `options` — same asymmetry as the `optionById`
    // lookup below, which only needs to resolve *additions*.
    const removedItem = assigned ? undefined : current.find((item) => item.id === itemId)
    if (assigned && !optionById.has(itemId)) return

    setErrorMessage(null)
    setCurrent((previous) => {
      if (assigned) {
        if (previous.some((item) => item.id === itemId)) return previous
        const option = optionById.get(itemId)
        if (!option) return previous
        return [...previous, option.item]
      }
      return previous.filter((item) => item.id !== itemId)
    })
    setQuery('')

    const formData = new FormData()
    if (direction === 'fromLeadership') {
      formData.set('leadershipId', String(fixedId))
      formData.set('stateDeputyId', String(itemId))
    } else {
      formData.set('leadershipId', String(itemId))
      formData.set('stateDeputyId', String(fixedId))
    }
    formData.set('assigned', assigned ? 'true' : 'false')

    startTransition(async () => {
      const result = await membershipAction({}, formData)
      if (result.status === 'success') return
      // Undo only this delta — not the whole cell back to `lastPropsRef` —
      // so a failed toggle can't wipe an earlier toggle from the same batch
      // that already saved successfully.
      setCurrent((previous) =>
        assigned
          ? previous.filter((item) => item.id !== itemId)
          : removedItem
            ? [...previous, removedItem]
            : previous,
      )
      const message = result.message ?? copy.saveError
      setErrorMessage(message)
      toast.error(message)
    })
  }

  const statusMessage = errorMessage ?? (isPending ? copy.saving : '')

  const showAllChips = !measureOverflow || expanded
  const measuring = measureOverflow && visibleChipCount === null
  const hasHiddenChips =
    measureOverflow && visibleChipCount !== null && visibleChipCount < current.length
  const visibleItems = (() => {
    if (!measureOverflow || showAllChips || measuring || visibleChipCount === null) return current
    return current.slice(0, visibleChipCount)
  })()
  /**
   * Only the pre-measurement render needs a height cap; once the chip list is
   * trimmed the row is three lines tall on its own.
   */
  const clamping = measuring && !showAllChips
  const chipRowStyle =
    clamping && collapsedHeight !== null ? { maxHeight: collapsedHeight } : undefined

  // Mounted while measuring so width is reserved; hidden until overflow is known.
  const expandToggle =
    measureOverflow && (measuring || hasHiddenChips) ? (
      <button
        type="button"
        data-relation-toggle
        tabIndex={measuring ? -1 : undefined}
        aria-hidden={measuring || undefined}
        className={cn(
          'px-1 text-xs font-medium text-primary underline-offset-4 hover:underline',
          measuring && 'invisible pointer-events-none',
        )}
        onClick={(event) => {
          event.stopPropagation()
          setExpanded((previous) => !previous)
        }}
      >
        {showAllChips ? 'Ver menos' : 'Ver mais…'}
      </button>
    ) : null

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div
        ref={chipRowRef}
        className={cn(
          'flex flex-wrap items-center gap-1',
          measureOverflow && current.length > 0 ? 'min-w-0 flex-1' : undefined,
          clamping && 'overflow-hidden',
        )}
        style={chipRowStyle}
      >
        {current.length === 0 ? (
          <span className="text-sm text-muted-foreground">—</span>
        ) : (
          visibleItems.map((item) => (
            <Badge key={item.id} variant="outline" asChild>
              <Link href={item.href} data-relation-chip className="max-w-full truncate">
                {itemLabel(item)}
              </Link>
            </Badge>
          ))
        )}
        {expandToggle}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            ref={editRef}
            type="button"
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label={copy.editLabel}
            className={cn(
              'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              open ? 'bg-muted/60 text-foreground' : undefined,
            )}
          >
            <PencilIcon className="size-3.5" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0">
          <div className="relative flex flex-col gap-2 p-3 pb-0">
            <p className="text-sm font-medium">{copy.title}</p>
            <p className="text-xs text-muted-foreground">{copy.description}</p>
            {isPending ? (
              <Spinner
                className="absolute top-3 right-3 size-3.5 text-muted-foreground"
                aria-label={copy.savingAria}
              />
            ) : null}
          </div>
          {current.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 px-3 pt-2">
              {current.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-label={`Remover ${item.label}`}
                  onClick={() => toggle(item.id, false)}
                >
                  <Badge
                    variant="secondary"
                    className="max-w-full cursor-pointer gap-1 pr-1 font-normal hover:bg-destructive/15"
                  >
                    <span className="truncate">{itemLabel(item)}</span>
                    <XIcon className="size-3 shrink-0 opacity-70" aria-hidden="true" />
                  </Badge>
                </button>
              ))}
            </div>
          ) : null}
          <Command shouldFilter={false} className="mt-1">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={copy.searchPlaceholder}
              aria-label={copy.searchAriaLabel}
            />
            <CommandList>
              {filteredOptions.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Nenhum resultado.
                </p>
              ) : (
                filteredOptions.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={`${direction}-${option.id}`}
                    onSelect={() => toggle(option.id, true)}
                  >
                    <span className="truncate">{option.searchLabel}</span>
                  </CommandItem>
                ))
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/*
       * Outside the Popover on purpose (B32+ F4): a region that unmounts with
       * the overlay announces nothing once the overlay closes, and closing is
       * what commits here. This cell still hand-rolls its trigger and popover —
       * migrating it onto `CampaignCellEditOverlay` is B31's extraction trigger.
       */}
      <p className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </p>
    </div>
  )
}
