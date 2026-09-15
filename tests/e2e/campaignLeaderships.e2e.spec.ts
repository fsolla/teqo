import {
  campaignPageChrome,
  expect,
  expectPostResponse,
  test,
  waitForStreamSettled,
} from './fixtures/campaignE2EFixtures.js'

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
    // The row streams with the list's RSC chunk; under 4-worker load the cell
    // control can land after the shell commits (B32 flaked on the click under
    // load: the button was still a hidden `S:` shell copy). Settle the stream,
    // then wait for the button with an explicit budget — the click alone used
    // to eat the whole 60 s test timeout.
    await waitForStreamSettled(page)
    const statusButton = page.getByRole('button', { name: 'Editar status de apoio' })
    await expect(statusButton).toBeVisible({ timeout: 30_000 })

    await statusButton.click()
    const statusPopover = page.locator('[data-slot="popover-content"]')
    await expect(statusPopover).toBeVisible()
    await expect(statusPopover.getByRole('button', { name: 'Salvar' })).toHaveCount(0)

    // Auto-save (150 ms debounce): wait for the actual POST response — the
    // badge text updates optimistically before the request even lands, so a
    // text-only assertion here would race the reload below against a save
    // that hasn't reached the database yet. `throwOnNonOk` so a refused write
    // reports the route's message instead of hanging the test.
    await Promise.all([
      expectPostResponse(page, '/campanha/liderancas/support-status', { throwOnNonOk: true }),
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
    // C131 — even a Salvador-zone query ("Salvador — ZE N") only surfaces the
    // exact zone hit: the aggregate matches word-start PREFIX queries of
    // "salvador", never a query longer than the label. No guard needed.
    const keyboardQuery = await fixtures.claimMunicipality()
    const { contactName, leadershipId } = await fixtures.createStaffLeadership({
      namePrefix: 'Liderança Municípios',
      municipalities: [linked],
    })

    await campaign.login(page, coordinator.email!, password)
    await page.goto(`${campaign.baseURL}/campanha/liderancas?q=${encodeURIComponent(contactName)}`)
    await expect(campaignPageChrome(page, 'Lideranças')).toBeVisible()
    await page.waitForLoadState('networkidle')
    // The cell chips stream with the list's RSC chunk; under 4-worker load the
    // chip link can land after `networkidle` settles (OPS83 run #16: B34
    // flaked on the initial chip). Let the stream commit before asserting.
    await waitForStreamSettled(page)

    // The chip cell clamps to three rows and hides the rest behind "Ver mais…"
    // — and because the allocator hands this run arbitrary municipality names,
    // whether two chips fit with the search box's reserved width is
    // CONTENT-dependent: with wide names the cell can collapse with every chip
    // out of the DOM (B34 failed that way under load). Expand exactly like the
    // user would before asserting on a chip.
    const expandCollapsedChips = async () => {
      const toggle = page.locator('[data-relation-toggle]')
      // The toggle mounts invisible while the clamp measures, so settle first.
      await expect
        .poll(async () => (await toggle.count()) === 0 || (await toggle.isVisible()))
        .toBe(true)
      // Only the collapsed label expands; once expanded the same control reads
      // "Ver menos" and must not be clicked again.
      const collapsedToggle = page.locator('[data-relation-toggle]', { hasText: 'Ver mais' })
      if (await collapsedToggle.isVisible()) await collapsedToggle.click()
    }

    // OPS83's own recipe: the generic settle gate alone can resolve before the
    // chunk starts streaming, so a focused poll proves the chip exists before
    // asserting on it (B34 flaked here at 4 workers).
    await expandCollapsedChips()
    const linkedChip = page.getByRole('link', { name: linked.name, exact: true })
    await expect.poll(() => linkedChip.count(), { timeout: 30_000 }).toBeGreaterThan(0)
    // The chip is still a link to the município — editing did not cost the
    // navigation the column had before.
    await expect(linkedChip).toHaveAttribute('href', `/campanha/municipios/${linked.slug}`)
    // Floor of one: the only chip cannot be removed.
    await expect(
      page.getByRole('button', { name: new RegExp(`não é possível remover ${linked.name}$`) }),
    ).toBeDisabled()

    // The chip cell posts JSON to its mutation route — the optimistic chip
    // renders before the write lands. `throwOnNonOk`: the 400 seen in the
    // verify runs must surface the route's message, not a blind 60 s wait.
    const persisted = () =>
      expectPostResponse(page, '/campanha/liderancas/municipalities', { throwOnNonOk: true })

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
    await expandCollapsedChips()
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
    await expandCollapsedChips()
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
    await waitForStreamSettled(page)
    await expandCollapsedChips()
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
