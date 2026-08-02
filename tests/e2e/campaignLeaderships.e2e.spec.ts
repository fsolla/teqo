import { campaignPageChrome, expect, expectPostResponse, test } from './fixtures/campaignE2EFixtures.js'

/**
 * `/campanha/liderancas` journeys: the B32 support-status quick edit (Popover +
 * auto-save, no toggle) and the B34 municipality chips (inline on a fine
 * pointer — no "Salvar", the "×" only on hover).
 */

test.describe('campaign leaderships list', () => {
  test('coordinator edits support status in the cell with auto-save (B32)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenador Status'),
    })
    const password = coordinator.password

    const municipality = await fixtures.claimMunicipality()
    const { contactName } = await fixtures.createStaffLeadership({
      namePrefix: 'Liderança Status',
      municipalities: [municipality],
    })

    await campaign.login(page, coordinator.email!, password)
    await page.goto(`${campaign.baseURL}/campanha/liderancas?q=${encodeURIComponent(contactName)}`)
    await expect(campaignPageChrome(page, 'Lideranças')).toBeVisible()

    await page.getByRole('button', { name: 'Editar status de apoio' }).click()
    const statusPopover = page.locator('[data-slot="popover-content"]')
    await expect(statusPopover).toBeVisible()
    await expect(statusPopover.getByRole('button', { name: 'Salvar' })).toHaveCount(0)

    // Auto-save (150 ms debounce): wait for the actual POST response — the
    // badge text updates optimistically before the request even lands, so a
    // text-only assertion here would race the reload below against a save
    // that hasn't reached the database yet.
    await Promise.all([
      expectPostResponse(page, '/campanha/liderancas/support-status'),
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

  test('coordinator adds and removes municipality chips in the cell (B34)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenador Carteira'),
    })
    const password = coordinator.password

    const linked = await fixtures.claimMunicipality()
    const added = await fixtures.claimMunicipality()
    const keyboardQuery = await fixtures.claimMunicipality()
    const { contactName, leadershipId } = await fixtures.createStaffLeadership({
      namePrefix: 'Liderança Municípios',
      municipalities: [linked],
    })

    await campaign.login(page, coordinator.email!, password)
    await page.goto(`${campaign.baseURL}/campanha/liderancas?q=${encodeURIComponent(contactName)}`)
    await expect(campaignPageChrome(page, 'Lideranças')).toBeVisible()

    // The chip is still a link to the município — editing did not cost the
    // navigation the column had before.
    await expect(page.getByRole('link', { name: linked.name, exact: true })).toHaveAttribute(
      'href',
      `/campanha/municipios/${linked.slug}`,
    )
    // Floor of one: the only chip cannot be removed.
    await expect(
      page.getByRole('button', { name: new RegExp(`não é possível remover ${linked.name}$`) }),
    ).toBeDisabled()

    // Server actions POST to the page URL, so the response filter is the route
    // itself — the optimistic chip renders before the write lands.
    const persisted = () => expectPostResponse(page, '/campanha/liderancas')

    const search = page.getByRole('combobox', {
      name: 'Buscar município, território de identidade ou zona eleitoral',
    })
    await search.fill(added.name)
    const suggestion = page
      .getByRole('option')
      .filter({ has: page.getByText(added.name, { exact: true }) })
      .first()
    await expect(suggestion).toBeVisible()
    await Promise.all([persisted(), suggestion.click()])
    await expect(page.getByRole('link', { name: added.name, exact: true })).toBeVisible()

    // No "Salvar" anywhere in the cell: the write already happened.
    await expect(page.getByRole('button', { name: 'Salvar' })).toHaveCount(0)

    // Keyboard path (ARIA combobox): the first hit is pre-selected, so typing
    // and pressing Enter adds without ever touching the mouse.
    await search.fill(keyboardQuery.name)
    const firstOption = page.getByRole('option').first()
    await expect(firstOption).toHaveAttribute('aria-selected', 'true')
    await expect(search).toHaveAttribute('aria-expanded', 'true')
    const activeId = await search.getAttribute('aria-activedescendant')
    expect(activeId).toBe(await firstOption.getAttribute('id'))
    // Whatever the catalog ranks first — the query may prefix-match siblings.
    const keyboardAdded = (await firstOption.innerText()).split('\n')[0]!.trim()
    await Promise.all([persisted(), search.press('Enter')])
    // 30 s: the POST landed (persisted above), so this is purely the optimistic
    // chip render + RSC refresh — under 2-worker load with a cold dev compile
    // that round-trip has measured past the 10 s expect budget (P3-C).
    await expect(page.getByRole('link', { name: keyboardAdded, exact: true })).toBeVisible({
      timeout: 30_000,
    })

    await Promise.all([
      persisted(),
      page.getByRole('button', { name: `Remover ${linked.name}`, exact: true }).click(),
    ])
    await expect(page.getByRole('link', { name: linked.name, exact: true })).toHaveCount(0)

    await page.reload()
    await expect(page.getByRole('link', { name: added.name, exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: keyboardAdded, exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: linked.name, exact: true })).toHaveCount(0)

    const stored = await campaign.payload.findByID({
      collection: 'leadership',
      id: leadershipId,
      depth: 0,
    })
    expect(stored.municipalities).toHaveLength(2)
    expect(stored.municipalities).toContain(added.id)
    expect(stored.municipalities).not.toContain(linked.id)
  })
})
