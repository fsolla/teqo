// @vitest-environment node

import { beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import {
  loadPlazaUpdatesFeed,
  loadPlazaUpdatesPreview,
  parsePlazaUpdateFeedParams,
  plazaUpdatesPageSize,
} from '@/utilities/plazaUpdatePageData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

type CapturedQuery = {
  text: string
  values: unknown[]
}

const capturePoolQueries = async <Result>(
  run: () => Promise<Result>,
): Promise<{ queries: CapturedQuery[]; result: Result }> => {
  const pool = payload.db.pool
  const originalOwnQueryDescriptor = Object.getOwnPropertyDescriptor(pool, 'query')
  const originalQueryIdentity = pool.query
  const queries: CapturedQuery[] = []
  pool.query = function (this: typeof pool, ...args: Parameters<typeof pool.query>) {
    const first = args[0]
    const config =
      typeof first === 'string' ? null : (first as { text?: string; values?: unknown[] })
    queries.push({
      text: typeof first === 'string' ? first : (config?.text ?? ''),
      values: config?.values ?? (Array.isArray(args[1]) ? args[1] : []),
    })
    return Reflect.apply(originalQueryIdentity, this, args)
  } as typeof pool.query

  try {
    return { queries, result: await run() }
  } finally {
    if (originalOwnQueryDescriptor) {
      Object.defineProperty(pool, 'query', originalOwnQueryDescriptor)
    } else {
      delete (pool as { query?: typeof pool.query }).query
    }
    expect(pool.query).toBe(originalQueryIdentity)
    expect(Object.getOwnPropertyDescriptor(pool, 'query')).toEqual(originalOwnQueryDescriptor)
    const healthCheck = await pool.query<{ value: number }>('select 1::int as value')
    expect(healthCheck.rows).toEqual([{ value: 1 }])
  }
}

const queryLimit = ({ text, values }: CapturedQuery): unknown => {
  const placeholder = text.match(/\blimit\s+\$(\d+)/i)?.[1]
  return placeholder ? values[Number(placeholder) - 1] : undefined
}

describe('campaign plaza update page data queries', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('parses feed params with a validated kind and strict positive page', () => {
    expect(parsePlazaUpdateFeedParams({})).toEqual({ page: 1 })
    expect(parsePlazaUpdateFeedParams({ updateKind: 'nota', updatePage: '2' })).toEqual({
      kind: 'nota',
      page: 2,
    })
    expect(parsePlazaUpdateFeedParams({ updateKind: 'invalida', updatePage: '0' })).toEqual({
      page: 1,
    })
    expect(parsePlazaUpdateFeedParams({ updateKind: ['urgente'], updatePage: ['3'] })).toEqual({
      kind: 'urgente',
      page: 3,
    })
  })

  it('loads only the paginated feed and its authors', async () => {
    const user = await campaignFixtures().createCampaignUser('coordinator', {
      name: campaignFixtures().value('Coordenação geral'),
      email: `${campaignFixtures().value('updates-loader')}@example.com`,
      password: campaignFixtures().value('password'),
    })
    const plaza = await campaignFixtures().getPlaza()
    for (let index = 0; index < 4; index += 1) {
      await payload.create({
        collection: 'plazaUpdate',
        data: {
          plaza: plaza.id,
          author: user.id,
          kind: 'nota',
          body: `Atualização ${index}`,
        },
        depth: 0,
      })
    }

    const { queries, result } = await capturePoolQueries(() =>
      loadPlazaUpdatesFeed(payload, user, plaza.id, { kind: 'nota', page: 1 }),
    )
    const updateQueries = queries.filter(({ text }) => /\bfrom\s+"plaza_update"/i.test(text))
    const updateDataQueries = updateQueries.filter((query) => queryLimit(query) !== undefined)
    const authorQueries = queries.filter(({ text }) => /\bfrom\s+"campaign_user"/i.test(text))

    expect(updateDataQueries).toHaveLength(1)
    expect(queryLimit(updateDataQueries[0]!)).toBe(plazaUpdatesPageSize)
    expect(authorQueries.length).toBeGreaterThanOrEqual(1)
    expect(result.updates).toHaveLength(4)
    expect(result.totalDocs).toBe(4)
    expect(result.updates[0]).toMatchObject({
      kind: 'nota',
      authorName: user.name,
    })
  })

  it('filters the feed by kind and paginates', async () => {
    const user = await campaignFixtures().createCampaignUser('coordinator')
    const plaza = await campaignFixtures().getPlaza()
    for (let index = 0; index < 3; index += 1) {
      await payload.create({
        collection: 'plazaUpdate',
        data: {
          plaza: plaza.id,
          author: user.id,
          kind: 'nota',
          body: `Nota ${index}`,
        },
        depth: 0,
      })
    }
    await payload.create({
      collection: 'plazaUpdate',
      data: {
        plaza: plaza.id,
        author: user.id,
        kind: 'urgente',
        body: 'Urgente único',
      },
      depth: 0,
    })

    const urgentOnly = await loadPlazaUpdatesFeed(payload, user, plaza.id, {
      kind: 'urgente',
      page: 1,
    })
    expect(urgentOnly.totalDocs).toBe(1)
    expect(urgentOnly.updates[0]?.body).toBe('Urgente único')

    const all = await loadPlazaUpdatesFeed(payload, user, plaza.id, { page: 1 })
    expect(all.totalDocs).toBe(4)
  })

  it('loads only the latest-three preview', async () => {
    const user = await campaignFixtures().createCampaignUser('coordinator')
    const plaza = await campaignFixtures().getPlaza()
    for (let index = 0; index < 4; index += 1) {
      await payload.create({
        collection: 'plazaUpdate',
        data: {
          plaza: plaza.id,
          author: user.id,
          kind: 'nota',
          body: `Prévia ${index}`,
        },
        depth: 0,
      })
    }

    const preview = await loadPlazaUpdatesPreview(payload, user, plaza.id)
    expect(preview).toHaveLength(3)
    expect(preview[0]?.body).toBe('Prévia 3')
  })

  it('scopes a leader feed to their own authored updates', async () => {
    const coordinator = await campaignFixtures().createCampaignUser('coordinator')
    const leaderAccount = await campaignFixtures().createCampaignUser('leader')
    const plaza = await campaignFixtures().getPlaza()
    const contact = await campaignFixtures().createContact()
    await campaignFixtures().createLeadership({
      contact: contact.id,
      plazas: [plaza.id],
      user: leaderAccount.id,
      supportStatus: 'engajado',
    })
    await campaignFixtures().createPlazaUpdate({
      plaza: plaza.id,
      author: coordinator.id,
      kind: 'nota',
      body: 'Registro da coordenação',
    })
    await campaignFixtures().createPlazaUpdate({
      plaza: plaza.id,
      author: leaderAccount.id,
      kind: 'nota',
      body: 'Registro da liderança',
    })

    const feed = await loadPlazaUpdatesFeed(payload, leaderAccount, plaza.id, { page: 1 })
    expect(feed.totalDocs).toBe(1)
    expect(feed.updates[0]?.body).toBe('Registro da liderança')
  })
})
