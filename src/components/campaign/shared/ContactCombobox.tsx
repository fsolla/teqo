'use client'

import { useRef } from 'react'

import { AsyncSearchCombobox } from '@/components/campaign/shared/AsyncSearchCombobox'
import { isContactSearchQueryReady } from '@/lib/contactSearchQuery'

export type ContactComboboxOption = {
  id: number
  name: string
  phone: string | null
}

type ContactComboboxProps = {
  name?: string
  label: string
  current: ContactComboboxOption | null
  search: (query: string) => Promise<ContactComboboxOption[]>
  emptyOptionLabel?: string
  onChange?: (contact: ContactComboboxOption | null) => void
}

const contactLabel = (contact: ContactComboboxOption): string =>
  contact.phone ? `${contact.name} · ${contact.phone}` : contact.name

export const ContactCombobox = ({
  name,
  label,
  current,
  search,
  emptyOptionLabel = 'Nenhum responsável',
  onChange,
}: ContactComboboxProps) => {
  const contactsById = useRef(new Map<number, ContactComboboxOption>())
  if (current) contactsById.current.set(current.id, current)

  return (
    <AsyncSearchCombobox
      name={name}
      label={label}
      value={
        current ? { id: current.id, label: contactLabel(current) } : null
      }
      emptyOptionLabel={emptyOptionLabel}
      dialogDescription="Busque por nome ou celular."
      isQueryReady={isContactSearchQueryReady}
      queryTooShortMessage="Digite ao menos dois caracteres para buscar."
      search={async (query) => {
        const results = await search(query)
        for (const contact of results) contactsById.current.set(contact.id, contact)
        return results.map((contact) => ({
          id: contact.id,
          label: contactLabel(contact),
        }))
      }}
      onChange={(option) =>
        onChange?.(option ? (contactsById.current.get(option.id) ?? null) : null)
      }
    />
  )
}
