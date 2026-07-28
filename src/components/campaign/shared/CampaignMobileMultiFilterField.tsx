'use client'

import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { orderFilterOptionsSelectedFirst } from '@/lib/listFilterOptions'

type CampaignMobileMultiFilterOption = {
  value: string
  label: string
}

export const CampaignMobileMultiFilterField = ({
  id,
  label,
  emptyLabel,
  options,
  selected,
  onToggle,
}: {
  id: string
  label: string
  emptyLabel: string
  options: CampaignMobileMultiFilterOption[]
  selected: readonly string[]
  onToggle: (value: string) => void
}) => {
  // No snapshot: the NativeSelect closes on every choice, so the next open
  // already wants the just-toggled value at the top.
  const { ordered } = orderFilterOptionsSelectedFirst(options, selected)

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <NativeSelect
        id={id}
        value=""
        onChange={(event) => {
          if (event.target.value) onToggle(event.target.value)
        }}
        className="min-h-11 w-full"
      >
        <NativeSelectOption value="">
          {selected.length ? `${selected.length} selecionado(s) — alterar` : emptyLabel}
        </NativeSelectOption>
        {ordered.map((option) => (
          <NativeSelectOption key={option.value} value={option.value}>
            {selected.includes(option.value) ? `✓ ${option.label}` : option.label}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  )
}
