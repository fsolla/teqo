import { createHash } from 'node:crypto'

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize)
  if (value === null || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [key, canonicalize(nestedValue)]),
  )
}

export const hashConsentContent = (content: unknown): string =>
  createHash('sha256')
    .update(JSON.stringify(canonicalize(content)), 'utf8')
    .digest('hex')
