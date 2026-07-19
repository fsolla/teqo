'use client'

import { AsyncSearchCombobox } from '@/components/campaign/AsyncSearchCombobox'
import { isContactSearchQueryReady } from '@/lib/contactSearchQuery'
import type { ActionPlanLeadershipOption } from '@/utilities/actionPlanLeadershipOptions'

type LeadershipComboboxProps = {
  name?: string
  label: string
  value: ActionPlanLeadershipOption | null
  search: (query: string) => Promise<ActionPlanLeadershipOption[]>
  emptyOptionLabel?: string
  onChange?: (option: ActionPlanLeadershipOption | null) => void
}

export const LeadershipCombobox = ({
  name,
  label,
  value,
  search,
  emptyOptionLabel = 'Nenhuma',
  onChange,
}: LeadershipComboboxProps) => (
  <AsyncSearchCombobox
    name={name}
    label={label}
    value={value ? { id: value.id, label: value.label } : null}
    emptyOptionLabel={emptyOptionLabel}
    dialogDescription="Busque lideranças engajadas por nome ou celular."
    isQueryReady={isContactSearchQueryReady}
    queryTooShortMessage="Digite ao menos dois caracteres para buscar."
    search={async (query) => {
      const results = await search(query)
      return results.map((option) => ({ id: option.id, label: option.label }))
    }}
    onChange={(option) =>
      onChange?.(option ? { id: option.id, label: option.label } : null)
    }
  />
)
