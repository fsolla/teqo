// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

const adapterClear = vi.fn(async () => undefined)

vi.mock('@tanstack/offline-transactions', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/offline-transactions')>(
    '@tanstack/offline-transactions',
  )
  return {
    ...actual,
    IndexedDBAdapter: class {
      clear = adapterClear
    },
  }
})

describe('campaignOps logout wipe (Pass 5 P0)', () => {
  afterEach(() => {
    vi.resetModules()
    adapterClear.mockClear()
  })

  it('clears estimate/municipality/domain IndexedDB when executor singletons are null', async () => {
    const { clearOpsEstimateOutboxForLogout } =
      await import('@/components/campaign/opsSync/opsEstimateOutbox')
    const { clearOpsMunicipalityOutboxForLogout } =
      await import('@/components/campaign/opsSync/opsMunicipalityOutbox')
    const { clearOpsDomainOutboxForLogout } =
      await import('@/components/campaign/opsSync/opsDomainOutbox')

    await clearOpsEstimateOutboxForLogout()
    await clearOpsMunicipalityOutboxForLogout()
    await clearOpsDomainOutboxForLogout()

    expect(adapterClear).toHaveBeenCalledTimes(3)
  })

  it('clearAllOpsMirrorPersistence settles without throwing when backends are empty', async () => {
    const { clearAllOpsMirrorPersistence } =
      await import('@/components/campaign/opsSync/opsMirrorPersistence')
    await expect(clearAllOpsMirrorPersistence()).resolves.toBeUndefined()
  })
})
