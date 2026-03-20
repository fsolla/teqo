import type { ComponentProps } from 'react'
import { FormInput } from './FormInput'

export const NameInput = (props: ComponentProps<'input'>) => (
  <FormInput
    name="name"
    id="name"
    type="text"
    placeholder="Digite seu nome completo"
    autoComplete="name"
    maxLength={120}
    minLength={2}
    format={sanitize}
    required
    {...props}
  />
)

const sanitize = (value: string) =>
  value
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\s-]+/gu, '')
    .replace(/-+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .trim()
    .slice(0, 120)
