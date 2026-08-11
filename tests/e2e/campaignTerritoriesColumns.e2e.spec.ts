import { expect, test } from './fixtures/campaignE2EFixtures.js'

/**
 * OPS35+ — restores the browser pin the HTTP migration dropped. OPS35 migrated
 * `campaignTerritories` to the browserless HTTP mode (`campaignTerritoriesHttp`)
 * because its assertions were server-rendered content; its one browser-only
 * concern — CSS rung visibility at a viewport — was documented as lost at the
 * time. That loss is a real hole: the network columns hide behind container
 * queries (`@min-[Nrem]/territory-list:table-cell`, TerritoryListColumns.tsx),
 * and the HTTP spec only pins presence + rung classes in the HTML, never the
 * visual effect. This spec is that pin back: at a wide viewport the read-only
 * network columns and every rung-gated sortable are actually visible, and
 * Cobertura is not rendered at this width. It carries the exact body of the
 * deleted spec's test 3 (accepted product behavior since B175) — nothing else,
 * no CSS, no HTTP duplication.
 */

test.describe('Territórios de Identidade — colunas de rede (browser)', () => {
  test('a wide panel surfaces the read-only network columns; Cobertura stays hidden by default', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Rede Larga'),
    })
    const password = coordinator.password
    const email = coordinator.email!

    await page.setViewportSize({ width: 2200, height: 1000 })
    await campaign.login(page, email, password)
    await page.goto('/campanha/territorios')

    // B175 — the responsive rungs are all visible at a wide panel (P0 + Captura
    // + network + Classe + Assessoria). Cobertura is P3 AND hidden in the picker.
    // Sortable headers are announced "Ordenar por <label> (…)" — match by prefix;
    // the read-only network headers are plain, so match them exactly (never by
    // substring, since "Assessor" is a prefix of "Assessoria").
    for (const header of ['2022', 'Captura', '2026', 'Classe', 'Assessoria']) {
      await expect(
        page.getByRole('columnheader', { name: new RegExp(`^Ordenar por ${header}`) }),
        `header ${header}`,
      ).toBeVisible()
    }
    for (const header of ['Assessor', 'Liderança', 'Dobradinha']) {
      await expect(
        page.getByRole('columnheader', { name: header, exact: true }),
        `header ${header}`,
      ).toBeVisible()
    }
    await expect(page.getByRole('columnheader', { name: 'Cobertura' })).toHaveCount(0)
  })
})
