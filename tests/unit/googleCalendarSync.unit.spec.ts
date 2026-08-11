import { afterEach, describe, expect, it } from 'vitest'

import type { Activity, GoogleCalendarSync as GoogleCalendarSyncDoc } from '@/payload-types'

import {
  deriveGoogleCalendarSyncStatus,
  GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV,
  readGoogleServiceAccountCredentials,
  shouldSyncActivityOperation,
  shouldSyncConfigChange,
} from '@/utilities/googleCalendarSync'

describe('deriveGoogleCalendarSyncStatus', () => {
  const configured = { hasCredential: true, calendarId: 'c_abc@group.calendar.google.com' }

  it('is not-configured without credential or calendar id (fail-closed)', () => {
    expect(deriveGoogleCalendarSyncStatus({ hasCredential: false, calendarId: null })).toBe(
      'not-configured',
    )
    expect(deriveGoogleCalendarSyncStatus({ hasCredential: true, calendarId: null })).toBe(
      'not-configured',
    )
    expect(deriveGoogleCalendarSyncStatus({ hasCredential: false, calendarId: 'x' })).toBe(
      'not-configured',
    )
  })

  it('is disabled while disabledAt is set', () => {
    expect(
      deriveGoogleCalendarSyncStatus({ ...configured, disabledAt: '2026-08-11T10:00:00.000Z' }),
    ).toBe('disabled')
  })

  it('is paused while the last attempt failed', () => {
    expect(
      deriveGoogleCalendarSyncStatus({
        ...configured,
        lastSuccessAt: '2026-08-11T09:00:00.000Z',
        lastErrorAt: '2026-08-11T10:00:00.000Z',
      }),
    ).toBe('paused')
    expect(
      deriveGoogleCalendarSyncStatus({
        ...configured,
        lastErrorAt: '2026-08-11T10:00:00.000Z',
      }),
    ).toBe('paused')
  })

  it('recovers to synced after the last success', () => {
    expect(
      deriveGoogleCalendarSyncStatus({
        ...configured,
        lastSuccessAt: '2026-08-11T10:30:00.000Z',
        lastErrorAt: '2026-08-11T10:00:00.000Z',
      }),
    ).toBe('synced')
    expect(deriveGoogleCalendarSyncStatus(configured)).toBe('synced')
  })
})

describe('readGoogleServiceAccountCredentials', () => {
  const originalKey = process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV]

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV]
    } else {
      process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV] = originalKey
    }
  })

  it('parses the base64 JSON key into credentials', () => {
    const payload = {
      client_email: 'teqo-sa@projeto.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----\n',
    }
    process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV] = Buffer.from(
      JSON.stringify(payload),
      'utf8',
    ).toString('base64')

    expect(readGoogleServiceAccountCredentials()).toEqual({
      clientEmail: payload.client_email,
      privateKey: payload.private_key,
    })
  })

  it('returns null when the env is absent or malformed (fail-closed)', () => {
    delete process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV]
    expect(readGoogleServiceAccountCredentials()).toBeNull()

    process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV] = 'not-base64-json'
    expect(readGoogleServiceAccountCredentials()).toBeNull()

    process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV] = Buffer.from(
      JSON.stringify({ client_email: 'x' }),
      'utf8',
    ).toString('base64')
    expect(readGoogleServiceAccountCredentials()).toBeNull()
  })
})

describe('shouldSyncActivityOperation', () => {
  const activity = (overrides: Record<string, unknown> = {}) =>
    ({ id: 1, title: 'Caminhada', status: 'confirmado', ...overrides }) as unknown as Activity

  it('always syncs on create and delete', () => {
    expect(shouldSyncActivityOperation({ operation: 'create', doc: activity() })).toBe(true)
    expect(shouldSyncActivityOperation({ operation: 'delete', doc: activity() })).toBe(true)
  })

  it('skips updates that only touch non-mirrored fields (tasks, derived state)', () => {
    expect(
      shouldSyncActivityOperation({
        operation: 'update',
        doc: activity({ tasks: [{ title: 'Novo' }], taskDoneCount: 1 }),
        previousDoc: activity({ tasks: [{ title: 'Antigo' }], taskDoneCount: 0 }),
      }),
    ).toBe(false)
  })

  it.each([
    'title',
    'status',
    'startAt',
    'endAt',
    'allDay',
    'locality',
    'tags',
    'deputyPresent',
  ] as const)('syncs when the mirrored field %s changed', (field) => {
    expect(
      shouldSyncActivityOperation({
        operation: 'update',
        doc: activity({ [field]: 'changed' }),
        previousDoc: activity({ [field]: 'original' }),
      }),
    ).toBe(true)
  })

  it('syncs when the municipality relationship changed', () => {
    expect(
      shouldSyncActivityOperation({
        operation: 'update',
        doc: activity({ municipality: 2 }),
        previousDoc: activity({ municipality: 1 }),
      }),
    ).toBe(true)
  })

  it('does NOT sync when only non-mirrored fields changed (tasks, description, updates, result)', () => {
    expect(
      shouldSyncActivityOperation({
        operation: 'update',
        doc: activity({ description: 'novo texto', tasks: [{ title: 'Nova tarefa' }] }),
        previousDoc: activity({ description: 'texto antigo', tasks: [{ title: 'Antiga' }] }),
      }),
    ).toBe(false)
  })

  it('normalizes populated vs depth-0 relationship shapes (afterChange doc vs previousDoc)', () => {
    // The afterChange `doc` carries the populated municipality object; the
    // `previousDoc` is loaded depth-0 (numeric id) — same id must NOT change.
    expect(
      shouldSyncActivityOperation({
        operation: 'update',
        doc: activity({ municipality: { id: 7, name: 'Salvador' } }),
        previousDoc: activity({ municipality: 7 }),
      }),
    ).toBe(false)
    expect(
      shouldSyncActivityOperation({
        operation: 'update',
        doc: activity({ tags: ['B', 'A'] }),
        previousDoc: activity({ tags: ['A', 'B'] }),
      }),
    ).toBe(false)
    expect(
      shouldSyncActivityOperation({
        operation: 'update',
        doc: activity({ tags: ['A'] }),
        previousDoc: activity({ tags: ['B'] }),
      }),
    ).toBe(true)
  })
})

describe('shouldSyncConfigChange', () => {
  const config = (overrides: Record<string, unknown> = {}) =>
    ({
      id: 1,
      calendarId: 'c_a@group.calendar.google.com',
      ...overrides,
    }) as unknown as GoogleCalendarSyncDoc

  it('always syncs on create', () => {
    expect(shouldSyncConfigChange({ operation: 'create', doc: config() })).toBe(true)
  })

  it('skips state-only writes (engine recording outcomes) — no re-entry loop', () => {
    expect(
      shouldSyncConfigChange({
        operation: 'update',
        doc: config({ lastSyncedAt: '2026-08-11T10:00:00.000Z', lastSuccessAt: 'x' }),
        previousDoc: config(),
      }),
    ).toBe(false)
  })

  it('skips disabling (no sync needed while off)', () => {
    expect(
      shouldSyncConfigChange({
        operation: 'update',
        doc: config({ disabledAt: '2026-08-11T10:00:00.000Z' }),
        previousDoc: config(),
      }),
    ).toBe(false)
  })

  it('syncs when the calendarId changed (reconcile into the new calendar)', () => {
    expect(
      shouldSyncConfigChange({
        operation: 'update',
        doc: config({ calendarId: 'c_b@group.calendar.google.com' }),
        previousDoc: config(),
      }),
    ).toBe(true)
  })

  it('syncs when re-enabled (disabledAt cleared)', () => {
    expect(
      shouldSyncConfigChange({
        operation: 'update',
        doc: config(),
        previousDoc: config({ disabledAt: '2026-08-11T10:00:00.000Z' }),
      }),
    ).toBe(true)
  })
})
