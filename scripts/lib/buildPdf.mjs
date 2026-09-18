/**
 * A4 print plumbing for the report builders (owner: the C163/C186/C187
 * pipeline). Chromium comes from `@playwright/test`; every document is one
 * `.sheet` per page with a `data-page` anchor, and no page may be cut by the
 * overflow — if it does not fit, the content budget is reduced, the layout is
 * never squeezed.
 *
 * Extracted from `build-dossie-solla-cidade.mjs` when the institution builder
 * (C187) became the third consumer, so there is one owner of the mm→px budget,
 * the launch and the emit.
 */

import { chromium } from '@playwright/test'
import { stat } from 'node:fs/promises'

const MM_TO_PX = 96 / 25.4
export const A4_HEIGHT_PX = Math.round(297 * MM_TO_PX)
export const A4_WIDTH_PX = Math.round(210 * MM_TO_PX)
/** Rounding slack of the mm→px conversion; content must still fit the page. */
export const PAGE_FIT_TOLERANCE_PX = 10
export const A4_PAGE_BUDGET_PX = A4_HEIGHT_PX + PAGE_FIT_TOLERANCE_PX

/**
 * Bounded re-renders of the one-page boletim while an `onBulletinOverflow`
 * callback keeps handing back a shorter document (C190). Each pass drops at
 * least one printed fact, so the cap only exists to fail closed on a callback
 * that stops shrinking.
 */
const MAX_BULLETIN_FIT_ATTEMPTS = 24

export const launchPdfBrowser = () => chromium.launch()

/**
 * Exact-size PNG of a screen-media document (C191 Instagram canvas). The
 * `.canvas` element is authored at the output size, so the viewport and the
 * clip are the same rectangle; no A4 constant is touched. Chromium PNGs are
 * already sRGB. Fails closed when the file exceeds `maxBytes` (default 8 MB).
 */
export const screenshotHtmlPng = async (
  browser,
  { html, width, height, outPath, maxBytes = 8 * 1024 * 1024 },
) => {
  const page = await browser.newPage()
  try {
    await page.setViewportSize({ width, height })
    await page.setContent(html, { waitUntil: 'load' })
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({
      path: outPath,
      type: 'png',
      clip: { x: 0, y: 0, width, height },
    })
  } finally {
    await page.close()
  }
  const { size } = await stat(outPath)
  if (size > maxBytes) {
    throw new Error(
      `PNG ${outPath} tem ${size} bytes (> ${maxBytes}); simplifique o gráfico ou reduza pontos.`,
    )
  }
  return { size }
}

/** Every `[data-page]` taller than the budget, in document order. */
const measurePageOverflows = (page, budgetPx = A4_PAGE_BUDGET_PX) =>
  page.evaluate(
    (max) =>
      [...document.querySelectorAll('[data-page]')]
        .map((element) => ({
          page: element.getAttribute('data-page'),
          height: element.scrollHeight,
        }))
        .filter((row) => row.height > max),
    budgetPx,
  )

/** Overflows of a single `[data-page="<anchor>"]` sheet (empty if absent). */
const measureSheetOverflows = (page, anchor, budgetPx = A4_PAGE_BUDGET_PX) =>
  page.evaluate(
    ({ max, selector }) =>
      [...document.querySelectorAll(selector)]
        .map((element) => ({
          page: element.getAttribute('data-page'),
          height: element.scrollHeight,
        }))
        .filter((row) => row.height > max),
    { max: budgetPx, selector: `[data-page="${anchor}"]` },
  )

const openPrintPage = async (browser, html) => {
  const page = await browser.newPage()
  await page.setViewportSize({ width: A4_WIDTH_PX, height: A4_HEIGHT_PX })
  await page.setContent(html, { waitUntil: 'load' })
  await page.emulateMedia({ media: 'print' })
  return page
}

/**
 * Rendered sheets with their real height and used height (bottom of the last
 * non-footer child) — the pack loop uses it to shrink overflowing sheets and
 * grow sheets with room, so a page is never half empty and never cut.
 */
export const measureDocumentSheets = async (browser, html) => {
  const page = await openPrintPage(browser, html)
  try {
    return await page.evaluate(() =>
      [...document.querySelectorAll('[data-page]')].map((sheet) => {
        const children = [...sheet.children].filter(
          (child) => !child.classList.contains('report-footer'),
        )
        const used = children.reduce(
          (max, child) =>
            Math.max(max, child.offsetTop + Math.max(child.offsetHeight, child.scrollHeight)),
          0,
        )
        return {
          page: sheet.getAttribute('data-page'),
          height: sheet.scrollHeight,
          used,
        }
      }),
    )
  } finally {
    await page.close()
  }
}

/**
 * Probe pass of the packed institution sections (C187 flowing sheets): each
 * `[data-pack-section]` sheet carries every unit (`[data-pack-unit]` with
 * `data-pack-layout` = tr|card); returns the fixed overhead and the row costs
 * (a card row is a pair, its cost the taller card) the packer consumes.
 *
 * The probe renders with `INSTITUTION_PROBE_CSS` (auto height, no gaps), so the
 * overhead is the true fixed content: headers, section titles, the era method
 * (tagged `data-pack-fixed="method"`, absent from continuation sheets) and the
 * footer. The packer adds the card-row gap back.
 */
const PACK_CARD_ROW_GAP_PX = Math.round(3 * MM_TO_PX)

export const measureDocumentPackProbe = async (browser, html) => {
  const page = await openPrintPage(browser, html)
  try {
    return await page.evaluate((cardRowGap) => {
      const buildRows = (units, gap) => {
        const rows = []
        for (let index = 0; index < units.length; index += 1) {
          const unit = units[index]
          const pair = units[index + 1]
          if (unit.layout === 'card' && pair?.layout === 'card') {
            rows.push({
              units: [unit.index, pair.index],
              cost: Math.max(unit.height, pair.height) + gap,
            })
            index += 1
          } else {
            rows.push({ units: [unit.index], cost: unit.height + gap })
          }
        }
        return rows
      }
      return [...document.querySelectorAll('[data-pack-section]')].map((sheet) => {
        const units = [...sheet.querySelectorAll('[data-pack-unit]')].map((element) => ({
          index: Number(element.getAttribute('data-pack-unit')),
          layout: element.getAttribute('data-pack-layout') ?? 'tr',
          height: Math.max(element.scrollHeight, element.offsetHeight),
        }))
        // The probe renders with no gaps, so the overhead uses the gap-free
        // rows; the packer's costs add the real card-row gap back.
        const rowsHeight = buildRows(units, 0).reduce((total, row) => total + row.cost, 0)
        const overhead = Math.max(0, sheet.scrollHeight - rowsHeight)
        const methodHeight = [...sheet.querySelectorAll('[data-pack-fixed]')].reduce(
          (total, element) => total + element.offsetHeight,
          0,
        )
        return {
          key: sheet.getAttribute('data-pack-section'),
          overhead,
          overheadContinuation: Math.max(0, overhead - methodHeight),
          rows: buildRows(units, cardRowGap),
        }
      })
    }, PACK_CARD_ROW_GAP_PX)
  } finally {
    await page.close()
  }
}

/** Throws with the list of overflowing pages — callers turn it into `die`. */
export const assertPageFits = (overflows, label, hint) => {
  if (overflows.length === 0) return
  throw new Error(
    `${label} estourou o A4 (${overflows
      .map((row) => `${row.page}: ${row.height}px`)
      .join(', ')} > ${A4_PAGE_BUDGET_PX}px úteis). ${hint}`,
  )
}

const printA4Pdf = (page, outPath) =>
  page.pdf({
    path: outPath,
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  })

/**
 * One browser run, two HTML documents: sets each document, asserts its anchor
 * exists, guards the fit and emits the PDF. Shared by the C186 (city), C187
 * (institution) and C190 (theme) builders — the pages differ, the emit
 * contract does not.
 *
 * C188 fit fallback: when `onDossierOverflow` is given, only the page-1 sheet
 * (`resumoOnly`) is measured first; if it overflows, the callback rebuilds the
 * document (pointer lines, never "…") and the fit is checked again — still
 * fail-closed if even the pointer does not fit.
 *
 * C190 bulletin fit: the one-pager is measured and, when `onBulletinOverflow`
 * is given, the callback rebuilds it with fewer printed facts (the remainder
 * is declared in the "e mais N" counter) until the A4 holds — still fail-closed
 * when the callback cannot shrink any further.
 */
export const emitHtmlPairPdf = async (
  browser,
  {
    dossierHtml,
    bulletinHtml,
    dossierPdf,
    bulletinPdf,
    onDossierOverflow = null,
    onBulletinOverflow = null,
    resumoOnly = false,
  },
) => {
  const page = await openPrintPage(browser, dossierHtml)
  let currentDossierHtml = dossierHtml
  let triedFallback = false
  for (;;) {
    await page.setContent(currentDossierHtml, { waitUntil: 'load' })
    await page.emulateMedia({ media: 'print' })
    const hasSummary = await page.evaluate(() =>
      Boolean(document.querySelector('[data-page="resumo"]')),
    )
    if (!hasSummary)
      throw new Error('Página de resumo ausente no HTML do dossiê — renderer quebrado.')
    const overflows = resumoOnly
      ? await measureSheetOverflows(page, 'resumo', A4_PAGE_BUDGET_PX)
      : await measurePageOverflows(page, A4_PAGE_BUDGET_PX)
    if (overflows.length === 0) break
    if (!onDossierOverflow || triedFallback) {
      assertPageFits(
        overflows,
        'Página(s) do dossiê',
        'Encurte os "summary" da pesquisa ou os itens de lista — nenhuma página pode ser cortada pelo overflow.',
      )
    }
    triedFallback = true
    currentDossierHtml = await onDossierOverflow()
    if (!currentDossierHtml) {
      assertPageFits(
        overflows,
        'Página(s) do dossiê',
        'Corte copy/caps — nenhuma página pode ser cortada pelo overflow.',
      )
    }
  }
  if (!resumoOnly) {
    assertPageFits(
      await measurePageOverflows(page, A4_PAGE_BUDGET_PX),
      'Página(s) do dossiê',
      'Corte copy/caps — nenhuma página pode ser cortada pelo overflow.',
    )
  }
  await printA4Pdf(page, dossierPdf)

  let currentBulletinHtml = bulletinHtml
  await page.setContent(currentBulletinHtml, { waitUntil: 'load' })
  await page.emulateMedia({ media: 'print' })
  for (let attempt = 0; ; attempt += 1) {
    const hasBulletin = await page.evaluate(() =>
      Boolean(document.querySelector('[data-page="boletim"]')),
    )
    if (!hasBulletin) throw new Error('Bloco do boletim ausente no HTML — renderer quebrado.')
    const overflows = await measurePageOverflows(page, A4_PAGE_BUDGET_PX)
    if (overflows.length === 0) break
    if (!onBulletinOverflow || attempt >= MAX_BULLETIN_FIT_ATTEMPTS) {
      assertPageFits(
        overflows,
        'O boletim',
        'Corte itens/caps — o boletim TEM de caber em uma página.',
      )
    }
    const rebuilt = await onBulletinOverflow()
    if (!rebuilt) {
      assertPageFits(
        overflows,
        'O boletim',
        'Corte itens/caps — o boletim TEM de caber em uma página.',
      )
    }
    currentBulletinHtml = rebuilt
    await page.setContent(currentBulletinHtml, { waitUntil: 'load' })
    await page.emulateMedia({ media: 'print' })
  }
  await printA4Pdf(page, bulletinPdf)

  await page.close()
}
