'use client'

import { useState } from 'react'
import { XIcon } from 'lucide-react'

import { Badge } from '@/components/ui/Badge'
import { FieldDescription, FieldError } from '@/components/ui/field'
import { InputGroup, InputGroupInput } from '@/components/ui/input-group'
import {
  parseTseZoneNumbers,
  sortedUniqueZoneNumbers,
  TseZoneParseError,
} from '@/utilities/tseZone'

export const TseZoneInput = ({
  value,
  onChange,
  error,
}: {
  value: number[]
  onChange: (zones: number[]) => void
  error?: string
}) => {
  const [draft, setDraft] = useState('')
  const [localError, setLocalError] = useState<string>()
  const visibleError = localError ?? error

  const setZones = (updater: number[] | ((current: number[]) => number[])) => {
    onChange(sortedUniqueZoneNumbers(typeof updater === 'function' ? updater(value) : updater))
  }

  const commit = (raw: string) => {
    if (!raw.trim()) {
      setDraft('')
      return
    }
    try {
      const parsed = parseTseZoneNumbers(raw)
      setZones((current) => [...current, ...parsed])
      setDraft('')
      setLocalError(undefined)
    } catch (parseError) {
      setLocalError(
        parseError instanceof TseZoneParseError ? parseError.message : 'Zona TSE inválida.',
      )
    }
  }

  return (
    <>
      <input type="hidden" name="tseZones" value={value.join(',')} />
      <InputGroup className="min-h-11 h-auto flex-wrap gap-1 p-1">
        {value.map((zoneNumber) => (
          <Badge
            key={zoneNumber}
            asChild
            variant="tse"
            className="h-8 gap-1 rounded-sm px-2.5 py-1"
          >
            <button
              type="button"
              onClick={() => setZones((current) => current.filter((zone) => zone !== zoneNumber))}
              aria-label={`Remover Zona TSE ${zoneNumber}`}
            >
              <span aria-hidden="true">{zoneNumber}</span>
              <XIcon aria-hidden="true" className="size-3" />
            </button>
          </Badge>
        ))}
        <InputGroupInput
          id="tseZoneDraft"
          value={draft}
          inputMode="numeric"
          placeholder="Digite um número e pressione Enter"
          aria-label="Adicionar Zona TSE"
          aria-invalid={Boolean(visibleError)}
          aria-describedby={visibleError ? 'tseZones-error' : 'tseZones-description'}
          className="min-w-48"
          onChange={(event) => {
            const nextValue = event.target.value
            if (!/^[\d,\s]*$/.test(nextValue)) {
              setLocalError('Use apenas números, vírgulas e espaços.')
              return
            }
            setLocalError(undefined)
            if (/[, \t\n]$/.test(nextValue)) commit(nextValue)
            else setDraft(nextValue)
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              commit(draft)
            } else if (event.key === 'Backspace' && !draft && value.length > 0) {
              setZones((current) => current.slice(0, -1))
            }
          }}
          onBlur={() => commit(draft)}
        />
      </InputGroup>
      <FieldDescription id="tseZones-description">
        Use vírgula, espaço ou Enter para adicionar. As Zonas TSE ficam em ordem crescente.
      </FieldDescription>
      {visibleError ? <FieldError id="tseZones-error">{visibleError}</FieldError> : null}
    </>
  )
}
