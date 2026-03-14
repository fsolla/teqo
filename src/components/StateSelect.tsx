import { useFormContext } from 'react-hook-form'
import { NativeSelect, NativeSelectOption } from './ui/native-select'
import { CitiesByState } from '@/lib/cities'

interface StateSelectProps {
  placeholder?: string
}

export const StateSelect = ({ placeholder = 'Selecione um estado' }) => {
  const { register } = useFormContext()

  return (
    <NativeSelect required {...register('state')}>
      <NativeSelectOption value="">{placeholder}</NativeSelectOption>
      {Object.keys(CitiesByState).map((state) => (
        <NativeSelectOption key={state} value={state}>
          {state}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  )
}
