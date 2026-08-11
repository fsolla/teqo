'use client'

import { updateLeadershipContactFormAction } from '@/app/(campaign)/campanha/(app)/liderancas/formActions'
import { CampaignInlineEditableCell } from '@/components/campaign/shared/CampaignInlineEditableCell'
import { PhonesFieldEditor } from '@/components/campaign/shared/PhonesFieldEditor'

type LeadershipContactSectionProps = {
  leadershipId: number
  name: string
  email: string | null
  /** Every number of the ficha, order = priority (C112) — primary first. */
  phones: string[]
}

export const LeadershipContactSection = ({
  leadershipId,
  name,
  email,
  phones,
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
        <dt className="text-sm text-muted-foreground">
          Celulares <span className="font-normal">(o primeiro é o principal)</span>
        </dt>
        <dd>
          <PhonesFieldEditor
            defaultValues={phones}
            label="Celulares"
            saveAction={updateLeadershipContactFormAction}
            recordId={leadershipId}
            recordIdField="leadershipId"
          />
        </dd>
      </div>
    </dl>
  </section>
)
