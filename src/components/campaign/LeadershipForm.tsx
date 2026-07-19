'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import type {
  LeadershipFormState,
  LeadershipFormValues,
} from '@/app/(campaign)/campanha/(app)/nucleos/[slug]/leadershipFormActions'
import { FormattedInput } from '@/components/FormattedInput'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/ToggleGroup'
import { leadershipGenderLabels, leadershipSectorLabels } from '@/utilities/leadershipUi'
import type { LeadershipEditViewModel } from '@/utilities/leadershipViewModels'
import { fieldError, errorProps as buildErrorProps } from '@/utilities/campaignFormFields'
import { formatBrazilianPhoneInput, sanitizeBrazilianPhoneInput } from '@/utilities/phone'

export type LeadershipFormAction = (
  state: LeadershipFormState,
  formData: FormData,
) => Promise<LeadershipFormState>

export type LeadershipFormFieldsProps = {
  mode: 'create' | 'edit'
  leadership?: LeadershipEditViewModel
  fieldErrors?: Record<string, string[]>
  values?: LeadershipFormValues
  isPrimaryContact?: boolean
}

const supportStatusOptions = [
  { value: 'engajado', label: 'Engajado' },
  { value: 'a_abordar', label: 'A abordar' },
  { value: 'em_disputa', label: 'Em disputa' },
  { value: 'negativo', label: 'Negativo' },
] as const

const errorProps = (
  fieldErrors: Record<string, string[]> | undefined,
  field: string,
) => buildErrorProps(fieldErrors, field, 'leadership')

export const LeadershipFormFeedback = ({
  message,
  formErrors,
}: {
  message?: string
  formErrors?: string[]
}) => {
  if (!message && !formErrors?.length) return null

  return (
    <Alert id="leadership-form-error" variant="destructive" aria-live="polite" className="mb-4">
      <AlertTitle>Não foi possível salvar</AlertTitle>
      <AlertDescription>
        {message ? <p>{message}</p> : null}
        {formErrors?.map((error) => (
          <p key={error}>{error}</p>
        ))}
      </AlertDescription>
    </Alert>
  )
}

export const LeadershipHiddenFields = ({
  nucleusId,
  leadershipId,
  fieldErrors,
}: {
  nucleusId: number
  leadershipId?: number
  fieldErrors?: Record<string, string[]>
}) => {
  const nucleusError = errorProps(fieldErrors, 'nucleus')
  const idError = errorProps(fieldErrors, 'id')

  return (
    <>
      <input
        type="hidden"
        name="nucleus"
        value={nucleusId}
        aria-invalid={nucleusError.invalid}
        aria-describedby={nucleusError.describedBy}
      />
      {nucleusError.error ? (
        <FieldError id="leadership-nucleus-error">{nucleusError.error}</FieldError>
      ) : null}
      {leadershipId ? (
        <>
          <input
            type="hidden"
            name="id"
            value={leadershipId}
            aria-invalid={idError.invalid}
            aria-describedby={idError.describedBy}
          />
          {idError.error ? <FieldError id="leadership-id-error">{idError.error}</FieldError> : null}
        </>
      ) : null}
    </>
  )
}

export const LeadershipFormFields = ({
  mode,
  leadership,
  fieldErrors,
  values,
  isPrimaryContact = false,
}: LeadershipFormFieldsProps) => {
  const [supportStatus, setSupportStatus] = useState(
    values?.supportStatus ?? leadership?.supportStatus ?? 'a_abordar',
  )
  const statusError = errorProps(fieldErrors, 'supportStatus')

  return (
    <FieldGroup>
      {mode === 'create' ? (
        <>
          <Field data-invalid={errorProps(fieldErrors, 'name').invalid}>
            <FieldLabel htmlFor="leadership-name">Nome *</FieldLabel>
            <Input
              id="leadership-name"
              name="name"
              required
              minLength={2}
              maxLength={120}
              defaultValue={values?.name}
              autoComplete="name"
              className="min-h-11"
              aria-invalid={errorProps(fieldErrors, 'name').invalid}
              aria-describedby={errorProps(fieldErrors, 'name').describedBy}
            />
            {fieldError(fieldErrors, 'name') ? (
              <FieldError id="leadership-name-error">{fieldError(fieldErrors, 'name')}</FieldError>
            ) : null}
          </Field>

          <Field data-invalid={errorProps(fieldErrors, 'phone').invalid}>
            <FieldLabel htmlFor="leadership-phone">Celular (WhatsApp) *</FieldLabel>
            <FormattedInput
              id="leadership-phone"
              name="phone"
              type="tel"
              required
              maxLength={19}
              defaultValue={formatBrazilianPhoneInput(values?.phone ?? '')}
              format={formatBrazilianPhoneInput}
              sanitize={sanitizeBrazilianPhoneInput}
              autoComplete="tel"
              inputMode="tel"
              placeholder="(71) 99999-9999"
              className="min-h-11"
              aria-invalid={errorProps(fieldErrors, 'phone').invalid}
              aria-describedby={
                errorProps(fieldErrors, 'phone').describedBy
                  ? `${errorProps(fieldErrors, 'phone').describedBy} leadership-phone-description`
                  : 'leadership-phone-description'
              }
            />
            <FieldDescription id="leadership-phone-description">
              Se este celular já existir, o contato será reutilizado sem sobrescrever os dados.
            </FieldDescription>
            {fieldError(fieldErrors, 'phone') ? (
              <FieldError id="leadership-phone-error">
                {fieldError(fieldErrors, 'phone')}
              </FieldError>
            ) : null}
          </Field>

          <Field data-invalid={errorProps(fieldErrors, 'email').invalid}>
            <FieldLabel htmlFor="leadership-email">E-mail (opcional)</FieldLabel>
            <Input
              id="leadership-email"
              name="email"
              type="email"
              defaultValue={values?.email}
              autoComplete="email"
              className="min-h-11"
              aria-invalid={errorProps(fieldErrors, 'email').invalid}
              aria-describedby={errorProps(fieldErrors, 'email').describedBy}
            />
            {fieldError(fieldErrors, 'email') ? (
              <FieldError id="leadership-email-error">
                {fieldError(fieldErrors, 'email')}
              </FieldError>
            ) : null}
          </Field>

          <Field data-invalid={errorProps(fieldErrors, 'gender').invalid}>
            <FieldLabel htmlFor="leadership-gender">Gênero</FieldLabel>
            <NativeSelect
              id="leadership-gender"
              name="gender"
              defaultValue={values?.gender ?? ''}
              className="w-full **:data-[slot=native-select]:min-h-11"
              aria-invalid={errorProps(fieldErrors, 'gender').invalid}
              aria-describedby={errorProps(fieldErrors, 'gender').describedBy}
            >
              <NativeSelectOption value="">Não informado</NativeSelectOption>
              {Object.entries(leadershipGenderLabels)
                .filter(([value]) => value !== 'nao_informado')
                .map(([value, label]) => (
                  <NativeSelectOption key={value} value={value}>
                    {label}
                  </NativeSelectOption>
                ))}
            </NativeSelect>
            {fieldError(fieldErrors, 'gender') ? (
              <FieldError id="leadership-gender-error">
                {fieldError(fieldErrors, 'gender')}
              </FieldError>
            ) : null}
          </Field>
        </>
      ) : null}

      <Field data-invalid={errorProps(fieldErrors, 'sector').invalid}>
        <FieldLabel htmlFor="leadership-sector">Setor</FieldLabel>
        <NativeSelect
          id="leadership-sector"
          name="sector"
          defaultValue={values?.sector ?? leadership?.sector ?? ''}
          className="w-full **:data-[slot=native-select]:min-h-11"
          aria-invalid={errorProps(fieldErrors, 'sector').invalid}
          aria-describedby={errorProps(fieldErrors, 'sector').describedBy}
        >
          <NativeSelectOption value="">Não informado</NativeSelectOption>
          {Object.entries(leadershipSectorLabels).map(([value, label]) => (
            <NativeSelectOption key={value} value={value}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {fieldError(fieldErrors, 'sector') ? (
          <FieldError id="leadership-sector-error">{fieldError(fieldErrors, 'sector')}</FieldError>
        ) : null}
      </Field>

      <Field data-invalid={errorProps(fieldErrors, 'sectorNotes').invalid}>
        <FieldLabel htmlFor="leadership-sectorNotes">Observações do setor</FieldLabel>
        <Textarea
          id="leadership-sectorNotes"
          name="sectorNotes"
          defaultValue={values?.sectorNotes ?? leadership?.sectorNotes ?? ''}
          maxLength={1000}
          className="min-h-20"
          aria-invalid={errorProps(fieldErrors, 'sectorNotes').invalid}
          aria-describedby={errorProps(fieldErrors, 'sectorNotes').describedBy}
        />
        {fieldError(fieldErrors, 'sectorNotes') ? (
          <FieldError id="leadership-sectorNotes-error">
            {fieldError(fieldErrors, 'sectorNotes')}
          </FieldError>
        ) : null}
      </Field>

      <FieldSet data-invalid={statusError.invalid}>
        <FieldLegend>Status de apoio *</FieldLegend>
        <input type="hidden" name="supportStatus" value={supportStatus} />
        <ToggleGroup
          type="single"
          value={supportStatus}
          onValueChange={(value) => value && setSupportStatus(value as typeof supportStatus)}
          variant="outline"
          className="flex w-full flex-wrap justify-start"
          aria-invalid={statusError.invalid}
          aria-describedby={statusError.describedBy}
        >
          {supportStatusOptions.map(({ value, label }) => (
            <ToggleGroupItem
              key={value}
              value={value}
              disabled={isPrimaryContact && value !== 'engajado'}
            >
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {isPrimaryContact ? (
          <FieldDescription>
            Escolha outro contato principal antes de retirar o status Engajado.
          </FieldDescription>
        ) : null}
        {statusError.error ? (
          <FieldError id="leadership-supportStatus-error">{statusError.error}</FieldError>
        ) : null}
      </FieldSet>

      <Field data-invalid={errorProps(fieldErrors, 'notes').invalid}>
        <FieldLabel htmlFor="leadership-notes">Observações internas</FieldLabel>
        <Textarea
          id="leadership-notes"
          name="notes"
          defaultValue={values?.notes ?? leadership?.notes ?? ''}
          maxLength={3000}
          className="min-h-24"
          aria-invalid={errorProps(fieldErrors, 'notes').invalid}
          aria-describedby={
            errorProps(fieldErrors, 'notes').error
              ? 'leadership-notes-error leadership-notes-description'
              : 'leadership-notes-description'
          }
        />
        <FieldDescription id="leadership-notes-description">
          Avaliação restrita à coordenação. A liderança nunca recebe este campo.
        </FieldDescription>
        {fieldError(fieldErrors, 'notes') ? (
          <FieldError id="leadership-notes-error">{fieldError(fieldErrors, 'notes')}</FieldError>
        ) : null}
      </Field>

      <Field data-invalid={errorProps(fieldErrors, 'consentNote').invalid}>
        <FieldLabel htmlFor="leadership-consentNote">Registro de consentimento externo</FieldLabel>
        <Textarea
          id="leadership-consentNote"
          name="consentNote"
          defaultValue={values?.consentNote ?? leadership?.consentNote ?? ''}
          maxLength={2000}
          className="min-h-20"
          aria-invalid={errorProps(fieldErrors, 'consentNote').invalid}
          aria-describedby={errorProps(fieldErrors, 'consentNote').describedBy}
        />
        {fieldError(fieldErrors, 'consentNote') ? (
          <FieldError id="leadership-consentNote-error">
            {fieldError(fieldErrors, 'consentNote')}
          </FieldError>
        ) : null}
      </Field>
    </FieldGroup>
  )
}

export type LeadershipFormProps = LeadershipFormFieldsProps & {
  action: LeadershipFormAction
  nucleusId: number
  successHref: string
  cancelHref: string
}

export const LeadershipForm = ({
  action,
  mode,
  nucleusId,
  leadership,
  isPrimaryContact,
  successHref,
  cancelHref,
}: LeadershipFormProps) => {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(action, {})

  useEffect(() => {
    if (state.status !== 'success') return
    toast.success(state.message)
    router.push(successHref, { scroll: false })
  }, [router, state.message, state.status, successHref])

  return (
    <form
      action={formAction}
      className="flex min-h-0 flex-1 flex-col"
      aria-describedby={
        state.message || state.fieldErrors?.form ? 'leadership-form-error' : undefined
      }
    >
      <LeadershipHiddenFields
        nucleusId={nucleusId}
        leadershipId={leadership?.id}
        fieldErrors={state.fieldErrors}
      />
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <LeadershipFormFeedback
          message={state.status !== 'success' ? state.message : undefined}
          formErrors={state.fieldErrors?.form}
        />
        <LeadershipFormFields
          key={state.revision ?? 0}
          mode={mode}
          leadership={leadership}
          fieldErrors={state.fieldErrors}
          values={state.values}
          isPrimaryContact={isPrimaryContact}
        />
      </div>
      <div className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => router.push(cancelHref, { scroll: false })}
          disabled={pending}
        >
          Cancelar
        </Button>
        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? 'Salvando…' : mode === 'create' ? 'Cadastrar liderança' : 'Salvar alterações'}
        </Button>
      </div>
    </form>
  )
}
