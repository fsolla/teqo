import type { ComponentProps } from 'react'

import { formatBrazilianPhoneInput, sanitizeBrazilianPhoneInput } from '@/utilities/phone'

import { FormInput } from './FormInput'

export const PhoneInput = (props: ComponentProps<'input'>) => (
  <FormInput
    name="phone"
    id="phone"
    placeholder="(71) 99999-9999"
    autoComplete="tel"
    inputMode="tel"
    type="tel"
    maxLength={19}
    minLength={15}
    format={formatBrazilianPhoneInput}
    sanitize={sanitizeBrazilianPhoneInput}
    {...props}
  />
)
