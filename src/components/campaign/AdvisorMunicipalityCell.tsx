'use client'

import { MapPinIcon, XIcon } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/Badge'
import {
  buildAdvisorPortfolioChips,
  searchAdvisorPortfolio,
  type AdvisorMunicipalityIndexEntry,
  type AdvisorPortfolioChip,
  type AdvisorPortfolioSearchHit,
} from '@/lib/advisorMunicipalityPortfolio'
import { cn } from '@/lib/utils'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

type MunicipalityRef = {
  id: number
  name: string
  slug: string
}

/** Same box in both modes so toggling edition never reflows the row. */
const CELL_WRAPPER_CLASS = 'relative min-w-56 rounded-md border border-transparent p-1'
const CHIP_ROW_CLASS = 'flex min-h-8 flex-wrap items-center gap-1.5 overflow-hidden'

const COLLAPSED_CHIP_ROWS = 3
/** Matches `gap-1.5` on the chip row. */
const CHIP_GAP_PX = 6

type AdvisorMunicipalityCellProps = {
  advisorId: number | null
  municipalities: MunicipalityRef[]
  municipalityIndex: readonly AdvisorMunicipalityIndexEntry[]
  editing: boolean
  /** Draft mode (new row): keep changes local and report via onChange. */
  draft?: boolean
  onDraftChange?: (municipalities: MunicipalityRef[]) => void
  membershipAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  batchAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  onPersisted?: () => void
}

export const AdvisorMunicipalityCell = ({
  advisorId,
  municipalities,
  municipalityIndex,
  editing,
  draft = false,
  onDraftChange,
  membershipAction,
  batchAction,
  onPersisted,
}: AdvisorMunicipalityCellProps) => {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [optimistic, setOptimistic] = useState<MunicipalityRef[] | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [collapsedHeight, setCollapsedHeight] = useState<number | null>(null)
  /** `null` means "render every chip so the next effect can measure them". */
  const [visibleChipCount, setVisibleChipCount] = useState<number | null>(null)
  const [measureToken, setMeasureToken] = useState(0)
  const lastRowWidth = useRef(0)
  const [, startTransition] = useTransition()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const chipRowRef = useRef<HTMLDivElement>(null)
  const baselineRef = useRef(municipalities)

  useEffect(() => {
    baselineRef.current = municipalities
    setOptimistic((current) => {
      if (!current) return null
      const baselineKey = municipalities
        .map((municipality) => municipality.id)
        .sort((left, right) => left - right)
        .join(',')
      const currentKey = current
        .map((municipality) => municipality.id)
        .sort((left, right) => left - right)
        .join(',')
      return baselineKey === currentKey ? null : current
    })
  }, [municipalities])

  const effectiveMunicipalities = optimistic ?? municipalities

  const assignedIds = useMemo(
    () => new Set(effectiveMunicipalities.map((municipality) => municipality.id)),
    [effectiveMunicipalities],
  )
  const chips = useMemo(
    () => buildAdvisorPortfolioChips(effectiveMunicipalities, municipalityIndex),
    [effectiveMunicipalities, municipalityIndex],
  )
  const hits = useMemo(
    () => (open && editing ? searchAdvisorPortfolio(query, municipalityIndex, assignedIds) : []),
    [open, editing, query, municipalityIndex, assignedIds],
  )

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
  // chips must not throw away a measurement that is still valid. Toggling edit
  // does invalidate it — removable chips carry an extra "×" and are wider.
  const chipsKey = chips.map((chip) => chip.key).join('|')
  useEffect(() => {
    invalidateMeasurement()
  }, [chipsKey, editing, invalidateMeasurement])

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
    const chipHeight = chipRects[0].height
    setCollapsedHeight(chipHeight * COLLAPSED_CHIP_ROWS + CHIP_GAP_PX * (COLLAPSED_CHIP_ROWS - 1))

    const lastVisibleTop = chipRects[0].top + (chipHeight + CHIP_GAP_PX) * (COLLAPSED_CHIP_ROWS - 1)
    let fitting = chipRects.filter((rect) => rect.top <= lastVisibleTop + 1).length

    // The toggle — and, while editing, the search input — must share the last
    // visible line, otherwise they wrap into a line nobody asked for.
    const toggleWidth =
      row.querySelector<HTMLElement>('[data-portfolio-toggle]')?.getBoundingClientRect().width ?? 0
    const inputWidth = inputRef.current
      ? Number.parseFloat(getComputedStyle(inputRef.current).minWidth) || 0
      : 0
    const trailingWidth = toggleWidth + CHIP_GAP_PX + inputWidth
    while (fitting > 0 && fitting < chipElements.length) {
      const trailing = chipRects[fitting - 1]
      if (trailing.right + CHIP_GAP_PX + trailingWidth <= rowRect.right) break
      fitting -= 1
    }

    setVisibleChipCount(fitting)
  }, [measureToken, visibleChipCount])

  const indexById = useMemo(() => {
    const map = new Map<number, AdvisorMunicipalityIndexEntry>()
    for (const entry of municipalityIndex) map.set(entry.id, entry)
    return map
  }, [municipalityIndex])

  const refsFromIds = (ids: number[]): MunicipalityRef[] =>
    [...new Set(ids)]
      .map((id) => {
        const existing = effectiveMunicipalities.find((municipality) => municipality.id === id)
        if (existing) return existing
        const fromBaseline = baselineRef.current.find((municipality) => municipality.id === id)
        if (fromBaseline) return fromBaseline
        const entry = indexById.get(id)
        return entry ? { id: entry.id, name: entry.name, slug: entry.slug } : null
      })
      .filter((municipality): municipality is MunicipalityRef => municipality !== null)
      .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))

  const applyLocal = (nextIds: number[]) => {
    const next = refsFromIds(nextIds)
    if (draft) {
      onDraftChange?.(next)
      return
    }
    setOptimistic(next)
  }

  const revertOptimistic = () => {
    setOptimistic(null)
  }

  const runMembership = (municipalityId: number, assigned: boolean) => {
    const next = new Set(assignedIds)
    if (assigned) next.add(municipalityId)
    else next.delete(municipalityId)
    applyLocal([...next])
    setQuery('')
    setOpen(false)

    if (draft) return
    if (advisorId === null) return

    const formData = new FormData()
    formData.set('advisorId', String(advisorId))
    formData.set('municipalityId', String(municipalityId))
    formData.set('assigned', assigned ? 'true' : 'false')

    startTransition(async () => {
      const result = await membershipAction({}, formData)
      if (result.status === 'success') {
        onPersisted?.()
        return
      }
      revertOptimistic()
      toast.error(result.message ?? 'Não foi possível atualizar a carteira.')
    })
  }

  const runBatch = (municipalityIds: number[], assigned: boolean) => {
    if (municipalityIds.length === 0) return
    const next = new Set(assignedIds)
    for (const id of municipalityIds) {
      if (assigned) next.add(id)
      else next.delete(id)
    }
    applyLocal([...next])
    setQuery('')
    setOpen(false)

    if (draft) return
    if (advisorId === null) return

    const formData = new FormData()
    formData.set('advisorId', String(advisorId))
    formData.set('assigned', assigned ? 'true' : 'false')
    for (const id of municipalityIds) formData.append('municipalityIds', String(id))

    startTransition(async () => {
      const result = await batchAction({}, formData)
      if (result.status === 'success') {
        onPersisted?.()
        return
      }
      revertOptimistic()
      toast.error(result.message ?? 'Não foi possível atualizar a carteira.')
    })
  }

  const removeChip = (chip: AdvisorPortfolioChip) => {
    if (chip.kind === 'territory') {
      runBatch(chip.municipalityIds, false)
      return
    }
    runMembership(chip.municipalityId, false)
  }

  const pickHit = (hit: AdvisorPortfolioSearchHit) => {
    if (hit.kind === 'municipality') {
      runMembership(hit.municipalityId, true)
      return
    }
    runBatch(hit.municipalityIds, true)
  }

  // Editing needs every chip reachable, so focusing the cell always expands it.
  const showAllChips = expanded || (editing && open)
  const measuring = visibleChipCount === null
  const hasHiddenChips = visibleChipCount !== null && visibleChipCount < chips.length
  const visibleChips = showAllChips || measuring ? chips : chips.slice(0, visibleChipCount)
  /**
   * Only the pre-measurement render needs a height cap; once the chip list is
   * trimmed the row is three lines tall on its own, and capping it again would
   * clip whatever shares the last line (the search input is taller than a chip).
   */
  const clamping = measuring && !showAllChips
  const chipRowStyle =
    clamping && collapsedHeight !== null ? { maxHeight: collapsedHeight } : undefined

  const expandToggle =
    measuring || hasHiddenChips ? (
      <button
        type="button"
        data-portfolio-toggle
        className="px-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
        onClick={(event) => {
          event.stopPropagation()
          const next = !showAllChips
          setExpanded(next)
          // While editing, focus is what keeps the cell open — collapsing must release it.
          if (!next) {
            setOpen(false)
            inputRef.current?.blur()
          }
        }}
      >
        {showAllChips ? 'Ver menos' : 'Ver mais…'}
      </button>
    ) : null

  if (!editing) {
    return (
      <div className={CELL_WRAPPER_CLASS}>
        <div
          ref={chipRowRef}
          className={cn(CHIP_ROW_CLASS, clamping && 'max-h-18')}
          style={chipRowStyle}
        >
          {chips.length === 0 ? (
            <span className="px-1 text-sm text-muted-foreground">—</span>
          ) : (
            visibleChips.map((chip) =>
              chip.kind === 'territory' ? (
                <Badge
                  key={chip.key}
                  data-portfolio-chip
                  variant="secondary"
                  className="max-w-full gap-1 font-normal"
                >
                  <MapPinIcon className="size-3 shrink-0 opacity-70" aria-hidden="true" />
                  <span className="truncate">{chip.label}</span>
                </Badge>
              ) : (
                <Badge key={chip.key} variant="secondary" className="max-w-full font-normal" asChild>
                  <Link
                    href={`/campanha/municipios/${chip.slug}`}
                    data-portfolio-chip
                    className="truncate underline-offset-4 hover:underline"
                  >
                    {chip.label}
                  </Link>
                </Badge>
              ),
            )
          )}
          {expandToggle}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        CELL_WRAPPER_CLASS,
        'outline-none hover:bg-muted/40 focus-within:bg-muted/40',
      )}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest('[data-chip-remove]')) return
        inputRef.current?.focus()
        setOpen(true)
      }}
    >
      <div
        ref={chipRowRef}
        className={cn(CHIP_ROW_CLASS, clamping && 'max-h-18')}
        style={chipRowStyle}
      >
        {visibleChips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            data-chip-remove
            data-portfolio-chip
            aria-label={`Remover ${chip.label}`}
            className="inline-flex max-w-full"
            onClick={(event) => {
              event.stopPropagation()
              removeChip(chip)
            }}
          >
            <Badge
              variant="secondary"
              className="max-w-full cursor-pointer gap-1 pr-1 font-normal hover:bg-destructive/15"
            >
              {chip.kind === 'territory' ? (
                <MapPinIcon className="size-3 shrink-0 opacity-70" aria-hidden="true" />
              ) : null}
              <span className="truncate">{chip.label}</span>
              <XIcon className="size-3 shrink-0 opacity-70" aria-hidden="true" />
            </Badge>
          </button>
        ))}
        {expandToggle}
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            window.setTimeout(() => {
              if (!rootRef.current?.contains(document.activeElement)) {
                setOpen(false)
                setQuery('')
              }
            }, 120)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false)
              setQuery('')
              inputRef.current?.blur()
            }
          }}
          placeholder={chips.length ? 'Adicionar…' : 'Buscar município, território ou ZE…'}
          aria-label="Buscar município, território de identidade ou zona eleitoral"
          className="min-h-8 min-w-32 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      {open && query.trim() ? (
        <div
          role="listbox"
          className="absolute z-30 mt-1 max-h-64 w-[min(100%,22rem)] overflow-auto rounded-lg border bg-popover p-1 shadow-md"
        >
          {hits.length === 0 ? (
            <p className="px-2 py-2 text-sm text-muted-foreground">Nenhum resultado.</p>
          ) : (
            hits.map((hit) => (
              <button
                key={hit.key}
                type="button"
                role="option"
                aria-selected={false}
                className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pickHit(hit)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{hit.label}</span>
                  <span className="block text-xs text-muted-foreground">
                    {hit.kind === 'municipality'
                      ? 'Município'
                      : hit.kind === 'territory'
                        ? `Território · ${hit.count} municípios`
                        : `Zona eleitoral · ${hit.count} municípios`}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  )
}
