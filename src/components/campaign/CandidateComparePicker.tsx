'use client'

import { XIcon } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import type { FederalCandidateOption } from '@/utilities/electionCandidateOptions'

type CandidateComparePickerProps = {
  options: FederalCandidateOption[]
  selectedNumbers: number[]
  maxSelected: number
}

/** URL-driven picker: repeated `compare` params on the elections tab. */
export const CandidateComparePicker = ({
  options,
  selectedNumbers,
  maxSelected,
}: CandidateComparePickerProps) => {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const optionByNumber = new Map(options.map((option) => [option.candidateNumber, option]))

  const navigate = (numbers: number[]) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('compare')
    for (const number of numbers) params.append('compare', String(number))
    params.set('tab', 'elections')
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  return (
    <div
      className="flex flex-col gap-2 transition-opacity data-[pending=true]:opacity-70"
      data-pending={isPending || undefined}
      aria-busy={isPending}
    >
      <p className="sr-only" aria-live="polite">
        {isPending ? 'Atualizando comparativo…' : ''}
      </p>
      <Field className="max-w-md">
        <FieldLabel htmlFor="candidate-compare-picker">Comparar com outros candidatos</FieldLabel>
        <NativeSelect
          id="candidate-compare-picker"
          value=""
          disabled={selectedNumbers.length >= maxSelected}
          onChange={(event) => {
            const number = Number(event.target.value)
            if (Number.isInteger(number) && number > 0 && !selectedNumbers.includes(number)) {
              navigate([...selectedNumbers, number])
            }
          }}
          className="min-h-11 w-full"
        >
          <NativeSelectOption value="">
            {selectedNumbers.length >= maxSelected
              ? `Máximo de ${maxSelected} candidatos`
              : 'Adicionar candidato…'}
          </NativeSelectOption>
          {options
            .filter((option) => !selectedNumbers.includes(option.candidateNumber))
            .map((option) => (
              <NativeSelectOption
                key={option.candidateNumber}
                value={String(option.candidateNumber)}
              >
                {option.name}
                {option.party ? ` (${option.party})` : ''} — {option.candidateNumber}
              </NativeSelectOption>
            ))}
        </NativeSelect>
      </Field>
      {selectedNumbers.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {selectedNumbers.map((number) => (
            <li key={number}>
              <Badge variant="secondary" className="gap-1 pr-1">
                {optionByNumber.get(number)?.name ?? `Candidato ${number}`}
                <button
                  type="button"
                  aria-label={`Remover ${optionByNumber.get(number)?.name ?? number} da comparação`}
                  className="inline-flex size-6 items-center justify-center rounded-full hover:bg-foreground/10"
                  onClick={() =>
                    navigate(selectedNumbers.filter((selected) => selected !== number))
                  }
                >
                  <XIcon className="size-3.5" aria-hidden="true" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
