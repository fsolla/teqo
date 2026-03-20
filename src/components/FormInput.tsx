'use client'

import { ChangeEventHandler, type ComponentProps } from 'react'
import { Input } from './ui/input'
import {
  type FieldPath,
  type FieldValues,
  type RegisterOptions,
  useFormContext,
} from 'react-hook-form'

interface FormInpuProps<
  TFieldValues extends FieldValues,
  TFieldName extends FieldPath<TFieldValues>,
> extends ComponentProps<'input'> {
  name: TFieldName
  options?: RegisterOptions<TFieldValues, TFieldName>
  format?: (value: string) => string
}

export const FormInput = <
  TFieldValues extends FieldValues,
  TFieldName extends FieldPath<TFieldValues>,
>({
  name,
  options,
  format,
  onChange,
  ...props
}: FormInpuProps<TFieldValues, TFieldName>) => {
  const { register } = useFormContext<TFieldValues>()
  const { onChange: onValueChange, ...registerResult } = register(name, options)

  const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    const targetValue = e.target.value
    const formattedValue = format?.(targetValue) ?? targetValue
    e.target.value = formattedValue
    onValueChange(e)
    onChange?.(e)
  }

  return <Input {...props} {...registerResult} onChange={handleChange} />
}
