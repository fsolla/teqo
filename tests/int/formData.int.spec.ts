// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import {
  boundedJsonFormValue,
  FormDataBoundaryError,
  nullableFormText,
  repeatedRelationshipFormValues,
  requiredFormSecret,
  requiredRelationshipFormValue,
  validationFieldErrors,
} from '@/lib/formData'

describe('FormData boundary', () => {
  it('rejects File values for non-file fields', () => {
    const formData = new FormData()
    formData.set('name', new File(['unsafe'], 'unsafe.txt'))

    expect(() => nullableFormText(formData, 'name')).toThrow(FormDataBoundaryError)
    formData.set('strengths', new File(['[]'], 'payload.json'))
    expect(() => boundedJsonFormValue(formData, 'strengths', 100)).toThrow(
      'Arquivos não são aceitos neste campo.',
    )
  })

  it('preserves secret whitespace while rejecting missing, empty, and File values', () => {
    const formData = new FormData()

    expect(() => requiredFormSecret(formData, 'password')).toThrow(FormDataBoundaryError)

    formData.set('password', '')
    expect(() => requiredFormSecret(formData, 'password')).toThrow(FormDataBoundaryError)

    formData.set('password', new File(['secret'], 'secret.txt'))
    expect(() => requiredFormSecret(formData, 'password')).toThrow(FormDataBoundaryError)

    formData.set('password', '  exact secret  ')
    expect(requiredFormSecret(formData, 'password')).toBe('  exact secret  ')

    formData.set('password', 'ordinary-secret')
    expect(requiredFormSecret(formData, 'password')).toBe('ordinary-secret')
  })

  it('preserves absent, blank, and normalized PATCH text states', () => {
    const formData = new FormData()
    expect(nullableFormText(formData, 'name')).toBeUndefined()

    formData.set('name', '   ')
    expect(nullableFormText(formData, 'name')).toBeNull()

    formData.set('name', '  Maria  ')
    expect(nullableFormText(formData, 'name')).toBe('Maria')
  })

  it('rejects blank and non-decimal relationship identifiers before conversion', () => {
    for (const value of ['', ' ', '1.5', '1e2', '+1', '0']) {
      const formData = new FormData()
      formData.set('id', value)
      expect(() => requiredRelationshipFormValue(formData, 'id')).toThrow()
    }
  })

  it('deduplicates repeated positive integer values deterministically', () => {
    const formData = new FormData()
    for (const value of ['12', '3', '12', '7']) formData.append('coordinators', value)

    expect(repeatedRelationshipFormValues(formData, 'coordinators')).toEqual([3, 7, 12])
  })

  it('distinguishes absent JSON from explicit empty arrays and rejects invalid inputs', () => {
    const formData = new FormData()
    expect(boundedJsonFormValue(formData, 'strengths', 100)).toBeUndefined()

    formData.set('strengths', '[]')
    expect(boundedJsonFormValue(formData, 'strengths', 100)).toEqual([])

    formData.set('strengths', '{')
    expect(() => boundedJsonFormValue(formData, 'strengths', 100)).toThrow()
    formData.set('strengths', JSON.stringify(['x'.repeat(101)]))
    expect(() => boundedJsonFormValue(formData, 'strengths', 100)).toThrow()
  })

  it('bounds JSON by raw UTF-8 bytes before trimming or parsing', () => {
    const formData = new FormData()

    formData.set('strengths', ' [] ')
    expect(() => boundedJsonFormValue(formData, 'strengths', 3)).toThrow(
      'Conteúdo excede o tamanho permitido.',
    )

    formData.set('strengths', '"á"')
    expect(boundedJsonFormValue(formData, 'strengths', 4)).toBe('á')
    expect(() => boundedJsonFormValue(formData, 'strengths', 3)).toThrow(
      'Conteúdo excede o tamanho permitido.',
    )
  })

  it('rejects oversized raw JSON without invoking JSON.parse', () => {
    const formData = new FormData()
    formData.set('strengths', ' '.repeat(101))
    const parse = vi.spyOn(JSON, 'parse')

    expect(() => boundedJsonFormValue(formData, 'strengths', 100)).toThrow(
      'Conteúdo excede o tamanho permitido.',
    )
    expect(parse).not.toHaveBeenCalled()
    parse.mockRestore()
  })

  it('centralizes Zod issue mapping by top-level field', () => {
    const result = z
      .object({ estimate: z.number().positive(), nested: z.object({ value: z.string().min(2) }) })
      .safeParse({ estimate: 0, nested: { value: '' } })
    if (result.success) throw new Error('Validation error expected.')

    expect(validationFieldErrors(result.error)).toEqual({
      estimate: [expect.any(String)],
      nested: [expect.any(String)],
    })
  })
})
