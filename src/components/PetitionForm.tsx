'use client'

import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Petition } from '@/payload-types'
import { zodResolver } from '@hookform/resolvers/zod'
import { type SubmitHandler, useForm } from 'react-hook-form'
import { NativeSelect, NativeSelectOption } from './ui/native-select'
import { useState, useTransition } from 'react'
import { CitiesByState } from '@/lib/cities'
import { Textarea } from './ui/textarea'
import { Button } from './ui/button'
import { petitionFormSchema, type PetitionFormInput } from '@/lib/schemas/petition-form'
import { submitPetitionSignature } from '@/app/(frontend)/actions/submitPetitionSignature'

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

  const [cityOptions, setCityOptions] = useState<readonly string[]>([])

  const handleStateUpdate = (stateValue?: keyof typeof CitiesByState) => {
    if (!stateValue) {
      setCityOptions([])
      methods.setValue('city', '')
      return
    }

    setCityOptions(CitiesByState[stateValue])
    methods.setValue('city', '')
  }

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
        setCityOptions([])
      } catch {
        methods.setError('root', {
          message: 'Falha ao enviar assinatura. Tente novamente.',
        })
      }
    })
  }

  return (
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
            <Input
              id="name"
              type="text"
              placeholder="Digite seu nome completo"
              autoComplete="name"
              maxLength={120}
              {...methods.register('name')}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">E-mail</FieldLabel>
            <Input
              id="email"
              placeholder="Digite seu e-mail"
              autoComplete="email"
              inputMode="email"
              type="text"
              maxLength={254}
              {...methods.register('email')}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="phone">Celular</FieldLabel>
            <Input
              id="phone"
              placeholder="(71) 99999-9999"
              autoComplete="tel"
              inputMode="tel"
              type="tel"
              maxLength={15}
              {...methods.register('phone')}
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="state">Estado</FieldLabel>
            <NativeSelect
              required
              {...methods.register('state', { onChange: (e) => handleStateUpdate(e.target.value) })}
            >
              <NativeSelectOption value="">Selecione um estado</NativeSelectOption>
              {Object.keys(CitiesByState).map((state) => (
                <NativeSelectOption key={state} value={state}>
                  {state}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="city">Cidade</FieldLabel>
            <NativeSelect
              id="city"
              {...methods.register('city')}
              disabled={!cityOptions.length}
              required
            >
              <NativeSelectOption value="">Selecione uma cidade</NativeSelectOption>
              {cityOptions.map((city) => (
                <NativeSelectOption key={city} value={city}>
                  {city}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="postalCode">CEP</FieldLabel>
            <Input
              id="postalCode"
              type="text"
              placeholder="00000-000"
              {...methods.register('postalCode')}
            />
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
  )
}
