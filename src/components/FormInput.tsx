import type { ComponentProps } from 'react'
import { Input } from './ui/input'
import { useFormContext } from 'react-hook-form'

interface FormInpuProps extends ComponentProps<'input'> {
  form: string
}

export const FormInput = ({ form, ...props }: FormInpuProps) => {
  const { register } = useFormContext()

  return <Input {...props} {...register(form)} />
}
