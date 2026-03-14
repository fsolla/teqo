import { useFormContext, useWatch } from 'react-hook-form'
import { NativeSelect, NativeSelectOption } from './ui/native-select'
import { CitiesByState } from '@/lib/cities'
import { useEffect } from 'react'

interface CitySelectProps {
  placeholder?: string
}

export const CitySelect = ({ placeholder = 'Selecione uma cidade' }: CitySelectProps) => {
  const { register, control, setValue } = useFormContext()
  const state: keyof typeof CitiesByState | undefined = useWatch({
    control,
    name: 'state',
  })

  const cityOptions = state?.length ? CitiesByState[state] : []

  useEffect(() => {
    setValue('city', undefined)
  }, [state])

  return (
    <NativeSelect id="city" {...register('city')} disabled={!cityOptions.length} required>
      <NativeSelectOption value="">{placeholder}</NativeSelectOption>
      {cityOptions.map((city) => (
        <NativeSelectOption key={city} value={city}>
          {city}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
