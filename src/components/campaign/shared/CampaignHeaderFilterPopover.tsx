'use client'

import { FunnelIcon, FunnelPlusIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { CampaignTransitionAnchor } from '@/components/campaign/shared/CampaignListPending'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { orderFilterOptionsSelectedFirst } from '@/lib/listFilterOptions'
import { cn } from '@/lib/utils'
import { normalizeSearchPhrase } from '@/lib/wordStartFilter'

export type CampaignHeaderFilterRow = {
  value: string
  label: string
  href: string
  selected: boolean
  checkbox?: boolean
  onChoose: () => void
}

type CampaignHeaderFilterPopoverProps = {
  active: boolean
  clear?: { href: string; onChoose: () => void }
  closeOnChoose?: boolean
  emptyLabel?: string
  exclusiveRows?: CampaignHeaderFilterRow[]
  id: string
  label: string
  optionRows: CampaignHeaderFilterRow[]
}

const SEARCHABLE_OPTION_THRESHOLD = 8

const FilterRow = ({ row, onChoose }: { row: CampaignHeaderFilterRow; onChoose: () => void }) => (
  <CampaignTransitionAnchor
    href={row.href}
    replace
    scroll={false}
    aria-current={row.selected ? 'true' : undefined}
    className={cn(
      'flex min-h-11 items-center rounded-md px-2 text-sm whitespace-normal hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      row.checkbox ? 'gap-2' : row.selected && 'bg-muted font-medium',
    )}
    onNavigate={onChoose}
  >
    {row.checkbox ? (
      <>
        <Checkbox
          checked={row.selected}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none"
        />
        <span className={cn(row.selected && 'font-medium')}>{row.label}</span>
      </>
    ) : (
      row.label
    )}
  </CampaignTransitionAnchor>
)

export const CampaignHeaderFilterPopover = ({
  active,
  clear,
  closeOnChoose = false,
  emptyLabel = 'Nenhuma opção no escopo filtrado.',
  exclusiveRows = [],
  id,
  label,
  optionRows,
}: CampaignHeaderFilterPopoverProps) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  /**
   * Selected values at open time. Governs presentation order only — checkboxes
   * still read live `row.selected`. Freezing order while open keeps rows from
   * sliding under the pointer when the optimistic selection flips (same race
   * the B16 "click that undoes itself" bug taught).
   */
  const [selectionSnapshot, setSelectionSnapshot] = useState<readonly string[]>([])
  const searchable = optionRows.length >= SEARCHABLE_OPTION_THRESHOLD
  /**
   * Selected-first ordering is multi-select only. Today every multi-select
   * consumer marks every option row with `checkbox: true`, and every
   * single-select leaves it off — so this gate is 1:1 with selection mode
   * without a new prop. Reordering a single-select would push "Todas" under
   * the marked value, which the product rejected.
   */
  const isMultiSelect = optionRows.length > 0 && optionRows.every((row) => row.checkbox)
  const searchIndex = useMemo(
    () =>
      optionRows.map((row) => ({
        row,
        haystack: normalizeSearchPhrase(row.label),
      })),
    [optionRows],
  )
  const needle = normalizeSearchPhrase(query)
  const filteredRows = needle
    ? searchIndex.filter((entry) => entry.haystack.includes(needle)).map((entry) => entry.row)
    : optionRows
  const { ordered: visibleRows, selectedCount } =
    open && isMultiSelect
      ? orderFilterOptionsSelectedFirst(filteredRows, selectionSnapshot)
      : { ordered: filteredRows, selectedCount: 0 }
  // Hide the hairline while searching: filtering already reshapes the list,
  // and relocating the group boundary on every keystroke is spatial noise.
  // Order still follows the open-time snapshot among matches.
  const showSelectedDivider =
    isMultiSelect && !needle && selectedCount > 0 && selectedCount < visibleRows.length

  const choose = (row: CampaignHeaderFilterRow) => {
    row.onChoose()
    if (closeOnChoose) setOpen(false)
  }

  const renderRows = (rows: readonly CampaignHeaderFilterRow[]) =>
    rows.map((row) => <FilterRow key={row.value} row={row} onChoose={() => choose(row)} />)

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setSelectionSnapshot(optionRows.filter((row) => row.selected).map((row) => row.value))
          return
        }
        setQuery('')
        setSelectionSnapshot([])
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
          aria-label={active ? `Filtrar ${label}: ativo. Alterar filtro` : `Filtrar por ${label}`}
        >
          {active ? (
            <FunnelPlusIcon className="size-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <FunnelIcon className="size-3.5 shrink-0" aria-hidden="true" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <p id={`${id}-heading`} className="text-xs font-medium text-muted-foreground">
            {label}
          </p>
          {clear ? (
            <CampaignTransitionAnchor
              href={clear.href}
              replace
              scroll={false}
              className="text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onNavigate={clear.onChoose}
            >
              Limpar
            </CampaignTransitionAnchor>
          ) : null}
        </div>

        {exclusiveRows.length ? (
          <div className="mb-1 flex flex-col gap-0.5 border-b border-border px-1 pb-1">
            {exclusiveRows.map((row) => (
              <FilterRow key={row.value} row={row} onChoose={() => choose(row)} />
            ))}
          </div>
        ) : null}

        {searchable ? (
          <div className="px-1 pb-1">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar…"
              aria-label={`Buscar em ${label}`}
              className="min-h-11"
              autoFocus
            />
          </div>
        ) : null}

        <nav
          aria-labelledby={`${id}-heading`}
          className="flex max-h-72 flex-col gap-0.5 overflow-y-auto"
        >
          {showSelectedDivider ? (
            <>
              {renderRows(visibleRows.slice(0, selectedCount))}
              <div className="my-1 border-t border-border" role="presentation" />
              {renderRows(visibleRows.slice(selectedCount))}
            </>
          ) : (
            renderRows(visibleRows)
          )}
          {visibleRows.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              {needle ? 'Nenhum resultado encontrado.' : emptyLabel}
            </p>
          ) : null}
        </nav>
      </PopoverContent>
    </Popover>
  )
}
