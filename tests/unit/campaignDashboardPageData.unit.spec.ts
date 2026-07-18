import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'

import { CampaignDashboard } from '@/components/campaign/CampaignDashboard'
import { leadershipSupportStatuses } from '@/lib/schemas/leadership'
import type { CampaignUser } from '@/payload-types'
import { getCampaignDashboardPageData } from '@/utilities/campaignDashboardPageData'

const generalUser = {
  id: 1,
  collection: 'campaignUser',
  role: 'geral',
} as CampaignUser

const dashboardPayload = (leaderships: Array<{ nucleus: number; supportStatus?: unknown }>) =>
  ({
    find: vi.fn(async ({ collection }: { collection: string }) => {
      if (collection === 'electoralNucleus') {
        return { docs: [], totalDocs: 0 }
      }
      if (collection === 'leadership') {
        return { docs: leaderships, totalDocs: leaderships.length }
      }
      if (collection === 'nucleusUpdate') {
        return { docs: [], totalDocs: 0 }
      }
      if (collection === 'actionPlan') {
        return { docs: [], totalDocs: 0 }
      }
      throw new Error(`Unexpected collection: ${collection}`)
    }),
  }) as unknown as Payload

describe('campaign dashboard page-data support status projection', () => {
  it('omits a support status redacted by Payload field access and still renders', async () => {
    const view = await getCampaignDashboardPageData(
      dashboardPayload([{ nucleus: 31 }]),
      generalUser,
      new Date('2026-07-18T12:00:00-03:00'),
    )

    if (view.role !== 'geral') throw new Error('Painel geral esperado.')
    expect(Object.values(view.supportCounts)).toEqual([0, 0, 0, 0])

    const html = renderToStaticMarkup(createElement(CampaignDashboard, { view, now: new Date() }))
    expect(html).not.toContain('data-support-status="undefined"')
  })

  it('counts every valid shared support status', async () => {
    const view = await getCampaignDashboardPageData(
      dashboardPayload(
        leadershipSupportStatuses.map((supportStatus, index) => ({
          nucleus: index + 1,
          supportStatus,
        })),
      ),
      generalUser,
    )

    if (view.role !== 'geral') throw new Error('Painel geral esperado.')
    expect(view.supportCounts).toEqual({
      engajado: 1,
      a_abordar: 1,
      em_disputa: 1,
      negativo: 1,
    })
  })

  it('throws an internal invariant error for an invalid non-empty projected status', async () => {
    await expect(
      getCampaignDashboardPageData(
        dashboardPayload([{ nucleus: 31, supportStatus: 'valor-sensivel-invalido' }]),
        generalUser,
      ),
    ).rejects.toThrow('Dashboard leadership support status invariant violated.')

    await expect(
      getCampaignDashboardPageData(
        dashboardPayload([{ nucleus: 31, supportStatus: 'valor-sensivel-invalido' }]),
        generalUser,
      ),
    ).rejects.not.toThrow('valor-sensivel-invalido')
  })
})
