import type { ComponentProps } from 'react'
import { FormInput } from './FormInput'

export const PhoneInput = (props: ComponentProps<'input'>) => (
  <FormInput
    form="phone"
    id="phone"
    placeholder="(71) 99999-9999"
    autoComplete="tel"
    inputMode="tel"
    type="tel"
    maxLength={15}
    required
    {...props}
  />
)
