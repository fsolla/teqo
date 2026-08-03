'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import {
  MUNICIPALITY_EXPECTED_VOTES_ENDPOINT,
  MUNICIPALITY_EXPECTED_VOTES_SAVE_ERROR_MESSAGE,
  type MunicipalityListExpectedVotesResponse,
} from '@/app/(campaign)/campanha/(app)/municipios/expected-votes/types'
import { MunicipalityTerritorialClassRow } from '@/components/campaign/municipality/MunicipalityTerritorialClassRow'
import { CampaignHoverTooltip } from '@/components/campaign/shared/CampaignHoverTooltip'
import { CampaignInfoHint } from '@/components/campaign/shared/CampaignInfoHint'
import { useCampaignCellAutosave } from '@/components/campaign/shared/useCampaignCellAutosave'
import { VoteEstimateScenarioInputs } from '@/components/campaign/votePledge/VoteEstimateScenarioInputs'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Progress } from '@/components/ui/Progress'
import { Spinner } from '@/components/ui/Spinner'
import { campaignHoverExplanationClassName } from '@/lib/campaignHoverTooltip'
import { campaignConceptHref, campaignConceptOneLiner } from '@/lib/campaignIntelligenceConcepts'
import { formatElectionNumber } from '@/lib/electionFormat'
import { cn } from '@/lib/utils'
import {
  DEFAULT_VOTE_ESTIMATE_SCENARIO,
  getVoteEstimateForScenario,
  voteEstimateScenarioLabels,
  voteEstimatesEqual,
  type VoteEstimateScenario,
} from '@/lib/voteEstimate'
import {
  computeGoalCoverageByScenario,
  formatGoalCoverageDeficitLabel,
  formatGoalCoverageRatioLabel,
  goalCoverageProgressPercent,
} from '@/utilities/municipality/goalCoverage'
import type { MunicipalityTerritorialClassification } from '@/utilities/municipality/municipalityTerritorialClass'
import type { MunicipalityV2ContaViewModel } from '@/utilities/municipality/municipalityV2ContaView'

const AUTOSAVE_MS = 600

type MunicipalityV2LocalAccountSectionProps = {
  conta: MunicipalityV2ContaViewModel
  territorialClass: MunicipalityTerritorialClassification
}

const ConceptHint = ({
  conceptId,
  label,
}: {
  conceptId: 'meta' | 'cobertura-da-meta'
  label: string
}) => (
  <CampaignHoverTooltip
    side="bottom"
    align="start"
    content={
      <div className="flex max-w-64 flex-col gap-2 text-sm">
        <p>{campaignConceptOneLiner(conceptId)}</p>
        <Link
          href={campaignConceptHref(conceptId)}
          className="font-medium underline underline-offset-2"
        >
          Ver em Conceitos
        </Link>
      </div>
    }
  >
    <button
      type="button"
      aria-label={`${label}: mais informações`}
      className={cn(
        'inline-flex size-6 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring',
        campaignHoverExplanationClassName,
      )}
    >
      <span aria-hidden="true">?</span>
    </button>
  </CampaignHoverTooltip>
)

export const MunicipalityV2LocalAccountSection = ({
  conta,
  territorialClass,
}: MunicipalityV2LocalAccountSectionProps) => {
  const [activeScenario, setActiveScenario] = useState<VoteEstimateScenario>(
    DEFAULT_VOTE_ESTIMATE_SCENARIO,
  )

  const { value, change, isPending, errorMessage, statusMessage } = useCampaignCellAutosave<
    MunicipalityV2ContaViewModel['expectedVotes'],
    MunicipalityListExpectedVotesResponse
  >({
    value: conta.expectedVotes,
    equals: voteEstimatesEqual,
    endpoint: MUNICIPALITY_EXPECTED_VOTES_ENDPOINT,
    buildBody: (expectedVotes) => ({
      municipalityId: conta.municipalityID,
      expectedVotes,
    }),
    readSaved: (payload) => payload.savedExpectedVotes,
    errorMessage: MUNICIPALITY_EXPECTED_VOTES_SAVE_ERROR_MESSAGE,
    pendingMessage: 'Salvando votos estimados.',
  })

  const coverageByScenario = useMemo(
    () =>
      computeGoalCoverageByScenario(value, conta.suggestedGoalByScenario, conta.pledgeAggregate),
    [value, conta.suggestedGoalByScenario, conta.pledgeAggregate],
  )

  const activeCoverage = coverageByScenario[activeScenario]
  const usesMesaEstimate = getVoteEstimateForScenario(value, activeScenario) != null
  const scenarioLabel = voteEstimateScenarioLabels[activeScenario]
  const scenarioCoverageSummary = `${scenarioLabel}: ${formatGoalCoverageRatioLabel(activeCoverage)}. ${formatGoalCoverageDeficitLabel(activeCoverage)}`

  return (
    <section
      aria-labelledby="municipio-v2-conta-title"
      className="flex flex-col gap-4 rounded-xl border p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1">
          <h2 id="municipio-v2-conta-title" className="text-base font-medium">
            Conta local
          </h2>
          <ConceptHint conceptId="meta" label="Conta local" />
        </div>
        <CampaignInfoHint label="Sobre meta e cobertura">
          <div className="flex flex-col gap-2 text-sm">
            <p>{campaignConceptOneLiner('meta')}</p>
            <p>{campaignConceptOneLiner('cobertura-da-meta')}</p>
            <Link
              href={campaignConceptHref('meta')}
              className="font-medium text-primary underline underline-offset-4"
            >
              Ver em Conceitos
            </Link>
          </div>
        </CampaignInfoHint>
      </div>

      <div
        className="relative flex flex-col gap-2 rounded-lg bg-muted/40 px-3 py-3"
        aria-busy={isPending || undefined}
        data-pending={isPending ? '' : undefined}
      >
        {isPending ? (
          <Spinner
            className="absolute top-3 right-3 size-3.5 text-muted-foreground"
            aria-label="Salvando votos estimados"
          />
        ) : null}
        <VoteEstimateScenarioInputs
          fieldPrefix="expectedVotes"
          values={value}
          idPrefix={`municipality-v2-expected-votes-${conta.municipalityID}`}
          variant="compact"
          activeScenario={activeScenario}
          onFocusScenario={setActiveScenario}
          onValuesChange={(values) => change(values, AUTOSAVE_MS)}
        />
        <p className="text-xs text-muted-foreground tabular-nums">
          Meta ativa ({scenarioLabel}): {formatElectionNumber(activeCoverage.goal)} (
          {usesMesaEstimate ? 'estimativa da mesa' : 'meta sugerida: votação de 2022 aqui'})
        </p>
        {statusMessage ? (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {statusMessage}
          </p>
        ) : null}
        {errorMessage ? (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-1">
            <span className="text-2xl font-semibold tabular-nums">
              {formatGoalCoverageRatioLabel(activeCoverage)}
            </span>
            <ConceptHint conceptId="cobertura-da-meta" label="Cobertura da meta" />
          </div>
          <span className="text-sm text-muted-foreground">Cobertura · {scenarioLabel}</span>
        </div>
        {activeCoverage.coverageRatio != null ? (
          <Progress
            value={goalCoverageProgressPercent(activeCoverage)}
            aria-label={`Cobertura da meta (${scenarioLabel}): ${formatGoalCoverageRatioLabel(activeCoverage)}`}
            className="h-2"
          />
        ) : null}
        <p className="text-xs text-muted-foreground tabular-nums">
          Comprometido nas lideranças: {formatElectionNumber(activeCoverage.committed)} ·{' '}
          {formatGoalCoverageDeficitLabel(activeCoverage)}
        </p>
        <p className="sr-only" aria-live="polite" key={activeScenario}>
          {scenarioCoverageSummary}
        </p>
      </div>

      <div className="border-t pt-3">
        <MunicipalityTerritorialClassRow territorialClass={territorialClass} />
      </div>
    </section>
  )
}
