'use client'

import { XIcon } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'

export type RelationOption = {
  id: number
  name: string
}

type RelationMultiSelectProps = {
  /** FormData field name — repeated hidden inputs, one per selected id. */
  name: string
  label: string
  options: RelationOption[]
  initialSelectedIDs?: number[]
  error?: string
  placeholder?: string
}

/** Select-to-add + removable chips; submits repeated hidden inputs. */
export const RelationMultiSelect = ({
  name,
  label,
  options,
  initialSelectedIDs = [],
  error,
  placeholder = 'Adicionar…',
}: RelationMultiSelectProps) => {
  const [selectedIDs, setSelectedIDs] = useState<number[]>(initialSelectedIDs)
  const optionById = new Map(options.map((option) => [option.id, option]))
  const available = options.filter((option) => !selectedIDs.includes(option.id))
  const selectId = `${name}-multi-select`

  return (
    <Field>
      <FieldLabel htmlFor={selectId}>{label}</FieldLabel>
      {selectedIDs.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {selectedIDs.map((id) => (
            <li key={id}>
              <input type="hidden" name={name} value={id} />
              <Badge variant="secondary" className="gap-1 pr-1">
                {optionById.get(id)?.name ?? `#${id}`}
                <button
                  type="button"
                  aria-label={`Remover ${optionById.get(id)?.name ?? id}`}
                  className="inline-flex size-6 items-center justify-center rounded-full hover:bg-foreground/10"
                  onClick={() => setSelectedIDs(selectedIDs.filter((selected) => selected !== id))}
                >
                  <XIcon className="size-3.5" aria-hidden="true" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <NativeSelect
        id={selectId}
        value=""
        onChange={(event) => {
          const id = Number(event.target.value)
          if (Number.isInteger(id) && id > 0 && !selectedIDs.includes(id)) {
            setSelectedIDs([...selectedIDs, id])
          }
        }}
        className="min-h-11 w-full"
        aria-invalid={error ? true : undefined}
      >
        <NativeSelectOption value="">{placeholder}</NativeSelectOption>
        {available.map((option) => (
          <NativeSelectOption key={option.id} value={String(option.id)}>
            {option.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
      {error ? <FieldError>{error}</FieldError> : null}
    </Field>
  )
}
