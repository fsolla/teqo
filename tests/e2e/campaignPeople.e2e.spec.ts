import {
  campaignPageChrome,
  expect,
  expectPostResponse,
  test,
  waitForStreamSettled,
} from './fixtures/campaignE2EFixtures.js'

import type { CampaignUser } from '../../src/payload-types.js'

/**
 * C100 — the unified people list: staff lands on `/campanha/pessoas`, sees the
 * merged person row, and the route stays locked for leaders.
 */
test.describe('Pessoas — lista unificada', () => {
  /**
   * OPS87 — client slice of `campaignPeople` after the HTTP migration. The
   * server-side assertions (list render, C130 columns, party filter, name link,
   * leader redirects, detail sections, C117 URL contracts) moved to
   * tests/e2e/campaignPeopleHttp.e2e.spec.ts with the original test names, 1:1;
   * what remains here is the interaction only a browser can exercise: omnibox
   * typing, sortable-header clicks with `aria-sort`, mobile card ordering, and
   * the cell combobox/dialog writes (C125/C128/C131).
   *
   * HTTP twin: tests/e2e/campaignPeopleHttp.e2e.spec.ts.
   */
  test('the omnibox narrows the people recorte', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Pessoas'),
    })
    const municipality = await fixtures.claimMunicipality()
    const { contactName } = await fixtures.createStaffLeadership({
      namePrefix: 'Liderança Pessoas',
      municipalities: [municipality],
    })

    await campaign.login(page, coordinator.email!, coordinator.password)

    await page.goto('/campanha/pessoas')
    await expect(campaignPageChrome(page, 'Pessoas')).toBeVisible()

    // The omnibox search narrows the recorte (canonical URL, chips mounted).
    const omnibox = page.getByRole('combobox', { name: 'Filtrar pessoas' })
    await omnibox.fill(contactName.slice(0, 8))
    await omnibox.press('Enter')
    await expect(page).toHaveURL(/q=/)
    // The filter navigation re-streams the list — let it commit before the row.
    await page.waitForFunction(() => document.querySelectorAll('div[id^="S:"]').length === 0)
    await expect(page.getByRole('row', { name: new RegExp(contactName) })).toBeVisible()
  })

  test('staff sorts by a column header and filters absence via the omnibox (C117)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora C117'),
    })
    const first = await fixtures.claimMunicipality()
    const second = await fixtures.claimMunicipality()
    const oneCity = await fixtures.createStaffLeadership({
      namePrefix: 'C117 Ordenação Uma',
      municipalities: [first],
    })
    const twoCities = await fixtures.createStaffLeadership({
      namePrefix: 'C117 Ordenação Duas',
      municipalities: [first, second],
    })
    // A person without a phone — the "Sem contato" absence facet target.
    const noPhoneName = fixtures.value('C117 Sem Contato')
    const noPhoneContact = await fixtures.payload.create({
      collection: 'contact',
      data: { name: noPhoneName, state: 'BA', city: 'Salvador' },
      depth: 0,
    })
    await fixtures.payload.create({
      collection: 'leadership',
      data: { contact: noPhoneContact.id, municipalities: [second.id], supportStatus: 'a_abordar' },
      depth: 0,
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha/pessoas')

    // Narrow the recorte to this spec's rows, so the relative order is ours.
    const omnibox = page.getByRole('combobox', { name: 'Filtrar pessoas' })
    await omnibox.fill('C117')
    await omnibox.press('Enter')
    await expect(page).toHaveURL(/q=C117/)

    const tableRows = page.locator('tbody tr')
    const indexOfRow = async (name: string) => {
      const texts = await tableRows.allTextContents()
      return texts.findIndex((text) => text.includes(name))
    }
    const lideraHead = page.getByRole('columnheader').filter({ hasText: 'Lidera' })

    // First click: Lidera opens desc (most municipalities first).
    await lideraHead.getByRole('link').click()
    await expect(page).toHaveURL(/q=C117&sort=lidera$/)
    await expect(lideraHead).toHaveAttribute('aria-sort', 'descending')
    const descTwoCities = await indexOfRow(twoCities.contactName)
    const descOneCity = await indexOfRow(oneCity.contactName)
    expect(descTwoCities).toBeGreaterThanOrEqual(0)
    expect(descOneCity).toBeGreaterThanOrEqual(0)
    expect(descTwoCities).toBeLessThan(descOneCity)

    // Second click: same column inverts.
    await lideraHead.getByRole('link').click()
    await expect(page).toHaveURL(/q=C117&sort=lidera&dir=asc$/)
    await expect(lideraHead).toHaveAttribute('aria-sort', 'ascending')
    const ascOneCity = await indexOfRow(oneCity.contactName)
    const ascTwoCities = await indexOfRow(twoCities.contactName)
    expect(ascOneCity).toBeGreaterThanOrEqual(0)
    expect(ascTwoCities).toBeGreaterThanOrEqual(0)
    expect(ascOneCity).toBeLessThan(ascTwoCities)

    // Absence facet through the omnibox: only the no-phone person remains.
    await omnibox.fill('sem contato')
    await page.getByRole('option', { name: 'Sem contato', exact: true }).click()
    await expect(page).toHaveURL(/q=C117&ausencia=sem_contato&sort=lidera&dir=asc$/)
    await expect(page.getByText('Ausência: Sem contato')).toBeVisible()
    await expect(page.getByRole('row', { name: new RegExp(noPhoneName) })).toBeVisible()
    await expect(page.getByRole('row', { name: new RegExp(twoCities.contactName) })).toBeHidden()

    // C125 — the third absence click no longer collapses the facet: with the
    // umbrella value in the enum, "all three" is 3 of 4 members, so B18 keeps
    // the chips and the union ("any absence") stays applied.
    await omnibox.fill('sem base')
    await page.getByRole('option', { name: 'Sem base', exact: true }).click()
    await expect(page).toHaveURL(
      /q=C117&ausencia=sem_contato&ausencia=sem_base&sort=lidera&dir=asc$/,
    )
    await expect(page.getByText('Ausência: Sem base')).toBeVisible()

    await omnibox.fill('sem assessor')
    await page.getByRole('option', { name: 'Sem assessor', exact: true }).click()
    await expect(page).toHaveURL(
      /q=C117&ausencia=sem_contato&ausencia=sem_base&ausencia=sem_assessor&sort=lidera&dir=asc$/,
    )
    await expect(page.getByText('Ausência: Sem contato')).toBeVisible()
    await expect(page.getByText('Ausência: Sem base')).toBeVisible()
    await expect(page.getByText('Ausência: Sem assessor')).toBeVisible()
    // Multi-facet navigation re-streams the list — commit before asserting rows.
    await waitForStreamSettled(page)
    await expect(page.getByRole('row', { name: new RegExp(noPhoneName) })).toBeVisible()
    // The union widened: the staff leaderships have no advisors, so they match
    // `sem_assessor` — the row hidden by `sem_contato` alone is back in.
    await expect(page.getByRole('row', { name: new RegExp(twoCities.contactName) })).toBeVisible()
  })

  test('mobile discovers ordering in the omnibox and applies a sort (C125)', async ({
    campaign,
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Mobile C125'),
    })
    const first = await fixtures.claimMunicipality()
    const second = await fixtures.claimMunicipality()
    const oneCity = await fixtures.createStaffLeadership({
      namePrefix: 'C125 Mobile Uma',
      municipalities: [first],
    })
    const twoCities = await fixtures.createStaffLeadership({
      namePrefix: 'C125 Mobile Duas',
      municipalities: [first, second],
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha/pessoas')

    // Narrow the recorte to this spec's rows, so the card order is ours.
    const omnibox = page.getByRole('combobox', { name: 'Filtrar pessoas' })
    await omnibox.fill('C125 Mobile')
    await omnibox.press('Enter')
    await expect(page).toHaveURL(/q=C125/)

    // The Ordenação group is discoverable on focus with an empty query —
    // mobile cards have no sortable headers, the omnibox is the whole surface.
    await omnibox.click()
    await expect(page.getByRole('group', { name: 'Ordenação' })).toBeVisible()
    await page.getByRole('option', { name: 'Lidera (maior → menor)', exact: true }).click()
    await expect(page).toHaveURL(/q=C125.*&sort=lidera$/)
    await expect(page.getByText('Ordenação: Lidera (maior → menor)')).toBeVisible()

    // The mobile cards follow the sort: most municipalities first.
    const cards = page.locator('[data-view="mobile-cards"] li')
    const indexOfCard = async (name: string) => {
      const texts = await cards.allTextContents()
      return texts.findIndex((text) => text.includes(name))
    }
    await expect(cards.filter({ hasText: twoCities.contactName })).toBeVisible()
    await expect(cards.filter({ hasText: oneCity.contactName })).toBeVisible()
    const twoCitiesIndex = await indexOfCard(twoCities.contactName)
    const oneCityIndex = await indexOfCard(oneCity.contactName)
    expect(twoCitiesIndex).toBeGreaterThanOrEqual(0)
    expect(oneCityIndex).toBeGreaterThanOrEqual(0)
    expect(twoCitiesIndex).toBeLessThan(oneCityIndex)
  })

  test('the Lidera cell offers Salvador as one aggregate and saves all 19 zones (C131)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const linked = await fixtures.claimMunicipality()
    const { contactName, leadershipId } = await fixtures.createStaffLeadership({
      namePrefix: 'Salvador Agregado',
      municipalities: [linked],
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/pessoas?q=${encodeURIComponent(contactName)}`)
    await expect(campaignPageChrome(page, 'Pessoas')).toBeVisible()

    // C128 made every empty capacity cell editable, so a leadership-only row
    // now shows one combobox per capacity — scope to the Lidera cell (4th td;
    // the hidden-by-default E-mail column renders no td, B197).
    const row = page.getByRole('row', { name: new RegExp(contactName) })
    const lideraCell = row.locator('td').nth(3)
    const search = lideraCell.getByRole('combobox', {
      name: 'Buscar município, território de identidade ou zona eleitoral',
    })
    await search.fill('salvador')

    // The aggregate is its own option — label "Salvador", description
    // "Todas as zonas" — ahead of the 19 individual zone hits.
    const aggregate = page
      .getByRole('option')
      .filter({ has: page.getByText('Salvador', { exact: true }) })
    await expect(aggregate).toBeVisible()
    await expect(aggregate.getByText('Todas as zonas')).toBeVisible()

    const persisted = () => expectPostResponse(page, '/campanha/pessoas')
    await Promise.all([persisted(), aggregate.click()])

    // All 19 zones collapse into the existing "Salvador (19)" chip, removable
    // in one tap — one POST carried the whole batch.
    await expect(
      page.getByRole('button', { name: 'Remover Salvador — 19 municípios' }),
    ).toBeVisible()

    const zoneSlugs = Array.from({ length: 19 }, (_, index) => `salvador-ze-${index + 1}`)
    const zoneRows = await campaign.payload.find({
      collection: 'municipality',
      where: { slug: { in: zoneSlugs } },
      depth: 0,
      limit: 0,
      pagination: false,
    })
    expect(zoneRows.docs).toHaveLength(19)
    const zoneIds = zoneRows.docs.map((zone) => zone.id)

    const stored = await campaign.payload.findByID({
      collection: 'leadership',
      id: leadershipId,
      depth: 0,
    })
    // `claimMunicipality` may have handed out one of Salvador's own zones — the
    // aggregate still completes the city, so the set is the zones (19 or 20).
    const linkedIsZone = linked.slug.startsWith('salvador-ze-')
    expect(stored.municipalities).toHaveLength(linkedIsZone ? 19 : 20)
    for (const zoneId of zoneIds) expect(stored.municipalities).toContain(zoneId)
    expect(stored.municipalities).toContain(linked.id)
  })

  test('coordinator gives a person the first leadership municipality and ends it through the dialog (C128)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora C128'),
    })
    const municipality = await fixtures.claimMunicipality()

    // The person anchors on the list through a dobradinha — no leadership yet.
    const contactName = fixtures.value('Ciclo Liderança')
    const contact = await fixtures.payload.create({
      collection: 'contact',
      data: {
        name: contactName,
        phones: [{ value: fixtures.phone() }],
        state: 'BA',
        city: 'Salvador',
      },
      depth: 0,
    })
    const deputy = await fixtures.payload.create({
      collection: 'stateDeputy',
      data: { contact: contact.id, slug: fixtures.value('ciclo-lideranca') },
      depth: 0,
    })
    await fixtures.payload.update({
      collection: 'municipality',
      id: municipality.id,
      data: { stateDeputies: [deputy.id] },
      depth: 0,
      overrideAccess: true,
    })
    fixtures.touchMunicipality(municipality.id)

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha/pessoas')

    const omnibox = page.getByRole('combobox', { name: 'Filtrar pessoas' })
    await omnibox.fill(contactName)
    await omnibox.press('Enter')
    const row = page.getByRole('row', { name: new RegExp(contactName) })
    await expect(row).toBeVisible()

    // First municipality in "Lidera" → the leadership is born.
    // The hidden-by-default E-mail column renders no td (B197) — Lidera is the 4th cell.
    const lideraCell = row.locator('td').nth(3)
    await lideraCell
      .getByRole('combobox', {
        name: 'Buscar município, território de identidade ou zona eleitoral',
      })
      .fill(municipality.name)
    await page
      .getByRole('option', {
        name: new RegExp(`^${municipality.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`),
      })
      .click()
    // Scoped to the Lidera cell: the dobradinha anchor may share the município.
    await expect(lideraCell.getByText(municipality.name)).toBeVisible()

    let leadershipId: number | null = null
    await expect
      .poll(async () => {
        const leaderships = await fixtures.payload.find({
          collection: 'leadership',
          where: { contact: { equals: contact.id } },
          depth: 0,
          pagination: false,
        })
        leadershipId = leaderships.docs[0]?.id ?? null
        return leaderships.docs.length
      })
      .toBe(1)

    // A declared vote makes the exit destructive.
    await fixtures.payload.create({
      collection: 'votePledge',
      data: { leadership: leadershipId!, municipality: municipality.id, declaredVotes: 250 },
      depth: 0,
    })

    // Remove the last municipality → the destructive dialog lists the vote.
    await page.reload()
    await expect(row).toBeVisible()
    await lideraCell.getByRole('button', { name: `Remover ${municipality.name}` }).click()
    await expect(page.getByRole('heading', { name: 'Encerrar liderança' })).toBeVisible()
    await expect(page.getByText('250 votos declarados')).toBeVisible()
    await page.getByRole('button', { name: 'Encerrar liderança' }).click()

    // The leadership (with its pledge) is gone; the dobradinha keeps the row.
    await expect
      .poll(async () => {
        const remaining = await fixtures.payload.find({
          collection: 'leadership',
          where: { id: { equals: leadershipId! } },
          depth: 0,
          pagination: false,
        })
        return remaining.docs.length
      })
      .toBe(0)
    const pledges = await fixtures.payload.find({
      collection: 'votePledge',
      where: { leadership: { equals: leadershipId! } },
      depth: 0,
      pagination: false,
    })
    expect(pledges.docs).toHaveLength(0)
    await expect(row).toBeVisible()
  })

  test('the Assessora cell creates the staff account on the first municipality (C128)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Assessora C128'),
    })
    const municipality = await fixtures.claimMunicipality()

    // The person anchors on the list through a dobradinha — no staff account.
    const contactName = fixtures.value('Ciclo Assessora')
    const contact = await fixtures.payload.create({
      collection: 'contact',
      data: {
        name: contactName,
        phones: [{ value: fixtures.phone() }],
        state: 'BA',
        city: 'Salvador',
      },
      depth: 0,
    })
    const deputy = await fixtures.payload.create({
      collection: 'stateDeputy',
      data: { contact: contact.id, slug: fixtures.value('ciclo-assessora') },
      depth: 0,
    })
    await fixtures.payload.update({
      collection: 'municipality',
      id: municipality.id,
      data: { stateDeputies: [deputy.id] },
      depth: 0,
      overrideAccess: true,
    })
    fixtures.touchMunicipality(municipality.id)

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha/pessoas')

    const omnibox = page.getByRole('combobox', { name: 'Filtrar pessoas' })
    await omnibox.fill(contactName)
    await omnibox.press('Enter')
    const row = page.getByRole('row', { name: new RegExp(contactName) })
    await expect(row).toBeVisible()

    // First municipality in "Assessora" → the staff account is born (C116
    // regression: the cell commit used to fail on a missing `contactId`).
    // The hidden-by-default E-mail column renders no td (B197) — Assessora is the 3rd cell.
    const assessoraCell = row.locator('td').nth(2)
    await assessoraCell
      .getByRole('combobox', {
        name: 'Buscar município, território de identidade ou zona eleitoral',
      })
      .fill(municipality.name)
    await page
      .getByRole('option', {
        name: new RegExp(`^${municipality.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`),
      })
      .click()

    let createdAccount: CampaignUser | undefined
    await expect
      .poll(async () => {
        const accounts = await fixtures.payload.find({
          collection: 'campaignUser',
          where: { contact: { equals: contact.id } },
          depth: 0,
          pagination: false,
        })
        createdAccount = accounts.docs[0]
        return accounts.docs.length
      })
      .toBe(1)
    expect(createdAccount!.role).toBe('advisor')
    expect(createdAccount!.email ?? '').toMatch(/@criado\.invalid$/)
  })
})
