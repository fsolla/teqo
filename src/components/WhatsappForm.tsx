'use client'

import { CitySelect } from '@/components/CitySelect'
import { EmailInput } from '@/components/EmailInput'
import { NameInput } from '@/components/NameInput'
import { PhoneInput } from '@/components/PhoneInput'
import { StateSelect } from '@/components/StateSelect'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import { WhatsAppFormInput, whatsAppFormSchema } from '@/lib/schemas/whatsapp-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FormProvider, SubmitHandler, useForm } from 'react-hook-form'
import { useEffect, useTransition } from 'react'
import { submitWhatsapp } from '@/app/(frontend)/actions/submitWhatsapp'

interface WhatsappFormProps {
  classname?: string
  onSubmit: () => void
}

export const WhatsappForm = ({ classname, onSubmit }: WhatsappFormProps) => {
  const methods = useForm<WhatsAppFormInput>({
    resolver: zodResolver(whatsAppFormSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      state: undefined,
      city: '',
      comment: '',
    },
  })

  const [isSubmitting, startTransition] = useTransition()

  const handleSubmit: SubmitHandler<WhatsAppFormInput> = (input) => {
    startTransition(async () => {
      try {
        await submitWhatsapp(input)
        methods.reset()
        onSubmit()
      } catch (e) {
        console.log(e)
        methods.setError('root', {
          message: 'Falha ao enviar assinatura. Tente novamente.',
        })
      }
    })
  }

  return (
    <FormProvider {...methods}>
      <form
        id="mandato-no-whatsapp"
        onSubmit={methods.handleSubmit(handleSubmit)}
        className={classname}
      >
        <FieldGroup>
          <Field>
            <NameInput placeholder="Nome completo*" />
          </Field>
          <Field>
            <PhoneInput placeholder="WhatsApp (com DDD)*" />
          </Field>
          <Field>
            <EmailInput placeholder="Digite seu melhor email*" />
          </Field>
          <div className="flex gap-2">
            <Field>
              <StateSelect placeholder="Estado" />
            </Field>
            <Field>
              <CitySelect placeholder="Cidade" />
            </Field>
          </div>
          <Field>
            <Textarea
              id="comment"
              {...methods.register('comment')}
              placeholder='Campo de Interesse: "O que você mais quer ver no canal?" (Votações, Bastidores, Ações Sociais, Agenda).'
              className="min-h-22"
            />
          </Field>
          <Field>
            {methods.formState.errors.root?.message ? (
              <FieldDescription className="text-destructive">
                {methods.formState.errors.root.message}
              </FieldDescription>
            ) : null}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#99c343] font-bold text-xl py-6 rounded-full"
            >
              {isSubmitting ? 'Enviando...' : 'FAZER MEU CADASTRO'}
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </FormProvider>
  )
}
