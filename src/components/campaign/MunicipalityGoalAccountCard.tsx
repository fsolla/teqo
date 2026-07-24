import { CampaignInfoHint } from '@/components/campaign/CampaignInfoHint'
import { MunicipalityListExpectedVotesControl } from '@/components/campaign/MunicipalityListExpectedVotesControl'
import { Progress } from '@/components/ui/Progress'
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

const formatRollOff = (rollOff: RollOff | null): string => {
  if (!rollOff) return 'Sem majoritária seedada (2014/2018)'
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
          <p>
            <strong>Meta</strong> é a estimativa da mesa; sem estimativa, usa a meta sugerida
            (decomposição proporcional da meta estadual pelo teto do campo projetado).{' '}
            <strong>Comprometido</strong> é só a soma das declarações de lideranças — nunca a meta.
            O roll-off (diferença de brancos/nulos entre a disputa de DF e a majoritária) só existe
            para 2022; não há majoritária seedada em 2014/2018.
          </p>
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
          <Progress
            value={goalCoverageProgressPercent(goalCoverage)}
            aria-label={`Cobertura da meta: ${formatGoalCoverageRatioLabel(goalCoverage)}`}
          />
        ) : null}
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatGoalCoverageDeficitLabel(goalCoverage)}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 border-t pt-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted-foreground">Teto do campo (proj.)</dt>
          <dd className="tabular-nums">{formatElectionNumber(Math.round(potential.projectedFieldCeiling))}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Captura (2022)</dt>
          <dd className="tabular-nums">{formatRatioAsPercentLabel(potential.captureRate2022)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Share intracampo ({latestIntraFieldShareYear})</dt>
          <dd className="tabular-nums">{formatRatioAsPercentLabel(latestIntraFieldShare)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Roll-off (2022)</dt>
          <dd className="tabular-nums">{formatRollOff(potential.rollOff2022)}</dd>
        </div>
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
