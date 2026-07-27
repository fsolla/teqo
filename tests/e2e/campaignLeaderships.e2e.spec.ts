import { expect, test } from './fixtures/campaignE2EFixtures.js'

/**
 * `/campanha/liderancas` journeys. First e2e spec for this route — starts
 * with the B32 support-status quick edit (Popover + auto-save, no toggle).
 */

test.describe('campaign leaderships list', () => {
  test('coordinator edits support status in the cell with auto-save (B32)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const password = fixtures.value('senha')
    const coordinator = await campaign.payload.create({
      collection: 'campaignUser',
      data: {
        name: fixtures.value('Coordenador Status'),
        email: `${fixtures.value('coordinator-status')}@example.com`,
        password,
        role: 'coordinator',
      },
      depth: 0,
    })

    const municipality = await fixtures.claimMunicipality()
    const contactName = fixtures.value('Liderança Status')
    const contact = await campaign.payload.create({
      collection: 'contact',
      data: {
        name: contactName,
        phone: fixtures.phone(),
        state: 'BA',
        city: municipality.name,
      },
      depth: 0,
    })
    await campaign.payload.create({
      collection: 'leadership',
      data: {
        contact: contact.id,
        municipalities: [municipality.id],
        supportStatus: 'a_abordar',
      },
      depth: 0,
    })

    await campaign.login(page, coordinator.email!, password)
    await page.goto(`${campaign.baseURL}/campanha/liderancas?q=${encodeURIComponent(contactName)}`)
    await expect(page.getByRole('heading', { name: 'Lideranças', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Editar status de apoio' }).click()
    const statusPopover = page.locator('[data-slot="popover-content"]')
    await expect(statusPopover).toBeVisible()
    await expect(statusPopover.getByRole('button', { name: 'Salvar' })).toHaveCount(0)

    // Auto-save (150 ms debounce): wait for the actual POST response — the
    // badge text updates optimistically before the request even lands, so a
    // text-only assertion here would race the reload below against a save
    // that hasn't reached the database yet.
    await Promise.all([
      page.waitForResponse(
        (response) =>
          response.url().includes('/campanha/liderancas/support-status') &&
          response.request().method() === 'POST' &&
          response.ok(),
      ),
      statusPopover.getByLabel('Status de apoio', { exact: true }).selectOption('engajado'),
    ])
    await expect(page.getByRole('button', { name: 'Editar status de apoio' })).toContainText(
      'Engajado',
    )

    await page.keyboard.press('Escape')
    await page.reload()
    await expect(page.getByRole('button', { name: 'Editar status de apoio' })).toContainText(
      'Engajado',
    )
  })
})
