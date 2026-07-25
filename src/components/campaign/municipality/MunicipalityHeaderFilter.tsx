'use client'

import { FunnelIcon, FunnelPlusIcon } from 'lucide-react'
import { useMemo, useOptimistic, useState, type ReactNode } from 'react'

import { CampaignTransitionAnchor } from '@/components/campaign/shared/CampaignListPending'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { cn } from '@/lib/utils'
import { municipalityPriorityLabels } from '@/utilities/municipalityLabels'
import {
  applyMunicipalityKindFilter,
  buildMunicipalityFilterHref,
  buildMunicipalityFilterOptionHref,
  clearMunicipalityAdvisorFilters,
  clearMunicipalityMultiFilter,
  clearMunicipalityNameFilters,
  getMunicipalityFilterDefinition,
  getMunicipalityMultiFilterValues,
  getMunicipalitySingleFilterValue,
  isMunicipalityColumnFilterActive,
  municipalityFilterOptionsForSlugs,
  toggleMunicipalityExclusiveFilterValue,
  toggleMunicipalityMultiFilterValue,
  toggleMunicipalityPriorityFilter,
  type MunicipalityFilterOption,
  type MunicipalityFilterParam,
  type MunicipalityMultiFilterParam,
} from '@/utilities/municipalityListFilters'
import { type MunicipalityListState } from '@/utilities/municipalityListUrl'
import { normalizeSearchPhrase } from '@/lib/wordStartFilter'

type MunicipalityHeaderFilterProps = {
  state: MunicipalityListState
  filterParam: MunicipalityFilterParam
  /**
   * Options already narrowed by the other active filters (server-computed).
   * The Município column ships bare slugs — labels come from the catalog here
   * on the client, so the RSC payload never carries 435 name pairs (B16+).
   */
  options?: MunicipalityFilterOption[] | readonly string[]
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
  options: optionsInput,
  showPriorityFilter = false,
}: MunicipalityHeaderFilterProps) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  /**
   * Optimistic selection: set inside the navigation transition (see
   * `CampaignTransitionAnchor.onNavigate`), so React shows the clicked state
   * immediately and discards it for the server truth when the transition
   * settles — no manual base-key bookkeeping, no reverting a pending click.
   */
  const [viewState, setOptimisticState] = useOptimistic(state)

  const definition = getMunicipalityFilterDefinition(filterParam)
  const definitionOptions = definition.options
  const options = useMemo(() => {
    if (!optionsInput) return definitionOptions ?? []
    return typeof optionsInput[0] === 'string' || optionsInput.length === 0
      ? municipalityFilterOptionsForSlugs(optionsInput as readonly string[])
      : (optionsInput as MunicipalityFilterOption[])
  }, [optionsInput, definitionOptions])
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
    setOptimisticState(next)
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

          {/* Option hrefs ride the cheap canonical-toggle serializer; the full
              toggle (state for the optimistic commit) runs only on click. */}
          {multiParam
            ? visibleOptions.map((option) => (
                <FilterOptionLink
                  key={option.value}
                  href={buildMunicipalityFilterOptionHref(viewState, multiParam, option.value)}
                  selected={selectedMulti.includes(option.value)}
                  checkbox
                  onChoose={() =>
                    commit(toggleMunicipalityMultiFilterValue(viewState, multiParam, option.value))
                  }
                >
                  {option.label}
                </FilterOptionLink>
              ))
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
