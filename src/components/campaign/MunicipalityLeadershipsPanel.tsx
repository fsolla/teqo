import { PlusIcon } from 'lucide-react'
import Link from 'next/link'

import { DeclareVotesForm } from '@/components/campaign/DeclareVotesForm'
import { SupportStatusBadge } from '@/components/campaign/SupportStatusBadge'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import type { LeadershipRowViewModel } from '@/utilities/leadershipData'
import type { StaffPledgeRow } from '@/utilities/votePledgeViews'

type MunicipalityLeadershipsPanelProps = {
  municipalityID: number
  leaderships: LeadershipRowViewModel[]
  pledges: StaffPledgeRow[]
  declareFormAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

/** Staff-only: leaderships linked to this municipality + declare-on-behalf form. */
export const MunicipalityLeadershipsPanel = ({
  municipalityID,
  leaderships,
  pledges,
  declareFormAction,
}: MunicipalityLeadershipsPanelProps) => {
  const pledgeByLeadership = new Map(pledges.map((pledge) => [pledge.leadershipID, pledge]))

  return (
    <section aria-labelledby="municipality-leaderships-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 id="municipality-leaderships-title" className="text-base font-medium">
            Lideranças desta Praça
          </h2>
          <p className="text-sm text-muted-foreground">
            Uma liderança pode atuar em várias Praças e organizações.
          </p>
        </div>
        <Button asChild className="min-h-11">
          <Link href={`/campanha/liderancas/nova?municipality=${municipalityID}`}>
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Nova liderança
          </Link>
        </Button>
      </div>

      {leaderships.length ? (
        <ul className="flex flex-col gap-4">
          {leaderships.map((leadership) => {
            const pledge = pledgeByLeadership.get(leadership.id)
            return (
              <li key={leadership.id} className="flex flex-col gap-3 rounded-xl border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <Link
                      href={`/campanha/liderancas/${leadership.id}`}
                      className="min-h-11 content-center font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {leadership.name}
                    </Link>
                    <div className="flex flex-wrap gap-1">
                      {leadership.supportStatus ? (
                        <SupportStatusBadge status={leadership.supportStatus} />
                      ) : null}
                      {leadership.organizationNames.map((name) => (
                        <Badge key={name} variant="outline">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {leadership.municipalityNames.length > 1 ? (
                    <span className="text-sm text-muted-foreground">
                      Atua em {leadership.municipalityNames.length} Praças
                    </span>
                  ) : null}
                </div>
                <DeclareVotesForm
                  municipalityID={municipalityID}
                  leadershipID={leadership.id}
                  currentDeclaredVotes={pledge?.declaredVotes ?? null}
                  formAction={declareFormAction}
                />
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="rounded-xl border px-4 py-6 text-sm text-muted-foreground">
          Nenhuma liderança vinculada a esta Praça ainda.
        </p>
      )}
    </section>
  )
}
