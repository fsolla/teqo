import type { ComponentProps } from 'react'
import { FormInput } from './FormInput'

export const PostalCodeInput = (props: ComponentProps<'input'>) => (
  <FormInput
    name="postalCode"
    id="postalCode"
    type="text"
    placeholder="00000-000"
    pattern="^(?:\d{8})?$"
    {...props}
  />
)
