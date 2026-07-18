import Link from 'next/link'
import { CheckCircle2Icon, PencilIcon, StarIcon } from 'lucide-react'

import { LeadershipInviteDialogShell } from '@/components/campaign/LeadershipInviteDialogShell'
import { LeadershipPrimaryContactAction } from '@/components/campaign/LeadershipPrimaryContactAction'
import { SupportStatusBadge } from '@/components/campaign/SupportStatusBadge'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import {
  formatLeadershipPhone,
  leadershipGenderLabels,
  leadershipSectorLabels,
} from '@/utilities/leadershipUi'
import type { LeadershipStaffViewModel } from '@/utilities/leadershipViewModels'

export const LeadershipDetail = ({
  editHref,
  inviteConsentConfigured,
  isPrimaryContact,
  leadership,
  nucleusId,
}: {
  editHref: string
  inviteConsentConfigured: boolean
  isPrimaryContact: boolean
  leadership: LeadershipStaffViewModel
  nucleusId: number
}) => (
  <div className="flex min-h-0 flex-1 flex-col">
    <div className="flex-1 overflow-y-auto px-4 pb-4">
      <div className="flex flex-wrap items-center gap-2">
        <SupportStatusBadge status={leadership.supportStatus} />
        {leadership.confirmedByPerson ? (
          <Badge variant="estimate-confirmed">
            <CheckCircle2Icon data-icon="inline-start" aria-hidden="true" />
            Cadastro confirmado pela pessoa
          </Badge>
        ) : null}
        {isPrimaryContact ? (
          <Badge variant="secondary">
            <StarIcon data-icon="inline-start" aria-hidden="true" />
            Contato principal
          </Badge>
        ) : null}
      </div>

      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium">Celular</dt>
          <dd className="text-muted-foreground">{formatLeadershipPhone(leadership.phone)}</dd>
        </div>
        <div>
          <dt className="font-medium">E-mail</dt>
          <dd className="break-all text-muted-foreground">
            {leadership.email ?? 'Não informado'}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Gênero</dt>
          <dd className="text-muted-foreground">
            {leadership.gender ? leadershipGenderLabels[leadership.gender] : 'Não informado'}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Setor</dt>
          <dd className="text-muted-foreground">
            {leadership.sector ? leadershipSectorLabels[leadership.sector] : 'Não informado'}
          </dd>
        </div>
      </dl>

      {leadership.sectorNotes ? (
        <section className="mt-5">
          <h3 className="font-medium">Observações do setor</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
            {leadership.sectorNotes}
          </p>
        </section>
      ) : null}

      <section className="mt-5">
        <h3 className="font-medium">Observações internas</h3>
        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
          {leadership.notes || 'Nenhuma observação interna registrada.'}
        </p>
      </section>

      {leadership.consentNote ? (
        <section className="mt-5">
          <h3 className="font-medium">Registro de consentimento externo</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
            {leadership.consentNote}
          </p>
        </section>
      ) : null}
    </div>

    <div className="flex flex-col gap-2 border-t p-4">
      {!isPrimaryContact && leadership.supportStatus === 'engajado' ? (
        <LeadershipPrimaryContactAction
          nucleusId={nucleusId}
          contactId={leadership.contactId}
        />
      ) : null}
      <Button asChild variant="outline" className="min-h-11">
        <Link href={editHref}>
          <PencilIcon data-icon="inline-start" aria-hidden="true" />
          Editar avaliação
        </Link>
      </Button>
      <LeadershipInviteDialogShell
        leadershipId={leadership.id}
        supportStatus={leadership.supportStatus}
        consentConfigured={inviteConsentConfigured}
      />
    </div>
  </div>
)
