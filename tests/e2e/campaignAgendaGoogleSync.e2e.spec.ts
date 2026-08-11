import { campaignPageChrome, expect, test } from './fixtures/campaignE2EFixtures.js'

/**
 * C114 — Google Calendar mirror surface on the agenda. The e2e only pins the
 * deterministic "não configurado" state (no credential env in the test
 * runtime, no sync doc in the seeded DB): engine behavior (create/update/
 * delete/recover) is covered by the int tests with an in-memory calendar
 * stub — this spec must never depend on the real Google API.
 */
test.describe('Agenda — sincronização Google (C114)', () => {
  test('staff vê a pill "não configurado" e o diálogo explica o passo de operação', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/agenda`)

    await expect(campaignPageChrome(page, 'Agenda')).toBeVisible()

    const pill = page.getByRole('button', { name: 'Google: não configurado' })
    await expect(pill).toBeVisible({ timeout: 15_000 })
    await pill.click()

    const dialog = page.getByRole('dialog', { name: /Agenda da Campanha no Google/ })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Ainda não configurado')).toBeVisible()
    // O runbook de operação aparece (a ativação depende da conta Google da campanha).
    await expect(dialog.getByText(/service account do Teqo/)).toBeVisible()
  })
})
