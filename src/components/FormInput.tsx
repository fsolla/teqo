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
  const { onChange: onValueChange, ...registerResult } = useFormContext<TFieldValues>().register(
    name,
    options,
  )

  const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    if (format) {
      e.target.value = format(e.target.value)
    }

    onValueChange(e)
    onChange?.(e)
  }

  return <Input {...props} {...registerResult} onChange={handleChange} />
}
