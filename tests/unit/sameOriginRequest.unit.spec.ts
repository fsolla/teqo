// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'

import { isSameOriginRequest } from '@/utilities/sameOriginRequest'

/**
 * C146: behind the Cloudflare tunnel the request URL carries the internal
 * origin (`http://localhost:3000`) while the browser sends the public one, so
 * the guard must also accept an `Origin` matching the proxy-aware public base
 * resolved with the established `getCampaignInviteBaseURL` policy. The legacy
 * request-URL base stays pinned here (and in
 * `campaignJsonMutationRoute.unit.spec.ts`) because it is what direct local
 * access keeps matching.
 */
const tunnelPostRequest = (origin: string) =>
  new Request('http://localhost:3000/campanha/municipios/pledge-estimated-votes', {
    method: 'POST',
    headers: {
      Origin: origin,
      'x-forwarded-proto': 'https',
      'x-forwarded-host': 'jorgesolla1313.com.br',
    },
  })

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('isSameOriginRequest', () => {
  it('approves a request without an Origin header', () => {
    expect(
      isSameOriginRequest(
        new Request('https://jorgesolla1313.com.br/campanha/x', { method: 'POST' }),
      ),
    ).toBe(true)
  })

  it('approves an Origin matching the request URL via the legacy base alone', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')

    expect(
      isSameOriginRequest(
        new Request('http://localhost:3100/campanha/x', {
          method: 'POST',
          headers: { Origin: 'http://localhost:3100' },
        }),
      ),
    ).toBe(true)
  })

  it('approves a production tunnel POST whose public Origin only matches NEXT_PUBLIC_SITE_URL', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://jorgesolla1313.com.br')

    expect(isSameOriginRequest(tunnelPostRequest('https://jorgesolla1313.com.br'))).toBe(true)
  })

  it('rejects a cross-origin POST even when the proxy announces the real host', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://jorgesolla1313.com.br')

    expect(isSameOriginRequest(tunnelPostRequest('https://evil.example'))).toBe(false)
  })

  it('fails closed in production without NEXT_PUBLIC_SITE_URL when the legacy base misses', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')

    expect(isSameOriginRequest(tunnelPostRequest('https://jorgesolla1313.com.br'))).toBe(false)
  })

  it('rejects a chained forwarded host without crashing, letting the remaining bases decide', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')

    const request = new Request('http://localhost:3000/campanha/x', {
      method: 'POST',
      headers: {
        Origin: 'https://tunnel.example',
        'x-forwarded-proto': 'https',
        'x-forwarded-host': 'localhost:3000,evil.example',
      },
    })

    expect(isSameOriginRequest(request)).toBe(false)
  })

  it('approves a dev request whose local Origin differs from the request URL port', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '')

    const request = new Request('http://localhost:3000/campanha/x', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:3100',
        'x-forwarded-proto': 'http',
        'x-forwarded-host': 'localhost:3100',
      },
    })

    expect(isSameOriginRequest(request)).toBe(true)
  })

  it.each(['null', 'not a url'])('rejects the unusable Origin %s', (origin) => {
    expect(isSameOriginRequest(tunnelPostRequest(origin))).toBe(false)
  })

  it('keeps approving a direct TLS dev request via the request-URL base', () => {
    expect(
      isSameOriginRequest(
        new Request('https://localhost:3443/campanha/x', {
          method: 'POST',
          headers: { Origin: 'https://localhost:3443' },
        }),
      ),
    ).toBe(true)
  })
})
