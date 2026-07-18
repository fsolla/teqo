'use client'

import type { ComponentProps } from 'react'
import { type FieldPath, type FieldValues, useFormContext } from 'react-hook-form'

import { FormattedInput } from '@/components/FormattedInput'

interface FormInputProps<
  TFieldValues extends FieldValues,
  TFieldName extends FieldPath<TFieldValues>,
> extends ComponentProps<'input'> {
  name: TFieldName
  format?: (value: string) => string
  sanitize?: (value: string) => string
}

export const FormInput = <
  TFieldValues extends FieldValues,
  TFieldName extends FieldPath<TFieldValues>,
>({
  name,
  format,
  sanitize,
  ...props
}: FormInputProps<TFieldValues, TFieldName>) => {
  const { onChange, onBlur, ...registerResult } = useFormContext<TFieldValues>().register(
    name,
    sanitize ? { setValueAs: sanitize } : undefined,
  )

  return (
    <FormattedInput
      {...props}
      {...registerResult}
      format={format}
      sanitize={sanitize}
      onInput={onChange}
      onBlur={onBlur}
    />
  )
}
