import { StateNames } from '@/lib/states'
import { FormCombobox, type ComboboxOption } from './FormCombobox'

interface StateSelectProps {
  placeholder?: string
}

const stateOptions: ComboboxOption[] = Object.entries(StateNames)
  .map(([code, name]) => ({ value: code, label: name, keywords: [code] }))
  .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))

export const StateSelect = ({ placeholder = 'Selecione um estado' }: StateSelectProps) => {
  return (
    <FormCombobox
      name="state"
      id="state"
      options={stateOptions}
      placeholder={placeholder}
      minChars={1}
      required
      emptyMessage="Nenhum estado encontrado."
    />
  )
}
