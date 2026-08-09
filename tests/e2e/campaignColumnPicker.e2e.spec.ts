import { expect, test } from './fixtures/campaignE2EFixtures.js'

/**
 * B17 — the column picker is shared by every `CampaignTable` surface, so what
 * is pinned here is the contract, not one screen: hiding survives a reload
 * (cookie), one list's choice does not leak into another, and the mandatory
 * column cannot be unchecked.
 *
 * Own file on purpose: `campaignMunicipalities.e2e.spec.ts` carries two
 * deterministic failures at one worker, ledgered as P1.
 */
/**
 * Toggling costs a full RSC round-trip of a heavy list route. In dev, with the
 * suite's two workers competing for the same server, that overruns the 5 s
 * default of `expect` — so the assertions that wait on the refresh get their
 * own budget instead of a flake nobody can reproduce at one worker.
 */
const REFRESH = { timeout: 20_000 }

test.describe('Seletor de colunas', () => {
  test('hides a column, keeps it hidden across reloads and restores it', async ({
    campaign,
    page,
  }) => {
    // Crosses two heavy list routes; `/campanha/liderancas` only finishes
    // compiling in dev when an authenticated request reaches its tree.
    test.slow()
    // B158 switches to cards below 48rem of content width. Give this picker
    // regression enough content room to observe table headers directly.
    await page.setViewportSize({ width: 1800, height: 900 })

    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Colunas'),
    })
    const password = coordinator.password
    const email = coordinator.email!

    await campaign.login(page, email, password)
    await page.goto('/campanha/municipios')

    const votesHeader = page.getByRole('columnheader', { name: /2022/ })
    await expect(votesHeader).toBeVisible()

    const picker = page.getByRole('button', { name: /Mostrar ou ocultar colunas/ })
    await picker.click()
    // A fresh profile receives B158's two defaults. Restoring all records the
    // deliberate empty preference instead of reverting to those defaults.
    await page.getByRole('button', { name: 'Restaurar todas' }).click()
    await page.keyboard.press('Escape')
    await expect
      .poll(
        async () =>
          (await page.context().cookies()).find((cookie) => cookie.name === 'campaign_columns')
            ?.value,
      )
      .toContain('municipios:__none__')

    await picker.click()
    await page.getByRole('checkbox', { name: 'Votação 2022' }).click()
    // Closing flushes the batched cookie write and refreshes the RSC.
    await page.keyboard.press('Escape')

    await expect(votesHeader).toHaveCount(0, REFRESH)
    await expect(page.getByRole('button', { name: /1 oculta/ })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('columnheader', { name: /2022/ })).toHaveCount(0, REFRESH)

    // The cookie carries one key per list: another list is untouched. The
    // territories list is the honest neighbour here — its 27 rows come from
    // the catalog, so it never falls into an empty state. B175 removed the
    // "Municípios" column (the count moved into the name), so "2022" (P0,
    // always on) is the marker that the municipios cookie did not leak.
    await page.goto('/campanha/territorios')
    await expect(page.getByRole('columnheader', { name: /2022/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mostrar ou ocultar colunas' })).toBeVisible()

    await page.goto('/campanha/municipios')
    await page.getByRole('button', { name: /Mostrar ou ocultar colunas/ }).click()
    await page.getByRole('button', { name: 'Restaurar todas' }).click()
    await page.keyboard.press('Escape')

    await expect(page.getByRole('columnheader', { name: /2022/ })).toBeVisible(REFRESH)
    await page.reload()
    await expect(page.getByRole('columnheader', { name: /2022/ })).toBeVisible(REFRESH)
    await expect
      .poll(
        async () =>
          (await page.context().cookies()).find((cookie) => cookie.name === 'campaign_columns')
            ?.value,
      )
      .toContain('municipios:__none__')
  })

  test('lists the mandatory column without letting it be unchecked', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Obrigatória'),
    })
    const password = coordinator.password
    const email = coordinator.email!

    await campaign.login(page, email, password)
    await page.goto('/campanha/municipios')

    await page.getByRole('button', { name: /Mostrar ou ocultar colunas/ }).click()
    // The name carries the reason too ("Município sempre visível").
    const mandatory = page.getByRole('checkbox', { name: /^Município/ })
    await expect(mandatory).toBeChecked()
    await expect(mandatory).toBeDisabled()
  })
})
