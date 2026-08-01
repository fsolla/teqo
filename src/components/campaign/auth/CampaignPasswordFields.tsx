'use client'

import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { errorProps } from '@/utilities/campaignFormFields'

type CampaignPasswordFieldsProps = {
  fieldErrors?: Record<string, string[]>
  idPrefix?: string
  passwordLabel?: string
  confirmationLabel?: string
  showPasswordHint?: boolean
  required?: boolean
}

export const CampaignPasswordFields = ({
  fieldErrors,
  idPrefix = 'campaign-password',
  passwordLabel = 'Nova senha',
  confirmationLabel = 'Confirmar nova senha',
  showPasswordHint = false,
  required = true,
}: CampaignPasswordFieldsProps) => {
  const password = errorProps(fieldErrors, 'password', idPrefix)
  const passwordConfirmation = errorProps(fieldErrors, 'passwordConfirmation', idPrefix)
  const passwordHelpId = `${idPrefix}-password-help`

  return (
    <FieldGroup>
      <Field data-invalid={password.invalid}>
        <FieldLabel htmlFor={`${idPrefix}-password`}>{passwordLabel}</FieldLabel>
        <Input
          id={`${idPrefix}-password`}
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required={required}
          className="min-h-11"
          aria-invalid={password.invalid}
          aria-describedby={password.error ? password.describedBy : passwordHelpId}
        />
        {showPasswordHint ? (
          <FieldDescription id={passwordHelpId}>Use pelo menos 8 caracteres.</FieldDescription>
        ) : null}
        {password.error ? (
          <FieldError id={password.describedBy}>{password.error}</FieldError>
        ) : null}
      </Field>
      <Field data-invalid={passwordConfirmation.invalid}>
        <FieldLabel htmlFor={`${idPrefix}-password-confirmation`}>{confirmationLabel}</FieldLabel>
        <Input
          id={`${idPrefix}-password-confirmation`}
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required={required}
          className="min-h-11"
          aria-invalid={passwordConfirmation.invalid}
          aria-describedby={passwordConfirmation.describedBy}
        />
        {passwordConfirmation.error ? (
          <FieldError id={passwordConfirmation.describedBy}>
            {passwordConfirmation.error}
          </FieldError>
        ) : null}
      </Field>
    </FieldGroup>
  )
}
