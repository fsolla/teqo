/**
 * Dossiê renderer (C186): the block model goes to print HTML (Chromium
 * `page.pdf`, A4, one `.sheet` per page) and to the companion `.md`. Ports the
 * approved hi-fi classes (`dossie-solla-cidade-ui-design.html`) class-by-class;
 * shared escaping/source-token contract lives in `reportText.mjs`.
 */

import { formatDateBr, formatDateTimeBr } from './cityReportFormat.mjs'
import { dossierPhaseLabel, dossierSphereBadgeClass, dossierSphereLabel } from './dossieBlocks.mjs'
import { MUNICIPALITY_UNIT, isInstitutionUnit } from './dossieUnit.mjs'
import { htmlEscape, stripInlineSources } from './reportText.mjs'

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

/** cover + trajetória + resumo + região + fontes (eras and gap sheets added separately). */
const SHEET_COUNT_BASE = 5
const pageCount = (report) => report.meta.pageTotal

/** Gaps are paginated, never truncated: 7 full-text rows per A4 sheet. */
const GAPS_PER_PAGE = 7

/** News are paginated, never truncated: 10 full-title rows per A4 sheet. */
const NEWS_PER_PAGE = 10

/** Era "Atuação registrada" cards: 2 on the first sheet, 6 per continuation sheet. */
const ERA_ACTIONS_FIRST_SHEET = 2
const ERA_ACTIONS_PER_SHEET = 6

const chunkGaps = (gaps) => {
  const list = Array.isArray(gaps) ? gaps : []
  if (list.length === 0) return [[]]
  const chunks = []
  for (let index = 0; index < list.length; index += GAPS_PER_PAGE) {
    chunks.push(list.slice(index, index + GAPS_PER_PAGE))
  }
  return chunks
}

const chunkNews = (news) => {
  const list = Array.isArray(news) ? news : []
  const chunks = []
  for (let index = 0; index < list.length; index += NEWS_PER_PAGE) {
    chunks.push(list.slice(index, index + NEWS_PER_PAGE))
  }
  return chunks
}

/**
 * Era action cards, paginated so no sourced fact is dropped: the first sheet
 * carries the design's 2 cards (with method + numbers + honors), and the rest
 * flow to continuation sheets.
 */
const chunkEraActions = (era) => {
  const actions = Array.isArray(era.actions) ? era.actions : []
  const first = actions.slice(0, ERA_ACTIONS_FIRST_SHEET)
  const rest = actions.slice(ERA_ACTIONS_FIRST_SHEET)
  const chunks = [first]
  for (let index = 0; index < rest.length; index += ERA_ACTIONS_PER_SHEET) {
    chunks.push(rest.slice(index, index + ERA_ACTIONS_PER_SHEET))
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
                  `<li><strong>Tema:</strong> ${htmlEscape(hook.topic)}. <strong>Ângulo:</strong> ${copyHtml(briefOr(hook.brief, hook.angle))} ${sourceLink(hook.sourceUrl)}</li>`,
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

const renderActionGrid = (actions) => `
  <div class="action-grid">
    ${actions
      .map(
        (action) => `<article class="panel">
          <div class="action-head">${scopeBadge(action.sphere)}<span class="meta">${htmlEscape(action.year ?? '—')}</span></div>
          <h4 class="action-title">${copyHtml(briefOr(action.brief, action.title))}</h4>
          ${noteOr(action.brief, action.detail) ? `<p class="muted small">${copyHtml(noteOr(action.brief, action.detail))}</p>` : ''}
          ${sourceLink(action.sourceUrl)}
        </article>`,
      )
      .join('')}
  </div>`

const renderEraPage = (report, era, actions, index, pageNo) => {
  const first = index === 0
  const slug = era.id.toLowerCase()
  const anchor = first ? `era-${slug}` : `era-${slug}-${index + 1}`
  const subtitle = first
    ? `${era.period} · ${era.subtitle}`
    : `Atuação registrada · continuação ${index + 1}`
  return `
<article class="sheet" data-page="${anchor}" aria-label="${htmlEscape(era.label)}">
  ${sheetHeader(report, era.label, subtitle, pageNo)}

  ${
    first
      ? `<div class="era-method">
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
        </section>`
      : ''
  }`
      : ''
  }

  ${
    actions.length
      ? `<section class="block">
          <p class="eyebrow">Atuação registrada</p>
          <h3 class="section-title">O que fez — item, alcance e lastro</h3>
          ${renderActionGrid(actions)}
        </section>`
      : ''
  }

  ${
    first && era.honors.length
      ? `<section class="block honors">
          <div class="panel">
            <p class="eyebrow">Títulos, honrarias e vínculos locais</p>
            <ul class="tight-list">${era.honors
              .map(
                (honor) =>
                  `<li>${copyHtml(briefOr(honor.brief, honor.text))} ${sourceLink(honor.sourceUrl)}</li>`,
              )
              .join('')}</ul>
          </div>
          ${assetBox('NEEDS ASSET', ['reprodução do ato ou clipping', 'somente com origem e licença'])}
        </section>`
      : ''
  }

  ${sheetFooter(report, era.label, pageNo)}
</article>`
}

const renderScopeLists = (report) => `
  <section class="block">
    <p class="eyebrow">Leitura lado a lado</p>
    <h3 class="section-title">Duas listas, dois totais, nenhuma soma</h3>
    <div class="scope-compare">
      <div class="panel">
        <div class="action-head">${scopeBadge('municipio')}<span class="meta strong">${report.region.municipal.total} ${report.region.municipal.total === 1 ? 'item' : 'itens'} com fonte</span></div>
        <ul class="tight-list">${report.region.municipal.items
          .map(
            (item) =>
              `<li>${copyHtml(item.brief?.title ?? item.answer)} ${sourceLink(item.sourceUrl)}</li>`,
          )
          .join(
            '',
          )}${report.region.municipal.items.length === 0 ? '<li class="muted">Nenhum item municipal com fonte.</li>' : ''}</ul>
      </div>
      <div class="compare-mid" aria-hidden="true"><span>≠</span></div>
      <div class="panel panel-region">
        <div class="action-head">${scopeBadge('regiao', 'região / polo')}<span class="warning-text meta strong">SEM TOTAL COMBINADO · ${report.region.regional.total} ${report.region.regional.total === 1 ? 'item' : 'itens'}</span></div>
        <ul class="tight-list">${report.region.regional.items
          .map(
            (item) =>
              `<li>${copyHtml(item.brief?.title ?? item.answer)} ${sourceLink(item.sourceUrl)}</li>`,
          )
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

  ${
    report.region.context.length
      ? `<p class="meta">Contexto municipal (IBGE): ${report.region.context
          .map(
            (item) => `${copyHtml(item.detail)} ${sourceLink(item.sourceUrl, `(${item.topic})`)}`,
          )
          .join(' · ')} — leitura relativa, nunca % estadual absoluto.</p>`
      : ''
  }

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
                  <td>${copyHtml(briefOr(item.brief, item.item))}</td>
                  <td>${scopeBadge(item.sphere)}</td>
                  <td>${copyHtml(noteOr(item.brief, item.evidence))}</td>
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

const renderNewsPage = (report, chunk, index, pageNo) => `
<article class="sheet" data-page="noticias${index > 0 ? `-${index + 1}` : ''}" aria-label="Notícias e documentos consultados">
  ${sheetHeader(report, 'Notícias e documentos consultados', `Fontes externas datadas${index > 0 ? ` (continuação ${index + 1})` : ''}`, pageNo)}
  <section class="block">
    <p class="eyebrow">Lista clicável</p>
    <h3 class="section-title">Notícias e documentos consultados</h3>
    <table class="document-table">
      <caption class="sr-only">Fontes consultadas com largura fixa: data 12%, veículo 13%, título 47% e link 28%</caption>
      <colgroup><col style="width:12%" /><col style="width:13%" /><col style="width:47%" /><col style="width:28%" /></colgroup>
      <thead><tr><th>Data</th><th>Veículo</th><th>Título</th><th>Link</th></tr></thead>
      <tbody>${chunk
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
  </section>
  ${sheetFooter(report, 'Notícias e documentos consultados · INSUMO INTERNO', pageNo)}
</article>`

const renderSourcesPage = (report, pageNo) => `
<article class="sheet" data-page="fontes" aria-label="Fontes e limites do dossiê">
  ${sheetHeader(report, 'Fontes e limites', 'O que foi consultado e o que não se pode afirmar', pageNo)}

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
  .cover-accent { color: #315c75; }
  .defeso { margin-top: auto; }
`

const renderMunicipalityDossierHtml = (report) => {
  const gapChunks = chunkGaps(report.gaps)
  const newsChunks = chunkNews(report.news)
  const eraSheets = report.eras.map((era) => ({ era, chunks: chunkEraActions(era) }))
  const eraSheetCount = eraSheets.reduce((sum, entry) => sum + entry.chunks.length, 0)
  report.meta.pageTotal = SHEET_COUNT_BASE + eraSheetCount + gapChunks.length + newsChunks.length
  let page = 0
  const parts = []
  parts.push(renderCover(report))
  page += 1
  parts.push(renderTrajectory(report, ++page))
  parts.push(renderSummary(report, ++page))
  for (const { era, chunks } of eraSheets) {
    chunks.forEach((actions, index) =>
      parts.push(renderEraPage(report, era, actions, index, ++page)),
    )
  }
  parts.push(renderRegion(report, ++page))
  gapChunks.forEach((chunk, index) => parts.push(renderGapsPage(report, chunk, index, ++page)))
  newsChunks.forEach((chunk, index) => parts.push(renderNewsPage(report, chunk, index, ++page)))
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

const renderMunicipalityDossierMd = (report) => {
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
  .scope-card.card-sector { border-color: #c9b483; background: #fffcf6; }
  .scope-card.card-network { border-color: #b9acc3; background: #fcf9fd; }
  .scope-count { margin: 3mm 0 0; font-size: 16pt; font-weight: 600; font-variant-numeric: tabular-nums; }
  .scope-cards .tight-list { margin-top: 2mm; }
  .more-note { margin: 1.5mm 0 0; font-size: 8pt; font-weight: 600; color: #8a5a18; }
`

const instHeader = (report, title, subtitle, pageNo) => `
  <header class="report-header">
    <div>
      <p class="report-kicker">Dossiê institucional · ${htmlEscape(report.meta.subjectName)}</p>
      <h2 class="sheet-title">${htmlEscape(title)}</h2>
      ${subtitle ? `<p class="sheet-sub">${htmlEscape(subtitle)}</p>` : ''}
    </div>
    <div class="report-meta">
      <p><strong class="warning-text">INSUMO INTERNO — defeso 2026</strong></p>
      <p>Gerado em ${htmlEscape(formatDateTimeBr(report.meta.generatedAt))}</p>
      <p>pág. ${pageNo}/${report.meta.pageTotal}</p>
    </div>
  </header>`

const instFooter = (report, left, pageNo) => `
  <footer class="report-footer">
    <span>Dossiê institucional · ${htmlEscape(report.meta.subjectName)} · ${htmlEscape(left)}</span>
    <span>Gerado em ${htmlEscape(formatDateTimeBr(report.meta.generatedAt))} · pág. ${pageNo}/${report.meta.pageTotal}</span>
  </footer>`

/** Singular of the capped-list nouns (never derive it by chopping the "s"). */
const CAPPED_NOUNS = {
  itens: 'item',
  entregas: 'entrega',
  vínculos: 'vínculo',
}

const moreNote = (cappedList, noun = 'itens') => {
  if (cappedList.omitted <= 0) return ''
  const label = cappedList.omitted === 1 ? (CAPPED_NOUNS[noun] ?? noun) : noun
  return `<p class="more-note">e mais ${cappedList.omitted} ${label} com fonte fora desta página — nada foi descartado.</p>`
}

const identityBadgeList = (report) =>
  report.meta.identityBadges
    .map((badge) => `<span class="identity-badge">${htmlEscape(badge)}</span>`)
    .join(' ')

const renderInstitutionCover = (report) => `
<article class="sheet sheet-cover" data-page="capa" aria-label="Capa do dossiê institucional">
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
    <dt>Identificação</dt><dd>${identityBadgeList(report)}</dd>
    <dt>Data de geração</dt><dd class="tabular">${htmlEscape(formatDateTimeBr(report.meta.generatedAt))}</dd>
    <dt>Escopo e versão</dt><dd>Eras A / B / C · instituição, setor e rede separados · versão 01</dd>
  </dl>

  <div class="cover-grid">
    <div class="how-to"><p class="how-to-title">Como usar</p><p>${htmlEscape(report.cover.howToUse)}</p></div>
    ${assetBox('NEEDS ASSET', ['selo da instituição', 'uso autorizado e origem'])}
  </div>

  <div class="cover-foot">
    <div class="ink-rule"></div>
    <div class="cover-foot-row">
      <p class="cover-scope">${htmlEscape(report.cover.scope)}</p>
      <p class="cover-version">Documento de trabalho<br />versão 01</p>
    </div>
  </div>
</article>`

const renderInstitutionIdentity = (report) => {
  const identity = report.meta.identity ?? {}
  const rows = [
    ['Nome', identity.name],
    ['Tipo', identity.kindLabel],
    ['Esfera', identity.sphereLabel],
    ['Alcance', identity.scopeLabel],
    ['Alias', (identity.aliases ?? []).join(' · ') || '—'],
  ].filter(([, value]) => Boolean(value))
  return `<div class="id-card">
    <p class="eyebrow">Identificação</p>
    <dl>${rows.map(([key, value]) => `<dt>${htmlEscape(key)}</dt><dd>${htmlEscape(value)}</dd>`).join('')}</dl>
  </div>`
}

const renderInstitutionVincTimeline = (report) => {
  const timeline = report.page1.timeline
  if (timeline.items.length === 0) {
    return '<p class="muted small">Nenhum vínculo datado com fonte — ver lacunas explícitas.</p>'
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
    ${moreNote(timeline, 'vínculos')}`
}

const renderInstitutionDeliveries = (report) => {
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
    ${moreNote(deliveries, 'entregas')}
    <p class="muted small strong">Guarda de leitura: autorizado ≠ empenhado ≠ liquidado ≠ pago. A fase acompanha cada valor.</p>
  </section>`
}

const renderInstitutionHooksAndPending = (report) => {
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

const renderInstitutionSummary = (report, pageNo) => `
<article class="sheet" data-page="resumo" aria-label="Resumo de uma olhada do dossiê institucional">
  ${instHeader(report, 'Resumo de uma olhada', 'Informação datada e pronta para conferência', pageNo)}
  <section class="summary-top">
    ${renderInstitutionIdentity(report)}
    <div>
      <p class="eyebrow">01 · vínculo com a instituição</p>
      <h3 class="section-title">Linha do tempo documentada</h3>
      ${renderInstitutionVincTimeline(report)}
    </div>
  </section>
  ${renderInstitutionDeliveries(report)}
  ${renderInstitutionHooksAndPending(report)}
  ${instFooter(report, 'Resumo · INSUMO INTERNO', pageNo)}
</article>`

const renderInstitutionEraEmpty = (report, era, pageNo) => `
<article class="sheet" data-page="era-${era.id.toLowerCase()}" aria-label="${htmlEscape(era.label)}">
  ${instHeader(report, `${era.label} · Pesquisa sem evidência suficiente`, era.period, pageNo)}
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
    <p class="muted">A pesquisa não encontrou documento que sustente uma afirmação institucional. Isso não prova que não houve vínculo ou atuação; prova apenas que o dossiê ainda não pode afirmá-los.</p>
  </section>
  <section class="page1-grid">
    <div class="panel">
      <p class="eyebrow">O que foi feito</p>
      <ul class="tight-list">
        <li>Busca nominal por instituição e aliases.</li>
        <li>Consulta a fontes oficiais e acervos datados.</li>
        <li>Triagem de resultados por vínculo e abrangência.</li>
        <li>Descarte de menções sem lastro suficiente.</li>
      </ul>
    </div>
    <div class="panel">
      <p class="eyebrow">O que falta fazer</p>
      <ul class="tight-list">
        <li>Solicitar consulta ao arquivo físico.</li>
        <li>Validar nome histórico e unidade da instituição.</li>
        <li>Recuperar ato, ata ou documento contemporâneo.</li>
        <li>Repetir busca com alias confirmado.</li>
      </ul>
    </div>
  </section>
  <aside class="rule-warning">
    ${WARNING_ICON}
    <div>
      <p class="eyebrow warning-text">Regra editorial</p>
      <p><strong>Não preencher a seção por memória, cargo provável ou texto de outra era.</strong> Registrar “${htmlEscape(era.label)}: evidência institucional não localizada nas fontes consultadas”.</p>
    </div>
  </aside>
  ${instFooter(report, `${era.label} · lacuna explícita`, pageNo)}
</article>`

const renderInstitutionEra = (report, era, pageNo) => {
  if (era.empty) return renderInstitutionEraEmpty(report, era, pageNo)
  return `
<article class="sheet" data-page="era-${era.id.toLowerCase()}" aria-label="${htmlEscape(era.label)}">
  ${instHeader(report, era.label, `${era.period} · ${era.subtitle}`, pageNo)}

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
            <div><p class="eyebrow">Entregas localizadas</p><h3 class="section-title">Objeto, valor, fase e alcance</h3></div>
          </div>
          <table class="document-table">
            <caption class="sr-only">Valores por ano, fase, abrangência e fonte</caption>
            <colgroup><col style="width:26%" /><col style="width:14%" /><col style="width:9%" /><col style="width:16%" /><col style="width:15%" /><col style="width:20%" /></colgroup>
            <thead><tr><th>Objeto</th><th>Valor</th><th>Ano</th><th>Fase</th><th>Abrangência</th><th>Fonte</th></tr></thead>
            <tbody>${era.numbers
              .map(
                (row) => `<tr>
                  <td>${htmlEscape(row.object)}</td>
                  <td class="numeric">${valueCell(row.value, 'Valor a recuperar')}</td>
                  <td class="numeric">${htmlEscape(row.year ?? '—')}</td>
                  <td>${phaseBadge(row.phase)}</td>
                  <td>${scopeBadge(row.sphere, null, report.unit)}</td>
                  <td>${sourceLink(row.sourceUrl)}${row.sphere !== 'instituicao' ? '<br /><span class="meta">não somar à instituição</span>' : ''}</td>
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
          <p class="eyebrow">Atuação / vínculo registrado</p>
          <h3 class="section-title">Papéis com evidência visível</h3>
          <div class="action-grid">
            ${era.actions
              .map(
                (action) => `<article class="panel">
                  <div class="action-head">${scopeBadge(action.sphere, null, report.unit)}<span class="meta">${htmlEscape(action.year ?? '—')}</span></div>
                  <h4 class="action-title">${copyHtml(briefOr(action.brief, action.title))}</h4>
                  ${noteOr(action.brief, action.detail) ? `<p class="muted small">${copyHtml(noteOr(action.brief, action.detail))}</p>` : ''}
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
            <p class="eyebrow">Títulos, honrarias e vínculos institucionais</p>
            <ul class="tight-list">${era.honors
              .map(
                (honor) =>
                  `<li>${copyHtml(briefOr(honor.brief, honor.text))} ${sourceLink(honor.sourceUrl)}</li>`,
              )
              .join('')}</ul>
          </div>
          ${assetBox('NEEDS ASSET', ['reprodução do ato ou clipping', 'somente com origem e licença'])}
        </section>`
      : ''
  }

  ${instFooter(report, era.label, pageNo)}
</article>`
}

const renderInstitutionScope = (report, pageNo) => {
  const reach = report.reach
  const cardClass = { institution: '', sector: 'card-sector', network: 'card-network' }
  return `
<article class="sheet" data-page="abrangencia" aria-label="Painel de abrangência institucional">
  ${instHeader(report, 'Abrangência: instituição × setor × rede', 'Três recortes, três leituras, nenhuma soma combinada', pageNo)}

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
          (list) => `<article class="scope-card ${cardClass[list.key] ?? ''}">
            <div class="action-head">${scopeBadge(list.sphere, null, report.unit)}<span class="meta strong">${list.sphere === 'instituicao' ? 'DIRETO' : 'NÃO SOMAR'}</span></div>
            <p class="scope-count tabular">${list.total} ${list.total === 1 ? 'item' : 'itens'}</p>
            <p class="meta">com fonte</p>
            <ul class="tight-list">${list.items
              .map(
                (item) =>
                  `<li>${copyHtml(item.brief?.title ?? item.answer)} ${sourceLink(item.sourceUrl)}</li>`,
              )
              .join(
                '',
              )}${list.items.length === 0 ? '<li class="muted">Nenhum item com fonte.</li>' : ''}</ul>
            ${moreNote(list, 'itens')}
          </article>`,
        )
        .join('')}
    </div>
  </section>

  ${
    reach.evidence.items.length
      ? `<section class="block">
          <div class="block-head"><div><p class="eyebrow">Evidência de alcance</p><h3 class="section-title">Por que cada item está neste recorte</h3></div><p class="warning-text meta strong">Sem evidência, vira lacuna</p></div>
          <table class="document-table">
            <caption class="sr-only">Itens de setor e rede com evidência de alcance</caption>
            <colgroup><col style="width:26%" /><col style="width:16%" /><col style="width:38%" /><col style="width:20%" /></colgroup>
            <thead><tr><th>Item</th><th>Abrangência</th><th>Evidência de alcance</th><th>Fonte</th></tr></thead>
            <tbody>${reach.evidence.items
              .map(
                (row) => `<tr>
                  <td>${copyHtml(briefOr(row.brief, row.item))}</td>
                  <td>${scopeBadge(row.sphere, null, report.unit)}</td>
                  <td>${copyHtml(row.evidence)}</td>
                  <td>${sourceLink(row.sourceUrl)}</td>
                </tr>`,
              )
              .join('')}</tbody>
          </table>
          ${moreNote(reach.evidence, 'itens')}
        </section>`
      : ''
  }

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

const honorDate = (honor) => {
  if (honor.date) return formatDateBr(honor.date)
  if (honor.year) return String(honor.year)
  return '—'
}

const institutionHonors = (report) => report.eras.find((era) => era.id === 'C')?.honors ?? []

const hasInstitutionHonors = (report) => institutionHonors(report).length > 0

const renderInstitutionHonors = (report, pageNo) => {
  const honors = institutionHonors(report)
  if (honors.length === 0) return ''
  const gap = report.gaps?.[0] ?? null
  const hook = report.reach.hook ?? report.page1.hooks.items[0] ?? null
  return `
<article class="sheet" data-page="titulos" aria-label="Títulos, honrarias e vínculos institucionais">
  ${instHeader(report, 'Títulos, honrarias e vínculos', 'Reconhecimento não substitui entrega; vínculo não prova resultado', pageNo)}
  <section class="block">
    <p class="eyebrow">Registros confirmados</p>
    <h3 class="section-title">Data, natureza e fonte primária</h3>
    <table class="document-table">
      <caption class="sr-only">Títulos, honrarias e vínculos por data e fonte</caption>
      <colgroup><col style="width:14%" /><col style="width:20%" /><col style="width:35%" /><col style="width:31%" /></colgroup>
      <thead><tr><th>Data</th><th>Natureza</th><th>Registro</th><th>Fonte</th></tr></thead>
      <tbody>${honors
        .map(
          (honor) => `<tr>
            <td class="numeric">${htmlEscape(honorDate(honor))}</td>
            <td><span class="identity-badge">reconhecimento</span></td>
            <td><strong>${copyHtml(briefOr(honor.brief, honor.text))}</strong>${noteOr(honor.brief, honor.detail) ? `<br /><span class="meta">${copyHtml(noteOr(honor.brief, honor.detail))}</span>` : ''}</td>
            <td>${sourceLink(honor.sourceUrl)}</td>
          </tr>`,
        )
        .join('')}</tbody>
    </table>
  </section>
  <section class="block honors">
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
  </section>
  ${instFooter(report, 'Títulos e vínculos · INSUMO INTERNO', pageNo)}
</article>`
}

const renderInstitutionGapsPage = (report, chunk, index, pageNo) => {
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
  ${instHeader(report, 'Lacunas explícitas', `O que não foi encontrado${index > 0 ? ` (continuação ${index + 1})` : ''}`, pageNo)}
  <section class="block">
    <div class="block-head"><div><p class="eyebrow">O que não foi encontrado</p><h3 class="section-title">Lacunas explícitas</h3></div><p class="warning-text meta strong">Não completar por memória ou inferência</p></div>
    <table class="document-table">
      <caption class="sr-only">Tabela de lacunas explícitas e próximos passos de apuração</caption>
      <colgroup><col style="width:26%" /><col style="width:30%" /><col style="width:24%" /><col style="width:20%" /></colgroup>
      <thead><tr><th>Lacuna</th><th>Situação da busca</th><th>Limite editorial</th><th>Próximo passo</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>
  ${instFooter(report, 'Lacunas explícitas · INSUMO INTERNO', pageNo)}
</article>`
}

const renderInstitutionSourcesPage = (report, pageNo) => `
<article class="sheet" data-page="fontes" aria-label="Fontes e limites do dossiê institucional">
  ${instHeader(report, 'Fontes e limites', 'O que foi consultado e o que não se pode afirmar', pageNo)}

  ${
    report.news.length
      ? `<section class="block">
          <p class="eyebrow">Lista clicável</p>
          <h3 class="section-title">Notícias e documentos consultados</h3>
          <table class="document-table">
            <caption class="sr-only">Fontes consultadas: data 12%, veículo 13%, título 47% e link 28%</caption>
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

  ${
    report.acervo?.items?.length
      ? `<section class="block">
          <div class="block-head"><div><p class="eyebrow">Acervo interno (read-only)</p><h3 class="section-title">Falas do mandato sobre o recorte</h3></div><p class="meta">Base Teqo, 2011+</p></div>
          <ul class="tight-list">${report.acervo.items
            .map(
              (row) =>
                `<li><strong>${htmlEscape(row.period)}</strong> — ${copyHtml(row.text)}${row.excerpt ? ` <span class="muted small">(${copyHtml(row.excerpt)})</span>` : ''} ${sourceLink(row.sourceUrl)}</li>`,
            )
            .join('')}</ul>
          ${moreNote(report.acervo, 'itens')}
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

  ${instFooter(report, 'Fontes e limites · INSUMO INTERNO', pageNo)}
</article>`

const renderInstitutionDossierHtml = (report) => {
  const gapChunks = chunkGaps(report.gaps)
  report.meta.pageTotal =
    1 + // capa
    1 + // resumo
    report.eras.length +
    1 + // abrangência
    (hasInstitutionHonors(report) ? 1 : 0) +
    gapChunks.length +
    1 // fontes
  let page = 0
  const parts = []
  parts.push(renderInstitutionCover(report))
  page += 1
  parts.push(renderInstitutionSummary(report, ++page))
  for (const era of report.eras) parts.push(renderInstitutionEra(report, era, ++page))
  parts.push(renderInstitutionScope(report, ++page))
  if (hasInstitutionHonors(report)) parts.push(renderInstitutionHonors(report, ++page))
  gapChunks.forEach((chunk, index) =>
    parts.push(renderInstitutionGapsPage(report, chunk, index, ++page)),
  )
  parts.push(renderInstitutionSourcesPage(report, ++page))

  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${htmlEscape(report.meta.title)} — ${htmlEscape(report.meta.subjectName)}</title><style>${INSTITUTION_PRINT_CSS}</style></head>
<body>
${parts.join('\n')}
</body>
</html>`
}

const institutionMdEra = (era) => {
  const lines = [
    `## ${era.label} (${era.period})`,
    '',
    `_${era.method}_`,
    '',
    `Trilha: ${era.recovery}`,
  ]
  if (era.empty) {
    lines.push(
      '',
      `> Lacuna explícita: nenhuma fonte suficiente foi localizada para a ${era.label}. Isso não prova ausência — prova que o dossiê ainda não pode afirmar.`,
    )
    return lines.join('\n')
  }
  if (era.numbers.length) {
    lines.push(
      '',
      '| Objeto | Valor | Ano | Fase | Abrangência | Fonte |',
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

const renderInstitutionDossierMd = (report) => {
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
    `- **Nome:** ${report.meta.identity?.name ?? '—'}`,
    `- **Tipo:** ${report.meta.identity?.kindLabel ?? '—'}`,
    `- **Esfera:** ${report.meta.identity?.sphereLabel ?? '—'}`,
    `- **Alcance:** ${report.meta.identity?.scopeLabel ?? '—'}`,
    `- **Alias:** ${(report.meta.identity?.aliases ?? []).join(' · ') || '—'}`,
    '',
    '## Linha do tempo documentada',
    '',
  ]
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

  for (const era of report.eras) lines.push('', institutionMdEra(era))

  lines.push('', '## Abrangência: instituição × setor × rede', '')
  lines.push(`> ${report.reach.ruleTitle}`, `> ${report.reach.ruleBody}`, '')
  for (const list of report.reach.lists) {
    lines.push(`### ${list.label}`, '')
    if (list.items.length === 0) lines.push('- Nenhum item com fonte.')
    for (const item of list.items) {
      lines.push(`- ${stripInlineSources(item.answer)} — [fonte](${item.sourceUrl})`)
    }
    if (list.omitted > 0) lines.push(`- _e mais ${list.omitted} item(ns) com fonte._`)
    lines.push('')
  }
  if (report.reach.evidence.items.length) {
    lines.push('| Item | Abrangência | Evidência | Fonte |', '| --- | --- | --- | --- |')
    for (const item of report.reach.evidence.items) {
      lines.push(
        `| ${stripInlineSources(item.item)} | ${item.sphere} | ${stripInlineSources(item.evidence)} | ${item.sourceUrl} |`,
      )
    }
  }

  if (report.acervo?.items?.length) {
    lines.push('', '## Acervo interno (read-only)', '')
    for (const row of report.acervo.items) {
      lines.push(
        `- **${row.period}** — ${stripInlineSources(row.text)}${row.excerpt ? ` _(${stripInlineSources(row.excerpt)})_` : ''} [fonte](${row.sourceUrl})`,
      )
    }
    if (report.acervo.omitted > 0)
      lines.push(`- _e mais ${report.acervo.omitted} fala(s) com fonte._`)
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

/** Dispatch: institution reports render with the institutional sections. */
export const renderDossierHtml = (report) =>
  isInstitutionUnit(report.unit)
    ? renderInstitutionDossierHtml(report)
    : renderMunicipalityDossierHtml(report)

export const renderDossierMd = (report) =>
  isInstitutionUnit(report.unit)
    ? renderInstitutionDossierMd(report)
    : renderMunicipalityDossierMd(report)
