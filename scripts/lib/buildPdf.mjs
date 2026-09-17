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

const MM_TO_PX = 96 / 25.4
export const A4_HEIGHT_PX = Math.round(297 * MM_TO_PX)
export const A4_WIDTH_PX = Math.round(210 * MM_TO_PX)
/** Rounding slack of the mm→px conversion; content must still fit the page. */
export const PAGE_FIT_TOLERANCE_PX = 10
export const A4_PAGE_BUDGET_PX = A4_HEIGHT_PX + PAGE_FIT_TOLERANCE_PX

export const launchPdfBrowser = () => chromium.launch()

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
 * exists, guards the fit and emits the PDF. Shared by the C186 (city) and C187
 * (institution) builders — the pages differ, the emit contract does not.
 *
 * C188 fit fallback: when `onDossierOverflow` is given, only the page-1 sheet
 * (`resumoOnly`) is measured first; if it overflows, the callback rebuilds the
 * document (pointer lines, never "…") and the fit is checked again — still
 * fail-closed if even the pointer does not fit.
 */
export const emitHtmlPairPdf = async (
  browser,
  {
    dossierHtml,
    bulletinHtml,
    dossierPdf,
    bulletinPdf,
    onDossierOverflow = null,
    resumoOnly = false,
  },
) => {
  const page = await browser.newPage()
  await page.setViewportSize({ width: A4_WIDTH_PX, height: A4_HEIGHT_PX })

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

  await page.setContent(bulletinHtml, { waitUntil: 'load' })
  await page.emulateMedia({ media: 'print' })
  const hasBulletin = await page.evaluate(() =>
    Boolean(document.querySelector('[data-page="boletim"]')),
  )
  if (!hasBulletin) throw new Error('Bloco do boletim ausente no HTML — renderer quebrado.')
  assertPageFits(
    await measurePageOverflows(page, A4_PAGE_BUDGET_PX),
    'O boletim',
    'Corte itens/caps — o boletim TEM de caber em uma página.',
  )
  await printA4Pdf(page, bulletinPdf)

  await page.close()
}
