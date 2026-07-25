import { PledgeEstimateForm } from '@/components/campaign/PledgeEstimateForm'
import { Badge } from '@/components/ui/Badge'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import {
  effectivePledgeVotesForScenario,
  formatVoteEstimateRange,
  getVoteEstimateForScenario,
} from '@/lib/voteEstimate'
import { type StaffPledgeRow } from '@/utilities/votePledgeViews'
import { hasAnyEstimate } from '@/lib/voteEstimate'

const voteFormatter = new Intl.NumberFormat('pt-BR')
const dateFormatter = new Intl.DateTimeFormat('pt-BR')

type MunicipalityPledgesPanelProps = {
  pledges: StaffPledgeRow[]
  estimateFormAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

/** Staff-only: declared vs estimated votes per leadership in this municipality. */
export const MunicipalityPledgesPanel = ({
  pledges,
  estimateFormAction,
}: MunicipalityPledgesPanelProps) => {
  const declaredTotal = pledges.reduce((total, pledge) => total + pledge.declaredVotes, 0)
  const effectiveTotal = pledges.reduce(
    (total, pledge) =>
      total +
      effectivePledgeVotesForScenario(pledge.declaredVotes, pledge.estimatedVotes, 'central'),
    0,
  )

  return (
    <section
      aria-labelledby="municipality-pledges-title"
      className="flex flex-col gap-4 rounded-xl border p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="municipality-pledges-title" className="text-base font-medium">
          Votos declarados pelas lideranças
        </h2>
        <p className="text-sm text-muted-foreground">
          A liderança informa quantos votos traz; a assessoria registra a estimativa real em três
          cenários. A liderança nunca vê o valor estimado.
        </p>
      </div>

      {pledges.length ? (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-muted/40 px-3 py-2">
              <dt className="text-xs font-medium text-muted-foreground">Total declarado</dt>
              <dd className="text-lg font-medium tabular-nums">
                {voteFormatter.format(declaredTotal)}
              </dd>
            </div>
            <div className="rounded-lg bg-muted/40 px-3 py-2">
              <dt className="text-xs font-medium text-muted-foreground">Total estimado (média)</dt>
              <dd className="text-lg font-medium tabular-nums">
                {voteFormatter.format(effectiveTotal)}
              </dd>
            </div>
          </dl>
          <ul className="flex flex-col gap-4">
            {pledges.map((pledge) => {
              const centralEstimate = getVoteEstimateForScenario(pledge.estimatedVotes, 'central')
              const estimateRange = formatVoteEstimateRange(pledge.estimatedVotes)
              return (
                <li key={pledge.id} className="flex flex-col gap-3 rounded-lg border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="font-medium">{pledge.contactName}</span>
                      <span className="text-sm text-muted-foreground">
                        Declarou {voteFormatter.format(pledge.declaredVotes)} votos
                        {pledge.declaredAt
                          ? ` em ${dateFormatter.format(new Date(pledge.declaredAt))}`
                          : ''}
                      </span>
                    </div>
                    {!hasAnyEstimate(pledge.estimatedVotes) ? (
                      <Badge variant="estimate-pending">Sem estimativa</Badge>
                    ) : (
                      <Badge variant="estimate-confirmed">
                        {centralEstimate != null
                          ? `Média: ${voteFormatter.format(centralEstimate)}`
                          : 'Estimativa parcial'}
                        {estimateRange ? ` · ${estimateRange}` : ''}
                      </Badge>
                    )}
                  </div>
                  <PledgeEstimateForm
                    pledgeID={pledge.id}
                    currentEstimatedVotes={pledge.estimatedVotes}
                    currentEstimateNote={pledge.estimateNote}
                    formAction={estimateFormAction}
                  />
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhuma liderança declarou votos nesta Praça ainda.
        </p>
      )}
    </section>
  )
}
