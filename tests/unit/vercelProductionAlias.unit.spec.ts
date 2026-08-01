// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  aliasesIncludeHost,
  ensureProductionCustomDomain,
  normalizeHostname,
  parseDeploymentRef,
  PRODUCTION_CUSTOM_DOMAIN,
} from '../../scripts/lib/vercel-production-alias.mjs'

const jsonResponse = (ok: boolean, status: number, payload: unknown) =>
  ({
    ok,
    status,
    text: async () => (payload === null ? '' : JSON.stringify(payload)),
  }) as Response

describe('vercelProductionAlias', () => {
  it('pins the Teqo production hostname', () => {
    expect(PRODUCTION_CUSTOM_DOMAIN).toBe('pt.jorgesolla.com.br')
  })

  it('normalizeHostname strips protocol and path', () => {
    expect(normalizeHostname('https://PT.jorgesolla.com.br/campanha')).toBe('pt.jorgesolla.com.br')
  })

  it('aliasesIncludeHost matches hostnames case-insensitively', () => {
    expect(
      aliasesIncludeHost(
        ['jorgesolla-solla.vercel.app', 'pt.jorgesolla.com.br'],
        'PT.jorgesolla.com.br',
      ),
    ).toBe(true)
    expect(aliasesIncludeHost(['jorgesolla-solla.vercel.app'], 'pt.jorgesolla.com.br')).toBe(false)
  })

  it('parseDeploymentRef accepts inspect paths and vercel.app hosts', () => {
    expect(
      parseDeploymentRef('https://vercel.com/solla/jorgesolla/CQkmCejZSvRoFtYP8hHbjzP3pc1L'),
    ).toEqual({
      kind: 'id',
      value: 'CQkmCejZSvRoFtYP8hHbjzP3pc1L',
    })
    expect(parseDeploymentRef('https://jorgesolla-k0lwit3lp-solla.vercel.app')).toEqual({
      kind: 'url',
      value: 'jorgesolla-k0lwit3lp-solla.vercel.app',
    })
    expect(parseDeploymentRef('dpl_abc123')).toEqual({ kind: 'id', value: 'dpl_abc123' })
  })

  it('ensureProductionCustomDomain enables auto-assign, promotes, and aliases explicitly', async () => {
    const calls: string[] = []
    let aliases = ['jorgesolla-solla.vercel.app']
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url)
      const method = init?.method ?? 'GET'
      calls.push(`${method} ${href}`)

      if (href.includes('/v9/projects/') && href.includes('/domains') && method === 'GET') {
        return jsonResponse(true, 200, { domains: [{ name: 'pt.jorgesolla.com.br' }] })
      }
      if (href.includes('/v9/projects/') && method === 'GET') {
        return jsonResponse(true, 200, { autoAssignCustomDomains: false, name: 'jorgesolla' })
      }
      if (href.includes('/v9/projects/') && method === 'PATCH') {
        const body = JSON.parse(String(init?.body ?? '{}'))
        expect(body.autoAssignCustomDomains).toBe(true)
        return jsonResponse(true, 200, { autoAssignCustomDomains: true })
      }
      if (href.includes('/v13/deployments/')) {
        return jsonResponse(true, 200, {
          id: 'dpl_test',
          url: 'jorgesolla-test.vercel.app',
          alias: aliases,
          readyState: 'READY',
        })
      }
      if (href.includes('/promote/') && method === 'POST') {
        return jsonResponse(true, 200, {})
      }
      if (href.includes('/aliases') && method === 'POST') {
        const body = JSON.parse(String(init?.body ?? '{}'))
        expect(body.alias).toBe('pt.jorgesolla.com.br')
        aliases = ['jorgesolla-solla.vercel.app', 'pt.jorgesolla.com.br']
        return jsonResponse(true, 200, {
          alias: body.alias,
          uid: 'alias_1',
          created: new Date().toISOString(),
        })
      }
      throw new Error(`unexpected fetch ${method} ${href}`)
    }) as typeof fetch

    const result = await ensureProductionCustomDomain({
      token: 'tok',
      projectId: 'prj_x',
      teamId: 'team_x',
      deploymentRef: 'https://jorgesolla-test.vercel.app',
      fetchImpl,
      sleepImpl: async () => {},
    })

    expect(result.aliased).toBe(true)
    expect(result.autoAssignWasFalse).toBe(true)
    expect(result.alreadyAssigned).toBe(false)
    expect(calls.some((c) => c.startsWith('PATCH '))).toBe(true)
    expect(calls.some((c) => c.includes('/promote/'))).toBe(true)
    expect(calls.some((c) => c.includes('/aliases'))).toBe(true)
  })

  it('ensureProductionCustomDomain skips work when alias already present', async () => {
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url)
      const method = init?.method ?? 'GET'
      if (href.includes('/v9/projects/') && href.includes('/domains') && method === 'GET') {
        return jsonResponse(true, 200, { domains: [{ name: 'pt.jorgesolla.com.br' }] })
      }
      if (href.includes('/v9/projects/') && method === 'GET') {
        return jsonResponse(true, 200, { autoAssignCustomDomains: true })
      }
      if (href.includes('/v13/deployments/')) {
        return jsonResponse(true, 200, {
          id: 'dpl_test',
          alias: ['pt.jorgesolla.com.br'],
          readyState: 'READY',
        })
      }
      throw new Error(`unexpected fetch ${method} ${href}`)
    }) as typeof fetch

    const result = await ensureProductionCustomDomain({
      token: 'tok',
      projectId: 'prj_x',
      teamId: 'team_x',
      deploymentRef: 'dpl_test',
      fetchImpl,
      sleepImpl: async () => {},
    })

    expect(result.promoted).toBe(false)
    expect(result.alreadyAssigned).toBe(true)
  })

  it('ensureProductionCustomDomain fails when the hostname is not on the project', async () => {
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      const href = String(url)
      const method = init?.method ?? 'GET'
      if (href.includes('/v9/projects/') && href.includes('/domains') && method === 'GET') {
        return jsonResponse(true, 200, { domains: [{ name: 'other.example.com' }] })
      }
      if (href.includes('/v9/projects/') && method === 'GET') {
        return jsonResponse(true, 200, { autoAssignCustomDomains: true })
      }
      throw new Error(`unexpected fetch ${method} ${href}`)
    }) as typeof fetch

    await expect(
      ensureProductionCustomDomain({
        token: 'tok',
        projectId: 'prj_x',
        teamId: 'team_x',
        deploymentRef: 'dpl_test',
        fetchImpl,
        sleepImpl: async () => {},
      }),
    ).rejects.toThrow(/not attached to this Vercel project/)
  })
})
