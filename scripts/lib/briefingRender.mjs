/**
 * Briefing de capacitação — print renderer (C210).
 *
 * Ports the approved gate design (`docs/plans/briefing-capacitacao-solla-ui-design.html`)
 * class by class into the inline print CSS the report family uses: four fixed
 * A4 sheets, all of them recorte content — `defesas` (princípios + posições com
 * fonte), `essencial` (fatos-âncora + o pedido), `qa` and `qa-2` (perguntas
 * prováveis, 1/2 e 2/2). Sober, no campaign brand, the literal internal label on
 * every sheet and the vote request as a rendered literal. The companion `.md`
 * carries everything the PDF may have shed.
 */

import { BRIEFING_LABEL, BRIEFING_PAGE_TOTAL } from './briefingContent.mjs'
import { formatDateBr, formatDateTimeBr } from './cityReportFormat.mjs'
import { resolveDossierUnit } from './dossieUnit.mjs'
import { htmlEscape, moreItemsLabel } from './reportText.mjs'

const BRIEFING_REQUEST_LINE =
  'Posso contar com você? Para deputado federal, <em>vote 1313, Jorge Solla.</em>'

const BRIEFING_PRINT_CSS = `
  :root {
    --ink: #18232d;
    --ink-soft: #52616d;
    --accent: #4d6d7c;
    --line: #bdc8ce;
    --line-light: #dce3e6;
    --paper: #ffffff;
    --workspace: #e9edef;
    --note: #f2f5f6;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { color: var(--ink); background: var(--paper); font-family: 'Fira Sans', 'DejaVu Sans', Arial, sans-serif; -webkit-font-smoothing: antialiased; }
  @page { size: A4; margin: 0; }
  .sheet {
    display: flex;
    width: 210mm;
    height: 297mm;
    padding: 14mm 16mm 12mm;
    overflow: hidden;
    flex-direction: column;
    background: var(--paper);
    break-after: page;
    font-size: 9.4pt;
    line-height: 1.42;
  }
  .sheet:last-child { break-after: auto; }
  .sheet p, .sheet ul, .sheet ol { margin-top: 0; }
  .sheet a { color: var(--accent); }
  .brief-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 9mm; padding-bottom: 3mm; border-bottom: .35mm solid var(--ink); }
  .kicker, .eyebrow { margin: 0; color: var(--accent); font-size: 7.3pt; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .brief-title { margin: 1mm 0 0; font-size: 19pt; font-weight: 650; line-height: 1.05; letter-spacing: -.025em; }
  .brief-subtitle { margin: 1.2mm 0 0; color: var(--ink-soft); font-size: 8.7pt; }
  .internal-label { max-width: 47mm; margin: 0; color: var(--ink); font-size: 7.2pt; font-weight: 700; line-height: 1.4; text-align: right; text-transform: uppercase; }
  .page-no { display: block; margin-top: 1mm; color: var(--ink-soft); font-weight: 500; text-transform: none; }
  .section { margin-top: 5mm; }
  .section + .section { margin-top: 6mm; }
  .section-title { margin: 1.2mm 0 0; font-size: 13.5pt; font-weight: 650; line-height: 1.15; letter-spacing: -.015em; }
  .principles-copy { max-width: 162mm; margin: 3mm 0 0; font-size: 10.2pt; line-height: 1.5; }
  .rule-note { margin-top: 4mm; padding: 2.5mm 0 2.5mm 4mm; border-top: .25mm solid var(--line); border-bottom: .25mm solid var(--line); border-left: 1mm solid var(--accent); color: var(--ink-soft); font-size: 8.4pt; line-height: 1.42; }
  .rule-note strong { color: var(--ink); }
  .line-list { margin: 3mm 0 0; padding: 0; border-top: .35mm solid var(--ink); list-style: none; }
  .line-list li { position: relative; padding: 2.35mm 0 2.35mm 6mm; border-bottom: .2mm solid var(--line-light); }
  .line-list li::before { position: absolute; top: 3.55mm; left: 0; width: 2.2mm; height: .45mm; background: var(--accent); content: ''; }
  .line-title { display: block; font-weight: 700; }
  .line-meta { display: block; margin-top: .7mm; color: var(--ink-soft); font-size: 7.8pt; line-height: 1.36; }
  .source { color: var(--accent); font-size: 7.4pt; font-weight: 700; }
  .more-note { margin: 3mm 0 0; color: var(--ink-soft); font-size: 8pt; font-weight: 600; line-height: 1.4; }
  .request-block { margin-top: 5mm; padding: 4.5mm 5mm 4mm; border: .35mm solid var(--line); border-left: 1.2mm solid var(--accent); background: var(--note); }
  .request-line { margin: 2mm 0 0; font-size: 14pt; font-weight: 650; line-height: 1.3; letter-spacing: -.015em; }
  .request-line em { color: var(--accent); font-style: normal; }
  .request-plan { margin: 3mm 0 0; padding-top: 2.5mm; border-top: .25mm solid var(--line); color: var(--ink-soft); font-size: 8.6pt; line-height: 1.4; }
  .request-plan strong { color: var(--ink); }
  .qa-list { margin: 3mm 0 0; padding: 0; border-top: .35mm solid var(--ink); list-style: none; }
  .qa-item { display: grid; padding: 3.2mm 0; border-bottom: .2mm solid var(--line-light); grid-template-columns: 46mm 1fr; gap: 5mm; }
  .qa-question { margin: 0; font-size: 8.6pt; font-weight: 700; line-height: 1.38; }
  .qa-side { display: block; margin-bottom: 1mm; color: var(--accent); font-size: 6.8pt; letter-spacing: .07em; text-transform: uppercase; }
  .qa-answer { margin: 0; font-size: 8.6pt; line-height: 1.45; }
  .qa-answer b { font-weight: 700; }
  .brief-footer { display: flex; margin-top: auto; padding-top: 2.5mm; border-top: .25mm solid var(--line); justify-content: space-between; gap: 8mm; color: var(--ink-soft); font-size: 7.2pt; line-height: 1.3; }
  .brief-footer strong { color: var(--ink); }
`

const RULER_COPY = 'reconheça sem repetir o ataque → responda com fato e fonte → feche no pedido.'

const QA_SIDE_LABELS = {
  direita: 'Objeção à direita',
  esquerda: 'Objeção à esquerda',
  entrega: 'Dúvida sobre entrega',
}

/**
 * The recorte name printed in headers/footers: the dossiê subject (municipality
 * or institution/theme), falling back to the content slug. Shared with the
 * builder log so the name has one owner.
 */
export const briefingSubjectName = (report, content) =>
  report?.meta?.municipalityName ?? report?.meta?.subjectName ?? content?.slug ?? '—'

const anchorHtml = (item) =>
  item.fact
    ? `<a class="source" href="${htmlEscape(item.fact.sourceUrl)}">fonte${
        item.fact.sourceDate ? ` · ${htmlEscape(formatDateBr(item.fact.sourceDate))}` : ''
      }</a>`
    : '<span class="source">lacuna</span>'

const anchorMd = (item) =>
  item.fact
    ? `[fonte](${item.fact.sourceUrl})${item.fact.sourceDate ? ` · ${formatDateBr(item.fact.sourceDate)}` : ''}`
    : `_lacuna: ${item.gapReason}_`

const headerHtml = (kickerSubject, title, subtitle, page) => `
  <header class="brief-head">
    <div>
      <p class="kicker">Briefing de capacitação · ${htmlEscape(kickerSubject)}</p>
      <h2 class="brief-title">${htmlEscape(title)}</h2>
      <p class="brief-subtitle">${htmlEscape(subtitle)}</p>
    </div>
    <p class="internal-label">
      ${BRIEFING_LABEL}
      <span class="page-no">folha ${page}/${BRIEFING_PAGE_TOTAL}</span>
    </p>
  </header>`

const footerHtml = (noun, name, page) =>
  `<footer class="brief-footer"><span><strong>Recorte:</strong> ${htmlEscape(noun)} · ${htmlEscape(name)}</span><span>folha ${page}/${BRIEFING_PAGE_TOTAL}</span></footer>`

const moreNote = (count, singular, plural) =>
  count > 0
    ? `<p class="more-note">${htmlEscape(moreItemsLabel(count, singular, plural))} no briefing completo (.md)</p>`
    : ''

const lineItemsHtml = (items) =>
  (items ?? [])
    .map(
      (item) =>
        `<li><span class="line-title">${htmlEscape(item.title)}</span><span class="line-meta">${htmlEscape(item.note)} ${anchorHtml(item)}</span></li>`,
    )
    .join('\n')

const qaItemsHtml = (items) =>
  (items ?? [])
    .map(
      (item) => `<li class="qa-item">
        <p class="qa-question"><span class="qa-side">${htmlEscape(QA_SIDE_LABELS[item.side] ?? item.side)}</span>${htmlEscape(item.question)}</p>
        <p class="qa-answer"><b>Reconhecer:</b> ${htmlEscape(item.acknowledge)} <b>Fato:</b> ${htmlEscape(item.answer)} ${anchorHtml(item)} <b>Fechar:</b> ${htmlEscape(item.close)}</p>
      </li>`,
    )
    .join('\n')

const sheetDefenses = (content, { name, noun }) => {
  const defenses =
    content.defenses.length > 0
      ? lineItemsHtml(content.defenses)
      : content.shed.defenses > 0
        ? ''
        : '<li><span class="line-title">Sem registro localizado no dossiê.</span><span class="line-meta">Não completar por memória nem apresentar ação regional como promessa do recorte. Confira no dossiê antes de afirmar.</span></li>'
  return `
  <article class="sheet" data-page="defesas" aria-label="O que Solla defende em ${htmlEscape(name)}">
    ${headerHtml(noun, 'O que Solla defende', `${name} · princípios que orientam posição e voto`, 1)}
    <section class="section">
      <p class="eyebrow">Princípios e crenças · leitura dos registros, não é opinião</p>
      <p class="principles-copy">${htmlEscape(content.lede)}</p>
      <ul class="line-list">
${defenses}
      </ul>
      ${moreNote(content.shed.defenses, 'defesa', 'defesas')}
    </section>
    ${footerHtml(noun, name, 1)}
  </article>`
}

const sheetEssential = (content, { name, noun }) => `
  <article class="sheet" data-page="essencial" aria-label="O essencial de ${htmlEscape(name)} e o pedido">
    ${headerHtml(noun, 'O essencial do recorte', `${name} · fatos que sustentam a conversa`, 2)}
    <section class="section">
      <p class="eyebrow">Fatos-âncora · fase junto ao valor</p>
      <ul class="line-list">
${lineItemsHtml(content.essential)}
      </ul>
    </section>
    <section class="request-block" aria-label="Pedido de voto">
      <p class="eyebrow">O pedido</p>
      <p class="request-line">${BRIEFING_REQUEST_LINE}</p>
      <p class="request-plan"><strong>Plano:</strong> ${htmlEscape(content.plan)}</p>
    </section>
    ${footerHtml(noun, name, 2)}
  </article>`

const sheetQaFirst = ({ name, noun, items }) => `
  <article class="sheet" data-page="qa" aria-label="Perguntas prováveis e melhores respostas sobre ${htmlEscape(name)}, parte 1">
    ${headerHtml(name, 'Perguntas prováveis × melhores respostas', 'Parte 1 de 2 · posições e escolhas', 3)}
    <div class="rule-note"><strong>Régua:</strong> ${htmlEscape(RULER_COPY)}</div>
    <ol class="qa-list">
${qaItemsHtml(items)}
    </ol>
    ${footerHtml(noun, name, 3)}
  </article>`

const sheetQaSecond = ({ name, noun, items, shed }) => `
  <article class="sheet" data-page="qa-2" aria-label="Perguntas prováveis e melhores respostas sobre ${htmlEscape(name)}, continuação">
    ${headerHtml(name, 'Perguntas prováveis × melhores respostas', 'Continuação · parte 2 de 2 · entrega e atribuição', 4)}
    <ol class="qa-list">
${qaItemsHtml(items)}
    </ol>
    ${moreNote(shed, 'pergunta', 'perguntas')}
    ${footerHtml(noun, name, 4)}
  </article>`

/**
 * @param {any} content normalized briefing content
 * @param {{ unit?: any, report: any }} options
 */
export const renderBriefingHtml = (content, { unit, report }) => {
  const resolvedUnit = resolveDossierUnit(unit ?? report?.unit)
  const name = briefingSubjectName(report, content)
  const noun = resolvedUnit.briefingNoun ?? resolvedUnit.id
  // The Q&A flows across the two last sheets: the first half prints on folha 3,
  // the second half on folha 4 (the shed re-splits when an item is dropped).
  const half = Math.ceil(content.qa.length / 2)
  const parts = [
    sheetDefenses(content, { name, noun }),
    sheetEssential(content, { name, noun }),
    sheetQaFirst({ name, noun, items: content.qa.slice(0, half) }),
    sheetQaSecond({ name, noun, items: content.qa.slice(half), shed: content.shed.qa }),
  ]
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Briefing de capacitação — ${htmlEscape(name)}</title><style>${BRIEFING_PRINT_CSS}</style></head>
<body>
${parts.join('\n')}
</body>
</html>`
}

/** Companion `.md`: the reference copy — carries everything the PDF may shed. */
export const renderBriefingMd = (content, { unit, report }) => {
  const resolvedUnit = resolveDossierUnit(unit ?? report?.unit)
  const name = briefingSubjectName(report, content)
  const lines = [
    `# Briefing de capacitação — ${name}`,
    '',
    `> **${BRIEFING_LABEL}**`,
    '',
    `- **Recorte:** ${resolvedUnit.briefingNoun ?? resolvedUnit.id} · ${name}`,
    `- **Gerado em:** ${formatDateTimeBr(content.generatedAt)}`,
  ]
  if (content.subtitle) lines.push(`- **Uso:** ${content.subtitle}`)
  lines.push(
    '',
    '## O que Solla defende',
    '',
    content.lede,
    '',
    ...(content.defenses.length > 0
      ? content.defenses.map((item) => `- **${item.title}** — ${item.note} (${anchorMd(item)})`)
      : ['- Sem registro localizado no dossiê — não completar por memória.']),
    '',
    '## O essencial do recorte',
    '',
    ...content.essential.map((item) => `- **${item.title}** — ${item.note} (${anchorMd(item)})`),
    '',
    '## O pedido',
    '',
    '> “Posso contar com você? Para deputado federal, vote 1313, Jorge Solla.”',
    '',
    `**Plano:** ${content.plan}`,
    '',
    '## Perguntas prováveis × melhores respostas',
    '',
    `**Régua:** ${RULER_COPY}`,
    '',
    ...content.qa.flatMap((item) => [
      `### ${QA_SIDE_LABELS[item.side] ?? item.side} — ${item.question}`,
      '',
      `- **Reconhecer:** ${item.acknowledge}`,
      `- **Fato:** ${item.answer} (${anchorMd(item)})`,
      `- **Fechar:** ${item.close}`,
      '',
    ]),
    `_Documento interno de campanha, datado (${formatDateTimeBr(content.generatedAt)}). O dado envelhece: confira a data do dossiê._`,
  )
  return `${lines.join('\n')}\n`
}
