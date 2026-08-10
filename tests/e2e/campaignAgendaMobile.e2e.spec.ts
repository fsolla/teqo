import type { CDPSession, Locator, Page } from '@playwright/test'

import { formatBahiaCivilDate, parseBahiaDateTimeInput } from '../../src/lib/campaignTime.js'
import { hookFilledCreateData } from '../../src/utilities/hookFilledData.js'
import {
  campaignPageChrome,
  expect,
  test,
  type CampaignE2EFixture,
} from './fixtures/campaignE2EFixtures.js'
import {
  civilDatePlusDays,
  dayLabelFor,
  ptBrMonthNames,
  weekdayOf,
} from './helpers/agendaPeriodLabels.js'

const mobileHeaderTitle = (page: Page): Locator =>
  page.locator('[data-slot="campaign-mobile-top-bar"] [data-slot="campaign-page-chrome-title"]')

/**
 * C95 — troca a vista para Mês pelo seletor do header (menu no popover).
 * Compartilhado pelos testes que navegam o mês com swipe ou teclado.
 */
const openMonthView = async (page: Page) => {
  const viewSelector = page
    .getByRole('button', { name: /Modo de visualização/ })
    .filter({ visible: true })
  await viewSelector.click()
  await page.getByRole('menuitemradio', { name: 'Mês', exact: true }).click()
}

/**
 * Horizontal swipe via the CDP touch pipeline (the same input path a real
 * device takes — the only way to exercise touch gestures in Playwright).
 * The swipe stays at the vertical middle of the calendar, clear of fixture
 * events (which sit at 10:00).
 *
 * The 5 moves are paced (~25ms apart, ~125ms total): a burst without gaps is
 * classified by Chromium's gesture recognizer as a FLICK, and a dominant
 * horizontal flick is a browser navigation gesture (back/forward history),
 * not a page drag — intermittently it took the "back to today" swipe to
 * `/campanha`. Paced, it stays a drag the agenda consumes via its
 * non-passive touchmove preventDefault, while still finishing far below
 * FullCalendar's 650ms long-press (which would start a reschedule).
 */
const touchSwipe = async (
  cdp: CDPSession,
  box: { x: number; y: number; width: number; height: number },
  fromRatio: number,
  toRatio: number,
) => {
  const y = Math.round(box.y + box.height * 0.5)
  const x0 = Math.round(box.x + box.width * fromRatio)
  const x1 = Math.round(box.x + box.width * toRatio)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] })
  for (let i = 1; i <= 5; i += 1) {
    const x = Math.round(x0 + ((x1 - x0) * i) / 5)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] })
    await new Promise((resolve) => setTimeout(resolve, 25))
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

/**
 * C110 — like `touchSwipe`, but pauses mid-gesture (after the 12px claim) for
 * `inspect` to observe the live preview before the release decides.
 */
const touchDragWithInspection = async (
  cdp: CDPSession,
  box: { x: number; y: number; width: number; height: number },
  fromRatio: number,
  toRatio: number,
  inspect: () => Promise<void>,
) => {
  const y = Math.round(box.y + box.height * 0.5)
  const x0 = Math.round(box.x + box.width * fromRatio)
  const x1 = Math.round(box.x + box.width * toRatio)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y }] })
  for (let i = 1; i <= 5; i += 1) {
    const x = Math.round(x0 + ((x1 - x0) * i) / 5)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] })
    await new Promise((resolve) => setTimeout(resolve, 40))
    if (i === 2) await inspect()
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

const agendaSwipePreview = (page: Page) => page.locator('.activity-agenda-swipe-preview')

const tapAt = async (cdp: CDPSession, x: number, y: number) => {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

const seedTodayActivity = async (campaign: CampaignE2EFixture, page: Page): Promise<string> => {
  const { fixtures } = campaign
  const coordinator = await fixtures.createCampaignUser('coordinator')
  const municipality = await fixtures.claimMunicipality()
  const civilDate = formatBahiaCivilDate(new Date())
  const startAt = parseBahiaDateTimeInput(`${civilDate}T10:00`)
  if (!startAt) throw new Error('Falha ao montar horário da fixture de agenda.')

  await fixtures.payload.create({
    collection: 'activity',
    data: hookFilledCreateData<'activity'>({
      title: fixtures.value('Compromisso mobile nativo'),
      tags: ['Comício'],
      status: 'confirmado',
      startAt,
      municipality: municipality.id,
    }),
    depth: 0,
  })
  await campaign.login(page, coordinator.email!, coordinator.password)
  return civilDate
}

test.describe('C101 — agenda mobile com cara de app nativo', () => {
  test.setTimeout(90_000)

  test('toolbar some, o título mostra o período e tap volta ao hoje', async ({
    campaign,
    page,
  }) => {
    const civilDate = await seedTodayActivity(campaign, page)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${campaign.baseURL}/campanha/agenda`)
    const cdp = await page.context().newCDPSession(page)

    // C101 — o título do FullCalendar e os botões "< > Hoje" somem no mobile:
    // o header do app mostra o contexto do período no lugar.
    const todayLabel = dayLabelFor(civilDate)
    await expect(campaignPageChrome(page, todayLabel)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Hoje', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Dia Anterior' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Próximo Dia' })).toHaveCount(0)

    // C101-ux — o tap no título tem affordance visual: o glyph (aria-hidden)
    // sinaliza o controle sem depender do tooltip hover-only.
    await expect(mobileHeaderTitle(page).locator('svg')).toBeVisible()

    // Navegação por arrasto: esquerda → dia seguinte; direita → volta. O
    // swipe direito começa longe da borda esquerda (x=0.4): um gesto que
    // nasça na borda é do Chrome (histórico), não da agenda.
    // `.first()`: FC mantém grids de vista antigos no DOM durante transições.
    const agendaBox = await page.locator('.activity-agenda').first().boundingBox()
    if (!agendaBox) throw new Error('Calendário não expôs área para o gesto de navegação.')
    const nextCivil = civilDatePlusDays(civilDate, 1)
    await touchSwipe(cdp, agendaBox, 0.8, 0.2)
    await expect(campaignPageChrome(page, dayLabelFor(nextCivil))).toBeVisible({ timeout: 15_000 })
    await touchSwipe(cdp, agendaBox, 0.4, 0.85)
    await expect(campaignPageChrome(page, todayLabel)).toBeVisible({ timeout: 15_000 })

    // O swipe não abre o inline create (dia tem uma coluna só: o hit do FC
    // nunca sai do slot inicial e o dateClick precisa ser engolido).
    await expect(page.getByRole('dialog')).toHaveCount(0)

    // Tap no título do header volta ao hoje (o "Hoje" da toolbar não existe
    // mais no mobile). Sai primeiro do hoje para o tap ter efeito.
    await touchSwipe(cdp, agendaBox, 0.8, 0.2)
    await expect(campaignPageChrome(page, dayLabelFor(nextCivil))).toBeVisible({
      timeout: 15_000,
    })
    const titleBox = await mobileHeaderTitle(page).boundingBox()
    if (!titleBox) throw new Error('Título do header não expôs área de toque.')
    await tapAt(
      cdp,
      Math.round(titleBox.x + titleBox.width / 2),
      Math.round(titleBox.y + titleBox.height / 2),
    )
    await expect(campaignPageChrome(page, todayLabel)).toBeVisible({ timeout: 15_000 })

    // Contexto por vista: mês → nome do mês; swipe no mês → mês seguinte;
    // lista → "Agenda".
    await openMonthView(page)
    const monthIndex = Number(civilDate.slice(5, 7)) - 1
    await expect(campaignPageChrome(page, ptBrMonthNames[monthIndex] ?? '')).toBeVisible({
      timeout: 15_000,
    })
    await touchSwipe(cdp, agendaBox, 0.8, 0.2)
    await expect(campaignPageChrome(page, ptBrMonthNames[(monthIndex + 1) % 12] ?? '')).toBeVisible(
      { timeout: 15_000 },
    )
    const viewSelector = page
      .getByRole('button', { name: /Modo de visualização/ })
      .filter({ visible: true })
    await viewSelector.click()
    await page.getByRole('menuitemradio', { name: 'Lista', exact: true }).click()
    await expect(campaignPageChrome(page, 'Agenda')).toBeVisible({ timeout: 15_000 })

    // O strip edge-to-edge não pode criar overflow horizontal.
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true)
  })

  test('visão de dia abre na hora atual e o cabeçalho do dia fica fixo ao rolar', async ({
    campaign,
    page,
  }) => {
    const civilDate = await seedTodayActivity(campaign, page)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${campaign.baseURL}/campanha/agenda`)

    const dayLabel = dayLabelFor(civilDate)
    await expect(campaignPageChrome(page, dayLabel)).toBeVisible({ timeout: 15_000 })

    // C101 — o grid de dia vira um scroller próprio (height fixa no mobile):
    // abre ancorado em 08:00 ("hoje é fixa em 08:00")...
    // `.first()`: FC mantém grids de vista antigos no DOM durante transições.
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const scroller = [
              ...document.querySelector('.activity-agenda')!.querySelectorAll('*'),
            ].find((el) => {
              const style = getComputedStyle(el)
              return (
                (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
                el.scrollHeight > el.clientHeight &&
                el.querySelector('[role="rowheader"]')
              )
            })
            return scroller ? scroller.scrollTop : null
          }),
        { timeout: 15_000 },
      )
      .toBeGreaterThan(0)

    // ...e o cabeçalho "domingo 9" permanece no topo enquanto os horários
    // rolam.
    const colHeaderText = `${weekdayOf(civilDate)} ${Number(civilDate.slice(8, 10))}`
    const headerTop = () =>
      page.evaluate((text) => {
        const cell = [
          ...document.querySelector('.activity-agenda')!.querySelectorAll('[role="columnheader"]'),
        ].find((el) => el.textContent?.includes(text))
        return cell ? Math.round(cell.getBoundingClientRect().top) : null
      }, colHeaderText)

    const headerBefore = await headerTop()
    expect(headerBefore).not.toBeNull()

    const scrolledTo = await page.evaluate(() => {
      const scroller = [...document.querySelector('.activity-agenda')!.querySelectorAll('*')].find(
        (el) => {
          const style = getComputedStyle(el)
          return (
            (style.overflowY === 'auto' || style.overflowY === 'scroll') &&
            el.scrollHeight > el.clientHeight &&
            el.querySelector('[role="rowheader"]')
          )
        },
      )
      if (!scroller) return false
      scroller.scrollTop = 300
      return scroller.scrollTop
    })
    expect(scrolledTo).toBeGreaterThan(0)

    expect(await headerTop()).toBe(headerBefore)
  })

  test('o filtro vira strip edge-to-edge sem rótulo, colado na barra e no calendário', async ({
    campaign,
    page,
  }) => {
    const civilDate = await seedTodayActivity(campaign, page)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${campaign.baseURL}/campanha/agenda`)

    // Espera o layout mobile assentar (B167): o painel de chat renderiza
    // "desktop com chat aberto" no primeiro frame e rouba largura do
    // conteúdo até a medição do viewport — o título do período no header só
    // existe no layout mobile de verdade.
    await expect(campaignPageChrome(page, dayLabelFor(civilDate))).toBeVisible({
      timeout: 15_000,
    })

    // O rótulo some visualmente (sr-only: 0 de altura renderizada) mas
    // continua sendo o nome acessível do campo.
    const labelHeight = await page.evaluate(() => {
      const label = document.querySelector('.activity-agenda-filter-strip label')
      return label ? Math.round(label.getBoundingClientRect().height) : null
    })
    expect(labelHeight).not.toBeNull()
    expect(labelHeight!).toBeLessThanOrEqual(1)
    await expect(page.getByRole('combobox', { name: 'Filtrar agenda' })).toBeVisible()

    // Edge-to-edge, encostada na barra do app e no limite superior do
    // calendário, sticky enquanto navega. Tolerância de 1px para o
    // arredondamento de subpixel (precedente actionGridGeometry).
    const geometry = await page.evaluate(() => {
      const strip = document.querySelector('.activity-agenda-filter-strip')
      const topBar = document.querySelector('[data-slot="campaign-mobile-top-bar"]')
      const calendar = document.querySelector('.activity-agenda-shell')
      if (!strip || !topBar || !calendar) return null
      const stripRect = strip.getBoundingClientRect()
      return {
        stripTop: Math.round(stripRect.top),
        topBarBottom: Math.round(topBar.getBoundingClientRect().bottom),
        stripBottom: Math.round(stripRect.bottom),
        calendarTop: Math.round(calendar.getBoundingClientRect().top),
        stripWidth: Math.round(stripRect.width),
        windowWidth: window.innerWidth,
        sticky: getComputedStyle(strip).position,
      }
    })
    expect(geometry).not.toBeNull()
    expect(Math.abs(geometry!.stripTop - geometry!.topBarBottom)).toBeLessThanOrEqual(1)
    expect(Math.abs(geometry!.stripBottom - geometry!.calendarTop)).toBeLessThanOrEqual(1)
    expect(geometry!.stripWidth).toBe(geometry!.windowWidth)
    expect(geometry!.sticky).toBe('sticky')
  })

  test('teclado navega períodos com ArrowLeft/ArrowRight (região focável no mobile)', async ({
    campaign,
    page,
  }) => {
    const civilDate = await seedTodayActivity(campaign, page)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${campaign.baseURL}/campanha/agenda`)

    // Espera a medição mobile assentar (o label do período só existe com o
    // chrome mobile) antes de focar a região de teclado.
    const todayLabel = dayLabelFor(civilDate)
    await expect(campaignPageChrome(page, todayLabel)).toBeVisible({ timeout: 15_000 })

    // C101-ux — o container do calendário é a região de teclado do mobile
    // (a toolbar — e seus controles de teclado — sumiu): focável, com label
    // próprio, mesmo quando o período não tem eventos focáveis.
    const region = page.locator('.activity-agenda').first()
    await expect(region).toHaveAttribute('role', 'group')
    await expect(region).toHaveAttribute('aria-label', /setas mudam o período/)
    await region.focus()
    await expect(region).toBeFocused()

    // ArrowRight → período seguinte; ArrowLeft → período anterior (mesma
    // semântica do swipe: direita avança).
    const nextCivil = civilDatePlusDays(civilDate, 1)
    await page.keyboard.press('ArrowRight')
    await expect(campaignPageChrome(page, dayLabelFor(nextCivil))).toBeVisible({
      timeout: 15_000,
    })
    await page.keyboard.press('ArrowLeft')
    await expect(campaignPageChrome(page, todayLabel)).toBeVisible({ timeout: 15_000 })

    // O foco permanece na região após navegar (a restauração do foco quando
    // um nó do grid é destruído é pinada no unit do hook; aqui o contrato é
    // que o teclado continua na região depois da troca).
    await expect(region).toBeFocused()

    // Mês: setas navegam meses conforme a vista (mesmo contrato de foco).
    await openMonthView(page)
    const monthIndex = Number(civilDate.slice(5, 7)) - 1
    await expect(campaignPageChrome(page, ptBrMonthNames[monthIndex] ?? '')).toBeVisible({
      timeout: 15_000,
    })
    await region.focus()
    await page.keyboard.press('ArrowRight')
    await expect(campaignPageChrome(page, ptBrMonthNames[(monthIndex + 1) % 12] ?? '')).toBeVisible(
      { timeout: 15_000 },
    )
    await expect(region).toBeFocused()

    // Setas não criam inline create (o dateClick não dispara por teclado).
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})

test.describe('C110 — feedback visual do arrasto (reveal do adjacente + commit/snap-back)', () => {
  test.setTimeout(90_000)

  const seedTodayAndTomorrowActivities = async (
    campaign: CampaignE2EFixture,
    page: Page,
  ): Promise<{ today: string; tomorrow: string }> => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    const municipality = await fixtures.claimMunicipality()
    const today = formatBahiaCivilDate(new Date())
    const tomorrow = civilDatePlusDays(today, 1)

    for (const [civilDate, hour, title] of [
      [today, '10:00', 'Compromisso mobile hoje'],
      [tomorrow, '11:00', 'Compromisso mobile amanhã'],
    ] as const) {
      const startAt = parseBahiaDateTimeInput(`${civilDate}T${hour}`)
      if (!startAt) throw new Error('Falha ao montar horário da fixture de agenda.')
      await fixtures.payload.create({
        collection: 'activity',
        data: hookFilledCreateData<'activity'>({
          title,
          tags: ['Comício'],
          status: 'confirmado',
          startAt,
          municipality: municipality.id,
        }),
        depth: 0,
      })
    }

    await campaign.login(page, coordinator.email!, coordinator.password)
    return { today, tomorrow }
  }

  test('o grid segue o dedo, o período adjacente é revelado e o soltar decide (commit)', async ({
    campaign,
    page,
  }) => {
    const { today, tomorrow } = await seedTodayAndTomorrowActivities(campaign, page)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${campaign.baseURL}/campanha/agenda`)

    const todayLabel = dayLabelFor(today)
    await expect(campaignPageChrome(page, todayLabel)).toBeVisible({ timeout: 15_000 })

    const cdp = await page.context().newCDPSession(page)
    const agendaBox = await page.locator('.activity-agenda').first().boundingBox()
    if (!agendaBox) throw new Error('Calendário não expôs área para o gesto de navegação.')

    // A meio do gesto (após o claim de 12px): o grid acompanhou o dedo e o
    // painel do período adjacente está revelado na borda — chevron, rótulo do
    // período seguinte e os eventos do adjacente entrando conforme carregam.
    await touchDragWithInspection(cdp, agendaBox, 0.8, 0.3, async () => {
      const preview = agendaSwipePreview(page)
      await expect(preview).toBeVisible()
      await expect(preview.locator('svg.activity-agenda-swipe-chevron')).toBeVisible()
      await expect(preview.locator('.activity-agenda-swipe-label')).toHaveText(dayLabelFor(tomorrow))
      await expect
        .poll(
          () => preview.locator('.activity-agenda-swipe-event').count(),
          { timeout: 15_000 },
        )
        .toBeGreaterThan(0)
      // O grid deslocado: o transform vivo acompanhou o dedo.
      const transform = await page.evaluate(
        () => getComputedStyle(document.querySelector('.activity-agenda')!).transform,
      )
      expect(transform).not.toBe('none')
    })

    // Soltou acima do limiar: o período adjacente assume a tela e o preview some.
    await expect(campaignPageChrome(page, dayLabelFor(tomorrow))).toBeVisible({
      timeout: 15_000,
    })
    await expect(agendaSwipePreview(page)).toHaveCount(0)

    // O commit não abre o inline create.
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('soltar abaixo do limiar volta ao período atual (snap-back) sem navegar', async ({
    campaign,
    page,
  }) => {
    const { today } = await seedTodayAndTomorrowActivities(campaign, page)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${campaign.baseURL}/campanha/agenda`)

    const todayLabel = dayLabelFor(today)
    await expect(campaignPageChrome(page, todayLabel)).toBeVisible({ timeout: 15_000 })

    const cdp = await page.context().newCDPSession(page)
    const agendaBox = await page.locator('.activity-agenda').first().boundingBox()
    if (!agendaBox) throw new Error('Calendário não expôs área para o gesto de navegação.')

    // Arrasto de ~47px (0.9 → 0.78 em 390px): cruza o claim de 12px — o
    // preview abre — mas o soltar fica abaixo dos 48px do limiar.
    await touchDragWithInspection(cdp, agendaBox, 0.9, 0.78, async () => {
      const preview = agendaSwipePreview(page)
      await expect(preview).toBeVisible()
      await expect(preview.locator('.activity-agenda-swipe-label')).toHaveText(
        dayLabelFor(civilDatePlusDays(today, 1)),
      )
    })

    // Snap-back: o título não muda e o grid voltou ao repouso.
    await expect(campaignPageChrome(page, todayLabel)).toBeVisible({ timeout: 15_000 })
    await expect(agendaSwipePreview(page)).toHaveCount(0)
    await expect
      .poll(
        () =>
          page.evaluate(
            () => getComputedStyle(document.querySelector('.activity-agenda')!).transform,
          ),
        { timeout: 5_000 },
      )
      .toBe('none')

    // Nenhum inline create após o snap-back.
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
