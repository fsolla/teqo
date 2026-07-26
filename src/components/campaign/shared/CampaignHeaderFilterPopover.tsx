'use client'

import { FunnelIcon, FunnelPlusIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { CampaignTransitionAnchor } from '@/components/campaign/shared/CampaignListPending'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
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
  const searchable = optionRows.length >= SEARCHABLE_OPTION_THRESHOLD
  const searchIndex = useMemo(
    () =>
      optionRows.map((row) => ({
        row,
        haystack: normalizeSearchPhrase(row.label),
      })),
    [optionRows],
  )
  const needle = normalizeSearchPhrase(query)
  const visibleRows = needle
    ? searchIndex.filter((entry) => entry.haystack.includes(needle)).map((entry) => entry.row)
    : optionRows

  const choose = (row: CampaignHeaderFilterRow) => {
    row.onChoose()
    if (closeOnChoose) setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery('')
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
          {visibleRows.map((row) => (
            <FilterRow key={row.value} row={row} onChoose={() => choose(row)} />
          ))}
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
