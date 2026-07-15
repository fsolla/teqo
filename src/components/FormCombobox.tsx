'use client'

import { useCallback, useMemo, useState } from 'react'
import { type FieldPath, type FieldValues, useController, useFormContext } from 'react-hook-form'

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label: string
  keywords?: string[]
}

interface FormComboboxProps<TFieldValues extends FieldValues> {
  name: FieldPath<TFieldValues>
  options: ComboboxOption[]
  id?: string
  placeholder?: string
  /** Minimum characters typed before the list of options is shown. */
  minChars?: number
  disabled?: boolean
  required?: boolean
  emptyMessage?: string
  className?: string
}

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()

export const FormCombobox = <TFieldValues extends FieldValues = FieldValues>({
  name,
  options,
  id,
  placeholder,
  minChars = 3,
  disabled,
  required,
  emptyMessage = 'Nenhum resultado encontrado.',
  className,
}: FormComboboxProps<TFieldValues>) => {
  const { control } = useFormContext<TFieldValues>()
  const {
    field,
    fieldState: { invalid },
  } = useController({ name, control })

  const [open, setOpen] = useState(false)

  const selectedItem = useMemo(
    () => options.find((option) => option.value === field.value) ?? null,
    [options, field.value],
  )

  const filter = useCallback(
    (item: ComboboxOption, query: string) => {
      const normalizedQuery = normalize(query)
      if (normalizedQuery.length < minChars) {
        return false
      }
      return [item.label, item.value, ...(item.keywords ?? [])].some((candidate) =>
        normalize(candidate).startsWith(normalizedQuery),
      )
    },
    [minChars],
  )

  return (
    <Combobox<ComboboxOption>
      items={options}
      value={selectedItem}
      onValueChange={(value) => field.onChange(value ? value.value : '')}
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          setOpen(false)
        }
      }}
      onInputValueChange={(inputValue, details) => {
        setOpen(details.reason === 'input-change' && normalize(inputValue).length >= minChars)
      }}
      openOnInputClick={false}
      filter={filter}
      isItemEqualToValue={(a, b) => a?.value === b?.value}
      disabled={disabled}
    >
      <ComboboxInput
        id={id}
        name={field.name}
        ref={field.ref}
        onBlur={field.onBlur}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        showTrigger={false}
        autoComplete="off"
        aria-invalid={invalid || undefined}
        className={cn(
          'h-auto rounded-full border-(--field-border) bg-(--field-background)',
          className,
        )}
      />
      <ComboboxContent>
        <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
        <ComboboxList>
          {(item: ComboboxOption) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
