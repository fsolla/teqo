// @vitest-environment node

import { sql } from '@payloadcms/db-postgres'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { getPayload, type Payload } from 'payload'

import { createNucleusUpdateFormRecordAction } from '@/app/(campaign)/campanha/(app)/nucleos/[slug]/nucleusUpdateFormActions'
import { createNucleusUpdateRecord } from '@/app/(campaign)/campanha/actions/nucleusUpdate'
import { CampaignDashboard } from '@/components/campaign/CampaignDashboard'
import type { CampaignUser } from '@/payload-types'
import config from '@/payload.config'
import { getCampaignDashboardPageData } from '@/utilities/campaignDashboardPageData'
import { getBahiaWeekRange } from '@/utilities/campaignTime'
import { resolveAccessibleNucleusContext } from '@/utilities/nucleusPageData'
import {
  getNucleusUpdatesPageData,
  getNucleusUpdatesPreviewData,
} from '@/utilities/nucleusUpdatePageData'
import {
  buildNucleusUpdateHref,
  nucleusUpdatePageSize,
  parseNucleusUpdateListState,
} from '@/utilities/nucleusUpdateUi'

import {
  type CampaignFixtures,
  withCampaignFixtures,
} from '../helpers/campaignFixtures'

let payload: Payload

// Builds the Contact → Leadership graph used by dashboard support and access scenarios.
const createDashboardLeadershipGraph = async ({
  fixtures,
  general,
  leader,
  nucleus,
  supportStatus = 'engajado',
}: {
  fixtures: CampaignFixtures
  general: CampaignUser
  leader?: CampaignUser
  nucleus: number
  supportStatus?: 'engajado' | 'a_abordar' | 'em_disputa' | 'negativo'
}) => {
  const contact = await fixtures.createContact({
    name: fixtures.value('Liderança painel'),
  })
  return fixtures.createLeadership({
    contact,
    nucleus,
    user: leader,
    supportStatus,
    createdBy: general,
  })
}

const setUpdateCreatedAt = async (id: number, createdAt: Date): Promise<void> => {
  await payload.db.drizzle.execute(
    sql`UPDATE "nucleus_update" SET "created_at" = ${createdAt.toISOString()} WHERE "id" = ${id}`,
  )
}

// Creates a domain update and optionally positions it at an exact weekly boundary.
const createTimestampedNucleusNote = async (
  actor: CampaignUser,
  nucleus: number,
  body: string,
  createdAt?: Date,
) => {
  const update = await createNucleusUpdateRecord(payload, actor, {
    nucleus,
    kind: 'nota',
    body,
  })
  if (createdAt) await setUpdateCreatedAt(update.id, createdAt)
  return update
}

describe('campaign dashboard and updates UI', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('computes the exact half-open Bahia week around both boundary instants', () => {
    const beforeMonday = getBahiaWeekRange(new Date('2026-07-13T02:59:59.999Z'))
    const atMonday = getBahiaWeekRange(new Date('2026-07-13T03:00:00.000Z'))

    expect(beforeMonday).toEqual({
      start: new Date('2026-07-06T03:00:00.000Z'),
      end: new Date('2026-07-13T03:00:00.000Z'),
    })
    expect(atMonday).toEqual({
      start: new Date('2026-07-13T03:00:00.000Z'),
      end: new Date('2026-07-20T03:00:00.000Z'),
    })
  })

  it('excludes archived nuclei from support aggregates and Bahia weekly updates', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const general = await fixtures.createCampaignUser('geral')
      const active = await fixtures.createNucleus()
      const archived = await fixtures.createNucleus({ status: 'arquivado' })
      await createDashboardLeadershipGraph({
        fixtures,
        general,
        nucleus: active.id,
        supportStatus: 'negativo',
      })
      await createDashboardLeadershipGraph({
        fixtures,
        general,
        nucleus: archived.id,
        supportStatus: 'negativo',
      })

      const now = new Date('2035-05-18T12:00:00.000Z')
      const range = getBahiaWeekRange(now)
      const lowerIncluded = await createTimestampedNucleusNote(
        general,
        active.id,
        'Limite inferior incluído',
        range.start,
      )
      const lowerExcluded = await createTimestampedNucleusNote(
        general,
        active.id,
        'Antes do limite inferior',
        new Date(range.start.getTime() - 1),
      )
      const upperExcluded = await createTimestampedNucleusNote(
        general,
        active.id,
        'Limite superior excluído',
        range.end,
      )
      const archivedExcluded = await createTimestampedNucleusNote(
        general,
        archived.id,
        'Núcleo arquivado excluído',
        new Date(range.start.getTime() + 60_000),
      )

      const originalFind = payload.find.bind(payload)
      let queriedNegativeSupportCount: number | undefined
      const findSpy = vi.spyOn(payload, 'find').mockImplementation(async (args) => {
        const result = await originalFind(args as never)
        if (args.collection === 'leadership') {
          queriedNegativeSupportCount = (result.docs as Array<{ supportStatus?: string }>).filter(
            (leadership) => leadership.supportStatus === 'negativo',
          ).length
        }
        return result as never
      })
      const view = await getCampaignDashboardPageData(payload, general, now)
      findSpy.mockRestore()
      if (view.role !== 'geral') throw new Error('Painel geral esperado.')

      expect(view.supportCounts.negativo).toBe(queriedNegativeSupportCount)
      const expectedWeeklyUpdates = await payload.find({
        collection: 'nucleusUpdate',
        where: {
          and: [
            { 'nucleus.status': { equals: 'ativo' } },
            { createdAt: { greater_than_equal: range.start.toISOString() } },
            { createdAt: { less_than: range.end.toISOString() } },
          ],
        },
        depth: 0,
        pagination: false,
        select: { createdAt: true },
        user: general,
        overrideAccess: false,
      })
      const weeklyIds = expectedWeeklyUpdates.docs.map(({ id }) => id)
      expect(weeklyIds).toContain(lowerIncluded.id)
      expect(weeklyIds).not.toContain(lowerExcluded.id)
      expect(weeklyIds).not.toContain(upperExcluded.id)
      expect(weeklyIds).not.toContain(archivedExcluded.id)
      expect(view.kpis.updatesThisWeek).toBe(expectedWeeklyUpdates.totalDocs)
    })
  }, 30_000)

  it('treats a legacy downgraded coordinator assignment as uncovered without leaking identity', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const general = await fixtures.createCampaignUser('geral')
      const staleCoordinatorPhone = fixtures.phone()
      const staleCoordinator = await fixtures.createCampaignUser('coordenador', {
        phone: staleCoordinatorPhone,
      })
      const leader = await fixtures.createCampaignUser('lideranca', {
        phone: fixtures.phone(),
      })
      const nucleus = await fixtures.createNucleus({ coordinators: [staleCoordinator.id] })
      await createDashboardLeadershipGraph({
        fixtures,
        general,
        leader,
        nucleus: nucleus.id,
      })

      await payload.db.drizzle.execute(
        sql`UPDATE "campaign_user" SET "role" = 'lideranca' WHERE "id" = ${staleCoordinator.id}`,
      )

      try {
        const generalView = await getCampaignDashboardPageData(payload, general)
        const leaderView = await getCampaignDashboardPageData(payload, leader)
        if (generalView.role !== 'geral') throw new Error('Painel geral esperado.')
        if (leaderView.role !== 'lideranca') throw new Error('Painel de liderança esperado.')

        expect(generalView.queues.withoutCoordinator.map(({ id }) => id)).toContain(nucleus.id)
        expect(leaderView.cards.find(({ id }) => id === nucleus.id)?.coordinators).toEqual([])
        const serialized = JSON.stringify(leaderView)
        expect(serialized).not.toContain(staleCoordinator.name)
        expect(serialized).not.toContain(staleCoordinatorPhone)
      } finally {
        await payload.db.drizzle.execute(
          sql`UPDATE "campaign_user" SET "role" = 'coordenador' WHERE "id" = ${staleCoordinator.id}`,
        )
      }
    })
  }, 15_000)

  it('omits a status redacted by real Payload field access after a role downgrade', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const general = await fixtures.createCampaignUser('geral')
      const coordinator = await fixtures.createCampaignUser('coordenador')
      const nucleus = await fixtures.createNucleus({ coordinators: [coordinator.id] })
      await createDashboardLeadershipGraph({
        fixtures,
        general,
        leader: coordinator,
        nucleus: nucleus.id,
      })

      await payload.db.drizzle.execute(
        sql`UPDATE "campaign_user" SET "role" = 'lideranca' WHERE "id" = ${coordinator.id}`,
      )

      try {
        const view = await getCampaignDashboardPageData(payload, coordinator)
        if (view.role !== 'coordenador') throw new Error('Painel de coordenação esperado.')

        const card = view.cards.find(({ id }) => id === nucleus.id)
        expect(card?.leadershipCounts).toEqual({
          engaged: 0,
          toApproach: 0,
          disputed: 0,
        })
        const html = renderToStaticMarkup(createElement(CampaignDashboard, { view, now: new Date() }))
        expect(html).not.toContain('data-support-status="undefined"')
      } finally {
        await payload.db.drizzle.execute(
          sql`UPDATE "campaign_user" SET "role" = 'coordenador' WHERE "id" = ${coordinator.id}`,
        )
      }
    })
  })

  it('returns only authorized coordinator names and normalized contact phones to leadership', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const general = await fixtures.createCampaignUser('geral')
      const coordinatorPhone = fixtures.phone()
      const validCoordinator = await fixtures.createCampaignUser('coordenador', {
        phone: coordinatorPhone,
      })
      const invalidCoordinator = await fixtures.createCampaignUser('coordenador')
      const leader = await fixtures.createCampaignUser('lideranca', {
        phone: fixtures.phone(),
      })
      const validNucleus = await fixtures.createNucleus({
        coordinators: [general.id, validCoordinator.id],
      })
      const invalidNucleus = await fixtures.createNucleus({
        coordinators: [invalidCoordinator.id],
      })
      await createDashboardLeadershipGraph({
        fixtures,
        general,
        leader,
        nucleus: validNucleus.id,
      })
      await createDashboardLeadershipGraph({
        fixtures,
        general,
        leader,
        nucleus: invalidNucleus.id,
      })

      const findSpy = vi.spyOn(payload, 'find')
      const view = await getCampaignDashboardPageData(
        payload,
        leader,
        new Date('2026-07-17T12:00:00.000Z'),
      )
      const coordinatorRead = findSpy.mock.calls
        .map(([args]) => args)
        .find((args) => args.collection === 'campaignUser')
      findSpy.mockRestore()
      if (view.role !== 'lideranca') throw new Error('Painel de liderança esperado.')

      expect(coordinatorRead).toMatchObject({
        depth: 0,
        overrideAccess: false,
        select: { name: true, phone: true },
        user: leader,
      })
      expect(coordinatorRead?.select).not.toHaveProperty('username')
      const validCard = view.cards.find(({ id }) => id === validNucleus.id)
      const invalidCard = view.cards.find(({ id }) => id === invalidNucleus.id)
      expect(validCard?.coordinators).toEqual([
        { name: general.name, phone: null },
        { name: validCoordinator.name, phone: coordinatorPhone },
      ])
      expect(invalidCard?.coordinators).toEqual([{ name: invalidCoordinator.name, phone: null }])
      const serialized = JSON.stringify(view)
      expect(serialized).not.toContain('username')
      expect(serialized).not.toContain('email')
      const html = renderToStaticMarkup(
        createElement(CampaignDashboard, {
          view,
          now: new Date('2026-07-17T12:00:00.000Z'),
        }),
      )
      expect(html).toContain(`https://wa.me/55${coordinatorPhone}`)
      expect(html).toContain('Falar no WhatsApp')
      expect(html).toContain('Contato não disponível')
    })
  })

  it('denies a foreign nucleus and keeps leadership update visibility own-only', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const general = await fixtures.createCampaignUser('geral')
      const coordinator = await fixtures.createCampaignUser('coordenador')
      const otherCoordinator = await fixtures.createCampaignUser('coordenador')
      const leader = await fixtures.createCampaignUser('lideranca', {
        phone: fixtures.phone(),
      })
      const otherLeader = await fixtures.createCampaignUser('lideranca', {
        phone: fixtures.phone(),
      })
      const nucleus = await fixtures.createNucleus({ coordinators: [coordinator.id] })
      const foreignNucleus = await fixtures.createNucleus({
        coordinators: [otherCoordinator.id],
      })
      await createDashboardLeadershipGraph({ fixtures, general, leader, nucleus: nucleus.id })
      await createDashboardLeadershipGraph({
        fixtures,
        general,
        leader: otherLeader,
        nucleus: nucleus.id,
      })
      const own = await createTimestampedNucleusNote(leader, nucleus.id, 'Atualização própria')
      await createTimestampedNucleusNote(otherLeader, nucleus.id, 'Atualização alheia')

      const context = await resolveAccessibleNucleusContext(payload, leader, nucleus.slug)
      const page = await getNucleusUpdatesPageData(payload, leader, context, {
        page: 1,
      })
      expect(page.updates.map(({ id }) => id)).toEqual([own.id])
      await expect(
        resolveAccessibleNucleusContext(payload, coordinator, foreignNucleus.slug),
      ).rejects.toThrow()
    })
  })

  it('applies URL kind filters with bounded pagination and a separate latest-three preview', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const general = await fixtures.createCampaignUser('geral')
      const coordinator = await fixtures.createCampaignUser('coordenador')
      const nucleus = await fixtures.createNucleus({ coordinators: [coordinator.id] })
      for (let index = 0; index < nucleusUpdatePageSize + 1; index += 1) {
        await createTimestampedNucleusNote(general, nucleus.id, `Nota paginada ${index}`)
      }
      await createNucleusUpdateRecord(payload, general, {
        nucleus: nucleus.id,
        kind: 'urgente',
        body: 'Urgente mais recente',
      })

      const state = parseNucleusUpdateListState({
        tab: 'updates',
        updateKind: 'nota',
        updatePage: '2',
      })
      const context = await resolveAccessibleNucleusContext(payload, coordinator, nucleus.slug)
      const page = await getNucleusUpdatesPageData(payload, coordinator, context, state)
      const preview = await getNucleusUpdatesPreviewData(payload, coordinator, context)

      expect(page.kind).toBe('nota')
      expect(page.page).toBe(2)
      expect(page.totalDocs).toBe(nucleusUpdatePageSize + 1)
      expect(page.updates).toHaveLength(1)
      expect(page.updates.every(({ kind }) => kind === 'nota')).toBe(true)
      expect(page).not.toHaveProperty('preview')
      expect(preview).toHaveLength(3)
      expect(preview[0]?.kind).toBe('urgente')
    })
  })

  it('preserves unrelated query state while building update filter and pagination URLs', () => {
    const raw = {
      tab: 'updates',
      leadership: '9',
      updateKind: 'semanal',
      updatePage: '3',
      focus: ['a', 'b'],
    }

    expect(buildNucleusUpdateHref('nucleo-chapada', raw, { kind: 'nota', page: 2 })).toBe(
      '/campanha/nucleos/nucleo-chapada?tab=updates&leadership=9&focus=a&focus=b&updateKind=nota&updatePage=2',
    )
    expect(parseNucleusUpdateListState({ updateKind: 'forjado', updatePage: '999999' })).toEqual({
      page: 1,
    })
  })

  it('creates through the form action and returns a denial state outside coordinator scope', async () => {
    await withCampaignFixtures(payload, async (fixtures) => {
      const coordinator = await fixtures.createCampaignUser('coordenador')
      const otherCoordinator = await fixtures.createCampaignUser('coordenador')
      const nucleus = await fixtures.createNucleus({ coordinators: [coordinator.id] })
      const foreignNucleus = await fixtures.createNucleus({
        coordinators: [otherCoordinator.id],
      })
      const validForm = new FormData()
      validForm.set('nucleus', String(nucleus.id))
      validForm.set('kind', 'nota')
      validForm.set('body', 'Registro via formulário')
      const deniedForm = new FormData()
      deniedForm.set('nucleus', String(foreignNucleus.id))
      deniedForm.set('kind', 'nota')
      deniedForm.set('body', 'Tentativa fora do escopo')

      const success = await createNucleusUpdateFormRecordAction(payload, coordinator, validForm)
      const denied = await createNucleusUpdateFormRecordAction(payload, coordinator, deniedForm)

      expect(success).toMatchObject({ status: 'success' })
      expect(denied.status).toBeUndefined()
      expect(denied.message).toContain('Verifique seu acesso')
      const persisted = await payload.find({
        collection: 'nucleusUpdate',
        where: {
          and: [
            { nucleus: { equals: nucleus.id } },
            { body: { equals: 'Registro via formulário' } },
          ],
        },
        depth: 0,
        pagination: false,
        user: coordinator,
        overrideAccess: false,
      })
      expect(persisted.totalDocs).toBe(1)
    })
  })
})
