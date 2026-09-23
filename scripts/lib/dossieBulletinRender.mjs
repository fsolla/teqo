/**
 * Boletim renderer (C186; sober redesign C209): one A4 `.sheet` in voter-facing
 * language. Ports the approved hi-fi classes
 * (`docs/plans/dossies-sobrios-analiticos-ui-design.html`, cena 12) — list-based,
 * no cards, badges or image placeholders. No source list: the facts come from
 * the dossiê ledger, and the page is labelled as an internal model.
 */

import { isSubjectUnit } from './dossieUnit.mjs'
import { htmlEscape, moreItemsLabel } from './reportText.mjs'

const PRINT_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Fira Sans', 'DejaVu Sans', Arial, sans-serif; color: var(--ink); background: #fff; }
  :root {
    --ink: #18232d;
    --ink-soft: #52616d;
    --accent: #4d6d7c;
    --line: #bdc8ce;
    --line-light: #dce3e6;
  }
  @page { size: A4; margin: 0; }
  .sheet {
    position: relative;
    display: flex;
    width: 210mm;
    height: 297mm;
    min-height: 297mm;
    padding: 15mm 17mm 13mm;
    overflow: hidden;
    flex-direction: column;
    background: #fff;
    font-size: 9.4pt;
    line-height: 1.42;
  }
  .sheet p, .sheet ul, .sheet ol, .sheet h1, .sheet h2 { margin-top: 0; }
  .running-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10mm; padding-bottom: 3mm; border-bottom: .35mm solid var(--ink); }
  .running-kicker { margin: 0; color: var(--accent); font-size: 7.5pt; font-weight: 700; letter-spacing: .11em; text-transform: uppercase; }
  .running-subtitle { margin: 1mm 0 0; color: var(--ink-soft); font-size: 8.7pt; }
  .running-meta { min-width: 41mm; margin: 0; color: var(--ink-soft); font-size: 7.3pt; line-height: 1.45; text-align: right; }
  .running-meta p { margin: 0; }
  .running-footer { display: flex; margin-top: auto; padding-top: 2.6mm; border-top: .25mm solid var(--line); align-items: flex-end; justify-content: space-between; gap: 8mm; color: var(--ink-soft); font-size: 7.2pt; line-height: 1.3; }
  .running-footer strong { color: var(--ink); }
  .folio { color: var(--ink); font-weight: 700; white-space: nowrap; }
  .section { margin-top: 5mm; }
  .section + .section { margin-top: 6mm; }
  .eyebrow { margin: 0 0 1.3mm; color: var(--accent); font-size: 7.2pt; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .bulletin-title { max-width: 162mm; margin: 12mm 0 0; font-size: 28pt; font-weight: 650; line-height: 1.02; letter-spacing: -.035em; }
  .bulletin-title span { color: var(--accent); }
  .bulletin-lede { max-width: 155mm; margin: 4mm 0 0; color: var(--ink-soft); font-size: 10.2pt; line-height: 1.45; }
  .bulletin-list { margin: 3mm 0 0; padding: 0; border-top: .35mm solid var(--ink); list-style: none; }
  .bulletin-list li { display: grid; padding: 2.6mm 0; border-bottom: .2mm solid var(--line-light); grid-template-columns: 38mm 1fr; gap: 4mm; }
  .bulletin-list strong { font-size: 8.6pt; }
  .bulletin-list span { color: var(--ink-soft); font-size: 8.6pt; }
  .bulletin-defense-list { margin: 3mm 0 0; padding: 0; border-top: .35mm solid var(--ink); list-style: none; }
  .bulletin-defense-list li { display: grid; padding: 2.4mm 0; border-bottom: .2mm solid var(--line-light); grid-template-columns: 52mm 1fr; gap: 4mm; }
  .bulletin-defense-list strong { font-size: 8.7pt; }
  .bulletin-defense-list span { color: var(--ink-soft); font-size: 8.5pt; line-height: 1.35; }
  .period-list { display: grid; margin: 3mm 0 0; padding: 0; border-top: .35mm solid var(--ink); grid-template-columns: 1fr 1fr; list-style: none; }
  .period-list li { min-height: 18mm; padding: 2.6mm 4mm 2.6mm 0; border-bottom: .2mm solid var(--line-light); }
  .period-list li:nth-child(odd) { border-right: .2mm solid var(--line-light); }
  .period-list li:nth-child(even) { padding-left: 4mm; }
  .period-list strong { display: block; color: var(--accent); font-size: 7.6pt; }
  .period-list span { display: block; margin-top: 1mm; font-size: 8.4pt; line-height: 1.33; }
  .plain-list { margin: 3mm 0 0; padding: 0; list-style: none; }
  .plain-list li { position: relative; padding: 2.2mm 0 2.2mm 6mm; border-top: .2mm solid var(--line-light); }
  .plain-list li:last-child { border-bottom: .2mm solid var(--line-light); }
  .plain-list li::before { position: absolute; top: 3.3mm; left: 0; width: 2.2mm; height: .45mm; background: var(--accent); content: ''; }
  .table-note { margin: 1.7mm 0 0; color: var(--ink-soft); font-size: 7.6pt; }
  .note-line { margin-top: 3mm; padding: 2mm 0; border-top: .25mm solid var(--line); border-bottom: .25mm solid var(--line); color: var(--ink-soft); font-size: 8.2pt; }
  .note-line strong { color: var(--ink); }
`

const highlightText = (highlight) => {
  const parts = []
  if (highlight.note) parts.push(highlight.note)
  if (highlight.number) {
    parts.push(
      highlight.phaseLabel ? `${highlight.number} · ${highlight.phaseLabel}` : highlight.number,
    )
  }
  return parts.join(' — ')
}

/** One sober composition for both shapes; the copy deltas come from the unit. */
export const renderBulletinHtml = (bulletin) => {
  const sparse = Boolean(bulletin.sparse)
  const subject = isSubjectUnit(bulletin.unit)
  const copy = bulletin.unit.copy?.bulletin ?? {}
  const subjectName = bulletin.meta.subjectName
  const title = subject
    ? (() => {
        const escaped = htmlEscape(copy.openingTitle(subjectName))
        const name = htmlEscape(subjectName)
        return escaped.includes(name) ? escaped.replace(name, `<span>${name}</span>`) : escaped
      })()
    : `O que Jorge Solla fez por <span>${htmlEscape(subjectName)}</span>`
  const lede = subject
    ? sparse
      ? copy.leadSparse
      : copy.lead
    : 'Da gestão da saúde ao mandato federal: ações no município e iniciativas para a região, apresentadas com o alcance de cada uma.'
  const remaining = subject
    ? copy.remaining
    : 'no dossiê da cidade — o boletim de uma página não os exibe.'
  const sparseRule = subject
    ? copy.sparseRule
    : 'Não repetir item, não ampliar efeito e não preencher espaço com fato sem lastro.'
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${htmlEscape(bulletin.meta.title)} — ${htmlEscape(subjectName)}</title><style>${PRINT_CSS}</style></head>
<body>
<article class="sheet" data-page="boletim" aria-label="${htmlEscape(copy.aria ?? 'Modelo de boletim informativo de uma página')}">
  <header class="running-head">
    <div>
      <p class="running-kicker">${htmlEscape(bulletin.meta.kicker)}</p>
      <p class="running-subtitle">${htmlEscape(
        subject ? subjectName : `${bulletin.meta.region ?? 'Bahia'} · Bahia`,
      )}</p>
    </div>
    <div class="running-meta">
      <p><strong class="ink-strong">${htmlEscape(bulletin.meta.modelLabel)}</strong></p>
      <p>folha 1/1</p>
    </div>
  </header>

  <section>
    <h2 class="bulletin-title">${title}</h2>
    <p class="bulletin-lede">${htmlEscape(lede)}</p>
  </section>

  <section class="section" aria-label="Destaques">
    <p class="eyebrow">Destaques</p>
    ${
      bulletin.highlights.length
        ? `<ul class="bulletin-list">${bulletin.highlights
            .map(
              (highlight) => `<li>
      <strong>${htmlEscape(highlight.title)}</strong>
      <span>${htmlEscape(highlightText(highlight))}</span>
    </li>`,
            )
            .join('')}</ul>`
        : `<div class="note-line">Sem fato com fonte suficiente para destacar — ver lacunas no dossiê.</div>`
    }
  </section>

  ${
    bulletin.defenses.length
      ? `<section class="section" aria-label="O que Solla defende">
    <p class="eyebrow">O que Solla defende</p>
    <ul class="bulletin-defense-list">${bulletin.defenses
      .map(
        (defense) => `<li>
      <strong>${htmlEscape(defense.label)}</strong>
      <span>${htmlEscape(defense.text)}</span>
    </li>`,
      )
      .join('')}</ul>
  </section>`
      : ''
  }

  <section class="section" aria-label="Trajetória">
    <p class="eyebrow">Trajetória em quatro períodos</p>
    <ol class="period-list">${bulletin.timeline
      .map(
        (step) =>
          `<li><strong>${htmlEscape(step.period)}</strong><span>${htmlEscape(step.text)}</span></li>`,
      )
      .join('')}</ol>
  </section>

  <section class="section" aria-label="Outras ações">
    <p class="eyebrow">E mais</p>
    ${
      bulletin.moreItems.length
        ? `<ul class="plain-list">${bulletin.moreItems
            .map((item) => `<li>${htmlEscape(item.label)}</li>`)
            .join('')}</ul>`
        : bulletin.factsRemaining === 0
          ? `<div class="note-line">Nenhum item adicional além dos destaques nesta página.</div>`
          : ''
    }
    ${
      bulletin.factsRemaining > 0
        ? `<p class="table-note">${htmlEscape(moreItemsLabel(bulletin.factsRemaining, 'fato com fonte', 'fatos com fonte'))} ${htmlEscape(remaining)}</p>`
        : ''
    }
    ${
      sparse
        ? `<div class="note-line"><strong>A página termina com espaço — de propósito.</strong> ${htmlEscape(sparseRule)}</div>`
        : ''
    }
  </section>

  <footer class="running-footer">
    <span>${
      subject
        ? htmlEscape(copy.orig ?? 'Conteúdo selecionado do dossiê.')
        : 'Fatos selecionados do dossiê da cidade.'
    }${subject && copy.defeso ? ` ${htmlEscape(copy.defeso)}.` : ''} <strong>Defeso eleitoral:</strong> material informativo em preparação. Não publicar sem revisão editorial e jurídica.</span>
    <span class="folio">MODELO · INSUMO INTERNO · 1/1</span>
  </footer>
</article>
</body>
</html>`
}
