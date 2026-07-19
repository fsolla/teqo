'use client'

import { AsyncSearchCombobox } from '@/components/campaign/AsyncSearchCombobox'
import type {
  NucleusPrimaryContactPageData,
  PrimaryContactOption,
} from '@/utilities/primaryContactPageData'

type PrimaryContactComboboxProps = {
  name: string
  current: PrimaryContactOption | null
  search: (query: string) => Promise<NucleusPrimaryContactPageData>
}

const contactLabel = (contact: PrimaryContactOption) =>
  `${contact.name} · ${contact.phone}`

export const PrimaryContactCombobox = ({
  name,
  current,
  search,
}: PrimaryContactComboboxProps) => (
  <AsyncSearchCombobox
    name={name}
    label="Selecionar contato principal"
    value={current ? { id: current.id, label: contactLabel(current) } : null}
    emptyOptionLabel="Sem contato principal"
    dialogDescription="Busque entre as lideranças engajadas deste núcleo."
    search={async (query) => {
      const result = await search(query)
      const limit = result.current ? 99 : 100
      return result.options.slice(0, limit).map((contact) => ({
        id: contact.id,
        label: contactLabel(contact),
      }))
    }}
    pinnedOptions={current ? [{ id: current.id, label: contactLabel(current) }] : []}
    pinnedGroupHeading="Contato atual"
  />
)
