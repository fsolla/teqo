'use client'

import type {
  ComponentProps,
  CompositionEventHandler,
  FocusEventHandler,
  InputEventHandler,
} from 'react'

import { Input } from '@/components/ui/input'

type FormattedInputProps = ComponentProps<'input'> & {
  format?: (value: string) => string
  sanitize?: (value: string) => string
}

const updateInputValue = (input: HTMLInputElement, value: string): void => {
  const selectionDistance = input.value.length - (input.selectionEnd ?? input.value.length)
  input.value = value
  const caretPosition = Math.max(0, value.length - selectionDistance)
  input.setSelectionRange(caretPosition, caretPosition)
}

export const FormattedInput = ({
  format,
  sanitize,
  onInput,
  onCompositionEnd,
  onBlur,
  ...props
}: FormattedInputProps) => {
  const handleInput: InputEventHandler<HTMLInputElement> = (event) => {
    if (!event.nativeEvent.isComposing && format) {
      updateInputValue(event.currentTarget, format(event.currentTarget.value))
    }
    onInput?.(event)
  }

  const handleCompositionEnd: CompositionEventHandler<HTMLInputElement> = (event) => {
    if (format) {
      updateInputValue(event.currentTarget, format(event.currentTarget.value))
    }
    onCompositionEnd?.(event)
  }

  const handleBlur: FocusEventHandler<HTMLInputElement> = (event) => {
    const value = sanitize?.(event.currentTarget.value) ?? event.currentTarget.value
    updateInputValue(event.currentTarget, format?.(value) ?? value)
    onBlur?.(event)
  }

  return (
    <Input
      {...props}
      onInput={handleInput}
      onCompositionEnd={handleCompositionEnd}
      onBlur={handleBlur}
    />
  )
}
