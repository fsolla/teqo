/**
 * Dossiê renderer (C186): the block model goes to print HTML (Chromium
 * `page.pdf`, A4, one `.sheet` per page) and to the companion `.md`. Ports the
 * approved hi-fi classes (`dossie-solla-cidade-ui-design.html`) class-by-class;
 * shared escaping/source-token contract lives in `reportText.mjs`.
 */

import {
  CHART_COLORS,
  barChart,
  columnChart,
  stackedColumnChart,
  valueList,
} from './chartPrimitives.mjs'
import { formatDateBr, formatDateTimeBr, formatMoneyCompact } from './cityReportFormat.mjs'
import { dossierPhaseLabel, dossierSphereBadgeClass, dossierSphereLabel } from './dossieBlocks.mjs'
import { MUNICIPALITY_UNIT, isSubjectUnit, resolveDossierUnit } from './dossieUnit.mjs'
import { htmlEscape, moreItemsLabel, showingLabel, stripInlineSources } from './reportText.mjs'

/** Markdown column headers capitalize the sphere label (sentence case, as C187 shipped). */
const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1)

const SOURCE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>'

const WARNING_ICON =
  '<svg class="warn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>'

const sourceLink = (url, label = '(fonte)') =>
  url
    ? `<a class="source-link" href="${htmlEscape(url)}" aria-label="Abrir fonte">${SOURCE_ICON}${htmlEscape(label)}</a>`
    : ''

const scopeBadge = (sphere, label = null, unit = MUNICIPALITY_UNIT) => {
  const badgeClass = dossierSphereBadgeClass(sphere, unit)
  return `<span class="scope${badgeClass ? ` ${badgeClass}` : ''}">${htmlEscape(label ?? dossierSphereLabel(sphere, unit))}</span>`
}

/** `dd/mm/aa` — the news table column is 9% wide (no room for a 4-digit year). */
const formatShortDateBr = (value) => {
  const full = formatDateBr(value)
  const parts = full.split('/')
  return parts.length === 3 ? `${parts[0]}/${parts[1]}/${parts[2].slice(-2)}` : full
}

/**
 * Print surfaces prefer the reformulated `brief` (short headline + note that fit
 * the fixed A4 with no ellipsis) and fall back to the full `answer`/`details`
 * record when an item has none — the builder's A4 fit guard then fails closed
 * instead of silently dropping information.
 */
const copyHtml = (value) => htmlEscape(stripInlineSources(value))
const briefOr = (brief, fallback) => brief?.title ?? fallback
const noteOr = (brief, fallback) => brief?.note ?? fallback

const PHASE_MODIFIER = {
  autorizado: 'phase-pending',
  empenhado: 'phase-pending',
  liquidado: 'phase-paid',
  pago: 'phase-paid',
}
const phaseBadge = (phase) => {
  const modifier = PHASE_MODIFIER[phase]
  return `<span class="phase${modifier ? ` ${modifier}` : ''}">${htmlEscape(dossierPhaseLabel(phase))}</span>`
}

const placeholder = (label) =>
  `<span class="placeholder-bar" aria-label="${htmlEscape(label)}"></span>`

const valueCell = (value, widthLabel = 'Valor desconhecido') =>
  value === null || value === undefined || value === ''
    ? placeholder(widthLabel)
    : `<strong>${htmlEscape(value)}</strong>`

const assetBox = (title, lines) =>
  `<div class="asset-box"><p class="asset-title">${htmlEscape(title)}</p><p>${lines
    .map((line) => htmlEscape(line))
    .join('<br />')}</p></div>`

/** Total of sheets rendered so far — the shell's `pág. N/M` reads it. */
const pageCount = (report) => report.meta.pageTotal

const timelineGrid = (rows) => `
    <div class="timeline-grid">
      ${rows
        .map(
          (row) => `<div class="timeline-cell">
            <p class="timeline-period">${htmlEscape(row.period)}</p>
            <p class="timeline-role">${htmlEscape(row.role)}</p>
            <p class="timeline-recovery">${htmlEscape(row.recovery)}${row.uncertain ? ` · ${htmlEscape(row.uncertain)}` : ''}</p>
          </div>`,
        )
        .join('')}
    </div>`

const sheetHeader = (report, title, subtitle, pageNo) => `
  <header class="report-header">
    <div>
      <p class="report-kicker">Dossiê de atuação pública · ${htmlEscape(report.meta.municipalityName)}</p>
      <h2 class="sheet-title">${htmlEscape(title)}</h2>
      ${subtitle ? `<p class="sheet-sub">${htmlEscape(subtitle)}</p>` : ''}
    </div>
    <div class="report-meta">
      <p><strong>Gerado em ${htmlEscape(formatDateTimeBr(report.meta.generatedAt))}</strong></p>
      <p>INSUMO INTERNO</p>
      <p>pág. ${pageNo}/${pageCount(report)}</p>
    </div>
  </header>`

const sheetFooter = (report, left, pageNo) => `
  <footer class="report-footer">
    <span>Dossiê Solla por cidade · ${htmlEscape(report.meta.municipalityName)} · ${htmlEscape(left)}</span>
    <span>Gerado em ${htmlEscape(formatDateTimeBr(report.meta.generatedAt))} · pág. ${pageNo}/${pageCount(report)}</span>
  </footer>`

const renderCover = (report) => `
<article class="sheet sheet-cover" data-page="capa" aria-label="Capa do dossiê">
  <div class="accent-bar"></div>
  <header class="cover-head">
    <div>
      <p class="report-kicker">${htmlEscape(report.cover.kicker)}</p>
      <p class="cover-series">${htmlEscape(report.cover.series)}</p>
    </div>
    <div class="internal-note"><strong>${htmlEscape(report.cover.internalNote)}</strong><br />${htmlEscape(report.cover.internalNoteSub)}</div>
  </header>

  <div class="cover-block">
    <p class="eyebrow">${htmlEscape(report.cover.eyebrow)}</p>
    <h1 class="cover-title">${htmlEscape(report.cover.title)}</h1>
    <p class="cover-sub">${htmlEscape(report.cover.subtitle)}</p>
  </div>

  <dl class="cover-dl">
    <dt>Território de Identidade</dt><dd>${htmlEscape(report.cover.territory)}</dd>
    <dt>Região / polo adotado</dt><dd>${htmlEscape(report.cover.pole)}</dd>
    <dt>Data de geração</dt><dd class="tabular">${htmlEscape(formatDateTimeBr(report.meta.generatedAt))}</dd>
  </dl>

  <div class="cover-grid">
    <div class="how-to"><p class="how-to-title">Como usar</p><p>${htmlEscape(report.cover.howToUse)}</p></div>
    ${assetBox('NEEDS ASSET', ['selo institucional autorizado', 'opcional — nunca marca de campanha'])}
  </div>

  <div class="cover-foot">
    <div class="ink-rule"></div>
    <div class="cover-foot-row">
      <p class="cover-scope">${htmlEscape(report.cover.scope)}</p>
      <p class="cover-version">${htmlEscape(report.cover.version)}</p>
    </div>
  </div>
</article>`

const renderTimeline = (report) => `
  <section class="block">
    <div class="block-head">
      <div><p class="eyebrow">01 · trajetória</p><h3 class="section-title">Linha do tempo da carreira</h3></div>
      <p class="meta">Período + papel + trilha de recuperação</p>
    </div>
    ${timelineGrid(report.page1.timeline)}
  </section>`

const renderTrajectory = (report, pageNo) => `
<article class="sheet" data-page="trajetoria" aria-label="Trajetória completa">
  ${sheetHeader(report, 'Trajetória completa', 'Todos os períodos da carreira e como cada um foi recuperado', pageNo)}
  ${timelineGrid(report.trajectory)}
  <p class="meta">Períodos incertos ficam marcados na própria linha; o acervo interno de falas cobre 2011+ e o que falta vira lacuna explícita.</p>
  ${sheetFooter(report, 'Trajetória', pageNo)}
</article>`

const renderDeliveries = (report) => {
  const deliveries = report.page1.deliveries
  if (deliveries.items.length === 0) return ''
  return `
  <section class="block">
    <div class="block-head">
      <div><p class="eyebrow">02 · destaques com lastro</p><h3 class="section-title">Principais entregas localizadas</h3></div>
    </div>
    <div class="deliveries">
      ${deliveries.items
        .map(
          (row) => `<div class="delivery-row">
            <div class="delivery-scope">${scopeBadge(row.sphere)}<p class="meta">Era ${htmlEscape(row.era)}${row.year ? ` · ${htmlEscape(row.year)}` : ''}</p></div>
            <div>
              <p class="delivery-title">${copyHtml(briefOr(row.brief, row.title))}</p>
              ${noteOr(row.brief, row.detail) ? `<p class="muted small">${copyHtml(noteOr(row.brief, row.detail))}</p>` : ''}
            </div>
            <div class="delivery-value">
              <p class="value-big tabular">${valueCell(row.value, 'Valor não informado')}</p>
              ${row.phase ? phaseBadge(row.phase) : ''}
              ${sourceLink(row.sourceUrl)}
            </div>
          </div>`,
        )
        .join('')}
    </div>
    ${
      deliveries.remaining > 0
        ? `<p class="muted small strong">${htmlEscape(showingLabel(deliveries.items.length, deliveries.total, 'entrega localizada', 'entregas localizadas'))} — o restante está nas páginas das eras.</p>`
        : ''
    }
    <p class="muted small strong">Guarda de leitura: autorizado ≠ empenhado ≠ liquidado ≠ pago. A fase acompanha cada valor.</p>
  </section>`
}

const renderHooksAndPending = (report) => {
  const hooks = report.page1.hooks
  const pending = report.page1.pending
  if (hooks.items.length === 0 && pending.items.length === 0) return ''
  return `
  <section class="page1-grid">
    ${
      hooks.items.length
        ? `<div class="panel">
            <p class="eyebrow">03 · ganchos para o boletim</p>
            <ul class="tight-list">${hooks.items
              .map(
                (hook) =>
                  `<li><strong>Tema:</strong> ${htmlEscape(hook.topic)}. <strong>Ângulo:</strong> ${copyHtml(briefOr(hook.brief, hook.angle))} ${sourceLink(hook.sourceUrl)}</li>`,
              )
              .join('')}</ul>
            ${hooks.remaining > 0 ? `<p class="muted small">${htmlEscape(moreItemsLabel(hooks.remaining, 'gancho', 'ganchos'))} nas eras.</p>` : ''}
          </div>`
        : '<div></div>'
    }
    ${
      pending.items.length
        ? `<div class="panel panel-warning">
            <p class="eyebrow warning-text">04 · o que falta</p>
            <ul class="tight-list">${pending.items.map((item) => `<li>${htmlEscape(item)}</li>`).join('')}</ul>
            ${pending.remaining > 0 ? `<p class="warning-text small">${htmlEscape(moreItemsLabel(pending.remaining, 'ponto', 'pontos'))} sem leitura na tabela de lacunas.</p>` : ''}
            <p class="warning-text small strong">Ausência é resultado: não completar por inferência.</p>
          </div>`
        : '<div></div>'
    }
  </section>`
}

const renderSummary = (report, pageNo) => `
<article class="sheet" data-page="resumo" aria-label="Resumo de uma olhada">
  ${sheetHeader(report, 'Resumo de uma olhada', `${report.meta.region} · informação datada e pronta para conferência`, pageNo)}
  ${renderTimeline(report)}
  ${renderDeliveries(report)}
  ${renderHooksAndPending(report)}
  ${sheetFooter(report, 'Resumo', pageNo)}
</article>`

/** Region cards (fixed sheet): counts per recorte, no combined total. */
const renderRegion = (report, pageNo) => `
<article class="sheet" data-page="regiao" aria-label="Recorte regional e polo">
  ${sheetHeader(report, 'Região / polo', 'Impacto compartilhado, apresentado fora da conta municipal', pageNo)}

  <section class="rule-warning">
    ${WARNING_ICON}
    <div>
      <p class="rule-title">${htmlEscape(report.region.ruleTitle)}</p>
      <p class="muted">${htmlEscape(report.region.ruleBody)}</p>
    </div>
  </section>

  ${
    report.region.context.length
      ? `<p class="meta">Contexto municipal (IBGE): ${report.region.context
          .map(
            (item) => `${copyHtml(item.detail)} ${sourceLink(item.sourceUrl, `(${item.topic})`)}`,
          )
          .join(' · ')} — leitura relativa, nunca % estadual absoluto.</p>`
      : ''
  }

  <section class="block">
    <p class="eyebrow">Leitura lado a lado</p>
    <h3 class="section-title">Duas listas, dois totais, nenhuma soma</h3>
    <div class="scope-compare">
      <div class="panel">
        <div class="action-head">${scopeBadge('municipio', null, report.unit)}<span class="meta strong">${report.region.municipal.total} ${report.region.municipal.total === 1 ? 'item' : 'itens'} com fonte · DIRETO</span></div>
        <p class="meta">lista completa nas páginas seguintes</p>
      </div>
      <div class="compare-mid" aria-hidden="true"><span>≠</span></div>
      <div class="panel panel-region">
        <div class="action-head">${scopeBadge('regiao', 'região / polo', report.unit)}<span class="warning-text meta strong">SEM TOTAL COMBINADO · ${report.region.regional.total} ${report.region.regional.total === 1 ? 'item' : 'itens'}</span></div>
        <p class="meta">lista completa nas páginas seguintes</p>
      </div>
    </div>
  </section>

  ${
    report.region.hook || report.region.priorityGap
      ? `<section class="page1-grid">
          ${
            report.region.hook
              ? `<div class="aside-accent"><p class="eyebrow">Gancho possível</p><p><strong>Tema:</strong> ${htmlEscape(report.region.hook.topic)}. <strong>Ângulo:</strong> ${copyHtml(briefOr(report.region.hook.brief, report.region.hook.angle))} ${sourceLink(report.region.hook.sourceUrl)}</p></div>`
              : '<div></div>'
          }
          ${
            report.region.priorityGap
              ? `<div class="panel panel-warning"><p class="eyebrow warning-text">Lacuna prioritária</p><p>${htmlEscape(report.region.priorityGap)}</p></div>`
              : '<div></div>'
          }
        </section>`
      : ''
  }

  ${sheetFooter(report, 'Região/polo · recortes não somáveis', pageNo)}
</article>`

/** Full lists of the region recorte, uncapped: each one flows across sheets. */
const regionListUnits = (report, list, probe) =>
  list.items.map((item, index) => ({
    layout: 'tr',
    html: `<tr${unitAttrs(probe, index, 'tr')}>
            <td>${copyHtml(briefOr(item.brief, item.answer))}</td>
            <td>${scopeBadge(item.sphere, null, report.unit)}</td>
            <td>${copyHtml(item.details ?? item.brief?.note ?? '—')}</td>
            <td>${sourceLink(item.sourceUrl)}</td>
          </tr>`,
  }))

const renderRegionListSheet = ({ report, list, entry, probe, pageNo }) => `
<article class="sheet" data-page="${entry.anchor}"${probe ? ` data-pack-section="${entry.key}"` : ''} aria-label="${htmlEscape(`Região / polo · ${list.label}`)}">
  ${sheetHeader(
    report,
    `Região / polo · ${list.label}`,
    entry.index === 0
      ? `${list.total} ${list.total === 1 ? 'item' : 'itens'} com fonte`
      : `continuação ${entry.index + 1} · ${list.total} ${list.total === 1 ? 'item' : 'itens'} com fonte`,
    pageNo,
  )}
  ${
    entry.index === 0
      ? `<section class="rule-warning">
    ${WARNING_ICON}
    <div>
      <p class="rule-title">${htmlEscape(report.region.ruleTitle)}</p>
      <p class="muted">Cada linha informa sua esfera; região e polo não são somados ao município.</p>
    </div>
  </section>`
      : ''
  }
  <section class="block">
    <table class="document-table">
      <caption class="sr-only">Itens do recorte com evidência de alcance e fonte</caption>
      <colgroup><col style="width:30%" /><col style="width:15%" /><col style="width:34%" /><col style="width:21%" /></colgroup>
      ${tableHead(['Item', 'Esfera', 'Evidência de alcance', 'Fonte'])}
      <tbody>${entry.chunk.map((unit) => unit.html).join('')}</tbody>
    </table>
  </section>
  ${sheetFooter(report, `Região/polo · ${list.label}`, pageNo)}
</article>`

const renderRegionListSheets = ({ report, key, anchor, list, pack, probe, nextPage }) => {
  if (list.items.length === 0) return []
  const units = regionListUnits(report, list, probe)
  return packedSection({ key, anchor, units, pack, probe }).map((entry) =>
    renderRegionListSheet({ report, list, entry, probe, pageNo: nextPage() }),
  )
}

const PRINT_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Fira Sans', 'DejaVu Sans', Arial, sans-serif; color: #172033; font-size: 10.5pt; line-height: 1.32; background: #fff; }
  @page { size: A4; margin: 0; }
  .sheet {
    position: relative;
    width: 210mm;
    min-height: 297mm;
    height: 297mm;
    padding: 12mm 14mm 10mm;
    background: #fff;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    break-after: page;
  }
  .sheet:last-child { break-after: auto; }
  .sheet p, .sheet ul, .sheet ol, .sheet dl { margin-top: 0; }
  .sheet a { color: #245b78; text-decoration: underline; text-underline-offset: 1.5px; }
  .accent-bar { position: absolute; left: 0; top: 0; width: 4mm; height: 297mm; background: #315c75; }
  .report-header { display: flex; justify-content: space-between; gap: 8mm; align-items: flex-start; padding-bottom: 3mm; border-bottom: .45mm solid #172033; }
  .report-kicker { margin: 0; color: #315c75; font-size: 8pt; font-weight: 700; letter-spacing: .13em; text-transform: uppercase; }
  .sheet-title { margin: 1.2mm 0 0; font-size: 18pt; font-weight: 700; line-height: 1.1; letter-spacing: -.02em; }
  .sheet-sub { margin: .8mm 0 0; font-size: 10.5pt; color: #435264; }
  .report-meta { min-width: 43mm; margin: 0; color: #435264; font-size: 8pt; line-height: 1.45; text-align: right; font-variant-numeric: tabular-nums; }
  .report-meta p { margin: 0; }
  .report-footer { margin-top: auto; padding-top: 2.5mm; border-top: .25mm solid #cbd5dc; display: flex; justify-content: space-between; gap: 5mm; color: #435264; font-size: 8pt; line-height: 1.3; }
  .section-title { margin: 0; font-size: 13.5pt; line-height: 1.18; letter-spacing: -.01em; }
  .eyebrow { margin: 0 0 1.4mm; color: #315c75; font-size: 8pt; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .eyebrow.warning-text, .warning-text { color: #8a5a18; }
  .muted { color: #435264; }
  .small { font-size: 10.5pt; line-height: 1.28; }
  .meta { font-size: 7.7pt; line-height: 1.2; color: #435264; }
  .strong { font-weight: 600; }
  .tabular { font-variant-numeric: tabular-nums; }
  .nowrap { white-space: nowrap; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .block { margin-top: 3.4mm; break-inside: avoid; }
  .block-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 4mm; }
  .source-link { display: inline-flex; align-items: baseline; gap: 1mm; white-space: nowrap; font-size: 9pt; font-weight: 600; }
  .source-link svg { width: 3mm; height: 3mm; transform: translateY(.35mm); }
  .scope { display: inline-flex; align-items: center; min-height: 5mm; padding: .4mm 1.6mm; border: .25mm solid #9aacb7; border-radius: 99px; color: #304758; background: #f7fafb; font-size: 7.5pt; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
  .scope-region { border-color: #aa8752; color: #6b4918; background: #fff9ee; }
  .phase { display: inline-block; padding: .5mm 1.4mm; border-radius: 1mm; background: #e9eef1; color: #334553; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .035em; }
  .document-table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 10.5pt; line-height: 1.22; margin-top: 2.5mm; }
  .document-table th { padding: 1.7mm 1.6mm; border-top: .25mm solid #cbd5dc; border-bottom: .35mm solid #9caab3; background: #f3f6f8; color: #435264; font-size: 7.5pt; font-weight: 700; letter-spacing: .045em; text-align: left; text-transform: uppercase; }
  .document-table td { padding: 2mm 1.6mm; border-bottom: .25mm solid #dce3e7; vertical-align: top; overflow-wrap: anywhere; }
  .document-table tbody tr:nth-child(even) { background: #fafcfd; }
  .document-table .numeric { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .placeholder-bar { display: inline-block; width: 22mm; height: 2.6mm; border-radius: 1mm; background: #d8e0e5; vertical-align: middle; }
  .asset-box { border: .35mm dashed #80919d; color: #4c5c68; background: #f7f9fa; padding: 3mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; min-height: 30mm; border-radius: .25rem; font-size: 8pt; font-weight: 600; }
  .asset-box p { margin: 0; }
  .asset-box .asset-title { text-transform: uppercase; letter-spacing: .08em; }
  .timeline-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.8mm; margin-top: 2.5mm; }
  .timeline-cell { border-top: 1.6px solid #315c75; background: #f3f6f8; padding: 2mm; }
  .timeline-period { margin: 0; font-size: 7.6pt; font-weight: 700; color: #315c75; }
  .timeline-role { margin: .8mm 0 0; font-size: 10.5pt; font-weight: 600; line-height: 1.16; }
  .timeline-recovery { margin: .7mm 0 0; font-size: 7.5pt; line-height: 1.16; color: #435264; }
  .deliveries { border-top: .25mm solid #cbd5dc; border-bottom: .25mm solid #cbd5dc; margin-top: 1.8mm; }
  .delivery-row { display: grid; grid-template-columns: 26mm 1fr 42mm; gap: 3mm; padding: 2mm 0; border-bottom: .25mm solid #cbd5dc; }
  .delivery-row:last-child { border-bottom: none; }
  .delivery-title { margin: 0; font-weight: 600; }
  .delivery-value { text-align: right; }
  .value-big { margin: 0; font-size: 14pt; font-weight: 600; }
  .page1-grid { display: grid; grid-template-columns: 1.15fr .85fr; gap: 3mm; margin-top: 3.2mm; break-inside: avoid; }
  .panel { border: .25mm solid #cbd5dc; border-radius: .25rem; padding: 3mm; break-inside: avoid; }
  .panel-warning { border: none; border-left: 3mm solid #8a5a18; background: #fff7e8; }
  .panel-region { border: .35mm solid #c9a66d; background: #fffbf3; }
  .tight-list { margin: 0; padding-left: 4mm; }
  .tight-list li { margin-bottom: 1mm; }
  .aside-accent { border-radius: .25rem; background: #e8f0f4; padding: 3mm; font-size: 10.5pt; line-height: 1.35; }
  .era-method { display: grid; grid-template-columns: 1fr 55mm; gap: 4mm; margin-top: 4mm; }
  .action-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-top: 3mm; }
  .action-head { display: flex; align-items: center; justify-content: space-between; gap: 3mm; }
  .action-title { margin: 2mm 0 0; font-size: 10.5pt; font-weight: 600; }
  .honors { display: grid; grid-template-columns: 1fr 58mm; gap: 4mm; }
  .rule-warning { display: flex; align-items: flex-start; gap: 3mm; border: .45mm solid #8a5a18; background: #fff7e8; border-radius: .25rem; padding: 4mm; margin-top: 4mm; }
  .rule-warning .warn-icon { width: 5mm; height: 5mm; color: #8a5a18; flex-shrink: 0; margin-top: .5mm; }
  .rule-title { margin: 0; font-size: 12pt; font-weight: 700; color: #8a5a18; }
  .rule-warning .muted { margin-bottom: 0; }
  .scope-compare { display: grid; grid-template-columns: 1fr 12mm 1fr; align-items: stretch; gap: 3mm; margin-top: 3mm; }
  .compare-mid { display: flex; flex-direction: column; align-items: center; justify-content: center; color: #8a5a18; }
  .compare-mid::before, .compare-mid::after { content: ''; width: 1px; flex: 1; background: #d8c09a; }
  .compare-mid span { font-size: 18pt; font-weight: 700; margin: 2mm 0; }
  .cover-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 8mm; border-bottom: .25mm solid #cbd5dc; padding-bottom: 4mm; }
  .cover-series { margin: 2mm 0 0; font-size: 10.5pt; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #435264; }
  .internal-note { border: .25mm solid #cbd5dc; background: #f3f6f8; padding: 2mm 3mm; text-align: right; font-size: 8pt; line-height: 1.5; color: #435264; border-radius: .25rem; }
  .cover-block { margin-top: 28mm; max-width: 150mm; }
  .cover-title { margin: 0; font-size: 34pt; font-weight: 700; line-height: 1.03; letter-spacing: -.035em; }
  .cover-sub { margin: 5mm 0 0; max-width: 125mm; font-size: 15pt; line-height: 1.4; color: #435264; }
  .cover-dl { display: grid; grid-template-columns: 42mm 1fr; border-top: .25mm solid #cbd5dc; border-bottom: .25mm solid #cbd5dc; margin: 22mm 0 0; font-size: 11pt; }
  .cover-dl dt { border-bottom: .25mm solid #cbd5dc; padding: 3mm 0; font-weight: 600; color: #435264; }
  .cover-dl dd { margin: 0; border-bottom: .25mm solid #cbd5dc; padding: 3mm 0; font-weight: 600; }
  .cover-dl dt:last-of-type, .cover-dl dd:last-of-type { border-bottom: none; }
  .cover-grid { display: grid; grid-template-columns: 1fr 56mm; gap: 5mm; margin-top: 6mm; }
  .how-to { border-radius: .25rem; background: #e8f0f4; padding: 4mm; }
  .how-to .how-to-title { margin: 0; font-size: 10.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #315c75; }
  .how-to p { margin: 2mm 0 0; font-size: 10.5pt; line-height: 1.35; color: #435264; }
  .cover-foot { margin-top: auto; }
  .cover-foot .ink-rule { height: .5mm; background: #172033; margin-bottom: 5mm; }
  .cover-foot-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 8mm; }
  .cover-scope { margin: 0; max-width: 118mm; font-size: 10.5pt; line-height: 1.4; color: #435264; }
  .cover-version { margin: 0; text-align: right; font-size: 8pt; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; color: #315c75; }
  .cover-accent { color: #315c75; }
  .defeso { margin-top: auto; }
  .chart-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-top: 3mm; }
  .chart { display: block; width: 100%; height: auto; }
  .chart-card { border: .25mm solid #cbd5dc; border-radius: .25rem; padding: 3mm; break-inside: avoid; }
  .chart-title { margin: 0 0 2mm; font-size: 9.5pt; font-weight: 600; }
  .chart-label { font-size: 7.4pt; fill: #435264; }
  .chart-value { font-size: 7.6pt; fill: #1f2933; font-weight: 700; }
  .chart-legend { margin: 1.5mm 0 0; font-size: 7.6pt; line-height: 1.3; color: #435264; }
  .synthesis-lines { margin: 0; padding-left: 4.5mm; font-size: 9.5pt; line-height: 1.35; }
  .synthesis-lines li { margin: 0 0 1.8mm; }
  .synthesis-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; margin-top: 3mm; }
  .opening-paragraph { margin: 0 0 3.4mm; font-size: 11pt; line-height: 1.45; }
  .opening-paragraph:last-child { margin-bottom: 0; }
  .era-summary { margin-top: 3.4mm; border-left: 1.2mm solid #315c75; background: #f7fafb; padding: 2.6mm 3mm; }
  .era-summary p { margin: 0; font-size: 10pt; line-height: 1.4; }
  .value-list { list-style: none; margin: 0; padding: 0; }
  .value-list li { display: grid; grid-template-columns: 1fr 20mm 18mm; gap: 1.6mm; align-items: center; padding: 0.9mm 0; border-bottom: .25mm solid #e3e9ec; font-size: 8.2pt; line-height: 1.22; }
  .value-list li:last-child { border-bottom: 0; }
  .value-list-bar { display: block; height: 2.2mm; background: #eef2f5; border-radius: 1mm; overflow: hidden; }
  .value-list-bar span { display: block; height: 100%; background: #315c75; }
  .value-list-value { text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
`

const renderMunicipalityDossierHtml = (report, { pack = null, probe = false } = {}) => {
  const buildParts = () => {
    let page = 0
    const nextPage = () => ++page
    const parts = []
    parts.push(renderCover(report))
    page += 1
    const opening = renderUnitOpeningPage(report, page + 1)
    if (opening) {
      parts.push(opening)
      page += 1
    }
    parts.push(renderTrajectory(report, nextPage()))
    parts.push(renderSummary(report, nextPage()))
    parts.push(renderUnitSynthesisPage(report, nextPage()))
    parts.push(renderUnitChartsPage(report, nextPage()))
    for (const era of report.eras) {
      parts.push(...renderEraSheets({ report, era, pack, probe, nextPage, includeHonors: true }))
    }
    parts.push(renderRegion(report, nextPage()))
    parts.push(
      ...renderRegionListSheets({
        report,
        key: 'region:municipio',
        anchor: 'regiao-municipio',
        list: report.region.municipal,
        pack,
        probe,
        nextPage,
      }),
    )
    parts.push(
      ...renderRegionListSheets({
        report,
        key: 'region:regional',
        anchor: 'regiao-regional',
        list: report.region.regional,
        pack,
        probe,
        nextPage,
      }),
    )
    parts.push(...renderGapSheets({ report, pack, probe, nextPage }))
    parts.push(...renderNewsSheets({ report, pack, probe, nextPage }))
    parts.push(...renderAcervoSheets({ report, pack, probe, nextPage }))
    parts.push(renderUnitSourcesPage(report, nextPage()))
    return parts
  }

  // Two passes: the shell's `pág. N/M` needs the final sheet count, and the
  // count only exists after the pack plan is applied.
  report.meta.pageTotal = 0
  let parts = buildParts()
  report.meta.pageTotal = parts.length
  parts = buildParts()

  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${htmlEscape(report.meta.title)} — ${htmlEscape(report.meta.municipalityName)}</title><style>${PRINT_CSS}</style></head>
<body>
${parts.join('\n')}
</body>
</html>`
}

const mdEra = (era) => {
  const lines = [
    `## ${era.label} (${era.period})`,
    '',
    `_${era.method}_`,
    '',
    `Trilha: ${era.recovery}`,
  ]
  if (era.narrative || era.summary) {
    lines.push('', `> ${era.narrative ?? era.summary}`)
  }
  if (listOf(era.numbers).length) {
    lines.push(
      '',
      '| Objeto | Valor | Ano | Fase | Esfera | Fonte |',
      '| --- | --- | --- | --- | --- | --- |',
    )
    for (const row of listOf(era.numbers)) {
      lines.push(
        `| ${row.object} | ${row.value ?? '—'} | ${row.year ?? '—'} | ${dossierPhaseLabel(row.phase)} | ${row.sphere} | ${row.sourceUrl ?? '—'} |`,
      )
    }
  }
  for (const action of listOf(era.actions)) {
    lines.push(
      '',
      `- **${stripInlineSources(action.title)}** (${action.sphere}${action.year ? ` · ${action.year}` : ''})${action.detail ? ` — ${stripInlineSources(action.detail)}` : ''} [fonte](${action.sourceUrl})`,
    )
  }
  for (const honor of listOf(era.honors))
    lines.push('', `- Honraria: ${stripInlineSources(honor.text)} [fonte](${honor.sourceUrl})`)
  return lines.join('\n')
}

const renderMunicipalityDossierMd = (report) => {
  const lines = [
    `# ${report.meta.title} — ${report.meta.municipalityName}`,
    '',
    `**Território de identidade:** ${report.meta.region}`,
    `**Gerado em:** ${formatDateTimeBr(report.meta.generatedAt)} · **Base Teqo (read-only) lida em:** ${report.meta.readAtLabel}`,
    '',
    '> INSUMO INTERNO — não circular, não publicar. Documento de trabalho.',
    '',
  ]
  if (report.opening?.paragraphs?.length) {
    lines.push(`## ${report.opening.title}`, '')
    for (const paragraph of report.opening.paragraphs) lines.push(paragraph, '')
    lines.push(
      `_Redação de síntese sobre os pontos com fonte; ${
        report.opening.authored
          ? 'escrita a partir dos itens datados do dossiê'
          : 'repetição da leitura dos números (sem redação autoral disponível)'
      } — nada aqui acrescenta fato novo._`,
      '',
    )
  }
  lines.push('## Linha do tempo da carreira', '')
  for (const row of report.trajectory) {
    lines.push(
      `- **${row.period}** — ${row.role}${row.uncertain ? ` _(${row.uncertain})_` : ''} · ${row.recovery}`,
    )
  }

  if (report.page1.deliveries.items.length) {
    lines.push('', '## Principais entregas localizadas', '')
    for (const row of report.page1.deliveries.items) {
      lines.push(
        `- **${stripInlineSources(row.title)}** · _${row.sphere}_${row.value ? ` · ${row.value}` : ''}${row.phase ? ` (${dossierPhaseLabel(row.phase)})` : ''}${row.detail ? ` — ${stripInlineSources(row.detail)}` : ''} [fonte](${row.sourceUrl})`,
      )
    }
    if (report.page1.deliveries.remaining > 0) {
      lines.push(
        '',
        `_${showingLabel(report.page1.deliveries.items.length, report.page1.deliveries.total, 'entrega localizada', 'entregas localizadas')} — o restante está nas páginas das eras._`,
      )
    }
    lines.push('', '_Autorizado ≠ empenhado ≠ liquidado ≠ pago. A fase acompanha cada valor._')
  }

  for (const era of report.eras) {
    lines.push('', mdEra(era))
  }

  if (report.synthesis?.lines?.length) {
    lines.push('', '## Síntese do que foi localizado', '')
    for (const line of report.synthesis.lines) lines.push(`- ${line}`)
    lines.push('', '### Números por recorte', '')
    lines.push('| Era | Município | Região/polo | Total |', '| --- | --- | --- | --- |')
    for (const row of report.synthesis.byEraSphere) {
      const countFor = (key) => row.segments.find((segment) => segment.key === key)?.count ?? 0
      lines.push(
        `| ${row.label} | ${countFor('municipio')} | ${countFor('regiao') + countFor('polo')} | ${row.segments.reduce((sum, segment) => sum + segment.count, 0)} |`,
      )
    }
    if (report.synthesis.moneyByPhase.length) {
      lines.push('', '### Recursos por fase', '')
      for (const row of report.synthesis.moneyByPhase) {
        lines.push(`- ${row.label}: ${row.count} · ${formatMoneyCompact(row.amount)}`)
      }
    }
    if (report.synthesis.byArea.length) {
      lines.push('', '### Temas com mais registros', '')
      for (const row of report.synthesis.byArea) lines.push(`- ${row.key}: ${row.count}`)
    }
  }

  lines.push(
    '',
    '## Região / polo',
    '',
    `> ${report.region.ruleTitle}`,
    `> ${report.region.ruleBody}`,
    '',
  )
  lines.push('### Município', '')
  for (const item of report.region.municipal.items) {
    lines.push(
      `- **${stripInlineSources(briefOr(item.brief, item.answer))}** (${item.sphere})${item.details ? ` — ${stripInlineSources(item.details)}` : ''} [fonte](${item.sourceUrl})`,
    )
  }
  lines.push('', '### Região / polo (não somável)', '')
  for (const item of report.region.regional.items) {
    lines.push(
      `- **${stripInlineSources(briefOr(item.brief, item.answer))}** (${item.sphere})${item.details ? ` — ${stripInlineSources(item.details)}` : ''} [fonte](${item.sourceUrl})`,
    )
  }

  if (report.acervo?.items?.length) {
    lines.push(
      '',
      '## Acervo interno (read-only)',
      '',
      `_Amostra de ${report.acervo.items.length} de ${report.acervo.recorte} falas do recorte, com link; o acervo completo fica na base Teqo. ${report.unit?.acervoNote ?? ''}_`,
      '',
    )
    for (const row of report.acervo.items) {
      lines.push(
        `- **${row.period}** — ${stripInlineSources(row.text)}${row.excerpt ? ` _(${stripInlineSources(row.excerpt)})_` : ''} [fonte](${row.sourceUrl})`,
      )
    }
  }

  lines.push('', '## Lacunas explícitas', '')
  if (report.gaps.length === 0) lines.push('_Nenhuma lacuna declarada._')
  for (const gap of report.gaps) {
    lines.push(`- **${gap.label}:** ${gap.reason} → ${gap.nextStep}`)
  }

  if (report.news.length) {
    lines.push('', '## Notícias e documentos consultados', '')
    for (const row of report.news) {
      lines.push(`- ${formatDateBr(row.date)} · ${row.outlet} — ${row.title} — ${row.url}`)
    }
  }

  lines.push(
    '',
    '## Limites de cobertura',
    '',
    ...report.limits.coverage.map((item) => `- ${item}`),
    '',
    '## Regras para uso editorial',
    '',
    ...report.limits.editorial.map((item) => `- ${item}`),
    '',
    '## Nota de defeso eleitoral 2026',
    '',
    'Insumo interno não é autorização para publicar. Publicidade institucional e propaganda eleitoral obedecem a regimes diferentes. Antes de adaptar qualquer trecho para peça externa, submeta texto, imagem, autoria, período e canal à revisão responsável.',
    '',
    `_Documento interno de campanha, datado (${formatDateTimeBr(report.meta.generatedAt)}). O dado envelhece: confira a data de leitura da base._`,
  )
  return `${lines.join('\n')}\n`
}

/* ------------------------------------------------------------------ *
 * Institution renderer (C187) — ports the approved institutional     *
 * hi-fi (`dossie-solla-instituicao-ui-design.html`) class-by-class;   *
 * shares the print shell, source tokens and table CSS of the city     *
 * renderer (one owner).                                               *
 * ------------------------------------------------------------------ */

const INSTITUTION_PRINT_CSS = `
  ${PRINT_CSS}
  .identity-badge { display: inline-flex; align-items: center; min-height: 5mm; padding: .45mm 1.6mm; border: .25mm solid #cbd5dc; border-radius: 99px; color: #435264; background: #f3f6f8; font-size: 7.4pt; line-height: 1; font-weight: 700; letter-spacing: .035em; text-transform: uppercase; }
  .scope-sector { border-color: #9d8b64; color: #65501f; background: #fffaf0; }
  .scope-network { border-color: #8f819c; color: #554362; background: #faf7fc; }
  .phase-paid { color: #285338; background: #e6f2e9; }
  .phase-pending { color: #6b4918; background: #fff2d9; }
  .empty-panel { border: .45mm dashed #b18549; color: #684819; background: #fff7e8; border-radius: .25rem; padding: 5mm 8mm; text-align: center; }
  .empty-panel .rule-title { margin-top: 1.5mm; }
  .empty-panel .warn-icon { width: 8mm; height: 8mm; margin: 0 auto; color: #8a5a18; }
  .timeline-item { position: relative; padding-left: 5mm; }
  .timeline-item::before { content: ''; position: absolute; top: 1.5mm; left: 0; width: 2.6mm; height: 2.6mm; border: .5mm solid #fff; border-radius: 99px; background: #315c75; box-shadow: 0 0 0 .35mm #315c75; }
  .id-card { border: .25mm solid #cbd5dc; border-radius: .25rem; background: #f3f6f8; padding: 3mm; }
  .id-card dl { display: grid; grid-template-columns: 22mm 1fr; gap: 1mm 2mm; font-size: 9pt; line-height: 1.3; }
  .id-card dt { font-weight: 600; color: #435264; }
  .id-card dd { margin: 0; }
  .summary-top { display: grid; grid-template-columns: 58mm 1fr; gap: 4mm; margin-top: 4mm; }
  .vinc-timeline { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2mm; border-top: .25mm solid #cbd5dc; padding-top: 3mm; margin-top: 3mm; }
  .vinc-period { margin: 0; font-size: 8pt; font-weight: 700; color: #315c75; }
  .vinc-text { margin: 1mm 0 0; font-size: 9pt; font-weight: 600; line-height: 1.25; }
  .vinc-source { margin: 1mm 0 0; font-size: 8pt; line-height: 1.2; color: #435264; }
  .scope-cards { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; margin-top: 4mm; }
  .scope-card { border: .25mm solid #cbd5dc; border-radius: .25rem; padding: 3mm; }
  .acervo-stat-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 3mm; margin-top: 3mm; }
  .scope-card.card-sector { border-color: #c9b483; background: #fffcf6; }
  .scope-card.card-network { border-color: #b9acc3; background: #fcf9fd; }
  .scope-count { margin: 3mm 0 0; font-size: 16pt; font-weight: 600; font-variant-numeric: tabular-nums; }
  .scope-cards .tight-list { margin-top: 2mm; }
  .more-note { margin: 1.5mm 0 0; font-size: 8pt; font-weight: 600; color: #8a5a18; }
`

/**
 * Anchor → pack-section key of the flowing sheets. The builder maps an
 * overflowing sheet back to its pack entry and shrinks that chunk (fallback of
 * the measured pack plan).
 */
const SHARED_PACK_ANCHORS = {
  'era-a': 'era:A',
  'era-b': 'era:B',
  'era-c': 'era:C',
  lacunas: 'gaps',
  noticias: 'news',
  acervo: 'acervo',
}

const MUNICIPALITY_PACK_ANCHORS = {
  ...SHARED_PACK_ANCHORS,
  'regiao-municipio': 'region:municipio',
  'regiao-regional': 'region:regional',
}

export const INSTITUTION_PACK_ANCHORS = {
  ...SHARED_PACK_ANCHORS,
  titulos: 'honors',
  'abrangencia-instituicao': 'scope:instituicao',
  'abrangencia-setor': 'scope:setor',
  'abrangencia-rede': 'scope:rede',
}

const THEME_PACK_ANCHORS = {
  ...SHARED_PACK_ANCHORS,
  'abrangencia-area': 'scope:area',
  'abrangencia-segmento': 'scope:segmento',
  'abrangencia-rede': 'scope:rede',
}

/**
 * Probe-only CSS: the packed sections measure their true content height, with
 * no page clamp and no inter-row gaps (the packer adds the card-row gap back).
 */
const INSTITUTION_PROBE_CSS = `
  .sheet { height: auto; min-height: 0; overflow: visible; }
  [data-pack-section] .block,
  [data-pack-section] .action-grid,
  [data-pack-section] .document-table,
  [data-pack-section] .tight-list,
  [data-pack-section] .era-method,
  [data-pack-section] .page1-grid { margin-top: 0; }
  [data-pack-section] .action-grid,
  [data-pack-section] .era-method { gap: 0; }
  [data-pack-section] .tight-list li { margin-bottom: 0; }
`

const instHeader = (report, title, subtitle, pageNo) => `
  <header class="report-header">
    <div>
      <p class="report-kicker">${htmlEscape(report.unit.docLabel)} · ${htmlEscape(report.meta.subjectName)}</p>
      <h2 class="sheet-title">${htmlEscape(title)}</h2>
      ${subtitle ? `<p class="sheet-sub">${htmlEscape(subtitle)}</p>` : ''}
    </div>
    <div class="report-meta">
      <p><strong class="warning-text">INSUMO INTERNO — defeso 2026</strong></p>
      <p>Gerado em ${htmlEscape(formatDateTimeBr(report.meta.generatedAt))}</p>
      <p>pág. ${pageNo}/${report.meta.pageTotal}</p>
    </div>
  </header>`

/** Shared sheets (síntese, gráficos, carta, eras correntes) use the unit's shell. */
const unitHeader = (report, title, subtitle, pageNo) =>
  isSubjectUnit(report.unit)
    ? instHeader(report, title, subtitle, pageNo)
    : sheetHeader(report, title, subtitle, pageNo)

const unitFooter = (report, left, pageNo) =>
  isSubjectUnit(report.unit) ? instFooter(report, left, pageNo) : sheetFooter(report, left, pageNo)

const instFooter = (report, left, pageNo) => `
  <footer class="report-footer">
    <span>${htmlEscape(report.unit.docLabel)} · ${htmlEscape(report.meta.subjectName)} · ${htmlEscape(left)}</span>
    <span>Gerado em ${htmlEscape(formatDateTimeBr(report.meta.generatedAt))} · pág. ${pageNo}/${report.meta.pageTotal}</span>
  </footer>`

/** Singular of the capped-list nouns (never derive it by chopping the "s"). */
const CAPPED_NOUNS = {
  itens: 'item',
  entregas: 'entrega',
  vínculos: 'vínculo',
}

const moreNote = (
  cappedList,
  noun = 'itens',
  hint = 'com fonte fora desta página — nada foi descartado.',
) => {
  if (cappedList.omitted <= 0) return ''
  const label = cappedList.omitted === 1 ? (CAPPED_NOUNS[noun] ?? noun) : noun
  return `<p class="more-note">e mais ${cappedList.omitted} ${label} ${htmlEscape(hint)}</p>`
}

/* ---------------------------------------------------------------- *
 * Flowing sheets (C187): packed sections render as many sheets as  *
 * the content needs — nothing is capped. In probe mode a section   *
 * renders one sheet with every unit tagged (`data-pack-unit`), so  *
 * the builder measures real heights and returns a pack plan.       *
 * ---------------------------------------------------------------- */

const splitUnits = (units, sizes) => {
  const chunks = []
  let offset = 0
  for (const size of sizes) {
    chunks.push(units.slice(offset, offset + size))
    offset += size
  }
  if (offset < units.length) chunks.push(units.slice(offset))
  return chunks
}

/** Sheet plans of one section: `[{ key, anchor, chunk, index }]`. */
const packedSection = ({ key, anchor, units, pack, probe }) => {
  const sizes = probe ? null : pack?.[key]
  const chunks = sizes ? splitUnits(units, sizes) : [units]
  return chunks.map((chunk, index) => ({
    key,
    chunk,
    index,
    anchor: index === 0 ? anchor : `${anchor}-${index + 1}`,
  }))
}

const unitAttrs = (probe, index, layout) =>
  probe ? ` data-pack-unit="${index}" data-pack-layout="${layout}"` : ''

const groupUnits = (chunk) => {
  const groups = []
  for (const unit of chunk) {
    const last = groups[groups.length - 1]
    if (last && last.layout === unit.layout) last.units.push(unit)
    else groups.push({ layout: unit.layout, units: [unit] })
  }
  return groups
}

const tableHead = (columns) =>
  `<thead><tr>${columns.map((column) => `<th>${htmlEscape(column)}</th>`).join('')}</tr></thead>`

const identityBadgeList = (report) =>
  report.meta.identityBadges
    .map((badge) => `<span class="identity-badge">${htmlEscape(badge)}</span>`)
    .join(' ')

const coverRowValue = (report, row) => {
  if (row.badges) return `<dd>${identityBadgeList(report)}</dd>`
  if (row.code) {
    return `<dd><code>${htmlEscape(row.code)}</code>${row.note ? ` · ${htmlEscape(row.note)}` : ''}</dd>`
  }
  return `<dd${row.tabular ? ' class="tabular"' : ''}>${htmlEscape(row.text)}</dd>`
}

const renderSubjectCover = (report) => {
  const rows = [
    ...report.unit.coverRows(report),
    { label: 'Data de geração', text: formatDateTimeBr(report.meta.generatedAt), tabular: true },
    {
      label: 'Escopo e versão',
      text: `Eras A / B / C · ${report.unit.copy.coverScopeWords} · versão 01`,
    },
  ]
  return `
<article class="sheet sheet-cover" data-page="capa" aria-label="Capa do ${htmlEscape(report.unit.docLabel.toLowerCase())}">
  <div class="accent-bar"></div>
  <header class="cover-head">
    <div>
      <p class="report-kicker">${htmlEscape(report.cover.kicker)}</p>
      <p class="cover-series">${htmlEscape(report.cover.series)}</p>
    </div>
    <div class="internal-note"><strong>${htmlEscape(report.cover.internalNote)}</strong><br />${htmlEscape(report.cover.internalNoteSub)}</div>
  </header>

  <div class="cover-block">
    <p class="eyebrow">${htmlEscape(report.cover.eyebrow)}</p>
    <h1 class="cover-title">Dossiê Solla —<br /><span class="cover-accent">${htmlEscape(report.cover.title)}</span></h1>
    <p class="cover-sub">${htmlEscape(report.cover.subtitle)}</p>
  </div>

  <dl class="cover-dl">
    ${rows.map((row) => `<dt>${htmlEscape(row.label)}</dt>${coverRowValue(report, row)}`).join('\n    ')}
  </dl>

  <div class="cover-grid">
    <div class="how-to"><p class="how-to-title">Como usar</p><p>${htmlEscape(report.cover.howToUse)}</p></div>
    ${assetBox('NEEDS ASSET', report.unit.copy.coverAsset)}
  </div>

  <div class="cover-foot">
    <div class="ink-rule"></div>
    <div class="cover-foot-row">
      <p class="cover-scope">${htmlEscape(report.cover.scope)}</p>
      <p class="cover-version">Documento de trabalho<br />versão 01</p>
    </div>
  </div>
</article>`
}

const renderSubjectIdentity = (report) => {
  const rows = report.unit.identityRows(report.meta.identity ?? {})
  return `<div class="id-card">
    <p class="eyebrow">Identificação</p>
    <dl>${rows.map(([key, value]) => `<dt>${htmlEscape(key)}</dt><dd>${htmlEscape(value)}</dd>`).join('')}</dl>
  </div>`
}

const renderSubjectVincTimeline = (report) => {
  const timeline = report.page1.timeline
  if (timeline.items.length === 0) {
    return `<p class="muted small">${htmlEscape(report.unit.copy.timelineEmpty)}</p>`
  }
  return `
    <div class="vinc-timeline">
      ${timeline.items
        .map(
          (row) => `<div class="timeline-item">
            <p class="vinc-period">${htmlEscape(row.period || '—')}</p>
            <p class="vinc-text">${copyHtml(briefOr(row.brief, row.role))}</p>
            <p class="vinc-source">${htmlEscape(row.source ?? '')} ${sourceLink(row.url)}</p>
          </div>`,
        )
        .join('')}
    </div>
    ${moreNote(timeline, 'vínculos', 'com fonte — lista completa nas seções por era.')}`
}

const renderSubjectDeliveries = (report) => {
  const deliveries = report.page1.deliveries
  if (deliveries.items.length === 0) return ''
  return `
  <section class="block">
    <div class="block-head">
      <div><p class="eyebrow">02 · destaques com lastro</p><h3 class="section-title">Principais entregas localizadas</h3></div>
      <p class="warning-text meta strong">Cada valor mantém a fase e a abrangência</p>
    </div>
    <div class="deliveries">
      ${deliveries.items
        .map(
          (row) => `<div class="delivery-row">
            <div class="delivery-scope">${scopeBadge(row.sphere, null, report.unit)}<p class="meta">Era ${htmlEscape(row.era)}${row.year ? ` · ${htmlEscape(row.year)}` : ''}</p></div>
            <div>
              <p class="delivery-title">${copyHtml(briefOr(row.brief, row.title))}</p>
              ${noteOr(row.brief, row.detail) ? `<p class="muted small">${copyHtml(noteOr(row.brief, row.detail))}</p>` : ''}
            </div>
            <div class="delivery-value">
              <p class="value-big tabular">${valueCell(row.value, 'Valor não informado')}</p>
              ${row.phase ? phaseBadge(row.phase) : ''}
              ${sourceLink(row.sourceUrl)}
            </div>
          </div>`,
        )
        .join('')}
    </div>
    ${moreNote(deliveries, 'entregas', 'com fonte — lista completa nas seções por era e de abrangência.')}
    <p class="muted small strong">Guarda de leitura: autorizado ≠ empenhado ≠ liquidado ≠ pago. A fase acompanha cada valor.</p>
  </section>`
}

const renderSubjectHooksAndPending = (report) => {
  const hooks = report.page1.hooks
  const pending = report.page1.pending
  if (hooks.items.length === 0 && pending.items.length === 0) return ''
  return `
  <section class="page1-grid">
    ${
      hooks.items.length
        ? `<div class="panel">
            <p class="eyebrow">Gancho para a agenda</p>
            <ul class="tight-list">${hooks.items
              .map(
                (hook) =>
                  `<li><strong>${htmlEscape(hook.topic)}:</strong> ${copyHtml(briefOr(hook.brief, hook.angle))} ${sourceLink(hook.sourceUrl)}</li>`,
              )
              .join('')}</ul>
          </div>`
        : '<div></div>'
    }
    ${
      pending.items.length
        ? `<div class="panel panel-warning">
            <p class="eyebrow warning-text">O que falta</p>
            <ul class="tight-list">${pending.items.map((item) => `<li>${htmlEscape(item)}</li>`).join('')}</ul>
            <p class="warning-text small strong">Ausência é resultado: não completar por inferência.</p>
          </div>`
        : '<div></div>'
    }
  </section>`
}

const renderSubjectSummary = (report, pageNo) => `
<article class="sheet" data-page="resumo" aria-label="Resumo de uma olhada do ${htmlEscape(report.unit.docLabel.toLowerCase())}">
  ${instHeader(report, 'Resumo de uma olhada', 'Informação datada e pronta para conferência', pageNo)}
  <section class="summary-top">
    ${renderSubjectIdentity(report)}
    <div>
      <p class="eyebrow">${htmlEscape(report.unit.summaryLinkEyebrow)}</p>
      <h3 class="section-title">Linha do tempo documentada</h3>
      ${renderSubjectVincTimeline(report)}
    </div>
  </section>
  ${renderSubjectDeliveries(report)}
  ${renderSubjectHooksAndPending(report)}
  ${instFooter(report, 'Resumo · INSUMO INTERNO', pageNo)}
</article>`

const renderEraEmptySheet = (report, era, pageNo) => {
  const empty = report.unit.copy.eraEmpty
  return `
<article class="sheet" data-page="era-${era.id.toLowerCase()}" aria-label="${htmlEscape(era.label)}">
  ${unitHeader(report, `${era.label} · Pesquisa sem evidência suficiente`, era.period, pageNo)}
  <div class="era-method">
    <div>
      <p class="eyebrow">Recorte previsto</p>
      <p class="muted">${htmlEscape(era.method)}</p>
    </div>
    <aside class="aside-accent"><strong>Trilha tentada</strong><br />${htmlEscape(era.recovery)}</aside>
  </div>
  <section class="empty-panel" style="margin-top: 5mm">
    ${WARNING_ICON}
    <p class="eyebrow warning-text">Lacuna explícita · não é “zero”</p>
    <h3 class="rule-title">Nenhuma fonte suficiente foi localizada para esta era.</h3>
    <p class="muted">${htmlEscape(empty.body)}</p>
  </section>
  <section class="page1-grid">
    <div class="panel">
      <p class="eyebrow">O que foi feito</p>
      <ul class="tight-list">
        ${empty.work.map((item) => `<li>${htmlEscape(item)}</li>`).join('\n        ')}
      </ul>
    </div>
    <div class="panel">
      <p class="eyebrow">O que falta fazer</p>
      <ul class="tight-list">
        ${empty.todo.map((item) => `<li>${htmlEscape(item)}</li>`).join('\n        ')}
      </ul>
    </div>
  </section>
  <aside class="rule-warning">
    ${WARNING_ICON}
    <div>
      <p class="eyebrow warning-text">Regra editorial</p>
      <p>${(() => {
        const rule = empty.rule(era.label)
        const splitAt = rule.indexOf('. ')
        return splitAt === -1
          ? htmlEscape(rule)
          : `<strong>${htmlEscape(rule.slice(0, splitAt + 1))}</strong> ${htmlEscape(rule.slice(splitAt + 2))}`
      })()}</p>
    </div>
  </aside>
  ${unitFooter(report, `${era.label} · lacuna explícita`, pageNo)}
</article>`
}

/** Accepts the institution's capped objects and the city's plain arrays. */
const listOf = (value) => (Array.isArray(value) ? value : (value?.items ?? []))

/**
 * Era units: value rows (table), action cards (2-col grid) and — city only, which
 * keeps honors in the era sheet — the honor list items. Honors have their own
 * sheet in the institution dossiê, so `includeHonors` stays false there.
 */
const eraUnits = (report, era, probe, { includeHonors = false } = {}) => {
  const unit = report.unit ?? MUNICIPALITY_UNIT
  const units = []
  for (const row of listOf(era.numbers)) {
    units.push({
      layout: 'tr',
      html: `<tr${unitAttrs(probe, units.length, 'tr')}>
                  <td>${htmlEscape(row.object)}</td>
                  <td class="numeric">${valueCell(row.value, 'Valor a recuperar')}</td>
                  <td class="numeric">${htmlEscape(row.year ?? '—')}</td>
                  <td>${phaseBadge(row.phase)}</td>
                  <td>${scopeBadge(row.sphere, null, unit)}</td>
                  <td>${sourceLink(row.sourceUrl)}${
                    row.sphere !== unit.defaultSphere
                      ? `<br /><span class="meta">${htmlEscape(unit.notSummedInline ?? 'não somar')}</span>`
                      : ''
                  }</td>
                </tr>`,
    })
  }
  for (const action of listOf(era.actions)) {
    units.push({
      layout: 'card',
      html: `<article class="panel"${unitAttrs(probe, units.length, 'card')}>
                  <div class="action-head">${scopeBadge(action.sphere, null, unit)}<span class="meta">${htmlEscape(action.year ?? '—')}</span></div>
                  <h4 class="action-title">${copyHtml(briefOr(action.brief, action.title))}</h4>
                  ${noteOr(action.brief, action.detail) ? `<p class="muted small">${copyHtml(noteOr(action.brief, action.detail))}</p>` : ''}
                  ${sourceLink(action.sourceUrl)}
                </article>`,
    })
  }
  if (includeHonors) {
    for (const honor of listOf(era.honors)) {
      units.push({
        layout: 'li',
        html: `<li${unitAttrs(probe, units.length, 'li')}>${copyHtml(briefOr(honor.brief, honor.text))} ${sourceLink(honor.sourceUrl)}</li>`,
      })
    }
  }
  return units
}

const eraNumbersTable = (units, unit) => `
          <table class="document-table">
            <caption class="sr-only">Valores por ano, fase, esfera e fonte</caption>
            <colgroup><col style="width:26%" /><col style="width:15%" /><col style="width:10%" /><col style="width:17%" /><col style="width:12%" /><col style="width:20%" /></colgroup>
            ${tableHead(['Objeto', 'Valor', 'Ano', 'Fase', unit.sphereColumnLabel ?? 'Esfera', 'Fonte'])}
            <tbody>${units.map((entry) => entry.html).join('')}</tbody>
          </table>`

const eraHonorsPanel = (units, unit) => `
  <section class="block honors">
    <div class="panel">
      <p class="eyebrow">${htmlEscape(unit.honorsTitle ?? 'Títulos, honrarias e vínculos')}</p>
      <ul class="tight-list">${units.map((entry) => entry.html).join('')}</ul>
    </div>
    ${assetBox('NEEDS ASSET', ['reprodução do ato ou clipping', 'somente com origem e licença'])}
  </section>`

const renderEraSheet = ({ report, era, entry, probe, pageNo }) => {
  const unit = report.unit ?? MUNICIPALITY_UNIT
  const body = groupUnits(entry.chunk)
    .map((group) => {
      if (group.layout === 'tr') {
        return `<section class="block">
          <div class="block-head">
            <div><p class="eyebrow">Entregas localizadas</p><h3 class="section-title">${htmlEscape(unit.eraNumbersTitle ?? 'Objeto, valor, fase e alcance')}</h3></div>
          </div>
          ${eraNumbersTable(group.units, unit)}
          <p class="warning-text small strong">Não consolidar fases como se fossem equivalentes. Um valor empenhado não é um valor pago.</p>
        </section>`
      }
      if (group.layout === 'li') return eraHonorsPanel(group.units, unit)
      return `<section class="block">
          <p class="eyebrow">Atuação registrada</p>
          <h3 class="section-title">${htmlEscape(unit.eraActionsTitle ?? 'Papéis com evidência visível')}</h3>
          <div class="action-grid">${group.units.map((item) => item.html).join('')}</div>
        </section>`
    })
    .join('')
  return `
<article class="sheet" data-page="${entry.anchor}"${probe ? ` data-pack-section="era:${era.id}"` : ''} aria-label="${htmlEscape(era.label)}">
  ${unitHeader(report, era.label, entry.index === 0 ? `${era.period} · ${era.subtitle}` : `continuação ${entry.index + 1} · ${era.period}`, pageNo)}

  ${
    entry.index === 0
      ? `<div class="era-method"${probe ? ' data-pack-fixed="method"' : ''}>
    <div>
      <p class="eyebrow">Recorte e método</p>
      <p class="muted">${htmlEscape(era.method)}</p>
    </div>
    <aside class="aside-accent"><strong>Trilha de recuperação</strong><br />${htmlEscape(era.recovery)}</aside>
  </div>`
      : ''
  }

  ${
    entry.index === 0 && (era.narrative || era.summary)
      ? `<section class="era-summary"${probe ? ' data-pack-fixed="summary"' : ''}>
    <p class="eyebrow">O que esta era entrega</p>
    <p>${copyHtml(era.narrative ?? era.summary)}</p>
  </section>`
      : ''
  }

  ${body}

  ${unitFooter(report, era.label, pageNo)}
</article>`
}

const renderEraSheets = ({ report, era, pack, probe, nextPage, includeHonors = false }) => {
  if (era.empty) return [renderEraEmptySheet(report, era, nextPage())]
  const units = eraUnits(report, era, probe, { includeHonors })
  return packedSection({
    key: `era:${era.id}`,
    anchor: `era-${era.id.toLowerCase()}`,
    units,
    pack,
    probe,
  }).map((entry) => renderEraSheet({ report, era, entry, probe, pageNo: nextPage() }))
}

const PACK_ANCHORS_BY_UNIT = {
  municipality: MUNICIPALITY_PACK_ANCHORS,
  institution: INSTITUTION_PACK_ANCHORS,
  theme: THEME_PACK_ANCHORS,
}

/** Anchor map of the unit's packed sections (the builder inverts it). */
export const dossierPackAnchors = (unit) =>
  PACK_ANCHORS_BY_UNIT[resolveDossierUnit(unit).id] ?? MUNICIPALITY_PACK_ANCHORS

const listYearRange = (items) => {
  const years = items
    .map((item) => item.year)
    .filter(Boolean)
    .sort()
  return years.length ? `${years[0]}–${years[years.length - 1]}` : null
}

const renderSubjectScope = (report, pageNo) => {
  const reach = report.reach
  const sphereTitle = report.unit.spheres
    .map((sphere) => report.unit.sphereLabels[sphere])
    .join(' × ')
  return `
<article class="sheet" data-page="abrangencia" aria-label="${htmlEscape(report.unit.aria?.scope ?? 'Painel de abrangência institucional')}">
  ${instHeader(report, `Abrangência: ${sphereTitle}`, 'Três recortes, três leituras, nenhuma soma combinada', pageNo)}

  <section class="rule-warning">
    ${WARNING_ICON}
    <div>
      <p class="rule-title">${htmlEscape(reach.ruleTitle)}</p>
      <p class="muted">${htmlEscape(reach.ruleBody)}</p>
    </div>
  </section>

  <section class="block">
    <p class="eyebrow">Leitura lado a lado</p>
    <h3 class="section-title">O alcance acompanha cada evidência</h3>
    <div class="scope-cards">
      ${reach.lists
        .map(
          (list) => `<article class="scope-card ${report.unit.scopeCardClass[list.sphere] ?? ''}">
            <div class="action-head">${scopeBadge(list.sphere, null, report.unit)}<span class="meta strong">${list.sphere === report.unit.defaultSphere ? 'DIRETO' : 'NÃO SOMAR'}</span></div>
            <p class="scope-count tabular">${list.total} ${list.total === 1 ? 'item' : 'itens'}</p>
            <p class="meta">com fonte${listYearRange(list.items) ? ` · ${listYearRange(list.items)}` : ''} · lista completa nas páginas seguintes</p>
            <ul class="tight-list">${list.items
              .slice(0, 2)
              .map(
                (item) =>
                  `<li>${copyHtml(briefOr(item.brief, item.title))} ${sourceLink(item.sourceUrl)}</li>`,
              )
              .join(
                '',
              )}${list.items.length === 0 ? '<li class="muted">Nenhum item com fonte.</li>' : ''}</ul>
          </article>`,
        )
        .join('')}
    </div>
  </section>

  ${
    reach.hook || reach.priorityGap
      ? `<section class="page1-grid">
          ${
            reach.hook
              ? `<div class="aside-accent"><p class="eyebrow">Gancho possível</p><p><strong>${htmlEscape(reach.hook.topic)}:</strong> ${copyHtml(briefOr(reach.hook.brief, reach.hook.angle))} ${sourceLink(reach.hook.sourceUrl)}</p></div>`
              : '<div></div>'
          }
          ${
            reach.priorityGap
              ? `<div class="panel panel-warning"><p class="eyebrow warning-text">Lacuna prioritária</p><p>${htmlEscape(reach.priorityGap)}</p></div>`
              : '<div></div>'
          }
        </section>`
      : ''
  }

  ${instFooter(report, 'Abrangência · recortes não somáveis', pageNo)}
</article>`
}

/** Sphere lists are uncapped: each one flows across as many sheets as it needs. */
const subjectScopeUnits = (report, list, probe) =>
  list.items.map((item, index) => {
    const attrs = unitAttrs(probe, index, 'tr')
    if (!report.unit.reachScene) {
      return {
        layout: 'tr',
        html: `<tr${attrs}>
            <td>${copyHtml(briefOr(item.brief, item.title))}</td>
            <td>${scopeBadge(item.sphere, null, report.unit)}</td>
            <td>${copyHtml(noteOr(item.brief, item.evidence))}</td>
            <td>${sourceLink(item.sourceUrl)}</td>
          </tr>`,
      }
    }
    return {
      layout: 'tr',
      html: `<tr${attrs}>
            <td>${copyHtml(briefOr(item.brief, item.title))}</td>
            <td class="nowrap">Era ${htmlEscape(item.era ?? '—')}${item.year ? ` · ${htmlEscape(item.year)}` : ''}</td>
            <td>${valueCell(item.value)}${item.phase ? ` ${phaseBadge(item.phase)}` : ''}</td>
            <td>${copyHtml(noteOr(item.brief, item.evidence))}</td>
            <td>${sourceLink(item.sourceUrl)}</td>
          </tr>`,
    }
  })

const scopeListWord = (report, list) => report.unit.scopeListWords[list.key] ?? list.key

const renderSubjectScopeListSheet = ({ report, list, entry, probe, pageNo }) => {
  const scene = report.unit.reachScene
  const word = scopeListWord(report, list)
  const notSummable = list.sphere !== report.unit.defaultSphere
  const columns = scene ? scene.columns : ['Item', 'Abrangência', 'Evidência de alcance', 'Fonte']
  const tableClass = scene ? `document-table ${scene.tableClass}` : 'document-table'
  const colgroup = scene
    ? '<colgroup><col style="width:24%" /><col style="width:13%" /><col style="width:16%" /><col style="width:29%" /><col style="width:18%" /></colgroup>'
    : '<colgroup><col style="width:26%" /><col style="width:14%" /><col style="width:40%" /><col style="width:20%" /></colgroup>'
  return `
<article class="sheet" data-page="${entry.anchor}"${probe ? ` data-pack-section="scope:${word}"` : ''} aria-label="${htmlEscape(`Abrangência · ${list.label}`)}">
  ${instHeader(
    report,
    `Abrangência · ${list.label}`,
    entry.index === 0
      ? `${list.total} ${list.total === 1 ? 'item' : 'itens'} com fonte · ${notSummable ? `não somar ${report.unit.notSummedTo}` : 'recorte direto'}`
      : `continuação ${entry.index + 1} · ${list.total} ${list.total === 1 ? 'item' : 'itens'} com fonte`,
    pageNo,
  )}
  ${
    entry.index === 0
      ? `<section class="rule-warning">
    ${WARNING_ICON}
    <div>
      <p class="rule-title">${htmlEscape(report.reach.ruleTitle)}</p>
      <p class="muted">Cada linha informa sua abrangência; ${htmlEscape(report.unit.sumGuardNote)}</p>
    </div>
  </section>`
      : ''
  }
  <section class="block">
    <table class="${tableClass}">
      <caption class="sr-only">Itens do recorte com evidência de alcance e fonte</caption>
      ${colgroup}
      ${tableHead(columns)}
      <tbody>${entry.chunk.map((unit) => unit.html).join('')}</tbody>
    </table>
  </section>
  ${instFooter(report, `Abrangência · ${list.label}`, pageNo)}
</article>`
}

const renderSubjectScopeListSheets = ({ report, list, pack, probe, nextPage }) => {
  if (list.items.length === 0) return []
  const word = scopeListWord(report, list)
  const units = subjectScopeUnits(report, list, probe)
  return packedSection({
    key: `scope:${word}`,
    anchor: `abrangencia-${word}`,
    units,
    pack,
    probe,
  }).map((entry) => renderSubjectScopeListSheet({ report, list, entry, probe, pageNo: nextPage() }))
}

const honorDate = (honor) => {
  if (honor.date) return formatDateBr(honor.date)
  if (honor.year) return String(honor.year)
  return '—'
}

const subjectHonors = (report) => report.eras.find((era) => era.id === 'C')?.honors?.items ?? []

const subjectHonorUnits = (probe) =>
  subjectHonors(probe.report).map((honor, index) => ({
    layout: 'tr',
    html: `<tr${unitAttrs(probe.probe, index, 'tr')}>
            <td class="numeric">${htmlEscape(honorDate(honor))}</td>
            <td><span class="identity-badge">reconhecimento</span></td>
            <td><strong>${copyHtml(briefOr(honor.brief, honor.text))}</strong>${noteOr(honor.brief, honor.detail) ? `<br /><span class="meta">${copyHtml(noteOr(honor.brief, honor.detail))}</span>` : ''}</td>
            <td>${sourceLink(honor.sourceUrl)}</td>
          </tr>`,
  }))

const renderSubjectHonorSheet = ({ report, entry, probe, pageNo }) => {
  const gap = report.gaps?.[0] ?? null
  const hook = report.reach.hook ?? report.page1.hooks.items[0] ?? null
  return `
<article class="sheet" data-page="${entry.anchor}"${probe ? ' data-pack-section="honors"' : ''} aria-label="Títulos, honrarias e vínculos institucionais">
  ${instHeader(
    report,
    'Títulos, honrarias e vínculos',
    entry.index === 0
      ? 'Reconhecimento não substitui entrega; vínculo não prova resultado'
      : `continuação ${entry.index + 1}`,
    pageNo,
  )}
  <section class="block">
    <p class="eyebrow">Registros confirmados</p>
    <h3 class="section-title">Data, natureza e fonte primária</h3>
    <table class="document-table">
      <caption class="sr-only">Títulos, honrarias e vínculos por data e fonte</caption>
      <colgroup><col style="width:14%" /><col style="width:20%" /><col style="width:35%" /><col style="width:31%" /></colgroup>
      ${tableHead(['Data', 'Natureza', 'Registro', 'Fonte'])}
      <tbody>${entry.chunk.map((unit) => unit.html).join('')}</tbody>
    </table>
  </section>
  ${
    entry.index === 0
      ? `<section class="block honors">
    <div>
      <p class="eyebrow">Como ler</p>
      <div class="action-grid">
        <div class="panel">
          <h3 class="action-title">Vínculo documentado</h3>
          <p class="muted small">Informa papel, unidade e período. Não autoriza atribuir toda ação posterior da instituição.</p>
        </div>
        <div class="panel">
          <h3 class="action-title">Honraria documentada</h3>
          <p class="muted small">Registra reconhecimento e órgão concedente. Não vira prova de recurso ou entrega.</p>
        </div>
      </div>
    </div>
    ${assetBox('NEEDS ASSET', ['reprodução do ato, diploma ou clipping', 'origem, autoria e licença'])}
  </section>
  <section class="page1-grid">
    <div class="aside-accent">
      <p class="eyebrow">Gancho para a agenda</p>
      <p>${hook ? `<strong>${htmlEscape(hook.topic)}:</strong> ${copyHtml(briefOr(hook.brief, hook.angle))}` : 'Mencionar um vínculo só na formulação que a fonte sustenta e conectá-lo a uma entrega comprovada, se houver.'}</p>
    </div>
    <div class="panel panel-warning">
      <p class="eyebrow warning-text">Pendência documental</p>
      <p>${gap ? `${htmlEscape(gap.label)}: ${htmlEscape(gap.reason)}` : 'Nenhuma pendência declarada para os registros desta página.'}</p>
    </div>
  </section>`
      : ''
  }
  ${instFooter(report, 'Títulos e vínculos · INSUMO INTERNO', pageNo)}
</article>`
}

const renderSubjectHonorSheets = ({ report, pack, probe, nextPage }) => {
  const units = subjectHonorUnits({ report, probe })
  if (units.length === 0) return []
  return packedSection({ key: 'honors', anchor: 'titulos', units, pack, probe }).map((entry) =>
    renderSubjectHonorSheet({ report, entry, probe, pageNo: nextPage() }),
  )
}

/**
 * Gaps and news are long full-text tables: packed in continuation sheets, so
 * the sources sheet keeps only the acervo, limits and defeso.
 */
const gapUnits = (report, probe) =>
  report.gaps.map((gap, index) => {
    const attrs = unitAttrs(probe, index, 'tr')
    if (!report.unit.gapsScene) {
      return {
        layout: 'tr',
        html: `<tr${attrs}>
              <td><strong>${htmlEscape(gap.label)}</strong></td>
              <td>${htmlEscape(gap.reason)}</td>
              <td>Não completar por inferência.</td>
              <td>${htmlEscape(gap.nextStep)}</td>
            </tr>`,
      }
    }
    const era = gap.era && gap.era !== 'Acervo' ? `Era ${gap.era}` : 'Acervo'
    const status =
      index === 0
        ? '<span class="phase phase-pending">prioridade</span>'
        : '<span class="phase">aberta</span>'
    return {
      layout: 'tr',
      html: `<tr${attrs}>
              <td class="nowrap">${htmlEscape(era)}</td>
              <td><strong>${htmlEscape(gap.label)}</strong></td>
              <td>${htmlEscape(gap.reason)}</td>
              <td>${htmlEscape(gap.nextStep)}</td>
              <td>${status}</td>
            </tr>`,
    }
  })

const renderGapSheet = ({ report, entry, probe, pageNo, isLast = false }) => {
  const scene = report.unit.gapsScene
  const columns = scene
    ? scene.columns
    : ['Lacuna', 'Situação da busca', 'Limite editorial', 'Próximo passo']
  const colgroup = scene
    ? '<colgroup><col style="width:12%" /><col style="width:26%" /><col style="width:24%" /><col style="width:22%" /><col style="width:16%" /></colgroup>'
    : '<colgroup><col style="width:26%" /><col style="width:30%" /><col style="width:24%" /><col style="width:20%" /></colgroup>'
  return `
<article class="sheet" data-page="${entry.anchor}"${probe ? ' data-pack-section="gaps"' : ''} aria-label="Lacunas explícitas">
  ${unitHeader(report, 'Lacunas explícitas', `O que não foi encontrado${entry.index > 0 ? ` · continuação ${entry.index + 1}` : ''}`, pageNo)}
  <section class="block">
    <div class="block-head"><div><p class="eyebrow">O que não foi encontrado</p><h3 class="section-title">Lacunas explícitas</h3></div><p class="warning-text meta strong">Não completar por memória ou inferência</p></div>
    <table class="document-table">
      <caption class="sr-only">Tabela de lacunas explícitas e próximos passos de apuração</caption>
      ${colgroup}
      ${tableHead(columns)}
      <tbody>${
        entry.chunk.length
          ? entry.chunk.map((unit) => unit.html).join('')
          : `<tr><td colspan="${columns.length}" class="muted">Nenhuma lacuna declarada — confira a cobertura das eras.</td></tr>`
      }</tbody>
    </table>
    ${scene && isLast ? `<p class="warning-text small strong">${htmlEscape(scene.alert)}</p>` : ''}
  </section>
  ${unitFooter(report, 'Lacunas explícitas · INSUMO INTERNO', pageNo)}
</article>`
}

const renderGapSheets = ({ report, pack, probe, nextPage }) => {
  const units = gapUnits(report, probe)
  if (units.length === 0) {
    return [
      renderGapSheet({
        report,
        entry: { anchor: 'lacunas', chunk: [], index: 0 },
        probe: false,
        pageNo: nextPage(),
        isLast: true,
      }),
    ]
  }
  const entries = packedSection({ key: 'gaps', anchor: 'lacunas', units, pack, probe })
  return entries.map((entry, index) =>
    renderGapSheet({
      report,
      entry,
      probe,
      pageNo: nextPage(),
      isLast: index === entries.length - 1,
    }),
  )
}

const newsUnits = (report, probe) =>
  report.news.map((row, index) => ({
    layout: 'tr',
    html: `<tr${unitAttrs(probe, index, 'tr')}>
            <td class="numeric nowrap">${htmlEscape(formatShortDateBr(row.date))}</td>
            <td>${htmlEscape(row.outlet)}</td>
            <td>${htmlEscape(row.title)}</td>
            <td>${sourceLink(row.url, '(fonte)')}</td>
          </tr>`,
  }))

const renderNewsSheet = ({ report, entry, probe, pageNo }) => `
<article class="sheet" data-page="${entry.anchor}"${probe ? ' data-pack-section="news"' : ''} aria-label="Notícias e documentos consultados">
  ${unitHeader(report, 'Notícias e documentos consultados', `Fontes externas datadas${entry.index > 0 ? ` · continuação ${entry.index + 1}` : ''}`, pageNo)}
  <section class="block">
    <p class="eyebrow">Lista clicável</p>
    <h3 class="section-title">Notícias e documentos consultados</h3>
    <table class="document-table">
      <caption class="sr-only">Fontes consultadas: data 12%, veículo 13%, título 47% e link 28%</caption>
      <colgroup><col style="width:12%" /><col style="width:13%" /><col style="width:47%" /><col style="width:28%" /></colgroup>
      ${tableHead(['Data', 'Veículo', 'Título', 'Link'])}
      <tbody>${entry.chunk.map((unit) => unit.html).join('')}</tbody>
    </table>
  </section>
  ${unitFooter(report, 'Notícias e documentos · INSUMO INTERNO', pageNo)}
</article>`

const renderNewsSheets = ({ report, pack, probe, nextPage }) => {
  const units = newsUnits(report, probe)
  if (units.length === 0) return []
  return packedSection({ key: 'news', anchor: 'noticias', units, pack, probe }).map((entry) =>
    renderNewsSheet({ report, entry, probe, pageNo: nextPage() }),
  )
}

/** Acervo sample (source panel): declared sample with the total carried by the header. */
const acervoUnits = (report, probe) =>
  report.acervo.items.map((row, index) => {
    const attrs = unitAttrs(probe, index, 'tr')
    if (!report.unit.acervoScene) {
      return {
        layout: 'tr',
        html: `<li${attrs}><strong>${htmlEscape(row.period)}</strong> — ${copyHtml(row.text)} ${sourceLink(row.sourceUrl)}</li>`,
      }
    }
    const identity = report.meta.identity ?? {}
    const canonical = [
      identity.label,
      identity.value ? `<code>${htmlEscape(identity.value)}</code>` : null,
    ]
      .filter(Boolean)
      .join(' ')
    return {
      layout: 'tr',
      html: `<tr${attrs}>
              <td class="numeric nowrap">${htmlEscape(row.period)}</td>
              <td>${canonical}</td>
              <td>${copyHtml(row.text)}${row.excerpt ? `<br /><span class="meta">${copyHtml(row.excerpt)}</span>` : ''}</td>
              <td>${scopeBadge('area', null, report.unit)}</td>
              <td>${sourceLink(row.sourceUrl)}</td>
            </tr>`,
    }
  })

const acervoStatLabel = (scene, key, fallback) =>
  scene.stats?.find((stat) => stat.key === key)?.label ?? fallback

const renderAcervoSheet = ({ report, entry, probe, pageNo, isLast }) => {
  const scene = report.unit.acervoScene
  return `
<article class="sheet" data-page="${entry.anchor}"${probe ? ' data-pack-section="acervo"' : ''} aria-label="Acervo interno de falas (amostra)">
  ${unitHeader(
    report,
    'Acervo interno de falas (amostra)',
    entry.index === 0
      ? `Base Teqo 2011+ · ${report.acervo.items.length} de ${report.acervo.recorte} falas do recorte, com link · ${htmlEscape(report.unit.acervoNote ?? '')}`
      : `continuação ${entry.index + 1}`,
    pageNo,
  )}
  ${
    scene && entry.index === 0
      ? `<section class="acervo-stat-grid">
    <div class="scope-card">
      <p class="eyebrow">${htmlEscape(acervoStatLabel(scene, 'universe', 'Universo recuperado'))}</p>
      <p class="scope-count tabular">${report.acervo.recorte}</p>
      <p class="meta">Falas classificadas no tema canônico do recorte (2011+).</p>
    </div>
    <div class="scope-card card-sector">
      <p class="eyebrow warning-text">${htmlEscape(acervoStatLabel(scene, 'sample', 'Amostra exibida'))}</p>
      <p class="scope-count tabular">${report.acervo.items.length} de ${report.acervo.recorte}</p>
      <p class="meta">Quantidade e critério explícitos; a amostra não finge exaustividade.</p>
    </div>
  </section>`
      : ''
  }
  <section class="block">
    <p class="eyebrow">Falas do mandato sobre o recorte</p>
    <h3 class="section-title">Amostra com link direto</h3>
    ${
      scene
        ? `<table class="document-table">
      <caption class="sr-only">Amostra do acervo por data, tema canônico, trecho e abrangência</caption>
      <colgroup><col style="width:11%" /><col style="width:20%" /><col style="width:37%" /><col style="width:12%" /><col style="width:20%" /></colgroup>
      ${tableHead(scene.columns)}
      <tbody>${entry.chunk.map((unit) => unit.html).join('')}</tbody>
    </table>`
        : `<ul class="tight-list">${entry.chunk.map((unit) => unit.html).join('')}</ul>`
    }
    ${
      isLast
        ? `<p class="more-note">Amostra das falas mais recentes do recorte (${report.acervo.items.length} de ${report.acervo.recorte}); o acervo completo fica na base Teqo. ${htmlEscape(report.unit.acervoNote ?? '')}</p>`
        : ''
    }
    ${scene && isLast ? `<p class="warning-text small strong">${htmlEscape(scene.alert)}</p>` : ''}
  </section>
  ${unitFooter(report, 'Acervo interno · amostra', pageNo)}
</article>`
}

const renderAcervoSheets = ({ report, pack, probe, nextPage }) => {
  const units = acervoUnits(report, probe)
  if (units.length === 0) return []
  const entries = packedSection({ key: 'acervo', anchor: 'acervo', units, pack, probe })
  return entries.map((entry, index) =>
    renderAcervoSheet({
      report,
      entry,
      probe,
      pageNo: nextPage(),
      isLast: index === entries.length - 1,
    }),
  )
}

const renderUnitSourcesPage = (report, pageNo) => `
<article class="sheet" data-page="fontes" aria-label="${htmlEscape(report.unit.aria?.sources ?? 'Fontes e limites do dossiê institucional')}">
  ${unitHeader(report, 'Fontes e limites', 'O que foi consultado e o que não se pode afirmar', pageNo)}

  ${
    report.unit.sourcesHierarchy
      ? `<section class="block">
    <p class="eyebrow">Hierarquia de fontes</p>
    <h3 class="section-title">Lastro visível, item a item</h3>
    <table class="document-table">
      <caption class="sr-only">Camadas de fonte, seu uso e seu limite</caption>
      <colgroup><col style="width:24%" /><col style="width:38%" /><col style="width:38%" /></colgroup>
      ${tableHead(['Camada', 'Uso', 'Limite'])}
      <tbody>${report.unit.sourcesHierarchy
        .map(
          (row) =>
            `<tr><td><strong>${htmlEscape(row.layer)}</strong></td><td>${htmlEscape(row.use)}</td><td>${htmlEscape(row.limit)}</td></tr>`,
        )
        .join('')}</tbody>
    </table>
  </section>`
      : ''
  }

  ${
    report.acervo?.recorte
      ? `<section class="rule-warning">
    ${WARNING_ICON}
    <div>
      <p class="rule-title">Acervo interno: ${report.acervo.recorte} falas no recorte.</p>
      <p class="muted">A amostra com link (${report.acervo.items.length} de ${report.acervo.recorte}) está na seção anterior; o acervo completo fica na base Teqo. ${htmlEscape(report.unit.acervoNote ?? '')}</p>
    </div>
  </section>`
      : ''
  }

  <section class="page1-grid">
    <div class="panel"><p class="eyebrow">Limites de cobertura</p><ul class="tight-list">${report.limits.coverage
      .map((item) => `<li>${htmlEscape(item)}</li>`)
      .join('')}</ul></div>
    <div class="panel"><p class="eyebrow">Regras para uso editorial</p><ul class="tight-list">${report.limits.editorial
      .map((item) => `<li>${htmlEscape(item)}</li>`)
      .join('')}</ul></div>
  </section>

  <aside class="rule-warning defeso">
    ${WARNING_ICON}
    <div>
      <p class="eyebrow warning-text">Nota de defeso eleitoral 2026</p>
      <h3 class="rule-title">Insumo interno não é autorização para publicar.</h3>
      <p class="muted">Publicidade institucional e propaganda eleitoral obedecem a regimes diferentes. Antes de adaptar qualquer trecho para peça externa, submeta texto, imagem, autoria, período e canal à revisão responsável. Este dossiê organiza evidências; não substitui análise jurídica nem editorial.</p>
    </div>
  </aside>

  ${unitFooter(report, 'Fontes e limites · INSUMO INTERNO', pageNo)}
</article>`

const renderUnitSynthesisPage = (report, pageNo) => `
<article class="sheet" data-page="sintese" aria-label="${htmlEscape(report.unit.aria?.synthesis ?? 'Síntese da atuação institucional')}">
  ${unitHeader(report, 'Síntese do que foi localizado', 'Leitura dos números com lastro — contagens por recorte, nunca soma entre eles', pageNo)}
  <section class="block">
    <p class="eyebrow">Leitura rápida</p>
    <h3 class="section-title">O que os pontos com fonte mostram</h3>
    <ul class="synthesis-lines">${report.synthesis.lines.map((line) => `<li>${htmlEscape(line)}</li>`).join('')}</ul>
  </section>
  <section class="synthesis-grid">
    <div class="panel">
      <p class="eyebrow">Cobertura das eras</p>
      <ul class="tight-list">${report.eras
        .map(
          (era) =>
            `<li><strong>${htmlEscape(era.label)}</strong> — ${
              era.empty
                ? 'sem evidência suficiente (lacuna explícita)'
                : report.unit.eraCoverageFromLedger
                  ? `${report.synthesis.byEra.find((row) => row.key === era.id)?.count ?? 0} pontos com fonte`
                  : `${listOf(era.numbers).length + listOf(era.actions).length} pontos nesta seção`
            }</li>`,
        )
        .join('')}</ul>
    </div>
    <div class="panel panel-warning">
      <p class="eyebrow warning-text">Guardas de leitura</p>
      <ul class="tight-list">
        <li>Contagens por recorte: ${htmlEscape(report.unit.copy?.synthesisGuard ?? 'setor e rede nunca somados à instituição.')}</li>
        <li>Cada valor mantém a fase — empenho ≠ pagamento.</li>
        <li>Sem fonte, não publica: ausência vira lacuna explícita.</li>
      </ul>
    </div>
  </section>

  ${
    report.synthesis.moneyByPhase.length
      ? `<section class="block">
    <p class="eyebrow">Recursos por fase</p>
    <h3 class="section-title">Valores localizados, sem consolidar fases</h3>
    <table class="document-table">
      <caption class="sr-only">Valores localizados por fase de execução</caption>
      <colgroup><col style="width:40%" /><col style="width:20%" /><col style="width:40%" /></colgroup>
      ${tableHead(['Fase', 'Itens', 'Valor'])}
      <tbody>${report.synthesis.moneyByPhase
        .map(
          (row) =>
            `<tr><td>${phaseBadge(row.key)}</td><td class="numeric">${row.count}</td><td class="numeric">${htmlEscape(formatMoneyCompact(row.amount))}</td></tr>`,
        )
        .join('')}</tbody>
    </table>
    <p class="warning-text small strong">Soma por fase apenas; fases não são equivalentes entre si.</p>
  </section>`
      : ''
  }
  ${unitFooter(report, 'Síntese · INSUMO INTERNO', pageNo)}
</article>`

const renderUnitChartsPage = (report, pageNo) => {
  const synthesis = report.synthesis
  const executedPhases = new Set(['pago', 'liquidado', 'autorizado', 'empenhado'])
  const executedYears = synthesis.moneyByYear.filter((row) =>
    row.segments.some((segment) => executedPhases.has(segment.key)),
  )
  return `
<article class="sheet" data-page="graficos" aria-label="${htmlEscape(report.unit.aria?.charts ?? 'Gráficos consolidados da atuação institucional')}">
  ${unitHeader(report, 'Gráficos consolidados', `Como os recursos e as entregas chegaram ${report.unit.notSummedTo ?? 'à instituição'} — valores sempre com a fase`, pageNo)}
  <div class="chart-grid">
    <div class="chart-card">
      <p class="chart-title">Recursos com execução por ano (R$)</p>
      ${
        executedYears.length
          ? stackedColumnChart({
              rows: executedYears.map((row) => ({ ...row, value: row.amount })),
              height: 136,
              format: (row) => formatMoneyCompact(row.value),
              fullYearLabel: Boolean(report.unit.fullYearAxis),
            })
          : '<p class="muted small">Nenhum valor com fase de execução informada.</p>'
      }
      <p class="chart-legend">verde: pago/liquidado · âmbar: autorizado/empenhado — empenho não é pagamento.</p>
    </div>
    <div class="chart-card">
      <p class="chart-title">Propostas e articulações sem fase informada (R$)</p>
      ${
        synthesis.moneyProposals.length
          ? valueList({
              rows: synthesis.moneyProposals.map((row) => ({
                label: `${row.year ?? '—'} · ${row.label}`,
                value: row.amount,
              })),
              format: (row) => formatMoneyCompact(row.value),
            })
          : '<p class="muted small">Nenhuma proposta sem fase informada.</p>'
      }
      <p class="chart-legend">propostas e convênios citados nas fontes, sem fase de execução declarada.</p>
    </div>
    <div class="chart-card">
      <p class="chart-title">Abrangência: ${report.unit.spheres
        .map((sphere) => htmlEscape(report.unit.sphereLabels[sphere]))
        .join(' × ')}</p>
      ${barChart({
        rows: synthesis.bySphere.map((row) => ({
          label: row.label,
          count: row.count,
          color: CHART_COLORS[row.key],
        })),
      })}
      <p class="chart-legend">${htmlEscape(report.unit.sumGuardNote ?? '')}</p>
    </div>
    <div class="chart-card">
      <p class="chart-title">${htmlEscape(report.unit.byYearTitle ?? 'Trajetória: pontos com fonte por ano (20xx)')}</p>
      ${columnChart({
        rows: synthesis.byYear,
        height: 156,
        fullYearLabel: Boolean(report.unit.fullYearAxis),
      })}
    </div>
    <div class="chart-card">
      <p class="chart-title">${htmlEscape(report.unit.byAreaTitle ?? 'Áreas com mais registros')}</p>
      ${barChart({
        rows: synthesis.byArea.slice(0, 6).map((row) => ({ label: row.key, count: row.count })),
      })}
    </div>
    <div class="chart-card">
      <p class="chart-title">Lacunas declaradas por era</p>
      ${barChart({
        rows: synthesis.gapsByEra.map((row) => ({ label: row.label, count: row.count })),
      })}
      <p class="chart-legend">ausência é resultado: cada lacuna é uma tarefa de apuração.</p>
    </div>
    <div class="chart-card">
      <p class="chart-title">Acervo interno (read-only)</p>
      <p class="scope-count tabular">${synthesis.totals.acervoRecorte}</p>
      <p class="meta">falas no recorte temático (2011+)</p>
      <ul class="tight-list">
        <li>Amostra de ${synthesis.totals.acervo} falas com link direto (seção do acervo).</li>
        <li>Temas: ${report.acervo?.topics?.join(', ') || '—'} — ${htmlEscape(report.unit.acervoNote ?? '')}</li>
      </ul>
    </div>
  </div>
  ${unitFooter(report, 'Gráficos · INSUMO INTERNO', pageNo)}
</article>`
}

const renderUnitOpeningPage = (report, pageNo) => {
  const opening = report.opening
  if (!opening?.paragraphs?.length) return ''
  return `
<article class="sheet" data-page="carta" aria-label="A contribuição de Solla para a ${htmlEscape(report.unit.contributionLabel ?? 'instituição')}">
  ${unitHeader(report, opening.title, 'Redação de síntese sobre os pontos com fonte — nada aqui acrescenta fato novo', pageNo)}
  <section class="block">
    ${opening.paragraphs.map((paragraph) => `<p class="opening-paragraph">${copyHtml(paragraph)}</p>`).join('')}
  </section>
  <aside class="rule-warning">
    ${WARNING_ICON}
    <div>
      <p class="eyebrow warning-text">Como ler</p>
      <p class="muted">Cada afirmação desta redação tem lastro em um item datado do dossiê (seções por era e de abrangência). ${
        opening.authored
          ? 'A redação foi escrita a partir dos itens com fonte.'
          : 'Sem redação autoral disponível: o texto repete a leitura dos números.'
      } Onde não há fonte, o dossiê registra lacuna — a redação não preenche por inferência.</p>
    </div>
  </aside>
  ${unitFooter(report, 'A contribuição · INSUMO INTERNO', pageNo)}
</article>`
}

const renderSubjectDossierHtml = (report, { pack = null, probe = false } = {}) => {
  const buildParts = () => {
    let page = 0
    const nextPage = () => ++page
    const parts = []
    parts.push(renderSubjectCover(report))
    page += 1
    const opening = renderUnitOpeningPage(report, page + 1)
    if (opening) {
      parts.push(opening)
      page += 1
    }
    parts.push(renderSubjectSummary(report, ++page))
    parts.push(renderUnitSynthesisPage(report, nextPage()))
    parts.push(renderUnitChartsPage(report, nextPage()))
    for (const era of report.eras) {
      parts.push(
        ...renderEraSheets({
          report,
          era,
          pack,
          probe,
          nextPage,
          includeHonors: !report.unit.honorsSheet,
        }),
      )
    }
    parts.push(renderSubjectScope(report, nextPage()))
    for (const list of report.reach.lists) {
      parts.push(...renderSubjectScopeListSheets({ report, list, pack, probe, nextPage }))
    }
    if (report.unit.honorsSheet) {
      parts.push(...renderSubjectHonorSheets({ report, pack, probe, nextPage }))
    }
    parts.push(...renderGapSheets({ report, pack, probe, nextPage }))
    parts.push(...renderNewsSheets({ report, pack, probe, nextPage }))
    parts.push(...renderAcervoSheets({ report, pack, probe, nextPage }))
    parts.push(renderUnitSourcesPage(report, nextPage()))
    return parts
  }

  // Two passes: the shell's `pág. N/M` needs the final sheet count, and the
  // count only exists after the pack plan is applied.
  report.meta.pageTotal = 0
  let parts = buildParts()
  report.meta.pageTotal = parts.length
  parts = buildParts()

  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${htmlEscape(report.meta.title)} — ${htmlEscape(report.meta.subjectName)}</title><style>${INSTITUTION_PRINT_CSS}</style>${probe ? `<style>${INSTITUTION_PROBE_CSS}</style>` : ''}</head>
<body>
${parts.join('\n')}
</body>
</html>`
}

const subjectMdEra = (era) => {
  const lines = [
    `## ${era.label} (${era.period})`,
    '',
    `_${era.method}_`,
    '',
    `Trilha: ${era.recovery}`,
  ]
  if (era.narrative || era.summary) {
    lines.push('', `> ${era.narrative ?? era.summary}`)
  }
  if (era.empty) {
    lines.push(
      '',
      `> Lacuna explícita: nenhuma fonte suficiente foi localizada para a ${era.label}. Isso não prova ausência — prova que o dossiê ainda não pode afirmar.`,
    )
    return lines.join('\n')
  }
  if (era.numbers.items.length) {
    lines.push(
      '',
      '| Objeto | Valor | Ano | Fase | Abrangência | Fonte |',
      '| --- | --- | --- | --- | --- | --- |',
    )
    for (const row of era.numbers.items) {
      lines.push(
        `| ${row.object} | ${row.value ?? '—'} | ${row.year ?? '—'} | ${dossierPhaseLabel(row.phase)} | ${row.sphere} | ${row.sourceUrl ?? '—'} |`,
      )
    }
    if (era.numbers.omitted > 0)
      lines.push('', `_e mais ${era.numbers.omitted} item(ns) de valor com fonte._`)
  }
  for (const action of era.actions.items) {
    lines.push(
      '',
      `- **${stripInlineSources(action.title)}** (${action.sphere}${action.year ? ` · ${action.year}` : ''})${action.detail ? ` — ${stripInlineSources(action.detail)}` : ''} [fonte](${action.sourceUrl})`,
    )
  }
  if (era.actions.omitted > 0)
    lines.push('', `_e mais ${era.actions.omitted} item(ns) de atuação com fonte._`)
  for (const honor of era.honors.items)
    lines.push('', `- Honraria: ${stripInlineSources(honor.text)} [fonte](${honor.sourceUrl})`)
  if (era.honors.omitted > 0)
    lines.push('', `_e mais ${era.honors.omitted} honraria(s) com fonte._`)
  return lines.join('\n')
}

const renderSubjectDossierMd = (report) => {
  const lines = [
    `# ${report.meta.title} — ${report.meta.subjectName}`,
    '',
    `**Identificação:** ${report.meta.identityBadges.join(' · ')}`,
    `**Gerado em:** ${formatDateTimeBr(report.meta.generatedAt)} · **Base Teqo (read-only) lida em:** ${report.meta.readAtLabel}`,
    '',
    '> INSUMO INTERNO — não circular, não publicar. Documento de trabalho.',
    '',
    `## Identificação`,
    '',
    ...report.unit
      .identityRows(report.meta.identity ?? {})
      .map(([key, value]) => `- **${key}:** ${value}`),
    '',
  ]
  if (report.opening?.paragraphs?.length) {
    lines.push(`## ${report.opening.title}`, '')
    for (const paragraph of report.opening.paragraphs) lines.push(paragraph, '')
    lines.push(
      `_Redação de síntese sobre os pontos com fonte; ${
        report.opening.authored
          ? 'escrita a partir dos itens datados do dossiê'
          : 'repetição da leitura dos números (sem redação autoral disponível)'
      } — nada aqui acrescenta fato novo._`,
      '',
    )
  }
  lines.push('## Linha do tempo documentada', '')
  if (report.page1.timeline.items.length === 0) lines.push('_Nenhum vínculo datado com fonte._')
  for (const row of report.page1.timeline.items) {
    lines.push(
      `- **${row.period || '—'}** — ${stripInlineSources(row.role)} (${row.source ?? ''}) [fonte](${row.url})`,
    )
  }
  if (report.page1.timeline.omitted > 0)
    lines.push(`- _e mais ${report.page1.timeline.omitted} vínculo(s) com fonte._`)

  if (report.page1.deliveries.items.length) {
    lines.push('', '## Principais entregas localizadas', '')
    for (const row of report.page1.deliveries.items) {
      lines.push(
        `- **${stripInlineSources(row.title)}** · _${row.sphere}_${row.value ? ` · ${row.value}` : ''}${row.phase ? ` (${dossierPhaseLabel(row.phase)})` : ''}${row.detail ? ` — ${stripInlineSources(row.detail)}` : ''} [fonte](${row.sourceUrl})`,
      )
    }
    if (report.page1.deliveries.omitted > 0)
      lines.push(`- _e mais ${report.page1.deliveries.omitted} entrega(s) com fonte._`)
    lines.push('', '_Autorizado ≠ empenhado ≠ liquidado ≠ pago. A fase acompanha cada valor._')
  }

  for (const era of report.eras) lines.push('', subjectMdEra(era))

  if (report.synthesis?.lines?.length) {
    lines.push('', '## Síntese do que foi localizado', '')
    for (const line of report.synthesis.lines) lines.push(`- ${line}`)
    lines.push('', '### Números por recorte', '')
    lines.push(
      `| Era | ${report.unit.spheres.map((sphere) => capitalize(report.unit.sphereLabels[sphere])).join(' | ')} | Total |`,
      `| --- | ${report.unit.spheres.map(() => '---').join(' | ')} | --- |`,
    )
    for (const row of report.synthesis.byEraSphere) {
      const countFor = (key) => row.segments.find((segment) => segment.key === key)?.count ?? 0
      lines.push(
        `| ${row.label} | ${report.unit.spheres.map((sphere) => countFor(sphere)).join(' | ')} | ${row.segments.reduce((sum, segment) => sum + segment.count, 0)} |`,
      )
    }
    if (report.synthesis.byPhase.length) {
      lines.push('', '### Itens com valor por fase', '')
      for (const row of report.synthesis.byPhase) lines.push(`- ${row.label}: ${row.count}`)
    }
    if (report.synthesis.byArea.length) {
      lines.push('', '### Temas com mais registros', '')
      for (const row of report.synthesis.byArea) lines.push(`- ${row.key}: ${row.count}`)
    }
    if (report.synthesis.acervoByYear.length) {
      lines.push('', '### Acervo interno por ano', '')
      lines.push(report.synthesis.acervoByYear.map((row) => `${row.key}: ${row.count}`).join(' · '))
    }
  }

  lines.push(
    '',
    `## Abrangência: ${report.unit.spheres.map((sphere) => report.unit.sphereLabels[sphere]).join(' × ')}`,
    '',
  )
  lines.push(`> ${report.reach.ruleTitle}`, `> ${report.reach.ruleBody}`, '')
  for (const list of report.reach.lists) {
    lines.push(`### ${list.label}`, '')
    if (list.items.length === 0) lines.push('- Nenhum item com fonte.')
    for (const item of list.items) {
      lines.push(
        `- **${stripInlineSources(briefOr(item.brief, item.title))}** (${item.sphere}${item.year ? ` · ${item.year}` : ''})${noteOr(item.brief, item.evidence) ? ` — ${stripInlineSources(noteOr(item.brief, item.evidence))}` : ''} [fonte](${item.sourceUrl})`,
      )
    }
    if (list.omitted > 0) lines.push(`- _e mais ${list.omitted} item(ns) com fonte._`)
    lines.push('')
  }

  if (report.acervo?.items?.length) {
    lines.push(
      '',
      `## Acervo interno (read-only)`,
      '',
      `_Amostra de ${report.acervo.items.length} de ${report.acervo.recorte} falas do recorte temático, com link; o acervo completo fica na base Teqo. ${report.unit.copy.mdAcervoNote}_`,
      '',
    )
    for (const row of report.acervo.items) {
      lines.push(
        `- **${row.period}** — ${stripInlineSources(row.text)}${row.excerpt ? ` _(${stripInlineSources(row.excerpt)})_` : ''} [fonte](${row.sourceUrl})`,
      )
    }
    if (report.acervo.omitted > 0)
      lines.push(`- _e mais ${report.acervo.omitted} fala(s) com fonte na base._`)
  }

  lines.push('', '## Lacunas explícitas', '')
  if (report.gaps.length === 0) lines.push('_Nenhuma lacuna declarada._')
  for (const gap of report.gaps) {
    lines.push(`- **${gap.label}:** ${gap.reason} → ${gap.nextStep}`)
  }

  if (report.news.length) {
    lines.push('', '## Notícias e documentos consultados', '')
    for (const row of report.news) {
      lines.push(`- ${formatDateBr(row.date)} · ${row.outlet} — ${row.title} — ${row.url}`)
    }
  }

  lines.push(
    '',
    '## Limites de cobertura',
    '',
    ...report.limits.coverage.map((item) => `- ${item}`),
    '',
    '## Regras para uso editorial',
    '',
    ...report.limits.editorial.map((item) => `- ${item}`),
    '',
    '## Nota de defeso eleitoral 2026',
    '',
    'Insumo interno não é autorização para publicar. Publicidade institucional e propaganda eleitoral obedecem a regimes diferentes. Antes de adaptar qualquer trecho para peça externa, submeta texto, imagem, autoria, período e canal à revisão responsável.',
    '',
    `_Documento interno de campanha, datado (${formatDateTimeBr(report.meta.generatedAt)}). O dado envelhece: confira a data de leitura da base._`,
  )
  return `${lines.join('\n')}\n`
}

/** Dispatch: subject-shaped reports (institution/theme) render with the shared subject sections. */
export const renderDossierHtml = (report, options) =>
  isSubjectUnit(report.unit)
    ? renderSubjectDossierHtml(report, options)
    : renderMunicipalityDossierHtml(report, options)

export const renderDossierMd = (report) =>
  isSubjectUnit(report.unit) ? renderSubjectDossierMd(report) : renderMunicipalityDossierMd(report)
