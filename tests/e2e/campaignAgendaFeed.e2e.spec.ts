import { formatBahiaCivilDate, parseBahiaDateTimeInput } from '../../src/lib/campaignTime.js'
import { hookFilledCreateData } from '../../src/utilities/hookFilledData.js'
import { campaignPageChrome, expect, test } from './fixtures/campaignE2EFixtures.js'

/**
 * The full generate → fetch flow needs the app served from a local origin:
 * `getCampaignInviteBaseURL` rejects non-public DNS in NODE_ENV=production
 * (fail-closed — the feed URL must be canonical), and CI/`pnpm push` boot the
 * production build (`E2E_PROD=1`) with `NEXT_PUBLIC_SITE_URL=http://localhost:3000`.
 * The CI covers the unlocked dialog via the C93 component unit and the
 * filterless feed content via the C93 int tests; the e2e here pins the real
 * end-to-end flow on the dev server.
 */
const isProdMode =
  ['1', 'true'].includes(process.env.E2E_PROD ?? '') || ['1', 'true'].includes(process.env.CI ?? '')

test.describe('Agenda — link de import (C98)', () => {
  test.setTimeout(90_000)

  test('gera o link sem filtros pelo header e o feed responde iCal', async ({ campaign, page }) => {
    test.skip(isProdMode, 'fluxo completo exige origem local (dev server)')
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
    expect(feedUrl).toMatch(/\/campanha\/agenda\/ical\/[0-9a-f-]{36}$/)

    // O link responde com o feed iCal do recorte pedido (a atividade criada).
    const response = await page.request.get(feedUrl)
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('text/calendar')
    const body = await response.text()
    expect(body).toContain('BEGIN:VCALENDAR')
    expect(body).toContain(title)
  })

  test('gera o link sem filtros pelo FAB mobile', async ({ campaign, page }) => {
    test.skip(isProdMode, 'fluxo completo exige origem local (dev server)')
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
})
