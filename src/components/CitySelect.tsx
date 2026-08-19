import { CitiesByState } from '@/lib/cities'
import { useEffect, useMemo } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { FormCombobox, type ComboboxOption } from './FormCombobox'

interface CitySelectProps {
  placeholder?: string
  /** S9 — the campaign home capture makes the city optional (the select
   * stays disabled until a state is picked). Defaults to true so the WhatsApp
   * flow stays as strict as before. */
  required?: boolean
}

export const CitySelect = ({
  placeholder = 'Selecione uma cidade',
  required = true,
}: CitySelectProps) => {
  const { control, setValue } = useFormContext()
  const state: keyof typeof CitiesByState | undefined = useWatch({
    control,
    name: 'state',
  })

  const options = useMemo<ComboboxOption[]>(
    () =>
      state
        ? CitiesByState[state]
            .map((city) => ({ value: city, label: city }))
            .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
        : [],
    [state],
  )

  useEffect(() => {
    setValue('city', '')
  }, [state, setValue])

  return (
    <FormCombobox
      name="city"
      id="city"
      options={options}
      placeholder={placeholder}
      minChars={1}
      disabled={!options.length}
      required={required}
      emptyMessage="Nenhuma cidade encontrada."
    />
  )
}
