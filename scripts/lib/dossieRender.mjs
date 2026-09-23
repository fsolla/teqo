/**
 * Dossiê renderer (C186; sober redesign C209): the block model goes to print
 * HTML (Chromium `page.pdf`, A4, one `.sheet` per page) and to the companion
 * `.md`. Ports the approved hi-fi classes
 * (`docs/plans/dossies-sobrios-analiticos-ui-design.html`) class-by-class:
 * analysis first (O essencial, Leitura entre eras, O que Solla defende), lists
 * and tables as the spine, no cards, colored badges, charts or images. Shared
 * escaping/source-token contract lives in `reportText.mjs`.
 */

import { formatDateBr, formatDateTimeBr } from './cityReportFormat.mjs'
import { dossierPhaseLabel } from './dossieBlocks.mjs'
import { MUNICIPALITY_UNIT, isSubjectUnit, resolveDossierUnit } from './dossieUnit.mjs'
import { htmlEscape, stripInlineSources } from './reportText.mjs'

const SOURCE_LABEL = '(fonte)'

const sourceLink = (url, label = SOURCE_LABEL) =>
  url
    ? `<a class="source-link" href="${htmlEscape(url)}" aria-label="Abrir fonte">${htmlEscape(label)}</a>`
    : ''

/** Print copy prefers the reformulated `brief`; the era/MD keep the integral record. */
const copyHtml = (value) => htmlEscape(stripInlineSources(value))
const briefOr = (brief, fallback) => brief?.title ?? fallback
const noteOr = (brief, fallback) => brief?.note ?? fallback

const phaseText = (phase) =>
  `<span class="phase-text">${htmlEscape(dossierPhaseLabel(phase))}</span>`

const placeholder = (label) =>
  `<span class="placeholder-bar" aria-label="${htmlEscape(label)}"></span>`

const valueCell = (value, widthLabel = 'Valor desconhecido') =>
  value === null || value === undefined || value === ''
    ? placeholder(widthLabel)
    : `<strong>${htmlEscape(value)}</strong>`

const runningHead = (report, { kicker, title, subtitle, section, pageNo, continuation = null }) => {
  const docLabel = isSubjectUnit(report.unit)
    ? report.unit.docLabel
    : `Dossiê cidade · ${report.meta.municipalityName}`
  return `
  <header class="running-head">
    <div>
      <p class="running-kicker">${htmlEscape(kicker ?? docLabel)}</p>
      <h2 class="running-title">${htmlEscape(title)}</h2>
      ${subtitle ? `<p class="running-subtitle">${htmlEscape(subtitle)}</p>` : ''}
    </div>
    <div class="running-meta">
      ${continuation ? `<p class="continuation">${htmlEscape(continuation)}</p>` : section ? `<p>${htmlEscape(section)}</p>` : ''}
      <p><strong class="ink-strong">${htmlEscape(report.cover.internalNote)}</strong></p>
      <p>${htmlEscape(report.meta.generatedAtLabel)} · versão 01</p>
      <p>folha ${pageNo}/${report.meta.pageTotal}</p>
    </div>
  </header>`
}

const runningFooter = (report, { left, anchor, pageNo }) => `
  <footer class="running-footer">
    <span>${htmlEscape(left)}${anchor ? ` · âncora no companion: <strong>#${htmlEscape(anchor)}</strong>` : ''}</span>
    <span class="folio">folha ${pageNo}/${report.meta.pageTotal}</span>
  </footer>`

const tableHead = (columns) =>
  `<thead><tr>${columns.map((column) => `<th>${htmlEscape(column)}</th>`).join('')}</tr></thead>`

/**
 * Section numbers of the family: the index order IS the section order. Omitted
 * eras do not consume a number; the recorte section follows the rendered eras.
 */
const sectionNumbers = (report) => {
  const renderedEras = report.eras.filter((era) => !era.omitted)
  const numbers = { resumo: 1, sintese: 2, trajetoria: 3 }
  renderedEras.forEach((era, index) => {
    numbers[`era-${era.id.toLowerCase()}`] = 4 + index
  })
  const afterEras = 4 + renderedEras.length
  if (isSubjectUnit(report.unit)) {
    numbers.abrangencia = afterEras
    numbers.titulos = afterEras + 1
    numbers.defende = afterEras + (report.unit.honorsSheet ? 2 : 1)
  } else {
    numbers.regiao = afterEras
    numbers.defende = afterEras + 1
  }
  numbers.lacunas = numbers.defende + 1
  return numbers
}

const sectionLabel = (report, key) => {
  const number = sectionNumbers(report)[key]
  return number ? `Seção ${String(number).padStart(2, '0')}` : null
}

const sectionHead = (eyebrow, title) => `
  <div class="section-head">
    <p class="eyebrow">${htmlEscape(eyebrow)}</p>
    ${title ? `<h3 class="section-title">${htmlEscape(title)}</h3>` : ''}
  </div>`

/* ------------------------------------------------------------------ *
 * Capa (design cena 01)                                              *
 * ------------------------------------------------------------------ */

const renderCover = (report) => {
  const cover = report.cover
  const subject = isSubjectUnit(report.unit)
  const titleWords = htmlEscape(cover.title)
  return `
<article class="sheet" data-page="capa" aria-label="Capa do dossiê">
  <header class="cover-series">
    <div>
      <p class="cover-series-name">${htmlEscape(cover.eyebrow)}</p>
      <p class="small muted">${htmlEscape(cover.series)}</p>
    </div>
    <p class="cover-internal">
      <strong class="ink-strong">${htmlEscape(cover.internalNote)}</strong><br />${htmlEscape(cover.internalNoteSub)}
    </p>
  </header>

  <div class="cover-main">
    <p class="cover-overline">Jorge Solla · ${htmlEscape(cover.kicker)}</p>
    <h1 class="cover-title">${
      subject
        ? `Dossiê Solla —<br /><span>${titleWords}</span>`
        : titleWords.replace(/^(\S+)\s+(.*)$/, '$1 <span>$2</span>')
    }</h1>
    <p class="cover-subtitle">${htmlEscape(cover.subtitle)}</p>
  </div>

  <dl class="cover-data">
    ${
      subject
        ? report.unit
            .identityRows(report.meta.identity ?? {})
            .map(([key, value]) => `<dt>${htmlEscape(key)}</dt><dd>${htmlEscape(value)}</dd>`)
            .join('')
        : `<dt>Território</dt><dd>${htmlEscape(cover.territory)}</dd>
    <dt>Região / polo</dt><dd>${htmlEscape(cover.pole)}</dd>`
    }
    <dt>Data</dt>
    <dd class="tabular">${htmlEscape(report.meta.generatedAtLabel)} · base lida em ${htmlEscape(report.meta.readAtLabel)}</dd>
    <dt>Versão</dt>
    <dd>01 · documento de trabalho · INSUMO INTERNO</dd>
  </dl>

  <div class="cover-how">
    <strong>Como ler</strong>
    <p>${htmlEscape(cover.howToUse)}</p>
  </div>

  <footer class="cover-footer">
    <p class="m-0">${htmlEscape(cover.scope)}</p>
    <p class="cover-stamp">${htmlEscape(cover.version)}<br />A4 · ${htmlEscape(cover.internalNoteSub)}</p>
  </footer>
</article>`
}

/* ------------------------------------------------------------------ *
 * O essencial + índice (design cena 02)                              *
 * ------------------------------------------------------------------ */

/**
 * Canonical index of the family: the order the sheets are printed in. An
 * omitted era stays in the index with the explicit "sem evidência" note — never
 * a page number.
 */
const buildIndexEntries = (report) => {
  const entries = [
    {
      anchor: 'resumo',
      mdAnchor: 'o-essencial',
      label: 'O essencial',
      heading: 'O essencial',
      included: true,
    },
    {
      anchor: 'sintese',
      mdAnchor: 'leitura-entre-eras',
      label: 'Leitura entre eras',
      heading: 'Leitura entre eras',
      included: true,
    },
    {
      anchor: 'trajetoria',
      mdAnchor: 'trajetoria-completa',
      label: 'Trajetória completa',
      heading: 'Trajetória completa',
      included: true,
    },
  ]
  for (const era of report.eras) {
    entries.push({
      anchor: `era-${era.id.toLowerCase()}`,
      mdAnchor: `era-${era.id.toLowerCase()}`,
      label: era.label,
      heading: era.label,
      included: !era.omitted,
    })
  }
  if (isSubjectUnit(report.unit)) {
    entries.push({
      anchor: 'abrangencia',
      mdAnchor: 'abrangencia',
      label: `Abrangência: ${report.unit.spheres
        .map((sphere) => report.unit.sphereLabels[sphere])
        .join(' × ')}`,
      heading: 'Abrangência',
      included: true,
    })
    if (report.unit.honorsSheet) {
      entries.push({
        anchor: 'titulos',
        mdAnchor: 'titulos',
        label: 'Títulos, honrarias e vínculos',
        heading: 'Títulos, honrarias e vínculos',
        included: report.eras.some((era) => listOf(era.honors).length),
      })
    }
  } else {
    entries.push({
      anchor: 'regiao',
      mdAnchor: 'regiao-e-polo',
      label: 'Região e polo',
      heading: 'Região / polo',
      included: true,
    })
  }
  entries.push({
    anchor: 'defende',
    mdAnchor: 'o-que-solla-defende',
    label: 'O que Solla defende',
    heading: 'O que Solla defende',
    included: true,
  })
  entries.push({
    anchor: 'lacunas',
    mdAnchor: 'lacunas-explicitas',
    label: 'Lacunas, notícias, acervo e fontes',
    heading: 'Lacunas explícitas',
    included: true,
  })
  return entries
}

const renderIndex = (report, pages, indexMode) => {
  const entries = buildIndexEntries(report)
  return `
  <section class="section">
    <p class="eyebrow">Índice</p>
    <ol class="index-list">
      ${(() => {
        let number = 0
        return entries
          .map((entry) => {
            const page = pages?.[entry.anchor]
            const pageLabel = entry.included && page && indexMode === 'pages' ? String(page) : '—'
            if (!entry.included) {
              return `<li>
        <span class="index-number"></span><span class="index-label">${htmlEscape(entry.label)} — sem evidência nominal suficiente; consulte as lacunas</span><span class="index-page tabular">—</span>
      </li>`
            }
            number += 1
            return `<li>
        <span class="index-number">${String(number).padStart(2, '0')}</span><span class="index-label">${htmlEscape(entry.label)}</span><span class="index-page tabular">${pageLabel}</span>
      </li>`
          })
          .join('')
      })()}
    </ol>
  </section>`
}

const renderEssentials = (report, { pageNo, pages = null, indexMode = 'pages' }) => {
  const lede = report.opening.paragraphs
  return `
<article class="sheet" data-page="resumo" aria-label="O essencial do dossiê">
  ${runningHead(report, {
    kicker: isSubjectUnit(report.unit)
      ? `${report.unit.docLabel} · ${report.meta.subjectName}`
      : `Dossiê cidade · ${report.meta.municipalityName}`,
    title: 'O essencial',
    subtitle: 'Leitura do recorte antes do inventário',
    section: sectionLabel(report, 'resumo'),
    pageNo,
  })}

  <section class="section">
    <p class="eyebrow">Leitura do recorte</p>
    ${lede.map((paragraph, index) => `<p class="${index === 0 ? 'lede' : 'body-copy'}">${copyHtml(paragraph)}</p>`).join('')}
  </section>

  ${
    isSubjectUnit(report.unit)
      ? `<section class="section">
    <p class="eyebrow">Identificação</p>
    <table class="document-table">
      <caption class="sr-only">Identificação do recorte</caption>
      <colgroup><col style="width:24%" /><col style="width:76%" /></colgroup>
      <tbody>${report.unit
        .identityRows(report.meta.identity ?? {})
        .map(
          ([key, value]) =>
            `<tr><th scope="row">${htmlEscape(key)}</th><td>${htmlEscape(value)}</td></tr>`,
        )
        .join('')}</tbody>
    </table>
  </section>`
      : ''
  }

  <section class="section">
    <p class="eyebrow">Fatos-chave</p>
    <ul class="plain-list fact-list">
      ${report.essentials.facts
        .map(
          (fact) => `<li><strong>${htmlEscape(fact.label)}</strong> ${htmlEscape(fact.text)}</li>`,
        )
        .join('')}
    </ul>
  </section>

  ${renderIndex(report, pages, indexMode)}

  ${runningFooter(report, {
    left: `${report.meta.subjectName ?? report.meta.municipalityName} · O essencial`,
    anchor: 'o-essencial',
    pageNo,
  })}
</article>`
}

/* ------------------------------------------------------------------ *
 * Leitura entre eras (design cena 03)                                *
 * ------------------------------------------------------------------ */

const renderBetweenEras = (report, pageNo) => `
<article class="sheet" data-page="sintese" aria-label="Leitura entre eras">
  ${runningHead(report, {
    kicker: isSubjectUnit(report.unit)
      ? `${report.unit.docLabel} · ${report.meta.subjectName}`
      : `Dossiê cidade · ${report.meta.municipalityName}`,
    title: 'Leitura entre eras',
    subtitle: 'Concentração, instrumentos, continuidade, ruptura e lacunas',
    section: sectionLabel(report, 'sintese'),
    pageNo,
  })}

  <section class="section">
    <p class="eyebrow">O que muda quando os registros são lidos em conjunto</p>
    <ul class="plain-list analysis-list">
      ${report.betweenEras.bullets
        .map(
          (bullet) =>
            `<li>${bullet.label ? `<strong>${htmlEscape(bullet.label)}</strong> ` : ''}${htmlEscape(bullet.text)}</li>`,
        )
        .join('')}
    </ul>
  </section>

  <section class="section">
    <p class="eyebrow">Síntese operacional</p>
    <table class="document-table">
      <caption class="sr-only">Como citar cada era com segurança e qual é o limite</caption>
      <colgroup><col style="width:20%" /><col style="width:27%" /><col style="width:35%" /><col style="width:18%" /></colgroup>
      ${tableHead(['Era', 'Onde está a evidência', 'Como citar com segurança', 'Limite'])}
      <tbody>${report.betweenEras.table
        .map(
          (row) =>
            `<tr><td><strong>${htmlEscape(row.era)}</strong></td><td>${htmlEscape(row.where)}</td><td>${htmlEscape(row.howToCite)}</td><td>${htmlEscape(row.limit)}</td></tr>`,
        )
        .join('')}</tbody>
    </table>
  </section>

  <div class="callout-line">
    <strong class="ink-strong">Regra de leitura:</strong> análise é orientação para encontrar
    a evidência — não substitui a linha, a fonte ou a data que sustentam cada afirmação.
  </div>

  ${runningFooter(report, {
    left: `${report.meta.subjectName ?? report.meta.municipalityName} · Leitura entre eras`,
    anchor: 'leitura-entre-eras',
    pageNo,
  })}
</article>`

/* ------------------------------------------------------------------ *
 * Trajetória completa (design cena 04)                               *
 * ------------------------------------------------------------------ */

const renderTrajectory = (report, pageNo) => `
<article class="sheet" data-page="trajetoria" aria-label="Trajetória completa">
  ${runningHead(report, {
    kicker: isSubjectUnit(report.unit)
      ? `${report.unit.docLabel} · ${report.meta.subjectName}`
      : `Dossiê cidade · ${report.meta.municipalityName}`,
    title: 'Trajetória completa',
    subtitle: 'Período, papel e como cada etapa foi recuperada',
    section: sectionLabel(report, 'trajetoria'),
    pageNo,
  })}

  <section class="section">
    <table class="document-table trajectory-table">
      <caption class="sr-only">Trajetória completa por período, papel e lastro</caption>
      <colgroup><col style="width:24%" /><col style="width:40%" /><col style="width:36%" /></colgroup>
      ${tableHead(['Período', 'Papel', 'Como recuperar / lastro'])}
      <tbody>${report.trajectory
        .map(
          (row) =>
            `<tr>
        <td>${htmlEscape(row.period)}</td>
        <td>${htmlEscape(row.role)}</td>
        <td>${htmlEscape(row.recovery)}${row.uncertain ? ` <span class="muted">· ${htmlEscape(row.uncertain)}</span>` : ''}</td>
      </tr>`,
        )
        .join('')}</tbody>
    </table>
    <p class="table-note">
      A trajetória contextualiza o período. Ela não prova vínculo com o recorte; esse
      vínculo só aparece quando a seção da era traz evidência do recorte.
    </p>
  </section>

  ${runningFooter(report, {
    left: `${report.meta.subjectName ?? report.meta.municipalityName} · Trajetória`,
    anchor: 'trajetoria-completa',
    pageNo,
  })}
</article>`

/* ------------------------------------------------------------------ *
 * Eras (design cena 05) — flowing sheets                              *
 * ------------------------------------------------------------------ */

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

const eraNumbersTable = (units, unit) => `
    <table class="document-table">
      <caption class="sr-only">Valores por ano, fase, esfera e fonte</caption>
      <colgroup><col style="width:26%" /><col style="width:15%" /><col style="width:10%" /><col style="width:17%" /><col style="width:12%" /><col style="width:20%" /></colgroup>
      ${tableHead(['Objeto', 'Valor', 'Ano', 'Fase', unit.sphereColumnLabel ?? 'Esfera', 'Fonte'])}
      <tbody>${units.map((entry) => entry.html).join('')}</tbody>
    </table>`

/** Accepts the subject's `{ items }` capped objects and the city's plain arrays. */
const listOf = (value) => (Array.isArray(value) ? value : (value?.items ?? []))

/** Era units: value rows (table) then the "O que fez" list (action-list items). */
const eraUnits = (report, era, probe) => {
  const unit = report.unit ?? MUNICIPALITY_UNIT
  const units = []
  for (const row of listOf(era.numbers)) {
    units.push({
      layout: 'tr',
      html: `<tr${unitAttrs(probe, units.length, 'tr')}>
        <td>${htmlEscape(row.object)}</td>
        <td class="tabular">${valueCell(row.value, 'Valor a recuperar')}</td>
        <td class="tabular">${htmlEscape(row.year ?? '—')}</td>
        <td>${phaseText(row.phase)}</td>
        <td>${htmlEscape(unit.sphereLabels[row.sphere] ?? row.sphere)}${
          row.sphere !== unit.defaultSphere
            ? ` <span class="muted">· ${htmlEscape(unit.notSummedInline ?? 'não somar')}</span>`
            : ''
        }</td>
        <td>${sourceLink(row.sourceUrl, row.sourceDate ? formatDateBr(row.sourceDate) : SOURCE_LABEL)}</td>
      </tr>`,
    })
  }
  const actions = [
    ...listOf(era.actions).map((action) => ({
      title: action.title,
      brief: action.brief,
      detail: action.detail,
      sphere: action.sphere,
      scopeLabel: action.scopeLabel ?? null,
      sourceUrl: action.sourceUrl,
    })),
    // Units with their own honors sheet (institution) do not repeat them here.
    ...(report.unit.honorsSheet
      ? []
      : listOf(era.honors).map((honor) => ({
          title: honor.text,
          brief: honor.brief,
          detail: null,
          sphere: unit.defaultSphere,
          sourceUrl: honor.sourceUrl,
        }))),
  ]
  for (const action of actions) {
    units.push({
      layout: 'action',
      html: `<li${unitAttrs(probe, units.length, 'action')}>
        <span class="action-title">${copyHtml(briefOr(action.brief, action.title))}</span>
        <span class="action-meta">Alcance: ${htmlEscape(action.scopeLabel ?? unit.sphereLabels[action.sphere] ?? action.sphere ?? '—')}${
          noteOr(action.brief, action.detail)
            ? ` · Lastro: ${copyHtml(noteOr(action.brief, action.detail))}`
            : ' · Lastro'
        } ${sourceLink(action.sourceUrl)}</span>
      </li>`,
    })
  }
  return units
}

const renderEraSheet = ({ report, era, entry, probe, pageNo }) => {
  const unit = report.unit ?? MUNICIPALITY_UNIT
  const body = groupUnits(entry.chunk)
    .map((group) => {
      if (group.layout === 'tr') {
        return `<section class="section">
        ${sectionHead('Objetos, valores e estágio', unit.eraNumbersTitle ?? 'Objeto, valor, fase e alcance')}
        ${eraNumbersTable(group.units, unit)}
        <p class="table-note">
          “Não se aplica” diferencia atos sem valor financeiro. “Não localizado” não equivale a
          zero. Fase permanece texto, sem selo ou cor semântica.
        </p>
      </section>`
      }
      return `<section class="section">
        ${sectionHead('O que fez · item — alcance — lastro', unit.eraActionsTitle ?? 'Papéis com evidência visível')}
        <ol class="action-list">${group.units.map((item) => item.html).join('')}</ol>
      </section>`
    })
    .join('')
  return `
<article class="sheet" data-page="${entry.anchor}"${probe ? ` data-pack-section="era:${era.id}"` : ''} aria-label="${htmlEscape(era.label)}">
  ${runningHead(report, {
    kicker: era.label,
    title: `${era.subtitle} · ${era.period}`,
    subtitle: null,
    section: sectionLabel(report, `era-${era.id.toLowerCase()}`),
    pageNo,
    continuation: entry.index > 0 ? `continuação ${entry.index + 1}` : null,
  })}

  ${
    entry.index === 0 && (era.narrative || era.summary)
      ? `<section class="era-reading"${probe ? ' data-pack-fixed="reading"' : ''}>
    <p class="eyebrow">Leitura da era</p>
    <p class="body-copy">${copyHtml(era.narrative ?? era.summary)}</p>
  </section>`
      : ''
  }

  ${body}

  ${runningFooter(report, {
    left: `${report.meta.subjectName ?? report.meta.municipalityName} · ${era.label}`,
    anchor: `era-${era.id.toLowerCase()}`,
    pageNo,
  })}
</article>`
}

const renderEraEmptySheet = (report, era, pageNo) => {
  const empty = report.unit.copy?.eraEmpty ?? {}
  return `
<article class="sheet" data-page="era-${era.id.toLowerCase()}" aria-label="${htmlEscape(era.label)}">
  ${runningHead(report, {
    kicker: era.label,
    title: `${era.subtitle} · ${era.period}`,
    subtitle: null,
    pageNo,
  })}
  <section class="empty-panel" style="margin-top: 5mm">
    <p class="eyebrow">Lacuna explícita · não é “zero”</p>
    <h3 class="rule-title">Nenhuma fonte suficiente foi localizada para esta era.</h3>
    <p class="muted">${htmlEscape(empty.body ?? 'A pesquisa não encontrou documento que sustente uma afirmação sobre o recorte.')}</p>
  </section>
  <section class="section">
    <p class="eyebrow">O que foi feito</p>
    <ul class="plain-list">
      ${(empty.work ?? []).map((item) => `<li>${htmlEscape(item)}</li>`).join('')}
    </ul>
  </section>
  <section class="section">
    <p class="eyebrow">O que falta fazer</p>
    <ul class="plain-list">
      ${(empty.todo ?? []).map((item) => `<li>${htmlEscape(item)}</li>`).join('')}
    </ul>
  </section>
  <div class="callout-line">
    <strong class="ink-strong">Regra editorial:</strong> ${htmlEscape(
      typeof empty.rule === 'function'
        ? empty.rule(era.label)
        : 'Não preencher por memória, cargo provável ou texto de outra era.',
    )}
  </div>
  ${runningFooter(report, { left: `${era.label} · lacuna explícita`, pageNo })}
</article>`
}

const renderEraSheets = ({ report, era, pack, probe, nextPage }) => {
  if (era.omitted) return []
  if (era.empty) return [renderEraEmptySheet(report, era, nextPage())]
  const units = eraUnits(report, era, probe)
  return packedSection({
    key: `era:${era.id}`,
    anchor: `era-${era.id.toLowerCase()}`,
    units,
    pack,
    probe,
  }).map((entry) => renderEraSheet({ report, era, entry, probe, pageNo: nextPage() }))
}

/* ------------------------------------------------------------------ *
 * Região / polo (design cena 06)                                     *
 * ------------------------------------------------------------------ */

const listYearRange = (items) => {
  const years = items
    .map((item) => item.year ?? (item.sourceDate ? String(item.sourceDate).slice(0, 4) : null))
    .filter(Boolean)
    .sort()
  return years.length ? `${years[0]}–${years[years.length - 1]}` : null
}

/** Region recorte: callout + one labelled table sequence per list, packed by measurement. */
const regionUnits = (report, probe) => {
  const units = []
  const lists = [
    { list: report.region.municipal, label: 'Município · menção direta' },
    { list: report.region.regional, label: 'Região / polo · alcance compartilhado' },
  ]
  for (const { list, label } of lists) {
    const years = listYearRange(list.items)
    units.push({
      layout: 'head',
      html: `<tr${unitAttrs(probe, units.length, 'head')} class="list-head"><td colspan="4"><span class="eyebrow">${htmlEscape(label)}</span> <span class="muted">${list.total} ${list.total === 1 ? 'item' : 'itens'} com fonte${years ? ` · ${htmlEscape(years)}` : ''}</span></td></tr>`,
    })
    if (list.items.length === 0) {
      units.push({
        layout: 'tr',
        html: `<tr><td colspan="4" class="muted">Nenhum item com fonte.</td></tr>`,
      })
      continue
    }
    for (const item of list.items) {
      units.push({
        layout: 'tr',
        html: `<tr${unitAttrs(probe, units.length, 'tr')}>
      <td>${copyHtml(briefOr(item.brief, item.answer))}</td>
      <td>${htmlEscape(report.unit.sphereLabels[item.sphere] ?? item.sphere)}</td>
      <td>${copyHtml(item.details ?? item.brief?.note ?? '—')}</td>
      <td>${sourceLink(item.sourceUrl)}</td>
    </tr>`,
      })
    }
  }
  return units
}

const renderRegionSheet = ({ report, entry, probe, pageNo, isLast }) => `
<article class="sheet" data-page="${entry.anchor}"${probe ? ' data-pack-section="region"' : ''} aria-label="Município, região e polo">
  ${runningHead(report, {
    kicker: `Dossiê cidade · ${report.meta.municipalityName}`,
    title: 'Município, região e polo',
    subtitle: 'Alcances apresentados em sequências separadas',
    section: entry.index === 0 ? sectionLabel(report, 'regiao') : null,
    pageNo,
    continuation: entry.index > 0 ? `continuação ${entry.index + 1}` : null,
  })}
  ${
    entry.index === 0
      ? `<div${probe ? ' data-pack-fixed="region-head"' : ''}>
    <div class="callout-line">
      <strong class="ink-strong">Não somar.</strong> ${htmlEscape(report.region.ruleBody)}
    </div>
    ${
      report.region.context.length
        ? `<p class="table-note">Contexto municipal (IBGE): ${report.region.context
            .map((item) => `${copyHtml(item.detail)} ${sourceLink(item.sourceUrl, item.topic)}`)
            .join(' · ')} — leitura relativa, nunca % estadual absoluto.</p>`
        : ''
    }
  </div>`
      : ''
  }
  <section class="section">
    <table class="document-table">
      <caption class="sr-only">Itens do recorte com evidência de alcance e fonte</caption>
      <colgroup><col style="width:30%" /><col style="width:15%" /><col style="width:34%" /><col style="width:21%" /></colgroup>
      ${tableHead(['Item', 'Esfera', 'Evidência de alcance', 'Fonte'])}
      <tbody>${entry.chunk.map((unit) => unit.html).join('')}</tbody>
    </table>
    ${
      isLast
        ? `<p class="table-note">Cada linha informa sua esfera; ${htmlEscape(report.unit?.sumGuardNote ?? '')}</p>`
        : ''
    }
  </section>
  ${runningFooter(report, {
    left: `${report.meta.municipalityName} · Região e polo`,
    anchor: 'regiao-e-polo',
    pageNo,
  })}
</article>`

const renderRegionSheets = ({ report, pack, probe, nextPage }) => {
  const units = regionUnits(report, probe)
  const entries = packedSection({ key: 'region', anchor: 'regiao', units, pack, probe })
  return entries.map((entry, index) =>
    renderRegionSheet({
      report,
      entry,
      probe,
      pageNo: nextPage(),
      isLast: index === entries.length - 1,
    }),
  )
}

/* ------------------------------------------------------------------ *
 * Abrangência / títulos (deltas instituição e tema, design cenas 09/10) *
 * ------------------------------------------------------------------ */

const subjectScopeColumns = (report) =>
  report.unit.reachScene
    ? report.unit.reachScene.columns
    : ['Item', 'Abrangência', 'Evidência de alcance', 'Fonte']

const subjectScopeUnits = (report, probe) => {
  const columns = subjectScopeColumns(report)
  const units = []
  for (const list of report.reach.lists) {
    const notSummable = list.sphere !== report.unit.defaultSphere
    const years = listYearRange(list.items)
    units.push({
      layout: 'head',
      html: `<tr${unitAttrs(probe, units.length, 'head')} class="list-head"><td colspan="${columns.length}"><span class="eyebrow">${htmlEscape(list.label)}</span> <span class="muted">${list.total} ${list.total === 1 ? 'item' : 'itens'} com fonte${notSummable ? ` · não somar ${htmlEscape(report.unit.notSummedTo)}` : ' · recorte direto'}${years ? ` · ${htmlEscape(years)}` : ''}</span></td></tr>`,
    })
    if (list.items.length === 0) {
      units.push({
        layout: 'tr',
        html: `<tr><td colspan="${columns.length}" class="muted">Nenhum item com fonte.</td></tr>`,
      })
      continue
    }
    for (const item of list.items) {
      if (!report.unit.reachScene) {
        units.push({
          layout: 'tr',
          html: `<tr${unitAttrs(probe, units.length, 'tr')}>
        <td>${copyHtml(briefOr(item.brief, item.title))}</td>
        <td>${htmlEscape(report.unit.sphereLabels[item.sphere] ?? item.sphere)}</td>
        <td>${copyHtml(noteOr(item.brief, item.evidence))}</td>
        <td>${sourceLink(item.sourceUrl)}</td>
      </tr>`,
        })
        continue
      }
      units.push({
        layout: 'tr',
        html: `<tr${unitAttrs(probe, units.length, 'tr')}>
        <td>${copyHtml(briefOr(item.brief, item.title))}</td>
        <td class="nowrap">Era ${htmlEscape(item.era ?? '—')}${item.year ? ` · ${htmlEscape(item.year)}` : ''}</td>
        <td>${valueCell(item.value)}${item.phase ? ` ${phaseText(item.phase)}` : ''}</td>
        <td>${copyHtml(noteOr(item.brief, item.evidence))}</td>
        <td>${sourceLink(item.sourceUrl)}</td>
      </tr>`,
      })
    }
  }
  return units
}

const renderSubjectScopeSheet = ({ report, entry, probe, pageNo, isLast }) => {
  const columns = subjectScopeColumns(report)
  const colgroup = report.unit.reachScene
    ? '<colgroup><col style="width:24%" /><col style="width:13%" /><col style="width:16%" /><col style="width:29%" /><col style="width:18%" /></colgroup>'
    : '<colgroup><col style="width:26%" /><col style="width:14%" /><col style="width:40%" /><col style="width:20%" /></colgroup>'
  return `
<article class="sheet" data-page="${entry.anchor}"${probe ? ' data-pack-section="scope"' : ''} aria-label="${htmlEscape(report.unit.aria?.scope ?? 'Painel de abrangência institucional')}">
  ${runningHead(report, {
    kicker: `${report.unit.docLabel} · ${report.meta.subjectName}`,
    title: `Abrangência: ${report.unit.spheres.map((sphere) => report.unit.sphereLabels[sphere]).join(' × ')}`,
    subtitle: 'Três recortes, três leituras, nenhuma soma combinada',
    section: entry.index === 0 ? sectionLabel(report, 'abrangencia') : null,
    pageNo,
    continuation: entry.index > 0 ? `continuação ${entry.index + 1}` : null,
  })}
  ${
    entry.index === 0
      ? `<div class="callout-line"${probe ? ' data-pack-fixed="scope-rule"' : ''}>
    <strong class="ink-strong">Não somar.</strong> ${htmlEscape(report.reach.ruleBody)}
  </div>`
      : ''
  }
  <section class="section">
    <table class="document-table">
      <caption class="sr-only">Itens do recorte com evidência de alcance e fonte</caption>
      ${colgroup}
      ${tableHead(columns)}
      <tbody>${entry.chunk.map((unit) => unit.html).join('')}</tbody>
    </table>
    ${
      isLast
        ? `<p class="table-note">Cada linha informa sua abrangência; ${htmlEscape(report.unit.sumGuardNote ?? '')}</p>`
        : ''
    }
  </section>
  ${runningFooter(report, {
    left: `${report.meta.subjectName} · Abrangência`,
    anchor: 'abrangencia',
    pageNo,
  })}
</article>`
}

const renderSubjectScopeSheets = ({ report, pack, probe, nextPage }) => {
  const units = subjectScopeUnits(report, probe)
  const entries = packedSection({ key: 'scope', anchor: 'abrangencia', units, pack, probe })
  return entries.map((entry, index) =>
    renderSubjectScopeSheet({
      report,
      entry,
      probe,
      pageNo: nextPage(),
      isLast: index === entries.length - 1,
    }),
  )
}

const subjectHonors = (report) => report.eras.find((era) => era.id === 'C')?.honors?.items ?? []

const subjectHonorUnits = (report, probe) =>
  subjectHonors(report).map((honor, index) => ({
    layout: 'tr',
    html: `<tr${unitAttrs(probe, index, 'tr')}>
      <td class="tabular">${htmlEscape(honorDate(honor))}</td>
      <td>reconhecimento</td>
      <td><strong>${copyHtml(briefOr(honor.brief, honor.text))}</strong>${
        noteOr(honor.brief, honor.detail)
          ? `<br /><span class="muted">${copyHtml(noteOr(honor.brief, honor.detail))}</span>`
          : ''
      }</td>
      <td>${sourceLink(honor.sourceUrl)}</td>
    </tr>`,
  }))

const honorDate = (honor) => {
  if (honor.date) return formatDateBr(honor.date)
  if (honor.year) return String(honor.year)
  return '—'
}

const renderSubjectHonorSheet = ({ report, entry, probe, pageNo }) => `
<article class="sheet" data-page="${entry.anchor}"${probe ? ' data-pack-section="honors"' : ''} aria-label="Títulos, honrarias e vínculos institucionais">
  ${runningHead(report, {
    kicker: `${report.unit.docLabel} · ${report.meta.subjectName}`,
    title: 'Títulos, honrarias e vínculos',
    subtitle: 'Reconhecimento não substitui entrega; vínculo não prova resultado',
    pageNo,
    continuation: entry.index > 0 ? `continuação ${entry.index + 1}` : null,
  })}
  <section class="section">
    <table class="document-table">
      <caption class="sr-only">Títulos, honrarias e vínculos por data e fonte</caption>
      <colgroup><col style="width:14%" /><col style="width:20%" /><col style="width:35%" /><col style="width:31%" /></colgroup>
      ${tableHead(['Data', 'Natureza', 'Registro', 'Fonte'])}
      <tbody>${entry.chunk.map((unit) => unit.html).join('')}</tbody>
    </table>
  </section>
  <div class="callout-line">
    <strong class="ink-strong">Como ler:</strong> vínculo documentado informa papel, unidade e
    período — não autoriza atribuir toda ação posterior do recorte. Honraria registra
    reconhecimento e órgão concedente — não vira prova de recurso ou entrega.
  </div>
  ${runningFooter(report, { left: 'Títulos e vínculos', anchor: 'titulos', pageNo })}
</article>`

const renderSubjectHonorSheets = ({ report, pack, probe, nextPage }) => {
  const units = subjectHonorUnits(report, probe)
  if (units.length === 0) return []
  return packedSection({ key: 'honors', anchor: 'titulos', units, pack, probe }).map((entry) =>
    renderSubjectHonorSheet({ report, entry, probe, pageNo: nextPage() }),
  )
}

/* ------------------------------------------------------------------ *
 * O que Solla defende (design cena 11)                               *
 * ------------------------------------------------------------------ */

const renderDefendSheet = ({ report, entry, probe, pageNo }) => {
  const { positions, gaps } = report.defends
  return `
<article class="sheet" data-page="${entry.anchor}"${probe ? ' data-pack-section="defends"' : ''} aria-label="O que Solla defende">
  ${runningHead(report, {
    kicker: isSubjectUnit(report.unit)
      ? `${report.unit.docLabel} · ${report.meta.subjectName}`
      : `Dossiê cidade · ${report.meta.municipalityName}`,
    title: 'O que Solla defende',
    subtitle: 'Posições e prioridades com lastro identificado',
    section: entry.index === 0 ? sectionLabel(report, 'defende') : null,
    pageNo,
    continuation: entry.index > 0 ? `continuação ${entry.index + 1}` : null,
  })}

  ${
    entry.index === 0
      ? `<section class="section"${probe ? ' data-pack-fixed="defends-lede"' : ''}>
    <p class="eyebrow">Leitura dos registros · não é opinião</p>
    <p class="lede">${
      positions.length
        ? `As posições abaixo vêm de registros com fonte do recorte (ato, notícia datada ou trecho identificado do acervo).${
            gaps.length
              ? ` ${gaps.length} ${gaps.length === 1 ? 'frente aparece' : 'frentes aparecem'} como lacuna explícita.`
              : ''
          }`
        : 'Nenhuma posição com lastro foi localizada no recorte — o que falta vira lacuna explícita, nunca inferência.'
    }</p>
  </section>`
      : ''
  }

  <section class="section">
    <p class="eyebrow">Posições e defesas localizadas</p>
    <ol class="position-list">
      ${entry.chunk.map((unit) => unit.html).join('')}
    </ol>
  </section>

  ${
    entry.index === 0
      ? `<div class="callout-line">
    <strong class="ink-strong">Como usar:</strong> “Defende” só entra quando há ato, notícia
    datada ou fala identificada como lastro. Apoio ou articulação não vira promessa. Sem
    registro, a linha não existe ou aparece como lacuna explícita.
  </div>`
      : ''
  }

  ${runningFooter(report, {
    left: `${report.meta.subjectName ?? report.meta.municipalityName} · O que Solla defende`,
    anchor: 'o-que-solla-defende',
    pageNo,
  })}
</article>`
}

const defendUnits = (report, probe) => {
  const units = []
  for (const position of report.defends.positions) {
    units.push({
      layout: 'li',
      html: `<li${unitAttrs(probe, units.length, 'li')}>
        <span class="position-label">${htmlEscape(position.label)}</span>
        <p class="position-reading"><strong>${copyHtml(briefOr(position.brief, position.reading))}</strong>${
          noteOr(position.brief, position.details)
            ? ` ${copyHtml(noteOr(position.brief, position.details))}`
            : ''
        }</p>
        <p class="position-source">${
          position.sourceDate ? `${formatDateBr(position.sourceDate)} · ` : ''
        }Era ${htmlEscape(position.era)} ${sourceLink(position.sourceUrl)}</p>
      </li>`,
    })
  }
  for (const gap of report.defends.gaps) {
    units.push({
      layout: 'li',
      html: `<li${unitAttrs(probe, units.length, 'li')}>
        <span class="position-label">${htmlEscape(gap.label)}</span>
        <p class="position-reading"><strong>Sem registro localizado.</strong> ${htmlEscape(gap.reason)}</p>
        <p class="position-source">Lacuna explícita${gap.era ? ` · Era ${htmlEscape(gap.era)}` : ''}</p>
      </li>`,
    })
  }
  return units
}

const renderDefendSheets = ({ report, pack, probe, nextPage }) => {
  const units = defendUnits(report, probe)
  if (units.length === 0) {
    return [
      renderDefendSheet({
        report,
        entry: { anchor: 'defende', chunk: [], index: 0 },
        probe: false,
        pageNo: nextPage(),
      }),
    ]
  }
  return packedSection({ key: 'defends', anchor: 'defende', units, pack, probe }).map((entry) =>
    renderDefendSheet({ report, entry, probe, pageNo: nextPage() }),
  )
}

/* ------------------------------------------------------------------ *
 * Lacunas, notícias, acervo, fontes (design cenas 07/08)             *
 * ------------------------------------------------------------------ */

const gapUnits = (report, probe) =>
  report.gaps.map((gap, index) => {
    const attrs = unitAttrs(probe, index, 'tr')
    if (!report.unit.gapsScene) {
      return {
        layout: 'tr',
        html: `<tr class="strong-row"${attrs}>
        <td><strong>${htmlEscape(gap.label)}</strong></td>
        <td>${htmlEscape(gap.reason)}</td>
        <td>Não completar por inferência.</td>
        <td>${htmlEscape(gap.nextStep)}</td>
      </tr>`,
      }
    }
    const era = gap.era && gap.era !== 'Acervo' ? `Era ${gap.era}` : 'Acervo'
    return {
      layout: 'tr',
      html: `<tr${attrs}>
        <td class="nowrap">${htmlEscape(era)}</td>
        <td><strong>${htmlEscape(gap.label)}</strong></td>
        <td>${htmlEscape(gap.reason)}</td>
        <td>${htmlEscape(gap.nextStep)}</td>
        <td>${index === 0 ? 'prioridade' : 'aberta'}</td>
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
  ${runningHead(report, {
    kicker: isSubjectUnit(report.unit)
      ? `${report.unit.docLabel} · ${report.meta.subjectName}`
      : `Dossiê cidade · ${report.meta.municipalityName}`,
    title: 'Lacunas explícitas',
    subtitle: 'O que não foi encontrado e qual é o próximo passo',
    pageNo,
    continuation: entry.index > 0 ? `continuação ${entry.index + 1}` : null,
  })}
  <section class="section">
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
    <p class="table-note">Ausência é resultado: resultado de busca não prova ausência histórica.</p>
    ${scene && isLast ? `<p class="table-note"><strong>${htmlEscape(scene.alert)}</strong></p>` : ''}
  </section>
  ${runningFooter(report, {
    left: 'Lacunas explícitas',
    anchor: 'lacunas-explicitas',
    pageNo,
  })}
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
      <td class="tabular nowrap">${htmlEscape(formatDateBr(row.date))}</td>
      <td>${htmlEscape(row.outlet)}</td>
      <td><a class="source-link" href="${htmlEscape(row.url)}">${htmlEscape(row.title)}</a>${
        row.summary ? `<br /><span class="muted">${htmlEscape(row.summary)}</span>` : ''
      }</td>
      <td>${row.era ? `Era ${htmlEscape(row.era)}` : '—'}</td>
    </tr>`,
  }))

const renderNewsSheet = ({ report, entry, probe, pageNo }) => `
<article class="sheet" data-page="${entry.anchor}"${probe ? ' data-pack-section="news"' : ''} aria-label="Notícias e documentos consultados">
  ${runningHead(report, {
    kicker: isSubjectUnit(report.unit)
      ? `${report.unit.docLabel} · ${report.meta.subjectName}`
      : `Dossiê cidade · ${report.meta.municipalityName}`,
    title: 'Notícias, acervo e fontes',
    subtitle: 'Rastro de consulta e limites de cobertura',
    pageNo,
    continuation: entry.index > 0 ? `continuação ${entry.index + 1}` : null,
  })}
  <section class="section">
    <p class="eyebrow">Notícias e documentos consultados · amostra</p>
    <table class="document-table">
      <caption class="sr-only">Fontes consultadas: data, origem, documento e uso no dossiê</caption>
      <colgroup><col style="width:14%" /><col style="width:20%" /><col style="width:48%" /><col style="width:18%" /></colgroup>
      ${tableHead(['Data', 'Origem', 'Documento', 'Uso no dossiê'])}
      <tbody>${entry.chunk.map((unit) => unit.html).join('')}</tbody>
    </table>
  </section>
  ${runningFooter(report, {
    left: 'Notícias e documentos',
    anchor: 'noticias',
    pageNo,
  })}
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
        layout: 'li',
        html: `<li${attrs}><strong>${htmlEscape(row.period)}</strong> — ${copyHtml(row.text)} ${sourceLink(row.sourceUrl)}</li>`,
      }
    }
    const identity = report.meta.identity ?? {}
    return {
      layout: 'tr',
      html: `<tr${attrs}>
        <td class="tabular nowrap">${htmlEscape(row.period)}</td>
        <td>${htmlEscape(identity.label ?? '—')}</td>
        <td>${copyHtml(row.text)}${row.excerpt ? `<br /><span class="muted">${copyHtml(row.excerpt)}</span>` : ''}</td>
        <td>${htmlEscape(report.unit.sphereLabels[report.unit.defaultSphere])}</td>
        <td>${sourceLink(row.sourceUrl)}</td>
      </tr>`,
    }
  })

const renderAcervoSheet = ({ report, entry, probe, pageNo, isLast }) => {
  const scene = report.unit.acervoScene
  return `
<article class="sheet" data-page="${entry.anchor}"${probe ? ' data-pack-section="acervo"' : ''} aria-label="Acervo interno de falas (amostra)">
  ${runningHead(report, {
    kicker: isSubjectUnit(report.unit)
      ? `${report.unit.docLabel} · ${report.meta.subjectName}`
      : `Dossiê cidade · ${report.meta.municipalityName}`,
    title: 'Acervo interno de falas (amostra)',
    subtitle: `Base Teqo 2011+ · ${report.acervo.items.length} de ${report.acervo.recorte} falas do recorte, com link`,
    pageNo,
    continuation: entry.index > 0 ? `continuação ${entry.index + 1}` : null,
  })}
  <section class="section">
    <p class="eyebrow">Falas do mandato sobre o recorte</p>
    ${
      scene
        ? `<table class="document-table">
      <caption class="sr-only">Amostra do acervo por data, tema canônico, trecho e abrangência</caption>
      <colgroup><col style="width:11%" /><col style="width:20%" /><col style="width:37%" /><col style="width:12%" /><col style="width:20%" /></colgroup>
      ${tableHead(scene.columns)}
      <tbody>${entry.chunk.map((unit) => unit.html).join('')}</tbody>
    </table>`
        : `<ul class="plain-list">${entry.chunk.map((unit) => unit.html).join('')}</ul>`
    }
    ${
      isLast
        ? `<p class="table-note">Amostra das falas mais recentes do recorte (${report.acervo.items.length} de ${report.acervo.recorte}); o acervo completo fica na base Teqo. ${htmlEscape(report.unit.acervoNote ?? '')}</p>`
        : ''
    }
    ${scene && isLast ? `<p class="table-note"><strong>${htmlEscape(scene.alert)}</strong></p>` : ''}
  </section>
  ${runningFooter(report, { left: 'Acervo interno · amostra', anchor: 'acervo', pageNo })}
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

const renderSources = (report, pageNo) => `
<article class="sheet" data-page="fontes" aria-label="${htmlEscape(report.unit.aria?.sources ?? 'Fontes e limites do dossiê institucional')}">
  ${runningHead(report, {
    kicker: isSubjectUnit(report.unit)
      ? `${report.unit.docLabel} · ${report.meta.subjectName}`
      : `Dossiê cidade · ${report.meta.municipalityName}`,
    title: 'Fontes e limites',
    subtitle: 'O que foi consultado e o que não se pode afirmar',
    pageNo,
  })}

  ${
    report.unit.sourcesHierarchy
      ? `<section class="section">
    <p class="eyebrow">Hierarquia de fontes</p>
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
      ? `<div class="note-line">
    <strong>Acervo interno:</strong> ${report.acervo.recorte} falas no recorte; a amostra com link
    (${report.acervo.items.length} de ${report.acervo.recorte}) está na seção anterior. ${htmlEscape(report.unit.acervoNote ?? '')}
  </div>`
      : ''
  }

  <section class="section">
    <p class="eyebrow">Limites de cobertura</p>
    <ul class="plain-list">
      ${report.limits.coverage.map((item) => `<li>${htmlEscape(item)}</li>`).join('')}
    </ul>
  </section>

  <section class="section">
    <p class="eyebrow">Regras para uso editorial</p>
    <ul class="plain-list">
      ${report.limits.editorial.map((item) => `<li>${htmlEscape(item)}</li>`).join('')}
    </ul>
  </section>

  <div class="callout-line defeso">
    <strong class="ink-strong">Nota de defeso eleitoral 2026 · insumo interno não é autorização para publicar.</strong>
    Publicidade institucional e propaganda eleitoral obedecem a regimes diferentes. Antes de
    adaptar qualquer trecho para peça externa, submeta texto, imagem, autoria, período e canal
    à revisão responsável. Este dossiê organiza evidências; não substitui análise jurídica nem
    editorial.
  </div>

  ${runningFooter(report, {
    left: 'Fontes e limites',
    anchor: 'fontes-e-limites',
    pageNo,
  })}
</article>`

/* ------------------------------------------------------------------ *
 * Print CSS (port of the approved hi-fi tokens and classes)          *
 * ------------------------------------------------------------------ */

const DOSSIER_PRINT_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Fira Sans', 'DejaVu Sans', Arial, sans-serif; color: var(--ink); background: #fff; }
  :root {
    --ink: #18232d;
    --ink-soft: #52616d;
    --accent: #4d6d7c;
    --line: #bdc8ce;
    --line-light: #dce3e6;
    --paper: #ffffff;
    --note: #f2f5f6;
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
    background: var(--paper);
    font-size: 9.4pt;
    line-height: 1.42;
    break-after: page;
  }
  .sheet:last-child { break-after: auto; }
  .sheet p, .sheet ul, .sheet ol, .sheet dl, .sheet h1, .sheet h2, .sheet h3 { margin-top: 0; }
  .sheet a { color: #315d70; text-decoration: underline; text-underline-offset: 1.5px; }
  .m-0 { margin: 0; }
  .tabular { font-variant-numeric: tabular-nums; }
  .nowrap { white-space: nowrap; }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .running-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 10mm; padding-bottom: 3mm; border-bottom: .35mm solid var(--ink); }
  .running-kicker { margin: 0; color: var(--accent); font-size: 7.5pt; font-weight: 700; letter-spacing: .11em; text-transform: uppercase; }
  .running-title { margin: .8mm 0 0; font-size: 17pt; font-weight: 650; line-height: 1.08; letter-spacing: -.025em; }
  .running-subtitle { margin: 1mm 0 0; color: var(--ink-soft); font-size: 8.7pt; }
  .running-meta { min-width: 41mm; margin: 0; color: var(--ink-soft); font-size: 7.3pt; line-height: 1.45; text-align: right; font-variant-numeric: tabular-nums; }
  .running-meta p { margin: 0; }
  .ink-strong { color: var(--ink); }
  .running-footer { display: flex; margin-top: auto; padding-top: 2.6mm; border-top: .25mm solid var(--line); align-items: flex-end; justify-content: space-between; gap: 8mm; color: var(--ink-soft); font-size: 7.2pt; line-height: 1.3; }
  .folio { color: var(--ink); font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .section { margin-top: 5mm; }
  .section + .section { margin-top: 6mm; }
  .section-head { margin-bottom: 1mm; }
  .eyebrow { margin: 0 0 1.3mm; color: var(--accent); font-size: 7.2pt; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .section-title { margin: 0; font-size: 13pt; font-weight: 650; line-height: 1.18; letter-spacing: -.012em; }
  .lede { max-width: 155mm; margin: 3mm 0 0; font-size: 10.6pt; line-height: 1.52; }
  .body-copy { margin: 2.6mm 0 0; font-size: 9.6pt; line-height: 1.5; }
  .muted { color: var(--ink-soft); }
  .small { font-size: 8.2pt; }
  .source-link { color: #315d70; text-decoration: underline; text-underline-offset: 1.5px; }
  .phase-text { font-variant-numeric: tabular-nums; }
  .plain-list { margin: 3mm 0 0; padding: 0; list-style: none; }
  .plain-list li { position: relative; padding: 2.2mm 0 2.2mm 6mm; border-top: .2mm solid var(--line-light); }
  .plain-list li:last-child { border-bottom: .2mm solid var(--line-light); }
  .plain-list li::before { position: absolute; top: 3.3mm; left: 0; width: 2.2mm; height: .45mm; background: var(--accent); content: ''; }
  .fact-list strong, .analysis-list strong { font-weight: 700; }
  .analysis-list li { padding-top: 2.8mm; padding-bottom: 2.8mm; }
  .index-list { margin: 3mm 0 0; padding: 0; list-style: none; }
  .index-list li { display: flex; padding: 1.25mm 0; border-bottom: .2mm dotted var(--line); align-items: baseline; gap: 2mm; }
  .index-list .index-number { width: 8mm; color: var(--accent); font-size: 7.5pt; font-weight: 700; font-variant-numeric: tabular-nums; }
  .index-list .index-label { font-weight: 600; }
  .index-list .index-page { margin-left: auto; }
  .document-table { width: 100%; margin-top: 3mm; border-collapse: collapse; table-layout: fixed; font-size: 8.2pt; line-height: 1.34; }
  .document-table th { padding: 1.5mm 1.3mm 1.4mm; border-top: .35mm solid var(--ink); border-bottom: .25mm solid var(--ink); color: var(--ink-soft); font-size: 6.8pt; font-weight: 700; letter-spacing: .045em; text-align: left; text-transform: uppercase; vertical-align: bottom; }
  .document-table td { padding: 1.8mm 1.3mm; border-bottom: .2mm solid var(--line-light); vertical-align: top; overflow-wrap: anywhere; }
  .document-table .tabular { font-variant-numeric: tabular-nums; }
  .document-table .strong-row td:first-child { font-weight: 700; }
  .document-table .list-head td { padding-top: 4mm; border-bottom: .35mm solid var(--ink); }
  .document-table .list-head .eyebrow { margin: 0; }
  .table-note { margin: 1.7mm 0 0; color: var(--ink-soft); font-size: 7.6pt; }
  .callout-line { margin-top: 4mm; padding: 2.4mm 0 2.4mm 4mm; border-top: .25mm solid var(--line); border-bottom: .25mm solid var(--line); border-left: 1mm solid var(--accent); color: var(--ink-soft); font-size: 8.4pt; line-height: 1.42; }
  .note-line { margin-top: 3mm; padding: 2mm 0; border-top: .25mm solid var(--line); border-bottom: .25mm solid var(--line); color: var(--ink-soft); font-size: 8.2pt; }
  .note-line strong { color: var(--ink); }
  .cover-series { display: flex; align-items: flex-start; justify-content: space-between; gap: 12mm; padding-bottom: 5mm; border-bottom: .3mm solid var(--ink); }
  .cover-series p { margin: 0; }
  .cover-series-name { font-size: 8pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  .cover-internal { color: var(--ink-soft); font-size: 7.5pt; line-height: 1.45; text-align: right; }
  .cover-main { margin-top: 38mm; }
  .cover-overline { margin: 0 0 4mm; color: var(--accent); font-size: 8pt; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; }
  .cover-title { max-width: 160mm; margin: 0; font-size: 35pt; font-weight: 650; line-height: .98; letter-spacing: -.04em; }
  .cover-title span { color: var(--accent); }
  .cover-subtitle { max-width: 136mm; margin: 6mm 0 0; color: var(--ink-soft); font-size: 13pt; line-height: 1.4; }
  .cover-data { display: grid; margin: 24mm 0 0; border-top: .3mm solid var(--ink); grid-template-columns: 45mm 1fr; }
  .cover-data dt, .cover-data dd { margin: 0; padding: 2.7mm 0; border-bottom: .2mm solid var(--line); }
  .cover-data dt { color: var(--ink-soft); font-size: 7.5pt; font-weight: 700; letter-spacing: .035em; text-transform: uppercase; }
  .cover-data dd { font-size: 9pt; font-weight: 600; }
  .cover-how { max-width: 145mm; margin-top: 9mm; padding-top: 3mm; border-top: .6mm solid var(--accent); }
  .cover-how p { margin: 0; font-size: 9pt; line-height: 1.45; color: var(--ink-soft); }
  .cover-how strong { display: block; margin-bottom: 1.5mm; font-size: 8pt; letter-spacing: .07em; text-transform: uppercase; }
  .cover-footer { display: flex; margin-top: auto; padding-top: 4mm; border-top: .3mm solid var(--ink); align-items: flex-end; justify-content: space-between; gap: 8mm; color: var(--ink-soft); font-size: 7.6pt; }
  .cover-stamp { margin: 0; text-align: right; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--accent); }
  .trajectory-table td:first-child { color: var(--accent); font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .trajectory-table td:nth-child(2) { font-weight: 650; }
  .era-reading { margin-top: 4mm; padding-left: 4mm; border-left: .9mm solid var(--accent); }
  .era-reading p:last-child { margin-bottom: 0; }
  .action-list { margin: 3mm 0 0; padding: 0; list-style: none; }
  .action-list li { padding: 2.2mm 0; border-top: .2mm solid var(--line-light); }
  .action-list li:last-child { border-bottom: .2mm solid var(--line-light); }
  .action-list .action-title { display: block; font-weight: 700; }
  .action-list .action-meta { display: block; margin-top: .8mm; color: var(--ink-soft); font-size: 7.8pt; }
  .continuation { color: var(--accent); font-size: 7.3pt; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
  .placeholder-bar { display: inline-block; width: 28mm; height: 2.3mm; border-radius: .6mm; background: #d7dee2; vertical-align: middle; }
  .position-list { margin: 3mm 0 0; padding: 0; list-style: none; }
  .position-list li { display: grid; padding: 3mm 0; border-top: .2mm solid var(--line-light); grid-template-columns: 39mm 1fr 42mm; gap: 4mm; align-items: start; }
  .position-list li:last-child { border-bottom: .2mm solid var(--line-light); }
  .position-label { color: var(--accent); font-size: 7.2pt; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
  .position-reading { margin: 0; font-size: 9pt; line-height: 1.44; }
  .position-source { margin: 0; color: var(--ink-soft); font-size: 7.4pt; line-height: 1.38; }
  .empty-panel { border: .45mm dashed var(--accent); color: var(--ink-soft); padding: 5mm 8mm; text-align: center; }
  .empty-panel .rule-title { margin: 1.5mm 0; font-size: 12pt; font-weight: 700; color: var(--ink); }
  .defeso { margin-top: auto; }
`

/**
 * Probe-only CSS: the packed sections measure their true content height, with
 * no page clamp and no top margins (the packer adds the row gap back).
 */
const DOSSIER_PROBE_CSS = `
  .sheet { height: auto; min-height: 0; overflow: visible; }
  [data-pack-section] .section { margin-top: 0; }
  [data-pack-section] .document-table,
  [data-pack-section] .action-list,
  [data-pack-section] .plain-list,
  [data-pack-section] .position-list { margin-top: 0; }
  [data-pack-section] .table-note,
  [data-pack-section] .callout-line { margin-top: 0; }
`

/* ------------------------------------------------------------------ *
 * Anchors of the packed sections (the builder inverts the map)        *
 * ------------------------------------------------------------------ */

const SHARED_PACK_ANCHORS = {
  'era-a': 'era:A',
  'era-b': 'era:B',
  'era-c': 'era:C',
  lacunas: 'gaps',
  noticias: 'news',
  acervo: 'acervo',
  defende: 'defends',
}

const MUNICIPALITY_PACK_ANCHORS = {
  ...SHARED_PACK_ANCHORS,
  regiao: 'region',
}

export const INSTITUTION_PACK_ANCHORS = {
  ...SHARED_PACK_ANCHORS,
  titulos: 'honors',
  abrangencia: 'scope',
}

const THEME_PACK_ANCHORS = {
  ...SHARED_PACK_ANCHORS,
  abrangencia: 'scope',
}

const PACK_ANCHORS_BY_UNIT = {
  municipality: MUNICIPALITY_PACK_ANCHORS,
  institution: INSTITUTION_PACK_ANCHORS,
  theme: THEME_PACK_ANCHORS,
}

/** Anchor map of the unit's packed sections (the builder inverts it). */
export const dossierPackAnchors = (unit) =>
  PACK_ANCHORS_BY_UNIT[resolveDossierUnit(unit).id] ?? MUNICIPALITY_PACK_ANCHORS

/* ------------------------------------------------------------------ *
 * Document assembly (two passes: the index needs the page numbers)    *
 * ------------------------------------------------------------------ */

const buildDossierParts = (report, { pack, probe, pages, indexMode }) => {
  let page = 0
  const nextPage = () => ++page
  const parts = []
  parts.push(renderCover(report))
  page += 1
  parts.push(renderEssentials(report, { pageNo: nextPage(), pages, indexMode }))
  parts.push(renderBetweenEras(report, nextPage()))
  parts.push(renderTrajectory(report, nextPage()))
  for (const era of report.eras) {
    parts.push(...renderEraSheets({ report, era, pack, probe, nextPage }))
  }
  if (isSubjectUnit(report.unit)) {
    parts.push(...renderSubjectScopeSheets({ report, pack, probe, nextPage }))
    if (report.unit.honorsSheet) {
      parts.push(...renderSubjectHonorSheets({ report, pack, probe, nextPage }))
    }
  } else {
    parts.push(...renderRegionSheets({ report, pack, probe, nextPage }))
  }
  parts.push(...renderDefendSheets({ report, pack, probe, nextPage }))
  parts.push(...renderGapSheets({ report, pack, probe, nextPage }))
  parts.push(...renderNewsSheets({ report, pack, probe, nextPage }))
  parts.push(...renderAcervoSheets({ report, pack, probe, nextPage }))
  parts.push(renderSources(report, nextPage()))
  return parts
}

const renderDossierDocument = (
  report,
  { pack = null, probe = false, indexMode = 'pages' } = {},
) => {
  const first = buildDossierParts(report, { pack, probe, pages: null, indexMode: 'labels' })
  const pages = {}
  first.forEach((html, index) => {
    const match = /data-page="([^"]+)"/.exec(html)
    if (match) pages[match[1]] = index + 1
  })
  report.meta.pageTotal = first.length
  // Probe and label modes have no page numbers to print: the first pass is final.
  const parts =
    probe || indexMode === 'labels'
      ? first
      : buildDossierParts(report, { pack, probe, pages, indexMode })
  const title = isSubjectUnit(report.unit)
    ? `${report.meta.title} — ${report.meta.subjectName}`
    : `${report.meta.title} — ${report.meta.municipalityName}`
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${htmlEscape(title)}</title><style>${DOSSIER_PRINT_CSS}</style>${probe ? `<style>${DOSSIER_PROBE_CSS}</style>` : ''}</head>
<body>
${parts.join('\n')}
</body>
</html>`
}

export const renderDossierHtml = (report, options) => renderDossierDocument(report, options)

/* ------------------------------------------------------------------ *
 * Companion .md (mirrors the sections, keeps the sources clickable)   *
 * ------------------------------------------------------------------ */

const mdIndex = (report) => {
  const lines = ['## Índice', '']
  for (const entry of buildIndexEntries(report)) {
    lines.push(
      entry.included
        ? `- [${entry.heading}](#${entry.mdAnchor})`
        : `${entry.heading} — sem evidência suficiente; consulte as lacunas`,
    )
  }
  return lines
}

const mdEra = (era) => {
  const lines = [
    `## ${era.label} (${era.period})`,
    '',
    `_${era.method}_`,
    '',
    `Trilha: ${era.recovery}`,
  ]
  if (era.omitted) {
    lines.push('', '> Lacuna explícita: nenhum ponto com fonte foi localizado para esta era.')
    return lines.join('\n')
  }
  if (era.narrative || era.summary) lines.push('', `> ${era.narrative ?? era.summary}`)
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

/** Head of the companion: O essencial, Leitura entre eras, Trajetória e eras. */
const mdHead = (report) => {
  const lines = ['<a id="o-essencial"></a>', '', '## O essencial', '']
  for (const paragraph of report.opening.paragraphs) lines.push(paragraph, '')
  lines.push(
    `_Redação de síntese sobre os pontos com fonte; ${
      report.opening.authored
        ? 'escrita a partir dos itens datados do dossiê'
        : 'repetição da leitura dos números (sem redação autoral disponível)'
    } — nada aqui acrescenta fato novo._`,
    '',
    '### Fatos-chave',
    '',
  )
  for (const fact of report.essentials.facts) lines.push(`- **${fact.label}** ${fact.text}`)

  lines.push('', '<a id="leitura-entre-eras"></a>', '', '## Leitura entre eras', '')
  for (const bullet of report.betweenEras.bullets) {
    lines.push(`- ${bullet.label ? `**${bullet.label}** ` : ''}${bullet.text}`)
  }
  lines.push(
    '',
    '### Síntese operacional',
    '',
    '| Era | Onde está a evidência | Como citar com segurança | Limite |',
    '| --- | --- | --- | --- |',
  )
  for (const row of report.betweenEras.table) {
    lines.push(`| ${row.era} | ${row.where} | ${row.howToCite} | ${row.limit} |`)
  }

  lines.push('', '<a id="trajetoria-completa"></a>', '', '## Trajetória completa', '')
  for (const row of report.trajectory) {
    lines.push(
      `- **${row.period}** — ${row.role}${row.uncertain ? ` _(${row.uncertain})_` : ''} · ${row.recovery}`,
    )
  }

  for (const era of report.eras) {
    lines.push('', `<a id="era-${era.id.toLowerCase()}"></a>`, '', mdEra(era))
  }
  return lines
}

/** Unit section of the companion: Região/polo (city) or Abrangência + títulos. */
const mdUnitSection = (report) => {
  const lines = []
  if (isSubjectUnit(report.unit)) {
    lines.push('<a id="abrangencia"></a>', '')
    lines.push(
      `## Abrangência: ${report.unit.spheres.map((sphere) => report.unit.sphereLabels[sphere]).join(' × ')}`,
      '',
      `> ${report.reach.ruleTitle}`,
      `> ${report.reach.ruleBody}`,
      '',
    )
    for (const list of report.reach.lists) {
      lines.push(`### ${list.label}`, '')
      if (list.items.length === 0) lines.push('- Nenhum item com fonte.')
      for (const item of list.items) {
        lines.push(
          `- **${stripInlineSources(briefOr(item.brief, item.title))}** (${item.sphere}${item.year ? ` · ${item.year}` : ''})${noteOr(item.brief, item.evidence) ? ` — ${stripInlineSources(noteOr(item.brief, item.evidence))}` : ''} [fonte](${item.sourceUrl})`,
        )
      }
      lines.push('')
    }
    const honors = report.eras.find((era) => era.id === 'C')?.honors?.items ?? []
    if (report.unit.honorsSheet && honors.length) {
      lines.push('<a id="titulos"></a>', '', '## Títulos, honrarias e vínculos', '')
      for (const honor of honors) {
        lines.push(
          `- **${stripInlineSources(briefOr(honor.brief, honor.text))}**${noteOr(honor.brief, honor.detail) ? ` — ${stripInlineSources(noteOr(honor.brief, honor.detail))}` : ''}${honor.date ? ` · ${formatDateBr(honor.date)}` : honor.year ? ` · ${honor.year}` : ''} [fonte](${honor.sourceUrl})`,
        )
      }
    }
    return lines
  }
  lines.push('<a id="regiao-e-polo"></a>', '', '## Região / polo', '')
  lines.push(`> ${report.region.ruleTitle}`, `> ${report.region.ruleBody}`, '')
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
  return lines
}

/** Tail of the companion: defende, lacunas, notícias, acervo e limites. */
const mdTail = (report) => {
  const lines = ['<a id="o-que-solla-defende"></a>', '', '## O que Solla defende', '']
  if (report.defends.positions.length === 0) lines.push('_Nenhuma posição com lastro localizada._')
  for (const position of report.defends.positions) {
    lines.push(
      '',
      `- **${position.label}:** ${stripInlineSources(briefOr(position.brief, position.reading))}${noteOr(position.brief, position.details) ? ` — ${stripInlineSources(noteOr(position.brief, position.details))}` : ''} [fonte](${position.sourceUrl})`,
    )
  }
  for (const gap of report.defends.gaps) {
    lines.push(
      '',
      `- **${gap.label}:** sem registro localizado — ${gap.reason}${gap.era ? ` (Era ${gap.era})` : ''}`,
    )
  }

  lines.push('', '<a id="lacunas-explicitas"></a>', '', '## Lacunas explícitas', '')
  if (report.gaps.length === 0) lines.push('_Nenhuma lacuna declarada._')
  for (const gap of report.gaps) {
    lines.push(`- **${gap.label}:** ${gap.reason} → ${gap.nextStep}`)
  }

  if (report.news.length) {
    lines.push('', '<a id="noticias"></a>', '', '## Notícias e documentos consultados', '')
    for (const row of report.news) {
      lines.push(
        `- ${formatDateBr(row.date)} · ${row.outlet}${row.era ? ` · Era ${row.era}` : ''} — ${row.title} — ${row.url}${row.summary ? ` — ${row.summary}` : ''}`,
      )
    }
  }

  if (report.acervo?.items?.length) {
    lines.push(
      '',
      '<a id="acervo"></a>',
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

  lines.push(
    '',
    '<a id="fontes-e-limites"></a>',
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
  return lines
}

const renderMunicipalityDossierMd = (report) =>
  `${[
    `# ${report.meta.title} — ${report.meta.municipalityName}`,
    '',
    `**Território de identidade:** ${report.meta.region}`,
    `**Gerado em:** ${formatDateTimeBr(report.meta.generatedAt)} · **Base Teqo (read-only) lida em:** ${report.meta.readAtLabel}`,
    '',
    '> INSUMO INTERNO — não circular, não publicar. Documento de trabalho.',
    '',
    ...mdIndex(report),
    '',
    ...mdHead(report),
    ...mdUnitSection(report),
    ...mdTail(report),
  ].join('\n')}\n`

const renderSubjectDossierMd = (report) =>
  `${[
    `# ${report.meta.title} — ${report.meta.subjectName}`,
    '',
    `**Identificação:** ${report.meta.identityBadges.join(' · ')}`,
    `**Gerado em:** ${formatDateTimeBr(report.meta.generatedAt)} · **Base Teqo (read-only) lida em:** ${report.meta.readAtLabel}`,
    '',
    '> INSUMO INTERNO — não circular, não publicar. Documento de trabalho.',
    '',
    '## Identificação',
    '',
    ...report.unit
      .identityRows(report.meta.identity ?? {})
      .map(([key, value]) => `- **${key}:** ${value}`),
    '',
    ...mdIndex(report),
    '',
    ...mdHead(report),
    ...mdUnitSection(report),
    ...mdTail(report),
  ].join('\n')}\n`

export const renderDossierMd = (report) =>
  isSubjectUnit(report.unit) ? renderSubjectDossierMd(report) : renderMunicipalityDossierMd(report)
