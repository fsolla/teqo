'use client'

import { UserPlusIcon } from 'lucide-react'
import { useActionState, useState } from 'react'

import {
  createLeaderSupporterFormAction,
  type LeaderSupporterFormState,
} from '@/app/(campaign)/campanha/actions/leaderSupporter'
import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import { PhonesFieldEditor } from '@/components/campaign/shared/PhonesFieldEditor'
import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { StrictCombobox } from '@/components/campaign/shared/StrictCombobox'
import { useCampaignFormSuccessToast } from '@/components/campaign/shared/useCampaignFormSuccessToast'
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
import { errorProps as buildErrorProps, fieldError } from '@/utilities/campaignFormFields'
import { municipalityComboboxOptions } from '@/utilities/territory/territoryComboboxOptions'

const errorProps = (fieldErrors: Record<string, string[]> | undefined, field: string) =>
  buildErrorProps(fieldErrors, field, 'leader-contact')

export type LeaderContactFormProps = {
  municipalityOptions: RelationOption[]
  defaultMunicipalityId: number | null
  showMunicipalitySelect: boolean
  registrationConsentConfigured: boolean
}

export const LeaderContactForm = ({
  municipalityOptions,
  defaultMunicipalityId,
  showMunicipalitySelect,
  registrationConsentConfigured,
}: LeaderContactFormProps) => {
  const [state, formAction, pending] = useActionState<LeaderSupporterFormState, FormData>(
    createLeaderSupporterFormAction,
    {},
  )
  const [city, setCity] = useState<string>((state.values?.city as string | undefined) ?? '')
  const values = state.values

  useCampaignFormSuccessToast(state)

  const nameField = errorProps(state.fieldErrors, 'name')
  const cityField = errorProps(state.fieldErrors, 'city')
  const municipalityField = errorProps(state.fieldErrors, 'municipality')
  const consentError = fieldError(state.fieldErrors, 'consentAccepted')

  return (
    <section
      id="leader-contact-form"
      aria-labelledby="leader-contact-form-title"
      className="flex flex-col gap-4 rounded-xl border p-4 scroll-mt-4"
    >
      <div className="flex items-center gap-2">
        <UserPlusIcon className="size-5 text-muted-foreground" aria-hidden="true" />
        <h2 id="leader-contact-form-title" className="text-base font-medium">
          Novo contato
        </h2>
      </div>

      <form
        key={state.status === 'success' ? `success-${state.revision ?? 0}` : 'draft'}
        action={formAction}
        className="flex flex-col gap-4"
      >
        {state.status !== 'success' ? (
          <CampaignFormActionMessage
            state={state}
            errorTitle="Não foi possível cadastrar"
            formFieldErrors={state.fieldErrors?.form}
          />
        ) : null}

        <FieldGroup>
          <PhonesFieldEditor
            name="phones"
            minRows={1}
            label="Celulares (o primeiro é o principal) *"
            defaultValues={values?.phones ?? []}
            error={state.fieldErrors?.phones}
          />

          <Field data-invalid={nameField.invalid}>
            <FieldLabel htmlFor="leader-contact-name">Nome *</FieldLabel>
            <Input
              id="leader-contact-name"
              name="name"
              minLength={2}
              defaultValue={values?.name}
              autoComplete="name"
              aria-invalid={nameField.invalid}
              aria-describedby={nameField.describedBy}
              className="min-h-11 rounded-[6px]"
            />
            {nameField.error ? (
              <FieldError id="leader-contact-name-error">{nameField.error}</FieldError>
            ) : null}
          </Field>

          <Field data-invalid={cityField.invalid}>
            <FieldLabel htmlFor="leader-contact-city">Município</FieldLabel>
            <input type="hidden" name="city" value={city} />
            <StrictCombobox
              id="leader-contact-city"
              options={municipalityComboboxOptions()}
              value={city}
              onValueChange={setCity}
              error={cityField.error}
            />
            {cityField.error ? (
              <FieldError id="leader-contact-city-error">{cityField.error}</FieldError>
            ) : null}
          </Field>

          {showMunicipalitySelect ? (
            <Field data-invalid={municipalityField.invalid}>
              <FieldLabel htmlFor="leader-contact-municipality">Município *</FieldLabel>
              <NativeSelect
                id="leader-contact-municipality"
                name="municipality"
                defaultValue={values?.municipality ?? ''}
                className="w-full **:data-[slot=native-select]:min-h-11 **:data-[slot=native-select]:rounded-[6px]"
              >
                <NativeSelectOption value="">Selecione o município</NativeSelectOption>
                {municipalityOptions.map((municipality) => (
                  <NativeSelectOption key={municipality.id} value={String(municipality.id)}>
                    {municipality.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              {municipalityField.error ? (
                <FieldError id="leader-contact-municipality-error">
                  {municipalityField.error}
                </FieldError>
              ) : null}
            </Field>
          ) : defaultMunicipalityId ? (
            <input type="hidden" name="municipality" value={String(defaultMunicipalityId)} />
          ) : null}
        </FieldGroup>

        <section
          className="rounded-[6px] border bg-muted/30 p-4"
          aria-labelledby="leader-contact-consent-title"
        >
          <h3 id="leader-contact-consent-title" className="font-medium">
            Consentimento de cadastro
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Confirme que a pessoa autorizou o uso dos dados para o cadastro como apoiador.
          </p>
          {!registrationConsentConfigured ? (
            <Alert variant="destructive" className="mt-3">
              <AlertTitle>Consentimento não configurado</AlertTitle>
              <AlertDescription>
                O texto ainda não foi cadastrado no admin. Não é possível concluir o cadastro.
              </AlertDescription>
            </Alert>
          ) : (
            <Field orientation="horizontal" className="mt-3" data-invalid={Boolean(consentError)}>
              <Checkbox
                id="leader-contact-consent"
                name="consentAccepted"
                value="true"
                aria-invalid={Boolean(consentError)}
                aria-describedby={consentError ? 'leader-contact-consent-error' : undefined}
              />
              <FieldContent>
                <FieldLabel htmlFor="leader-contact-consent">
                  A pessoa autorizou o cadastro *
                </FieldLabel>
                <FieldDescription>
                  Você confirma que explicou o uso dos dados conforme o texto versionado da
                  campanha.
                </FieldDescription>
                {consentError ? (
                  <FieldError id="leader-contact-consent-error">{consentError}</FieldError>
                ) : null}
              </FieldContent>
            </Field>
          )}
        </section>

        <Button
          type="submit"
          className="min-h-11 w-full sm:w-auto sm:self-end"
          disabled={pending || !registrationConsentConfigured}
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {pending ? 'Cadastrando…' : 'Cadastrar contato'}
        </Button>
      </form>
    </section>
  )
}
