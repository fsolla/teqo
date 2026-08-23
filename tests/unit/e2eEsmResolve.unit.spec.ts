// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { resolve } from '../helpers/e2eEsmResolve.mjs'

const CONTEXT = { conditions: ['react-server', 'node'] }

type NodeError = Error & { code: string }

describe('e2eEsmResolve', () => {
  it('resolves next/cache bare when the exports map exists (no remap)', async () => {
    const nextResolve = async (specifier: string) => {
      expect(specifier).toBe('next/cache')
      return { url: 'file:///node_modules/next/cache' }
    }
    await expect(resolve('next/cache', CONTEXT, nextResolve)).resolves.toEqual({
      url: 'file:///node_modules/next/cache',
    })
  })

  it('remaps next/cache to next/cache.js only on ERR_MODULE_NOT_FOUND', async () => {
    const nextResolve = async (specifier: string, context: unknown) => {
      expect(context).toBe(CONTEXT)
      if (specifier === 'next/cache') {
        const error = new Error(`Cannot find module '${specifier}'`) as NodeError
        error.code = 'ERR_MODULE_NOT_FOUND'
        throw error
      }
      expect(specifier).toBe('next/cache.js')
      return { url: 'file:///node_modules/next/cache.js' }
    }
    await expect(resolve('next/cache', CONTEXT, nextResolve)).resolves.toEqual({
      url: 'file:///node_modules/next/cache.js',
    })
  })

  it('propagates non-ERR_MODULE_NOT_FOUND errors from the bare resolution', async () => {
    const broken = async () => {
      const error = new Error('boom') as NodeError
      error.code = 'ERR_SOMETHING_ELSE'
      throw error
    }
    await expect(resolve('next/cache', CONTEXT, broken)).rejects.toThrow('boom')
  })
})
