import {
  campaignPageChrome,
  expect,
  expectPostResponse,
  test,
} from './fixtures/campaignE2EFixtures.js'

import type { CampaignE2EOwnership } from './fixtures/campaignE2EFixtures.js'

/**
 * C139 — the campaign contacts entity page: staff CRUD on `/campanha/contatos`
 * (desktop table + create row, mobile cards + FAB/sheet) and the staff gate.
 *
 * The UI name schema forbids digits (`contactNameSchema`), so contacts CREATED
 * through the forms need a letters-only unique name: the fixture runID is a
 * hex UUID, and hex → [a-p] is a bijection that keeps the full 128-bit
 * uniqueness (API-created fixture contacts may keep digits).
 */
const lettersOnlyUnique = (runID: string): string =>
  runID
    .replaceAll('-', '')
    .replace(/[0-9a-f]/g, (hex) => String.fromCharCode(97 + parseInt(hex, 16)))

const uiName = (fixtures: CampaignE2EOwnership, prefix: string): string =>
  `${prefix} ${lettersOnlyUnique(fixtures.runID)}`

test.describe('Contatos — página da entidade Contact', () => {
  test('staff opens the contacts page and the omnibox narrows the recorte', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Contatos'),
    })
    const phone = fixtures.phone()
    const first = await fixtures.payload.create({
      collection: 'contact',
      data: {
        name: `Alpha ${fixtures.value('Busca')}`,
        phones: [{ value: phone }],
        state: 'BA',
        city: 'Salvador',
      },
      depth: 0,
    })
    const second = await fixtures.payload.create({
      collection: 'contact',
      data: { name: `Beta ${fixtures.value('Busca')}`, state: 'BA', city: 'Salvador' },
      depth: 0,
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha/contatos')

    await expect(page).toHaveURL(/\/campanha\/contatos$/)
    await expect(campaignPageChrome(page, 'Contatos')).toBeVisible()
    const firstRow = page.getByRole('row', { name: new RegExp(first.name as string) })
    await expect(firstRow).toBeVisible()
    await expect(page.getByRole('row', { name: new RegExp(second.name as string) })).toBeVisible()
    await expect(page.getByText(/^\d+ contatos?$/)).toBeVisible()

    // The row action links to WhatsApp with the primary phone (C139).
    await expect(
      firstRow.getByRole('link', { name: `Enviar WhatsApp para ${first.name}` }),
    ).toHaveAttribute('href', `https://wa.me/55${phone}`)

    // The omnibox narrows the recorte (canonical URL, chips mounted).
    const omnibox = page.getByRole('combobox', { name: 'Filtrar contatos' })
    await omnibox.fill(first.name as string)
    await omnibox.press('Enter')
    await expect(page).toHaveURL(/q=/)
    await expect(firstRow).toBeVisible()
    await expect(page.getByRole('row', { name: new RegExp(second.name as string) })).toBeHidden()
  })

  test('the desktop create row keeps typed values on error and lands a valid contact', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const contactName = uiName(fixtures, 'Contato Criado')
    const phone = fixtures.phone()

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha/contatos')

    await page.getByRole('button', { name: 'Novo contato' }).click()
    const createRow = page.locator('[data-view="contact-create-row"]')
    const nameInput = createRow.getByRole('textbox', { name: 'Nome do contato' })
    await expect(nameInput).toBeVisible()

    // Digits are not allowed by the name schema: the alert shows and the
    // typed value survives the failed submit (C139 — no React form reset).
    await nameInput.fill('Nome Invalido 123')
    await createRow.getByRole('button', { name: 'Salvar' }).click()
    await expect(createRow.getByRole('alert')).toContainText(
      'Use apenas letras, no máximo um espaço ou hífen entre termos',
    )
    await expect(nameInput).toHaveValue('Nome Invalido 123')

    // Valid create lands the row and the write reaches the database.
    await nameInput.fill(contactName)
    await createRow.getByRole('textbox', { name: 'Telefone do contato' }).fill(phone)
    const persisted = expectPostResponse(page, '/campanha/contatos')
    await createRow.getByRole('button', { name: 'Salvar' }).click()
    await persisted
    await expect(page.getByRole('row', { name: new RegExp(contactName) })).toBeVisible()

    const stored = await fixtures.payload.find({
      collection: 'contact',
      where: { name: { equals: contactName } },
      depth: 0,
      pagination: false,
    })
    expect(stored.docs).toHaveLength(1)
    expect(stored.docs[0]!.phones?.[0]?.value).toBe(phone)
  })

  test('a duplicate name shows the safe conflict message in the create row', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const existing = await fixtures.payload.create({
      collection: 'contact',
      data: { name: uiName(fixtures, 'Conflito Existente'), state: 'BA' },
      depth: 0,
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha/contatos')

    await page.getByRole('button', { name: 'Novo contato' }).click()
    const createRow = page.locator('[data-view="contact-create-row"]')
    const nameInput = createRow.getByRole('textbox', { name: 'Nome do contato' })
    await nameInput.fill(existing.name as string)
    await createRow.getByRole('button', { name: 'Salvar' }).click()
    await expect(createRow.getByRole('alert')).toContainText(
      'Já existe um contato com este nome — confira a lista antes de salvar.',
    )
    await expect(nameInput).toHaveValue(existing.name as string)
  })

  test('leader cannot open the contacts page', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const phone = fixtures.phone()
    const leader = await fixtures.createCampaignUser('leader', {
      name: fixtures.value('Liderança Contatos Sem Acesso'),
      username: phone,
    })

    await campaign.login(page, phone, leader.password)
    await page.goto('/campanha/contatos')

    await expect(page).toHaveURL(/\/campanha\/meus-contatos/)
    await expect(page.getByRole('heading', { name: 'Meus contatos' })).toBeVisible()
  })

  test('mobile: the FAB opens the create sheet and a valid save lands a card', async ({
    campaign,
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const contactName = uiName(fixtures, 'Contato Sheet')
    const phone = fixtures.phone()

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha/contatos')

    // The FAB is the mobile-only create entry point (the toolbar row is
    // `md:hidden`); it floats above the bottom nav (C139 z-index fix).
    await page.getByRole('button', { name: 'Novo contato' }).click()
    const dialog = page.getByRole('dialog', { name: 'Novo contato' })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('textbox', { name: 'Nome *' }).fill(contactName)
    await dialog.getByRole('button', { name: 'Adicionar telefone' }).click()
    await dialog.getByRole('textbox', { name: 'Celular 1' }).fill(phone)

    const persisted = expectPostResponse(page, '/campanha/contatos')
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await persisted
    await expect(dialog).toBeHidden()

    const card = page.locator('[data-view="mobile-cards"] li').filter({ hasText: contactName })
    await expect(card).toBeVisible()
    await expect(card).toContainText('BA')

    const stored = await fixtures.payload.find({
      collection: 'contact',
      where: { name: { equals: contactName } },
      depth: 0,
      pagination: false,
    })
    expect(stored.docs).toHaveLength(1)
    expect(stored.docs[0]!.phones?.[0]?.value).toBe(phone)
    await expect(
      card.getByRole('link', { name: `Enviar WhatsApp para ${contactName}` }),
    ).toHaveAttribute('href', `https://wa.me/55${phone}`)
  })

  test('mobile: the edit sheet keeps values on conflict and saves the ficha atomically', async ({
    campaign,
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')

    const targetName = uiName(fixtures, 'Ficha Editada')
    const target = await fixtures.payload.create({
      collection: 'contact',
      data: {
        name: targetName,
        phones: [{ value: fixtures.phone() }],
        state: 'BA',
        city: 'Salvador',
      },
      depth: 0,
    })
    // The conflict target: a letters-only name that already exists.
    const conflictName = uiName(fixtures, 'Ficha Conflito')
    await fixtures.payload.create({
      collection: 'contact',
      data: { name: conflictName, state: 'BA' },
      depth: 0,
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto('/campanha/contatos')

    const omnibox = page.getByRole('combobox', { name: 'Filtrar contatos' })
    await omnibox.fill(targetName)
    await omnibox.press('Enter')

    await page.getByRole('button', { name: `Editar contato ${targetName}` }).click()
    const dialog = page.getByRole('dialog', { name: 'Editar contato' })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('textbox', { name: 'Nome *' })).toHaveValue(targetName)

    // A conflict (the typed name already exists) keeps the sheet open with
    // the typed value and a visible banner — no silent wipe (C139).
    await dialog.getByRole('textbox', { name: 'Nome *' }).fill(conflictName)
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await expect(dialog.getByRole('alert')).toContainText(
      'Já existe um contato com este nome — confira a lista antes de salvar.',
    )
    await expect(dialog.getByRole('textbox', { name: 'Nome *' })).toHaveValue(conflictName)

    // Reverting the name and editing the city writes the whole ficha in one
    // action: the card shows the new city and the database agrees.
    await dialog.getByRole('textbox', { name: 'Nome *' }).fill(targetName)
    await dialog.getByRole('textbox', { name: 'Cidade' }).fill('Feira de Santana')
    const persisted = expectPostResponse(page, '/campanha/contatos')
    await dialog.getByRole('button', { name: 'Salvar' }).click()
    await persisted
    await expect(dialog).toBeHidden()

    const card = page.locator('[data-view="mobile-cards"] li').filter({ hasText: targetName })
    await expect(card).toContainText('Feira de Santana · BA')

    const stored = await fixtures.payload.findByID({
      collection: 'contact',
      id: target.id,
      depth: 0,
    })
    expect(stored.city).toBe('Feira de Santana')
    expect(stored.name).toBe(targetName)
  })
})
