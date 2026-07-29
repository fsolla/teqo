// @vitest-environment node

import type { Payload } from 'payload'
import { getPayload } from 'payload'
import { beforeAll, describe, expect, it, vi } from 'vitest'

// `loadMunicipalityElectoralBaseline` is wrapped in Next's `unstable_cache`,
// which needs the Next server runtime (incrementalCache) — unavailable under
// vitest. The dossier only forwards its result, so stub the module here.
vi.mock('@/utilities/municipality/municipalityElectoralBaseline', () => ({
  loadMunicipalityElectoralBaseline: vi.fn().mockResolvedValue(null),
}))

import { createActivityRecord } from '@/app/(campaign)/campanha/actions/activity'
import { updateMunicipalityStrategyRecord } from '@/app/(campaign)/campanha/actions/municipality'
import config from '@/payload.config'
import {
  DOSSIER_LEADERSHIP_LIMIT,
  DOSSIER_SIGNAL_LIMIT,
  loadMunicipalityDossierData,
} from '@/utilities/municipality/municipalityDossierData'
import {
  getMunicipalityDetailViewModel,
  resolveAccessibleMunicipalityContext,
} from '@/utilities/municipality/municipalityPageData'

import { installCampaignFixtures } from '../helpers/campaignFixtures'

let payload: Payload
const campaignFixtures = installCampaignFixtures({
  getPayload: () => payload,
  setPayload: (nextPayload) => {
    payload = nextPayload
  },
})

describe('municipality dossier data (E16)', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  })

  // The fixture builds ~20 rows sequentially (leaderships, updates, activities),
  // so this test legitimately outlives the 5s default under parallel load.
  it(
    'composes the pre-visit dossier with section caps and full totals',
    { timeout: 30_000 },
    async () => {
      const fixtures = campaignFixtures()
      const coordinator = await fixtures.createCampaignUser('coordinator')
      const municipality = await fixtures.getMunicipality()

      for (let index = 0; index < DOSSIER_LEADERSHIP_LIMIT + 1; index += 1) {
        const contact = await fixtures.createContact()
        await fixtures.createLeadership({
          contact: contact.id,
          municipalities: [municipality.id],
        })
      }

      for (let index = 0; index < DOSSIER_SIGNAL_LIMIT + 1; index += 1) {
        await fixtures.createMunicipalityUpdate({
          municipality: municipality.id,
          author: coordinator.id,
        })
      }

      const upcomingActivity = await createActivityRecord(payload, coordinator, {
        title: fixtures.value('Caminhada dossiê'),
        kind: 'caminhada',
        status: 'planejado',
        startAt: new Date(Date.now() + 86_400_000).toISOString(),
        municipality: municipality.id,
        locality: 'Centro',
      })
      fixtures.own('activity', upcomingActivity.id)

      await updateMunicipalityStrategyRecord(payload, coordinator, {
        municipality: municipality.id,
        priority: 'alta',
        budgetNotes: 'Emenda de bancada 2024 destinada ao hospital municipal.',
      })
      fixtures.touchMunicipality(municipality.id)

      const context = await resolveAccessibleMunicipalityContext(
        payload,
        coordinator,
        municipality.slug,
      )
      const view = await getMunicipalityDetailViewModel(payload, context, coordinator)
      const dossier = await loadMunicipalityDossierData(payload, coordinator, view)

      expect(dossier.leaderships.rows).toHaveLength(DOSSIER_LEADERSHIP_LIMIT)
      expect(dossier.leaderships.totalCount).toBe(DOSSIER_LEADERSHIP_LIMIT + 1)
      expect(dossier.leaderships.rows.every((row) => row.updatedAt)).toBe(true)

      expect(dossier.signals.rows).toHaveLength(DOSSIER_SIGNAL_LIMIT)
      expect(dossier.signals.totalCount).toBe(DOSSIER_SIGNAL_LIMIT + 1)

      expect(dossier.upcomingActivities.map((activity) => activity.id)).toContain(
        upcomingActivity.id,
      )
      expect(dossier.recentActivities).toEqual([])

      // Staff view model exists, so the E8 goal account block is present.
      expect(dossier.goalAccount).not.toBeNull()
      expect(dossier.demographics?.population).toBeGreaterThan(0)

      expect(view.strategy?.budgetNotes).toBe(
        'Emenda de bancada 2024 destinada ao hospital municipal.',
      )
    },
  )
})
