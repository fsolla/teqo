// @vitest-environment node

import { beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import { loadNucleusActiveTabPageData } from '@/utilities/nucleusDetailPageData'
import { nucleusUpdatePageSize } from '@/utilities/nucleusUpdateUi'

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

describe('campaign nucleus update page data queries', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('loads only the paginated feed and its authors for the active updates tab', async () => {
    const user = await campaignFixtures().createCampaignUser('geral', {
      name: campaignFixtures().value('Coordenação geral'),
      email: `${campaignFixtures().value('updates-loader')}@example.com`,
      password: campaignFixtures().value('password'),
    })
    const nucleus = await campaignFixtures().createNucleus({
      name: campaignFixtures().value('Núcleo feed real'),
      regions: ['Metropolitano de Salvador'],
      cities: ['Salvador'],
      organizationKind: 'territorial',
    })
    for (let index = 0; index < 4; index += 1) {
      await payload.create({
        collection: 'nucleusUpdate',
        data: {
          nucleus: nucleus.id,
          author: user.id,
          kind: 'nota',
          body: `Atualização ${index}`,
        },
        depth: 0,
      })
    }
    const context = { id: nucleus.id, slug: nucleus.slug, document: nucleus } as never

    const { queries, result } = await capturePoolQueries(() =>
      loadNucleusActiveTabPageData(payload, user, context, 'updates', {
        updateKind: 'nota',
        updatePage: '1',
      }),
    )
    const updateQueries = queries.filter(({ text }) => /\bfrom\s+"nucleus_update"/i.test(text))
    const updateDataQueries = updateQueries.filter((query) => queryLimit(query) !== undefined)
    const authorQueries = queries.filter(({ text }) => /\bfrom\s+"campaign_user"/i.test(text))

    expect(updateQueries).toHaveLength(2)
    expect(updateDataQueries).toHaveLength(1)
    expect(queryLimit(updateDataQueries[0])).toBe(nucleusUpdatePageSize)
    expect(updateDataQueries.some((query) => queryLimit(query) === 3)).toBe(false)
    expect(authorQueries.length).toBeGreaterThanOrEqual(1)
    expect(result.tab).toBe('updates')
    if (result.tab !== 'updates') throw new Error('Expected updates page data')
    expect(result.updatesPageData.updates).toHaveLength(4)
    expect(result.updatesPageData).not.toHaveProperty('preview')
    expect(JSON.stringify(result)).not.toContain('"preview"')
  })

  it('loads only the latest-three preview and its authors for overview', async () => {
    const user = await campaignFixtures().createCampaignUser('geral', {
      name: campaignFixtures().value('Coordenação geral'),
      email: `${campaignFixtures().value('overview-loader')}@example.com`,
      password: campaignFixtures().value('password'),
    })
    const nucleus = await campaignFixtures().createNucleus({
      name: campaignFixtures().value('Núcleo preview real'),
      regions: ['Metropolitano de Salvador'],
      cities: ['Salvador'],
      organizationKind: 'territorial',
    })
    for (let index = 0; index < 4; index += 1) {
      await payload.create({
        collection: 'nucleusUpdate',
        data: {
          nucleus: nucleus.id,
          author: user.id,
          kind: 'nota',
          body: `Prévia ${index}`,
        },
        depth: 0,
      })
    }
    const context = { id: nucleus.id, slug: nucleus.slug, document: nucleus } as never

    const { queries, result } = await capturePoolQueries(() =>
      loadNucleusActiveTabPageData(payload, user, context, 'overview', {}),
    )
    const updateQueries = queries.filter(({ text }) => /\bfrom\s+"nucleus_update"/i.test(text))
    const updateDataQueries = updateQueries.filter((query) => queryLimit(query) !== undefined)
    const authorQueries = queries.filter(({ text }) => /\bfrom\s+"campaign_user"/i.test(text))

    expect(updateQueries).toHaveLength(2)
    expect(updateDataQueries).toHaveLength(1)
    expect(queryLimit(updateDataQueries[0])).toBe(3)
    expect(updateDataQueries.some((query) => queryLimit(query) === nucleusUpdatePageSize)).toBe(
      false,
    )
    expect(authorQueries.length).toBeGreaterThanOrEqual(1)
    expect(result.tab).toBe('overview')
    if (result.tab !== 'overview') throw new Error('Expected overview page data')
    expect(result.updatePreview).toHaveLength(3)
    expect(result).not.toHaveProperty('updatesPageData')
  })
})
