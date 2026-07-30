'use client'

import { useEffect, useRef, useState } from 'react'

import { HomeSearchHitRow } from '@/components/campaign/dashboard/HomeSearchHitRow'
import { HomeSearchMunicipalityVoteTrailing } from '@/components/campaign/dashboard/HomeSearchMunicipalityVoteTrailing'
import { useHomeSearchQuery } from '@/components/campaign/dashboard/useHomeSearchQuery'
import { CampaignSearchInput } from '@/components/campaign/shared/CampaignSearchInput'
import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { wizardActionHref } from '@/lib/campaignActionRoutes'
import type {
  HomeSearchMunicipalityHit,
  WizardMunicipalitySearchSuccessResponse,
} from '@/lib/campaignHomeSearchHits'
import { HOME_SEARCH_GENERIC_ERROR_MESSAGE } from '@/lib/campaignHomeSearchMessages'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import {
  WIZARD_MUNICIPALITY_SEARCH_EMPTY,
  WIZARD_MUNICIPALITY_SEARCH_LABEL,
  WIZARD_MUNICIPALITY_SEARCH_PLACEHOLDER,
  WIZARD_MUNICIPALITY_STEP_TITLE,
} from '@/lib/campaignWizardCopy'
import { HOME_SEARCH_QUERY_MAX_LENGTH } from '@/lib/schemas/homeSearch'

const HOME_SEARCH_ROUTE = '/campanha/home-search'
const WIZARD_MUNICIPALITY_SEARCH_INPUT_ID = 'wizardMunicipalitySearchQuery'

type WizardSearchResultsState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; municipalities: HomeSearchMunicipalityHit[] }
  | { status: 'error'; message: string }

type WizardMunicipalitySearchStepProps = {
  actionSlug: string
  previousHref: string
}

export const WizardMunicipalitySearchStep = ({
  actionSlug,
  previousHref,
}: WizardMunicipalitySearchStepProps) => {
  const { query, setRaw, isDebouncing } = useHomeSearchQuery()
  const [results, setResults] = useState<WizardSearchResultsState>({ status: 'idle' })
  const requestSeq = useRef(0)
  const resultsBusy = isDebouncing || results.status === 'loading'

  useEffect(() => {
    if (!query.isActive) {
      requestSeq.current += 1
      setResults({ status: 'idle' })
      return
    }

    const seq = ++requestSeq.current
    const controller = new AbortController()
    setResults({ status: 'loading' })

    void (async () => {
      const { ok, payload } = await postCampaignJson<WizardMunicipalitySearchSuccessResponse>(
        HOME_SEARCH_ROUTE,
        { mode: 'wizard-municipality', query: query.debounced },
        controller.signal,
      )

      if (seq !== requestSeq.current) return

      if (!ok || payload.status !== 'success') {
        setResults({ status: 'error', message: HOME_SEARCH_GENERIC_ERROR_MESSAGE })
        return
      }

      setResults({ status: 'success', municipalities: payload.municipalities })
    })().catch((error: unknown) => {
      if (seq !== requestSeq.current) return
      if (error instanceof DOMException && error.name === 'AbortError') return
      setResults({ status: 'error', message: HOME_SEARCH_GENERIC_ERROR_MESSAGE })
    })

    return () => {
      controller.abort()
    }
  }, [query.debounced, query.isActive])

  const showEmpty =
    query.isActive && results.status === 'success' && results.municipalities.length === 0

  return (
    <CampaignWizardShell stepTitle={WIZARD_MUNICIPALITY_STEP_TITLE} previousHref={previousHref}>
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
          {results.status === 'success' && results.municipalities.length > 0 ? (
            <ul className="flex flex-col">
              {results.municipalities.map((hit) => (
                <li key={hit.slug}>
                  <HomeSearchHitRow
                    href={wizardActionHref(actionSlug, hit.slug)}
                    primary={hit.name}
                    secondary={hit.region}
                    showPriority={hit.priority === 'alta'}
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
