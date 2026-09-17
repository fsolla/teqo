/**
 * Boletim renderer (C186): one A4 `.sheet` in voter-facing language. Ports the
 * approved hi-fi classes (`dossie-solla-cidade-boletim-ui-design.html`). No
 * source list — the facts come from the dossiê ledger, and the page is labelled
 * as an internal model.
 */

import { isInstitutionUnit } from './dossieUnit.mjs'
import { htmlEscape } from './reportText.mjs'

const ASSET = (title, lines) =>
  `<div class="asset-box"><p class="asset-title">${htmlEscape(title)}</p><p>${lines
    .map((line) => htmlEscape(line))
    .join('<br />')}</p></div>`

const phaseModifier = (phase) =>
  phase === 'pago' || phase === 'liquidado'
    ? 'phase-paid'
    : phase === 'empenhado' || phase === 'autorizado'
      ? 'phase-pending'
      : ''

const renderHighlight = (highlight, { showPhase = false } = {}) => `
  <article class="highlight-card">
    <p class="highlight-eyebrow">${htmlEscape(highlight.eyebrow)}</p>
    ${highlight.number ? `<p class="highlight-number tabular">${htmlEscape(highlight.number)}</p>` : ''}
    ${
      showPhase && highlight.number && highlight.phaseLabel
        ? `<p class="highlight-phase"><span class="phase ${phaseModifier(highlight.phase)}">${htmlEscape(highlight.phaseLabel)}</span></p>`
        : ''
    }
    <h3 class="highlight-title">${htmlEscape(highlight.title)}</h3>
    ${highlight.note ? `<p class="highlight-note">${htmlEscape(highlight.note)}</p>` : ''}
  </article>`

const renderMoreItem = (item) =>
  `<p class="more-item"><strong>${htmlEscape(item.label)}</strong></p>`

const PRINT_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body { font-family: 'Fira Sans', 'DejaVu Sans', Arial, sans-serif; color: #172033; background: #fff; }
  @page { size: A4; margin: 0; }
  .sheet {
    position: relative;
    width: 210mm;
    height: 297mm;
    min-height: 297mm;
    padding: 8mm 10mm 7mm 12mm;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: #fff;
    font-size: 10.25pt;
    line-height: 1.26;
  }
  .sheet::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 3.5mm; background: #315c75; }
  .sheet p, .sheet h1, .sheet h2, .sheet h3, .sheet ul { margin-top: 0; }
  .tabular { font-variant-numeric: tabular-nums; }
  .model-label { display: inline-flex; align-items: center; min-height: 6mm; padding: 1mm 2.5mm; border: .35mm solid #8a5a18; border-radius: 99px; color: #68420f; background: #fff7e8; font-size: 7.3pt; line-height: 1; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  .kicker, .section-label { color: #315c75; font-size: 7.4pt; line-height: 1.1; font-weight: 800; letter-spacing: .12em; text-transform: uppercase; }
  .section-label { margin-bottom: 1.2mm; }
  .asset-box { border: .4mm dashed #748894; color: #40535f; background: #f7f9fa; padding: 3mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .asset-box p { margin: 0; }
  .asset-box .asset-title { font-size: 7.5pt; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
  .asset-box p + p { margin-top: 1mm; font-size: 7pt; line-height: 1.25; }
  .bulletin-head { display: flex; align-items: center; justify-content: space-between; gap: 6mm; border-bottom: .55mm solid #172033; padding-bottom: 2.5mm; }
  .bulletin-head .kicker { margin-bottom: 1mm; }
  .bulletin-head .place { margin: 0; font-size: 10pt; font-weight: 700; color: #435264; }
  .bulletin-head .note { margin: 0; max-width: 44mm; text-align: right; font-size: 6.8pt; font-weight: 600; line-height: 1.2; color: #8a5a18; }
  .bulletin-head .right { display: flex; align-items: center; gap: 3mm; }
  .opening { margin-top: 3.5mm; display: grid; grid-template-columns: 1fr 46mm; gap: 5mm; }
  .opening h1 { margin: 0; font-size: 23pt; font-weight: 600; line-height: 1; letter-spacing: -.038em; }
  .opening h1 .accent { color: #315c75; }
  .opening .lead { margin: 2.6mm 0 0; max-width: 125mm; font-size: 10.5pt; line-height: 1.33; color: #435264; }
  .opening .asset-box { min-height: 36mm; border-radius: .125rem; }
  .highlights { margin-top: 3.8mm; }
  .highlights-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 4mm; border-bottom: .3mm solid #cbd5dc; padding-bottom: 1.5mm; }
  .highlights-head h2 { margin: 0; font-size: 14pt; font-weight: 600; line-height: 1; letter-spacing: -.015em; }
  .highlights-head .side { margin: 0; text-align: right; font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #435264; }
  .highlight-grid { margin-top: 2.5mm; display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.2mm; }
  .highlight-card { min-height: 31mm; padding: 2.8mm 3mm 2.5mm; border: .3mm solid #cbd5dc; border-top: 1.15mm solid #315c75; background: #fff; }
  .highlight-eyebrow { margin-bottom: 1.5mm; color: #435264; font-size: 6.7pt; line-height: 1; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  .highlight-number { margin: 0; color: #315c75; font-size: 18.5pt; line-height: .96; font-weight: 800; letter-spacing: -.035em; }
  .highlight-title { margin: 1.5mm 0 0; font-size: 10.8pt; line-height: 1.08; font-weight: 800; letter-spacing: -.01em; }
  .highlight-note { margin: 1.3mm 0 0; color: #435264; font-size: 8.15pt; line-height: 1.22; }
  .bulletin-timeline { margin-top: 3.5mm; border-radius: .125rem; background: #e8f0f4; padding: 2.8mm 3mm 2.6mm; }
  .bulletin-timeline .timeline-head { display: flex; align-items: center; justify-content: space-between; gap: 4mm; }
  .bulletin-timeline h2 { margin: 0; font-size: 11pt; font-weight: 600; }
  .bulletin-timeline .timeline-side { margin: 0; font-size: 6.7pt; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #315c75; }
  .timeline-grid { margin-top: 3mm; display: grid; grid-template-columns: repeat(4, 1fr); }
  .timeline-step { position: relative; padding: 4.5mm 2.5mm 1.5mm; border-top: .4mm solid #97aab6; }
  .timeline-step::before { content: ''; position: absolute; top: -1.6mm; left: 2.5mm; width: 3mm; height: 3mm; border: .65mm solid #e8f0f4; border-radius: 99px; background: #315c75; box-shadow: 0 0 0 .3mm #315c75; }
  .timeline-period { margin: 0 0 .7mm; font-size: 7.2pt; font-weight: 800; color: #315c75; }
  .timeline-text { margin: 0; font-size: 8.4pt; font-weight: 600; line-height: 1.18; }
  .more { margin-top: 3.5mm; display: grid; grid-template-columns: 1fr 43mm; gap: 4mm; }
  .more-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 4mm; border-bottom: .3mm solid #cbd5dc; padding-bottom: 1.4mm; }
  .more-head h2 { margin: 0; font-size: 12.5pt; font-weight: 600; line-height: 1; }
  .more-head .side { margin: 0; font-size: 6.7pt; font-weight: 700; text-transform: uppercase; letter-spacing: .07em; color: #435264; }
  .more-grid { margin-top: 2.3mm; display: grid; grid-template-columns: 1fr 1fr; gap: 1.7mm 4mm; }
  .more-item { position: relative; margin: 0; min-height: 11mm; padding: 0 0 2mm 5mm; border-bottom: .25mm solid #cbd5dc; font-size: 9pt; line-height: 1.22; }
  .more-item::before { content: '✓'; position: absolute; left: 0; top: 0; color: #315c75; font-weight: 900; }
  .more-aside { display: grid; grid-template-rows: 1fr 1fr; gap: 2.3mm; }
  .more-aside .asset-box { border-radius: .125rem; }
  .empty { margin-top: 3mm; color: #435264; font-size: 9.5pt; }
  .empty-box { margin-top: 2.3mm; min-height: 40mm; border: .4mm dashed #748894; background: #f7f9fa; color: #40535f; padding: 4mm; display: flex; flex-direction: column; justify-content: center; gap: 1.5mm; }
  .empty-box p { margin: 0; font-size: 9.5pt; line-height: 1.3; }
  .empty-box .uppercase { text-transform: uppercase; letter-spacing: .06em; }
  .bulletin-foot { margin-top: auto; border-top: .35mm solid #cbd5dc; padding-top: 2.2mm; }
  .bulletin-foot .row { display: flex; align-items: flex-end; justify-content: space-between; gap: 5mm; }
  .bulletin-foot .orig { margin: 0 0 .8mm; font-size: 7.2pt; font-weight: 600; line-height: 1.25; color: #315c75; }
  .bulletin-foot .defeso { margin: 0; max-width: 142mm; font-size: 7.4pt; line-height: 1.28; color: #435264; }
  .bulletin-foot .defeso strong { color: #8a5a18; }
  .bulletin-foot .stamp { margin: 0; text-align: right; font-size: 7.2pt; font-weight: 600; line-height: 1.3; color: #435264; }
`

const renderMunicipalityBulletinHtml = (bulletin) => `
<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${htmlEscape(bulletin.meta.title)} — ${htmlEscape(bulletin.meta.municipality)}</title><style>${PRINT_CSS}</style></head>
<body>
<article class="sheet" data-page="boletim" aria-label="Modelo de boletim informativo de uma página">
  <header class="bulletin-head">
    <div>
      <p class="kicker">${htmlEscape(bulletin.meta.kicker)}</p>
      <p class="place">Município de ${htmlEscape(bulletin.meta.municipality)}${bulletin.meta.region ? ` · ${htmlEscape(bulletin.meta.region)}` : ' · Bahia'}</p>
    </div>
    <div class="right">
      <p class="note">Síntese do dossiê da cidade — conferir antes de publicar.</p>
      <span class="model-label">${htmlEscape(bulletin.meta.modelLabel)}</span>
    </div>
  </header>

  <section class="opening" aria-label="Abertura do boletim">
    <div>
      <p class="section-label">Trabalho que chega à cidade e à região</p>
      <h1>O que Jorge Solla fez por <span class="accent">${htmlEscape(bulletin.meta.municipality)}</span></h1>
      <p class="lead">Da gestão da saúde ao trabalho na Câmara: recursos, serviços, obras e equipamentos que melhoram a vida de quem mora aqui.</p>
    </div>
    ${ASSET('NEEDS ASSET · foto real', ['Solla na cidade ou no serviço citado', 'origem, autoria e licença'])}
  </section>

  <section class="highlights" aria-label="Destaques">
    <div class="highlights-head">
      <div>
        <p class="section-label">Destaques</p>
        <h2>Entregas que fazem diferença</h2>
      </div>
      <p class="side">cidade ≠ região · cada alcance vem identificado</p>
    </div>
    ${
      bulletin.highlights.length
        ? `<div class="highlight-grid">${bulletin.highlights.map(renderHighlight).join('')}</div>`
        : '<p class="empty">Sem fato com fonte suficiente para destacar — ver lacunas no dossiê.</p>'
    }
  </section>

  <section class="bulletin-timeline" aria-label="Trajetória">
    <div class="timeline-head">
      <h2>Desde 1999, uma trajetória na saúde pública</h2>
      <p class="timeline-side">experiência que virou trabalho pela Bahia</p>
    </div>
    <div class="timeline-grid">
      ${bulletin.timeline
        .map(
          (step) => `<div class="timeline-step">
            <p class="timeline-period">${htmlEscape(step.period)}</p>
            <p class="timeline-text">${htmlEscape(step.text)}</p>
          </div>`,
        )
        .join('')}
    </div>
  </section>

  <section class="more" aria-label="Outras ações">
    <div>
      <div class="more-head">
        <div>
          <p class="section-label">E mais</p>
          <h2>Outras ações que entram no boletim</h2>
        </div>
        <p class="side">frases curtas · fatos confirmados</p>
      </div>
      ${
        bulletin.moreItems.length
          ? `<div class="more-grid">${bulletin.moreItems.map(renderMoreItem).join('')}</div>`
          : '<div class="empty-box"><p><strong class="uppercase">Sem itens adicionais com fonte além dos destaques.</strong></p><p>Conferir as lacunas explícitas no dossiê da cidade antes de ampliar o boletim.</p></div>'
      }
    </div>
    <aside class="more-aside" aria-label="Ativos visuais pendentes">
      ${ASSET('NEEDS ASSET · selo', ['marca institucional aprovada', 'arquivo vetorial'])}
      ${ASSET('NEEDS ASSET · recorte', ['imagem real de cobertura', 'origem e licença'])}
    </aside>
  </section>

  <footer class="bulletin-foot">
    <div class="row">
      <div>
        <p class="orig">Fatos selecionados do dossiê da cidade.</p>
        <p class="defeso"><strong>Defeso eleitoral:</strong> material informativo em preparação. Não publicar sem revisão editorial e jurídica.</p>
      </div>
      <p class="stamp">MODELO · INSUMO INTERNO<br />A4 · página 1/1<br />${htmlEscape(bulletin.meta.generatedAtLabel)}</p>
    </div>
  </footer>
</article>
</body>
</html>`

/* Institution boletim (C187) — ports the institutional boletim hi-fi. */

const INSTITUTION_BULLETIN_CSS = `
  ${PRINT_CSS}
  .defeso-band { margin-inline: -10mm; padding: 1.4mm 10mm 1.35mm; display: flex; align-items: center; justify-content: space-between; gap: 5mm; color: #68420f; background: #fff7e8; border-top: .25mm solid #e7cc9d; border-bottom: .25mm solid #e7cc9d; font-size: 7.15pt; line-height: 1.2; font-weight: 700; }
  .identity-pill { display: inline-flex; align-items: center; min-height: 5mm; padding: .55mm 1.7mm; border: .25mm solid #cbd5dc; border-radius: 99px; color: #435264; background: #f3f6f8; font-size: 6.9pt; line-height: 1; font-weight: 700; letter-spacing: .045em; text-transform: uppercase; }
  .bulletin-head .subject { margin: 0; font-size: 11pt; font-weight: 800; }
  .bulletin-head .pills { margin-top: 1.3mm; display: flex; flex-wrap: wrap; gap: 1.2mm; }
  .lacuna-panel { border: .4mm dashed #b18549; color: #684819; background: #fff7e8; }
  .lacuna-panel .lacuna-rule { margin-top: 2mm; border-top: .25mm solid #d8bb8d; padding-top: 2mm; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; line-height: 1.35; letter-spacing: .055em; }
  .production-note { border: .25mm solid #cbd5dc; background: #f3f6f8; border-radius: .125rem; padding: 3mm; }
  .opening { margin-top: 2.5mm; }
  .highlights { margin-top: 3mm; }
  .bulletin-timeline { margin-top: 2.5mm; }
  .more { margin-top: 2.5mm; }
  .empty-box { min-height: 30mm; }
  .lacuna-panel .warn-icon { width: 5mm; height: 5mm; flex-shrink: 0; margin-top: .4mm; color: #8a5a18; }
  .highlight-phase { margin: 1.2mm 0 0; }
  .phase { display: inline-block; padding: .5mm 1.4mm; border-radius: 1mm; background: #e9eef1; color: #334553; font-size: 7.3pt; font-weight: 700; text-transform: uppercase; letter-spacing: .035em; }
  .phase-paid { color: #285338; background: #e6f2e9; }
  .phase-pending { color: #6b4918; background: #fff2d9; }
`

const INST_WARNING_ICON =
  '<svg class="warn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/></svg>'

const renderInstitutionBulletinHtml = (bulletin) => {
  const sparse = Boolean(bulletin.sparse)
  const pills = (bulletin.meta.identityBadges ?? [])
    .map((badge) => `<span class="identity-pill">${htmlEscape(badge)}</span>`)
    .join('')
  const highlights = bulletin.highlights
  const more = bulletin.moreItems
  return `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${htmlEscape(bulletin.meta.title)} — ${htmlEscape(bulletin.meta.subjectName)}</title><style>${INSTITUTION_BULLETIN_CSS}</style></head>
<body>
<article class="sheet" data-page="boletim" aria-label="Modelo de boletim informativo institucional de uma página">
  <header class="bulletin-head">
    <div>
      <p class="kicker">${htmlEscape(bulletin.meta.kicker)}</p>
      <p class="subject">${htmlEscape(bulletin.meta.subjectName)}</p>
      ${pills ? `<div class="pills">${pills}</div>` : ''}
    </div>
    <span class="model-label">${htmlEscape(bulletin.meta.modelLabel)}</span>
  </header>

  <div class="defeso-band" role="note" aria-label="Nota de defeso eleitoral">
    <span>DEFESO 2026 · material em preparação · não publicar sem revisão editorial e jurídica</span>
    <span style="text-transform: uppercase; letter-spacing: .07em">sem CTA · sem propaganda</span>
  </div>

  <section class="opening" aria-label="Abertura do boletim">
    <div>
      <p class="section-label">${sparse ? 'Somente o que está documentado' : 'Uma trajetória de trabalho junto à instituição'}</p>
      <h1>O que Jorge Solla fez pela e na <span class="accent">${htmlEscape(bulletin.meta.subjectName)}</span></h1>
      <p class="lead">${
        sparse
          ? 'Esta versão tem poucos registros confirmados. Em vez de preencher espaço, mostra só os fatos que o dossiê sustenta.'
          : 'Ações, recursos e articulações explicados de forma direta — somente o que já foi documentado no dossiê institucional.'
      }</p>
    </div>
    ${ASSET(sparse ? 'NEEDS ASSET · foto ou clipping' : 'NEEDS ASSET · foto real', [
      sparse ? 'somente registro relacionado ao fato' : 'Solla na instituição ou na ação citada',
      'origem, autoria e licença',
    ])}
  </section>

  <section class="highlights" aria-label="Destaques">
    <div class="highlights-head">
      <div>
        <p class="section-label">Destaques</p>
        <h2>${sparse ? 'Poucos fatos, sem enchimento' : 'Resultados em leitura rápida'}</h2>
      </div>
      <p class="side">${sparse ? 'não criar cards vazios para chegar a seis' : 'cada número mantém sua fase e seu alcance'}</p>
    </div>
    ${
      highlights.length
        ? `<div class="highlight-grid" style="${sparse ? 'grid-template-columns: repeat(2, 1fr)' : ''}">${highlights.map((highlight) => renderHighlight(highlight, { showPhase: true })).join('')}</div>`
        : '<p class="empty">Sem fato com fonte suficiente para destacar — ver lacunas no dossiê.</p>'
    }
  </section>

  <section class="bulletin-timeline" aria-label="Trajetória">
    <div class="timeline-head">
      <h2>Uma trajetória de compromisso com o serviço público</h2>
      <p class="timeline-side">${sparse ? 'contexto de carreira · não substitui fato institucional' : 'quatro momentos · linguagem direta'}</p>
    </div>
    <div class="timeline-grid">
      ${bulletin.timeline
        .map(
          (step) => `<div class="timeline-step">
            <p class="timeline-period">${htmlEscape(step.period)}</p>
            <p class="timeline-text">${htmlEscape(step.text)}</p>
          </div>`,
        )
        .join('')}
    </div>
  </section>

  <section class="more" aria-label="Outras ações">
    <div>
      <div class="more-head">
        <div>
          <p class="section-label">E mais</p>
          <h2>${sparse ? 'Outros registros confirmados' : 'Outras ações confirmadas'}</h2>
        </div>
        <p class="side">${sparse ? 'sem completar por inferência' : 'até 14 · sem completar por inferência'}</p>
      </div>
      ${
        more.length
          ? `<div class="more-grid">${more.map(renderMoreItem).join('')}</div>`
          : '<div class="empty-box"><p><strong class="uppercase">Sem itens adicionais com fonte além dos destaques.</strong></p><p>Conferir as lacunas explícitas no dossiê institucional antes de ampliar o boletim.</p></div>'
      }
    </div>
    ${
      sparse
        ? `<aside class="lacuna-panel" style="border-radius: .125rem; padding: 2.5mm" aria-label="Regra editorial para poucos fatos">
            ${INST_WARNING_ICON}
            <p style="margin: 0; font-size: 10.5pt; font-weight: 800">A página termina com espaço — de propósito.</p>
            <p style="font-size: 8.7pt; line-height: 1.35">Não repetir item, não ampliar efeito e não preencher com ação de setor ou rede como se fosse entrega exclusiva da instituição.</p>
            <p class="lacuna-rule">Poucos fatos com lastro &gt; página cheia sem lastro</p>
          </aside>`
        : `<aside class="more-aside" aria-label="Ativos visuais pendentes">
            ${ASSET('NEEDS ASSET · selo', ['marca autorizada da instituição', 'arquivo vetorial'])}
            ${ASSET('NEEDS ASSET · clipping', ['registro real da ação', 'origem e licença'])}
          </aside>`
    }
  </section>

  ${
    sparse
      ? `<section style="margin-top: 3mm; display: grid; grid-template-columns: 1fr 48mm; gap: 4mm">
          <div class="production-note">
            <p class="section-label">Nota de produção</p>
            <p style="margin: 0; font-size: 9.2pt; line-height: 1.38; color: #435264">Se novos fatos forem documentados, eles entram por relevância — até seis destaques e até quatorze itens. A ausência nunca vira número zero, percentual ou afirmação genérica.</p>
          </div>
          ${ASSET('NEEDS ASSET · selo', ['marca autorizada da instituição', 'arquivo vetorial'])}
        </section>`
      : ''
  }

  <footer class="bulletin-foot">
    <div class="row">
      <div>
        <p class="orig">Conteúdo selecionado do dossiê institucional.</p>
        <p class="defeso"><strong>Controle editorial:</strong> fase acompanha cada valor · instituição, setor e rede não são somados · sem percentual estadual absoluto.</p>
      </div>
      <p class="stamp">MODELO · INSUMO INTERNO<br />A4 · página 1/1<br />${htmlEscape(bulletin.meta.generatedAtLabel)}</p>
    </div>
  </footer>
</article>
</body>
</html>`
}

/** Dispatch: the institution unit renders the institutional composition. */
export const renderBulletinHtml = (bulletin) =>
  isInstitutionUnit(bulletin?.unit)
    ? renderInstitutionBulletinHtml(bulletin)
    : renderMunicipalityBulletinHtml(bulletin)
