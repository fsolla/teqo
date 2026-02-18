'use client'

import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Petition } from '@/payload-types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import z from 'zod'

interface PetitionFormProps {
  id: string
  petition: Petition
}

export const PetitionForm = ({ id, petition }: PetitionFormProps) => {
  const methods = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      state: '',
      city: '',
      postalCode: '',
      comment: '',
    },
  })

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    console.log(data)
  }

  return (
    <form id={id} onSubmit={methods.handleSubmit(onSubmit)}>
      <FieldSet>
        <FieldLegend>Revogar concessão da orla de Salvador</FieldLegend>
        <FieldDescription>Assine esta petição e ajude a manter a orla de Salvador para todos nós!</FieldDescription>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="name">
              Nome Completo
            </FieldLabel>
            <Input id="name" placeholder="Digite seu nome completo" autoComplete='name' maxLength={120} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">
              E-mail
            </FieldLabel>
            <Input id="email" placeholder="Digite seu e-mail" autoComplete='email' inputMode="email" type='text' maxLength={254} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="phone">
              Celular
            </FieldLabel>
            <Input id="phone" placeholder="(71) 99999-9999" autoComplete='tel' inputMode="tel" type='tel' maxLength={15} required />
          </Field>
        </FieldGroup>
      </FieldSet>
    </form>
  )
}

const STATES = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
]

const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Nome deve ter pelo menos 2 caracteres')
    .max(120, 'Nome deve ter no máximo 100 caracteres')
    .regex(
      /^(?=.* )[\p{L}\p{M}]+(?:[- ][\p{L}\p{M}]+)*$/u,
      'Informe nome e sobrenome. Use apenas letras, no máximo um espaço ou hífen entre termos, e sem espaço no início ou no fim.',
    ),
  email: z.email('Email inválido'),
  phone: z
    .string()
    .trim()
    .length(11, 'Telefone celular inválido')
    .regex(/^\d{11}$/, 'Telefone celular inválido'),
  state: z.literal(STATES, 'Estado inválido'),
  city: z.string().trim().min(3, 'Cidade inválida').max(100, 'Cidade muito longa'),
  postalCode: z
    .string()
    .trim()
    .regex(/^(?:\d{8})?$/, 'CEP inválido')
    .optional(),
  comment: z
    .string()
    .trim()
    .max(1000, 'Comentário muito longo')
    .refine((v) => !/<\/?[a-z][\s\S]*>/i.test(v), 'O comentário não pode conter HTML')
    .optional(),
})
