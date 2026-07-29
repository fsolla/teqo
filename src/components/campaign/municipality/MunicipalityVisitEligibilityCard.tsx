import { ArrowRightIcon, CheckIcon, MinusIcon } from 'lucide-react'
import Link from 'next/link'

import { CampaignInfoHint } from '@/components/campaign/shared/CampaignInfoHint'
import { CalendarPhaseNote } from '@/components/campaign/tour/CalendarPhaseNote'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { CAMPAIGN_CONCEPTS_PATH, campaignConceptHref } from '@/lib/campaignIntelligenceConcepts'
import type { CalendarPhase } from '@/lib/visitPlannerAnchors'
import {
  visitConditionLabels,
  visitContraindicationLabels,
  type VisitCondition,
} from '@/utilities/visit/visitEligibility'
import { buildTourComposerHref } from '@/utilities/visit/visitPlannerUrl'
import type { VisitCandidateViewModel } from '@/utilities/visit/visitPlannerViews'

/**
 * One condition of the checklist. The reason is ALWAYS visible text, never a
 * `title` attribute or a tooltip — E10's rule, for the same reason: a bare ✓/—
 * reads as a verdict, and a verdict nobody can audit is what makes the mesa
 * stop trusting the tool.
 */
const ConditionRow = ({ condition }: { condition: VisitCondition }) => (
  <li className="flex items-start gap-2.5">
    <span
      aria-hidden="true"
      className={
        condition.met
          ? 'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary'
          : 'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground'
      }
    >
      {condition.met ? <CheckIcon className="size-3.5" /> : <MinusIcon className="size-3.5" />}
    </span>
    <span className="flex flex-col gap-0.5">
      <span className="text-sm font-medium">
        {visitConditionLabels[condition.id]}
        <span className="sr-only">{condition.met ? ': atendida' : ': não atendida'}</span>
      </span>
      <span className="text-xs text-muted-foreground">{condition.detail}</span>
    </span>
  </li>
)

/**
 * E13 — "vale a pena levar o candidato aqui?" as five conditions, never a
 * score (research report §6.4: a composite 0–100 buys false confidence that
 * the underlying data does not support).
 *
 * The count in the header is a count, not a grade: it says how many of the five
 * are clear, and every row below says which and why. A contraindication is an
 * ADVISORY with the counter-offer next to it — the coordination overrides it
 * whenever politics outweighs the numbers ("a geografia serve à política").
 */
export const MunicipalityVisitEligibilityCard = ({
  candidate,
  phase,
}: {
  candidate: VisitCandidateViewModel
  phase: CalendarPhase
}) => {
  const { eligibility } = candidate
  const contraindication = eligibility.contraindication

  return (
    <section
      aria-labelledby="municipality-visit-eligibility-title"
      className="flex flex-col gap-4 rounded-xl border p-4"
    >
      <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
        <h2 id="municipality-visit-eligibility-title" className="text-base font-medium">
          Elegibilidade para visita
        </h2>
        <CampaignInfoHint label="Sobre a elegibilidade para visita">
          <div className="flex flex-col gap-2">
            <p>
              A visita vale o que a rede local converte dela — por isso a leitura é uma{' '}
              <strong>checklist de cinco condições</strong>, e não uma nota. Exigir as cinco é o
              critério; o número no topo só diz quantas estão claras.
            </p>
            <p>
              O aviso de contraindicação nunca bloqueia: a coordenação decide contra ele quando a
              política pede.
            </p>
            <Link
              href={campaignConceptHref('elegibilidade-para-visita')}
              className="font-medium text-primary underline underline-offset-4"
            >
              Como cada condição é avaliada
            </Link>
            <Link
              href={CAMPAIGN_CONCEPTS_PATH}
              className="font-medium text-primary underline underline-offset-4"
            >
              Todos os conceitos
            </Link>
          </div>
        </CampaignInfoHint>
        <span className="ml-auto text-sm text-muted-foreground tabular-nums">
          {eligibility.metCount} de {eligibility.conditions.length} condições
        </span>
      </div>

      <CalendarPhaseNote phase={phase} />

      <ul className="flex flex-col gap-3">
        {eligibility.conditions.map((condition) => (
          <ConditionRow key={condition.id} condition={condition} />
        ))}
      </ul>

      {contraindication ? (
        <Alert variant={contraindication.id === 'perdida' ? 'destructive' : 'pending'}>
          <AlertTitle>{visitContraindicationLabels[contraindication.id]}</AlertTitle>
          <AlertDescription className="flex flex-col gap-1">
            <span>{contraindication.reason}</span>
            <span className="font-medium">{contraindication.counterOffer}</span>
          </AlertDescription>
        </Alert>
      ) : null}

      <Button asChild variant="outline" className="min-h-11 w-fit">
        <Link href={buildTourComposerHref({ region: candidate.region })}>
          Planejar giro em {candidate.region}
          <ArrowRightIcon aria-hidden="true" />
          <span className="sr-only">, a partir de {candidate.name}</span>
        </Link>
      </Button>
    </section>
  )
}
