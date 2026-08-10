import type { Page } from '@playwright/test'

import { SUPPORTER_REGISTRATION_CONSENT_KEY } from '../../src/lib/campaignConsentKeys.js'
import {
  ensureLeasedConsent,
  SUPPORTER_REGISTRATION_CONSENT_LEASE_KEY,
} from '../helpers/testDatabaseLease.js'
import {
  campaignPageChrome,
  checkRadixWhenHydrated,
  expect,
  expectPostResponse,
  test,
} from './fixtures/campaignE2EFixtures.js'
import {
  assertThreeColumnActionGrid,
  collectActionBoundingBoxes,
} from './helpers/actionGridGeometry.js'

const showAllMunicipalityColumns = (page: Page, url: string) =>
  page.context().addCookies([
    {
      name: 'campaign_columns',
      value: encodeURIComponent('municipios:__none__'),
      url,
    },
  ])

const municipalityContainer = (page: Page) =>
  page.locator('[data-container="municipality-list"]').last()

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// The button keeps a state suffix; the boundary prevents "São Félix" matching
// the longer municipality "São Félix do Coribe".
const visibleMunicipalityButton = (page: Page, name: string) =>
  municipalityContainer(page)
    .getByRole('button', { name: new RegExp(`^${escapeRegExp(name)}(?: —|$)`) })
    .filter({ visible: true })

const ensureWideMunicipalityList = async (page: Page) => {
  // The resizable panel hydrates independently from the RSC list and can
  // change the container stage after a cell first becomes visible. These
  // desktop cell journeys wait for the widest table stage; B158 exercises the
  // rail transition itself in its dedicated spec.
  await page.waitForLoadState('networkidle')
  const container = municipalityContainer(page)
  const width = await container.evaluate((element) => element.clientWidth)
  const close = page.getByRole('button', { name: 'Fechar', exact: true }).filter({ visible: true })
  // A collapsed Panel can leave its overflowing close button technically
  // visible. Only click when the list itself proves the chat still consumes
  // space; otherwise the click is a no-op against an already collapsed rail.
  if (width < 78 * 16 && (await close.isVisible())) await close.click()
  await expect
    .poll(() => container.evaluate((element) => element.clientWidth))
    .toBeGreaterThanOrEqual(78 * 16)
}

/**
 * Core municipality-model journeys per role: coordinator strategy editing, advisor
 * scoping, staff declare/estimate privacy boundary, leader lockdown, and staff-only
 * demand workflow.
 *
 * The shared registration consent is LEASED (`ensureLeasedConsent`), never owned
 * through the fixture proxy — creating it there would let this file's cleanup
 * delete the row a parallel spec is using.
 */

test.describe('Municípios — jornadas por papel', () => {
  test.beforeEach(async ({ page }) => {
    // B158 keys the table stages to content width and gives fresh profiles a
    // compact default. These pre-B158 journeys exercise specific desktop
    // cells, so make that prerequisite explicit instead of finding hidden
    // copies in the always-mounted mobile-card tree.
    await page.setViewportSize({ width: 2400, height: 1000 })
  })

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
    await showAllMunicipalityColumns(page, campaign.baseURL)
    await page.goto(`${campaign.baseURL}/campanha/municipios`)
    await expect(campaignPageChrome(page, 'Municípios')).toBeVisible()

    // B127: primary filter entry is the omnibox; default sort is no longer a
    // free-standing "Ordenado por …" line (only a non-default sort chip).
    await expect(page.getByLabel('Filtrar municípios')).toBeVisible()
    await expect(
      page.getByRole('columnheader', { name: /Ordenar por Frescor do sinal/ }),
    ).toBeVisible()

    await page.goto(`${campaign.baseURL}/campanha/municipios/${municipality.slug}`)
    await expect(campaignPageChrome(page, municipality.name)).toBeVisible()

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
    // `.nth(0)`: the cell's sr-only summary is first in DOM; the preview span
    // duplicates the text when a row is hovered, making a bare getByText a
    // strict-mode violation (observed flaky on CI).
    await expect(page.getByText('Otimista: 5.000').nth(0)).toBeVisible()

    // B145: assessoria left the detail hero; it still appears on the dossiê tab.
    // `.first()`: transient RSC-pending duplication also duplicates this line
    // (same strict-mode flake as the "Otimista" assert above).
    await page.goto(`${campaign.baseURL}/campanha/municipios/${municipality.slug}?tab=dossie`)

    // `.nth(0)`: same transient hydration duplicate the "Otimista: 5.000"
    // assertion pins — the server-composed slot briefly renders twice.
    await expect(page.getByText(`Assessoria: ${advisor.name}`).nth(0)).toBeVisible()
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
    await showAllMunicipalityColumns(page, campaign.baseURL)
    await page.goto(
      `${campaign.baseURL}/campanha/municipios?q=${encodeURIComponent(municipality.name)}`,
    )
    await expect(campaignPageChrome(page, 'Municípios')).toBeVisible()
    await ensureWideMunicipalityList(page)

    // Name includes the município — a substring search can return neighbors
    // (strict-mode flake when two "Editar assessores …" buttons match).
    // A concurrent RSC navigation may briefly retain the previous segment.
    // Scope the editor to the appended, active municipality container so a
    // hidden copy cannot absorb Playwright's click retries until timeout.
    const advisorsTrigger = visibleMunicipalityButton(
      page,
      `Editar assessores em ${municipality.name}`,
    )
    await expect(advisorsTrigger).toBeVisible()
    await advisorsTrigger.click()

    const advisorsPopover = page.locator('[data-slot="popover-content"]')
    await expect(advisorsPopover).toBeVisible()

    const searchNamePart = advisor.name.split(' ')[0]
    const search = advisorsPopover.getByRole('combobox', { name: 'Buscar assessor' })
    const option = advisorsPopover.getByRole('option', { name: advisor.name })
    // No "Salvar" button in this popover: selecting the option auto-saves the
    // delta and renders it as a removable chip immediately.
    const chip = advisorsPopover.getByRole('button', { name: `Remover ${advisor.name}` })
    // Opening this client-only popover already proves hydration. Wait for the
    // write itself: the chip and trigger are optimistic and do not prove the
    // assignment reached the database before the reload below.
    await search.fill(searchNamePart)
    await Promise.all([expectPostResponse(page, '/campanha/municipios/advisors'), option.click()])
    await expect(chip).toBeVisible()

    // The popover stays open after the write (auto-save, not submit+close).
    await expect(advisorsPopover).toBeVisible()
    // Trigger label flips from "sem assessor" only after the write lands —
    // wait for that before Escape/reload so we do not race optimistic chips.
    await expect(
      page.getByRole('button', {
        name: `Editar assessores em ${municipality.name} — ${advisor.name}`,
      }),
    ).toBeVisible()
    await page.keyboard.press('Escape')

    // Persistence: reload and reopen to confirm the server, not just local
    // state, now holds the assignment.
    await page.reload()
    await expect(campaignPageChrome(page, 'Municípios')).toBeVisible()
    await ensureWideMunicipalityList(page)
    await visibleMunicipalityButton(
      page,
      `Editar assessores em ${municipality.name} — ${advisor.name}`,
    ).click()
    await expect(
      page.locator('[data-slot="popover-content"]').getByRole('button', {
        name: `Remover ${advisor.name}`,
      }),
    ).toBeVisible()
  })

  test('coordinator creates an advisor inline in the list combobox (B154)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenador Inline'),
    })
    const password = coordinator.password
    const municipality = await fixtures.claimMunicipality()
    // Unique per run (uuid + counter), so no eligible account matches it — the
    // combobox must offer the create option, not an existing advisor.
    const newAdvisorName = fixtures.value('Novo Assessor')

    await campaign.login(page, coordinator.email!, password)
    await showAllMunicipalityColumns(page, campaign.baseURL)
    await page.goto(
      `${campaign.baseURL}/campanha/municipios?q=${encodeURIComponent(municipality.name)}`,
    )
    await expect(campaignPageChrome(page, 'Municípios')).toBeVisible()
    await ensureWideMunicipalityList(page)

    const advisorsTrigger = visibleMunicipalityButton(
      page,
      `Editar assessores em ${municipality.name}`,
    )
    await advisorsTrigger.click()
    const advisorsPopover = page.locator('[data-slot="popover-content"]')
    await expect(advisorsPopover).toBeVisible()

    const search = advisorsPopover.getByRole('combobox', { name: 'Buscar assessor' })
    const createOption = advisorsPopover.getByRole('option', {
      name: new RegExp(`^Criar assessor.*${newAdvisorName}`),
    })
    // The removable chip only exists once the response lands — the optimistic
    // temp chip has no remove affordance. `count()` guard: once the create
    // succeeded and registered the account, the create option is gone, so a
    // retry must not try to click it again (it would time out) — skipping the
    // click and waiting for the chip is what a post-success retry does.
    const chip = advisorsPopover.getByRole('button', { name: `Remover ${newAdvisorName}` })

    await expect(async () => {
      await search.fill(newAdvisorName)
      if (await createOption.count()) await createOption.click({ timeout: 1_000 })
      await expect(chip).toBeVisible({ timeout: 5_000 })
    }).toPass({ timeout: 25_000 })

    // Same popover, no reload: typing the name now lists the account instead of
    // offering to create it again — the local bridge registered it.
    await search.fill(newAdvisorName)
    await expect(advisorsPopover.getByRole('option', { name: newAdvisorName })).toBeVisible()
    await expect(advisorsPopover.getByRole('option', { name: /Criar assessor/ })).toHaveCount(0)

    // The popover stays open after the write (auto-save, not submit+close).
    await expect(advisorsPopover).toBeVisible()
    await page.keyboard.press('Escape')

    // Persistence: reload and reopen to confirm the server holds the account
    // and the assignment, not just the local optimistic state.
    await page.reload()
    await expect(campaignPageChrome(page, 'Municípios')).toBeVisible()
    await ensureWideMunicipalityList(page)
    await visibleMunicipalityButton(
      page,
      `Editar assessores em ${municipality.name} — ${newAdvisorName}`,
    ).click()
    await expect(
      page.locator('[data-slot="popover-content"]').getByRole('button', {
        name: `Remover ${newAdvisorName}`,
      }),
    ).toBeVisible()
  })

  test('coordinator creates a dobradinha inline in the list combobox (B157)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenador Dobradinhas'),
    })
    const password = coordinator.password
    const municipality = await fixtures.claimMunicipality()
    // Unique per run (uuid + counter), so no catalog entry matches it — the
    // combobox must offer the create option, not an existing dobradinha.
    const deputyName = fixtures.value('Deputado Novo')
    const party = 'PCdoB'

    await campaign.login(page, coordinator.email!, password)
    await showAllMunicipalityColumns(page, campaign.baseURL)
    await page.goto(
      `${campaign.baseURL}/campanha/municipios?q=${encodeURIComponent(municipality.name)}`,
    )
    await expect(campaignPageChrome(page, 'Municípios')).toBeVisible()
    await ensureWideMunicipalityList(page)

    const deputiesTrigger = visibleMunicipalityButton(
      page,
      `Editar dobradinhas em ${municipality.name}`,
    )
    await deputiesTrigger.click()
    const deputiesPopover = page.locator('[data-slot="popover-content"]')
    await expect(deputiesPopover).toBeVisible()

    const search = deputiesPopover.getByRole('combobox', { name: 'Buscar dobradinha' })
    // "Cicrano (PCdoB)" → name "Cicrano", party "PCdoB" (B157 syntax).
    const createOption = deputiesPopover.getByRole('option', {
      name: new RegExp(`^Criar dobradinha.*${deputyName}`),
    })
    const chip = deputiesPopover.getByRole('button', {
      name: `Remover ${deputyName} (${party})`,
    })

    // Same retry contract as B154: a click before hydration is a silent no-op,
    // and once the create succeeded the option is gone (count() guard).
    await expect(async () => {
      await search.fill(`${deputyName} (${party})`)
      if (await createOption.count()) await createOption.click({ timeout: 1_000 })
      await expect(chip).toBeVisible({ timeout: 5_000 })
    }).toPass({ timeout: 25_000 })

    // Same popover, no reload: typing the party now must NOT offer to create a
    // duplicate — the search only lists ADDABLE items, so the assigned chip's
    // own name never appears as an option; the "Criar …" suppression is what
    // proves the RSC refresh brought the new deputy into the catalog.
    await search.fill(party)
    await expect(deputiesPopover.getByRole('option', { name: /Criar dobradinha/ })).toHaveCount(0)
    await expect(chip).toBeVisible()

    // The popover stays open after the write (auto-save, not submit+close).
    await expect(deputiesPopover).toBeVisible()
    await page.keyboard.press('Escape')

    // Persistence: reload and reopen — the server holds both the deputy and
    // the assignment, not just the local optimistic state.
    await page.reload()
    await expect(campaignPageChrome(page, 'Municípios')).toBeVisible()
    await ensureWideMunicipalityList(page)
    await visibleMunicipalityButton(page, `Editar dobradinhas em ${municipality.name}`).click()
    await expect(
      page.locator('[data-slot="popover-content"]').getByRole('button', {
        name: `Remover ${deputyName} (${party})`,
      }),
    ).toBeVisible()
  })

  test('B176 — filters the list by Dobradinha, Liderança and Partido from the omnibox', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenador Filtros B176'),
    })
    const municipalityA = await fixtures.claimMunicipality()
    const municipalityB = await fixtures.claimMunicipality()

    // A dobradinha linked to municipality A only, with a distinctive party so
    // the Partido facet cannot collide with other parallel specs.
    const deputyName = fixtures.value('Deputada B176')
    const deputyContact = await fixtures.payload.create({
      collection: 'contact',
      data: { name: deputyName, state: 'BA' },
      depth: 0,
    })
    const deputy = await fixtures.payload.create({
      collection: 'stateDeputy',
      data: { contact: deputyContact.id, party: 'BR176', slug: fixtures.value('deputado') },
      depth: 0,
      draft: false,
    })
    await fixtures.payload.update({
      collection: 'municipality',
      id: municipalityA.id,
      data: { stateDeputies: [deputy.id] },
      depth: 0,
    })
    fixtures.touchMunicipality(municipalityA.id)

    // A leadership acting on municipality B only.
    const leadership = await fixtures.createStaffLeadership({
      namePrefix: 'Liderança B176',
      municipalities: [municipalityB],
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await showAllMunicipalityColumns(page, campaign.baseURL)
    await page.goto(`${campaign.baseURL}/campanha/municipios`)
    await expect(campaignPageChrome(page, 'Municípios')).toBeVisible()
    await ensureWideMunicipalityList(page)

    const omnibox = page.getByRole('combobox', { name: 'Filtrar municípios' })
    const listbox = page.getByRole('listbox', { name: 'Filtrar municípios' })
    const tableRows = municipalityContainer(page).locator('tbody tr')
    // The omnibox chips live in the search form ABOVE the list container.
    const removeChip = (label: string) => page.getByRole('button', { name: `Remover ${label}` })

    // Dobradinha by contact name → chip + only municipality A remains.
    await omnibox.fill(deputyName)
    await listbox.getByRole('option', { name: new RegExp(`^${deputyName} \\(BR176\\)$`) }).click()
    await expect(removeChip(`Dobradinha: ${deputyName} (BR176)`)).toBeVisible()
    await expect(tableRows).toHaveCount(1)
    await expect(page.getByRole('link', { name: municipalityA.name, exact: true })).toBeVisible()

    // Removing the chip restores the unfiltered 25-row page 1.
    await removeChip(`Dobradinha: ${deputyName} (BR176)`).click()
    await expect(removeChip(`Dobradinha: ${deputyName} (BR176)`)).toHaveCount(0)

    // Partido by acronym → the same single municipality (its only dobradinha).
    await omnibox.fill('BR176')
    await listbox.getByRole('option', { name: 'BR176', exact: true }).click()
    await expect(removeChip('Partido: BR176')).toBeVisible()
    await expect(tableRows).toHaveCount(1)
    await expect(page.getByRole('link', { name: municipalityA.name, exact: true })).toBeVisible()

    await removeChip('Partido: BR176').click()
    await expect(removeChip('Partido: BR176')).toHaveCount(0)

    // Liderança by contact name → municipality B only.
    await omnibox.fill(leadership.contactName)
    await listbox.getByRole('option', { name: new RegExp(`^${leadership.contactName}$`) }).click()
    await expect(removeChip(`Liderança: ${leadership.contactName}`)).toBeVisible()
    await expect(tableRows).toHaveCount(1)
    await expect(page.getByRole('link', { name: municipalityB.name, exact: true })).toBeVisible()
  })

  test('B176 — advisor edits Dobradinhas inline within an administered municipality', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const advisor = await fixtures.createCampaignUser('advisor', {
      name: fixtures.value('Assessor B176'),
    })
    const municipality = await fixtures.claimMunicipality()
    await fixtures.payload.update({
      collection: 'municipality',
      id: municipality.id,
      data: { advisors: [advisor.id] },
      depth: 0,
    })
    fixtures.touchMunicipality(municipality.id)

    // A dobradinha linked to NO municipality — the full staff catalog must
    // still offer it to the advisor in the cell (gate 2026-08-09).
    const deputyName = fixtures.value('Deputado Disponível B176')
    const contact = await fixtures.payload.create({
      collection: 'contact',
      data: { name: deputyName, state: 'BA', city: null },
      depth: 0,
    })
    await fixtures.payload.create({
      collection: 'stateDeputy',
      data: { contact: contact.id, party: 'PSD', slug: fixtures.value('deputado') },
      depth: 0,
      draft: false,
    })

    await campaign.login(page, advisor.email!, advisor.password)
    await showAllMunicipalityColumns(page, campaign.baseURL)
    await page.goto(
      `${campaign.baseURL}/campanha/municipios?q=${encodeURIComponent(municipality.name)}`,
    )
    await expect(campaignPageChrome(page, 'Municípios')).toBeVisible()
    await ensureWideMunicipalityList(page)

    await visibleMunicipalityButton(page, `Editar dobradinhas em ${municipality.name}`).click()
    const popover = page.locator('[data-slot="popover-content"]')
    await expect(popover).toBeVisible()
    const search = popover.getByRole('combobox', { name: 'Buscar dobradinha' })
    const chip = popover.getByRole('button', { name: `Remover ${deputyName} (PSD)` })

    await expect(async () => {
      await search.fill(deputyName)
      // Register the write-waiter before the click: asserting the optimistic
      // chip alone proves nothing about the database, and a reload racing the
      // POST would capture the pre-write state (the B32+ auto-save race).
      const saved = expectPostResponse(page, '/campanha/municipios')
      await popover.getByRole('option', { name: new RegExp(`^${deputyName} \\(PSD\\)$`) }).click()
      await expect(chip).toBeVisible({ timeout: 5_000 })
      await saved
    }).toPass({ timeout: 25_000 })

    await page.keyboard.press('Escape')

    // Persistence across reload: the server holds the assignment.
    await page.reload()
    await expect(campaignPageChrome(page, 'Municípios')).toBeVisible()
    await ensureWideMunicipalityList(page)
    await expect(async () => {
      await visibleMunicipalityButton(page, `Editar dobradinhas em ${municipality.name}`).click()
      await expect(
        page.locator('[data-slot="popover-content"]').getByRole('button', {
          name: `Remover ${deputyName} (PSD)`,
        }),
      ).toBeVisible({ timeout: 5_000 })
    }).toPass({ timeout: 25_000 })
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
    await showAllMunicipalityColumns(page, campaign.baseURL)
    await page.goto(
      `${campaign.baseURL}/campanha/municipios?q=${encodeURIComponent(municipality.name)}`,
    )
    await expect(campaignPageChrome(page, 'Municípios')).toBeVisible()

    const trendButton = page.getByRole('button', {
      name: new RegExp(`^Editar tendência política em ${municipality.name}`),
    })
    await trendButton.click()
    const trendPopover = page.locator('[data-slot="popover-content"]')
    await expect(trendPopover).toBeVisible()
    await expect(trendPopover.getByRole('button', { name: 'Salvar' })).toHaveCount(0)

    await trendPopover.getByLabel('Justificativa').fill(note)
    await trendPopover.getByLabel('Tendência', { exact: true }).selectOption('favoravel')
    await Promise.all([
      expectPostResponse(page, '/campanha/municipios/political-trend'),
      trendPopover.getByLabel('Justificativa').blur(),
    ])

    await expect(trendButton).toContainText('Favorável')

    await page.keyboard.press('Escape')
    await page.reload()
    await trendButton.click()
    const reopened = page.locator('[data-slot="popover-content"]')
    await expect(reopened.getByLabel('Tendência', { exact: true })).toHaveValue('favoravel')
    await expect(reopened.getByLabel('Justificativa')).toHaveValue(note)
  })

  test('coordinator registers an adversary-signal update from the list freshness cell', async ({
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
    await showAllMunicipalityColumns(page, campaign.baseURL)
    await page.goto(
      `${campaign.baseURL}/campanha/municipios?q=${encodeURIComponent(municipality.name)}`,
    )
    await expect(campaignPageChrome(page, 'Municípios')).toBeVisible()
    await ensureWideMunicipalityList(page)

    // Anchored: a bare template regex on a municipality name collides with
    // prefix-shared names (Conde/Condeúba — 23/435 measured in the catalog),
    // and `exact` no longer matches because the accessible name appends the
    // current signal state ("— Sem sinal").
    const signalTrigger = municipalityContainer(page)
      .getByRole('button', {
        name: new RegExp(`^Registrar atualização em ${municipality.name} —`),
      })
      .filter({ visible: true })
    await expect(signalTrigger).toBeVisible()
    await signalTrigger.click()

    const signalForm = page.locator('[data-slot="popover-content"]')
    await expect(signalForm).toBeVisible()
    await signalForm
      .getByRole('textbox', { name: 'Texto' })
      .fill('Liderança local reportou visita adversária na feira.')
    await signalForm.getByLabel('Polaridade').getByRole('radio', { name: 'Ruim' }).click()
    await signalForm.getByLabel('Sinalizar adversário').check()
    await Promise.all([
      expectPostResponse(page, '/campanha/municipios'),
      signalForm.getByRole('button', { name: 'Registrar atualização', exact: true }).click(),
    ])

    // The toast is intentionally transient; the persisted freshness label is
    // the stable success contract and must arrive after the server response.
    await expect(
      page.getByRole('button', {
        name: `Registrar atualização em ${municipality.name} — hoje`,
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
    await showAllMunicipalityColumns(page, campaign.baseURL)
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
    await expect(campaignPageChrome(page, 'Contatos')).toBeVisible()

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
    await expect(campaignPageChrome(page, demandTitle)).toBeVisible()
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
    // B126 FAB overlay is closed by default; scope to the trend dialog.
    const drawer = page.getByRole('dialog', { name: 'Editar tendência' })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText(municipality.name, { exact: true })).toBeVisible()
    await expect(page).toHaveURL(listURL)

    await drawer.getByRole('button', { name: 'Fechar' }).click()
    await expect(drawer).toBeHidden()

    // Anywhere outside a control is the município's own link: the click lands on
    // the stretched `after:inset-0` overlay, which belongs to the card heading.
    // B193 recomposed the card and every label became a trigger, so the tap goes
    // on the card's top-left padding corner — the one area no control covers.
    // `force`: Playwright's hit-target check retries forever here precisely
    // BECAUSE the stretched overlay intercepts the pointer — which is the
    // behavior under test. Force dispatches the tap at that point, the overlay
    // receives it (as a user's finger would), and the card navigates.
    await card.click({ position: { x: 6, y: 6 }, force: true })
    await expect(page).toHaveURL(`${campaign.baseURL}/campanha/municipios/${municipality.slug}`)
    await expect(campaignPageChrome(page, municipality.name)).toBeVisible()
  })

  /**
   * C109: the custom-footer sheets ("Registrar atualização" here, the same
   * mechanism as E14's "Registrar movimento") used to portal their footer from
   * the cell into the shared Drawer. `createPortal` keeps the source context,
   * which has no `Drawer.Root`, so base-ui's `DialogClose` threw and the sheet
   * never rendered. The footer must open, submit, and close inside the shared
   * Drawer.
   */
  test('opens the update quick-edit sheet, registers, and closes via Cancelar (C109)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora C109'),
    })
    const password = coordinator.password
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, password)
    const listURL = `${campaign.baseURL}/campanha/municipios?q=${encodeURIComponent(municipality.name)}`
    await page.goto(listURL)

    const card = page.locator('[data-view="mobile-cards"] article').first()
    await expect(card).toBeVisible()
    await card.getByRole('button', { name: /^Registrar atualização em/ }).click()

    // The sheet's primary action lives in the custom footer — the two buttons
    // the phone thumb expects, rendered inside the shared Drawer.
    const sheet = page.getByRole('dialog', { name: 'Registrar atualização' })
    await expect(sheet).toBeVisible()
    await expect(
      sheet.getByRole('button', { name: 'Registrar atualização', exact: true }),
    ).toBeVisible()
    await expect(sheet.getByRole('button', { name: 'Cancelar' })).toBeVisible()
    await expect(page).toHaveURL(listURL)

    await sheet
      .getByRole('textbox', { name: 'Texto' })
      .fill('Sinal registrado pelo sheet mobile do card.')
    await sheet.getByLabel('Polaridade').getByRole('radio', { name: 'Boa' }).click()
    await Promise.all([
      expectPostResponse(page, '/campanha/municipios'),
      sheet.getByRole('button', { name: 'Registrar atualização', exact: true }).click(),
    ])

    // The toast is intentionally transient; the persisted freshness label is
    // the stable success contract and must arrive after the server response.
    // B193 — once the município HAS an update, the card footer becomes the
    // expandable "Última atualização" row (the register CTA lives inside the
    // expansion), so the freshness contract is asserted on the footer itself.
    const updateFooter = card.getByRole('button', { name: /^Última atualização/ })
    await expect(updateFooter).toContainText('hoje')
    await updateFooter.click()

    // Reopen: the chrome is rebuilt fresh, and the custom footer comes back.
    await card.getByRole('button', { name: /^Registrar atualização em/ }).click()
    await expect(sheet).toBeVisible()
    await sheet.getByRole('button', { name: 'Cancelar' }).click()
    await expect(sheet).toBeHidden()

    // E14's level sheet is the same custom-footer mechanism — the other caller
    // that shares the crash. It must open and close without one too.
    await card.getByRole('button', { name: /^Nível de envolvimento de/ }).click()
    const levelSheet = page.getByRole('dialog', { name: 'Registrar nível de envolvimento' })
    await expect(levelSheet).toBeVisible()
    await expect(levelSheet.getByRole('button', { name: 'Registrar movimento' })).toBeVisible()
    await levelSheet.getByRole('button', { name: 'Cancelar' }).click()
    await expect(levelSheet).toBeHidden()
  })
})

/**
 * B184 (2026-08-09): on the phone the list-filter chrome is borderless and
 * sticky under the top bar (the shared omnibox standard), the text "Limpar" is
 * replaced by a circular X inside the field (chips OR a typed search), the
 * save-recorte control anchors in the app top bar, and the municipality cards
 * are edge-to-edge with a single separator line between them.
 */
test.describe('Municípios — filtro e cards sem moldura no celular (B184)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('omnibox borderless/sticky, X clears chips and search, save in the top bar, cards edge-to-edge', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora B184'),
    })
    const password = coordinator.password

    await campaign.login(page, coordinator.email!, password)
    await page.goto(`${campaign.baseURL}/campanha/municipios`)
    // C106 — dynamic pages stream a transient hidden `#S:*` copy of the shell;
    // strict-mode locators below would match BOTH copies while it settles.
    await page.waitForFunction(() => document.querySelectorAll('div[id^="S:"]').length === 0)

    // The mobile standard hides the field label; the input keeps its name via
    // aria-label, and the filter form is a borderless sticky bar.
    await expect(page.getByText('Filtrar municípios', { exact: true })).toBeHidden()
    const omniboxInput = page.getByRole('combobox', { name: 'Filtrar municípios' })
    const field = omniboxInput.locator('..')
    const filterForm = omniboxInput.locator('xpath=ancestor::form[1]')
    await expect(field).toHaveCSS('border-top-width', '0px')
    await expect(filterForm).toHaveCSS('position', 'sticky')
    await expect(filterForm).toHaveCSS('border-bottom-width', '1px')

    // No filters, no search → no clear affordance at all.
    await expect(page.getByRole('button', { name: 'Limpar', exact: true })).toHaveCount(0)

    // A typed search alone shows the X; clicking it clears the draft, keeps
    // the focus in the field and does not reopen the suggestion popover (the
    // contract that broke the agenda e2e before the `setOpen(false)`).
    await omniboxInput.fill('Feira de Santana')
    const clearX = page.getByRole('button', { name: 'Limpar', exact: true })
    await expect(clearX).toBeVisible()
    await clearX.click()
    await expect(omniboxInput).toHaveValue('')
    await expect(omniboxInput).toBeFocused()
    await expect(omniboxInput).toHaveAttribute('aria-expanded', 'false')
    await expect(clearX).toHaveCount(0)

    // Active chips also show the X, and clicking it drops the whole recorte.
    await page.goto(`${campaign.baseURL}/campanha/municipios?region=Recôncavo`)
    await expect(page.getByRole('button', { name: 'Remover Território: Recôncavo' })).toBeVisible()
    await expect(clearX).toBeVisible()
    await clearX.click()
    await expect(page).toHaveURL(`${campaign.baseURL}/campanha/municipios`)

    // The save-recorte control anchors in the app top bar on mobile — absent
    // without a recorte; with one, the same naming popover saves and flips the
    // icon's accessible name to the rename contract (SC 2.5.3).
    const topBar = page.locator('[data-slot="campaign-mobile-top-bar"]')
    const headerSave = topBar.getByRole('button', { name: 'Salvar filtro', exact: true })
    await expect(headerSave).toHaveCount(0)
    await page.goto(`${campaign.baseURL}/campanha/municipios?region=Recôncavo`)
    await expect(headerSave).toBeVisible()
    await headerSave.click()
    await page.getByLabel('Nome do filtro').fill('Recorte B184')
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(
      topBar.getByRole('button', { name: 'Renomear o filtro salvo Recorte B184' }),
    ).toBeVisible()

    // Cards are edge-to-edge with one horizontal line between them and none
    // after the last one.
    const cards = page.locator('[data-view="mobile-cards"] article')
    await expect(cards.first()).toHaveCSS('border-top-width', '0px')
    await expect(cards.first()).toHaveCSS('border-left-width', '0px')
    await expect(cards.first()).toHaveCSS('border-bottom-width', '1px')
    await expect(cards.last()).toHaveCSS('border-bottom-width', '0px')

    // The desktop frame is untouched: back to a wide viewport the field has
    // its border again, the label is visible and the text "Limpar" returns.
    await page.setViewportSize({ width: 1280, height: 900 })
    await expect(page.getByText('Filtrar municípios', { exact: true })).toBeVisible()
    await expect(field).toHaveCSS('border-top-width', '1px')
    await expect(page.getByRole('button', { name: 'Limpar', exact: true })).toBeVisible()
  })
})

/**
 * B193 (2026-08-10): the mobile card is a dense composition — scenario bar
 * with the active marker, chips (classe/tendência/nível), three labelled
 * avatar groups — where every data point is its own bottom-sheet trigger
 * (edit-where-you-see), the priority município gets a right accent border,
 * and the "Última atualização" footer expands to reveal the last update card
 * (or becomes a direct register CTA when nothing was ever recorded).
 */
test.describe('Municípios — card denso mobile (B193)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('scenario bar opens the estimate sheet and reflects saved values', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora B193'),
    })
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(
      `${campaign.baseURL}/campanha/municipios?q=${encodeURIComponent(municipality.name)}`,
    )
    // `?q=` matches name PREFIXES ("Coribe" also returns "São Félix do
    // Coribe"), so the card is anchored on the municipality's own name link.
    const card = page
      .locator('[data-view="mobile-cards"] article')
      .filter({ has: page.getByRole('link', { name: municipality.name, exact: true }) })
      .first()
    await expect(card).toBeVisible()

    await card.getByRole('button', { name: /Editar votos estimados/ }).click()
    const drawer = page.getByRole('dialog', { name: 'Editar votos estimados' })
    await expect(drawer).toBeVisible()

    await drawer.getByLabel('Pessimista', { exact: true }).fill('7500')
    await drawer.getByLabel('Média', { exact: true }).fill('8000')
    await drawer.getByLabel('Otimista', { exact: true }).fill('10000')
    // The autosave announces "Salvando…" through the trigger's own live region
    // (next to the button, outside the drawer); closing flushes the save.
    await drawer.getByRole('button', { name: 'Fechar' }).click()
    await expect(drawer).toBeHidden()

    // The strip is the live autosave value: the card shows all three
    // scenarios after the save echoed back.
    await expect(card.getByText('7.500')).toBeVisible()
    await expect(card.getByText('8.000')).toBeVisible()
    await expect(card.getByText('10.000')).toBeVisible()
    await expect(page).toHaveURL(
      `${campaign.baseURL}/campanha/municipios?q=${encodeURIComponent(municipality.name)}`,
    )
  })

  test('the Nível chip (label included) opens the level sheet', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora B193 Nível'),
    })
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(
      `${campaign.baseURL}/campanha/municipios?q=${encodeURIComponent(municipality.name)}`,
    )
    // `?q=` matches name PREFIXES ("Coribe" also returns "São Félix do
    // Coribe"), so the card is anchored on the municipality's own name link.
    const card = page
      .locator('[data-view="mobile-cards"] article')
      .filter({ has: page.getByRole('link', { name: municipality.name, exact: true }) })
      .first()
    await expect(card).toBeVisible()

    await card.getByText('Nível', { exact: true }).click()
    const drawer = page.getByRole('dialog', { name: 'Registrar nível de envolvimento' })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText(municipality.name, { exact: true })).toBeVisible()
    await expect(page).toHaveURL(
      `${campaign.baseURL}/campanha/municipios?q=${encodeURIComponent(municipality.name)}`,
    )
  })

  test('priority município gets the right accent border (B193)', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora B193 Prio'),
    })
    const municipality = await fixtures.claimMunicipality()
    await fixtures.payload.update({
      collection: 'municipality',
      id: municipality.id,
      data: { priority: 'alta' },
      depth: 0,
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(
      `${campaign.baseURL}/campanha/municipios?q=${encodeURIComponent(municipality.name)}`,
    )
    // `?q=` matches name PREFIXES ("Coribe" also returns "São Félix do
    // Coribe"), so the card is anchored on the municipality's own name link.
    const card = page
      .locator('[data-view="mobile-cards"] article')
      .filter({ has: page.getByRole('link', { name: municipality.name, exact: true }) })
      .first()
    await expect(card).toBeVisible()

    await expect(card).toHaveCSS('border-right-width', '6px')
    // The accent color is a token contract, not a literal: assert the utility
    // class that paints it (`border-r-primary`) instead of the resolved color.
    await expect(card).toHaveClass(/border-r-primary/)
  })

  test('footer expands to the last update card and offers register; empty footer is a direct CTA', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora B193 Upd'),
    })
    const withUpdate = await fixtures.claimMunicipality()
    await fixtures.payload.create({
      collection: 'municipalityUpdate',
      data: {
        municipality: withUpdate.id,
        author: coordinator.id,
        polarity: 'boa',
        body: `Fato de campo B193 em ${withUpdate.name}`,
      },
      depth: 0,
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(
      `${campaign.baseURL}/campanha/municipios?q=${encodeURIComponent(withUpdate.name)}`,
    )
    // `?q=` matches name prefixes — anchor on the municipality's own name link.
    const card = page
      .locator('[data-view="mobile-cards"] article')
      .filter({ has: page.getByRole('link', { name: withUpdate.name, exact: true }) })
      .first()
    await expect(card).toBeVisible()

    // The footer button expands the card bottom and reveals the last update
    // card (no surface change) plus the register CTA.
    const footer = card.getByRole('button', { name: /Última atualização/ })
    await expect(footer).toHaveAttribute('aria-expanded', 'false')
    await footer.click()
    await expect(footer).toHaveAttribute('aria-expanded', 'true')
    await expect(card.getByText(`Fato de campo B193 em ${withUpdate.name}`)).toBeVisible()
    await expect(card.getByText('Boa', { exact: true })).toBeVisible()

    const registerCta = card.getByRole('button', { name: /Registrar atualização em/ })
    await registerCta.click()
    const drawer = page.getByRole('dialog', { name: 'Registrar atualização' })
    await expect(drawer).toBeVisible()
    await expect(drawer.getByText(withUpdate.name, { exact: true })).toBeVisible()
    await drawer.getByRole('button', { name: 'Cancelar' }).click()
    await expect(drawer).toBeHidden()

    // A município with no update at all has no expandable footer: the footer
    // IS the register CTA, without chevron or expansion.
    const empty = await fixtures.claimMunicipality()
    await page.goto(`${campaign.baseURL}/campanha/municipios?q=${encodeURIComponent(empty.name)}`)
    const emptyCard = page
      .locator('[data-view="mobile-cards"] article')
      .filter({ has: page.getByRole('link', { name: empty.name, exact: true }) })
      .first()
    await expect(emptyCard).toBeVisible()
    await expect(emptyCard.getByRole('button', { name: /Última atualização/ })).toHaveCount(0)
    const emptyCta = emptyCard.getByRole('button', { name: /Registrar atualização em/ })
    await emptyCta.click()
    await expect(page.getByRole('dialog', { name: 'Registrar atualização' })).toBeVisible()
  })
})

/**
 * B126: FAB quick-actions overlay — no persistent drawer; opens on demand.
 */
test.describe('Municípios — FAB ações rápidas mobile (B126)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test('FAB on load, overlay opens with search and actions, closes cleanly', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenador FAB'),
    })
    const municipality = await fixtures.claimMunicipality()

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(
      `${campaign.baseURL}/campanha/municipios?q=${encodeURIComponent(municipality.name)}`,
    )
    await expect(campaignPageChrome(page, 'Municípios')).toBeVisible()

    const fab = page.getByRole('button', { name: 'Ações rápidas' })
    await expect(fab).toBeVisible()
    await expect(page.getByLabel('Buscar na campanha')).toHaveCount(0)

    await fab.click()
    const overlay = page.locator('#CampaignQuickActionsOverlay')
    await expect(overlay).toBeVisible()

    const search = overlay.getByLabel('Buscar na campanha')
    await expect(search).toBeVisible()
    await expect(search).toHaveAttribute('placeholder', 'Município, liderança, atividade…')

    const firstAction = overlay.getByRole('link', { name: 'Ajustar votos' })
    await expect(firstAction).toBeVisible()
    const actionBox = await firstAction.boundingBox()
    const searchBox = await search.boundingBox()
    expect(actionBox).toBeTruthy()
    expect(searchBox).toBeTruthy()
    expect(actionBox!.y).toBeLessThan(searchBox!.y)

    await page.keyboard.press('Escape')
    await expect(overlay).toBeHidden()
    await expect(fab).toBeVisible()

    const scrollport = page.locator('[data-slot="campaign-content-scroll"]')
    await scrollport.evaluate((el) => {
      el.scrollTop = 80
      el.dispatchEvent(new Event('scroll'))
    })
    await expect(page.getByLabel('Buscar na campanha')).toHaveCount(0)
  })
})

/**
 * B126: overlay search focus retracts actions; current entity excluded from suggest.
 */
test.describe('Municípios — FAB overlay polish (B126)', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  const staffActionLabels = [
    'Ajustar votos',
    'Registrar atualização',
    'Mudar tendência',
    'Atualizar liderança',
    'Registrar pedido',
    'Ver esquecidos',
  ] as const

  test('overlay actions use a 3×2 grid at mobile width (B136)', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenador B136'),
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/municipios`)
    await expect(campaignPageChrome(page, 'Municípios')).toBeVisible()

    await page.getByRole('button', { name: 'Ações rápidas' }).click()
    const overlay = page.locator('#CampaignQuickActionsOverlay')
    await expect(overlay).toBeVisible()
    // The Drawer slides in over ~450ms (`duration-450`); `toBeVisible` fires
    // mid-flight, so measuring right away reads items at different slide
    // offsets and the 3×2 grouping falls apart. Wait for the entrance
    // animation to settle before collecting geometry.
    await overlay.evaluate(async (el) => {
      await Promise.all(el.getAnimations().map((animation) => animation.finished))
    })

    const actionsRegion = overlay.getByLabel('Ações rápidas')
    await expect(actionsRegion.locator('ul[data-layout="grid-3"]')).toBeVisible()
    for (const label of staffActionLabels) {
      await expect(
        actionsRegion
          .getByRole('link', { name: label, exact: true })
          .or(actionsRegion.getByRole('button', { name: label, exact: true })),
      ).toBeVisible()
    }

    const boxes = await collectActionBoundingBoxes(actionsRegion, staffActionLabels)
    assertThreeColumnActionGrid(boxes, 2)
  })

  test('overlay labels readable and search focus hides action strip', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenador B126'),
    })
    // The suggest region only renders with curated hits for unrestricted
    // roles (B68), so pin one `alta` municipality — deterministic in any
    // environment, not only where the projection was imported (OPS29).
    const municipality = await fixtures.claimMunicipality()
    await fixtures.payload.update({
      collection: 'municipality',
      id: municipality.id,
      data: { priority: 'alta' },
      depth: 0,
    })
    fixtures.touchMunicipality(municipality.id)

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/municipios`)
    await expect(campaignPageChrome(page, 'Municípios')).toBeVisible()

    await page.getByRole('button', { name: 'Ações rápidas' }).click()
    const overlay = page.locator('#CampaignQuickActionsOverlay')
    await expect(overlay).toBeVisible()
    // The Drawer/Dialog slides in (~450ms); `toBeVisible` fires mid-flight and
    // focusing the input during the entrance animation can drop the focus
    // (and with it the suggest POST). Same settle wait as the B136 sibling.
    await overlay.evaluate(async (el) => {
      await Promise.all(el.getAnimations().map((animation) => animation.finished))
    })

    const registerSignal = overlay.getByRole('link', { name: 'Registrar atualização' })
    await expect(registerSignal).toBeVisible()

    const search = overlay.getByLabel('Buscar na campanha')
    const suggestResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/campanha/home-search') &&
        resp.request().method() === 'POST' &&
        resp.request().postDataJSON()?.mode === 'suggest',
    )
    await search.focus()
    await suggestResponse
    await expect(overlay.getByRole('link', { name: 'Registrar atualização' })).toBeHidden()

    // Overlay scopes search suggest — list page has no E11 SuggestionsPanel.
    await expect(overlay.getByRole('region', { name: 'Sugestões' })).toBeVisible()
  })

  test('overlay search without curated suggestions shows the honest empty state (OPS29)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    // Advisor with no administered municipality: the suggest scope is the
    // portfolio (empty), so the empty state is deterministic even if a
    // parallel worker pins an `alta` municipality (B126 sibling) — the
    // unrestricted coordinator case stays covered by the unit shell tests.
    const advisor = await fixtures.createCampaignUser('advisor', {
      name: fixtures.value('Assessor OPS29'),
    })

    await campaign.login(page, advisor.email!, advisor.password)
    await page.goto(`${campaign.baseURL}/campanha/municipios`)
    await expect(campaignPageChrome(page, 'Municípios')).toBeVisible()

    await page.getByRole('button', { name: 'Ações rápidas' }).click()
    const overlay = page.locator('#CampaignQuickActionsOverlay')
    await expect(overlay).toBeVisible()

    const search = overlay.getByLabel('Buscar na campanha')
    const suggestResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/campanha/home-search') &&
        resp.request().method() === 'POST' &&
        resp.request().postDataJSON()?.mode === 'suggest',
    )
    await search.focus()
    await suggestResponse

    // The advisor has no portfolio yet (OPS29) — the suggest region must say
    // so instead of rendering blank.
    const results = overlay.getByRole('region', { name: 'Resultados da busca' })
    await expect(results).toContainText('Nenhuma sugestão ainda', { timeout: 10000 })
    await expect(overlay.getByRole('region', { name: 'Sugestões' })).toHaveCount(0)
  })
})
