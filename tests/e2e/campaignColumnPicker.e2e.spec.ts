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

    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Colunas'),
    })
    const password = coordinator.password
    const email = coordinator.email!

    await campaign.login(page, email, password)
    await page.goto('/campanha/municipios')

    const regionHeader = page.getByRole('columnheader', { name: /Território/ })
    await expect(regionHeader).toBeVisible()

    const picker = page.getByRole('button', { name: /Mostrar ou ocultar colunas/ })
    await picker.click()
    await page.getByRole('checkbox', { name: 'Território' }).click()
    // Closing flushes the batched cookie write and refreshes the RSC.
    await page.keyboard.press('Escape')

    await expect(regionHeader).toHaveCount(0, REFRESH)
    await expect(page.getByRole('button', { name: /1 oculta/ })).toBeVisible()

    await page.reload()
    await expect(page.getByRole('columnheader', { name: /Território/ })).toHaveCount(0, REFRESH)

    // The cookie carries one key per list: another list is untouched. The
    // territories list is the honest neighbour here — its 27 rows come from
    // the catalog, so it never falls into an empty state.
    await page.goto('/campanha/territorios')
    await expect(page.getByRole('columnheader', { name: /Municípios/ })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Mostrar ou ocultar colunas' })).toBeVisible()

    await page.goto('/campanha/municipios')
    await page.getByRole('button', { name: /Mostrar ou ocultar colunas/ }).click()
    await page.getByRole('button', { name: 'Restaurar todas' }).click()
    await page.keyboard.press('Escape')

    await expect(page.getByRole('columnheader', { name: /Território/ })).toBeVisible(REFRESH)
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
