'use client'

import { submitPetitionSignature } from '@/app/(frontend)/actions/submitPetitionSignature'
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { trackMetaLead } from '@/lib/facebookPixel'
import { petitionFormSchema, type PetitionFormInput } from '@/lib/schemas/petition-form'
import { Petition } from '@/payload-types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState, useTransition } from 'react'
import { FormProvider, useForm, type SubmitHandler } from 'react-hook-form'
import { CitySelect } from './CitySelect'
import { EmailInput } from './EmailInput'
import { NameInput } from './NameInput'
import { PetitionSuccessDialog } from './PetitionSuccessDialog'
import { PhoneInput } from './PhoneInput'
import { PostalCodeInput } from './PostalCodeInput'
import { SIGNATURE_CREATED_EVENT, type SignatureCreatedDetail } from './SignatureCounter'
import { StateSelect } from './StateSelect'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'

interface PetitionFormProps {
  id: string
  petition: Petition
  consentHTML: string
  facebookPixelId?: string
}

export const PetitionForm = ({ id, petition, consentHTML, facebookPixelId }: PetitionFormProps) => {
  const methods = useForm<PetitionFormInput>({
    resolver: zodResolver(petitionFormSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      state: undefined,
      city: '',
      postalCode: '',
      comment: '',
    },
  })

  const [isSubmitting, startTransition] = useTransition()
  const [isSuccessOpen, setIsSuccessOpen] = useState(false)
  const [signatureNumber, setSignatureNumber] = useState<number | null>(null)

  const onSubmit: SubmitHandler<PetitionFormInput> = (input) => {
    const consentId =
      typeof petition.form?.consent === 'number' ? petition.form.consent : petition.form.consent.id

    startTransition(async () => {
      try {
        const result = await submitPetitionSignature({
          ...input,
          petitionId: petition.id,
          consentId,
        })
        if (facebookPixelId) {
          trackMetaLead(facebookPixelId, petition.title, crypto.randomUUID())
        }
        methods.reset()
        setSignatureNumber(result.signatureNumber)
        const detail: SignatureCreatedDetail = {
          petitionId: petition.id,
          count: result.signatureNumber,
        }
        window.dispatchEvent(new CustomEvent(SIGNATURE_CREATED_EVENT, { detail }))
        setIsSuccessOpen(true)
      } catch {
        methods.setError('root', {
          message: 'Falha ao enviar assinatura. Tente novamente.',
        })
      }
    })
  }

  return (
    <FormProvider {...methods}>
      <PetitionSuccessDialog
        open={isSuccessOpen}
        onOpenChange={setIsSuccessOpen}
        petitionTitle={petition.title}
        signatureNumber={signatureNumber}
      />
      <form id={id} onSubmit={methods.handleSubmit(onSubmit)}>
        <FieldSet>
          {petition.form.title ? <FieldLegend>{petition.form.title}</FieldLegend> : null}
          {petition.form.subtitle ? (
            <FieldDescription>{petition.form.subtitle}</FieldDescription>
          ) : null}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="name">Nome Completo</FieldLabel>
              <NameInput />
            </Field>
            <Field>
              <FieldLabel htmlFor="email">E-mail</FieldLabel>
              <EmailInput />
            </Field>
            <Field>
              <FieldLabel htmlFor="phone">Celular</FieldLabel>
              <PhoneInput />
            </Field>
            <Field>
              <FieldLabel htmlFor="state">Estado</FieldLabel>
              <StateSelect />
            </Field>
            <Field>
              <FieldLabel htmlFor="city">Cidade</FieldLabel>
              <CitySelect />
            </Field>
            <Field>
              <FieldLabel htmlFor="postalCode">CEP</FieldLabel>
              <PostalCodeInput />
            </Field>
            <Field>
              <FieldLabel htmlFor="comment">Comentário</FieldLabel>
              <Textarea id="comment" {...methods.register('comment')} />
            </Field>
            <Field>
              {consentHTML ? (
                <div
                  className="petition-consent text-left text-sm leading-normal font-normal text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_a:hover]:text-primary [&_p]:m-0 [&_strong]:font-semibold [&_strong]:text-foreground"
                  dangerouslySetInnerHTML={{
                    __html: consentHTML,
                  }}
                />
              ) : null}
              {methods.formState.errors.root?.message ? (
                <FieldDescription className="text-destructive">
                  {methods.formState.errors.root.message}
                </FieldDescription>
              ) : null}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="text-primary-foreground hover:text-primary-foreground"
              >
                {isSubmitting ? 'Enviando...' : 'Assinar'}
              </Button>
            </Field>
          </FieldGroup>
        </FieldSet>
      </form>
    </FormProvider>
  )
}
