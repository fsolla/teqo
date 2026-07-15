import { CitiesByState } from '@/lib/cities'
import { useEffect, useMemo } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { FormCombobox, type ComboboxOption } from './FormCombobox'

interface CitySelectProps {
  placeholder?: string
}

export const CitySelect = ({ placeholder = 'Selecione uma cidade' }: CitySelectProps) => {
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
      required
      emptyMessage="Nenhuma cidade encontrada."
    />
  )
}
