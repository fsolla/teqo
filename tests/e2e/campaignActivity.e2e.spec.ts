import { formatBahiaCivilDate, parseBahiaDateTimeInput } from '../../src/lib/campaignTime.js'
import { hookFilledCreateData } from '../../src/utilities/hookFilledData.js'
import { campaignPageChrome, expect, test } from './fixtures/campaignE2EFixtures.js'
import { dayLabelFor, ptBrMonthNames } from './helpers/agendaPeriodLabels.js'

test.describe('Atividades — registro-fundação', () => {
  test.setTimeout(90_000)

  test('cria compromisso com demandas vinculadas e exibe os sinais no município', async ({
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
    await page.goto(`${campaign.baseURL}/campanha/atividades/nova`)

    await page.getByLabel('Título *').fill(activityTitle)
    await page.getByLabel('Início *').fill('2026-08-15T10:00')
    await page.getByLabel('Município *').selectOption(String(municipality.id))

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

    await page.getByRole('button', { name: 'Criar atividade' }).click()
    await expect(page).toHaveURL(/\/campanha\/atividades\/[^/?]+$/)
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

    await page.getByText(title, { exact: true }).click()
    await expect(page).toHaveURL(/\/campanha\/atividades\/[^/?]+(?:\?tab=overview)?$/)
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
    await page.goto(`${campaign.baseURL}/campanha/agenda?municipality=${municipality.id}`)

    const slotLocator = page.locator('[data-time="14:00:00"]:visible').last()
    // FullCalendar renders the time axis lazily and re-lays out on mount: the
    // grid first paints empty and re-renders (replacing its gridcells) when the
    // events land. Wait for the load to finish before interacting, or the
    // locator's element is replaced mid-action ("Element is not attached").
    await expect(page.getByText('Carregando compromissos…')).toHaveCount(0, { timeout: 15_000 })
    await expect(slotLocator).toBeVisible()
    // C104 — with the all-day lane enabled, the v7 classic theme paints the
    // all-day day fills over the time grid; real clicks still land on the slot
    // (FullCalendar resolves by data-time), but Playwright's actionability
    // check refuses them, so the click is forced on the slot lane itself.
    await slotLocator.scrollIntoViewIfNeeded()
    await slotLocator.click({ force: true })

    // The click no longer navigates: the inline overlay opens at the slot.
    await expect(page).toHaveURL(new RegExp('/campanha/agenda.*'))
    // C97 — the native datetime-local is gone; the trigger buttons show the
    // civil 24h label (slot = 14:00–14:30 Bahia, whatever the browser locale).
    const startTrigger = page.getByLabel('Início *')
    await expect(startTrigger).toBeVisible()
    const [startLabel, endLabel] = await Promise.all([
      startTrigger.textContent(),
      page.getByLabel('Término').textContent(),
    ])
    expect(startLabel).toMatch(/\d{2}\/\d{2}\/\d{4} às 14:00/)
    expect(endLabel).toMatch(/\d{2}\/\d{2}\/\d{4} às 14:30/)
    await expect(page.getByLabel('Município *')).toHaveValue(municipality.name)

    await page.getByLabel('Título *').fill(title)

    // The acceptance center: pick a different time through the shadcn picker
    // (calendar keeps the day; the step selects change hour/minute) and the
    // saved event lands at the chosen hour. Both fields move together so the
    // "Término posterior ao Início" validation stays satisfied. After
    // selectOption the focus sits in the native select, where Escape never
    // reaches Radix — re-clicking the selected day moves focus into the
    // calendar, then Escape closes only the picker (never the overlay).
    await startTrigger.click()
    // Scope to the live picker: a just-closed popover lingers in the DOM for
    // its 100 ms close animation, so a bare combobox query can match twice.
    const openPicker = () => page.locator('[data-slot="popover-content"][data-state="open"]').last()
    const hourSelect = openPicker().getByRole('combobox', { name: 'Hora' })
    await expect(hourSelect).toBeVisible()
    await hourSelect.selectOption('15')
    await expect(startTrigger).toHaveText(/\d{2}\/\d{2}\/\d{4} às 15:00/)
    await openPicker().locator('[data-selected-single="true"]').click()
    await page.keyboard.press('Escape')
    await page.getByLabel('Término').click()
    const endHourSelect = openPicker().getByRole('combobox', { name: 'Hora' })
    await expect(endHourSelect).toBeVisible()
    await endHourSelect.selectOption('16')
    // The minute keeps its prefill (30) — only the hour changed.
    await expect(page.getByLabel('Término')).toHaveText(/\d{2}\/\d{2}\/\d{4} às 16:30/)
    await openPicker().locator('[data-selected-single="true"]').click()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Salvar' }).click()

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
    await page.goto(`${campaign.baseURL}/campanha/agenda?municipality=${municipality.id}`)

    await expect(page.getByText('Carregando compromissos…')).toHaveCount(0, { timeout: 15_000 })
    const slotLocator = page.locator('[data-time="14:00:00"]:visible').last()
    await expect(slotLocator).toBeVisible()
    // C104 — with the all-day lane enabled, the v7 classic theme paints the
    // all-day day fills over the time grid; real clicks still land on the slot
    // (FullCalendar resolves by data-time), but Playwright's actionability
    // check refuses them, so the click is forced on the slot lane itself.
    await slotLocator.scrollIntoViewIfNeeded()
    await slotLocator.click({ force: true })

    const startTrigger = page.getByLabel('Início *')
    await expect(startTrigger).toBeVisible()
    await expect(startTrigger).toHaveText(/\d{2}\/\d{2}\/\d{4} às 14:00/)

    // C104 — toggling "Todo o dia" hides the times: both triggers show only
    // the civil date, and the picker no longer offers Hora/Minuto selects.
    await page.getByLabel('Todo o dia').click()
    await expect(startTrigger).toHaveText(/^\d{2}\/\d{2}\/\d{4}$/)
    await expect(page.getByLabel('Término')).toHaveText(/^\d{2}\/\d{2}\/\d{4}$/)
    await startTrigger.click()
    await expect(
      page.locator('[data-slot="popover-content"][data-state="open"]').last().getByRole('combobox'),
    ).toHaveCount(0)
    await page.keyboard.press('Escape')

    // Multi-day: the end picker lands on a later day of the same month.
    await page.getByLabel('Término').click()
    const endPicker = page.locator('[data-slot="popover-content"][data-state="open"]').last()
    await endPicker.getByRole('button', { name: /17 de agosto de 2026/ }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByLabel('Término')).toHaveText(/17\/08\/2026/)

    await page.getByLabel('Título *').fill(title)
    await page.getByRole('button', { name: 'Salvar' }).click()

    // The band lands without a time chip: the all-day event carries no
    // "14:00 – 14:30" text (the timed events render it; allDay:true does not).
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/\d{2}:\d{2} – \d{2}:\d{2}/)).toHaveCount(0)
    await expect(page).toHaveURL(new RegExp('/campanha/agenda.*'))

    // The detail page preserves the all-day choice: date-only labels.
    await page.getByText(title, { exact: true }).first().click()
    await expect(page).toHaveURL(/\/campanha\/atividades\/[^/?]+$/)
    await expect(page.getByText(/^\d{2}\/\d{2}\/\d{4}$/).first()).toBeVisible()
    await expect(page.getByText(/\d{2}\/\d{2}\/\d{4} às /)).toHaveCount(0)
  })

  test('"Mais detalhes" pré-preenche o formulário completo com o rascunho', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.claimMunicipality()
    const title = fixtures.value('Detalhes inline da agenda')

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/agenda?municipality=${municipality.id}`)

    const slotLocator = page.locator('[data-time="14:00:00"]:visible').last()
    // FullCalendar renders the time axis lazily and re-lays out on mount: the
    // grid first paints empty and re-renders (replacing its gridcells) when the
    // events land. Wait for the load to finish before interacting, or the
    // locator's element is replaced mid-action ("Element is not attached").
    await expect(page.getByText('Carregando compromissos…')).toHaveCount(0, { timeout: 15_000 })
    await expect(slotLocator).toBeVisible()
    // C104 — with the all-day lane enabled, the v7 classic theme paints the
    // all-day day fills over the time grid; real clicks still land on the slot
    // (FullCalendar resolves by data-time), but Playwright's actionability
    // check refuses them, so the click is forced on the slot lane itself.
    await slotLocator.scrollIntoViewIfNeeded()
    await slotLocator.click({ force: true })

    await expect(page.getByLabel('Título *')).toBeVisible()
    await page.getByLabel('Título *').fill(title)
    await page.getByRole('link', { name: 'Mais detalhes' }).click()

    await expect(page).toHaveURL(/\/campanha\/atividades\/nova\?startAt=/)
    await expect(page.getByLabel('Título *')).toHaveValue(title)
    await expect(page.getByLabel('Município *')).toHaveValue(String(municipality.id))
    const [startValue, endValue] = await Promise.all([
      page.getByLabel('Início *').inputValue(),
      page.getByLabel('Término').inputValue(),
    ])
    const [startAt, endAt] = [startValue, endValue].map(parseBahiaDateTimeInput)
    expect(startAt).not.toBeNull()
    expect(endAt).not.toBeNull()
    if (!startAt || !endAt) throw new Error('O formulário não recebeu o intervalo do slot.')
    expect(new Date(endAt).getTime() - new Date(startAt).getTime()).toBe(1_800_000)
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

    // FullCalendar renders the grid lazily and re-lays out on mount: wait for
    // the load to finish before interacting (same pattern as the desktop test).
    await expect(page.getByText('Carregando compromissos…')).toHaveCount(0, { timeout: 15_000 })
    const slotLocator = page.locator('[data-time="14:00:00"]:visible').last()
    await expect(slotLocator).toBeVisible()
    // Click the time slot itself — C104's all-day lane sits above the timed
    // grid, so the old day-cell nth() offset no longer lands on the slot.
    // `force` bypasses the timed-row content overlay; the FullCalendar grid
    // still receives the click and resolves the 14:00 date from the position.
    await slotLocator.scrollIntoViewIfNeeded()
    await slotLocator.click({ force: true })

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

    // Date/time opens as a nested bottom sheet (no popover) with "Pronto".
    await page.getByLabel('Início *').click()
    const picker = page.getByRole('dialog', { name: /Início —/ })
    await expect(picker).toBeVisible()
    await expect(picker.getByRole('combobox', { name: 'Hora' })).toBeVisible()
    await picker.getByRole('button', { name: 'Pronto' }).click()
    await expect(picker).toBeHidden()

    await page.getByRole('button', { name: 'Salvar' }).click()
    await expect(page.getByText(title, { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('14:00 – 14:30', { exact: true })).toBeVisible()
    await expect(page).toHaveURL(new RegExp('/campanha/agenda.*'))
  })
})
