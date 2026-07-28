import { expect, test } from './fixtures/campaignE2EFixtures.js'

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

  test('coordinator adds and removes municipality chips in the cell (B34)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const password = fixtures.value('senha')
    const coordinator = await campaign.payload.create({
      collection: 'campaignUser',
      data: {
        name: fixtures.value('Coordenador Carteira'),
        email: `${fixtures.value('coordinator-municipalities')}@example.com`,
        password,
        role: 'coordinator',
      },
      depth: 0,
    })

    const linked = await fixtures.claimMunicipality()
    const added = await fixtures.claimMunicipality()
    const keyboardQuery = await fixtures.claimMunicipality()
    const contactName = fixtures.value('Liderança Municípios')
    const contact = await campaign.payload.create({
      collection: 'contact',
      data: {
        name: contactName,
        phone: fixtures.phone(),
        state: 'BA',
        city: linked.name,
      },
      depth: 0,
    })
    const leadership = await campaign.payload.create({
      collection: 'leadership',
      data: { contact: contact.id, municipalities: [linked.id], supportStatus: 'a_abordar' },
      depth: 0,
    })

    await campaign.login(page, coordinator.email!, password)
    await page.goto(`${campaign.baseURL}/campanha/liderancas?q=${encodeURIComponent(contactName)}`)
    await expect(page.getByRole('heading', { name: 'Lideranças', exact: true })).toBeVisible()

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
    const persisted = () =>
      page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().includes('/campanha/liderancas') &&
          response.ok(),
      )

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
    await expect(page.getByRole('link', { name: keyboardAdded, exact: true })).toBeVisible()

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
      id: leadership.id,
      depth: 0,
    })
    expect(stored.municipalities).toHaveLength(2)
    expect(stored.municipalities).toContain(added.id)
    expect(stored.municipalities).not.toContain(linked.id)
  })
})
