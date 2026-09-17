import { afterEach, describe, expect, it, vi } from 'vitest'

import { enterReadOnlySession, resolveCampaignActor } from '../../scripts/lib/readOnlyExtract.mjs'

// C187 extracted the read-only extraction contract so the institution extractor
// does not twin it. Pins the fail-closed opt-in, the forced read-only URL and
// the actor resolution order.

const originalDatabaseUrl = process.env.DATABASE_URL

afterEach(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
  else process.env.DATABASE_URL = originalDatabaseUrl
  delete process.env.READONLY_TEST_CONFIRM
})

describe('enterReadOnlySession', () => {
  it('refuses to run without the explicit confirmation env', () => {
    const die = vi.fn((message: string) => {
      throw new Error(message)
    })
    expect(() =>
      enterReadOnlySession({ confirmEnv: 'READONLY_TEST_CONFIRM', label: 'test', die }),
    ).toThrow(/READONLY_TEST_CONFIRM=1/)
    expect(die).toHaveBeenCalled()
  })

  it('forces default_transaction_read_only on and returns the raw url', () => {
    process.env.READONLY_TEST_CONFIRM = '1'
    process.env.DATABASE_URL = 'postgresql://user:pass@127.0.0.1:5432/teqo_test'
    const die = vi.fn()
    const raw = enterReadOnlySession({
      confirmEnv: 'READONLY_TEST_CONFIRM',
      label: 'test',
      die,
      context: 'instituição ufba',
    })
    expect(raw).toBe('postgresql://user:pass@127.0.0.1:5432/teqo_test')
    expect(decodeURIComponent(process.env.DATABASE_URL ?? '')).toContain(
      'default_transaction_read_only=on',
    )
    expect(die).not.toHaveBeenCalled()
  })
})

describe('resolveCampaignActor', () => {
  it('prefers candidate, then coordinator', async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce({ docs: [] })
      .mockResolvedValueOnce({ docs: [{ id: 7, role: 'coordinator', name: 'Coord' }] })
    const actor = await resolveCampaignActor({ find }, { die: vi.fn() })
    expect(actor).toMatchObject({ id: 7, role: 'coordinator', collection: 'campaignUser' })
    expect(find).toHaveBeenCalledTimes(2)
  })

  it('fails closed when no privileged actor exists', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] })
    const die = vi.fn((message: string) => {
      throw new Error(message)
    })
    await expect(resolveCampaignActor({ find }, { die })).rejects.toThrow(/candidate\/coordinator/)
  })
})
