'use client'

import { MailIcon, MessageCircleIcon, PencilIcon } from 'lucide-react'

import { updateContactFullFormAction } from '@/app/(campaign)/campanha/(app)/contatos/formActions'
import { ContactFormSheet } from '@/components/campaign/contacts/ContactFormSheet'
import { DeletePersonButton } from '@/components/campaign/people/DeletePersonButton'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { formatBrazilianPhoneInput, whatsAppHrefForPhone } from '@/lib/phone'
import type { ContactRowViewModel } from '@/utilities/contacts/contactListData'
import { contactGenderLabels } from '@/utilities/contacts/contactListUrl'

const editTriggerClassName = 'size-10 rounded-full'

/**
 * C139 — the mobile ficha card (below `md`): name + secondary line (primary
 * phone ?? e-mail), gender chip + "Cidade · Estado", and the actions row
 * (WhatsApp / e-mail / edit / delete). Editing opens the shared ficha sheet.
 */
export const ContactMobileCard = ({
  row,
  canDelete,
}: {
  row: ContactRowViewModel
  canDelete: boolean
}) => {
  const whatsAppHref = whatsAppHrefForPhone(row.phones[0] ?? null)
  const secondary =
    row.phones.length > 0
      ? formatBrazilianPhoneInput(row.phones[0]!)
      : (row.email ?? 'Sem contato registrado')
  const place = [row.city, row.state].filter(Boolean).join(' · ')

  return (
    <li className="flex flex-col gap-2 py-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium">{row.name}</p>
          <p className="truncate text-xs text-muted-foreground">{secondary}</p>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {whatsAppHref ? (
            <Button asChild variant="ghost" size="icon" className="size-10">
              <a
                href={whatsAppHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Enviar WhatsApp para ${row.name}`}
              >
                <MessageCircleIcon className="size-4" aria-hidden="true" />
              </a>
            </Button>
          ) : null}
          {row.email ? (
            <Button asChild variant="ghost" size="icon" className="size-10">
              <a href={`mailto:${row.email}`} aria-label={`Enviar e-mail para ${row.name}`}>
                <MailIcon className="size-4" aria-hidden="true" />
              </a>
            </Button>
          ) : null}
          {canDelete ? (
            <DeletePersonButton
              personName={row.name}
              contactId={row.contactID}
              vocabulary="contato"
            />
          ) : null}
          <ContactFormSheet
            title="Editar contato"
            description={row.name}
            trigger={<PencilIcon className="size-4" aria-hidden="true" />}
            triggerLabel={`Editar contato ${row.name}`}
            triggerClassName={editTriggerClassName}
            formAction={updateContactFullFormAction}
            contactId={String(row.contactID)}
            defaults={{
              name: row.name,
              email: row.email ?? '',
              phones: row.phones,
              gender: row.gender ?? '',
              state: row.state ?? 'BA',
              city: row.city ?? '',
              postalCode: row.postalCode ?? '',
            }}
            successMessage="Salvo."
            deleteControl={
              canDelete ? (
                <div className="flex justify-center border-t pt-4">
                  <DeletePersonButton
                    personName={row.name}
                    contactId={row.contactID}
                    vocabulary="contato"
                  />
                </div>
              ) : null
            }
          />
        </div>
      </div>
      {row.gender || place ? (
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {row.gender ? (
            <Badge variant="outline" className="font-normal">
              {contactGenderLabels[row.gender]}
            </Badge>
          ) : null}
          {place ? <span>{place}</span> : null}
        </div>
      ) : null}
    </li>
  )
}
