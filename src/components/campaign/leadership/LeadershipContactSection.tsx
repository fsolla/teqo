'use client'

import { updateLeadershipContactFormAction } from '@/app/(campaign)/campanha/(app)/liderancas/formActions'
import { CampaignInlineEditableCell } from '@/components/campaign/shared/CampaignInlineEditableCell'

type LeadershipContactSectionProps = {
  leadershipId: number
  name: string
  email: string | null
  phone: string | null
}

export const LeadershipContactSection = ({
  leadershipId,
  name,
  email,
  phone,
}: LeadershipContactSectionProps) => (
  <section aria-labelledby="leadership-contact-title" className="flex flex-col gap-3">
    <h2 id="leadership-contact-title" className="text-base font-medium">
      Contato
    </h2>
    <dl className="grid gap-3 sm:grid-cols-3">
      <div className="flex flex-col gap-1">
        <dt className="text-sm text-muted-foreground">Nome</dt>
        <dd>
          <CampaignInlineEditableCell
            recordId={leadershipId}
            recordIdField="leadershipId"
            field="name"
            value={name}
            label="Nome"
            formAction={updateLeadershipContactFormAction}
            href={`/campanha/liderancas/${leadershipId}`}
          />
        </dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-sm text-muted-foreground">E-mail</dt>
        <dd>
          <CampaignInlineEditableCell
            recordId={leadershipId}
            recordIdField="leadershipId"
            field="email"
            value={email}
            label="E-mail"
            formAction={updateLeadershipContactFormAction}
            readBehavior="copy"
          />
        </dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-sm text-muted-foreground">Celular</dt>
        <dd>
          <CampaignInlineEditableCell
            recordId={leadershipId}
            recordIdField="leadershipId"
            field="phone"
            value={phone}
            label="Celular"
            formAction={updateLeadershipContactFormAction}
            readBehavior="copy"
          />
        </dd>
      </div>
    </dl>
  </section>
)
