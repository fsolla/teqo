import { assertLeaderRedirect, expect, rendered, test } from './fixtures/campaignHttpTest.js'

/**
 * OPS87 — server slice of `campaignPeople` migrated to the browserless HTTP
 * mode (same server, same database, real HTTP, no browser). What the browser
 * spec read from the DOM is read from the rendered HTML; what it navigated by
 * click is requested by URL. The detail sections pin their stable ids
 * (`person-section-<capacity>`), immune to the sidebar's "Lideranças"/
 * "Dobradinhas" link texts.
 *
 * Browser twin: tests/e2e/campaignPeople.e2e.spec.ts — the browser file keeps the
 * omnibox/combobox interactions and the mobile/dialog writes; this file
 * carries the original test names for the server-side assertions, so the 1:1
 * migration is auditable by `git log`/`-g`. The client-failure guard stays
 * exclusive to browser specs (OPS35).
 */

const section = (id: string) => `id="person-section-${id}"`

test.describe('Pessoas — lista unificada (HTTP)', () => {
  test('staff opens the people list and sees the merged leadership person', async ({
    campaign,
    campaignRequest,
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
    const request = await campaignRequest(coordinator, coordinator.password)

    // The merged row carries the leadership person (the coordinator account
    // itself is a staff person with a ficha — ≥ 2 rows).
    const list = await request.get('/campanha/pessoas')
    expect(list.status()).toBe(200)
    const listHTML = rendered(await list.text())
    expect(listHTML).toContain(contactName)
    expect(listHTML).toMatch(/\d+ pessoas?\b/)

    // The omnibox search is a URL contract: the server renders the narrowed
    // recorte for the same query the browser spec typed.
    const filtered = await request.get(
      `/campanha/pessoas?q=${encodeURIComponent(contactName.slice(0, 8))}`,
    )
    expect(filtered.status()).toBe(200)
    expect(rendered(await filtered.text())).toContain(contactName)
  })

  test('the desktop table reads C130: Dobra em, city under the name, party filter', async ({
    campaign,
    campaignRequest,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora C130'),
    })
    const municipality = await fixtures.claimMunicipality()
    const { contactName } = await fixtures.createStaffLeadership({
      namePrefix: 'C130 Liderança',
      municipalities: [municipality],
    })
    const request = await campaignRequest(coordinator, coordinator.password)

    const response = await request.get('/campanha/pessoas')
    expect(response.status()).toBe(200)
    const html = rendered(await response.text())

    // Renamed column, base column gone (the city now lives under the name —
    // "Base: <city>" is cell text, never a column header).
    expect(html).toContain('Dobra em')
    expect(html).not.toMatch(/<th\b[^>]*>\s*Base\s*<\/th>/)
    expect(html).toContain(municipality.name)

    // The seeded dobradinha's party filters the recorte (canonical URL drives
    // the server-side filter).
    const party = await request.get('/campanha/pessoas?party=PT')
    expect(party.status()).toBe(200)
    const partyHTML = rendered(await party.text())
    expect(partyHTML).toContain('Seed Deputada Estadual')
    expect(partyHTML).not.toContain(contactName)
    expect(partyHTML).toContain('Partido: PT')
  })

  test('the name link in the list opens the person detail (C118 entry point)', async ({
    campaign,
    campaignRequest,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.claimMunicipality()
    const { contactId, contactName } = await fixtures.createStaffLeadership({
      namePrefix: 'Nome Link Detalhe',
      municipalities: [municipality],
    })
    const request = await campaignRequest(coordinator, coordinator.password)

    // The list rows link to the ficha.
    const list = await request.get('/campanha/pessoas')
    expect(list.status()).toBe(200)
    expect(rendered(await list.text())).toContain(`href="/campanha/pessoas/${contactId}"`)

    // The detail renders the chrome and the leadership capacity section.
    const detail = await request.get(`/campanha/pessoas/${contactId}`)
    expect(detail.status()).toBe(200)
    const detailHTML = rendered(await detail.text())
    expect(detailHTML).toContain(contactName)
    expect(detailHTML).toContain(section('ficha'))
    expect(detailHTML).toContain(section('leadership'))
  })

  test('leader cannot open the people page', async ({ campaign, campaignRequest }) => {
    const { fixtures } = campaign
    const phone = fixtures.phone()
    const leader = await fixtures.createCampaignUser('leader', {
      name: fixtures.value('Liderança Sem Acesso'),
      username: phone,
    })
    const request = await campaignRequest({ username: phone }, leader.password)

    await assertLeaderRedirect(request, '/campanha/pessoas')

    const home = await request.get('/campanha/meus-contatos')
    expect(home.status()).toBe(200)
    expect(await home.text()).toContain('Meus contatos')
  })

  test('leader cannot open the person detail route', async ({ campaign, campaignRequest }) => {
    const { fixtures } = campaign
    const phone = fixtures.phone()
    const leader = await fixtures.createCampaignUser('leader', {
      name: fixtures.value('Liderança Detalhe Sem Acesso'),
      username: phone,
    })
    const request = await campaignRequest({ username: phone }, leader.password)

    await assertLeaderRedirect(request, '/campanha/pessoas/99999')
  })

  test('coordinator opens the person detail and sees the sections of her capacities', async ({
    campaign,
    campaignRequest,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.claimMunicipality()

    const { contactId, contactName, leadershipId } = await fixtures.createStaffLeadership({
      namePrefix: 'Liderança Detalhe',
      municipalities: [municipality],
      supportStatus: 'engajado',
    })
    const request = await campaignRequest(coordinator, coordinator.password)

    const response = await request.get(`/campanha/pessoas/${contactId}`)
    expect(response.status()).toBe(200)
    const html = rendered(await response.text())

    // Sections mounted by capacity: a leadership-only person shows Ficha +
    // Liderança, never an empty Dobradinha/Assessorado block.
    expect(html).toContain(section('ficha'))
    expect(html).toContain(section('leadership'))
    expect(html).not.toContain(section('deputy'))
    expect(html).not.toContain(section('assessorado'))
    expect(html).toContain('Engajado')

    // The leadership section links to the rich existing detail (v1 coexistence).
    expect(html).toContain(`href="/campanha/liderancas/${leadershipId}"`)

    // Actions: WhatsApp (phone exists), invite (leadership), delete (coordinator).
    expect(html).toContain('>Enviar WhatsApp<')
    expect(html).toContain('para completar cadastro por WhatsApp')
    expect(html).toContain(`aria-label="Apagar pessoa ${contactName}"`)
  })

  test('coordinator sees dobradinha and apoiador sections only for a person who has them', async ({
    campaign,
    campaignRequest,
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
    const request = await campaignRequest(coordinator, coordinator.password)

    const response = await request.get(`/campanha/pessoas/${contact.id}`)
    expect(response.status()).toBe(200)
    const html = rendered(await response.text())

    expect(html).toContain(section('ficha'))
    expect(html).toContain(section('deputy'))
    expect(html).toContain(section('supporter'))
    expect(html).toContain('PCdoB')
    expect(html).toContain('Certo')
    // No leadership capacity → no leadership block, no invite.
    expect(html).not.toContain(section('leadership'))
    expect(html).not.toContain('para completar cadastro por WhatsApp')
  })

  test('staff sorts by a column header and filters absence via the omnibox (C117)', async ({
    campaign,
    campaignRequest,
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
    const request = await campaignRequest(coordinator, coordinator.password)

    // First click: Lidera opens desc (most municipalities first) — the sort is
    // a URL contract, the server renders the row order.
    const desc = await request.get('/campanha/pessoas?q=C117&sort=lidera')
    expect(desc.status()).toBe(200)
    const descHTML = rendered(await desc.text())
    expect(descHTML.indexOf(twoCities.contactName)).toBeGreaterThanOrEqual(0)
    expect(descHTML.indexOf(oneCity.contactName)).toBeGreaterThanOrEqual(0)
    expect(descHTML.indexOf(twoCities.contactName)).toBeLessThan(
      descHTML.indexOf(oneCity.contactName),
    )

    // Second click: same column inverts.
    const asc = await request.get('/campanha/pessoas?q=C117&sort=lidera&dir=asc')
    expect(asc.status()).toBe(200)
    const ascHTML = rendered(await asc.text())
    expect(ascHTML.indexOf(oneCity.contactName)).toBeLessThan(
      ascHTML.indexOf(twoCities.contactName),
    )

    // Absence facet: only the no-phone person remains.
    const absent = await request.get(
      '/campanha/pessoas?q=C117&ausencia=sem_contato&sort=lidera&dir=asc',
    )
    expect(absent.status()).toBe(200)
    const absentHTML = rendered(await absent.text())
    expect(absentHTML).toContain(noPhoneName)
    expect(absentHTML).not.toContain(twoCities.contactName)
    expect(absentHTML).toContain('Ausência: Sem contato')

    // The union widens: the staff leaderships have no advisors, so they match
    // `sem_assessor` — the row hidden by `sem_contato` alone is back in.
    const union = await request.get(
      '/campanha/pessoas?q=C117&ausencia=sem_contato&ausencia=sem_base&ausencia=sem_assessor&sort=lidera&dir=asc',
    )
    expect(union.status()).toBe(200)
    const unionHTML = rendered(await union.text())
    expect(unionHTML).toContain(noPhoneName)
    expect(unionHTML).toContain(twoCities.contactName)
    expect(unionHTML).toContain('Ausência: Sem contato')
    expect(unionHTML).toContain('Ausência: Sem base')
    expect(unionHTML).toContain('Ausência: Sem assessor')
  })
})
