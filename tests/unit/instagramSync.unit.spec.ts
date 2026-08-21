import { afterEach, describe, expect, it, vi } from 'vitest'

import type { SocialFeedSetting } from '@/payload-types'
import {
  describeInstagramError,
  failedInstagramSyncStatus,
  InstagramApiError,
  isInstagramFeedConfigured,
  successInstagramSyncStatus,
} from '@/utilities/socialFeed/instagramFeed'
import {
  instagramCredentialsChanged,
  syncInstagramFeed,
} from '@/utilities/socialFeed/instagramSync'
import type { Payload, PayloadRequest } from 'payload'

const configuredSettings = (overrides: Partial<SocialFeedSetting> = {}): SocialFeedSetting =>
  ({
    id: 1,
    enabled: true,
    instagramEnabled: true,
    instagramAccessToken: 'ig-token',
    instagramUserId: '17841400000000000',
    instagramMaxItems: 3,
    ...overrides,
  }) as SocialFeedSetting

const fakePayload = (settings: SocialFeedSetting, db: unknown = undefined) =>
  ({
    findGlobal: vi.fn(async () => settings),
    db: db ?? { drizzle: { execute: vi.fn(async () => ({ rowCount: 1 })) } },
  }) as unknown as Payload

const feedResponse = (json: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => json }) as unknown as Response

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('successInstagramSyncStatus / failedInstagramSyncStatus', () => {
  it('builds a success status with now and the raw post count', () => {
    const status = successInstagramSyncStatus(4)
    expect(status.postCount).toBe(4)
    expect(status.lastSyncAt).toBeDefined()
    expect(new Date(status.lastSyncAt as string).getTime()).toBeGreaterThan(0)
    expect(status.error).toBeUndefined()
  })

  it('builds a failure status with the reason and the failure time', () => {
    const status = failedInstagramSyncStatus('motivo')
    expect(status.error).toBe('motivo')
    expect(status.errorAt).toBeDefined()
    expect(status.lastSyncAt).toBeUndefined()
  })
})

describe('isInstagramFeedConfigured', () => {
  it('requires enablement and both credentials', () => {
    expect(isInstagramFeedConfigured(configuredSettings())).toBe(true)
    expect(isInstagramFeedConfigured(configuredSettings({ instagramAccessToken: '' }))).toBe(false)
    expect(isInstagramFeedConfigured(configuredSettings({ instagramUserId: '' }))).toBe(false)
    expect(isInstagramFeedConfigured(configuredSettings({ enabled: false }))).toBe(false)
    expect(isInstagramFeedConfigured(configuredSettings({ instagramEnabled: false }))).toBe(false)
  })
})

describe('instagramCredentialsChanged', () => {
  it('syncs on first save, credential changes and re-enable, not on exclusion-only saves', () => {
    const previous = configuredSettings()
    expect(instagramCredentialsChanged(previous, null)).toBe(true)
    expect(
      instagramCredentialsChanged(
        configuredSettings({ instagramAccessToken: 'novo-token' }),
        previous,
      ),
    ).toBe(true)
    expect(
      instagramCredentialsChanged(configuredSettings({ instagramUserId: '999' }), previous),
    ).toBe(true)
    expect(
      instagramCredentialsChanged(
        configuredSettings({ instagramEnabled: true }),
        configuredSettings({ instagramEnabled: false }),
      ),
    ).toBe(true)
    expect(
      instagramCredentialsChanged(
        configuredSettings({ excludedItems: [{ platform: 'instagram', itemId: 'x' }] }),
        previous,
      ),
    ).toBe(false)
  })
})

describe('describeInstagramError', () => {
  const apiError = (status: number, apiMessage: string | null, apiType: string | null) =>
    new InstagramApiError(status, apiMessage, apiType, 'fail')

  it('maps an OAuth rejection to the token correction (Instagram Login, never Facebook Login)', () => {
    const message = describeInstagramError(
      apiError(400, 'Error validating access token: Session has expired', 'OAuthException'),
    )
    expect(message).toContain('token')
    expect(message).toContain('Instagram Login')
    expect(message).toContain('Facebook Login')
  })

  it('maps an invalid token by keyword even without an OAuthException type', () => {
    expect(
      describeInstagramError(apiError(403, 'Invalid OAuth access token', 'GraphMethodException')),
    ).toContain('Instagram Login')
  })

  it('maps an unknown user id to the ID correction', () => {
    const message = describeInstagramError(apiError(400, 'Invalid user id', 'OAuthException'))
    expect(message).toContain('ID do usuário')
    expect(message).not.toContain('Instagram Login')
  })

  it('keeps a token OAuth rejection on the token correction even when the message says "user"', () => {
    // "The user must be logged in" contains the word "user" but is a TOKEN
    // problem — mapping it to the ID branch would be the very misdiagnosis
    // this panel exists to kill.
    const message = describeInstagramError(
      apiError(400, 'Error validating access token: The user must be logged in', 'OAuthException'),
    )
    expect(message).toContain('Instagram Login')
    expect(message).not.toContain('ID do usuário')
  })

  it('maps a request timeout (aborted sync) to a timeout reason', () => {
    const abort = new Error('This operation was aborted')
    abort.name = 'AbortError'
    expect(describeInstagramError(abort)).toContain('demorou demais')
  })

  it('maps server errors and network failures honestly', () => {
    expect(describeInstagramError(apiError(500, null, null))).toContain('indisponível')
    expect(describeInstagramError(new TypeError('fetch failed'))).toContain('rede')
    expect(describeInstagramError(new Error('whatever'))).toContain('inesperado')
  })
})

describe('syncInstagramFeed', () => {
  const okFeedResponse = () =>
    ({
      ok: true,
      json: async () => ({ data: [] }),
    }) as unknown as Response

  it('persists snapshot and status and reports success', async () => {
    const fetchImpl = vi.fn(async () => okFeedResponse())
    vi.stubGlobal('fetch', fetchImpl)

    const payload = fakePayload(configuredSettings())
    const outcome = await syncInstagramFeed(payload)

    expect(outcome.ok).toBe(true)
    expect(outcome.status.lastSyncAt).toBeDefined()
    expect(outcome.status.postCount).toBe(0)
    expect(payload.db.drizzle.execute).toHaveBeenCalled()
  })

  it('reports the product-language failure status when the API rejects the token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        feedResponse(
          { error: { message: 'Error validating access token', type: 'OAuthException' } },
          false,
          400,
        ),
      ),
    )

    const payload = fakePayload(configuredSettings())
    const outcome = await syncInstagramFeed(payload)

    expect(outcome.ok).toBe(false)
    expect(outcome.status.error).toContain('Instagram Login')
    expect(outcome.status.errorAt).toBeDefined()
  })

  it('returns an empty status without touching the API when not configured', async () => {
    const fetchImpl = vi.fn()
    vi.stubGlobal('fetch', fetchImpl)

    const payload = fakePayload(configuredSettings({ instagramAccessToken: '' }))
    const outcome = await syncInstagramFeed(payload)

    expect(outcome.ok).toBe(false)
    expect(outcome.status).toEqual({})
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('propagates the abort signal to the fetch', async () => {
    const fetchImpl = vi.fn(
      async (_input: string, _init?: RequestInit): Promise<Response> => okFeedResponse(),
    )
    vi.stubGlobal('fetch', fetchImpl)

    const payload = fakePayload(configuredSettings())
    const controller = new AbortController()
    await syncInstagramFeed(payload, { signal: controller.signal })

    expect(fetchImpl.mock.calls[0][1]).toEqual({ signal: controller.signal })
  })

  it('writes through the transaction database when a transaction is open (hook path)', async () => {
    const poolExecute = vi.fn(async () => ({ rowCount: 1 }))
    const txExecute = vi.fn(async () => ({ rowCount: 1 }))
    const payload = fakePayload(configuredSettings(), {
      name: 'postgres',
      sessions: { tx1: { db: { execute: txExecute } } },
      drizzle: { execute: poolExecute },
    })
    const fetchImpl = vi.fn(async () => okFeedResponse())
    vi.stubGlobal('fetch', fetchImpl)

    const result = await syncInstagramFeed(payload, {
      req: { transactionID: 'tx1' } as unknown as PayloadRequest,
    })

    expect(result.ok).toBe(true)
    expect(txExecute).toHaveBeenCalled()
    expect(poolExecute).not.toHaveBeenCalled()
  })

  it('falls back to the pool when the transaction database is unavailable', async () => {
    const poolExecute = vi.fn(async () => ({ rowCount: 1 }))
    // `db.name` not postgres → getPostgresTransactionDatabase throws → pool.
    const payload = fakePayload(configuredSettings(), {
      name: 'not-postgres',
      drizzle: { execute: poolExecute },
    })
    const fetchImpl = vi.fn(async () => okFeedResponse())
    vi.stubGlobal('fetch', fetchImpl)

    const result = await syncInstagramFeed(payload, {
      req: { transactionID: 'tx1' } as unknown as PayloadRequest,
    })

    expect(result.ok).toBe(true)
    expect(poolExecute).toHaveBeenCalled()
  })
})
