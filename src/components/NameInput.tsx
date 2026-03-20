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
    required
    {...props}
  />
)
