import type { ComponentProps } from 'react'
import { FormInput } from './FormInput'

export const EmailInput = (props: ComponentProps<'input'>) => (
  <FormInput
    name="email"
    id="email"
    placeholder="Digite seu e-mail"
    autoComplete="email"
    inputMode="email"
    type="text"
    minLength={5}
    maxLength={254}
    required
    {...props}
  />
)
