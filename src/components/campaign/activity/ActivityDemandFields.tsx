'use client'

import { PlusIcon, Trash2Icon } from 'lucide-react'
import { useId, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Textarea } from '@/components/ui/textarea'
import { MAX_ACTIVITY_DEMAND_DRAFTS } from '@/lib/schemas/activity'
import { campaignDemandKindLabels, campaignDemandKinds } from '@/lib/schemas/campaignDemand'

type DemandFieldValue = {
  key: string
  title: string
  kind: (typeof campaignDemandKinds)[number]
  description: string
}

let demandKeySequence = 0
const nextDemandKey = (): string => {
  demandKeySequence += 1
  return `demand-${demandKeySequence}`
}

const serializeDemands = (demands: DemandFieldValue[]) =>
  JSON.stringify(
    demands
      .filter((demand) => demand.title.trim())
      .map((demand) => ({
        title: demand.title.trim(),
        kind: demand.kind,
        ...(demand.description.trim() ? { description: demand.description.trim() } : {}),
      })),
  )

export const ActivityDemandFields = ({ error }: { error?: string }) => {
  const fieldId = useId()
  const [demands, setDemands] = useState<DemandFieldValue[]>([])

  const addDemand = () => {
    setDemands((current) => [
      ...current,
      { key: nextDemandKey(), title: '', kind: 'material', description: '' },
    ])
  }

  const updateDemand = (key: string, patch: Partial<DemandFieldValue>) => {
    setDemands((current) =>
      current.map((demand) => (demand.key === key ? { ...demand, ...patch } : demand)),
    )
  }

  const removeDemand = (key: string) => {
    setDemands((current) => current.filter((demand) => demand.key !== key))
  }

  return (
    <Field data-invalid={Boolean(error)}>
      <FieldLabel htmlFor={fieldId}>Demandas vinculadas</FieldLabel>
      <FieldDescription>
        Registre necessidades que surgem desta atividade. Município e atividade serão vinculados
        automaticamente.
      </FieldDescription>
      <input
        type="hidden"
        id={fieldId}
        name="demandsJson"
        value={serializeDemands(demands)}
        readOnly
      />
      <div className="flex flex-col gap-3">
        {demands.map((demand, index) => (
          <div key={demand.key} className="flex flex-col gap-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Demanda {index + 1}</p>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                onClick={() => removeDemand(demand.key)}
                aria-label={`Remover demanda ${index + 1}`}
              >
                <Trash2Icon aria-hidden="true" />
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <Input
                aria-label={`Título da demanda ${index + 1}`}
                placeholder="O que é necessário?"
                value={demand.title}
                minLength={2}
                maxLength={160}
                className="min-h-11"
                onChange={(event) => updateDemand(demand.key, { title: event.target.value })}
                required
              />
              <NativeSelect
                aria-label={`Tipo da demanda ${index + 1}`}
                value={demand.kind}
                onChange={(event) =>
                  updateDemand(demand.key, {
                    kind: event.target.value as DemandFieldValue['kind'],
                  })
                }
                className="min-h-11 w-full"
              >
                {campaignDemandKinds.map((kind) => (
                  <NativeSelectOption key={kind} value={kind}>
                    {campaignDemandKindLabels[kind]}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <Textarea
              aria-label={`Descrição da demanda ${index + 1}`}
              placeholder="Detalhes opcionais"
              value={demand.description}
              rows={2}
              maxLength={4000}
              onChange={(event) => updateDemand(demand.key, { description: event.target.value })}
            />
          </div>
        ))}
      </div>
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-fit"
        onClick={addDemand}
        disabled={demands.length >= MAX_ACTIVITY_DEMAND_DRAFTS}
      >
        <PlusIcon data-icon="inline-start" aria-hidden="true" />
        Adicionar demanda
      </Button>
      {error ? <FieldError id={`${fieldId}-error`}>{error}</FieldError> : null}
    </Field>
  )
}
