import type { ComponentProps } from 'react'
import { FormInput } from './FormInput'

export const PhoneInput = (props: ComponentProps<'input'>) => (
  <FormInput
    name="phone"
    id="phone"
    placeholder="(71) 99999-9999"
    autoComplete="tel"
    inputMode="tel"
    type="tel"
    maxLength={15}
    minLength={15}
    format={formatPhone}
    options={{
      setValueAs: sanitizePhone,
    }}
    {...props}
  />
)

const sanitizePhone = (value: string) => value.replace(/\D/g, '').slice(0, 11)

const formatPhone = (value: string) => {
  const digits = sanitizePhone(value)

  if (!digits) return ''
  if (digits.length <= 2) return `(${digits}`
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}
