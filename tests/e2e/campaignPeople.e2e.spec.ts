import { campaignPageChrome, expect, test } from './fixtures/campaignE2EFixtures.js'

/**
 * C100 — the unified people list: staff lands on `/campanha/pessoas`, sees the
 * merged person row, and the route stays locked for leaders.
 */
test.describe('Pessoas — lista unificada', () => {
  test('staff opens the people list and sees the merged leadership person', async ({
    campaign,
    page,
  }) => {
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

    await page.getByRole('link', { name: 'Pessoas', exact: true }).click()
    await expect(page).toHaveURL(/\/campanha\/pessoas$/)
    await expect(campaignPageChrome(page, 'Pessoas')).toBeVisible()

    // The merged row carries the leadership person with its capacity chips
    // (desktop table — the mobile card twin is `md:hidden` at this viewport).
    await expect(page.getByRole('row', { name: new RegExp(contactName) })).toBeVisible()
    // The coordinator account itself is a staff person (with a ficha) — ≥ 2 rows.
    await expect(page.getByText(/^\d+ pessoas?$/)).toBeVisible()

    // The omnibox search narrows the recorte (canonical URL, chips mounted).
    const omnibox = page.getByRole('combobox', { name: 'Filtrar pessoas' })
    await omnibox.fill(contactName.slice(0, 8))
    await omnibox.press('Enter')
    await expect(page).toHaveURL(/q=/)
    await expect(page.getByRole('row', { name: new RegExp(contactName) })).toBeVisible()
  })

  test('the name link in the list opens the person detail (C118 entry point)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.claimMunicipality()
    const { contactId, contactName } = await fixtures.createStaffLeadership({
      namePrefix: 'Nome Link Detalhe',
      municipalities: [municipality],
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha/pessoas')

    await page.getByRole('link', { name: contactName, exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/campanha/pessoas/${contactId}$`))
    await expect(campaignPageChrome(page, 'Pessoa')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Liderança' })).toBeVisible()
  })

  test('leader cannot open the people page', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const phone = fixtures.phone()
    const leader = await fixtures.createCampaignUser('leader', {
      name: fixtures.value('Liderança Sem Acesso'),
      username: phone,
    })

    await campaign.login(page, phone, leader.password)
    await page.goto('/campanha/pessoas')

    await expect(page).toHaveURL(/\/campanha\/contatos/)
    await expect(page.getByRole('heading', { name: 'Contatos' })).toBeVisible()
  })

  test('leader cannot open the person detail route', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const phone = fixtures.phone()
    const leader = await fixtures.createCampaignUser('leader', {
      name: fixtures.value('Liderança Detalhe Sem Acesso'),
      username: phone,
    })

    await campaign.login(page, phone, leader.password)
    await page.goto('/campanha/pessoas/99999')

    await expect(page).toHaveURL(/\/campanha\/contatos/)
    await expect(page.getByRole('heading', { name: 'Contatos' })).toBeVisible()
  })

  test('coordinator opens the person detail and sees the sections of her capacities', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.claimMunicipality()

    const { contactId, contactName, leadershipId } = await fixtures.createStaffLeadership({
      namePrefix: 'Liderança Detalhe',
      municipalities: [municipality],
      supportStatus: 'engajado',
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`/campanha/pessoas/${contactId}`)

    await expect(page).toHaveURL(new RegExp(`/campanha/pessoas/${contactId}$`))
    await expect(campaignPageChrome(page, 'Pessoa')).toBeVisible()
    await expect(
      page
        .locator('[data-slot="campaign-page-chrome"]')
        .filter({ visible: true })
        .getByText(contactName),
    ).toBeVisible()

    // Sections mounted by capacity: a leadership-only person shows Ficha +
    // Liderança, never an empty Dobradinha block.
    await expect(page.getByRole('heading', { name: 'Ficha' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Liderança' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Dobradinha' })).not.toBeVisible()
    await expect(page.getByRole('heading', { name: 'Assessorado' })).not.toBeVisible()

    // The leadership section links to the rich existing detail (v1 coexistence).
    await expect(page.getByRole('link', { name: 'Abrir detalhe de liderança' })).toHaveAttribute(
      'href',
      `/campanha/liderancas/${leadershipId}`,
    )
    await expect(
      page.getByRole('region', { name: 'Liderança' }).getByText('Engajado'),
    ).toBeVisible()

    // Actions: WhatsApp (phone exists) + delete (coordinator); invite for leaders.
    await expect(page.getByRole('link', { name: 'Enviar WhatsApp' })).toBeVisible()
    await expect(page.getByRole('button', { name: /Convidar/ })).toBeVisible()
    await expect(page.getByRole('button', { name: `Apagar pessoa ${contactName}` })).toBeVisible()
  })

  test('coordinator sees dobradinha and apoiador sections only for a person who has them', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const deputyMunicipality = await fixtures.claimMunicipality()
    const supporterMunicipality = await fixtures.claimMunicipality()

    const contact = await fixtures.payload.create({
      collection: 'contact',
      data: {
        name: fixtures.value('Dobradinha Detalhe'),
        phones: [{ value: fixtures.phone() }],
        state: 'BA',
        city: 'Salvador',
      },
      depth: 0,
    })
    const deputy = await fixtures.payload.create({
      collection: 'stateDeputy',
      data: { contact: contact.id, party: 'PCdoB', slug: fixtures.value('dobradinha-detalhe') },
      depth: 0,
    })
    await fixtures.payload.update({
      collection: 'municipality',
      id: deputyMunicipality.id,
      data: { stateDeputies: [deputy.id] },
      depth: 0,
      overrideAccess: true,
    })
    fixtures.touchMunicipality(deputyMunicipality.id)
    await fixtures.payload.create({
      collection: 'supporter',
      data: {
        contact: contact.id,
        municipality: supporterMunicipality.id,
        source: 'evento',
        voteIntention: 'certo',
      },
      depth: 0,
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`/campanha/pessoas/${contact.id}`)

    await expect(page.getByRole('heading', { name: 'Ficha' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Dobradinha' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Apoiador' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Dobradinha' }).getByText('PCdoB')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Apoiador' }).getByText('Certo')).toBeVisible()
    // No leadership capacity → no leadership block, no invite.
    await expect(page.getByRole('heading', { name: 'Liderança' })).not.toBeVisible()
    await expect(page.getByRole('button', { name: /Convidar/ })).not.toBeVisible()
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
  })
})
})
