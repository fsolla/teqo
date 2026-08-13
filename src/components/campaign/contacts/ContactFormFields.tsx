'use client'

import { startTransition, useState, type FormEvent } from 'react'

import { PhonesFieldEditor } from '@/components/campaign/shared/PhonesFieldEditor'
import { FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { CitiesByState } from '@/lib/cities'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { errorProps } from '@/utilities/campaignFormFields'
import { contactGenderLabels } from '@/utilities/contacts/contactListUrl'

export type ContactFormDefaults = {
  name: string
  email: string
  phones: string[]
  gender: string
  state: string
  city: string
  postalCode: string
}

const stateOptions = Object.keys(CitiesByState)

/**
 * C139 — the mobile sheet's ficha form (edit and create share it; the create
 * sheet passes empty defaults). Full-bleed fields with dividers; phones use
 * `PhonesFieldEditor` in FORM mode (no `saveAction`), so the repeated `phones`
 * inputs are collected by the enclosing form. Field errors come from the
 * ladder's `fieldErrors` (name/email/phones/gender/state/city/postalCode);
 * top-level ladder messages (name conflict, out of scope) render as a banner.
 *
 * The fields are CONTROLLED and the submit goes through a manual `onSubmit`
 * dispatch instead of `<form action={submitAction}>`: React 19 resets
 * uncontrolled form fields after any settled form action, wiping typed values
 * on validation/conflict errors (the sheet stays open, so the wipe is visible).
 * `preventDefault` keeps the native submit event away from that plumbing.
 */
export const ContactFormFields = ({
  formId,
  state,
  sessionId,
  submitAction,
  defaults,
  contactId,
}: {
  formId: string
  state: CampaignFormActionState
  /**
   * Bumps on every sheet open; the fields drop the state from any PREVIOUS
   * session with it (the sheet wrapper stays mounted, so `useActionState`
   * state would otherwise leak a stale conflict banner into a fresh open).
   */
  sessionId: number
  submitAction: (formData: FormData) => void
  defaults: ContactFormDefaults
  /** Edit mode: the record being updated (submitted as the `id` field). */
  contactId?: string
}) => {
  const [lastSessionId, setLastSessionId] = useState(sessionId)
  if (lastSessionId !== sessionId) setLastSessionId(sessionId)
  const visibleState = lastSessionId === sessionId ? state : {}

  const [name, setName] = useState(defaults.name)
  const [email, setEmail] = useState(defaults.email)
  const [gender, setGender] = useState(defaults.gender)
  const [stateValue, setStateValue] = useState(defaults.state)
  const [city, setCity] = useState(defaults.city)
  const [postalCode, setPostalCode] = useState(defaults.postalCode)

  const nameProps = errorProps(visibleState.fieldErrors, 'name', formId)
  const emailProps = errorProps(visibleState.fieldErrors, 'email', formId)
  const cityProps = errorProps(visibleState.fieldErrors, 'city', formId)
  const postalCodeProps = errorProps(visibleState.fieldErrors, 'postalCode', formId)
  const stateProps = errorProps(visibleState.fieldErrors, 'state', formId)
  const genderProps = errorProps(visibleState.fieldErrors, 'gender', formId)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // `startTransition` keeps `isPending` correct for the imperative dispatch
    // (React warns otherwise) without re-entering the `<form action>` plumbing.
    startTransition(() => submitAction(new FormData(event.currentTarget)))
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="flex flex-col divide-y">
      {contactId !== undefined ? <input type="hidden" name="id" value={contactId} /> : null}
      {visibleState.fieldErrors?.id ? (
        <FieldError id={`${formId}-id-error`}>{visibleState.fieldErrors.id[0]}</FieldError>
      ) : null}
      {visibleState.message ? (
        <p role="alert" className="py-3 text-sm font-medium text-destructive">
          {visibleState.message}
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5 py-3">
        <FieldLabel htmlFor={`${formId}-name`}>Nome *</FieldLabel>
        <Input
          id={`${formId}-name`}
          name="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nome e sobrenome"
          aria-invalid={nameProps.invalid}
          aria-describedby={nameProps.describedBy}
        />
        {nameProps.error ? (
          <FieldError id={nameProps.describedBy}>{nameProps.error}</FieldError>
        ) : null}
      </div>

      <div className="py-3">
        <PhonesFieldEditor
          defaultValues={defaults.phones}
          error={visibleState.fieldErrors?.phones}
          label="Telefones"
        />
      </div>

      <div className="flex flex-col gap-1.5 py-3">
        <FieldLabel htmlFor={`${formId}-email`}>E-mail</FieldLabel>
        <Input
          id={`${formId}-email`}
          name="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="nome@email.com"
          aria-invalid={emailProps.invalid}
          aria-describedby={emailProps.describedBy}
        />
        {emailProps.error ? (
          <FieldError id={emailProps.describedBy}>{emailProps.error}</FieldError>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5 py-3">
        <FieldLabel htmlFor={`${formId}-gender`}>Gênero</FieldLabel>
        <select
          id={`${formId}-gender`}
          name="gender"
          value={gender}
          onChange={(event) => setGender(event.target.value)}
          aria-invalid={genderProps.invalid}
          aria-describedby={genderProps.describedBy}
          className="min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        >
          <option value="">—</option>
          {(Object.keys(contactGenderLabels) as (keyof typeof contactGenderLabels)[]).map(
            (gender) => (
              <option key={gender} value={gender}>
                {contactGenderLabels[gender]}
              </option>
            ),
          )}
        </select>
        {genderProps.error ? (
          <FieldError id={genderProps.describedBy}>{genderProps.error}</FieldError>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5 py-3">
        <FieldLabel htmlFor={`${formId}-city`}>Cidade</FieldLabel>
        <Input
          id={`${formId}-city`}
          name="city"
          value={city}
          onChange={(event) => setCity(event.target.value)}
          placeholder="Cidade"
          aria-invalid={cityProps.invalid}
          aria-describedby={cityProps.describedBy}
        />
        {cityProps.error ? (
          <FieldError id={cityProps.describedBy}>{cityProps.error}</FieldError>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5 py-3">
        <FieldLabel htmlFor={`${formId}-state`}>Estado *</FieldLabel>
        <select
          id={`${formId}-state`}
          name="state"
          required
          value={stateValue}
          onChange={(event) => setStateValue(event.target.value)}
          aria-invalid={stateProps.invalid}
          aria-describedby={stateProps.describedBy}
          className="min-h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
        >
          {stateOptions.map((stateKey) => (
            <option key={stateKey} value={stateKey}>
              {stateKey}
            </option>
          ))}
        </select>
        {stateProps.error ? (
          <FieldError id={stateProps.describedBy}>{stateProps.error}</FieldError>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5 py-3">
        <FieldLabel htmlFor={`${formId}-postal-code`}>CEP</FieldLabel>
        <Input
          id={`${formId}-postal-code`}
          name="postalCode"
          inputMode="numeric"
          maxLength={8}
          value={postalCode}
          onChange={(event) => setPostalCode(event.target.value)}
          placeholder="00000000"
          aria-invalid={postalCodeProps.invalid}
          aria-describedby={postalCodeProps.describedBy}
        />
        {postalCodeProps.error ? (
          <FieldError id={postalCodeProps.describedBy}>{postalCodeProps.error}</FieldError>
        ) : null}
      </div>
    </form>
  )
}
