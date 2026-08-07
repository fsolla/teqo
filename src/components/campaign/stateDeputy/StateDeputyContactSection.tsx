'use client'

import { updateStateDeputyContactFormAction } from '@/app/(campaign)/campanha/(app)/dobradinhas/formActions'
import { CampaignInlineEditableCell } from '@/components/campaign/shared/CampaignInlineEditableCell'

type StateDeputyContactSectionProps = {
  stateDeputyId: number
  name: string
  email: string | null
  phone: string | null
}

export const StateDeputyContactSection = ({
  stateDeputyId,
  name,
  email,
  phone,
}: StateDeputyContactSectionProps) => (
  <section aria-labelledby="state-deputy-contact-title" className="flex flex-col gap-3">
    <h2 id="state-deputy-contact-title" className="text-base font-medium">
      Contato
    </h2>
    <dl className="grid gap-3 sm:grid-cols-3">
      <div className="flex flex-col gap-1">
        <dt className="text-sm text-muted-foreground">Nome</dt>
        <dd>
          <CampaignInlineEditableCell
            recordId={stateDeputyId}
            recordIdField="stateDeputyId"
            field="name"
            value={name}
            label="Nome"
            formAction={updateStateDeputyContactFormAction}
          />
        </dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-sm text-muted-foreground">E-mail</dt>
        <dd>
          <CampaignInlineEditableCell
            recordId={stateDeputyId}
            recordIdField="stateDeputyId"
            field="email"
            value={email}
            label="E-mail"
            formAction={updateStateDeputyContactFormAction}
          />
        </dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-sm text-muted-foreground">Telefone</dt>
        <dd>
          <CampaignInlineEditableCell
            recordId={stateDeputyId}
            recordIdField="stateDeputyId"
            field="phone"
            value={phone}
            label="Telefone"
            formAction={updateStateDeputyContactFormAction}
          />
        </dd>
      </div>
    </dl>
  </section>
)
