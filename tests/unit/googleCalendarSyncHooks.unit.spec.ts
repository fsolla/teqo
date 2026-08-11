import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Activity, GoogleCalendarSync as GoogleCalendarSyncDoc } from '@/payload-types'
import type { PayloadRequest } from 'payload'

/**
 * Hook → engine wiring (the guards themselves are unit-tested in
 * `googleCalendarSync.unit.spec.ts`): the hooks must call the engine exactly
 * when the guard says so, and NEVER throw into the write path. The hooks live
 * in their own module (`googleCalendarSyncHooks.ts`), so mocking the engine
 * at the import boundary reliably intercepts the wiring.
 */
vi.mock('@/utilities/googleCalendarSync', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/utilities/googleCalendarSync')>()
  return { ...original, runCampaignCalendarSync: vi.fn() }
})

import { runCampaignCalendarSync } from '@/utilities/googleCalendarSync'
import {
  activityGoogleCalendarSyncHook,
  googleCalendarSyncConfigHook,
} from '@/utilities/googleCalendarSyncHooks'

const mockedRun = vi.mocked(runCampaignCalendarSync)

const fakeReq = { payload: {} } as unknown as PayloadRequest
const activity = (overrides: Record<string, unknown> = {}) =>
  ({ id: 1, title: 'Caminhada', status: 'confirmado', ...overrides }) as unknown as Activity
const config = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 1,
    calendarId: 'c_a@group.calendar.google.com',
    ...overrides,
  }) as unknown as GoogleCalendarSyncDoc

const settledOutcome = { status: 'synced' as const, created: 0, updated: 0, deleted: 0, at: '' }

describe('activityGoogleCalendarSyncHook wiring', () => {
  beforeEach(() => {
    mockedRun.mockReset()
    mockedRun.mockResolvedValue(settledOutcome)
  })

  it('calls the engine on create, delete and relevant updates; skips task-only updates', async () => {
    await activityGoogleCalendarSyncHook({
      doc: activity(),
      operation: 'create',
      req: fakeReq,
    })
    expect(mockedRun).toHaveBeenCalledTimes(1)

    await activityGoogleCalendarSyncHook({
      doc: activity({ tasks: [{ title: 'Novo' }] }),
      previousDoc: activity({ tasks: [{ title: 'Antigo' }] }),
      operation: 'update',
      req: fakeReq,
    })
    expect(mockedRun).toHaveBeenCalledTimes(1)

    await activityGoogleCalendarSyncHook({
      doc: activity({ title: 'Caminhada (remarcada)' }),
      previousDoc: activity(),
      operation: 'update',
      req: fakeReq,
    })
    expect(mockedRun).toHaveBeenCalledTimes(2)

    // Delete: afterDelete hooks carry no `operation` — absence means delete.
    await activityGoogleCalendarSyncHook({
      doc: activity(),
      req: fakeReq,
    })
    expect(mockedRun).toHaveBeenCalledTimes(3)
  })

  it('never throws into the activity write path', async () => {
    mockedRun.mockRejectedValue(new Error('boom'))
    await expect(
      activityGoogleCalendarSyncHook({
        doc: activity(),
        operation: 'create',
        req: fakeReq,
      }),
    ).resolves.toBeDefined()
  })
})

describe('googleCalendarSyncConfigHook wiring', () => {
  beforeEach(() => {
    mockedRun.mockReset()
    mockedRun.mockResolvedValue(settledOutcome)
  })

  it('calls the engine on create, calendarId change and re-enable; skips state writes and disable', async () => {
    await googleCalendarSyncConfigHook({
      doc: config(),
      operation: 'create',
      req: fakeReq,
    })
    expect(mockedRun).toHaveBeenCalledTimes(1)

    await googleCalendarSyncConfigHook({
      doc: config({ lastSyncedAt: '2026-08-11T10:00:00.000Z' }),
      previousDoc: config(),
      operation: 'update',
      req: fakeReq,
    })
    expect(mockedRun).toHaveBeenCalledTimes(1)

    await googleCalendarSyncConfigHook({
      doc: config({ disabledAt: '2026-08-11T10:00:00.000Z' }),
      previousDoc: config(),
      operation: 'update',
      req: fakeReq,
    })
    expect(mockedRun).toHaveBeenCalledTimes(1)

    await googleCalendarSyncConfigHook({
      doc: config({ calendarId: 'c_b@group.calendar.google.com' }),
      previousDoc: config(),
      operation: 'update',
      req: fakeReq,
    })
    expect(mockedRun).toHaveBeenCalledTimes(2)

    await googleCalendarSyncConfigHook({
      doc: config(),
      previousDoc: config({ disabledAt: '2026-08-11T10:00:00.000Z' }),
      operation: 'update',
      req: fakeReq,
    })
    expect(mockedRun).toHaveBeenCalledTimes(3)
  })

  it('never throws into admin writes', async () => {
    mockedRun.mockRejectedValue(new Error('boom'))
    await expect(
      googleCalendarSyncConfigHook({
        doc: config({ calendarId: 'c_b@group.calendar.google.com' }),
        previousDoc: config(),
        operation: 'update',
        req: fakeReq,
      }),
    ).resolves.toBeDefined()
  })
})
