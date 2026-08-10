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
 * Horizontal swipe via the CDP touch pipeline (the same input path a real
 * device takes — the only way to exercise touch gestures in Playwright).
 * The swipe stays at the vertical middle of the calendar, clear of fixture
 * events (which sit at 10:00), and completes far below FullCalendar's 650ms
 * long-press, so it is a navigation, not a reschedule.
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
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
}

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
    const viewSelector = page
      .getByRole('button', { name: /Modo de visualização/ })
      .filter({ visible: true })
    await viewSelector.click()
    await page.getByRole('menuitemradio', { name: 'Mês', exact: true }).click()
    const monthIndex = Number(civilDate.slice(5, 7)) - 1
    await expect(campaignPageChrome(page, ptBrMonthNames[monthIndex] ?? '')).toBeVisible({
      timeout: 15_000,
    })
    await touchSwipe(cdp, agendaBox, 0.8, 0.2)
    await expect(campaignPageChrome(page, ptBrMonthNames[(monthIndex + 1) % 12] ?? '')).toBeVisible(
      { timeout: 15_000 },
    )
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
        const cell = [...document.querySelector('.activity-agenda')!.querySelectorAll('[role="columnheader"]')].find(
          (el) => el.textContent?.includes(text),
        )
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
})
