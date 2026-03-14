'use client'

import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Petition } from '@/payload-types'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormProvider, type SubmitHandler, useForm } from 'react-hook-form'
import { useTransition } from 'react'
import { Textarea } from './ui/textarea'
import { Button } from './ui/button'
import { petitionFormSchema, type PetitionFormInput } from '@/lib/schemas/petition-form'
import { submitPetitionSignature } from '@/app/(frontend)/actions/submitPetitionSignature'
import { NameInput } from './NameInput'
import { EmailInput } from './EmailInput'
import { PhoneInput } from './PhoneInput'
import { StateSelect } from './StateSelect'
import { CitySelect } from './CitySelect'
import { PostalCodeInput } from './PostalCodeInput'

interface PetitionFormProps {
  id: string
  petition: Petition
}

export const PetitionForm = ({ id, petition }: PetitionFormProps) => {
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

  const onSubmit: SubmitHandler<PetitionFormInput> = (input) => {
    const consentId =
      typeof petition.form?.consent === 'number' ? petition.form.consent : petition.form.consent.id

    startTransition(async () => {
      try {
        await submitPetitionSignature({
          ...input,
          petitionId: petition.id,
          consentId,
        })
        methods.reset()
      } catch {
        methods.setError('root', {
          message: 'Falha ao enviar assinatura. Tente novamente.',
        })
      }
    })
  }

  return (
    <FormProvider {...methods}>
      <form id={id} onSubmit={methods.handleSubmit(onSubmit)}>
        <FieldSet>
          {petition.form.title ? <FieldLegend>{petition.form.title}</FieldLegend> : null}
          {petition.form.subtitle ? (
            <FieldDescription>
              Assine esta petição e ajude a manter a orla de Salvador para todos nós!
            </FieldDescription>
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
              {typeof petition.form.consent !== 'number' ? (
                <FieldDescription>{petition.form.consent.text}</FieldDescription>
              ) : null}
              {methods.formState.errors.root?.message ? (
                <FieldDescription className="text-destructive">
                  {methods.formState.errors.root.message}
                </FieldDescription>
              ) : null}
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Enviando...' : 'Assinar'}
              </Button>
            </Field>
          </FieldGroup>
        </FieldSet>
      </form>
    </FormProvider>
  )
}
