'use client'

import { useEffect, useState } from 'react'

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import type { StrictComboboxOption } from '@/utilities/territoryComboboxOptions'
import { matchesAtWordStart, normalizeSearchPhrase } from '@/lib/wordStartFilter'

type StrictComboboxProps = {
  id: string
  options: StrictComboboxOption[]
  value: string
  onValueChange: (value: string) => void
  onInvalid?: () => void
  error?: string
}

export const StrictCombobox = ({
  id,
  options,
  value,
  onValueChange,
  onInvalid,
  error,
}: StrictComboboxProps) => {
  const selected = options.find((option) => option.value === value) ?? null
  const [inputValue, setInputValue] = useState(selected?.label ?? '')

  useEffect(() => {
    setInputValue(selected?.label ?? '')
  }, [selected?.label])

  return (
    <Combobox<StrictComboboxOption>
      items={options}
      value={selected}
      inputValue={inputValue}
      onInputValueChange={setInputValue}
      onValueChange={(option) => {
        setInputValue(option?.label ?? '')
        onValueChange(option?.value ?? '')
      }}
      filter={(option, query) => matchesAtWordStart(option.label, query)}
      isItemEqualToValue={(left, right) => left?.value === right?.value}
    >
      <ComboboxInput
        id={id}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        className="min-h-11 rounded-[6px]"
        showClear={Boolean(value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        onBlur={(event) => {
          const normalized = normalizeSearchPhrase(event.currentTarget.value)
          const exact = options.find(
            (option) => normalizeSearchPhrase(option.label) === normalized,
          )
          if (normalized && !exact) {
            setInputValue('')
            onValueChange('')
            onInvalid?.()
          } else if (exact) {
            setInputValue(exact.label)
            onValueChange(exact.value)
          } else {
            setInputValue('')
            onValueChange('')
          }
        }}
      />
      <ComboboxContent>
        <ComboboxEmpty>Nenhuma opção encontrada.</ComboboxEmpty>
        <ComboboxList>
          {(option: StrictComboboxOption) => (
            <ComboboxItem key={option.value} value={option}>
              {option.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
