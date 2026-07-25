'use client'

import { useCampaignListPending } from '@/components/campaign/shared/CampaignListPending'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { CampaignSearchInput } from '@/components/campaign/shared/CampaignSearchInput'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { normalizedText } from '@/utilities/campaignListUrl'
import {
  applyMunicipalityKindFilter,
  clearMunicipalityListFilters,
  formatMunicipalityActiveFiltersSummary,
  getMunicipalityFilterDefinition,
  getMunicipalitySingleFilterValue,
  municipalityFilterDefinitions,
  toggleMunicipalityExclusiveFilterValue,
  toggleMunicipalityMultiFilterValue,
  type MunicipalityFilterOption,
} from '@/utilities/municipalityListFilters'
import {
  buildMunicipalityFiltersKey,
  buildMunicipalityListHref,
  municipalityListSortOptions,
  parseMunicipalitySortValue,
  resolveMunicipalityListSort,
  serializeMunicipalitySortValue,
  shouldUpdateMunicipalitySearchUrl,
  type MunicipalityListState,
} from '@/utilities/municipalityListUrl'

const SEARCH_DEBOUNCE_MS = 1000

/** Mobile stand-in for a header multi-select: pick to add, pick again to remove. */
const MobileMultiFilterField = ({
  id,
  label,
  emptyLabel,
  options,
  selected,
  onToggle,
}: {
  id: string
  label: string
  emptyLabel: string
  options: MunicipalityFilterOption[]
  selected: string[]
  onToggle: (value: string) => void
}) => (
  <Field>
    <FieldLabel htmlFor={id}>{label}</FieldLabel>
    <NativeSelect
      id={id}
      value=""
      onChange={(event) => {
        if (event.target.value) onToggle(event.target.value)
      }}
      className="min-h-11 w-full"
    >
      <NativeSelectOption value="">
        {selected.length ? `${selected.length} selecionado(s) — alterar` : emptyLabel}
      </NativeSelectOption>
      {options.map((option) => (
        <NativeSelectOption key={option.value} value={option.value}>
          {selected.includes(option.value) ? `✓ ${option.label}` : option.label}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  </Field>
)

type MunicipalityFiltersProps = {
  state: MunicipalityListState
  showStaffFilters: boolean
  /** Territory options already narrowed by the other active filters. */
  regionFilterOptions: MunicipalityFilterOption[]
  /** Advisor options already narrowed by the other active filters. */
  advisorFilterOptions: MunicipalityFilterOption[]
}

export const MunicipalityFilters = ({
  state,
  showStaffFilters,
  regionFilterOptions,
  advisorFilterOptions,
}: MunicipalityFiltersProps) => {
  const router = useRouter()
  const [search, setSearch] = useState(state.q ?? '')
  const sharedPending = useCampaignListPending()
  const [isLocalPending, startLocalTransition] = useTransition()
  // Prefer the page-level boundary so the results region dims together.
  const isPending = sharedPending?.isPending ?? isLocalPending
  const startTransition = sharedPending?.startTransition ?? startLocalTransition
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { sort: activeSort, dir: activeDir } = resolveMunicipalityListSort(state)
  const draftQ = normalizedText(search) || state.q
  const activeFiltersSummary = formatMunicipalityActiveFiltersSummary({
    ...state,
    q: draftQ,
  })
  const hasActiveFilters = Boolean(activeFiltersSummary)

  useEffect(
    () => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    },
    [],
  )

  const clearDebounce = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }

  const navigateTo = (next: MunicipalityListState) => {
    clearDebounce()
    const canonical: MunicipalityListState = {
      ...next,
      page: 1,
      q: normalizedText(next.q),
    }
    if (
      buildMunicipalityFiltersKey(canonical) === buildMunicipalityFiltersKey({ ...state, page: 1 })
    )
      return

    startTransition(() => {
      router.replace(buildMunicipalityListHref(canonical, 1), { scroll: false })
    })
  }

  const commitNavigation = (patch: Partial<MunicipalityListState>) => {
    navigateTo({
      ...state,
      ...patch,
      q: normalizedText(patch.q !== undefined ? patch.q : search),
    })
  }

  const scheduleSearchNavigation = (value: string) => {
    clearDebounce()
    if (!shouldUpdateMunicipalitySearchUrl(value, state.q)) return

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      commitNavigation({ q: value })
    }, SEARCH_DEBOUNCE_MS)
  }

  const mobileFilterDefinitions = municipalityFilterDefinitions.filter((definition) => {
    if (definition.staffOnly && !showStaffFilters) return false
    // Header popovers own multi/name filters; mobile keeps exclusive selects.
    return definition.selection === 'single' || definition.selection === 'toggle'
  })

  return (
    <form
      role="search"
      className="flex flex-col gap-3 transition-opacity data-[pending=true]:opacity-70"
      data-pending={isPending}
      aria-busy={isPending}
      onSubmit={(event) => {
        event.preventDefault()
        commitNavigation({ q: search })
      }}
    >
      <p className="sr-only" aria-live="polite">
        {isPending ? 'Atualizando resultados…' : ''}
      </p>

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <CampaignSearchInput
          id="municipality-search"
          label="Buscar município"
          placeholder="Buscar por município ou zona…"
          value={search}
          onChange={(event) => {
            const value = event.target.value
            setSearch(value)
            scheduleSearchNavigation(value)
          }}
        />
        {activeFiltersSummary ? (
          <p
            className="hidden min-w-0 flex-1 text-sm text-muted-foreground md:block md:self-center md:pb-2 md:whitespace-normal"
            aria-live="polite"
          >
            {activeFiltersSummary}
          </p>
        ) : null}
        {hasActiveFilters ? (
          <div className="flex shrink-0 gap-2 md:self-end">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => {
                clearDebounce()
                setSearch('')
                startTransition(() => {
                  router.replace(
                    buildMunicipalityListHref(clearMunicipalityListFilters(state), 1),
                    { scroll: false },
                  )
                })
              }}
            >
              Limpar
            </Button>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 md:hidden">
        {showStaffFilters ? (
          <Field>
            <FieldLabel htmlFor="municipality-filter-priority">Prioridade</FieldLabel>
            <NativeSelect
              id="municipality-filter-priority"
              value={state.priority ?? ''}
              onChange={(event) => {
                navigateTo({
                  ...state,
                  priority: event.target.value === 'alta' ? 'alta' : undefined,
                  q: normalizedText(search),
                })
              }}
              className="min-h-11 w-full"
            >
              <NativeSelectOption value="">Todas</NativeSelectOption>
              <NativeSelectOption value="alta">Prioritária</NativeSelectOption>
            </NativeSelect>
          </Field>
        ) : null}
        {regionFilterOptions.length ? (
          <MobileMultiFilterField
            id="municipality-filter-region"
            label="Território"
            emptyLabel="Todos"
            options={regionFilterOptions}
            selected={state.regions ?? []}
            onToggle={(value) =>
              navigateTo(
                toggleMunicipalityMultiFilterValue(
                  { ...state, q: normalizedText(search) },
                  'region',
                  value,
                ),
              )
            }
          />
        ) : null}
        {mobileFilterDefinitions.map((definition) => {
          const value =
            definition.param === 'kind' || definition.param === 'coverage'
              ? (getMunicipalitySingleFilterValue(state, definition.param) ?? '')
              : ''
          return (
            <Field key={definition.param}>
              <FieldLabel htmlFor={`municipality-filter-${definition.param}`}>
                {definition.label}
              </FieldLabel>
              <NativeSelect
                id={`municipality-filter-${definition.param}`}
                value={value}
                onChange={(event) => {
                  const selected = event.target.value
                  const withSearch = { ...state, q: normalizedText(search) }
                  if (definition.selection === 'toggle') {
                    navigateTo(
                      selected
                        ? toggleMunicipalityExclusiveFilterValue(withSearch, 'coverage', selected)
                        : { ...withSearch, coverage: undefined, page: 1 },
                    )
                    return
                  }
                  if (definition.param === 'kind') {
                    navigateTo(applyMunicipalityKindFilter(withSearch, selected))
                  }
                }}
                className="min-h-11 w-full"
              >
                <NativeSelectOption value="">{definition.allLabel ?? 'Todas'}</NativeSelectOption>
                {(definition.options ?? []).map((option) => (
                  <NativeSelectOption key={option.value} value={option.value}>
                    {option.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          )
        })}
        {showStaffFilters ? (
          <MobileMultiFilterField
            id="municipality-filter-trend"
            label="Tendência"
            emptyLabel="Todas"
            options={getMunicipalityFilterDefinition('trend').options ?? []}
            selected={state.trends ?? []}
            onToggle={(value) =>
              navigateTo(
                toggleMunicipalityMultiFilterValue(
                  { ...state, q: normalizedText(search) },
                  'trend',
                  value,
                ),
              )
            }
          />
        ) : null}
        {showStaffFilters && advisorFilterOptions.length ? (
          <MobileMultiFilterField
            id="municipality-filter-advisor"
            label="Assessores"
            emptyLabel="Todos"
            options={advisorFilterOptions}
            selected={(state.advisors ?? []).map(String)}
            onToggle={(value) =>
              navigateTo(
                toggleMunicipalityMultiFilterValue(
                  { ...state, q: normalizedText(search) },
                  'advisor',
                  value,
                ),
              )
            }
          />
        ) : null}
        <Field>
          <FieldLabel htmlFor="municipality-sort">Ordenar</FieldLabel>
          <NativeSelect
            id="municipality-sort"
            value={serializeMunicipalitySortValue(activeSort, activeDir)}
            onChange={(event) => {
              const parsed = parseMunicipalitySortValue(event.target.value)
              if (parsed) commitNavigation({ sort: parsed.key, dir: parsed.dir })
            }}
            className="min-h-11 w-full"
          >
            {municipalityListSortOptions.map(({ key, dir, label }) => (
              <NativeSelectOption
                key={serializeMunicipalitySortValue(key, dir)}
                value={serializeMunicipalitySortValue(key, dir)}
              >
                {label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>
    </form>
  )
}
