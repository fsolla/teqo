import { CitiesByState } from '@/lib/cities'
import { z } from 'zod'

type StateKey = keyof typeof CitiesByState

export const petitionFormSchema = z.object({
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
  state: z.custom<StateKey>(
    (value) => typeof value === 'string' && value in CitiesByState,
    'Estado inválido',
  ),
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

export type PetitionFormInput = z.infer<typeof petitionFormSchema>
