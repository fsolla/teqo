import type { ComponentProps } from 'react'
import { FormInput } from './FormInput'

export const PostalCodeInput = (props: ComponentProps<'input'>) => (
  <FormInput
    name="postalCode"
    id="postalCode"
    type="text"
    placeholder="00000-000"
    format={format}
    sanitize={sanitize}
    pattern="^(?:\d{8})?$"
    {...props}
  />
)

const sanitize = (value: string) => value.replace(/\D/g, '').slice(0, 8)

const format = (value: string) => {
  const digits = sanitize(value)
  return digits.length <= 5 ? digits : `${digits.slice(0, 5)}-${digits.slice(5)}`
}
