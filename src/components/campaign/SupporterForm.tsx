'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import type { SupporterFormState } from '@/app/(campaign)/campanha/(app)/apoiadores/novo/formActions'
import { FormattedInput } from '@/components/FormattedInput'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/Checkbox'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/ToggleGroup'
import { formatBrazilianPhoneInput, sanitizeBrazilianPhoneInput } from '@/utilities/phone'
import type { SupporterNucleusOption } from '@/utilities/supporterViewModels'
import { supporterVoteIntentionLabels } from '@/utilities/supporterUi'
import type { SupporterVoteIntention } from '@/lib/schemas/supporter'

export type SupporterFormAction = (
  state: SupporterFormState,
  formData: FormData,
) => Promise<SupporterFormState>

const fieldError = (
  fieldErrors: Record<string, string[]> | undefined,
  field: string,
): string | undefined => fieldErrors?.[field]?.[0]

const errorProps = (fieldErrors: Record<string, string[]> | undefined, field: string) => {
  const error = fieldError(fieldErrors, field)
  return {
    error,
    invalid: Boolean(error),
    describedBy: error ? `supporter-${field}-error` : undefined,
  }
}

const ConsentBlock = ({
  id,
  name,
  title,
  description,
  configured,
  error,
  required = true,
}: {
  id: string
  name: string
  title: string
  description: string
  configured: boolean
  error?: string
  required?: boolean
}) => (
  <section className="rounded-[6px] border bg-muted/30 p-4" aria-labelledby={`${id}-title`}>
    <h2 id={`${id}-title`} className="font-medium">
      {title}
    </h2>
    <p className="mt-1 text-sm text-muted-foreground">{description}</p>
    {!configured ? (
      <Alert variant="destructive" className="mt-3">
        <AlertTitle>Consentimento não configurado</AlertTitle>
        <AlertDescription>
          O texto ainda não foi cadastrado no admin. Não é possível concluir o cadastro.
        </AlertDescription>
      </Alert>
    ) : (
      <Field orientation="horizontal" className="mt-3" data-invalid={Boolean(error)}>
        <Checkbox
          id={id}
          name={name}
          value="true"
          required={required}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : `${id}-help`}
        />
        <FieldContent>
          <FieldLabel htmlFor={id}>Li e confirmo o consentimento do titular *</FieldLabel>
          <FieldDescription id={`${id}-help`}>
            O operador atesta que o apoiador concordou com o uso dos dados conforme o texto
            versionado no admin.
          </FieldDescription>
          {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
        </FieldContent>
      </Field>
    )}
  </section>
)

export const SupporterForm = ({
  action,
  nucleusOptions,
  registrationConsentConfigured,
  voteIntentionConsentConfigured,
  requireNucleus,
}: {
  action: SupporterFormAction
  nucleusOptions: SupporterNucleusOption[]
  registrationConsentConfigured: boolean
  voteIntentionConsentConfigured: boolean
  requireNucleus: boolean
}) => {
  const router = useRouter()
  const [state, formAction, pending] = useActionState(action, {})
  const [voteIntention, setVoteIntention] = useState<SupporterVoteIntention | ''>(
    (state.values?.voteIntention as SupporterVoteIntention | undefined) ?? '',
  )
  const values = state.values

  useEffect(() => {
    if (state.status !== 'success') return
    toast.success(state.message)
    if (state.supporterId) {
      router.push(`/campanha/apoiadores/${state.supporterId}`, { scroll: false })
    }
  }, [router, state.message, state.status, state.supporterId])

  const nameField = errorProps(state.fieldErrors, 'name')
  const phoneField = errorProps(state.fieldErrors, 'phone')
  const emailField = errorProps(state.fieldErrors, 'email')
  const cityField = errorProps(state.fieldErrors, 'city')
  const nucleusField = errorProps(state.fieldErrors, 'nucleus')
  const voteIntentionField = errorProps(state.fieldErrors, 'voteIntention')

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {(state.message || state.fieldErrors?.form) && state.status !== 'success' ? (
        <Alert variant="destructive" aria-live="polite">
          <AlertTitle>Não foi possível cadastrar</AlertTitle>
          <AlertDescription>
            {state.message ? <p>{state.message}</p> : null}
            {state.fieldErrors?.form?.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}

      <FieldGroup>
        <Field data-invalid={nameField.invalid}>
          <FieldLabel htmlFor="supporter-name">Nome *</FieldLabel>
          <Input
            id="supporter-name"
            name="name"
            required
            minLength={2}
            defaultValue={values?.name}
            autoComplete="name"
            aria-invalid={nameField.invalid}
            aria-describedby={nameField.describedBy}
            className="min-h-11 rounded-[6px]"
          />
          {nameField.error ? (
            <FieldError id="supporter-name-error">{nameField.error}</FieldError>
          ) : null}
        </Field>

        <Field data-invalid={phoneField.invalid}>
          <FieldLabel htmlFor="supporter-phone">Celular *</FieldLabel>
          <FormattedInput
            id="supporter-phone"
            name="phone"
            required
            inputMode="tel"
            autoComplete="tel"
            defaultValue={values?.phone ? formatBrazilianPhoneInput(values.phone) : ''}
            format={formatBrazilianPhoneInput}
            sanitize={sanitizeBrazilianPhoneInput}
            aria-invalid={phoneField.invalid}
            aria-describedby={phoneField.describedBy}
            className="min-h-11 rounded-[6px]"
          />
          {phoneField.error ? (
            <FieldError id="supporter-phone-error">{phoneField.error}</FieldError>
          ) : null}
        </Field>

        <Field data-invalid={emailField.invalid}>
          <FieldLabel htmlFor="supporter-email">E-mail</FieldLabel>
          <Input
            id="supporter-email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={values?.email}
            aria-invalid={emailField.invalid}
            aria-describedby={emailField.describedBy}
            className="min-h-11 rounded-[6px]"
          />
          {emailField.error ? (
            <FieldError id="supporter-email-error">{emailField.error}</FieldError>
          ) : null}
        </Field>

        <Field data-invalid={cityField.invalid}>
          <FieldLabel htmlFor="supporter-city">Município</FieldLabel>
          <Input
            id="supporter-city"
            name="city"
            defaultValue={values?.city}
            aria-invalid={cityField.invalid}
            aria-describedby={cityField.describedBy}
            className="min-h-11 rounded-[6px]"
          />
          {cityField.error ? (
            <FieldError id="supporter-city-error">{cityField.error}</FieldError>
          ) : null}
        </Field>

        <Field data-invalid={nucleusField.invalid}>
          <FieldLabel htmlFor="supporter-nucleus">
            Núcleo{requireNucleus ? ' *' : ''}
          </FieldLabel>
          <NativeSelect
            id="supporter-nucleus"
            name="nucleus"
            required={requireNucleus}
            defaultValue={values?.nucleus ?? ''}
            className="w-full **:data-[slot=native-select]:min-h-11 **:data-[slot=native-select]:rounded-[6px]"
          >
            {!requireNucleus ? <NativeSelectOption value="">Sem núcleo</NativeSelectOption> : null}
            {nucleusOptions.map((nucleus) => (
              <NativeSelectOption key={nucleus.id} value={String(nucleus.id)}>
                {nucleus.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {nucleusField.error ? (
            <FieldError id="supporter-nucleus-error">{nucleusField.error}</FieldError>
          ) : null}
        </Field>

        <Field data-invalid={voteIntentionField.invalid}>
          <FieldLabel>Intenção de voto (opcional)</FieldLabel>
          <input type="hidden" name="voteIntention" value={voteIntention} />
          <ToggleGroup
            type="single"
            value={voteIntention}
            onValueChange={(value) => setVoteIntention((value as SupporterVoteIntention) ?? '')}
            variant="outline"
            className="flex w-full flex-wrap"
          >
            {Object.entries(supporterVoteIntentionLabels).map(([value, label]) => (
              <ToggleGroupItem key={value} value={value} className="min-h-11 flex-1">
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {voteIntentionField.error ? (
            <FieldError id="supporter-voteIntention-error">{voteIntentionField.error}</FieldError>
          ) : null}
        </Field>
      </FieldGroup>

      <ConsentBlock
        id="supporter-registration-consent"
        name="consentAccepted"
        title="Consentimento de cadastro"
        description="Confirme que o titular autorizou o cadastro como apoiador."
        configured={registrationConsentConfigured}
        error={fieldError(state.fieldErrors, 'consentAccepted')}
      />

      {voteIntention ? (
        <ConsentBlock
          id="supporter-vote-intention-consent"
          name="voteIntentionConsentAccepted"
          title="Consentimento de intenção de voto"
          description="Dado sensível — exige consentimento destacado separado."
          configured={voteIntentionConsentConfigured}
          error={fieldError(state.fieldErrors, 'voteIntentionConsentAccepted')}
        />
      ) : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => router.push('/campanha/apoiadores', { scroll: false })}
          disabled={pending}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          className="min-h-11"
          disabled={
            pending ||
            !registrationConsentConfigured ||
            (Boolean(voteIntention) && !voteIntentionConsentConfigured)
          }
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? 'Cadastrando…' : 'Cadastrar apoiador'}
        </Button>
      </div>
    </form>
  )
}
