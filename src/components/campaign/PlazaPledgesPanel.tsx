import { PledgeEstimateForm } from '@/components/campaign/PledgeEstimateForm'
import { Badge } from '@/components/ui/Badge'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import type { StaffPledgeRow } from '@/utilities/votePledgeData'

const voteFormatter = new Intl.NumberFormat('pt-BR')
const dateFormatter = new Intl.DateTimeFormat('pt-BR')

type PlazaPledgesPanelProps = {
  pledges: StaffPledgeRow[]
  estimateFormAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

/** Staff-only: declared vs estimated votes per leadership in this plaza. */
export const PlazaPledgesPanel = ({ pledges, estimateFormAction }: PlazaPledgesPanelProps) => {
  const declaredTotal = pledges.reduce((total, pledge) => total + pledge.declaredVotes, 0)
  const effectiveTotal = pledges.reduce(
    (total, pledge) => total + (pledge.estimatedVotes ?? pledge.declaredVotes),
    0,
  )

  return (
    <section
      aria-labelledby="plaza-pledges-title"
      className="flex flex-col gap-4 rounded-xl border p-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="plaza-pledges-title" className="text-base font-medium">
          Votos declarados pelas lideranças
        </h2>
        <p className="text-sm text-muted-foreground">
          A liderança informa quantos votos traz; a assessoria registra a estimativa real. A
          liderança nunca vê o valor estimado.
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
              <dt className="text-xs font-medium text-muted-foreground">Total estimado</dt>
              <dd className="text-lg font-medium tabular-nums">
                {voteFormatter.format(effectiveTotal)}
              </dd>
            </div>
          </dl>
          <ul className="flex flex-col gap-4">
            {pledges.map((pledge) => (
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
                  {pledge.estimatedVotes == null ? (
                    <Badge variant="estimate-pending">Sem estimativa</Badge>
                  ) : (
                    <Badge variant="estimate-confirmed">
                      Estimado: {voteFormatter.format(pledge.estimatedVotes)}
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
            ))}
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
