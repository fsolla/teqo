'use client'

import { FunnelIcon, FunnelPlusIcon } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'

import { CampaignTransitionAnchor } from '@/components/campaign/CampaignListPending'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { cn } from '@/lib/utils'
import {
  applyMunicipalityKindFilter,
  buildMunicipalityFilterHref,
  buildMunicipalityFiltersKey,
  clearMunicipalityAdvisorFilters,
  clearMunicipalityMultiFilter,
  clearMunicipalityNameFilters,
  getMunicipalityFilterDefinition,
  getMunicipalityMultiFilterValues,
  getMunicipalitySingleFilterValue,
  isMunicipalityColumnFilterActive,
  municipalityPriorityLabels,
  toggleMunicipalityExclusiveFilterValue,
  toggleMunicipalityMultiFilterValue,
  toggleMunicipalityPriorityFilter,
  type MunicipalityFilterOption,
  type MunicipalityFilterParam,
  type MunicipalityListState,
  type MunicipalityMultiFilterParam,
} from '@/utilities/municipalityUi'
import { normalizeSearchPhrase } from '@/utilities/wordStartFilter'

type MunicipalityHeaderFilterProps = {
  state: MunicipalityListState
  filterParam: MunicipalityFilterParam
  /** Options already narrowed by the other active filters (server-computed). */
  options?: MunicipalityFilterOption[]
  /** Staff-only Prioritária checkbox inside the Município filter. */
  showPriorityFilter?: boolean
}

/** Above this many options the popover gets a search box. */
const SEARCHABLE_OPTION_THRESHOLD = 8

const multiParamByFilter = {
  name: 'slug',
  region: 'region',
  advisor: 'advisor',
  trend: 'trend',
  kind: null,
  coverage: null,
} as const satisfies Record<MunicipalityFilterParam, MunicipalityMultiFilterParam | null>

const FilterOptionLink = ({
  href,
  selected,
  checkbox = false,
  onChoose,
  children,
}: {
  href: string
  selected: boolean
  checkbox?: boolean
  onChoose: () => void
  children: ReactNode
}) => (
  <CampaignTransitionAnchor
    href={href}
    replace
    scroll={false}
    aria-current={selected ? 'true' : undefined}
    className={cn(
      'flex min-h-11 items-center rounded-md px-2 text-sm whitespace-normal hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      checkbox ? 'gap-2' : selected && 'bg-muted font-medium',
    )}
    onNavigate={onChoose}
  >
    {checkbox ? (
      <>
        <Checkbox
          checked={selected}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none"
        />
        <span className={cn(selected && 'font-medium')}>{children}</span>
      </>
    ) : (
      children
    )}
  </CampaignTransitionAnchor>
)

export const MunicipalityHeaderFilter = ({
  state,
  filterParam,
  options: optionsOverride,
  showPriorityFilter = false,
}: MunicipalityHeaderFilterProps) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  /**
   * Optimistic selection, tagged with the URL state it was derived from: when the
   * server answer lands the tag stops matching and the truth takes over — no
   * effect racing the transition (and no reverting a still-pending click).
   */
  const [optimistic, setOptimistic] = useState<{
    baseKey: string
    next: MunicipalityListState
  } | null>(null)

  const definition = getMunicipalityFilterDefinition(filterParam)
  const definitionOptions = definition.options
  const options = useMemo(
    () => optionsOverride ?? definitionOptions ?? [],
    [optionsOverride, definitionOptions],
  )
  const stateKey = buildMunicipalityFiltersKey(state)
  const viewState = optimistic?.baseKey === stateKey ? optimistic.next : state
  const isActive = isMunicipalityColumnFilterActive(viewState, filterParam)
  const searchable = options.length >= SEARCHABLE_OPTION_THRESHOLD

  // Normalizing 435 labels per keystroke is the cost to avoid here, not the filter itself.
  const searchIndex = useMemo(
    () => options.map((option) => ({ option, haystack: normalizeSearchPhrase(option.label) })),
    [options],
  )
  const needle = normalizeSearchPhrase(query)
  const visibleOptions = needle
    ? searchIndex.filter((entry) => entry.haystack.includes(needle)).map((entry) => entry.option)
    : options

  const commit = (next: MunicipalityListState) => {
    setOptimistic({ baseKey: stateKey, next })
    if (definition.selection !== 'multi') setOpen(false)
  }

  const multiParam = multiParamByFilter[filterParam]
  const selectedMulti = multiParam ? getMunicipalityMultiFilterValues(viewState, multiParam) : []

  /**
   * Exclusive rows above the multi-select list: the Município column also owns
   * "Prioritária", and the Assessores column owns the com/sem assessor toggle
   * (it absorbed the former "Assessoria" column).
   */
  const exclusiveRows =
    filterParam === 'name' && showPriorityFilter
      ? [
          {
            label: municipalityPriorityLabels.alta,
            selected: viewState.priority === 'alta',
            next: toggleMunicipalityPriorityFilter(viewState),
          },
        ]
      : filterParam === 'advisor'
        ? (getMunicipalityFilterDefinition('coverage').options ?? []).map((option) => ({
            label: option.label,
            selected: viewState.coverage === option.value,
            next: toggleMunicipalityExclusiveFilterValue(viewState, 'coverage', option.value),
          }))
        : []

  const clearedState =
    filterParam === 'name'
      ? clearMunicipalityNameFilters(viewState)
      : filterParam === 'advisor'
        ? clearMunicipalityAdvisorFilters(viewState)
        : multiParam
          ? clearMunicipalityMultiFilter(viewState, multiParam)
          : viewState

  const hasSelection = selectedMulti.length > 0 || exclusiveRows.some((row) => row.selected)
  const showClear = hasSelection

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
            'inline-flex h-11 w-7 shrink-0 items-center justify-center rounded-md hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
          aria-label={
            isActive
              ? `Filtrar ${definition.label}: ativo. Alterar filtro`
              : `Filtrar por ${definition.label}`
          }
        >
          {isActive ? (
            <FunnelPlusIcon className="size-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <FunnelIcon className="size-3.5 shrink-0" aria-hidden="true" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <p
            id={`municipality-filter-heading-${filterParam}`}
            className="text-xs font-medium text-muted-foreground"
          >
            {definition.label}
          </p>
          {showClear ? (
            <CampaignTransitionAnchor
              href={buildMunicipalityFilterHref(clearedState)}
              replace
              scroll={false}
              className="text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onNavigate={() => commit(clearedState)}
            >
              Limpar
            </CampaignTransitionAnchor>
          ) : null}
        </div>

        {exclusiveRows.length ? (
          <div className="mb-1 flex flex-col gap-0.5 border-b border-border px-1 pb-1">
            {exclusiveRows.map((row) => (
              <FilterOptionLink
                key={row.label}
                href={buildMunicipalityFilterHref(row.next)}
                selected={row.selected}
                checkbox
                onChoose={() => commit(row.next)}
              >
                {row.label}
              </FilterOptionLink>
            ))}
          </div>
        ) : null}

        {searchable ? (
          <div className="px-1 pb-1">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar…"
              aria-label={`Buscar em ${definition.label}`}
              className="min-h-11"
              autoFocus
            />
          </div>
        ) : null}

        <nav
          aria-labelledby={`municipality-filter-heading-${filterParam}`}
          className="flex max-h-72 flex-col gap-0.5 overflow-y-auto"
        >
          {definition.selection === 'single' && definition.allLabel ? (
            <FilterOptionLink
              href={buildMunicipalityFilterHref(applyMunicipalityKindFilter(viewState, undefined))}
              selected={!getMunicipalitySingleFilterValue(viewState, 'kind')}
              onChoose={() => commit(applyMunicipalityKindFilter(viewState, undefined))}
            >
              {definition.allLabel}
            </FilterOptionLink>
          ) : null}

          {/* Tipo is the only single-select column; com/sem assessor rides along
              as an exclusive row of the Assessores column. */}
          {definition.selection === 'single'
            ? visibleOptions.map((option) => {
                const next = applyMunicipalityKindFilter(viewState, option.value)
                return (
                  <FilterOptionLink
                    key={option.value}
                    href={buildMunicipalityFilterHref(next)}
                    selected={getMunicipalitySingleFilterValue(viewState, 'kind') === option.value}
                    onChoose={() => commit(next)}
                  >
                    {option.label}
                  </FilterOptionLink>
                )
              })
            : null}

          {multiParam
            ? visibleOptions.map((option) => {
                const next = toggleMunicipalityMultiFilterValue(viewState, multiParam, option.value)
                return (
                  <FilterOptionLink
                    key={option.value}
                    href={buildMunicipalityFilterHref(next)}
                    selected={selectedMulti.includes(option.value)}
                    checkbox
                    onChoose={() => commit(next)}
                  >
                    {option.label}
                  </FilterOptionLink>
                )
              })
            : null}

          {visibleOptions.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              {needle ? 'Nenhum resultado encontrado.' : 'Nenhuma opção no escopo filtrado.'}
            </p>
          ) : null}
        </nav>
      </PopoverContent>
    </Popover>
  )
}
