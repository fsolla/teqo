'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { HomeSearchHitRow } from '@/components/campaign/dashboard/HomeSearchHitRow'
import { HomeSearchMunicipalityVoteTrailing } from '@/components/campaign/dashboard/HomeSearchMunicipalityVoteTrailing'
import { useHomeSearchQuery } from '@/components/campaign/dashboard/useHomeSearchQuery'
import { CampaignSearchInput } from '@/components/campaign/shared/CampaignSearchInput'
import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { wizardActionHref } from '@/lib/campaignActionRoutes'
import { getLastActedMunicipalitySlug } from '@/lib/campaignLastActedMunicipality'
import type {
  HomeSearchMunicipalityHit,
  WizardMunicipalitySearchSuccessResponse,
} from '@/lib/campaignHomeSearchHits'
import { toHomeSearchMunicipalityHit } from '@/lib/campaignHomeSearchHits'
import { HOME_SEARCH_GENERIC_ERROR_MESSAGE } from '@/lib/campaignHomeSearchMessages'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import {
  WIZARD_MUNICIPALITY_SEARCH_EMPTY,
  WIZARD_MUNICIPALITY_SEARCH_LABEL,
  WIZARD_MUNICIPALITY_SEARCH_PLACEHOLDER,
  WIZARD_MUNICIPALITY_STEP_TITLE,
  wizardFlowTitleForSlug,
} from '@/lib/campaignWizardCopy'
import { HOME_SEARCH_QUERY_MAX_LENGTH } from '@/lib/schemas/homeSearch'
import {
  listWizardContinuitySlugs,
  mergeWizardMunicipalitySuggestions,
  type WizardContinuitySlug,
} from '@/lib/wizardMunicipalitySuggestMerge'
import { listRecentVisits } from '@/utilities/recentVisits'

const HOME_SEARCH_ROUTE = '/campanha/home-search'
const WIZARD_MUNICIPALITY_SEARCH_INPUT_ID = 'wizardMunicipalitySearchQuery'

type WizardSuggestSuccessState = {
  municipalities: HomeSearchMunicipalityHit[]
  hitBySlug: ReadonlyMap<string, HomeSearchMunicipalityHit>
}

type WizardSearchResultsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; mode: 'search'; municipalities: HomeSearchMunicipalityHit[] }
  | { status: 'success'; mode: 'suggest'; suggest: WizardSuggestSuccessState }
  | { status: 'error'; message: string }

type WizardMunicipalitySearchStepProps = {
  actionSlug: string
  previousHref: string
}

const buildSuggestSuccessState = (
  payload: WizardMunicipalitySearchSuccessResponse,
): WizardSuggestSuccessState => {
  const scopeMunicipalities = payload.scopeMunicipalities ?? []
  const hitBySlug = new Map(
    scopeMunicipalities.map((doc) => [doc.slug, toHomeSearchMunicipalityHit(doc)]),
  )
  return {
    municipalities: payload.municipalities,
    hitBySlug,
  }
}

export const WizardMunicipalitySearchStep = ({
  actionSlug,
  previousHref,
}: WizardMunicipalitySearchStepProps) => {
  const { query, setRaw, isDebouncing } = useHomeSearchQuery()
  const [results, setResults] = useState<WizardSearchResultsState>({ status: 'idle' })
  const [continuitySlugs, setContinuitySlugs] = useState<WizardContinuitySlug[]>([])
  const [continuityReady, setContinuityReady] = useState(false)
  const requestSeq = useRef(0)
  const suggestMode = !query.isActive
  const searchMode = query.isActive
  const resultsBusy = isDebouncing || results.status === 'loading'

  useEffect(() => {
    if (!suggestMode || results.status !== 'success' || results.mode !== 'suggest') {
      setContinuitySlugs([])
      setContinuityReady(false)
      return
    }

    const scopeSlugs = new Set(results.suggest.hitBySlug.keys())
    setContinuitySlugs(
      listWizardContinuitySlugs({
        lastActedSlug: getLastActedMunicipalitySlug(),
        recentVisits: listRecentVisits(),
        scopeSlugs,
      }),
    )
    setContinuityReady(true)
  }, [results, suggestMode])

  useEffect(() => {
    if (!suggestMode && !searchMode) {
      requestSeq.current += 1
      setResults({ status: 'idle' })
      return
    }

    const seq = ++requestSeq.current
    const controller = new AbortController()
    setResults({ status: 'loading' })

    const body = suggestMode
      ? ({ mode: 'wizard-municipality-suggest' } as const)
      : ({ mode: 'wizard-municipality', query: query.debounced } as const)

    void (async () => {
      const { ok, payload } = await postCampaignJson<WizardMunicipalitySearchSuccessResponse>(
        HOME_SEARCH_ROUTE,
        body,
        controller.signal,
      )

      if (seq !== requestSeq.current) return

      if (!ok || payload.status !== 'success') {
        setResults({ status: 'error', message: HOME_SEARCH_GENERIC_ERROR_MESSAGE })
        return
      }

      if (suggestMode) {
        setResults({
          status: 'success',
          mode: 'suggest',
          suggest: buildSuggestSuccessState(payload),
        })
        return
      }

      setResults({
        status: 'success',
        mode: 'search',
        municipalities: payload.municipalities,
      })
    })().catch((error: unknown) => {
      if (seq !== requestSeq.current) return
      if (error instanceof DOMException && error.name === 'AbortError') return
      setResults({ status: 'error', message: HOME_SEARCH_GENERIC_ERROR_MESSAGE })
    })

    return () => {
      controller.abort()
    }
  }, [query.debounced, searchMode, suggestMode])

  const displayRows = useMemo(() => {
    if (results.status !== 'success') return []

    if (results.mode === 'search') {
      return results.municipalities.map((hit) => ({ hit, continuityReason: undefined }))
    }

    if (!continuityReady) {
      return results.suggest.municipalities.map((hit) => ({ hit, continuityReason: undefined }))
    }

    return mergeWizardMunicipalitySuggestions({
      continuity: continuitySlugs,
      serverHits: results.suggest.municipalities,
      hitBySlug: results.suggest.hitBySlug,
    })
  }, [continuityReady, continuitySlugs, results])

  const showEmpty =
    query.isActive &&
    results.status === 'success' &&
    results.mode === 'search' &&
    results.municipalities.length === 0

  return (
    <CampaignWizardShell
      flowTitle={wizardFlowTitleForSlug(actionSlug)}
      stepTitle={WIZARD_MUNICIPALITY_STEP_TITLE}
      isEntryStep
      previousHref={previousHref}
      dismissHref={previousHref}
    >
      <div className="flex flex-col gap-4">
        <CampaignSearchInput
          id={WIZARD_MUNICIPALITY_SEARCH_INPUT_ID}
          label={WIZARD_MUNICIPALITY_SEARCH_LABEL}
          placeholder={WIZARD_MUNICIPALITY_SEARCH_PLACEHOLDER}
          value={query.raw}
          onChange={(event) => setRaw(event.target.value)}
          autoComplete="off"
          enterKeyHint="search"
          aria-busy={resultsBusy || undefined}
          maxLength={HOME_SEARCH_QUERY_MAX_LENGTH}
        />
        <div
          role="region"
          aria-live="polite"
          aria-label="Resultados da busca"
          aria-busy={resultsBusy || undefined}
          className="min-w-0"
        >
          {results.status === 'error' ? (
            <p className="text-sm text-destructive" role="alert">
              {results.message}
            </p>
          ) : null}
          {results.status === 'success' && displayRows.length > 0 ? (
            <ul className="flex flex-col">
              {displayRows.map(({ hit, continuityReason }) => (
                <li key={hit.slug}>
                  <HomeSearchHitRow
                    href={wizardActionHref(actionSlug, hit.slug)}
                    primary={hit.name}
                    secondary={continuityReason ?? hit.region}
                    showPriority={hit.priority === 'alta'}
                    wizardNavigation
                    trailing={
                      <HomeSearchMunicipalityVoteTrailing position={hit.votePosition2022} />
                    }
                  />
                </li>
              ))}
            </ul>
          ) : null}
          {showEmpty ? (
            <p className="text-sm text-muted-foreground">{WIZARD_MUNICIPALITY_SEARCH_EMPTY}</p>
          ) : null}
        </div>
      </div>
    </CampaignWizardShell>
  )
}
