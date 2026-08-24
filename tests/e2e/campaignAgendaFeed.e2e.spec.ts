import { randomUUID } from 'node:crypto'

import { formatBahiaCivilDate, parseBahiaDateTimeInput } from '../../src/lib/campaignTime.js'
import { hookFilledCreateData } from '../../src/utilities/hookFilledData.js'
import { campaignPageChrome, expect, test } from './fixtures/campaignE2EFixtures.js'

/**
 * OPS83 Decision B — these flows now run under the production build too: the
 * e2e build inlines `NEXT_PUBLIC_SITE_URL=https://feed.e2e.teqo.test`
 * (`.test` TLD, passes `requireProductionDNSOrigin` fail-closed), so the
 * dialog can generate a canonical feed link. The tests assert the PATH and
 * fetch the feed via `campaign.baseURL + path` — never the canonical origin,
 * which is deliberately non-resolving.
 */
test.describe('Agenda — link de import (C98)', () => {
  test.setTimeout(90_000)

  test('gera o link sem filtros pelo header e o feed responde iCal', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.claimMunicipality()
    const title = fixtures.value('Comício do feed completo')
    const civilDate = formatBahiaCivilDate(new Date())
    const startAt = parseBahiaDateTimeInput(`${civilDate}T10:00`)
    if (!startAt) throw new Error('Falha ao montar horário da fixture de agenda.')

    await fixtures.payload.create({
      collection: 'activity',
      data: hookFilledCreateData<'activity'>({
        title,
        tags: ['Comício'],
        status: 'confirmado',
        startAt,
        municipality: municipality.id,
      }),
      depth: 0,
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/agenda`)

    await expect(campaignPageChrome(page, 'Agenda')).toBeVisible()
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 15_000 })

    // C93: com zero filtros o ícone do header está habilitado e abre o diálogo.
    await page.getByRole('button', { name: 'Link de import' }).click()
    const dialog = page.getByRole('dialog', { name: /Sincronizar com Google/ })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Sincronizar com Google Calendar')).toBeVisible()
    await expect(dialog.getByText(/Aplique filtros/)).toHaveCount(0)

    // C98 aceite: nomear → gerar → link retorna sem erro.
    await dialog.getByLabel('Nome do feed').fill('Agenda completa do escopo')
    await dialog.getByRole('button', { name: 'Gerar link' }).click()

    const linkInput = dialog.getByRole('textbox', { name: 'Link de import' })
    await expect(linkInput).toBeVisible({ timeout: 15_000 })
    const feedUrl = await linkInput.inputValue()
    // The link carries the canonical origin (OPS83 Decision B) — the PATH is
    // the contract, the origin is test-only and deliberately non-resolving.
    expect(feedUrl).toMatch(/\/campanha\/agenda\/ical\/[0-9a-f-]{36}$/)

    // O link responde com o feed iCal do recorte pedido (a atividade criada).
    // Fetch against the local server by path — never the absolute origin.
    const response = await page.request.get(`${campaign.baseURL}${new URL(feedUrl).pathname}`)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/calendar')
    const body = await response.text()
    expect(body).toContain('BEGIN:VCALENDAR')
    expect(body).toContain(title)
  })

  test('gera o link sem filtros pelo FAB mobile', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.claimMunicipality()
    const title = fixtures.value('Comício do feed mobile')
    const civilDate = formatBahiaCivilDate(new Date())
    const startAt = parseBahiaDateTimeInput(`${civilDate}T10:00`)
    if (!startAt) throw new Error('Falha ao montar horário da fixture de agenda.')

    await fixtures.payload.create({
      collection: 'activity',
      data: hookFilledCreateData<'activity'>({
        title,
        tags: ['Comício'],
        status: 'confirmado',
        startAt,
        municipality: municipality.id,
      }),
      depth: 0,
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${campaign.baseURL}/campanha/agenda`)

    const fab = page.getByRole('button', { name: 'Ações rápidas' })
    await expect(fab).toBeVisible()
    await fab.click()
    await page.getByRole('button', { name: 'Link de import' }).click()

    // C94: no mobile o mesmo diálogo abre como bottom sheet.
    const sheet = page.getByRole('dialog', { name: /Sincronizar com Google/ })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByText('Sincronizar com Google Calendar')).toBeVisible()

    await sheet.getByLabel('Nome do feed').fill('Feed mobile do escopo')
    await sheet.getByRole('button', { name: 'Gerar link' }).click()

    const linkInput = sheet.getByRole('textbox', { name: 'Link de import' })
    await expect(linkInput).toBeVisible({ timeout: 15_000 })
    expect(await linkInput.inputValue()).toMatch(/\/campanha\/agenda\/ical\/[0-9a-f-]{36}$/)
  })

  test('serves a live feed: a second GET shows activities created after the first (C113)', async ({
    campaign,
    request,
  }) => {
    // C113 acceptance: the SAME link must stay live — a commitment created
    // after the first fetch appears on the next GET. The feed is created via
    // fixture (no dialog), so this runs on the dev server AND on the
    // production build (E2E_PROD=1), where route-level caching would freeze
    // the first response.
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.claimMunicipality()
    const civilDate = formatBahiaCivilDate(new Date())
    const startAtA = parseBahiaDateTimeInput(`${civilDate}T10:00`)
    const startAtB = parseBahiaDateTimeInput(`${civilDate}T11:00`)
    if (!startAtA || !startAtB) throw new Error('Falha ao montar horário da fixture de agenda.')
    const icalDateTimeOf = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '')

    const titleA = fixtures.value('Comício do feed vivo')
    const titleB = fixtures.value('Caminhada do feed vivo')

    await fixtures.payload.create({
      collection: 'activity',
      data: hookFilledCreateData<'activity'>({
        title: titleA,
        tags: ['Comício'],
        status: 'confirmado',
        startAt: startAtA,
        municipality: municipality.id,
      }),
      depth: 0,
    })

    // The feed MUST stay scoped to this test's claimed municipality:
    // claims are exclusive per live run, so parallel workers' activities
    // never enter the body — DTSTART/ETag/304 assertions below are hermetic.
    const secretSlug = randomUUID()
    await fixtures.payload.create({
      collection: 'calendarFeed',
      data: {
        secretSlug,
        label: fixtures.value('Feed vivo'),
        filterMunicipality: municipality.id,
        createdBy: coordinator.id,
      },
      depth: 0,
      draft: false,
      user: coordinator,
      overrideAccess: false,
    })

    const feedUrl = `${campaign.baseURL}/campanha/agenda/ical/${secretSlug}`

    const first = await request.get(feedUrl)
    expect(first.status()).toBe(200)
    expect(first.headers()['cache-control']).toBe('public, no-cache')
    expect(first.headers()['etag']).toMatch(/^"[0-9a-f]{64}"$/)
    const firstBody = await first.text()
    expect(firstBody).toContain(titleA)
    expect(firstBody).not.toContain(titleB)
    expect(firstBody).toContain('X-PUBLISHED-TTL:PT1H')
    const firstEtag = first.headers()['etag']!

    const activityB = await fixtures.payload.create({
      collection: 'activity',
      data: hookFilledCreateData<'activity'>({
        title: titleB,
        tags: ['Caminhada'],
        status: 'confirmado',
        startAt: startAtB,
        municipality: municipality.id,
      }),
      depth: 0,
    })

    // The C113 acceptance: the same link is alive — the second GET sees the
    // commitment created after the first, with a changed validator.
    const second = await request.get(feedUrl)
    expect(second.status()).toBe(200)
    const secondBody = await second.text()
    expect(secondBody).toContain(titleA)
    expect(secondBody).toContain(titleB)
    expect(second.headers()['etag']).not.toBe(firstEtag)

    // Schedule edits reflect on the next GET (the title is immutable by
    // design — the canonical slug — so the proof is the DTSTART change).
    const editedStart = parseBahiaDateTimeInput(`${civilDate}T12:00`)
    if (!editedStart) throw new Error('Falha ao montar horário editado da fixture.')
    await fixtures.payload.update({
      collection: 'activity',
      id: activityB.id,
      data: { startAt: editedStart },
      depth: 0,
    })
    const edited = await request.get(feedUrl)
    expect(edited.status()).toBe(200)
    const editedBody = await edited.text()
    expect(editedBody).toContain(`DTSTART:${icalDateTimeOf(editedStart)}`)
    expect(editedBody).not.toContain(`DTSTART:${icalDateTimeOf(startAtB)}`)

    // A subscriber holding the FIRST validator gets a full fresh 200, never a
    // stale 304 — the freeze story of C113.
    const staleRevalidation = await request.get(feedUrl, {
      headers: { 'if-none-match': firstEtag },
    })
    expect(staleRevalidation.status()).toBe(200)
    expect(await staleRevalidation.text()).toContain(`DTSTART:${icalDateTimeOf(editedStart)}`)

    // Cancellation removes the event without leaving a ghost.
    await fixtures.payload.update({
      collection: 'activity',
      id: activityB.id,
      data: { status: 'cancelado' },
      depth: 0,
    })
    const cancelled = await request.get(feedUrl)
    expect(cancelled.status()).toBe(200)
    const cancelledBody = await cancelled.text()
    expect(cancelledBody).not.toContain(titleB)
    expect(cancelledBody).toContain(titleA)

    // A conditional GET with the current validator revalidates cheaply.
    const revalidated = await request.get(feedUrl, {
      headers: { 'if-none-match': cancelled.headers()['etag']! },
    })
    expect(revalidated.status()).toBe(304)
    expect(await revalidated.text()).toBe('')
  })
})
