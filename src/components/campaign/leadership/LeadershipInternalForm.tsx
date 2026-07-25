'use client'

import { useActionState } from 'react'

import { RelationMultiSelect, type RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { leadershipSectors, leadershipSupportStatuses } from '@/lib/schemas/leadership'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'
import type { LeadershipDetailViewModel } from '@/utilities/leadershipData'

const sectorLabels: Record<(typeof leadershipSectors)[number], string> = {
  religioso: 'Religioso',
  sindical: 'Sindical',
  comunitario: 'Comunitário',
  rural: 'Rural',
  empresarial: 'Empresarial',
  juventude: 'Juventude',
  saude: 'Saúde',
  educacao: 'Educação',
  cultura: 'Cultura',
  outro: 'Outro',
}

const supportStatusLabels: Record<(typeof leadershipSupportStatuses)[number], string> = {
  engajado: 'Engajado',
  a_abordar: 'A abordar',
  em_disputa: 'Em disputa',
  negativo: 'Negativo',
}

type LeadershipInternalFormProps = {
  leadership: LeadershipDetailViewModel
  municipalityOptions: RelationOption[]
  organizationOptions: RelationOption[]
  stateDeputyOptions: RelationOption[]
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

/** Staff-only internal evaluation + links (municipalities, organizations). */
export const LeadershipInternalForm = ({
  leadership,
  municipalityOptions,
  organizationOptions,
  stateDeputyOptions,
  formAction,
}: LeadershipInternalFormProps) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})

  return (
    <form action={submitAction} className="flex max-w-2xl flex-col gap-4">
      <input type="hidden" name="leadershipId" value={leadership.id} />

      <RelationMultiSelect
        name="municipalities"
        label="Praças em que atua"
        options={municipalityOptions}
        initialSelectedIDs={leadership.municipalityIDs}
        error={fieldError(state.fieldErrors, 'municipalities')}
        placeholder="Adicionar Praça…"
      />

      <RelationMultiSelect
        name="organizations"
        label="Organizações"
        options={organizationOptions}
        initialSelectedIDs={leadership.organizationIDs}
        error={fieldError(state.fieldErrors, 'organizations')}
        placeholder="Adicionar organização…"
      />

      <RelationMultiSelect
        name="stateDeputies"
        label="Dobradinhas"
        options={stateDeputyOptions}
        initialSelectedIDs={leadership.stateDeputyIDs}
        error={fieldError(state.fieldErrors, 'stateDeputies')}
        placeholder="Adicionar dobradinha…"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="leadership-internal-sector">Setor</FieldLabel>
          <NativeSelect
            id="leadership-internal-sector"
            name="sector"
            defaultValue={leadership.sector ?? ''}
            className="min-h-11 w-full"
          >
            <NativeSelectOption value="">Não informado</NativeSelectOption>
            {leadershipSectors.map((sector) => (
              <NativeSelectOption key={sector} value={sector}>
                {sectorLabels[sector]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
        <Field>
          <FieldLabel htmlFor="leadership-internal-status">Status de apoio</FieldLabel>
          <NativeSelect
            id="leadership-internal-status"
            name="supportStatus"
            defaultValue={leadership.supportStatus ?? 'a_abordar'}
            className="min-h-11 w-full"
          >
            {leadershipSupportStatuses.map((status) => (
              <NativeSelectOption key={status} value={status}>
                {supportStatusLabels[status]}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor="leadership-internal-notes">Observações internas</FieldLabel>
        <Textarea
          id="leadership-internal-notes"
          name="notes"
          rows={3}
          maxLength={3000}
          defaultValue={leadership.notes ?? undefined}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="leadership-internal-consent-note">
          Registro de consentimento externo
        </FieldLabel>
        <Textarea
          id="leadership-internal-consent-note"
          name="consentNote"
          rows={2}
          maxLength={2000}
          defaultValue={leadership.consentNote ?? undefined}
        />
      </Field>

      {state.message && state.status !== 'success' ? (
        <Alert variant="destructive">
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      {state.status === 'success' ? (
        <Alert>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={isPending} className="min-h-11 self-start">
        {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
        Salvar
      </Button>
    </form>
  )
}
