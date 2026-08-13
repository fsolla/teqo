import { formatBahiaCivilDate, parseBahiaDateTimeInput } from '../../src/lib/campaignTime.js'
import { hookFilledCreateData } from '../../src/utilities/hookFilledData.js'
import { campaignPageChrome, expect, test } from './fixtures/campaignE2EFixtures.js'
import { civilDatePlusDays, dayLabelFor, ptBrMonthNames } from './helpers/agendaPeriodLabels.js'

/**
 * Agenda prologue shared by every journey in this file: opens the agenda
 * filtered to one município, waits for the window load to land (FullCalendar
 * renders the grid lazily and re-lays out on mount — the grid first paints
 * empty and re-renders, replacing its gridcells, when the events land) and
 * clicks the 14:00 slot. `force` bypasses the C104 all-day lane, which paints
 * day fills over the time grid: real clicks still land on the slot
 * (FullCalendar resolves by data-time), but Playwright's actionability check
 * refuses them.
 */
const openAgendaSlot = async ({
  campaign,
  page,
  municipalityId,
}: {
  campaign: { baseURL: string }
  page: import('@playwright/test').Page
  municipalityId: number
}) => {
  await page.goto(`${campaign.baseURL}/campanha/agenda?municipality=${municipalityId}`)
  await expect(page.getByText('Carregando compromissos…')).toHaveCount(0, { timeout: 15_000 })
  const slotLocator = page.locator('[data-time="14:00:00"]:visible').last()
  await expect(slotLocator).toBeVisible()
  await slotLocator.scrollIntoViewIfNeeded()
  await slotLocator.click({ force: true })
}

test.describe('Atividades — registro-fundação', () => {
  test.setTimeout(90_000)

  test('cria compromisso com demandas vinculadas pelo overlay e exibe os sinais no município', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator', {
      name: fixtures.value('Coordenadora Geral'),
    })
    const password = coordinator.password
    const municipality = await fixtures.claimMunicipality()
    const activityTitle = fixtures.value('Giro territorial')
    const transportDemand = fixtures.value('Transporte para equipe')
    const materialDemand = fixtures.value('Material de rua')

    await campaign.login(page, coordinator.email!, password)
    // C123 — the agenda overlay is the only create surface; /nova is gone.
    await openAgendaSlot({ campaign, page, municipalityId: municipality.id })

    // The central modal (desktop) hosts every section of the old full form.
    const modal = page.getByRole('dialog', { name: 'Nova atividade' })
    await expect(modal).toBeVisible()
    await page.getByLabel('Título *').fill(activityTitle)
    // The municipality filter prefills the field; the times come from the slot.
    await expect(page.getByLabel('Município *')).toHaveValue(municipality.name)

    // C90 — the unified polymorphic selector replaces the old Contact
    // responsável + assessores/liderança fields.
    await expect(page.getByRole('button', { name: /Responsáveis: Nenhum/ })).toBeVisible()
    await expect(page.getByText('Assessores responsáveis')).toHaveCount(0)

    await page.getByRole('button', { name: 'Adicionar demanda' }).click()
    await page.getByLabel('Título da demanda 1').fill(transportDemand)
    await page.getByLabel('Tipo da demanda 1').selectOption('transporte')
    await page.getByRole('button', { name: 'Adicionar demanda' }).click()
    await page.getByLabel('Título da demanda 2').fill(materialDemand)
    await page.getByLabel('Tipo da demanda 2').selectOption('material')

    await page.getByRole('button', { name: 'Salvar', exact: true }).click()

    // Save never navigates: the event lands in the calendar and the URL stays.
    await expect(page.getByText(activityTitle, { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page).toHaveURL(new RegExp('/campanha/agenda.*'))

    // Clicking the event opens the edit overlay; the detail stays reachable
    // through the overlay's own "Ver detalhes" link.
    await page.getByText(activityTitle, { exact: true }).first().click()
    const editModal = page.getByRole('dialog', { name: 'Editar atividade' })
    await expect(editModal).toBeVisible()
    await expect(editModal.getByLabel('Título *')).toBeVisible({ timeout: 30_000 })
    await editModal.getByRole('link', { name: 'Ver detalhes' }).click()
    await expect(page).toHaveURL(/\/campanha\/atividades\/[^/?]+(?:\?tab=overview)?$/, {
      timeout: 30_000,
    })
    await expect(campaignPageChrome(page, activityTitle)).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByRole('link', { name: transportDemand })).toBeVisible()
    await expect(page.getByRole('link', { name: materialDemand })).toBeVisible()

    await page.getByRole('link', { name: 'Adicionar demanda' }).click()
    await expect(page.locator('input[name="activityId"]')).toHaveValue(/\d+/)
    // `.first()`: transient RSC-pending duplication also copies the combobox
    // trigger (same strict-mode flake as cd469857; observed on loaded machines).
    await expect(page.getByLabel('Atividade relacionada').first()).toContainText(activityTitle)
    await expect(page.getByLabel('Município')).toHaveValue(String(municipality.id))

    await page.goto(`${campaign.baseURL}/campanha/municipios/${municipality.slug}?tab=updates`)
    // Unified C87 surface: body + polarity + urgent + adversary signal, no
    // legacy kind/signal-type navigation.
    await expect(page.getByLabel('Texto da atualização')).toBeVisible()
    await expect(page.getByLabel('Polaridade')).toBeVisible()
    await expect(page.getByLabel('Sinalizar como urgente')).toBeVisible()
    await expect(page.getByLabel('Sinalizar adversário')).toBeVisible()
    await expect(page.getByLabel('Tipo', { exact: true })).toHaveCount(0)
  })
})

test.describe('Agenda — calendário operacional', () => {
  test.setTimeout(90_000)

  test('abre a semana, combina filtros e navega para o detalhe', async ({ campaign, page }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.claimMunicipality()
    const title = fixtures.value('Comício na agenda')
    const civilDate = formatBahiaCivilDate(new Date())
    const startAt = parseBahiaDateTimeInput(`${civilDate}T10:00`)
    if (!startAt) throw new Error('Falha ao montar horário da fixture de agenda.')

    const activity = await fixtures.payload.create({
      collection: 'activity',
      data: hookFilledCreateData<'activity'>({
        title,
        tags: ['Comício'],
        status: 'confirmado',
        deputyPresent: true,
        startAt,
        municipality: municipality.id,
      }),
      depth: 0,
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/agenda`)

    await expect(campaignPageChrome(page, 'Agenda')).toBeVisible()
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 15_000 })
    // C95 — the four view-mode buttons moved out of the FullCalendar toolbar
    // into the header selector; the calendar toolbar keeps only prev/today/next.
    await expect(page.getByRole('tab', { name: /semana|mês|lista/i })).toHaveCount(0)
    const viewSelector = page.getByRole('button', { name: 'Modo de visualização: Semana' })
    await expect(viewSelector).toBeVisible()

    const eventLink = page.getByRole('link', { name: new RegExp(title) })
    const eventBox = await eventLink.boundingBox()
    if (!eventBox) throw new Error('O compromisso não expôs área arrastável.')
    await page.mouse.move(eventBox.x + eventBox.width / 2, eventBox.y + eventBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(eventBox.x + eventBox.width / 2, eventBox.y + eventBox.height / 2 + 60, {
      steps: 20,
    })
    await page.mouse.up()
    await expect(page.getByText('Horário atualizado.')).toBeVisible()
    await expect
      .poll(async () => {
        const persisted = await fixtures.payload.findByID({
          collection: 'activity',
          id: activity.id,
          depth: 0,
        })
        return persisted.startAt
      })
      .not.toBe(startAt)

    const omniboxInput = page.getByRole('combobox', { name: 'Filtrar agenda' })

    await omniboxInput.fill(municipality.name!)
    await page.getByRole('option', { name: municipality.name, exact: true }).click()

    await omniboxInput.fill('Comício')
    await page.getByRole('option', { name: 'Comício', exact: true }).click()

    await omniboxInput.fill('Deputado')
    await page.getByRole('option', { name: 'Deputado presente', exact: true }).click()
    await expect(page.locator('button[aria-label="Remover Deputado presente"]')).toBeVisible()

    await expect(page).toHaveURL(
      `${campaign.baseURL}/campanha/agenda?municipality=${municipality.id}&deputyPresent=1&tag=Com%C3%ADcio`,
      { timeout: 20_000 },
    )
    await expect(page.getByText(title, { exact: true })).toBeVisible()

    // B167: when the viewport shrinks to mobile, a chat that was open on the
    // desktop panel migrates to the open full-screen drawer — which would cover
    // the agenda. Close it first so this mobile-layout step is unobstructed.
    await page
      .getByRole('button', { name: 'Fechar', exact: true })
      .filter({ visible: true })
      .click()
    await page.setViewportSize({ width: 390, height: 844 })
    // C95 — the view-mode control lives in the app top bar on mobile too; the
    // narrow fallback (no `view` param) shows "Dia" after the resize.
    const mobileViewSelector = page
      .getByRole('button', { name: /Modo de visualização/ })
      .filter({ visible: true })
    await expect(mobileViewSelector).toHaveAttribute('aria-label', 'Modo de visualização: Dia')
    await mobileViewSelector.click()
    await page.getByRole('menuitemradio', { name: 'Lista', exact: true }).click()
    await expect(page).toHaveURL(/view=list/)
    await expect(page.getByText(title, { exact: true })).toBeVisible()

    // C95 — "Limpar" clears the recorte (filters), never the view mode.
    await page.getByRole('button', { name: 'Limpar', exact: true }).click()
    await expect(page).toHaveURL(`${campaign.baseURL}/campanha/agenda?view=list`)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)

    // C123 — clicking the event opens the edit overlay; the detail is reached
    // through the overlay's own link.
    await page.getByText(title, { exact: true }).click()
    const editModal = page.getByRole('dialog', { name: 'Editar atividade' })
    await expect(editModal).toBeVisible()
    await expect(editModal.getByLabel('Título *')).toBeVisible({ timeout: 30_000 })
    await editModal.getByRole('link', { name: 'Ver detalhes' }).click()
    await expect(page).toHaveURL(/\/campanha\/atividades\/[^/?]+(?:\?tab=overview)?$/, {
      timeout: 30_000,
    })
    await expect(campaignPageChrome(page, title)).toBeVisible()
  })

  test('cria compromisso inline no slot clicado, sem sair da agenda', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.claimMunicipality()
    const title = fixtures.value('Café inline na agenda')

    await campaign.login(page, coordinator.email!, coordinator.password)
    await openAgendaSlot({ campaign, page, municipalityId: municipality.id })

    // The click no longer navigates: the central modal opens with the slot's
    // date and the split controls (date trigger + inline hour/minute).
    await expect(page).toHaveURL(new RegExp('/campanha/agenda.*'))
    const startTrigger = page.getByLabel('Início *')
    await expect(startTrigger).toBeVisible()
    const [startLabel, endLabel] = await Promise.all([
      startTrigger.textContent(),
      page.getByRole('button', { name: 'Término', exact: true }).textContent(),
    ])
    expect(startLabel).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    expect(endLabel).toMatch(/\d{2}\/\d{2}\/\d{4}/)
    await expect(page.getByLabel('Município *')).toHaveValue(municipality.name)
    // C123 — the time selects are INLINE, visible without opening anything.
    await expect(page.getByLabel('Hora de Início')).toHaveValue('14')
    await expect(page.getByLabel('Minuto de Início')).toHaveValue('00')
    await expect(page.getByLabel('Hora de Término')).toHaveValue('14')
    await expect(page.getByLabel('Minuto de Término')).toHaveValue('30')

    await page.getByLabel('Título *').fill(title)

    // The acceptance center: pick a different time through the inline selects
    // and the saved event lands at the chosen hour. Both fields move together
    // so the "Término posterior ao Início" validation stays satisfied.
    await page.getByLabel('Hora de Início').selectOption('15')
    await expect(page.getByLabel('Hora de Início')).toHaveValue('15')
    await page.getByLabel('Hora de Término').selectOption('16')
    // The minute keeps its prefill (30) — only the hour changed.
    await expect(page.getByLabel('Minuto de Término')).toHaveValue('30')

    await page.getByRole('button', { name: 'Salvar', exact: true }).click()

    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 15_000 })
    // The saved event landed at the chosen times (24h chip, no meridiem).
    await expect(page.getByText('15:00 – 16:30', { exact: true })).toBeVisible()
    await expect(page).toHaveURL(new RegExp('/campanha/agenda.*'))
  })

  test('cria compromisso "Todo o dia" no slot, sem horário e com faixa no calendário (C104)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.claimMunicipality()
    const title = fixtures.value('Giro de dia inteiro')

    await campaign.login(page, coordinator.email!, coordinator.password)
    await openAgendaSlot({ campaign, page, municipalityId: municipality.id })

    const startTrigger = page.getByLabel('Início *')
    await expect(startTrigger).toBeVisible()
    await expect(startTrigger).toHaveText(/\d{2}\/\d{2}\/\d{4}/)
    // C123 — the time selects are inline; the slot window shows in them.
    await expect(page.getByLabel('Hora de Início')).toHaveValue('14')
    await expect(page.getByLabel('Minuto de Início')).toHaveValue('00')

    // C104 — toggling "Todo o dia" hides the times: both triggers show only
    // the civil date, the inline selects disappear and the picker no longer
    // offers Hora/Minuto selects.
    await page.getByLabel('Todo o dia').click()
    await expect(startTrigger).toHaveText(/^\d{2}\/\d{2}\/\d{4}$/)
    await expect(page.getByRole('button', { name: 'Término', exact: true })).toHaveText(
      /^\d{2}\/\d{2}\/\d{4}$/,
    )
    await expect(page.getByLabel('Hora de Início')).toHaveCount(0)
    await startTrigger.click()
    await expect(
      page.locator('[data-slot="popover-content"][data-state="open"]').last().getByRole('combobox'),
    ).toHaveCount(0)
    await page.keyboard.press('Escape')

    // Multi-day: the end picker lands on a later day, always +1 from today:
    // the target stays inside the picker's visible grid (an inside day, or
    // day 1 of the next month as an outside day) — no hardcoded dates (C134).
    // The button label is date-fns pt-BR "PPPP" ("sexta-feira, 14 de agosto
    // de 2026"): day without leading zero, month in lowercase — the string
    // name matcher is case-insensitive, the day number is not.
    const [endYear, endMonth, endDay] = civilDatePlusDays(
      formatBahiaCivilDate(new Date()),
      1,
    ).split('-')
    const endDayLabel = `${Number(endDay)} de ${ptBrMonthNames[Number(endMonth) - 1]} de ${endYear}`
    await page.getByRole('button', { name: 'Término', exact: true }).click()
    const endPicker = page.locator('[data-slot="popover-content"][data-state="open"]').last()
    await endPicker.getByRole('button', { name: endDayLabel }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Término', exact: true })).toHaveText(
      `${endDay}/${endMonth}/${endYear}`,
    )

    await page.getByLabel('Título *').fill(title)
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()

    // The band lands without a time chip: the all-day event carries no
    // "14:00 – 14:30" text (the timed events render it; allDay:true does not).
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/\d{2}:\d{2} – \d{2}:\d{2}/)).toHaveCount(0)
    await expect(page).toHaveURL(new RegExp('/campanha/agenda.*'))

    // C123 — clicking the event opens the edit overlay (no navigation); the
    // detail page stays reachable through the overlay link and preserves the
    // all-day choice: date-only labels.
    await page.getByText(title, { exact: true }).first().click()
    const editModal = page.getByRole('dialog', { name: 'Editar atividade' })
    await expect(editModal).toBeVisible()
    await expect(editModal.getByLabel('Título *')).toBeVisible({ timeout: 30_000 })
    await editModal.getByRole('link', { name: 'Ver detalhes' }).click()
    await expect(page).toHaveURL(/\/campanha\/atividades\/[^/?]+(?:\?tab=overview)?$/, {
      timeout: 30_000,
    })
    await expect(page.getByText(/^\d{2}\/\d{2}\/\d{4}$/).first()).toBeVisible()
    await expect(page.getByText(/\d{2}\/\d{2}\/\d{4} às /)).toHaveCount(0)
  })

  test('edita o compromisso pelo overlay no clique do evento, sem navegar (C123)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.claimMunicipality()
    const title = fixtures.value('Compromisso editado no overlay')
    const newLocality = fixtures.value('Nova sede do comitê')

    await campaign.login(page, coordinator.email!, coordinator.password)
    await openAgendaSlot({ campaign, page, municipalityId: municipality.id })

    // Create first through the same overlay.
    await expect(page.getByRole('dialog', { name: 'Nova atividade' })).toBeVisible()
    await page.getByLabel('Título *').fill(title)
    await page.getByRole('button', { name: 'Salvar', exact: true }).click()
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 15_000 })

    // Clicking the event opens the EDIT overlay prefilled with the saved
    // values — no navigation, no /editar page.
    await page.getByText(title, { exact: true }).first().click()
    const editModal = page.getByRole('dialog', { name: 'Editar atividade' })
    await expect(editModal).toBeVisible()
    await expect(page).toHaveURL(new RegExp('/campanha/agenda.*'))
    await expect(editModal.getByLabel('Título *')).toHaveValue(title, { timeout: 30_000 })
    await expect(editModal.getByLabel('Município *')).toHaveValue(municipality.name)
    await expect(editModal.getByLabel('Hora de Início')).toHaveValue('14')
    await expect(editModal.getByLabel('Minuto de Término')).toHaveValue('30')
    // C123 — the edit overlay carries the id the old /editar page lost (C14
    // regression): saving must actually persist.
    await editModal.getByLabel('Hora de Término').selectOption('15')
    await editModal.getByLabel('Local (opcional)').fill(newLocality)
    await editModal.getByRole('button', { name: 'Salvar alterações' }).click()

    // Save closes the overlay, never navigates; the calendar reflects the edit.
    await expect(page.getByRole('dialog', { name: 'Editar atividade' })).toBeHidden()
    await expect(page).toHaveURL(new RegExp('/campanha/agenda.*'))
    await expect(page.getByText('14:00 – 15:30', { exact: true })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('14:00 – 14:30', { exact: true })).toHaveCount(0)

    // The detail page reflects the persisted edit.
    await page.getByText(title, { exact: true }).first().click()
    const detailModal = page.getByRole('dialog', { name: 'Editar atividade' })
    await expect(detailModal.getByLabel('Título *')).toBeVisible({ timeout: 30_000 })
    await detailModal.getByRole('link', { name: 'Ver detalhes' }).click()
    await expect(page).toHaveURL(/\/campanha\/atividades\/[^/?]+(?:\?tab=overview)?$/, {
      timeout: 30_000,
    })
    // The location shows in the overview's own <dd> (exact); the chrome
    // subtitle carries "município · local" as one string.
    await expect(page.getByText(newLocality, { exact: true })).toBeVisible()
  })

  test('C95 — seletor de vista no header troca o modo, persiste e vence o resize', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/agenda`)

    const viewSelector = page
      .getByRole('button', { name: /Modo de visualização/ })
      .filter({ visible: true })
    await expect(viewSelector).toHaveAttribute('aria-label', 'Modo de visualização: Semana')

    // Desktop: switch to month; the URL gains `view=month` and the calendar
    // actually renders the month grid (not just the selector label). The
    // FullCalendar v7 classic theme hashes its view classes, so the stable
    // signal is the "Hoje" button's aria-label ("Este mês") plus a grid.
    // (`.first()`: FC keeps stale view grids in the DOM while transitioning.)
    await viewSelector.click()
    await page.getByRole('menuitemradio', { name: 'Mês', exact: true }).click()
    await expect(page).toHaveURL(`${campaign.baseURL}/campanha/agenda?view=month`)
    await expect(viewSelector).toHaveAttribute('aria-label', 'Modo de visualização: Mês')
    await expect(page.getByRole('button', { name: 'Este mês' })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('grid').first()).toBeVisible()

    // Persists across a reload (screen state lives beside the filter, on the URL).
    await page.reload()
    await expect(page).toHaveURL(`${campaign.baseURL}/campanha/agenda?view=month`)
    await expect(viewSelector).toHaveAttribute('aria-label', 'Modo de visualização: Mês')
    await expect(page.getByRole('button', { name: 'Este mês' })).toBeVisible({ timeout: 15_000 })

    // The explicit choice wins over the responsive narrow fallback: shrinking
    // the viewport must NOT push the calendar back to day/week.
    // B167: a chat that opened by itself on the desktop panel (RRP settle)
    // migrates to the full-screen mobile drawer and covers the page — close it
    // first so the top bar selector stays reachable in the a11y tree.
    await page
      .getByRole('button', { name: 'Fechar', exact: true })
      .filter({ visible: true })
      .click()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(viewSelector).toHaveAttribute('aria-label', 'Modo de visualização: Mês')
    // C101 — the mobile calendar drops the FullCalendar toolbar: the period
    // context lives in the app header instead (the current month's name).
    await expect(page.getByRole('button', { name: 'Este mês' })).toHaveCount(0, {
      timeout: 15_000,
    })
    const todayCivil = formatBahiaCivilDate(new Date())
    const monthLabel = ptBrMonthNames[Number(todayCivil.slice(5, 7)) - 1] ?? ''
    await expect(campaignPageChrome(page, monthLabel)).toBeVisible()

    // The mobile top bar selector still switches modes. The list view drops
    // the calendar grid and the header goes back to the plain "Agenda" (the
    // dates live in the list body).
    await viewSelector.click()
    await page.getByRole('menuitemradio', { name: 'Lista', exact: true }).click()
    await expect(page).toHaveURL(`${campaign.baseURL}/campanha/agenda?view=list`)
    await expect(viewSelector).toHaveAttribute('aria-label', 'Modo de visualização: Lista')
    await expect(page.getByRole('button', { name: 'Este mês' })).toHaveCount(0, {
      timeout: 15_000,
    })
    await expect(campaignPageChrome(page, 'Agenda')).toBeVisible()
    await expect(page.getByRole('grid')).toHaveCount(0, { timeout: 15_000 })

    // A navigation that drops the `view` param returns the calendar to the
    // responsive default instead of keeping an orphan view the selector no
    // longer claims (sidebar link / back-forward). Still on the 390px
    // viewport, so the narrow default is day (grid back, no toolbar: the
    // header shows today's period instead of a "Hoje" button).
    await page.goto(`${campaign.baseURL}/campanha/agenda`)
    await expect(viewSelector).toHaveAttribute('aria-label', 'Modo de visualização: Dia')
    const todayLabel = dayLabelFor(formatBahiaCivilDate(new Date()))
    await expect(campaignPageChrome(page, todayLabel)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Hoje', exact: true })).toHaveCount(0)
    await expect(page.getByRole('grid').first()).toBeVisible()
  })
})

test.describe('Atividades — agenda mobile (C103)', () => {
  test.setTimeout(90_000)
  test.use({ viewport: { width: 390, height: 844 } })

  test('cria compromisso inline pelo sheet do topo, rodapé fixo e seletor em bottom sheet', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.claimMunicipality()
    const title = fixtures.value('Café mobile na agenda')

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/agenda?municipality=${municipality.id}`)

    await openAgendaSlot({ campaign, page, municipalityId: municipality.id })

    // C103 — the sheet opens from the TOP, hugging the usable viewport edge.
    const sheet = page.getByRole('dialog', { name: /Nova atividade/ })
    await expect(sheet).toBeVisible()
    const sheetBox = await sheet.boundingBox()
    if (!sheetBox) throw new Error('O sheet não expôs bounding box.')
    expect(sheetBox.y).toBeLessThanOrEqual(1)

    // Label-less form: the placeholder gives context, the sr-only label keeps
    // the field addressable and accessible.
    await page.getByLabel('Título *').fill(title)
    await expect(page.getByLabel('Município *')).toHaveValue(municipality.name)

    // The footer is FIXED: "Salvar" is visible without scrolling on a small
    // viewport — the acceptance center of C103.
    await expect(page.getByRole('button', { name: 'Salvar' })).toBeVisible()

    // C123 — the time selects are INLINE in the sheet row (no nested sheet for
    // the time); the calendar still opens as a nested bottom sheet with
    // "Pronto" when the date trigger is tapped.
    await expect(page.getByLabel('Hora de Início')).toHaveValue('14')
    await expect(page.getByLabel('Minuto de Início')).toHaveValue('00')
    await page.getByRole('button', { name: 'Início *', exact: true }).click()
    const picker = page.getByRole('dialog', { name: /Início —/ })
    await expect(picker).toBeVisible()
    await expect(picker.getByRole('button', { name: 'Pronto' })).toBeVisible()
    await picker.getByRole('button', { name: 'Pronto' }).click()
    await expect(picker).toBeHidden()

    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('14:00 – 14:30', { exact: true })).toBeVisible()
    await expect(page).toHaveURL(new RegExp('/campanha/agenda.*'))
  })
})
