/**
 * Renderers for the city report (C163): the block tree goes to print HTML
 * (Chromium `page.pdf`, A4) and to the companion `.md` with the same reading.
 * Pure and unit-tested — the two outputs come from one content model, so the
 * companion cannot drift from the PDF.
 */

import { formatDateBr, formatDateTimeBr } from './cityReportFormat.mjs'

const htmlEscape = (value) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const URL_PATTERN = /(https?:\/\/[^\s<>"')]+)/g

/** Escapes the text and turns every bare URL into a clickable anchor (PDF links). */
const htmlWithLinks = (value) =>
  htmlEscape(value).replace(URL_PATTERN, (url) => `<a href="${url}">${url}</a>`)

const sourceKindLabels = {
  teqo: 'base Teqo',
  web: 'pesquisa web',
  official: 'fonte oficial',
}

const sourceLabel = (source) => {
  const parts = [sourceKindLabels[source.kind] ?? 'fonte']
  if (source.label) parts.push(source.label)
  if (source.date) parts.push(formatDateBr(source.date))
  if (source.url) parts.push(source.url)
  return parts.join(' · ')
}

const PRINT_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Fira Sans', 'DejaVu Sans', sans-serif;
    color: #18181b;
    font-size: 9.4pt;
    line-height: 1.35;
  }
  .summary {
    min-height: 250mm;
    display: flex;
    flex-direction: column;
    gap: 3mm;
  }
  .summary > .summary-body { display: flex; flex-direction: column; gap: 2.2mm; }
  .summary > * { flex-shrink: 0; }
  .summary .block + .block { margin-top: 2mm; }
  .summary .stats .stat { padding: .7mm 0; }
  .summary .callout { padding: 1.8mm 2.4mm; }
  .summary .pair .panel { padding: 1.8mm 2.2mm; }
  header.report-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #18181b;
    padding-bottom: 2.5mm;
  }
  header.report-head .kicker {
    font-size: 7.6pt;
    font-weight: 600;
    letter-spacing: .14em;
    text-transform: uppercase;
    color: #52525b;
    margin: 0;
  }
  header.report-head h1 { font-size: 16pt; margin: .8mm 0 0; }
  header.report-head h2 { font-size: 13pt; margin: .8mm 0 0; }
  header.report-head .sub { color: #52525b; font-size: 8.4pt; margin: .6mm 0 0; }
  header.report-head .meta { text-align: right; color: #52525b; font-size: 7.8pt; margin: 0; }
  header.report-head .meta p { margin: 0 0 .4mm; }
  .block-title {
    font-size: 7.6pt;
    font-weight: 600;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: #52525b;
    margin: 0 0 1.2mm;
  }
  .strip { display: flex; flex-wrap: wrap; gap: 1.5mm 6mm; border: .8px solid #d4d4d8; border-radius: 1.6mm; padding: 1.8mm 2.4mm; background: #fafafa; }
  .strip .strip-item { display: flex; gap: 1.4mm; align-items: baseline; }
  .strip .strip-label { color: #71717a; font-size: 7pt; text-transform: uppercase; letter-spacing: .05em; }
  .strip .strip-value { font-weight: 600; font-size: 8.4pt; }
  .grid { display: grid; gap: 3mm; }
  .grid-2 { grid-template-columns: 1fr 1fr; }
  .grid-3 { grid-template-columns: repeat(3, 1fr); }
  .grid .cell { border: .8px solid #d4d4d8; border-radius: 1.6mm; padding: 2.4mm; }
  .grid .cell > h4.cell-title { margin: 0 0 1.6mm; font-size: 8.6pt; }
  .cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.5mm; }
  .cards .card { border: .8px solid #d4d4d8; border-radius: 1.6mm; padding: 2.2mm; }
  .cards .card h5 { margin: 0 0 .8mm; font-size: 8pt; }
  .cards .card p { margin: 0; color: #3f3f46; font-size: 7.8pt; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.5mm; }
  .grid .kpis { gap: 1.6mm; }
  .grid .kpi { padding: 1.8mm; }
  .grid .kpi-value { font-size: 11pt; }
  .grid .stats { grid-template-columns: 1fr; }
  .kpi { border: .8px solid #d4d4d8; border-radius: 1.6mm; padding: 2.4mm; background: #fafafa; }
  .kpi-value { display: block; font-size: 13pt; font-weight: 700; }
  .kpi-label { display: block; font-size: 7.4pt; color: #52525b; }
  .kpi-hint { display: block; font-size: 7.2pt; color: #71717a; margin-top: .8mm; }
  .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 1mm 6mm; }
  .stats .stat { display: flex; justify-content: space-between; gap: 3mm; border-bottom: .6px solid #e4e4e7; padding: 1mm 0; }
  .stats .stat-label { color: #52525b; }
  .stats .stat-value { font-weight: 600; text-align: right; }
  .stats .stat-hint { display: block; font-weight: 400; color: #71717a; font-size: 7.4pt; }
  .source { color: #71717a; font-size: 7.2pt; margin: 1.4mm 0 0; }
  .source a { color: #1d4ed8; word-break: break-all; }
  .callout { border-left: 2.2mm solid #b45309; background: #fffbeb; padding: 2.4mm 3mm; border-radius: 0 1.6mm 1.6mm 0; }
  .callout.gap { border-left-color: #71717a; background: #f4f4f5; }
  .callout.decision { border-left-color: #15803d; background: #f0fdf4; }
  .callout.risk { border-left-color: #b45309; background: #fffbeb; }
  .callout h4 { margin: 0 0 1mm; font-size: 8.6pt; }
  .callout p { margin: 0 0 .8mm; }
  .pair { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
  .pair .panel { border: .8px solid #d4d4d8; border-radius: 1.6mm; padding: 2.4mm; }
  .pair .panel.decision { border-color: #15803d; }
  .pair .panel.risk { border-color: #b45309; background: #fffbeb; }
  .pair .panel h4 { margin: 0 0 1.2mm; font-size: 8.4pt; }
  .pair .panel ul, .bullets { margin: 0; padding-left: 4mm; }
  .pair .panel li, .bullets li { margin-bottom: .8mm; }
  .pair-note { color: #92400e; font-size: 7.6pt; margin: 1.2mm 0 0; }
  table { width: 100%; border-collapse: collapse; font-size: 8pt; }
  table.table-fixed { table-layout: fixed; }
  table.table-fixed td, table.table-fixed th { overflow-wrap: anywhere; }
  caption { caption-side: top; text-align: left; font-weight: 600; font-size: 8.6pt; padding-bottom: 1.2mm; color: #18181b; }
  th { text-align: left; background: #f4f4f5; border-bottom: .8px solid #d4d4d8; padding: 1.4mm 1.4mm; font-size: 7pt; text-transform: uppercase; letter-spacing: .03em; color: #52525b; }
  td { border-bottom: .6px solid #e4e4e7; padding: 1.4mm 1.4mm; vertical-align: top; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .table-note { color: #71717a; font-size: 7.2pt; margin: 1mm 0 0; }
  .prose p { margin: 0 0 1.4mm; }
  .page-break { break-before: page; }
  .index ol { columns: 2; margin: 0; padding-left: 0; list-style: none; color: #3f3f46; font-size: 8.6pt; }
  .report-section { margin-bottom: 6mm; }
  .report-section > h3 { font-size: 11pt; margin: 0 0 2mm; break-after: avoid; }
  .block + .block { margin-top: 3mm; }
  .block { break-inside: avoid; }
  .block.table-block { break-inside: auto; }
  .footer-note { margin-top: auto; border-top: .8px solid #d4d4d8; padding-top: 1.6mm; color: #71717a; font-size: 7.2pt; }
  .row-source { display: block; font-weight: 400; color: #71717a; font-size: 7pt; }
  .row-source a { color: #1d4ed8; word-break: break-all; }
`

const renderStrip = (block) =>
  `<div class="strip">${block.items
    .map(
      (item) =>
        `<span class="strip-item"><span class="strip-label">${htmlEscape(item.label)}</span><span class="strip-value">${htmlEscape(item.value)}</span></span>`,
    )
    .join('')}</div>`

const renderCards = (block) =>
  `<div class="cards">${block.items
    .map(
      (item) =>
        `<div class="card"><h5>${htmlEscape(item.title)}</h5><p>${htmlEscape(item.body)}</p></div>`,
    )
    .join('')}</div>`

const renderGrid = (block) =>
  `<div class="grid grid-${block.columns ?? 2}">${block.cells
    .map(
      (cell) =>
        `<div class="cell">${cell.title ? `<h4 class="cell-title">${htmlEscape(cell.title)}</h4>` : ''}${cell.blocks.map(renderBlockHtml).join('')}</div>`,
    )
    .join('')}</div>`

const renderKpis = (block) => {
  const items = block.items
    .map(
      (item) => `<div class="kpi">
        <span class="kpi-label">${htmlEscape(item.label)}</span>
        <span class="kpi-value">${htmlEscape(item.value)}</span>
        ${item.hint ? `<span class="kpi-hint">${htmlEscape(item.hint)}</span>` : ''}
      </div>`,
    )
    .join('')
  return `<div class="kpis">${items}</div>`
}

const renderStats = (block) => {
  const rows = block.rows
    .map(
      (row) => `<div class="stat">
        <span class="stat-label">${htmlEscape(row.label)}</span>
        <span class="stat-value">${htmlEscape(row.value)}${row.hint ? `<span class="stat-hint">${htmlEscape(row.hint)}</span>` : ''}${row.source ? `<span class="row-source">fonte: ${htmlWithLinks(sourceLabel(row.source))}</span>` : ''}</span>
      </div>`,
    )
    .join('')
  return `<div class="stats">${rows}</div>`
}

const renderBullets = (block) => {
  const items = block.items
    .map((item) => {
      const source = item.source
        ? ` <span class="row-source">fonte: ${htmlWithLinks(sourceLabel(item.source))}</span>`
        : ''
      return `<li>${htmlEscape(item.text)}${source}</li>`
    })
    .join('')
  return `<ul class="bullets">${items}</ul>`
}

const renderPair = (block) => {
  const panel = (side) => `<div class="panel ${side.tone}">
    <h4>${htmlEscape(side.title)}</h4>
    <ul>${side.items.map((item) => `<li>${htmlEscape(item.text)}</li>`).join('')}</ul>
  </div>`
  return `<div class="pair-wrap"><div class="pair">${panel(block.left)}${panel(block.right)}</div>${
    block.note ? `<p class="pair-note">${htmlEscape(block.note)}</p>` : ''
  }</div>`
}

const renderTable = (block) => {
  const fixed = block.columns.some((column) => column.width)
  const head = block.columns
    .map(
      (column) =>
        `<th${column.numeric ? ' class="num"' : ''}${column.width ? ` style="width:${column.width}%"` : ''}>${htmlEscape(column.label)}</th>`,
    )
    .join('')
  const rows = block.rows
    .map(
      (row) =>
        `<tr>${block.columns
          .map(
            (column) =>
              `<td${column.numeric ? ' class="num"' : ''}>${htmlWithLinks(row[column.key])}</td>`,
          )
          .join('')}</tr>`,
    )
    .join('')
  return `<table${fixed ? ' class="table-fixed"' : ''}><caption>${htmlEscape(block.title)}</caption><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>${
    block.note ? `<p class="table-note">${htmlEscape(block.note)}</p>` : ''
  }`
}

const renderCallout = (block) =>
  `<div class="callout ${block.tone}"><h4>${htmlEscape(block.title)}</h4>${block.body
    .map((paragraph) => `<p>${htmlEscape(paragraph)}</p>`)
    .join('')}</div>`

const renderSources = (block) => {
  const items = block.items
    .map((item) => {
      const link = item.url ? ` <a href="${htmlEscape(item.url)}">${htmlEscape(item.url)}</a>` : ''
      return `<li>${htmlEscape(sourceKindLabels[item.kind] ?? 'fonte')} — ${htmlEscape(item.label)}${
        item.date ? ` · ${htmlEscape(formatDateBr(item.date))}` : ''
      }${link}</li>`
    })
    .join('')
  const limits = block.limits.map((limit) => `<li>${htmlEscape(limit)}</li>`).join('')
  return `<ul class="bullets">${items}</ul><h4 class="block-title">Limites</h4><ul class="bullets">${limits}</ul>`
}

const renderBlockHtml = (block) => {
  const title = block.title ? `<h4 class="block-title">${htmlEscape(block.title)}</h4>` : ''
  let body
  switch (block.kind) {
    case 'kpis':
      body = renderKpis(block)
      break
    case 'strip':
      body = renderStrip(block)
      break
    case 'cards':
      body = renderCards(block)
      break
    case 'grid':
      body = renderGrid(block)
      break
    case 'stats':
      body = renderStats(block)
      break
    case 'bullets':
      body = renderBullets(block)
      break
    case 'pair':
      body = renderPair(block)
      break
    case 'table':
      body = renderTable(block)
      break
    case 'callout':
      body = renderCallout(block)
      break
    case 'prose':
      body = `<p>${htmlEscape(block.text)}</p>`
      break
    case 'sources':
      body = renderSources(block)
      break
    case 'footerNote':
      return `<p class="footer-note">${htmlEscape(block.text)}</p>`
    default:
      throw new Error(`Bloco desconhecido no render HTML: ${block.kind}`)
  }
  const sources = block.sources?.length
    ? `<p class="source">Fontes: ${block.sources.map((source) => htmlWithLinks(sourceLabel(source))).join(' · ')}</p>`
    : ''
  const className = block.kind === 'table' ? 'block table-block' : 'block'
  return `<div class="${className}">${title}${body}${sources}</div>`
}

const indexItems = (report) =>
  report.sections.map((section) => `<li>${htmlEscape(section.title)}</li>`).join('')

export const renderReportHtml = (report) => {
  const pageOne = report.page1.blocks.map((block) =>
    block.kind === 'footerNote'
      ? renderBlockHtml(block)
      : `<div class="block">${renderBlockHtml(block)}</div>`,
  )
  const summaryHeader = `<header class="report-head">
    <div>
      <p class="kicker">${htmlEscape(report.meta.title)}</p>
      <h1>${htmlEscape(report.meta.municipalityName)}</h1>
      <p class="sub">${htmlEscape(report.meta.region)} · prioridade e classe na leitura da base</p>
    </div>
    <div class="meta">
      <p>Gerado em ${htmlEscape(report.meta.generatedAtLabel)}</p>
      <p>Base lida em ${htmlEscape(report.meta.readAtLabel)} · snapshot do momento</p>
      <p>pág. 1</p>
    </div>
  </header>`

  const deepHeader = `<header class="report-head">
    <div>
      <p class="kicker">${htmlEscape(report.meta.title)} — aprofundamento</p>
      <h2>${htmlEscape(report.meta.municipalityName)}</h2>
    </div>
    <div class="meta">
      <p>Gerado em ${htmlEscape(report.meta.generatedAtLabel)}</p>
      <p>Base lida em ${htmlEscape(report.meta.readAtLabel)}</p>
    </div>
  </header>`

  const sections = report.sections
    .map((section) => {
      const blocks = section.blocks.map(renderBlockHtml).join('')
      return `<section class="report-section">${`<h3>${htmlEscape(section.title)}</h3>`}${blocks}</section>`
    })
    .join('')

  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${htmlEscape(report.meta.title)} — ${htmlEscape(report.meta.municipalityName)}</title><style>${PRINT_CSS}</style></head>
<body>
  <section class="summary" data-page="summary">
    ${summaryHeader}
    <div class="summary-body">${pageOne.join('')}</div>
  </section>
  <section class="deep-dive page-break">
    ${deepHeader}
    <div class="index"><h3>Índice</h3><ol>${indexItems(report)}</ol></div>
    ${sections}
  </section>
</body>
</html>`
}

const mdBlock = (block) => {
  const lines = []
  const title = block.title ? `### ${block.title}\n` : ''
  switch (block.kind) {
    case 'kpis':
      lines.push(title)
      for (const item of block.items) {
        lines.push(`- **${item.label}:** ${item.value}${item.hint ? ` — ${item.hint}` : ''}`)
      }
      break
    case 'stats':
      lines.push(title)
      for (const row of block.rows) {
        const hover = row.hint ? ` — ${row.hint}` : ''
        const source = row.source ? ` _(fonte: ${sourceLabel(row.source)})_` : ''
        lines.push(`- **${row.label}:** ${row.value}${hover}${source}`)
      }
      break
    case 'bullets':
      lines.push(title)
      for (const item of block.items) {
        lines.push(`- ${item.text}${item.source ? ` _(fonte: ${sourceLabel(item.source)})_` : ''}`)
      }
      break
    case 'strip':
      lines.push(block.items.map((item) => `**${item.label}:** ${item.value}`).join(' · '))
      break
    case 'cards':
      lines.push(title)
      for (const item of block.items) lines.push(`- **${item.title}:** ${item.body}`)
      break
    case 'grid':
      for (const cell of block.cells) {
        if (cell.title) lines.push(`### ${cell.title}\n`)
        for (const inner of cell.blocks) lines.push(mdBlock(inner))
      }
      break
    case 'pair':
      lines.push(`### ${block.left.title}\n`)
      for (const item of block.left.items) lines.push(`- ${item.text}`)
      lines.push(`\n### ${block.right.title}\n`)
      for (const item of block.right.items) lines.push(`- ${item.text}`)
      if (block.note) lines.push(`\n> ${block.note}`)
      break
    case 'table': {
      lines.push(title)
      lines.push(`| ${block.columns.map((column) => column.label).join(' | ')} |`)
      lines.push(`| ${block.columns.map(() => '---').join(' | ')} |`)
      for (const row of block.rows) {
        lines.push(
          `| ${block.columns.map((column) => String(row[column.key] ?? '')).join(' | ')} |`,
        )
      }
      if (block.note) lines.push(`\n_${block.note}_`)
      break
    }
    case 'callout':
      lines.push(`> **${block.title}**\n>`)
      for (const paragraph of block.body) lines.push(`> ${paragraph}`)
      break
    case 'prose':
      lines.push(title)
      lines.push(block.text)
      break
    case 'sources': {
      lines.push(title)
      for (const item of block.items) {
        const link = item.url ? ` — ${item.url}` : ''
        lines.push(
          `- ${sourceKindLabels[item.kind] ?? 'fonte'} — ${item.label}${item.date ? ` · ${formatDateBr(item.date)}` : ''}${link}`,
        )
      }
      lines.push('\n**Limites**\n')
      for (const limit of block.limits) lines.push(`- ${limit}`)
      break
    }
    case 'footerNote':
      lines.push(`_${block.text}_`)
      break
    default:
      throw new Error(`Bloco desconhecido no render MD: ${block.kind}`)
  }
  if (block.sources?.length && block.kind !== 'footerNote') {
    lines.push(`\n> Fontes: ${block.sources.map(sourceLabel).join(' · ')}`)
  }
  return lines.join('\n')
}

export const renderReportMd = (report) => {
  const lines = [
    `# ${report.meta.title} — ${report.meta.municipalityName}`,
    '',
    `**Território de identidade:** ${report.meta.region}`,
    `**Gerado em:** ${report.meta.generatedAtLabel} · **Base Teqo (read-only) lida em:** ${report.meta.readAtLabel} · snapshot do momento`,
    report.meta.codeSha
      ? `**Código:** ${report.meta.codeSha} · **Base:** ${report.meta.database}`
      : '',
    '',
    '## Resumo (página 1)',
    '',
    report.page1.blocks.map(mdBlock).join('\n\n'),
    '',
    '---',
    '',
  ]
  for (const section of report.sections) {
    lines.push(`## ${section.title}`, '')
    lines.push(section.blocks.map(mdBlock).join('\n\n'))
    lines.push('')
  }
  lines.push(
    `_Documento interno de campanha, datado (${formatDateTimeBr(report.meta.generatedAt)}). O dado envelhece: confira a data de leitura da base._`,
  )
  return `${lines.join('\n')}\n`
}
