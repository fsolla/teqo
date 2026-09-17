/**
 * Dossiê renderer (C186): the block model goes to print HTML (Chromium
 * `page.pdf`, A4, one `.sheet` per page) and to the companion `.md`. Ports the
 * approved hi-fi classes (`dossie-solla-cidade-ui-design.html`) class-by-class;
 * shared escaping/source-token contract lives in `reportText.mjs`.
 */

import { formatDateBr, formatDateTimeBr } from './cityReportFormat.mjs'
import { dossierPhaseLabel, dossierSphereLabel } from './dossieBlocks.mjs'
import { htmlEscape, stripInlineSources } from './reportText.mjs'

const SOURCE_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>'

const WARNING_ICON =
  '<svg class="warn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>'

const sourceLink = (url, label = '(fonte)') =>
  url
    ? `<a class="source-link" href="${htmlEscape(url)}" aria-label="Abrir fonte">${SOURCE_ICON}${htmlEscape(label)}</a>`
    : ''

const scopeBadge = (sphere, label = null) =>
  `<span class="scope${sphere === 'municipio' ? '' : ' scope-region'}">${htmlEscape(label ?? dossierSphereLabel(sphere))}</span>`

/** `dd/mm/aa` — the news table column is 9% wide (no room for a 4-digit year). */
const formatShortDateBr = (value) => {
  const full = formatDateBr(value)
  const parts = full.split('/')
  return parts.length === 3 ? `${parts[0]}/${parts[1]}/${parts[2].slice(-2)}` : full
}

/** Research text without the inline `{{fonte}}` markers — the row's own link carries the source. */
const cleanText = (value) => htmlEscape(stripInlineSources(value))

const phaseBadge = (phase) => `<span class="phase">${htmlEscape(dossierPhaseLabel(phase))}</span>`

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

const pageCount = (report) => report.meta.pageTotal ?? 5 + report.eras.length

/** Gaps are paginated, never truncated: 12 rows per A4 sheet. */
const GAPS_PER_PAGE = 12

const chunkGaps = (gaps) => {
  const list = Array.isArray(gaps) ? gaps : []
  if (list.length === 0) return [[]]
  const chunks = []
  for (let index = 0; index < list.length; index += GAPS_PER_PAGE) {
    chunks.push(list.slice(index, index + GAPS_PER_PAGE))
  }
  return chunks
}

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
  if (report.page1.deliveries.length === 0) return ''
  return `
  <section class="block">
    <div class="block-head">
      <div><p class="eyebrow">02 · destaques com lastro</p><h3 class="section-title">Principais entregas localizadas</h3></div>
    </div>
    <div class="deliveries">
      ${report.page1.deliveries
        .map(
          (row) => `<div class="delivery-row">
            <div class="delivery-scope">${scopeBadge(row.sphere)}<p class="meta">Era ${htmlEscape(row.era)}${row.year ? ` · ${htmlEscape(row.year)}` : ''}</p></div>
            <div>
              <p class="delivery-title">${cleanText(row.title)}</p>
              ${row.detail ? `<p class="muted small">${cleanText(row.detail)}</p>` : ''}
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
    <p class="muted small strong">Guarda de leitura: autorizado ≠ empenhado ≠ liquidado ≠ pago. A fase acompanha cada valor.</p>
  </section>`
}

const renderHooksAndPending = (report) => {
  const hooks = report.page1.hooks
  const pending = report.page1.pending
  if (hooks.length === 0 && pending.length === 0) return ''
  return `
  <section class="page1-grid">
    ${
      hooks.length
        ? `<div class="panel">
            <p class="eyebrow">03 · ganchos para o boletim</p>
            <ul class="tight-list">${hooks
              .map(
                (hook) =>
                  `<li><strong>Tema:</strong> ${htmlEscape(hook.topic)}. <strong>Ângulo:</strong> ${cleanText(hook.angle)} ${sourceLink(hook.sourceUrl)}</li>`,
              )
              .join('')}</ul>
          </div>`
        : '<div></div>'
    }
    ${
      pending.length
        ? `<div class="panel panel-warning">
            <p class="eyebrow warning-text">04 · o que falta</p>
            <ul class="tight-list">${pending.map((item) => `<li>${htmlEscape(item)}</li>`).join('')}</ul>
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

const renderEra = (report, era, pageNo) => `
<article class="sheet" data-page="era-${era.id.toLowerCase()}" aria-label="${htmlEscape(era.label)}">
  ${sheetHeader(report, era.label, `${era.period} · ${era.subtitle}`, pageNo)}

  <div class="era-method">
    <div>
      <p class="eyebrow">Recorte e método</p>
      <p class="muted">${htmlEscape(era.method)}</p>
    </div>
    <aside class="aside-accent"><strong>Trilha de recuperação</strong><br />${htmlEscape(era.recovery)}</aside>
  </div>

  ${
    era.numbers.length
      ? `<section class="block">
          <div class="block-head">
            <div><p class="eyebrow">Números com fase</p><h3 class="section-title">Recursos e entregas quantificáveis</h3></div>
          </div>
          <table class="document-table">
            <caption class="sr-only">Valores por ano, fase, esfera e fonte</caption>
            <colgroup><col style="width:26%" /><col style="width:15%" /><col style="width:10%" /><col style="width:17%" /><col style="width:12%" /><col style="width:20%" /></colgroup>
            <thead><tr><th>Objeto</th><th>Valor</th><th>Ano</th><th>Fase</th><th>Esfera</th><th>Fonte</th></tr></thead>
            <tbody>${era.numbers
              .map(
                (row) => `<tr>
                  <td>${htmlEscape(row.object)}</td>
                  <td class="numeric">${valueCell(row.value, 'Valor a recuperar')}</td>
                  <td class="numeric">${htmlEscape(row.year ?? '—')}</td>
                  <td>${phaseBadge(row.phase)}</td>
                  <td>${scopeBadge(row.sphere)}</td>
                  <td>${sourceLink(row.sourceUrl)}${row.sphere !== 'municipio' ? '<br /><span class="meta">não somar à cidade</span>' : ''}</td>
                </tr>`,
              )
              .join('')}</tbody>
          </table>
          <p class="warning-text small strong">Não consolidar fases como se fossem equivalentes. Um valor empenhado não é um valor pago.</p>
        </section>`
      : ''
  }

  ${
    era.actions.length
      ? `<section class="block">
          <p class="eyebrow">Atuação registrada</p>
          <h3 class="section-title">O que fez — item, alcance e lastro</h3>
          <div class="action-grid">
            ${era.actions
              .map(
                (action) => `<article class="panel">
                  <div class="action-head">${scopeBadge(action.sphere)}<span class="meta">${htmlEscape(action.year ?? '—')}</span></div>
                  <h4 class="action-title">${cleanText(action.title)}</h4>
                  ${action.detail ? `<p class="muted small">${cleanText(action.detail)}</p>` : ''}
                  ${sourceLink(action.sourceUrl)}
                </article>`,
              )
              .join('')}
          </div>
        </section>`
      : ''
  }

  ${
    era.honors.length
      ? `<section class="block honors">
          <div class="panel">
            <p class="eyebrow">Títulos, honrarias e vínculos locais</p>
            <ul class="tight-list">${era.honors
              .map((honor) => `<li>${cleanText(honor.text)} ${sourceLink(honor.sourceUrl)}</li>`)
              .join('')}</ul>
          </div>
          ${assetBox('NEEDS ASSET', ['reprodução do ato ou clipping', 'somente com origem e licença'])}
        </section>`
      : ''
  }

  ${sheetFooter(report, era.label, pageNo)}
</article>`

const renderScopeLists = (report) => `
  <section class="block">
    <p class="eyebrow">Leitura lado a lado</p>
    <h3 class="section-title">Duas listas, dois totais, nenhuma soma</h3>
    <div class="scope-compare">
      <div class="panel">
        <div class="action-head">${scopeBadge('municipio')}<span class="meta strong">${report.region.municipal.total} ${report.region.municipal.total === 1 ? 'item' : 'itens'} com fonte</span></div>
        <ul class="tight-list">${report.region.municipal.items
          .map((item) => `<li>${cleanText(item.answer)} ${sourceLink(item.sourceUrl)}</li>`)
          .join(
            '',
          )}${report.region.municipal.items.length === 0 ? '<li class="muted">Nenhum item municipal com fonte.</li>' : ''}</ul>
      </div>
      <div class="compare-mid" aria-hidden="true"><span>≠</span></div>
      <div class="panel panel-region">
        <div class="action-head">${scopeBadge('regiao', 'região / polo')}<span class="warning-text meta strong">SEM TOTAL COMBINADO · ${report.region.regional.total} ${report.region.regional.total === 1 ? 'item' : 'itens'}</span></div>
        <ul class="tight-list">${report.region.regional.items
          .map((item) => `<li>${cleanText(item.answer)} ${sourceLink(item.sourceUrl)}</li>`)
          .join(
            '',
          )}${report.region.regional.items.length === 0 ? '<li class="muted">Nenhum item regional com fonte.</li>' : ''}</ul>
      </div>
    </div>
  </section>`

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

  ${renderScopeLists(report)}

  ${
    report.region.items.length
      ? `<section class="block">
          <div class="block-head"><div><p class="eyebrow">Itens regionais recuperados</p><h3 class="section-title">Evidência de alcance, sem apropriação local</h3></div>${scopeBadge('regiao')}</div>
          <table class="document-table">
            <caption class="sr-only">Itens do recorte regional com evidência e fonte</caption>
            <colgroup><col style="width:30%" /><col style="width:15%" /><col style="width:34%" /><col style="width:21%" /></colgroup>
            <thead><tr><th>Item</th><th>Esfera</th><th>Evidência de alcance</th><th>Fonte</th></tr></thead>
            <tbody>${report.region.items
              .map(
                (item) => `<tr>
                  <td>${cleanText(item.item)}</td>
                  <td>${scopeBadge(item.sphere)}</td>
                  <td>${cleanText(item.evidence)}</td>
                  <td>${sourceLink(item.sourceUrl)}</td>
                </tr>`,
              )
              .join('')}</tbody>
          </table>
        </section>`
      : ''
  }

  ${
    report.region.hook || report.region.priorityGap
      ? `<section class="page1-grid">
          ${
            report.region.hook
              ? `<div class="aside-accent"><p class="eyebrow">Gancho possível</p><p><strong>Tema:</strong> ${htmlEscape(report.region.hook.topic)}. <strong>Ângulo:</strong> ${cleanText(report.region.hook.angle)} ${sourceLink(report.region.hook.sourceUrl)}</p></div>`
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

const renderGapsPage = (report, chunk, index, pageNo) => {
  const rows = chunk.length
    ? chunk
        .map(
          (gap) => `<tr>
              <td><strong>${htmlEscape(gap.label)}</strong></td>
              <td>${htmlEscape(gap.reason)}</td>
              <td>Não completar por inferência.</td>
              <td>${htmlEscape(gap.nextStep)}</td>
            </tr>`,
        )
        .join('')
    : '<tr><td colspan="4" class="muted">Nenhuma lacuna declarada — confira a cobertura das eras.</td></tr>'
  return `
<article class="sheet" data-page="lacunas${index > 0 ? `-${index + 1}` : ''}" aria-label="Lacunas explícitas">
  ${sheetHeader(report, 'Lacunas explícitas', `O que não foi encontrado${index > 0 ? ` (continuação ${index + 1})` : ''}`, pageNo)}
  <section class="block">
    <div class="block-head"><div><p class="eyebrow">O que não foi encontrado</p><h3 class="section-title">Lacunas explícitas</h3></div><p class="warning-text meta strong">Não completar por memória ou inferência</p></div>
    <table class="document-table">
      <caption class="sr-only">Tabela de lacunas explícitas e próximos passos de apuração</caption>
      <colgroup><col style="width:26%" /><col style="width:30%" /><col style="width:24%" /><col style="width:20%" /></colgroup>
      <thead><tr><th>Lacuna</th><th>Situação da busca</th><th>Limite editorial</th><th>Próximo passo</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>
  ${sheetFooter(report, 'Lacunas explícitas · INSUMO INTERNO', pageNo)}
</article>`
}

const renderSourcesPage = (report, pageNo) => `
<article class="sheet" data-page="fontes" aria-label="Fontes e limites do dossiê">
  ${sheetHeader(report, 'Fontes e limites', 'O que foi consultado e o que não se pode afirmar', pageNo)}

  ${
    report.news.length
      ? `<section class="block">
          <p class="eyebrow">Lista clicável</p>
          <h3 class="section-title">Notícias e documentos consultados</h3>
          <table class="document-table">
            <caption class="sr-only">Fontes consultadas com largura fixa: data 12%, veículo 13%, título 47% e link 28%</caption>
            <colgroup><col style="width:12%" /><col style="width:13%" /><col style="width:47%" /><col style="width:28%" /></colgroup>
            <thead><tr><th>Data</th><th>Veículo</th><th>Título</th><th>Link</th></tr></thead>
            <tbody>${report.news
              .map(
                (row) => `<tr>
                  <td class="numeric nowrap">${htmlEscape(formatShortDateBr(row.date))}</td>
                  <td>${htmlEscape(row.outlet)}</td>
                  <td>${htmlEscape(row.title)}</td>
                  <td>${sourceLink(row.url, '(fonte)')}</td>
                </tr>`,
              )
              .join('')}</tbody>
          </table>
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

  ${sheetFooter(report, 'Fontes e limites · INSUMO INTERNO', pageNo)}
</article>`

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
  .defeso { margin-top: auto; }
`

export const renderDossierHtml = (report) => {
  const gapChunks = chunkGaps(report.gaps)
  report.meta.pageTotal = 5 + report.eras.length + gapChunks.length
  let page = 0
  const parts = []
  parts.push(renderCover(report))
  page += 1
  parts.push(renderTrajectory(report, ++page))
  parts.push(renderSummary(report, ++page))
  for (const era of report.eras) parts.push(renderEra(report, era, ++page))
  parts.push(renderRegion(report, ++page))
  gapChunks.forEach((chunk, index) => parts.push(renderGapsPage(report, chunk, index, ++page)))
  parts.push(renderSourcesPage(report, ++page))

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
  if (era.numbers.length) {
    lines.push(
      '',
      '| Objeto | Valor | Ano | Fase | Esfera | Fonte |',
      '| --- | --- | --- | --- | --- | --- |',
    )
    for (const row of era.numbers) {
      lines.push(
        `| ${row.object} | ${row.value ?? '—'} | ${row.year ?? '—'} | ${dossierPhaseLabel(row.phase)} | ${row.sphere} | ${row.sourceUrl ?? '—'} |`,
      )
    }
  }
  for (const action of era.actions) {
    lines.push(
      '',
      `- **${stripInlineSources(action.title)}** (${action.sphere}${action.year ? ` · ${action.year}` : ''})${action.detail ? ` — ${stripInlineSources(action.detail)}` : ''} [fonte](${action.sourceUrl})`,
    )
  }
  for (const honor of era.honors)
    lines.push('', `- Honraria: ${stripInlineSources(honor.text)} [fonte](${honor.sourceUrl})`)
  return lines.join('\n')
}

export const renderDossierMd = (report) => {
  const lines = [
    `# ${report.meta.title} — ${report.meta.municipalityName}`,
    '',
    `**Território de identidade:** ${report.meta.region}`,
    `**Gerado em:** ${formatDateTimeBr(report.meta.generatedAt)} · **Base Teqo (read-only) lida em:** ${report.meta.readAtLabel}`,
    '',
    '> INSUMO INTERNO — não circular, não publicar. Documento de trabalho.',
    '',
    '## Linha do tempo da carreira',
    '',
  ]
  for (const row of report.trajectory) {
    lines.push(
      `- **${row.period}** — ${row.role}${row.uncertain ? ` _(${row.uncertain})_` : ''} · ${row.recovery}`,
    )
  }

  if (report.page1.deliveries.length) {
    lines.push('', '## Principais entregas localizadas', '')
    for (const row of report.page1.deliveries) {
      lines.push(
        `- **${stripInlineSources(row.title)}** · _${row.sphere}_${row.value ? ` · ${row.value}` : ''}${row.phase ? ` (${dossierPhaseLabel(row.phase)})` : ''}${row.detail ? ` — ${stripInlineSources(row.detail)}` : ''} [fonte](${row.sourceUrl})`,
      )
    }
    lines.push('', '_Autorizado ≠ empenhado ≠ liquidado ≠ pago. A fase acompanha cada valor._')
  }

  for (const era of report.eras) {
    lines.push('', mdEra(era))
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
    lines.push(`- ${stripInlineSources(item.answer)} — [fonte](${item.sourceUrl})`)
  }
  lines.push('', '### Região / polo (não somável)', '')
  for (const item of report.region.regional.items) {
    lines.push(`- ${stripInlineSources(item.answer)} — [fonte](${item.sourceUrl})`)
  }
  if (report.region.items.length) {
    lines.push('', '| Item | Esfera | Evidência | Fonte |', '| --- | --- | --- | --- |')
    for (const item of report.region.items) {
      lines.push(
        `| ${stripInlineSources(item.item)} | ${item.sphere} | ${stripInlineSources(item.evidence)} | ${item.sourceUrl} |`,
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
