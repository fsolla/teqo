/**
 * Briefing de capacitação — print renderer (C210).
 *
 * Ports the approved gate design (`docs/plans/briefing-capacitacao-solla-ui-design.html`)
 * class by class into the inline print CSS the report family uses: four fixed
 * A4 sheets (`essencial|defesas|qa|evitar`), sober, no campaign brand, the
 * literal internal label on every sheet and the vote request as a rendered
 * literal. The companion `.md` carries everything the PDF may have shed.
 */

import { BRIEFING_LABEL, BRIEFING_PAGE_TOTAL } from './briefingContent.mjs'
import { formatDateBr, formatDateTimeBr } from './cityReportFormat.mjs'
import { resolveDossierUnit } from './dossieUnit.mjs'
import { htmlEscape, moreItemsLabel } from './reportText.mjs'

const BRIEFING_REQUEST_LINE =
  '“Posso contar com você? Para deputado federal, <em>vote 1313, Jorge Solla</em>.”'

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
  .lede { max-width: 158mm; margin: 3mm 0 0; font-size: 10.2pt; line-height: 1.5; }
  .rule-note { margin-top: 4mm; padding: 2.5mm 0 2.5mm 4mm; border-top: .25mm solid var(--line); border-bottom: .25mm solid var(--line); border-left: 1mm solid var(--accent); color: var(--ink-soft); font-size: 8.4pt; line-height: 1.42; }
  .rule-note strong { color: var(--ink); }
  .line-list, .script-list, .avoid-list, .check-list { margin: 3mm 0 0; padding: 0; border-top: .35mm solid var(--ink); list-style: none; }
  .line-list li, .script-list li, .avoid-list li, .check-list li { position: relative; padding: 2.5mm 0 2.5mm 6mm; border-bottom: .2mm solid var(--line-light); }
  .line-list li::before, .script-list li::before, .avoid-list li::before, .check-list li::before { position: absolute; top: 3.7mm; left: 0; width: 2.2mm; height: .45mm; background: var(--accent); content: ''; }
  .line-title { display: block; font-weight: 700; }
  .line-meta { display: block; margin-top: .8mm; color: var(--ink-soft); font-size: 7.8pt; line-height: 1.4; }
  .more-note { margin: 3mm 0 0; color: var(--ink-soft); font-size: 8pt; font-weight: 600; line-height: 1.4; }
  .source { color: var(--accent); font-size: 7.4pt; font-weight: 700; }
  .request-line { margin: 3.5mm 0 0; padding: 4mm 0; border-top: .6mm solid var(--ink); border-bottom: .6mm solid var(--ink); font-size: 14pt; font-weight: 650; line-height: 1.3; letter-spacing: -.015em; }
  .request-line em { color: var(--accent); font-style: normal; }
  .script-list { counter-reset: script-step; }
  .script-list li { min-height: 14mm; padding-left: 13mm; counter-increment: script-step; }
  .script-list li::before { top: 2.7mm; width: 8mm; height: auto; color: var(--accent); background: none; content: counter(script-step, decimal-leading-zero); font-size: 8pt; font-weight: 700; }
  .qa-list { margin: 3mm 0 0; padding: 0; border-top: .35mm solid var(--ink); list-style: none; }
  .qa-item { display: grid; padding: 3.2mm 0; border-bottom: .2mm solid var(--line-light); grid-template-columns: 46mm 1fr; gap: 5mm; }
  .qa-question { margin: 0; font-size: 8.6pt; font-weight: 700; line-height: 1.38; }
  .qa-side { display: block; margin-bottom: 1mm; color: var(--accent); font-size: 6.8pt; letter-spacing: .07em; text-transform: uppercase; }
  .qa-answer { margin: 0; font-size: 8.6pt; line-height: 1.45; }
  .qa-answer b { font-weight: 700; }
  .avoid-list strong, .check-list strong { font-weight: 700; }
  .two-column { display: grid; margin-top: 5mm; grid-template-columns: 1fr 1fr; gap: 8mm; }
  .limits { margin-top: 5mm; padding-top: 3mm; border-top: .6mm solid var(--ink); }
  .limits p { margin: 1.5mm 0 0; color: var(--ink-soft); font-size: 8pt; line-height: 1.42; }
  .brief-footer { display: flex; margin-top: auto; padding-top: 2.5mm; border-top: .25mm solid var(--line); justify-content: space-between; gap: 8mm; color: var(--ink-soft); font-size: 7.2pt; line-height: 1.3; }
  .brief-footer strong { color: var(--ink); }
  .sheet-compact .section { margin-top: 3.8mm; }
  .sheet-compact .avoid-list, .sheet-compact .check-list { margin-top: 2mm; }
  .sheet-compact .avoid-list li, .sheet-compact .check-list li { padding-top: 1.65mm; padding-bottom: 1.65mm; font-size: 8.7pt; line-height: 1.32; }
  .sheet-compact .avoid-list li::before, .sheet-compact .check-list li::before { top: 2.8mm; }
  .sheet-compact .two-column { margin-top: 3.8mm; gap: 6mm; }
  .sheet-compact .section-title { font-size: 12.5pt; }
  .sheet-compact .limits { margin-top: 3.5mm; padding-top: 2mm; }
  .sheet-compact .limits p { margin-top: 1mm; font-size: 7.5pt; line-height: 1.32; }
  .sheet-compact .brief-footer { padding-top: 1.8mm; }
`

const HOW_TO_USE_COPY =
  'Antes: escolha dois fatos e ensaie o pedido. Durante: escute, responda com um fato verificável e peça o voto. Depois: registre a dúvida que ficou sem resposta para o próximo ciclo do dossiê.'

const WHY_COPY =
  'contato pessoal e relacional mobiliza melhor do que broadcast; escuta e narrativa vêm antes do argumento. Evidência internacional orienta o método, mas EUA ≠ Brasil — aqui o plano ajuda também a lembrar o número na urna.'

const RULER_COPY =
  'reconheça a preocupação em uma frase, sem repetir o ataque; responda com um fato local verificável; feche perguntando se pode contar com o voto 1313. Se o dossiê não sustenta a resposta, diga que vai conferir.'

const limitsCopyA = (name) =>
  `Material interno de capacitação. Não publicar, encaminhar como peça, impulsionar nem adaptar sem revisão editorial e jurídica. Sem CTA público, marca de campanha, cenário eleitoral, estimativa de votos ou dado staff-only. Os fatos foram selecionados do dossiê de ${name} e devem ser conferidos na fonte antes de uso público.`

const LIMITS_COPY_B =
  'A evidência de mobilização citada no treinamento é majoritariamente internacional e não mede automaticamente o Brasil. Use os princípios para orientar contato pessoal, plano de voto e lembrança do número — nunca para prometer efeito ou misturar resultados de estudos diferentes.'

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

const inlineBold = (value) => htmlEscape(value).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')

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

const headerHtml = (unit, title, subtitle, page, kickerSubject) => `
  <header class="brief-head">
    <div>
      <p class="kicker">Briefing de capacitação · ${htmlEscape(kickerSubject ?? unit.briefingNoun ?? unit.id)}</p>
      <h2 class="brief-title">${htmlEscape(title)}</h2>
      <p class="brief-subtitle">${htmlEscape(subtitle)}</p>
    </div>
    <p class="internal-label">
      ${BRIEFING_LABEL}
      <span class="page-no">folha ${page}/${BRIEFING_PAGE_TOTAL}</span>
    </p>
  </header>`

const footerHtml = (left, page) =>
  `<footer class="brief-footer"><span>${left}</span><span>Briefing de capacitação · ${page}/${BRIEFING_PAGE_TOTAL}</span></footer>`

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

const howToUseNoteHtml = () =>
  `<div class="rule-note"><strong>Como usar.</strong> ${htmlEscape(HOW_TO_USE_COPY)}</div>`

const sheetEssential = (content, { unit, report }) => `
  <article class="sheet" data-page="essencial" aria-label="O essencial do briefing de ${htmlEscape(briefingSubjectName(report, content))}">
    ${headerHtml(unit, briefingSubjectName(report, content), content.subtitle ?? 'Consulta antes e durante o contato', 1, unit.briefingNoun ?? unit.id)}
    <section class="section">
      <p class="eyebrow">Comece por aqui</p>
      <h3 class="section-title">O essencial do recorte</h3>
      <p class="lede">${htmlEscape(content.lede)}</p>
      <ul class="line-list">
${lineItemsHtml(content.essential)}
      </ul>
    </section>
    ${howToUseNoteHtml()}
    ${footerHtml(`<strong>Regra:</strong> ${unit.sumGuardNote ? `${htmlEscape(unit.sumGuardNote)} · ` : ''}fase acompanha valor · sem fonte, não afirmar`, 1)}
  </article>`

const sheetDefenses = (content, { unit, report }) => {
  const defenses =
    content.defenses.length > 0
      ? lineItemsHtml(content.defenses)
      : content.shed.defenses > 0
        ? ''
        : '<li><span class="line-title">Sem registro localizado no dossiê.</span><span class="line-meta">Não completar por memória nem apresentar ação regional como promessa do recorte. Confira no dossiê antes de afirmar.</span></li>'
  return `
  <article class="sheet" data-page="defesas" aria-label="O que Solla defende e roteiro do pedido de voto">
    ${headerHtml(unit, 'Defesas e pedido de voto', 'Do fato local ao compromisso nomeado', 2, briefingSubjectName(report, content))}
    <section class="section">
      <p class="eyebrow">Leitura dos registros · não é opinião</p>
      <h3 class="section-title">O que Solla defende</h3>
      <ul class="line-list">
${defenses}
      </ul>
      ${moreNote(content.shed.defenses, 'defesa', 'defesas')}
    </section>
    <section class="section">
      <p class="eyebrow">Roteiro curto · fale como pessoa, não como disparo</p>
      <h3 class="section-title">Faça o pedido com clareza</h3>
      <p class="request-line">${BRIEFING_REQUEST_LINE}</p>
      <ol class="script-list">
${content.script.steps
  .map(
    (step) =>
      `<li><span class="line-title">${htmlEscape(step.title)}</span><span class="line-meta">${htmlEscape(step.note)}</span></li>`,
  )
  .join('\n')}
      </ol>
    </section>
    <div class="rule-note"><strong>Por que assim:</strong> ${htmlEscape(WHY_COPY)}</div>
    ${footerHtml(`Base de capacitação: Nickerson &amp; Rogers 2010 · Schein et al. 2021 · Kalla &amp; Broockman 2020`, 2)}
  </article>`
}

const sheetQa = (content, { unit, report }) => `
  <article class="sheet" data-page="qa" aria-label="Perguntas prováveis e melhores respostas">
    ${headerHtml(unit, 'Perguntas prováveis × melhores respostas', 'Reconhecer → fato local verificável → pedido', 3, briefingSubjectName(report, content))}
    <div class="rule-note"><strong>Régua visível:</strong> ${htmlEscape(RULER_COPY)}</div>
    <ol class="qa-list">
${content.qa
  .map(
    (item) => `<li class="qa-item">
        <p class="qa-question"><span class="qa-side">${htmlEscape(QA_SIDE_LABELS[item.side] ?? item.side)}</span>${htmlEscape(item.question)}</p>
        <p class="qa-answer"><b>Reconhecer:</b> ${htmlEscape(item.acknowledge)} <b>Fato:</b> ${htmlEscape(item.answer)} ${anchorHtml(item)} <b>Fechar:</b> ${htmlEscape(item.close)}</p>
      </li>`,
  )
  .join('\n')}
    </ol>
    ${moreNote(content.shed.qa, 'pergunta', 'perguntas')}
    ${footerHtml(`<strong>Não debata para vencer.</strong> Preserve a relação, responda o verificável e anote a lacuna.`, 3)}
  </article>`

const sheetAvoid = (content, { unit, report }) => `
  <article class="sheet sheet-compact" data-page="evitar" aria-label="O que evitar e o que conferir no dossiê">
    ${headerHtml(unit, 'O que evitar', 'Proteja a relação, a verdade do recorte e os limites do material', 4, briefingSubjectName(report, content))}
    <section class="section">
      <ul class="avoid-list">
${content.avoid
  .map((item) => `<li><strong>${htmlEscape(item.title)}</strong> ${htmlEscape(item.note)}</li>`)
  .join('\n')}
      </ul>
      ${moreNote(content.shed.avoid, 'anti-padrão', 'anti-padrões')}
    </section>
    <div class="two-column">
      <section>
        <p class="eyebrow">Antes de responder</p>
        <h3 class="section-title">O que conferir no dossiê</h3>
        <ul class="check-list">
${content.checklist.beforeAnswer.map((item) => `<li>${inlineBold(item)}</li>`).join('\n')}
        </ul>
      </section>
      <section>
        <p class="eyebrow">Consulta em campo</p>
        <h3 class="section-title">Se você não souber</h3>
        <ul class="check-list">
${content.checklist.unsure.map((item) => `<li>${inlineBold(item)}</li>`).join('\n')}
        </ul>
      </section>
    </div>
    ${moreNote(content.shed.checklist, 'item de conferência', 'itens de conferência')}
    <section class="limits">
      <p class="eyebrow">Limites e defeso</p>
      <p>${htmlEscape(limitsCopyA(briefingSubjectName(report, content)))}</p>
      <p>${htmlEscape(LIMITS_COPY_B)}</p>
    </section>
    ${footerHtml('Anti-padrões: Lau et al. 2007 · Ecker et al. 2022 · Debunking Handbook 2020', 4)}
  </article>`

/**
 * @param {any} content normalized briefing content
 * @param {{ unit?: any, report: any }} options
 */
export const renderBriefingHtml = (content, { unit, report }) => {
  const resolvedUnit = resolveDossierUnit(unit ?? report?.unit)
  const parts = [
    sheetEssential(content, { unit: resolvedUnit, report }),
    sheetDefenses(content, { unit: resolvedUnit, report }),
    sheetQa(content, { unit: resolvedUnit, report }),
    sheetAvoid(content, { unit: resolvedUnit, report }),
  ]
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Briefing de capacitação — ${htmlEscape(briefingSubjectName(report, content))}</title><style>${BRIEFING_PRINT_CSS}</style></head>
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
    '## O essencial do recorte',
    '',
    content.lede,
    '',
    `**Como usar.** ${HOW_TO_USE_COPY}`,
    '',
    ...content.essential.map((item) => `- **${item.title}** — ${item.note} (${anchorMd(item)})`),
    '',
    '## O que Solla defende',
    '',
    ...(content.defenses.length > 0
      ? content.defenses.map((item) => `- **${item.title}** — ${item.note} (${anchorMd(item)})`)
      : ['- Sem registro localizado no dossiê — não completar por memória.']),
    '',
    '## Faça o pedido com clareza',
    '',
    '> “Posso contar com você? Para deputado federal, vote 1313, Jorge Solla.”',
    '',
    `**Por que assim:** ${WHY_COPY}`,
    '',
    ...content.script.steps.map((step, index) => `${index + 1}. **${step.title}** — ${step.note}`),
    '',
    '## Perguntas prováveis × melhores respostas',
    '',
    `**Régua visível:** ${RULER_COPY}`,
    '',
    ...content.qa.flatMap((item) => [
      `### ${QA_SIDE_LABELS[item.side] ?? item.side} — ${item.question}`,
      '',
      `- **Reconhecer:** ${item.acknowledge}`,
      `- **Fato:** ${item.answer} (${anchorMd(item)})`,
      `- **Fechar:** ${item.close}`,
      '',
    ]),
    '## O que evitar',
    '',
    ...content.avoid.map((item) => `- **${item.title}** ${item.note}`),
    '',
    '## O que conferir no dossiê',
    '',
    ...content.checklist.beforeAnswer.map((item) => `- ${item}`),
    '',
    '## Se você não souber',
    '',
    ...content.checklist.unsure.map((item) => `- ${item}`),
    '',
    '## Limites e defeso',
    '',
    limitsCopyA(name),
    '',
    LIMITS_COPY_B,
    '',
    `_Documento interno de campanha, datado (${formatDateTimeBr(content.generatedAt)}). O dado envelhece: confira a data do dossiê._`,
  )
  return `${lines.join('\n')}\n`
}
