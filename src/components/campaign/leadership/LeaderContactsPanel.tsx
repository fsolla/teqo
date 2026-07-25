import { PhoneIcon } from 'lucide-react'

import { LeaderContactForm } from '@/components/campaign/leadership/LeaderContactForm'
import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import { formatBrazilianPhoneInput } from '@/lib/phone'
import type { LeaderContactListItem } from '@/utilities/leaderContactsPageData'

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

type LeaderContactsPanelProps = {
  userName: string
  municipalityOptions: RelationOption[]
  defaultMunicipalityId: number | null
  showMunicipalitySelect: boolean
  registrationConsentConfigured: boolean
  contacts: LeaderContactListItem[]
}

const LeaderContactsList = ({ contacts }: { contacts: LeaderContactListItem[] }) => (
  <section
    aria-labelledby="leader-contacts-list-title"
    className="flex flex-col gap-3 rounded-xl border p-4"
  >
    <h2 id="leader-contacts-list-title" className="text-base font-medium">
      Meus contatos ({contacts.length})
    </h2>

    {contacts.length ? (
      <div className="overflow-hidden rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Celular</TableHead>
              <TableHead>Município</TableHead>
              <TableHead className="hidden sm:table-cell">Cadastro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <TableRow key={contact.id}>
                <TableCell>
                  <div className="flex flex-col gap-0.5">
                    <span className="font-medium">{contact.name}</span>
                    {contact.city ? (
                      <span className="text-xs text-muted-foreground">{contact.city}</span>
                    ) : null}
                  </div>
                </TableCell>
                <TableCell className="tabular-nums">
                  {contact.phone ? (
                    <span className="inline-flex items-center gap-1.5">
                      <PhoneIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      {formatBrazilianPhoneInput(contact.phone)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>{contact.municipalityName ?? '—'}</TableCell>
                <TableCell className="hidden text-muted-foreground sm:table-cell">
                  {dateFormatter.format(new Date(contact.createdAt))}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    ) : (
      <p className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
        Você ainda não cadastrou nenhum contato. Use o formulário acima para começar.
      </p>
    )}
  </section>
)

/**
 * Leader home (lockdown role). Server component: the header and the contacts
 * table render on the server; only the registration form hydrates
 * (`LeaderContactForm` is the client island).
 */
export const LeaderContactsPanel = ({
  userName,
  municipalityOptions,
  defaultMunicipalityId,
  showMunicipalitySelect,
  registrationConsentConfigured,
  contacts,
}: LeaderContactsPanelProps) => (
  <CampaignPageShell>
    <header className="flex flex-col gap-1">
      <h1 className="text-2xl font-semibold tracking-tight">Olá, {userName}</h1>
      <p className="text-muted-foreground">
        Cadastre apoiadores pelo celular. Só você vê os contatos que criou aqui.
      </p>
    </header>

    {municipalityOptions.length === 0 ? (
      <p className="rounded-xl border px-4 py-6 text-sm text-muted-foreground">
        Você ainda não está vinculada a nenhum município. Fale com a assessoria da campanha.
      </p>
    ) : (
      <LeaderContactForm
        municipalityOptions={municipalityOptions}
        defaultMunicipalityId={defaultMunicipalityId}
        showMunicipalitySelect={showMunicipalitySelect}
        registrationConsentConfigured={registrationConsentConfigured}
      />
    )}

    <LeaderContactsList contacts={contacts} />
  </CampaignPageShell>
)
