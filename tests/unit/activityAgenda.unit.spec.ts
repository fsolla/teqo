import { describe, expect, it } from 'vitest'

import {
  ACTIVITY_AGENDA_MAX_RANGE_DAYS,
  activityAgendaRequestSchema,
  activityRescheduleSchema,
} from '@/lib/schemas/activity'
import type { Activity, CampaignUser, Municipality } from '@/payload-types'
import { canCampaignUserRescheduleActivity } from '@/utilities/access/activities'
import { toActivityAgendaEvent } from '@/utilities/activityViewModels'

import { stub } from '../helpers/stub'

const user = (role: CampaignUser['role']): CampaignUser =>
  ({ role, collection: 'campaignUser' }) as CampaignUser

describe('activity agenda request', () => {
  it('normalizes offset instants and accepts the largest supported month range', () => {
    const start = '2026-08-01T00:00:00-03:00'
    const end = new Date(
      new Date(start).getTime() + ACTIVITY_AGENDA_MAX_RANGE_DAYS * 86_400_000,
    ).toISOString()

    expect(
      activityAgendaRequestSchema.parse({
        rangeStart: start,
        rangeEnd: end,
        municipality: 12,
        deputyPresent: true,
        tag: 'Comício',
      }),
    ).toEqual({
      rangeStart: '2026-08-01T03:00:00.000Z',
      rangeEnd: end,
      municipality: 12,
      deputyPresent: true,
      tag: 'Comício',
    })
  })

  it('rejects reversed and oversized ranges', () => {
    expect(
      activityAgendaRequestSchema.safeParse({
        rangeStart: '2026-08-10T03:00:00.000Z',
        rangeEnd: '2026-08-03T03:00:00.000Z',
      }).success,
    ).toBe(false)
    expect(
      activityAgendaRequestSchema.safeParse({
        rangeStart: '2026-08-01T03:00:00.000Z',
        rangeEnd: '2026-09-16T03:00:00.000Z',
      }).success,
    ).toBe(false)
  })
})

describe('activity reschedule input', () => {
  it('normalizes instants and preserves an absent end', () => {
    expect(
      activityRescheduleSchema.parse({
        id: 7,
        allDay: false,
        startAt: '2026-08-07T10:00:00-03:00',
        endAt: null,
      }),
    ).toEqual({
      id: 7,
      allDay: false,
      startAt: '2026-08-07T13:00:00.000Z',
      endAt: null,
    })
  })

  it('rejects an end that is not after the start', () => {
    expect(
      activityRescheduleSchema.safeParse({
        id: 7,
        allDay: false,
        startAt: '2026-08-07T13:00:00.000Z',
        endAt: '2026-08-07T12:59:00.000Z',
      }).success,
    ).toBe(false)
  })

  it('accepts a single-day all-day range (end equals start)', () => {
    expect(
      activityRescheduleSchema.parse({
        id: 7,
        allDay: true,
        startAt: '2026-08-10T03:00:00.000Z',
        endAt: '2026-08-10T03:00:00.000Z',
      }),
    ).toEqual({
      id: 7,
      allDay: true,
      startAt: '2026-08-10T03:00:00.000Z',
      endAt: '2026-08-10T03:00:00.000Z',
    })
  })

  it('rejects an all-day range whose end precedes the start', () => {
    expect(
      activityRescheduleSchema.safeParse({
        id: 7,
        allDay: true,
        startAt: '2026-08-12T03:00:00.000Z',
        endAt: '2026-08-10T03:00:00.000Z',
      }).success,
    ).toBe(false)
  })

  it('requires an end for all-day events', () => {
    expect(
      activityRescheduleSchema.safeParse({
        id: 7,
        allDay: true,
        startAt: '2026-08-10T03:00:00.000Z',
        endAt: null,
      }).success,
    ).toBe(false)
  })
})

describe('activity reschedule policy', () => {
  it('allows all staff to move an ordinary activity', () => {
    for (const role of ['coordinator', 'candidate', 'advisor'] as const) {
      expect(canCampaignUserRescheduleActivity(user(role), false)).toBe(true)
    }
  })

  it('allows only coordinator and candidate to move a deputy commitment', () => {
    expect(canCampaignUserRescheduleActivity(user('coordinator'), true)).toBe(true)
    expect(canCampaignUserRescheduleActivity(user('candidate'), true)).toBe(true)
    expect(canCampaignUserRescheduleActivity(user('advisor'), true)).toBe(false)
    expect(canCampaignUserRescheduleActivity(user('leader'), true)).toBe(false)
  })
})

describe('activity agenda event view model', () => {
  it('returns only the operational calendar fields and an existing detail URL', () => {
    const event = toActivityAgendaEvent(
      stub<Activity>({
        id: 7,
        title: 'Caminhada no centro',
        slug: 'caminhada-no-centro',
        tags: ['Caminhada'],
        status: 'confirmado',
        deputyPresent: false,
        startAt: '2026-08-07T13:00:00.000Z',
        endAt: null,
        municipality: stub<Municipality>({ id: 12, name: 'Ilhéus', slug: 'ilheus' }),
        locality: 'Centro histórico',
      }),
      user('advisor'),
    )

    expect(event).toEqual({
      id: 7,
      title: 'Caminhada no centro',
      href: '/campanha/atividades/caminhada-no-centro',
      tags: ['Caminhada'],
      status: 'confirmado',
      deputyPresent: false,
      allDay: false,
      startAt: '2026-08-07T13:00:00.000Z',
      endAt: null,
      municipality: { id: 12, name: 'Ilhéus', slug: 'ilheus' },
      locality: 'Centro histórico',
      canReschedule: true,
    })
  })

  it('carries the all-day flag for full-day commitments', () => {
    expect(
      toActivityAgendaEvent(
        stub<Activity>({
          id: 9,
          title: 'Giro no interior',
          slug: 'giro-no-interior',
          tags: [],
          status: 'confirmado',
          allDay: true,
          startAt: '2026-08-10T03:00:00.000Z',
          endAt: '2026-08-12T03:00:00.000Z',
          municipality: stub<Municipality>({ id: 12, name: 'Ilhéus', slug: 'ilheus' }),
        }),
        user('advisor'),
      ).allDay,
    ).toBe(true)
  })

  it('marks a deputy commitment read-only for an advisor', () => {
    expect(
      toActivityAgendaEvent(
        stub<Activity>({
          id: 8,
          title: 'Comício',
          slug: 'comicio',
          tags: [],
          status: 'confirmado',
          deputyPresent: true,
          startAt: '2026-08-08T22:00:00.000Z',
          municipality: stub<Municipality>({ id: 12, name: 'Ilhéus', slug: 'ilheus' }),
        }),
        user('advisor'),
      ).canReschedule,
    ).toBe(false)
  })
})
