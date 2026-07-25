import 'server-only'

import { z, type ZodError } from 'zod'

import type { VoteEstimateScenarioFields } from '@/lib/voteEstimate'

export class FormDataBoundaryError extends Error {
  field: string

  constructor(field: string, message: string) {
    super(message)
    this.field = field
  }
}

const formEntry = (
  formData: FormData,
  field: string,
): { present: false } | { present: true; value: string } => {
  if (!formData.has(field)) return { present: false }
  const value = formData.get(field)
  if (typeof value !== 'string') {
    throw new FormDataBoundaryError(field, 'Arquivos não são aceitos neste campo.')
  }
  return { present: true, value }
}

export const requiredFormText = (formData: FormData, field: string): string => {
  const entry = formEntry(formData, field)
  const value = entry.present ? entry.value.trim() : ''
  if (!value) throw new FormDataBoundaryError(field, 'Campo obrigatório.')
  return value
}

export const requiredFormSecret = (formData: FormData, field: string): string => {
  const entry = formEntry(formData, field)
  const value = entry.present ? entry.value : ''
  if (!value) throw new FormDataBoundaryError(field, 'Campo obrigatório.')
  return value
}

export const optionalFormText = (formData: FormData, field: string): string | undefined => {
  const entry = formEntry(formData, field)
  if (!entry.present) return undefined
  return entry.value.trim() || undefined
}

/** Hidden `municipalitySlug` on list/detail municipality forms for scoped revalidation. */
export const optionalMunicipalitySlugFromForm = (formData: FormData): string | undefined =>
  optionalFormText(formData, 'municipalitySlug')

export const nullableFormText = (formData: FormData, field: string): string | null | undefined => {
  const entry = formEntry(formData, field)
  if (!entry.present) return undefined
  return entry.value.trim() || null
}

const positiveInteger = (field: string, value: string): number => {
  const normalized = value.trim()
  if (!/^[1-9]\d*$/.test(normalized)) {
    throw new FormDataBoundaryError(field, 'Identificador inválido.')
  }
  const parsed = Number(normalized)
  if (!Number.isSafeInteger(parsed)) {
    throw new FormDataBoundaryError(field, 'Identificador inválido.')
  }
  return parsed
}

export const requiredIntegerFormValue = (
  formData: FormData,
  field: string,
  { minimum = 0, maximum = Number.MAX_SAFE_INTEGER }: { minimum?: number; maximum?: number } = {},
): number => {
  const entry = formEntry(formData, field)
  const normalized = entry.present ? entry.value.trim() : ''
  if (!/^\d+$/.test(normalized)) {
    throw new FormDataBoundaryError(field, 'Informe um número inteiro válido.')
  }
  const parsed = Number(normalized)
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new FormDataBoundaryError(field, 'Informe um número inteiro válido.')
  }
  return parsed
}

export const optionalIntegerFormValue = (
  formData: FormData,
  field: string,
  options?: { minimum?: number; maximum?: number },
): number | undefined => {
  const entry = formEntry(formData, field)
  if (!entry.present || !entry.value.trim()) return undefined
  return requiredIntegerFormValue(formData, field, options)
}

const optionalNullableIntegerFormValue = (
  formData: FormData,
  field: string,
  options?: { minimum?: number; maximum?: number },
): number | null | undefined => {
  const entry = formEntry(formData, field)
  if (!entry.present) return undefined
  if (!entry.value.trim()) return null
  return requiredIntegerFormValue(formData, field, options)
}

export const voteEstimateScenarioFromForm = (
  formData: FormData,
  prefix: 'estimatedVotes' | 'expectedVotes',
): VoteEstimateScenarioFields => ({
  pessimistic:
    optionalNullableIntegerFormValue(formData, `${prefix}Pessimistic`, {
      minimum: 0,
      maximum: 1_000_000,
    }) ?? null,
  central:
    optionalNullableIntegerFormValue(formData, `${prefix}Central`, {
      minimum: 0,
      maximum: 1_000_000,
    }) ?? null,
  optimistic:
    optionalNullableIntegerFormValue(formData, `${prefix}Optimistic`, {
      minimum: 0,
      maximum: 1_000_000,
    }) ?? null,
})

export const requiredRelationshipFormValue = (formData: FormData, field: string): number => {
  const entry = formEntry(formData, field)
  if (!entry.present) throw new FormDataBoundaryError(field, 'Campo obrigatório.')
  return positiveInteger(field, entry.value)
}

export const nullableRelationshipFormValue = (
  formData: FormData,
  field: string,
): number | null | undefined => {
  const entry = formEntry(formData, field)
  if (!entry.present) return undefined
  if (!entry.value.trim()) return null
  return positiveInteger(field, entry.value)
}

export const repeatedRelationshipFormValues = (formData: FormData, field: string): number[] => {
  const values = formData.getAll(field).map((value) => {
    if (typeof value !== 'string') {
      throw new FormDataBoundaryError(field, 'Arquivos não são aceitos neste campo.')
    }
    return positiveInteger(field, value)
  })
  return [...new Set(values)].sort((left, right) => left - right)
}

export const repeatedFormTexts = (formData: FormData, field: string): string[] => {
  const seen = new Set<string>()
  const values: string[] = []
  for (const value of formData.getAll(field)) {
    if (typeof value !== 'string') {
      throw new FormDataBoundaryError(field, 'Arquivos não são aceitos neste campo.')
    }
    const trimmed = value.trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    values.push(trimmed)
  }
  return values
}

export const checkboxFormValue = (formData: FormData, field: string): boolean => {
  const entry = formEntry(formData, field)
  if (!entry.present) return false
  if (entry.value === 'on' || entry.value === 'true' || entry.value === '1') return true
  if (entry.value === 'false' || entry.value === '0') return false
  throw new FormDataBoundaryError(field, 'Valor de seleção inválido.')
}

export const boundedJsonFormValue = (
  formData: FormData,
  field: string,
  maximumBytes: number,
): unknown | undefined => {
  const entry = formEntry(formData, field)
  if (!entry.present) return undefined
  const raw = entry.value
  if (Buffer.byteLength(raw, 'utf8') > maximumBytes) {
    throw new FormDataBoundaryError(field, 'Conteúdo excede o tamanho permitido.')
  }
  const normalized = raw.trim()
  if (!normalized) throw new FormDataBoundaryError(field, 'JSON inválido.')
  try {
    return JSON.parse(normalized) as unknown
  } catch {
    throw new FormDataBoundaryError(field, 'JSON inválido.')
  }
}

export const validationFieldErrors = (error: ZodError): Record<string, string[]> => {
  const flattened = z.flattenError(error)
  const fieldErrors = {
    ...flattened.fieldErrors,
  } as Record<string, string[]>
  if (flattened.formErrors.length > 0) fieldErrors.form = flattened.formErrors
  return fieldErrors
}
