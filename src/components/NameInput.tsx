import type { ComponentProps } from 'react'
import { FormInput } from './FormInput'

export const NameInput = (props: ComponentProps<'input'>) => (
  <FormInput
    name="name"
    id="name"
    type="text"
    placeholder="Digite seu nome completo"
    autoComplete="name"
    maxLength={120}
    minLength={2}
    format={format}
    sanitize={sanitize}
    required
    {...props}
  />
)

const format = (value: string) =>
  value
    .normalize('NFC')
    .replace(/[^\p{L}\p{M}\s-]+/gu, '')
    .trimStart()
    .replace(/\s+/g, ' ')
    .replace(/-{2,}/g, '-')
    .replace(/(^|\s)-+/gu, '$1')
    .toLowerCase()
    .replace(/\b\p{L}+\b/gu, (word) =>
      connectors.has(word) ? word : word[0].toUpperCase() + word.slice(1),
    )
    .slice(0, 120)

const sanitize = (value: string) =>
  format(value)
    .trim()
    .replace(/(^|\s)-+/gu, '$1')
    .replace(/-(?!\p{L})/gu, '')

const connectors = new Set(['da', 'das', 'de', 'di', 'do', 'dos', 'du', 'e'])
