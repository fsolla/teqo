'use client'

import type {
  CompositionEventHandler,
  FocusEventHandler,
  InputEventHandler,
  ComponentProps,
} from 'react'
import { Input } from './ui/input'
import { type FieldPath, type FieldValues, useFormContext } from 'react-hook-form'

interface FormInpuProps<
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
}: FormInpuProps<TFieldValues, TFieldName>) => {
  const { onChange, onBlur, ...registerResult } = useFormContext<TFieldValues>().register(
    name,
    sanitize ? { setValueAs: sanitize } : undefined,
  )

  const handleUpdate = (e: EventTarget & HTMLInputElement, value: string) => {
    const selectionStart = e.selectionStart
    e.value = value
    e.setSelectionRange(selectionStart, selectionStart)
  }

  const handleInput: InputEventHandler<HTMLInputElement> = (e) => {
    if (e.nativeEvent.isComposing) {
      return
    }

    if (format) {
      handleUpdate(e.currentTarget, format(e.currentTarget.value))
    }

    onChange(e)
  }

  const handleCompositionEnd: CompositionEventHandler<HTMLInputElement> | undefined = format
    ? (e) => handleUpdate(e.currentTarget, format(e.currentTarget.value))
    : undefined

  const handleBlur: FocusEventHandler<HTMLInputElement> = (e) => {
    handleUpdate(
      e.currentTarget,
      format?.(sanitize?.(e.currentTarget.value) ?? e.currentTarget.value) ?? e.currentTarget.value,
    )
    onBlur(e)
  }

  return (
    <Input
      {...props}
      {...registerResult}
      onInput={handleInput}
      onCompositionEnd={handleCompositionEnd}
      onBlur={handleBlur}
    />
  )
}
