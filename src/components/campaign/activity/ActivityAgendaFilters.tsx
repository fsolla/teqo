'use client'

import { MapPinnedIcon, PlusIcon } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

import { CampaignListOmnibox } from '@/components/campaign/shared/CampaignListOmnibox'
import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import { useCampaignQuickActionContext } from '@/components/campaign/shell/CampaignQuickActionContext'
import { Button } from '@/components/ui/button'
import { ACTIVITY_TOUR_COMPOSER_PATH } from '@/lib/campaignQuickActionPaths'
import {
  applyActivityAgendaOmniboxSuggestion,
  buildActivityAgendaOmniboxChips,
  buildActivityAgendaOmniboxSuggestionSeeds,
  clearActivityAgendaOmnibox,
  filterActivityAgendaOmniboxSuggestions,
  removeActivityAgendaOmniboxChip,
  type ActivityAgendaOmniboxAction,
} from '@/utilities/activityAgendaOmnibox'
import { buildActivityAgendaHref, type ActivityAgendaState } from '@/utilities/activityUi'

type ActivityAgendaFiltersProps = {
  state: ActivityAgendaState
  municipalityOptions: RelationOption[]
  knownTags: string[]
}

/**
 * Agenda toolbar (C94): one omnibox filtering Município (único) + Tag +
 * Deputado presente (chip bool), with the desktop create entries as icon
 * buttons beside the bar. Mobile creates live in the FAB drawer, so the
 * trailing icons are desktop-only. Filter state stays on the URL.
 *
 * A local `draft` mirrors the URL state so consecutive picks within the same
 * RSC pending window apply cumulatively (a bare `state` prop would drop the
 * first selection while the router.replace round-trip is in flight).
 */
export const ActivityAgendaFilters = ({
  state,
  municipalityOptions,
  knownTags,
}: ActivityAgendaFiltersProps) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: buildActivityAgendaHref,
  })
  const { context } = useCampaignQuickActionContext()
  const [draft, setDraft] = useState(state)
  const [query, setQuery] = useState('')

  useEffect(() => setDraft(state), [state])

  const municipalityLabelsById = useMemo(() => {
    const map = new Map<number, string>()
    for (const option of municipalityOptions) {
      if (Number.isSafeInteger(option.id) && option.id > 0) map.set(option.id, option.name)
    }
    return map
  }, [municipalityOptions])

  const municipalityFilterOptions = useMemo(
    () =>
      municipalityOptions.map((option) => ({
        value: String(option.id),
        label: option.name,
      })),
    [municipalityOptions],
  )

  const chips = useMemo(
    () => buildActivityAgendaOmniboxChips({ state: draft, municipalityLabelsById }),
    [draft, municipalityLabelsById],
  )

  const suggestionSeeds = useMemo(
    () =>
      buildActivityAgendaOmniboxSuggestionSeeds({
        municipalityOptions: municipalityFilterOptions,
        knownTags,
      }),
    [municipalityFilterOptions, knownTags],
  )

  const suggestions = useMemo(
    () => filterActivityAgendaOmniboxSuggestions(suggestionSeeds, query),
    [suggestionSeeds, query],
  )

  const runAction = (action: ActivityAgendaOmniboxAction) => {
    if (action.kind === 'clear') {
      // C95 — "Limpar" clears the recorte, not the view mode: the view is
      // screen state alongside the filter, so it survives the clear.
      const next: ActivityAgendaState = draft.view ? { view: draft.view } : {}
      setQuery('')
      setDraft(next)
      navigate(next)
      return
    }
    setDraft(action.state)
    navigate(action.state)
  }

  return (
    <div className="activity-agenda-filter-strip">
      <CampaignListOmnibox
        id="agenda-omnibox"
        label="Filtrar agenda"
        placeholder="Filtrar por município, tag, deputado presente…"
        chips={chips}
        suggestions={suggestions}
        query={query}
        onQueryChange={setQuery}
        isPending={isPending}
        onSelectSuggestion={(suggestionId) => {
          runAction(applyActivityAgendaOmniboxSuggestion({ state: draft, suggestionId }))
        }}
        onRemoveChip={(chipId) => {
          runAction(removeActivityAgendaOmniboxChip({ state: draft, chipId }))
        }}
        onClearAll={() => {
          runAction(clearActivityAgendaOmnibox())
        }}
        trailing={
          <div className="hidden items-center gap-2 md:flex">
            <Button
              asChild
              variant="outline"
              size="icon"
              className="min-h-11 min-w-11"
              aria-label="Planejar giro"
              title="Planejar giro"
            >
              <Link href={ACTIVITY_TOUR_COMPOSER_PATH}>
                <MapPinnedIcon className="size-5" aria-hidden />
              </Link>
            </Button>
            <Button
              type="button"
              size="icon"
              className="min-h-11 min-w-11"
              aria-label="Nova atividade"
              title="Nova atividade"
              onClick={() => context.openActivityCreate?.()}
            >
              <PlusIcon className="size-5" aria-hidden />
            </Button>
          </div>
        }
      />
    </div>
  )
}
