'use client'

import { updateStateDeputyContactFormAction } from '@/app/(campaign)/campanha/(app)/dobradinhas/formActions'
import { CampaignInlineEditableCell } from '@/components/campaign/shared/CampaignInlineEditableCell'
import { PhonesFieldEditor } from '@/components/campaign/shared/PhonesFieldEditor'

type StateDeputyContactSectionProps = {
  stateDeputyId: number
  name: string
  email: string | null
  /** C129 — the "nome de legenda" (ballot name), discreet under the name. */
  ballotName: string | null
  /** Every number of the ficha, order = priority (C112) — primary first. */
  phones: string[]
}

export const StateDeputyContactSection = ({
  stateDeputyId,
  name,
  ballotName,
  email,
  phones,
}: StateDeputyContactSectionProps) => (
  <section aria-labelledby="state-deputy-contact-title" className="flex flex-col gap-3">
    <h2 id="state-deputy-contact-title" className="text-base font-medium">
      Contato
    </h2>
    <dl className="grid gap-3 sm:grid-cols-3">
      <div className="flex flex-col gap-1">
        <dt className="text-sm text-muted-foreground">Nome</dt>
        <dd>
          <div className="flex min-w-0 flex-col">
            <CampaignInlineEditableCell
              recordId={stateDeputyId}
              recordIdField="stateDeputyId"
              field="name"
              value={name}
              label="Nome"
              formAction={updateStateDeputyContactFormAction}
              href={`/campanha/dobradinhas/${stateDeputyId}`}
            />
            {ballotName ? (
              <span className="truncate text-xs text-muted-foreground">{ballotName}</span>
            ) : null}
          </div>
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
            readBehavior="copy"
          />
        </dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-sm text-muted-foreground">
          Telefones <span className="font-normal">(o primeiro é o principal)</span>
        </dt>
        <dd>
          <PhonesFieldEditor
            defaultValues={phones}
            label="Telefones"
            saveAction={updateStateDeputyContactFormAction}
            recordId={stateDeputyId}
            recordIdField="stateDeputyId"
          />
        </dd>
      </div>
    </dl>
  </section>
)
