'use client'

import { useActionState } from 'react'

import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import {
  RelationMultiSelect,
  type RelationOption,
} from '@/components/campaign/shared/RelationMultiSelect'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { leadershipSectors, leadershipSupportStatuses } from '@/lib/schemas/leadership'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'
import { supportStatusLabels } from '@/utilities/leadership/leadershipLabels'

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

type LeadershipFormProps = {
  municipalityOptions: RelationOption[]
  organizationOptions: RelationOption[]
  stateDeputyOptions: RelationOption[]
  initialMunicipalityIDs: number[]
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

export const LeadershipForm = ({
  municipalityOptions,
  organizationOptions,
  stateDeputyOptions,
  initialMunicipalityIDs,
  formAction,
}: LeadershipFormProps) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})

  return (
    <form action={submitAction} className="flex max-w-2xl flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="leadership-name">Nome completo</FieldLabel>
        <Input
          id="leadership-name"
          name="name"
          required
          minLength={2}
          maxLength={120}
          className="min-h-11"
        />
        {fieldError(state.fieldErrors, 'name') ? (
          <FieldError>{fieldError(state.fieldErrors, 'name')}</FieldError>
        ) : null}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="leadership-phone">Celular (com DDD)</FieldLabel>
          <Input
            id="leadership-phone"
            name="phone"
            type="tel"
            required
            autoComplete="tel-national"
            className="min-h-11"
          />
          {fieldError(state.fieldErrors, 'phone') ? (
            <FieldError>{fieldError(state.fieldErrors, 'phone')}</FieldError>
          ) : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="leadership-email">E-mail (opcional)</FieldLabel>
          <Input id="leadership-email" name="email" type="email" className="min-h-11" />
          {fieldError(state.fieldErrors, 'email') ? (
            <FieldError>{fieldError(state.fieldErrors, 'email')}</FieldError>
          ) : null}
        </Field>
      </div>

      <RelationMultiSelect
        name="municipalities"
        label="Municípios em que atua"
        options={municipalityOptions}
        initialSelectedIDs={initialMunicipalityIDs}
        error={fieldError(state.fieldErrors, 'municipalities')}
        placeholder="Adicionar município…"
      />

      <RelationMultiSelect
        name="organizations"
        label="Organizações (sindicatos, associações…)"
        options={organizationOptions}
        error={fieldError(state.fieldErrors, 'organizations')}
        placeholder="Adicionar organização…"
      />

      <RelationMultiSelect
        name="stateDeputies"
        label="Dobradinhas"
        options={stateDeputyOptions}
        error={fieldError(state.fieldErrors, 'stateDeputies')}
        placeholder="Adicionar dobradinha…"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="leadership-sector">Setor</FieldLabel>
          <NativeSelect
            id="leadership-sector"
            name="sector"
            defaultValue=""
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
          <FieldLabel htmlFor="leadership-status">Status de apoio</FieldLabel>
          <NativeSelect
            id="leadership-status"
            name="supportStatus"
            defaultValue="a_abordar"
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
        <FieldLabel htmlFor="leadership-notes">Observações internas</FieldLabel>
        <Textarea id="leadership-notes" name="notes" rows={3} maxLength={3000} />
      </Field>
      <Field>
        <FieldLabel htmlFor="leadership-consent-note">Registro de consentimento externo</FieldLabel>
        <Textarea id="leadership-consent-note" name="consentNote" rows={2} maxLength={2000} />
      </Field>

      {state.status !== 'success' ? <CampaignFormActionMessage state={state} /> : null}
      <Button type="submit" disabled={isPending} className="min-h-11 self-start">
        {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
        Cadastrar liderança
      </Button>
    </form>
  )
}
