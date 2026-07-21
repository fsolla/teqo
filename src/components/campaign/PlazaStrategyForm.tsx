'use client'

import { useActionState, useState } from 'react'

import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'
import { politicalTrendLabels } from '@/utilities/plazaUi'
import type { PlazaDetailViewModel } from '@/utilities/plazaViewModels'

type FormAction = (
  state: CampaignFormActionState,
  formData: FormData,
) => Promise<CampaignFormActionState>

type PlazaStrategyFormProps = {
  plazaID: number
  strategy: NonNullable<PlazaDetailViewModel['strategy']>
  strategyFormAction: FormAction
  trendFormAction: FormAction
}

const ListEditor = ({
  name,
  label,
  initialItems,
}: {
  name: 'strengths' | 'risks'
  label: string
  initialItems: string[]
}) => {
  const [items, setItems] = useState<string[]>(initialItems)
  const [draft, setDraft] = useState('')

  return (
    <Field>
      <FieldLabel htmlFor={`plaza-${name}-draft`}>{label}</FieldLabel>
      {items.map((item, index) => (
        <div key={`${item}-${index}`} className="flex items-center gap-2">
          <input type="hidden" name={name} value={item} />
          <p className="flex-1 rounded-md border px-3 py-2 text-sm">{item}</p>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11"
            onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))}
          >
            Remover
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Input
          id={`plaza-${name}-draft`}
          value={draft}
          maxLength={1000}
          onChange={(event) => setDraft(event.target.value)}
          className="min-h-11"
          placeholder="Adicionar item…"
        />
        <Button
          type="button"
          variant="secondary"
          className="min-h-11"
          onClick={() => {
            const value = draft.trim()
            if (!value) return
            setItems([...items, value])
            setDraft('')
          }}
        >
          Adicionar
        </Button>
      </div>
    </Field>
  )
}

export const PlazaStrategyForm = ({
  plazaID,
  strategy,
  strategyFormAction,
  trendFormAction,
}: PlazaStrategyFormProps) => {
  const [strategyState, submitStrategy, strategyPending] = useActionState(strategyFormAction, {})
  const [trendState, submitTrend, trendPending] = useActionState(trendFormAction, {})

  return (
    <div className="flex flex-col gap-8">
      <form action={submitStrategy} className="flex flex-col gap-4 rounded-xl border p-4">
        <h2 className="text-base font-medium">Metas e inteligência</h2>
        <input type="hidden" name="plazaId" value={plazaID} />
        <Field>
          <FieldLabel htmlFor="plaza-priority">Prioridade</FieldLabel>
          <NativeSelect
            id="plaza-priority"
            name="priority"
            defaultValue={strategy.priority}
            className="min-h-11 w-full sm:w-56"
          >
            <NativeSelectOption value="normal">Normal</NativeSelectOption>
            <NativeSelectOption value="alta">Prioritária</NativeSelectOption>
          </NativeSelect>
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          {(
            [
              ['goalGood', 'Meta Bom', strategy.voteGoals.good],
              ['goalRegular', 'Meta Regular', strategy.voteGoals.regular],
              ['goalMinimum', 'Meta Mínimo', strategy.voteGoals.minimum],
            ] as const
          ).map(([name, label, value]) => (
            <Field key={name}>
              <FieldLabel htmlFor={`plaza-${name}`}>{label}</FieldLabel>
              <Input
                id={`plaza-${name}`}
                name={name}
                type="number"
                min={0}
                inputMode="numeric"
                defaultValue={value ?? undefined}
                className="min-h-11"
              />
            </Field>
          ))}
        </div>
        {fieldError(strategyState.fieldErrors, 'form') ? (
          <FieldError>{fieldError(strategyState.fieldErrors, 'form')}</FieldError>
        ) : null}
        <ListEditor name="strengths" label="Forças" initialItems={strategy.strengths} />
        <ListEditor name="risks" label="Riscos" initialItems={strategy.risks} />
        <Field>
          <FieldLabel htmlFor="plaza-dobradinha">Dobradinhas (notas)</FieldLabel>
          <Textarea
            id="plaza-dobradinha"
            name="dobradinhaNotes"
            rows={3}
            maxLength={4000}
            defaultValue={strategy.dobradinhaNotes ?? undefined}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="plaza-next-steps">Encaminhamentos</FieldLabel>
          <Textarea
            id="plaza-next-steps"
            name="nextSteps"
            rows={3}
            maxLength={4000}
            defaultValue={strategy.nextSteps ?? undefined}
          />
        </Field>
        {strategyState.message && strategyState.status !== 'success' ? (
          <Alert variant="destructive">
            <AlertDescription>{strategyState.message}</AlertDescription>
          </Alert>
        ) : null}
        {strategyState.status === 'success' ? (
          <Alert>
            <AlertDescription>{strategyState.message}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" disabled={strategyPending} className="min-h-11 self-start">
          {strategyPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
          Salvar estratégia
        </Button>
      </form>

      <form action={submitTrend} className="flex flex-col gap-4 rounded-xl border p-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-medium">Tendência política</h2>
          <p className="text-sm text-muted-foreground">
            Leitura de conjuntura (alianças, prefeitos, disputas locais) — registrada pela
            coordenação ou assessoria.
          </p>
        </div>
        <input type="hidden" name="plazaId" value={plazaID} />
        <Field>
          <FieldLabel htmlFor="plaza-trend-status">Tendência</FieldLabel>
          <NativeSelect
            id="plaza-trend-status"
            name="trendStatus"
            defaultValue={strategy.politicalTrend.status ?? ''}
            className="min-h-11 w-full sm:w-56"
          >
            <NativeSelectOption value="">Não registrada</NativeSelectOption>
            {(Object.keys(politicalTrendLabels) as Array<keyof typeof politicalTrendLabels>).map(
              (status) => (
                <NativeSelectOption key={status} value={status}>
                  {politicalTrendLabels[status]}
                </NativeSelectOption>
              ),
            )}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="plaza-trend-note">Justificativa</FieldLabel>
          <Textarea
            id="plaza-trend-note"
            name="trendNote"
            rows={3}
            maxLength={2000}
            defaultValue={strategy.politicalTrend.note ?? undefined}
          />
        </Field>
        {trendState.message && trendState.status !== 'success' ? (
          <Alert variant="destructive">
            <AlertDescription>{trendState.message}</AlertDescription>
          </Alert>
        ) : null}
        {trendState.status === 'success' ? (
          <Alert>
            <AlertDescription>{trendState.message}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" disabled={trendPending} className="min-h-11 self-start">
          {trendPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
          Registrar tendência
        </Button>
      </form>
    </div>
  )
}
