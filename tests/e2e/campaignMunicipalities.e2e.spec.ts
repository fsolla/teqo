import { SUPPORTER_REGISTRATION_CONSENT_KEY } from '../../src/lib/campaignConsentKeys.js'
import {
  ensureLeasedConsent,
  SUPPORTER_REGISTRATION_CONSENT_LEASE_KEY,
} from '../helpers/testDatabaseLease.js'
import {
  checkRadixWhenHydrated,
  expect,
  expectPostResponse,
  test,
} from './fixtures/campaignE2EFixtures.js'

/**
 * Core municipality-model journeys per role: coordinator strategy editing, advisor
 * scoping, staff declare/estimate privacy boundary, leader lockdown, and staff-only
 * demand workflow.
 *
 * The shared registration consent is LEASED (`ensureLeasedConsent`), never owned
 * through the fixture proxy — creating it there would let this file's cleanup
 * delete the row a parallel spec is using.
 */

/**
 * OH8 — list shell pins (title, search, pagination footer) before OH12 reuses the factory.
 */
test.describe('Municípios — shell (OH8)', () => {
  test('exposes title, search, and pagination on the list', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenador Shell'),
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/municipios`)
    await expect(page.getByRole('heading', { name: 'Municípios', exact: true })).toBeVisible()
    await expect(page.getByLabel('Buscar município')).toBeVisible()
    await expect(page.getByText(/\d+ municípios encontrados/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Ir para a próxima página' })).toBeVisible()
  })
})

test.describe('Municípios — list header mobile (B118)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('hides page title chrome on mobile but keeps list tools', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenador Mobile Header'),
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/municipios`)
    await expect(page.getByRole('heading', { name: 'Municípios', exact: true })).toBeHidden()
    await expect(page.getByLabel('Buscar município')).toBeVisible()
    await expect(page.getByText(/\d+ municípios encontrados/)).toBeVisible()
  })
})

test.describe('Municípios — jornadas por papel', () => {
  test('coordinator opens the municipalities list, edits strategy and assigns an advisor', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })
    const password = coordinator.password
    const advisor = await fixtures.createCampaignUser('advisor', {
      name: fixtures.value('Assessor Regional'),
    })
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, password)
    await page.goto(`${campaign.baseURL}/campanha/municipios`)
    await expect(page.getByRole('heading', { name: 'Municípios', exact: true })).toBeVisible()

    // E9 allocation queue: the list opens on the uncovered deficit and exposes
    // the freshness column the ordering is paired with. `exact` keeps this off
    // the table caption, which embeds the same summary plus column glossary.
    await expect(
      page.getByText('Ordenado por Cobertura (maior déficit primeiro)', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('columnheader', { name: /Ordenar por Frescor do sinal/ }),
    ).toBeVisible()

    await page.goto(`${campaign.baseURL}/campanha/municipios/${municipality.slug}`)
    await expect(page.getByRole('heading', { name: municipality.name })).toBeVisible()

    await page.goto(`${campaign.baseURL}/campanha/municipios/${municipality.slug}/editar`)
    await page.getByLabel(`${advisor.name} `, { exact: false }).check()
    await page.getByRole('button', { name: 'Salvar assessores' }).click()
    await expect(page.getByText('Assessores atualizados.')).toBeVisible()

    await page.getByLabel('Pessimista', { exact: true }).fill('1000')
    await page.getByLabel('Média', { exact: true }).fill('3000')
    await page.getByLabel('Otimista', { exact: true }).fill('5000')
    await page.getByRole('button', { name: 'Salvar votos estimados' }).click()
    await expect(page.getByText('Votos estimados atualizados.')).toBeVisible()

    await page.goto(`${campaign.baseURL}/campanha/municipios/${municipality.slug}`)
    // "Conta da cadeira" (E8) shows the saved scenario values through
    // `MunicipalityListExpectedVotesControl` — a compact edit-in-place
    // control whose only always-visible digits are the active scenario
    // (`central`, "3.000" here). The full pessimistic/central/optimistic
    // trio only becomes plain page text via its screen-reader summary
    // (visually a hover-only preview otherwise), so assert against that
    // unique, unambiguous string rather than a bare "5.000" substring —
    // that also matches the (opacity-0 but DOM-visible) hover-preview span.
    await expect(page.getByText('Otimista: 5.000')).toBeVisible()
    await expect(page.getByText(`Assessoria: ${advisor.name}`)).toBeVisible()
  })

  test('coordinator assigns an advisor from the list combobox with auto-save (B27)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenador Combobox'),
    })
    const password = coordinator.password
    const advisor = await fixtures.createCampaignUser('advisor', {
      name: fixtures.value('Assessora Combobox'),
    })
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, password)
    await page.goto(
      `${campaign.baseURL}/campanha/municipios?q=${encodeURIComponent(municipality.name)}`,
    )
    await expect(page.getByRole('heading', { name: 'Municípios', exact: true })).toBeVisible()

    const advisorsTrigger = page.getByRole('button', { name: 'Editar assessores' })
    await advisorsTrigger.click()

    const advisorsPopover = page.locator('[data-slot="popover-content"]')
    await expect(advisorsPopover).toBeVisible()

    const searchNamePart = advisor.name.split(' ')[0]
    const search = advisorsPopover.getByRole('combobox', { name: 'Buscar assessor' })
    const option = advisorsPopover.getByRole('option', { name: advisor.name })
    // No "Salvar" button in this popover: selecting the option auto-saves the
    // delta and renders it as a removable chip immediately.
    const chip = advisorsPopover.getByRole('button', { name: `Remover ${advisor.name}` })
    // Click the option itself: the inner text generic does not always trigger
    // the combobox selection (measured — the popover stayed on "selected: você").
    // Retry loop for the pre-hydration flake class (same as
    // `checkRadixWhenHydrated`): a click before React attaches is a silent
    // no-op, so the probe retries until the chip sticks.
    await expect(async () => {
      await search.fill(searchNamePart)
      await option.click({ timeout: 1_000 })
      await expect(chip).toBeVisible({ timeout: 4_000 })
    }).toPass({ timeout: 20_000 })

    // The popover stays open after the write (auto-save, not submit+close).
    await expect(advisorsPopover).toBeVisible()
    await page.keyboard.press('Escape')

    // Persistence: reload and reopen to confirm the server, not just local
    // state, now holds the assignment.
    await page.reload()
    await page.getByRole('button', { name: 'Editar assessores' }).click()
    await expect(
      page.locator('[data-slot="popover-content"]').getByRole('button', {
        name: `Remover ${advisor.name}`,
      }),
    ).toBeVisible()
  })

  test('coordinator sets trend status and justification with auto-save (B24)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenador Tendência'),
    })
    const password = coordinator.password
    const municipality = await fixtures.claimMunicipality()
    const note = fixtures.value('Vereador confirmou apoio local')

    await campaign.login(page, coordinator.email!, password)
    await page.goto(
      `${campaign.baseURL}/campanha/municipios?q=${encodeURIComponent(municipality.name)}`,
    )
    await expect(page.getByRole('heading', { name: 'Municípios', exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Editar tendência política' }).click()
    const trendPopover = page.locator('[data-slot="popover-content"]')
    await expect(trendPopover).toBeVisible()
    await expect(trendPopover.getByRole('button', { name: 'Salvar' })).toHaveCount(0)

    await trendPopover.getByLabel('Justificativa').fill(note)
    await trendPopover.getByLabel('Tendência', { exact: true }).selectOption('favoravel')
    await Promise.all([
      expectPostResponse(page, '/campanha/municipios/political-trend'),
      trendPopover.getByLabel('Justificativa').blur(),
    ])

    await expect(page.getByRole('button', { name: 'Editar tendência política' })).toContainText(
      'Favorável',
    )

    await page.keyboard.press('Escape')
    await page.reload()
    await page.getByRole('button', { name: 'Editar tendência política' }).click()
    const reopened = page.locator('[data-slot="popover-content"]')
    await expect(reopened.getByLabel('Tendência', { exact: true })).toHaveValue('favoravel')
    await expect(reopened.getByLabel('Justificativa')).toHaveValue(note)
  })

  test('coordinator registers a typed signal from the list freshness cell', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenador Sinal'),
    })
    const password = coordinator.password
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, password)
    await page.goto(
      `${campaign.baseURL}/campanha/municipios?q=${encodeURIComponent(municipality.name)}`,
    )
    await expect(page.getByRole('heading', { name: 'Municípios', exact: true })).toBeVisible()

    // Anchored: a bare template regex on a municipality name collides with
    // prefix-shared names (Conde/Condeúba — 23/435 measured in the catalog),
    // and `exact` no longer matches because the accessible name appends the
    // current signal state ("— Sem sinal").
    const signalTrigger = page.getByRole('button', {
      name: new RegExp(`^Registrar sinal em ${municipality.name} —`),
    })
    await expect(signalTrigger).toBeVisible()
    await signalTrigger.click()

    const signalForm = page.locator('[data-slot="popover-content"]')
    await expect(signalForm).toBeVisible()
    await signalForm
      .getByRole('textbox', { name: 'Texto' })
      .fill('Liderança local reportou visita adversária na feira.')
    await signalForm.getByLabel('Tipo do sinal').selectOption('visita_adversario')
    await signalForm.getByRole('button', { name: 'Registrar sinal', exact: true }).click()

    await expect(page.getByText('Sinal registrado.', { exact: true })).toBeVisible()
    await expect(
      page.getByRole('button', {
        name: `Registrar sinal em ${municipality.name} — hoje`,
      }),
    ).toBeVisible()
  })

  test('advisor scopes municipalities; staff declare and estimate; leader is locked to contacts', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const administered = await fixtures.claimMunicipality()
    const outside = await fixtures.claimMunicipality()

    const advisor = await fixtures.createCampaignUser('advisor', {
      name: fixtures.value('Assessora'),
    })
    const password = advisor.password
    await campaign.payload.update({
      collection: 'municipality',
      id: administered.id,
      data: { advisors: [advisor.id] },
      depth: 0,
    })
    fixtures.touchMunicipality(administered.id)

    const leaderPhone = fixtures.phone()
    const leaderAccount = await fixtures.createCampaignUser('leader', {
      name: fixtures.value('Liderança'),
      username: leaderPhone,
    })
    const contact = await campaign.payload.create({
      collection: 'contact',
      data: {
        name: fixtures.value('Contato Liderança'),
        phone: leaderPhone,
        state: 'BA',
        city: administered.name,
      },
      depth: 0,
    })
    const leadership = await campaign.payload.create({
      collection: 'leadership',
      data: {
        contact: contact.id,
        municipalities: [administered.id],
        supportStatus: 'engajado',
        user: leaderAccount.id,
      },
      depth: 0,
    })

    await ensureLeasedConsent(campaign.payload, {
      consentKey: SUPPORTER_REGISTRATION_CONSENT_KEY,
      leaseKey: SUPPORTER_REGISTRATION_CONSENT_LEASE_KEY,
    })

    // Advisor scope: only the administered municipality shows up.
    await campaign.login(page, advisor.email!, password)
    await page.goto(`${campaign.baseURL}/campanha/municipios`)
    await expect(
      page.getByRole('link', { name: administered.name, exact: true }).first(),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: outside.name, exact: true })).toHaveCount(0)

    // Staff declare votes on behalf of the leadership.
    await page.goto(`${campaign.baseURL}/campanha/municipios/${administered.slug}?tab=leaderships`)
    await expect(page.getByRole('link', { name: contact.name })).toBeVisible()
    await page.getByLabel('Quantos votos a liderança traz neste município?').fill('250')
    await page.getByRole('button', { name: 'Declarar' }).click()
    await expect(page.getByText('Declaração de votos registrada.')).toBeVisible()

    // Advisor records an internal estimate on the overview pledges panel.
    await page.goto(`${campaign.baseURL}/campanha/municipios/${administered.slug}`)
    await page.getByLabel('Média', { exact: true }).fill('90')
    await page.getByLabel('Justificativa').fill('Histórico da região indica menos.')
    await page.getByRole('button', { name: 'Salvar estimativa' }).click()
    await expect(page.getByText('Média: 90')).toBeVisible()

    // Leader home is the blank Início (B43); the contact tool lives at
    // /campanha/contatos and municipalities redirect there.
    // Each `createCampaignUser` call mints its own password — the advisor's
    // `password` variable above does NOT unlock the leader account.
    await campaign.login(page, leaderPhone, leaderAccount.password)
    await page.goto(`${campaign.baseURL}/campanha/contatos`)
    await expect(page.getByText('Cadastre apoiadores pelo celular.')).toBeVisible()

    // The leader redirect aborts `goto`'s load event (ERR_ABORTED); the
    // redirect itself is the assertion, and `toHaveURL` retries onto it.
    await page.goto(`${campaign.baseURL}/campanha/municipios`).catch(() => {})
    await expect(page).toHaveURL(`${campaign.baseURL}/campanha/contatos`)

    const supporterName = fixtures.value('Apoiador Liderança')
    const supporterPhone = fixtures.phone()
    await page.getByLabel('Nome *').fill(supporterName)
    await page.getByLabel('Celular *').fill(supporterPhone)
    // Radix checkbox: a pre-hydration click is a silent no-op (B13/B17 flake).
    await checkRadixWhenHydrated(page, 'A pessoa autorizou o cadastro *')
    await page.getByRole('button', { name: 'Cadastrar contato' }).click()
    await expect(page.getByText(supporterName)).toBeVisible()

    expect(leadership.id).toBeGreaterThan(0)
  })

  test('advisor opens a demand and decides it', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const municipality = await fixtures.claimMunicipality()

    const advisor = await fixtures.createCampaignUser('advisor', {
      name: fixtures.value('Assessor Demandas'),
    })
    const password = advisor.password
    await campaign.payload.update({
      collection: 'municipality',
      id: municipality.id,
      data: { advisors: [advisor.id] },
      depth: 0,
    })
    fixtures.touchMunicipality(municipality.id)

    const demandTitle = fixtures.value('Carro de som')

    await campaign.login(page, advisor.email!, password)
    await page.goto(`${campaign.baseURL}/campanha/demandas/nova`)
    await page.getByLabel('O que você precisa?').fill(demandTitle)
    await page.getByLabel('Município').selectOption({ label: municipality.name })
    await page.getByLabel('Detalhe a necessidade').fill('Precisamos para a caminhada de sábado.')
    await page.getByRole('button', { name: 'Abrir demanda' }).click()
    await expect(page.getByRole('heading', { name: demandTitle })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Aprovar' })).toBeVisible()

    await page.goto(`${campaign.baseURL}/campanha/demandas`)
    await page.getByRole('link', { name: demandTitle }).click()
    await page.getByLabel('Nota da decisão').fill('Aprovado — retirar no comitê.')
    await page.getByRole('button', { name: 'Aprovar' }).click()
    await expect(page.getByText('Esta demanda já foi decidida.')).toBeVisible()
    await expect(page.getByText('Aprovada', { exact: true })).toBeVisible()
  })
})

/**
 * B42: on the phone the list is cards, the quick-edit cells are Drawers, and the
 * card itself is the way into the município — the "Abrir município" button is
 * gone. The two gestures that can only fail together are pinned here: tapping a
 * control must not navigate, and tapping anything else must.
 */
test.describe('Municípios — cards no celular (B42)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('opens the trend Drawer without navigating, and the card body opens the município', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenador Mobile'),
    })
    const password = coordinator.password
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, password)
    const listURL = `${campaign.baseURL}/campanha/municipios?q=${encodeURIComponent(municipality.name)}`
    await page.goto(listURL)

    const card = page.locator('[data-view="mobile-cards"] article').first()
    await expect(card).toBeVisible()
    await expect(page.getByRole('link', { name: 'Abrir município' })).toHaveCount(0)

    await card.getByRole('button', { name: 'Editar tendência política' }).click()
    // B79 keeps CampaignQuickActionsDrawer mounted (modal=false); scope to the trend dialog.
    const drawer = page.getByRole('dialog', { name: 'Editar tendência' })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText(municipality.name, { exact: true })).toBeVisible()
    await expect(page).toHaveURL(listURL)

    await drawer.getByRole('button', { name: 'Fechar' }).click()
    await expect(drawer).toBeHidden()

    // Anywhere outside a control is the município's own link: the click lands on
    // the stretched `after:inset-0` overlay, which belongs to the card heading.
    // The tap goes on a field LABEL inside the metrics grid on purpose — the
    // first version of this card positioned each grid cell instead of each
    // control, which lifted the labels and their padding above the overlay and
    // made half the card a tap that neither edited nor navigated.
    // `force`: Playwright's hit-target check retries forever here precisely
    // BECAUSE the stretched overlay intercepts the pointer — which is the
    // behavior under test. Force dispatches the tap at the label's point, the
    // overlay receives it (as a user's finger would), and the card navigates.
    await card.getByText('Tendência', { exact: true }).click({ force: true })
    await expect(page).toHaveURL(`${campaign.baseURL}/campanha/municipios/${municipality.slug}`)
    await expect(page.getByRole('heading', { name: municipality.name })).toBeVisible()
  })
})

/**
 * B105: bottom drawer loads docked with search visible, collapses on page scroll down
 * (discreet search peek remains), and re-docks on scroll up; handle sits above the search.
 */
test.describe('Municípios — bottom drawer mobile (B105)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('dock on load, collapse on scroll down with search peek, reopen on scroll up', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenador Drawer'),
    })
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/municipios/${municipality.slug}`)
    await expect(page.getByRole('heading', { name: municipality.name })).toBeVisible()

    const search = page.getByLabel('Buscar na campanha')
    await expect(search).toBeInViewport()
    await expect(search).toHaveAttribute('placeholder', 'Município, liderança, atividade…')

    const handle = page.getByRole('button', { name: 'Ocultar ações rápidas' })
    const handleBox = await handle.boundingBox()
    const searchBox = await search.boundingBox()
    expect(handleBox).toBeTruthy()
    expect(searchBox).toBeTruthy()
    expect(handleBox!.y).toBeLessThan(searchBox!.y)

    const scrollport = page.locator('[data-slot="campaign-content-scroll"]')
    await scrollport.evaluate((el) => {
      el.scrollTop = 80
      el.dispatchEvent(new Event('scroll'))
    })

    await expect(page.getByRole('button', { name: 'Mostrar ações rápidas' })).toBeVisible()
    await expect(search).toBeInViewport()
    await expect(search).toHaveAttribute('placeholder', '')

    await scrollport.evaluate((el) => {
      el.scrollTop = 0
      el.dispatchEvent(new Event('scroll'))
    })
    await expect(page.getByRole('button', { name: 'Ocultar ações rápidas' })).toBeVisible()
    await expect(search).toBeInViewport()
    await expect(search).toHaveAttribute('placeholder', 'Município, liderança, atividade…')
  })
})

/**
 * B109: dock labels readable, search focus goes fullscreen (strip hidden), current
 * entity excluded from suggest/results.
 */
test.describe('Municípios — bottom drawer polish (B109)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('dock labels readable, search fullscreen hides strip, excludes current município', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenador B109'),
    })
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/municipios/${municipality.slug}`)
    await expect(page.getByRole('heading', { name: municipality.name })).toBeVisible()

    const changeTrend = page.getByRole('link', { name: 'Mudar tendência' })
    await expect(changeTrend).toBeVisible()
    await expect(changeTrend).toContainText('Mudar tendência')

    const search = page.getByLabel('Buscar na campanha')
    await search.focus()
    await expect(page.getByRole('link', { name: 'Mudar tendência' })).toBeHidden()

    const handle = page.getByRole('button', { name: 'Ocultar ações rápidas' })
    const handleBox = await handle.boundingBox()
    expect(handleBox).toBeTruthy()
    // Fullscreen search docks the strip under the safe-area top bar; allow a
    // few px of layout jitter (subpixel / font metrics) without losing the
    // "near the top" assertion.
    expect(handleBox!.y).toBeLessThan(48)

    // Scope to the drawer: the município detail page also has a "Sugestões" region.
    const drawer = page.getByRole('dialog', { name: 'Ações rápidas' })
    const drawerSuggestions = drawer.getByRole('region', { name: 'Sugestões' })
    await expect(drawerSuggestions).toBeVisible()
    await expect(drawerSuggestions.getByText(municipality.name, { exact: true })).toHaveCount(0)
  })
})
