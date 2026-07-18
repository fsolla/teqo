// @vitest-environment node

import { beforeAll, describe, expect, it } from 'vitest'
import { getPayload, type Payload } from 'payload'

import config from '@/payload.config'
import { loadNucleusDetailPageData } from '@/utilities/nucleusDetailPageData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('campaign accessible nucleus detail context', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  it('uses one real PostgreSQL slug predicate and omits inactive tab fields', async () => {
    const user = await campaignFixtures().createCampaignUser('geral', {
      name: campaignFixtures().value('Coordenação geral'),
      email: `${campaignFixtures().value('detail-context')}@example.com`,
      password: campaignFixtures().value('password'),
    })
    const nucleus = await campaignFixtures().createNucleus({
      name: campaignFixtures().value('Núcleo contexto real'),
      region: 'Metropolitano de Salvador',
      city: 'Salvador',
      organizationKind: 'territorial',
    })

    const pool = payload.db.pool
    const originalOwnQueryDescriptor = Object.getOwnPropertyDescriptor(pool, 'query')
    const originalQueryIdentity = pool.query
    const sqlStatements: string[] = []
    pool.query = function (this: typeof pool, ...args: Parameters<typeof pool.query>) {
      const first = args[0]
      sqlStatements.push(
        typeof first === 'string' ? first : ((first as { text?: string }).text ?? ''),
      )
      return Reflect.apply(originalQueryIdentity, this, args)
    } as typeof pool.query

    try {
      const data = await loadNucleusDetailPageData(payload, user, nucleus.slug, 'territory')

      expect(data.context.id).toBe(nucleus.id)
      expect(data.view.id).toBe(nucleus.id)
      expect(data.coordinatorAssignment).toBeDefined()
      expect(data.context.document.voterProfiles).toBeUndefined()
      expect(data.context.document.strengths).toBeUndefined()
      expect(data.context.document.risks).toBeUndefined()
      expect(data).not.toHaveProperty('leadershipPageData')
      expect(data).not.toHaveProperty('updatesPageData')
      expect(data).not.toHaveProperty('primaryContactPageData')
    } finally {
      if (originalOwnQueryDescriptor) {
        Object.defineProperty(pool, 'query', originalOwnQueryDescriptor)
      } else {
        delete (pool as { query?: typeof pool.query }).query
      }
    }

    expect(pool.query).toBe(originalQueryIdentity)
    expect(Object.getOwnPropertyDescriptor(pool, 'query')).toEqual(originalOwnQueryDescriptor)
    const healthCheck = await pool.query<{ value: number }>('select 1::int as value')
    expect(healthCheck.rows).toEqual([{ value: 1 }])

    const slugPredicates = sqlStatements.filter(
      (statement) =>
        /from\s+"electoral_nucleus"/i.test(statement) &&
        /"electoral_nucleus"\."slug"\s*=\s*\$1/i.test(statement),
    )
    expect(slugPredicates).toHaveLength(1)
  })
})
