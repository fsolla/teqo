import type { Locator, Page } from '@playwright/test'
import { loadMunicipalityGeometryModule } from '../../src/lib/bahiaGeometries.js'
import type { BahiaMunicipalityFeature } from '../../src/lib/bahiaGeometriesTypes.js'
import { getMunicipalityCatalogEntry } from '../../src/lib/municipalityCatalog.js'
import {
  featureCentroid,
  featureContainsPoint,
  haversineKm,
  type GeoPoint,
} from '../../src/lib/municipalityProximity.js'

import { expect, test } from './fixtures/campaignE2EFixtures.js'

/**
 * B14 — the geo shortcut on the staff dashboard. What these tests protect is the
 * contract the field depends on: a granted permission resolves the município the
 * user is standing in, Salvador degrades to its zone list instead of guessing a
 * ZE, a position outside the portfolio says so, and a refused permission leaves
 * a card the user can act on instead of a spinner.
 */

const SALVADOR_CENTRE: GeoPoint = { lat: -12.973, lng: -38.5121 }

/**
 * The card mirrors its headline in an sr-only live region (so the outcome is
 * announced), which means every headline matches twice. `.last()` is the visible
 * copy — DOM order puts the live region first.
 */
const visibleText = (scope: Locator, text: string) => scope.getByText(text).last()

/** Assertions belong to the card, not to "somewhere on the dashboard". */
const geoCard = (page: Page) => page.locator('[data-slot="card"]').filter({ hasText: 'Onde estou' })

/**
 * Coarse grid scan for a point that is really inside the polygon — a centroid can
 * fall outside a concave município, and the fixture hands out an arbitrary one.
 */
const interiorPointOf = (feature: BahiaMunicipalityFeature): GeoPoint => {
  const rings =
    feature.geometry.type === 'Polygon'
      ? [feature.geometry.coordinates]
      : feature.geometry.coordinates
  const positions = rings.flat(2)
  const longitudes = positions.map(([lng]) => lng)
  const latitudes = positions.map(([, lat]) => lat)
  const west = Math.min(...longitudes)
  const east = Math.max(...longitudes)
  const south = Math.min(...latitudes)
  const north = Math.max(...latitudes)
  const steps = 24

  for (let row = 1; row < steps; row += 1) {
    for (let column = 1; column < steps; column += 1) {
      const point = {
        lng: west + ((east - west) * column) / steps,
        lat: south + ((north - south) * row) / steps,
      }
      if (featureContainsPoint(feature, point)) return point
    }
  }

  throw new Error(`No interior point found for ${feature.properties.name}`)
}

/**
 * Farthest and nearest other município from a given one, by centroid. The fixture
 * hands out an arbitrary município, so the two fallback positions have to be
 * derived from it — a fixed city would be inside the 150 km suggestion radius on
 * some runs and outside it on others.
 */
const otherMunicipalitiesByDistance = (
  features: readonly BahiaMunicipalityFeature[],
  origin: BahiaMunicipalityFeature,
): { nearest: BahiaMunicipalityFeature; farthest: BahiaMunicipalityFeature } => {
  const from = featureCentroid(origin)
  const ranked = features
    .filter((feature) => feature.properties.codarea !== origin.properties.codarea)
    .map((feature) => ({ feature, distanceKm: haversineKm(from, featureCentroid(feature)) }))
    .sort((left, right) => left.distanceKm - right.distanceKm)

  return { nearest: ranked[0]!.feature, farthest: ranked[ranked.length - 1]!.feature }
}

/** Whole-municipality unit (not a Salvador zone), so containment maps to one slug. */
const claimWholeMunicipality = async (
  claim: () => Promise<{ id: number; name: string; slug: string }>,
) => {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const municipality = await claim()
    if (getMunicipalityCatalogEntry(municipality.slug)?.kind === 'municipio') return municipality
  }
  throw new Error('Could not claim a whole-municipality unit for the geo shortcut test.')
}

/*
 * Serial with a wider timeout: all three tests land on the staff dashboard (map +
 * 435 municípios), and simultaneous cold hits on the dev server time out the
 * login navigation before anything about this card is exercised. The advisor test
 * renders that dashboard four times, which does not fit the default 30s in dev.
 */
test.describe.configure({ mode: 'serial', timeout: 150_000 })

test.describe('Município mais próximo', () => {
  test('advisor in his own município opens it, and is told when he is outside the portfolio', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const password = fixtures.value('senha')
    const email = `${fixtures.value('geo-advisor')}@example.com`
    const advisor = await campaign.payload.create({
      collection: 'campaignUser',
      data: {
        name: fixtures.value('Assessor Geo'),
        email,
        password,
        role: 'advisor',
      },
      depth: 0,
    })
    const municipality = await claimWholeMunicipality(() => fixtures.claimMunicipality())
    await campaign.payload.update({
      collection: 'municipality',
      id: municipality.id,
      data: { advisors: [advisor.id] },
      depth: 0,
    })
    fixtures.touchMunicipality(municipality.id)

    const { features, getMunicipalityFeature } = await loadMunicipalityGeometryModule()
    const portfolio = getMunicipalityFeature(
      getMunicipalityCatalogEntry(municipality.slug)!.ibgeCode,
    )!
    const { nearest, farthest } = otherMunicipalitiesByDistance(features, portfolio)
    const inside = interiorPointOf(portfolio)

    await page.context().grantPermissions(['geolocation'])
    await page.context().setGeolocation({ latitude: inside.lat, longitude: inside.lng })

    await campaign.login(page, email, password)

    const card = geoCard(page)
    await expect(visibleText(card, `Você está em ${municipality.name}`)).toBeVisible()
    await expect(card.getByRole('link', { name: `Abrir ${municipality.name}` })).toBeVisible()
    // A device-grade fix carries no caveat.
    await expect(card.getByText('Localização aproximada')).toHaveCount(0)

    // Next door but off his portfolio: named where he is, offered what he can open.
    const nextDoor = interiorPointOf(nearest)
    await page.context().setGeolocation({ latitude: nextDoor.lat, longitude: nextDoor.lng })
    await page.reload()
    await expect(visibleText(card, 'fora da sua carteira')).toBeVisible()
    await expect(card.getByText(`Mais próximo na sua carteira: ${municipality.name}`)).toBeVisible()
    await expect(card.getByRole('link', { name: `Abrir ${municipality.name}` })).toBeVisible()

    // Across the state: suggesting the portfolio would be noise, not a shortcut.
    const farAway = interiorPointOf(farthest)
    await page.context().setGeolocation({ latitude: farAway.lat, longitude: farAway.lng })
    await page.reload()
    await expect(visibleText(card, 'fora da sua carteira')).toBeVisible()
    await expect(card.getByText('Nenhum município da sua carteira por perto.')).toBeVisible()
    await expect(card.getByRole('link', { name: /^Abrir/ })).toHaveCount(0)
  })

  test('coordinator in Salvador is sent to the zone list, never to a guessed ZE', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const password = fixtures.value('senha')
    const email = `${fixtures.value('geo-coordinator')}@example.com`
    await campaign.payload.create({
      collection: 'campaignUser',
      data: {
        name: fixtures.value('Coordenadora Geo'),
        email,
        password,
        role: 'coordinator',
      },
      depth: 0,
    })

    await page.context().grantPermissions(['geolocation'])
    // A desk fix comes from the network, not the GPS: wide enough to be wrong about
    // the município, so the card must hedge.
    await page.context().setGeolocation({
      latitude: SALVADOR_CENTRE.lat,
      longitude: SALVADOR_CENTRE.lng,
      accuracy: 25_000,
    })

    await campaign.login(page, email, password)

    const card = geoCard(page)
    await expect(visibleText(card, 'dividida por zona eleitoral')).toBeVisible()
    await expect(card.getByText('Localização aproximada')).toBeVisible()
    await card.getByRole('link', { name: 'Ver zonas de Salvador' }).click()

    await expect(page).toHaveURL(/\/campanha\/municipios\?.*q=Salvador/)
    // Exact: "Salvador — ZE 1" is otherwise a prefix of ZE 12 and ZE 17.
    await expect(page.getByRole('link', { name: 'Salvador — ZE 1', exact: true })).toBeVisible()
  })

  test('a refused permission leaves an actionable card instead of a spinner', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const password = fixtures.value('senha')
    const email = `${fixtures.value('geo-blocked')}@example.com`
    await campaign.payload.create({
      collection: 'campaignUser',
      data: {
        name: fixtures.value('Coordenadora Bloqueada'),
        email,
        password,
        role: 'coordinator',
      },
      depth: 0,
    })

    // No grantPermissions: Chromium refuses the position, the same as a user tapping "Block".
    await campaign.login(page, email, password)

    const card = geoCard(page)
    await expect(visibleText(card, 'Localização bloqueada neste navegador')).toBeVisible()
    await expect(card.getByRole('button', { name: 'Tentar de novo' })).toBeEnabled()
    await expect(card.getByText('Localizando…')).toHaveCount(0)
  })
})
