import Link from 'next/link'
import type { ReactNode } from 'react'

import { CampaignInfoHint } from '@/components/campaign/CampaignInfoHint'
import { MunicipalityHoverTooltip } from '@/components/campaign/MunicipalityHoverTooltip'
import { MunicipalityListExpectedVotesControl } from '@/components/campaign/MunicipalityListExpectedVotesControl'
import { Progress } from '@/components/ui/Progress'
import {
  CAMPAIGN_CONCEPTS_PATH,
  campaignConceptHref,
  type CampaignConceptId,
} from '@/lib/campaignIntelligenceConcepts'
import { formatElectionNumber } from '@/lib/electionInsights'
import {
  formatGoalCoverageDeficitLabel,
  formatGoalCoverageRatioLabel,
  formatRatioAsPercentLabel,
  goalCoverageProgressPercent,
  type MunicipalityGoalCoverage,
} from '@/utilities/goalCoverage'
import type { MunicipalityPotential, RollOff } from '@/utilities/municipalityPotential'
import type { VoteEstimateScenarioViewModel } from '@/utilities/voteEstimate'
import type { MunicipalityPledgeCoverageView } from '@/utilities/votePledgeData'

/**
 * One `dt`/`dd` pair in the diagnostic grid, with a hover/focus/tap tooltip
 * explaining the metric — deliberately not the "?" icon button pattern used
 * by `CampaignInfoHint` in the card title (that stays reserved for
 * card-level context that persists open; this is a per-metric definition
 * that dismisses on its own), per the E8 UI feedback: these are dense
 * numbers that need an inline explanation, not a separate affordance to
 * seek out. Reuses `MunicipalityHoverTooltip` (same shadcn Tooltip stack
 * wired for baseline/sortable-header hints), which handles the tap-to-open
 * itself.
 *
 * A real `<button>` (not a `div` with `tabIndex`) so the tap target is
 * reliably focusable/clickable on touch, sized to the 44px target, and
 * announced with its own accessible name — a screen-reader user tabbing in
 * hears "mais informações" up front instead of discovering extra content
 * only by opening it. `side="right"` keeps the bubble off the vertical axis
 * this row shares with "Cobertura da meta" above, so a viewport-bottom
 * collision flip never covers that figure (`/impeccable critique` finding).
 */
const GoalAccountMetric = ({
  label,
  value,
  explanation,
}: {
  label: string
  value: string
  explanation: ReactNode
}) => (
  <MunicipalityHoverTooltip content={explanation} side="right" align="start" sideOffset={8}>
    <button
      type="button"
      aria-label={`${label}: mais informações`}
      className="flex min-h-11 w-fit flex-col items-start gap-0.5 rounded-md px-1.5 py-1 text-left outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <dt className="text-xs text-muted-foreground underline decoration-dotted decoration-muted-foreground/70 underline-offset-2">
        {label}
      </dt>
      <dd className="tabular-nums">{value}</dd>
    </button>
  </MunicipalityHoverTooltip>
)

/**
 * Two-tier tooltip copy: a short lead sentence naming what the metric
 * measures (its one bolded term), then a visually secondary formula line —
 * split per the E8 `/impeccable critique` finding that a single ~40-word
 * sentence with three technical terms didn't resolve the coordinator's
 * confusion. `formula` sits at `text-background/70` (tooltip content is
 * dark, so this lightens rather than muting against a light background).
 *
 * `conceptID` appends E18's "Saiba mais" deep link (every caller documents
 * one, so this is required, not optional). The tooltip content is hoverable
 * (Radix keeps it open while the pointer is inside) and its own touch-dismiss
 * ignores taps on the content, so mouse and touch both reach the link; a
 * keyboard user can't tab into tooltip content, which is why the card
 * title's `CampaignInfoHint` Popover carries the same link.
 */
const MetricExplanation = ({
  lead,
  formula,
  conceptID,
}: {
  lead: ReactNode
  formula?: ReactNode
  conceptID: CampaignConceptId
}) => (
  <div className="flex flex-col gap-1">
    <p>{lead}</p>
    {formula ? <p className="text-background/70">{formula}</p> : null}
    <Link href={campaignConceptHref(conceptID)} className="font-medium underline underline-offset-2">
      Saiba mais
    </Link>
  </div>
)

const formatRollOff = (rollOff: RollOff | null): string => {
  if (!rollOff) return 'Sem majoritária 2022 disponível'
  const votesLabel = formatElectionNumber(rollOff.votes)
  const percentLabel =
    rollOff.percentOfTurnout != null
      ? ` (${formatRatioAsPercentLabel(rollOff.percentOfTurnout)} do comparecimento)`
      : ''
  return `${votesLabel}${percentLabel}`
}

/**
 * E8 "conta da cadeira" — meta × comprometido para este município, com o
 * bloco de diagnóstico (teto do campo, captura, share intracampo, roll-off).
 * Cenário fixo `central`: o detalhe não tem seletor de cenário (a lista e o
 * dashboard têm).
 */
export const MunicipalityGoalAccountCard = ({
  municipalityID,
  expectedVotes,
  pledgeCoverage,
  suggestedGoal,
  goalCoverage,
  potential,
}: {
  municipalityID: number
  expectedVotes: VoteEstimateScenarioViewModel
  pledgeCoverage: MunicipalityPledgeCoverageView | null
  suggestedGoal: number
  goalCoverage: MunicipalityGoalCoverage
  potential: MunicipalityPotential
}) => {
  const usesMesaEstimate = expectedVotes.central != null
  const latestIntraFieldShareYear = Math.max(
    ...Object.keys(potential.intraFieldShareByYear).map(Number),
  )
  const latestIntraFieldShare = potential.intraFieldShareByYear[latestIntraFieldShareYear] ?? null

  return (
    <section
      aria-labelledby="municipality-goal-account-title"
      className="flex flex-col gap-4 rounded-xl border p-4"
    >
      <div className="flex items-center gap-1">
        <h2 id="municipality-goal-account-title" className="text-base font-medium">
          Conta da cadeira
        </h2>
        <CampaignInfoHint label="Sobre a conta da cadeira">
          <div className="flex flex-col gap-2">
            <p>
              <strong>Meta</strong> é a estimativa da mesa; sem estimativa, usa a meta sugerida
              (decomposição proporcional da meta estadual pelo teto do campo projetado).
            </p>
            <p>
              <strong>Comprometido</strong> é só a soma das declarações de lideranças — nunca a
              meta.
            </p>
            <p>
              O roll-off e o teto do campo (abaixo) só usam 2022 — a majoritária de 2014/2018 já
              foi importada, mas ainda não entra nessas contas.
            </p>
            {/*
              Keyboard path into E18's documentation: Popover content is
              tabbable, tooltip content is not, so this link (unlike the
              per-metric ones) is reachable without a pointer.
            */}
            <Link
              href={CAMPAIGN_CONCEPTS_PATH}
              className="font-medium text-primary underline underline-offset-4"
            >
              Como cada número é calculado
            </Link>
          </div>
        </CampaignInfoHint>
      </div>

      <div className="rounded-lg bg-muted/40 px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground">Votos estimados</p>
        <MunicipalityListExpectedVotesControl
          municipalityID={municipalityID}
          expectedVotes={expectedVotes}
          pledgeCoverage={pledgeCoverage}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Meta usada na conta: {formatElectionNumber(goalCoverage.goal)} (
          {usesMesaEstimate ? 'estimativa da mesa' : 'meta sugerida, decomposição da meta estadual'})
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-2xl font-semibold tabular-nums">
            {formatGoalCoverageRatioLabel(goalCoverage)}
          </span>
          <span className="text-sm text-muted-foreground">Cobertura da meta</span>
        </div>
        {goalCoverage.coverageRatio != null ? (
          // h-2 (vs. the shared default h-1): at 0% coverage — the most common
          // early-campaign state — the empty track is the only visual signal,
          // and a 4px hairline read as near-invisible in the E8
          // `/impeccable critique`.
          <Progress
            value={goalCoverageProgressPercent(goalCoverage)}
            aria-label={`Cobertura da meta: ${formatGoalCoverageRatioLabel(goalCoverage)}`}
            className="h-2"
          />
        ) : null}
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatGoalCoverageDeficitLabel(goalCoverage)}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 border-t pt-3 text-sm sm:grid-cols-4">
        <GoalAccountMetric
          label="Teto do campo (proj.)"
          value={formatElectionNumber(Math.round(potential.projectedFieldCeiling))}
          explanation={
            <MetricExplanation
              lead={
                <>
                  <strong>Teto do campo</strong> projeta quantos votos válidos o campo pode
                  alcançar em 2026.
                </>
              }
              formula="Fórmula: votos do presidencial do campo em 2022 (1º turno), ajustados pelo crescimento de comparecimento projetado para a disputa de deputado federal."
              conceptID="teto-do-campo"
            />
          }
        />
        <GoalAccountMetric
          label="Captura (2022)"
          value={formatRatioAsPercentLabel(potential.captureRate2022)}
          explanation={
            <MetricExplanation
              lead={
                <>
                  <strong>Captura</strong> mostra quanto do teto do campo Jorge Solla conquistou
                  em 2022.
                </>
              }
              formula="Fórmula: votos de Solla (2022) ÷ teto do campo (presidencial 2022). Só diagnóstico — não entra na meta."
              conceptID="captura"
            />
          }
        />
        <GoalAccountMetric
          label={`Share intracampo (${latestIntraFieldShareYear})`}
          value={formatRatioAsPercentLabel(latestIntraFieldShare)}
          explanation={
            <MetricExplanation
              lead={
                <>
                  <strong>Share intracampo</strong> mostra a fração dos votos do campo, só na
                  disputa de deputado federal, que foi para Jorge Solla nesse ano.
                </>
              }
              formula="O denominador é o próprio campo nessa disputa — não o teto presidencial de 2022, que é o denominador da Captura."
              conceptID="share-intracampo"
            />
          }
        />
        <GoalAccountMetric
          label="Roll-off (2022)"
          value={formatRollOff(potential.rollOff2022)}
          explanation={
            <MetricExplanation
              lead={
                <>
                  <strong>Roll-off</strong> mede quanto voto em branco/nulo a disputa de deputado
                  federal atrai a mais que a presidencial, no mesmo pleito.
                </>
              }
              formula="Fórmula: (brancos + nulos, deputado federal 2022) − (brancos + nulos, presidencial 2022)."
              conceptID="roll-off"
            />
          }
        />
      </dl>
      {suggestedGoal <= 0 ? (
        <p className="text-xs text-muted-foreground">
          Sem teto do campo projetado para decompor uma meta sugerida — cadastre a estimativa da
          mesa manualmente.
        </p>
      ) : null}
    </section>
  )
}
