'use client'

import { PlusIcon } from 'lucide-react'

import { createContactFormAction } from '@/app/(campaign)/campanha/(app)/contatos/formActions'
import { ContactFormSheet } from '@/components/campaign/contacts/ContactFormSheet'

/**
 * C139 — the mobile create FAB (below `md`, same corner as the quick-actions
 * FAB, which the staff contacts page deliberately does not mount): opens the
 * create sheet — the same ficha form, empty, with the state defaulting to BA.
 */
export const ContactCreateFab = () => (
  <ContactFormSheet
    title="Novo contato"
    description="Preencha a ficha da campanha"
    trigger={<PlusIcon className="size-6" aria-hidden="true" />}
    triggerLabel="Novo contato"
    triggerClassName="fixed right-4 bottom-5 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg md:hidden"
    formAction={createContactFormAction}
    defaults={{
      name: '',
      email: '',
      phones: [],
      gender: '',
      state: 'BA',
      city: '',
      postalCode: '',
    }}
    successMessage="Contato criado."
  />
)
