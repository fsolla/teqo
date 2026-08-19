import { StateNames } from '@/lib/states'
import { FormCombobox, type ComboboxOption } from './FormCombobox'

interface StateSelectProps {
  placeholder?: string
  /** S9 — the campaign home capture makes the state optional. Defaults to
   * true so the WhatsApp flow stays as strict as before. */
  required?: boolean
}

const stateOptions: ComboboxOption[] = Object.entries(StateNames)
  .map(([code, name]) => ({ value: code, label: name, keywords: [code] }))
  .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))

export const StateSelect = ({
  placeholder = 'Selecione um estado',
  required = true,
}: StateSelectProps) => {
  return (
    <FormCombobox
      name="state"
      id="state"
      options={stateOptions}
      placeholder={placeholder}
      minChars={1}
      required={required}
      emptyMessage="Nenhum estado encontrado."
    />
  )
}
