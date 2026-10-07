#!/usr/bin/env node
/**
 * Briefing Geral de Militância — livretos de 1 folha (4 páginas) e pesca mínima
 * (2 folhas, 8 páginas).
 *
 * Lê os JSONs autorais já existentes em `data/briefing-geral-militancia/`
 * (`<slug>.briefing.v2.json` quando houver, senão `<slug>.briefing.json`; idem
 * para `<slug>.intro*.md`), o ledger `<slug>.research*.json` e as propostas do
 * próximo mandato em `propostas.json` (uma por recorte, com lastro no ledger —
 * a linha "Propostas" do compilado é a proposta de Solla para a área, nunca o
 * plano de conversa do militante). Cada recorte vira um livreto A5 de 4 páginas
 * imposto em 1 folha A4 paisagem (frente/verso, dobra no meio); a pesca mínima
 * compila os recortes em 8 páginas (2 folhas). Nada é inventado: todo item
 * impresso aponta para um fato do ledger, e o build falha fechado quando uma
 * âncora ou um lastro de proposta não resolve.
 *
 * A paginação é medida de verdade no Chromium (Playwright): um probe mede a
 * altura de cada unidade e o packer distribui as unidades nas páginas; se o
 * conteúdo não cabe, itens são podados na ordem declarada (qa → defesas →
 * intro no recorte; fez/defesas no compilado) até caber — nunca cortando uma
 * página no meio.
 *
 * Saídas em `docs/research/briefing-geral-militancia/livretos-1folha/`:
 *   <nn>-<slug>.pdf           — todas as faces do livreto (A4 paisagem)
 *   <nn>-<slug>-frentes.pdf   — só as frentes das folhas
 *   <nn>-<slug>-versos.pdf    — só os versos das folhas
 *   00-pesca-minima*.pdf      — o livreto compilado, mesmo contrato
 *   00-edicao-completa*.pdf   — todos os livretos num documento só (frentes/versos)
 *   00-guia-de-impressao.pdf  — guia de impressão/montagem em uma página A4
 *   livretos.json             — manifesto (páginas e ordem de dobra)
 *   LEIA-ME.txt               — instruções de impressão
 *
 * Uso:
 *   NODE_OPTIONS="--no-deprecation --import=tsx/esm" node scripts/build-briefing-militancia-livretos.mjs
 *   ... [--only=saude] [--only-pesca] [--skip-pesca]
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'

import { dieWithLabel } from './lib/cli.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DATA_DIR = 'data/briefing-geral-militancia'
const OUT_DIR = 'docs/research/briefing-geral-militancia/livretos-1folha'
const LABEL = 'build-briefing-militancia-livretos'

const A5_W = 148.5
const A5_H = 210
const A4_W = 297
const A4_H = 210
const MAX_FIT_ATTEMPTS = 40
/** Corpos testados (pt, do maior para o menor) até o conteúdo caber na dobra. */
const RECORTE_BASE_SIZES = [8.8, 8.5, 8.2, 7.9, 7.6]
const PESCA_BASE_SIZES = [7.9, 7.65, 7.4, 7.15]

/** Recortes na ordem do documento; `file` difere do slug público quando o arquivo tem outro nome. */
const RECORTES = [
  { num: '01', slug: 'saude' },
  { num: '02', slug: 'cultura' },
  { num: '03', slug: 'educacao' },
  { num: '04', slug: 'salvador' },
  { num: '05', slug: 'ufba' },
  { num: '06', slug: 'trabalhadores-da-saude' },
  { num: '07', slug: 'agricultura-familiar' },
  { num: '08', slug: 'tecnologia', file: 'ciencia-tecnologia' },
  { num: '09', slug: 'soberania-nacional' },
  { num: '10', slug: 'democracia' },
  { num: '11', slug: 'lgbtqia' },
  { num: '12', slug: 'anti-racista' },
  { num: '13', slug: 'feminista' },
  { num: '14', slug: 'interior' },
  { num: '15', slug: 'transversais' },
  { num: '16', slug: 'seguranca' },
]

/** Cores e tipografia do documento original, comprimidas para a folha única.
 *  Os corpos são em `em` sobre o `font-size` da folha: cada livreto escolhe o
 *  maior corpo que ainda cabe (ver BASE_SIZES). */
const BASE_CSS = `
  :root {
    --ink: #1b2930;
    --soft: #586770;
    --accent: #3e6274;
    --line: #c3ced4;
    --lline: #e3e9ec;
    --note: #f3f6f7;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    color: var(--ink);
    background: #fff;
    font-family: 'Fira Sans', 'DejaVu Sans', Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .run-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 6mm;
    padding-bottom: 1mm;
    margin-bottom: 1.6mm;
    border-bottom: .35mm solid var(--ink);
    color: var(--soft);
    font-size: .776em;
    letter-spacing: .07em;
    text-transform: uppercase;
  }
  .run-head strong { color: var(--ink); }
  .sheet-foot {
    display: flex;
    justify-content: space-between;
    gap: 6mm;
    padding-top: 1mm;
    margin-top: 1.6mm;
    border-top: .2mm solid var(--line);
    color: var(--soft);
    font-size: .763em;
  }
  .sheet {
    display: flex;
    width: ${A5_W}mm;
    height: ${A5_H}mm;
    padding: 7mm 8.5mm 5.5mm;
    overflow: hidden;
    flex-direction: column;
    background: #fff;
    font-size: 7.6pt;
    line-height: 1.34;
  }
  .flow { flex: 1 1 auto; min-height: 0; }
  .unit { }
  .unit-title { padding-bottom: 2mm; }
  .sec-kicker {
    margin: 0;
    color: var(--accent);
    font-size: .816em;
    font-weight: 700;
    letter-spacing: .12em;
    text-transform: uppercase;
  }
  .sec-title {
    margin: .8mm 0 0;
    font-size: 2.105em;
    font-weight: 650;
    line-height: 1.03;
    letter-spacing: -.025em;
  }
  .sec-sub { margin: 1mm 0 0; color: var(--soft); font-size: 1em; line-height: 1.3; }
  .unit-lede { padding-bottom: 2mm; }
  .lede {
    margin: 0;
    padding: 1.8mm 2.4mm;
    border-left: .9mm solid var(--accent);
    background: var(--note);
    font-size: .987em;
    line-height: 1.38;
  }
  .unit-para { padding-bottom: 1.4mm; }
  .para { margin: 0; font-size: 1em; line-height: 1.4; }
  .unit-sechead { padding-top: 1.2mm; padding-bottom: 1.2mm; border-top: .3mm solid var(--ink); }
  .unit-sechead h2 { margin: 0; font-size: 1.263em; font-weight: 700; letter-spacing: -.01em; }
  .sub-note { margin: .5mm 0 0; color: var(--soft); font-size: .829em; line-height: 1.3; }
  .unit-item { padding-bottom: 1mm; }
  .item { position: relative; margin: 0; padding-left: 3.4mm; font-size: .987em; line-height: 1.34; }
  .item::before {
    position: absolute;
    top: 1.4mm;
    left: 0;
    width: 1.6mm;
    height: .4mm;
    background: var(--accent);
    content: '';
  }
  .item b { font-weight: 700; }
  .src { color: var(--accent); font-size: .789em; white-space: nowrap; }
  .unit-qa { padding-bottom: 1.4mm; }
  .qa-item { display: grid; margin: 0; grid-template-columns: 30mm 1fr; gap: 2.6mm; }
  .qa-q { margin: 0; font-size: .974em; font-weight: 700; line-height: 1.3; }
  .qa-side {
    display: block;
    margin-bottom: .5mm;
    color: var(--accent);
    font-size: .737em;
    letter-spacing: .08em;
    text-transform: uppercase;
  }
  .qa-a { margin: 0; font-size: .974em; line-height: 1.36; }
  .qa-a p { margin: 0 0 .8mm; }
  .qa-a p:last-child { margin-bottom: 0; }
  .qa-a b { font-weight: 700; }
  .unit-plan { padding-top: 1.2mm; }
  .plan {
    margin: 0;
    padding: 1.8mm 2.4mm;
    border: .25mm solid var(--line);
    border-left: 1mm solid var(--accent);
    background: var(--note);
    font-size: .974em;
    line-height: 1.34;
  }
  .plan-tag {
    display: block;
    margin-bottom: .6mm;
    color: var(--accent);
    font-size: .763em;
    font-weight: 700;
    letter-spacing: .1em;
    text-transform: uppercase;
  }
  /* ---- pesca mínima (base 7.15pt) ---- */
  .unit-blk { padding-bottom: 2.2mm; }
  .blk { margin: 0; }
  .blk h3 {
    margin: 0 0 1mm;
    padding-bottom: .8mm;
    border-bottom: .3mm solid var(--ink);
    font-size: 1.483em;
    font-weight: 700;
    line-height: 1.06;
    letter-spacing: -.015em;
  }
  .blk p { margin: 0 0 .9mm; font-size: 1em; line-height: 1.33; }
  .blk p:last-child { margin-bottom: 0; }
  .tag {
    display: inline-block;
    min-width: 14mm;
    color: var(--accent);
    font-size: .811em;
    font-weight: 700;
    letter-spacing: .08em;
    text-transform: uppercase;
    vertical-align: 1.5%;
  }
  .blk b { font-weight: 700; }
  .blk .sep { color: var(--soft); }
  .blk-lede { color: var(--ink); }
  .blk-proposal b { white-space: normal; }
`

const PROBE_CSS = `
  ${BASE_CSS}
  .probe-flow { width: ${A5_W - 17}mm; background: #fff; }
  .probe-sheet {
    display: flex;
    width: ${A5_W}mm;
    height: ${A5_H}mm;
    padding: 7mm 8.5mm 5.5mm;
    flex-direction: column;
    background: #fff;
    line-height: 1.34;
  }
  .probe-flow-box { flex: 1 1 auto; min-height: 0; }
`

const PRINT_CSS = `
  ${BASE_CSS}
  @page { size: A4 landscape; margin: 0; }
  .a4 {
    display: flex;
    width: ${A4_W}mm;
    height: ${A4_H}mm;
    overflow: hidden;
    background: #fff;
    break-after: page;
  }
  .a4:last-child { break-after: auto; }
  .slot { width: ${A5_W}mm; height: ${A5_H}mm; overflow: hidden; flex: 0 0 ${A5_W}mm; }
  .slot .sheet { break-after: auto; }
`

const die = dieWithLabel(LABEL)

const readJson = async (path) => {
  try {
    return JSON.parse(await readFile(resolve(ROOT, path), 'utf8'))
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    die(`JSON inválido em ${path}: ${error instanceof Error ? error.message : error}`)
  }
}

const readText = async (path) => {
  try {
    return await readFile(resolve(ROOT, path), 'utf8')
  } catch (error) {
    if (error?.code === 'ENOENT') return null
    die(`Falha ao ler ${path}: ${error instanceof Error ? error.message : error}`)
  }
}

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const formatDate = (iso) => {
  if (!iso) return null
  const [year, month, day] = iso.slice(0, 10).split('-')
  if (!year || !month || !day) return null
  return `${day}/${month}/${year}`
}

/** Corte na primeira fronteira de frase depois da metade do limite; senão reticências. */
const clipText = (text, max) => {
  const clean = text.trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max)
  const boundary = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '), cut.lastIndexOf(' — '))
  if (boundary > max * 0.45) return cut.slice(0, boundary + 1).trim()
  return `${cut.trimEnd().replace(/[,;:.]$/, '')}…`
}

const sideLabels = {
  direita: 'Objeção à direita',
  esquerda: 'Objeção à esquerda',
  entrega: 'Dúvida sobre entrega',
}

/** Carrega o conteúdo efetivo (v2 quando existir) + ledger + intro de um recorte. */
const loadRecorte = async (entry) => {
  const file = entry.file ?? entry.slug
  const briefingV2 = await readJson(join(DATA_DIR, `${file}.briefing.v2.json`))
  const briefingV1 = await readJson(join(DATA_DIR, `${file}.briefing.json`))
  const briefing = briefingV2 ?? briefingV1
  if (!briefing) die(`briefing ausente para ${entry.slug} (${file}.briefing[.v2].json)`)
  const introV2 = await readText(join(DATA_DIR, `${file}.intro.v2.md`))
  const introV1 = await readText(join(DATA_DIR, `${file}.intro.md`))
  const intro = (introV2 ?? introV1 ?? '')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  const research = await readJson(join(DATA_DIR, `${file}.research.json`))
  const research2 = await readJson(join(DATA_DIR, `${file}.research2.json`))
  const ledger = new Map()
  for (const source of [research, research2]) {
    for (const item of source?.items ?? []) {
      if (item?.id && item?.sourceUrl) ledger.set(`${item.id}|${item.sourceUrl}`, item)
    }
  }
  // Toda âncora impressa tem de resolver no ledger: par (factId, sourceUrl) errado é falha fechada.
  for (const [listName, list] of [
    ['defenses', briefing.defenses ?? []],
    ['essential', briefing.essential ?? []],
    ['qa', briefing.qa ?? []],
  ]) {
    for (const item of list) {
      if (item?.gapReason) continue
      if (!ledger.has(`${item?.factId}|${item?.sourceUrl}`)) {
        die(
          `${entry.slug}: âncora de ${listName} não resolve no ledger ` +
            `(${item?.factId} + ${item?.sourceUrl}) — pare e corrija o briefing.`,
        )
      }
    }
  }
  return {
    num: entry.num,
    slug: entry.slug,
    file,
    label: briefing.label ?? entry.slug,
    subtitle: briefing.subtitle ?? '',
    lede: briefing.lede,
    plan: briefing.plan,
    defenses: briefing.defenses ?? [],
    essential: briefing.essential ?? [],
    qa: briefing.qa ?? [],
    intro,
    ledger,
  }
}

/**
 * Propostas autorais do próximo mandato, por recorte (`propostas.json`). Cada
 * linha precisa existir e apontar `lastro` em fatos reais do ledger do recorte
 * — proposta sem lastro falha fechado.
 */
const loadProposals = async (recortes) => {
  const raw = await readJson(join(DATA_DIR, 'propostas.json'))
  if (!raw?.propostas?.length) {
    die(
      'propostas.json ausente ou sem "propostas" — a pesca mínima exige a proposta de Solla por recorte.',
    )
  }
  const proposals = new Map()
  for (const entry of raw.propostas) {
    if (!entry?.recorte || !entry?.proposta)
      die('propostas.json: entrada sem "recorte"/"proposta".')
    proposals.set(entry.recorte, entry)
  }
  for (const recorte of recortes) {
    const entry = proposals.get(recorte.slug)
    if (!entry) die(`propostas.json: falta a proposta do recorte "${recorte.slug}".`)
    for (const factId of entry.lastro ?? []) {
      const known = [...recorte.ledger.keys()].some((key) => key.startsWith(`${factId}|`))
      if (!known) {
        die(
          `propostas.json: lastro "${factId}" não existe no ledger de ${recorte.slug} — pare e corrija.`,
        )
      }
    }
  }
  return proposals
}

/** Âncora (factId + sourceUrl) → data da fonte, para o crédito impresso. */
const anchorDate = (recorte, item) => {
  const fact = recorte.ledger.get(`${item.factId}|${item.sourceUrl}`)
  return formatDate(fact?.sourceDate)
}

const sourceCredit = (recorte, item) => {
  const date = anchorDate(recorte, item)
  return date
    ? `<span class="src">fonte · ${escapeHtml(date)}</span>`
    : '<span class="src">fonte no material</span>'
}

const itemHtml = (recorte, item) =>
  `<div class="item"><b>${escapeHtml(item.title)}</b> — ${escapeHtml(item.note)} ${sourceCredit(recorte, item)}</div>`

const qaHtml = (recorte, item) => `
  <div class="qa-item">
    <p class="qa-q"><span class="qa-side">${escapeHtml(sideLabels[item.side] ?? item.side)}</span>${escapeHtml(item.question)}</p>
    <div class="qa-a">
      <p><b>Reconhecer:</b> ${escapeHtml(item.acknowledge)}</p>
      <p><b>Fato:</b> ${escapeHtml(item.answer)} ${sourceCredit(recorte, item)}</p>
      <p><b>Fechar:</b> ${escapeHtml(item.close)}</p>
    </div>
  </div>`

/**
 * Unidades do livreto do recorte, na ordem de leitura. `keepWithNext` mantém o
 * cabeçalho de seção junto do primeiro item; `sheddable` é o que pode cair no
 * ajuste de 4 páginas (qas → defesas → parágrafos do intro, nessa ordem).
 */
const buildRecorteUnits = (recorte, content) => {
  const units = []
  units.push({
    id: 'title',
    kind: 'title',
    html: `<div class="sec-head">
      <p class="sec-kicker">Recorte</p>
      <h1 class="sec-title">${escapeHtml(recorte.label)}</h1>
      ${recorte.subtitle ? `<p class="sec-sub">${escapeHtml(recorte.subtitle)}</p>` : ''}
    </div>`,
  })
  units.push({ id: 'lede', kind: 'lede', html: `<p class="lede">${escapeHtml(content.lede)}</p>` })
  content.intro.forEach((paragraph, index) => {
    units.push({
      id: `intro-${index}`,
      kind: 'para',
      html: `<p class="para">${escapeHtml(paragraph)}</p>`,
    })
  })
  units.push({
    id: 'def-head',
    kind: 'sechead',
    keepWithNext: true,
    html: `<div class="sub-head"><h2>O que Solla defende</h2><p class="sub-note">Princípios e posições com fonte — leitura dos registros</p></div>`,
  })
  content.defenses.forEach((item, index) => {
    units.push({ id: `def-${index}`, kind: 'item', html: itemHtml(recorte, item) })
  })
  units.push({
    id: 'ess-head',
    kind: 'sechead',
    keepWithNext: true,
    html: `<div class="sub-head"><h2>O essencial do recorte</h2><p class="sub-note">Os fatos-âncora que sustentam a conversa</p></div>`,
  })
  content.essential.forEach((item, index) => {
    units.push({ id: `ess-${index}`, kind: 'item', html: itemHtml(recorte, item) })
  })
  units.push({
    id: 'qa-head',
    kind: 'sechead',
    keepWithNext: true,
    html: `<div class="sub-head"><h2>Perguntas prováveis × melhores respostas</h2><p class="sub-note">Reconheça sem repetir o ataque → responda com fato e fonte → feche no pedido</p></div>`,
  })
  content.qa.forEach((item, index) => {
    units.push({ id: `qa-${index}`, kind: 'qa', html: qaHtml(recorte, item) })
  })
  units.push({
    id: 'plan',
    kind: 'plan',
    html: `<div class="plan"><span class="plan-tag">Plano de conversa</span>${escapeHtml(content.plan)}</div>`,
  })
  return units
}

/**
 * Uma poda do conteúdo do recorte, na ordem declarada: qa (mantendo os dois
 * lados e um mínimo de 2) → defesas (mínimo 4) → parágrafos do intro (mínimo
 * 1). Devolve um novo conteúdo ou null quando não há mais o que podar.
 */
const shedRecorte = (content) => {
  const qa = [...content.qa]
  if (qa.length > 2) {
    for (let index = qa.length - 1; index >= 0; index -= 1) {
      const sides = new Set(
        qa.filter((_item, position) => position !== index).map((item) => item.side),
      )
      if (sides.has('direita') && sides.has('esquerda')) {
        qa.splice(index, 1)
        return { ...content, qa }
      }
    }
  }
  if (content.defenses.length > 4) {
    return { ...content, defenses: content.defenses.slice(0, -1) }
  }
  if (content.intro.length > 1) {
    return { ...content, intro: content.intro.slice(0, -1) }
  }
  return null
}

const unitsProbeHtml = (
  units,
  basePt,
) => `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>${PROBE_CSS}</style></head>
<body>
  <div class="probe-sheet" style="font-size:${basePt}pt">
    <div class="run-head" data-probe="runhead"><strong>RECORTE · X</strong><span>JORGE SOLLA 1313</span></div>
    <div class="probe-flow-box" data-probe="flowbox"><div class="probe-flow" data-probe="flow">
      ${units.map((unit, index) => `<div class="unit unit-${unit.kind}" data-unit="${index}">${unit.html}</div>`).join('\n')}
    </div></div>
    <div class="sheet-foot" data-probe="foot"><span>material interno</span><span>p. 1/4</span></div>
  </div>
</body></html>`

const measureUnits = async (page, html) => {
  await page.setContent(html, { waitUntil: 'load' })
  await page.emulateMedia({ media: 'print' })
  return page.evaluate(() => ({
    capacity: document.querySelector('[data-probe="flowbox"]').clientHeight,
    heights: [...document.querySelectorAll('[data-unit]')].map((element) => element.offsetHeight),
  }))
}

/** Packer guloso: devolve arrays de índices (um por página). */
const packUnits = (units, heights, capacity) => {
  const pages = []
  let current = []
  let used = 0
  units.forEach((_unit, index) => {
    const height = heights[index]
    if (current.length > 0 && used + height > capacity) {
      pages.push(current)
      current = []
      used = 0
    }
    current.push(index)
    used += height
  })
  if (current.length > 0) pages.push(current)
  // Cabeçalho de seção não fica órfão no pé da página: desce com o próximo item.
  for (let position = 0; position < pages.length - 1; position += 1) {
    const pageUnits = pages[position]
    const lastIndex = pageUnits[pageUnits.length - 1]
    if (units[lastIndex]?.keepWithNext) {
      pageUnits.pop()
      pages[position + 1].unshift(lastIndex)
    }
  }
  return pages
}

const fitRecorte = async (page, recorte) => {
  let content = {
    lede: recorte.lede,
    intro: [...recorte.intro],
    defenses: [...recorte.defenses],
    essential: [...recorte.essential],
    qa: [...recorte.qa],
    plan: recorte.plan,
  }
  const shed = { qa: 0, defenses: 0, intro: 0 }
  // Maior corpo que ainda cabe em 4 páginas com o conteúdo completo.
  for (const basePt of RECORTE_BASE_SIZES) {
    const units = buildRecorteUnits(recorte, content)
    const { capacity, heights } = await measureUnits(page, unitsProbeHtml(units, basePt))
    const pages = packUnits(units, heights, capacity)
    const overflow = heights.some((height) => height > capacity)
    if (pages.length <= 4 && !overflow)
      return { content, pages, units, shed, packedPages: pages.length, basePt }
  }
  // Sem caber inteiro: poda no menor corpo, como antes.
  const basePt = RECORTE_BASE_SIZES[RECORTE_BASE_SIZES.length - 1]
  for (let attempt = 0; attempt <= MAX_FIT_ATTEMPTS; attempt += 1) {
    const units = buildRecorteUnits(recorte, content)
    const { capacity, heights } = await measureUnits(page, unitsProbeHtml(units, basePt))
    const pages = packUnits(units, heights, capacity)
    const overflow = heights.some((height) => height > capacity)
    if (pages.length <= 4 && !overflow)
      return { content, pages, units, shed, packedPages: pages.length, basePt }
    const next = shedRecorte(content)
    if (!next) {
      die(
        `Recorte ${recorte.slug} não cabe em 4 páginas mesmo no mínimo ` +
          `(${pages.length} páginas, capacidade ${Math.round(capacity)}px).`,
      )
    }
    if (next.qa.length < content.qa.length) shed.qa += 1
    else if (next.defenses.length < content.defenses.length) shed.defenses += 1
    else if (next.intro.length < content.intro.length) shed.intro += 1
    content = next
  }
  die(`Recorte ${recorte.slug}: ajuste de páginas não convergiu.`)
}

const renderSheet = ({ pageIndex, pageCount, units, title, basePt }) => `
  <div class="sheet" data-page="${pageIndex + 1}" style="font-size:${basePt}pt">
    <div class="run-head">
      <strong>${escapeHtml(title)}</strong>
      <span>JORGE SOLLA 1313</span>
    </div>
    <div class="flow">
      ${units.map((unit) => `<div class="unit unit-${unit.kind}">${unit.html}</div>`).join('\n')}
    </div>
    <div class="sheet-foot">
      <span>Material interno de capacitação — não publicar</span>
      <span>p. ${pageIndex + 1}/${pageCount}</span>
    </div>
  </div>`

const sidesFor = (pages) => {
  if (pages === 4)
    return [
      [4, 1],
      [2, 3],
    ]
  if (pages === 8)
    return [
      [8, 1],
      [2, 7],
      [6, 3],
      [4, 5],
    ]
  die(`Imposição não definida para ${pages} páginas.`)
}

const blankSheet = () => '<div class="sheet"></div>'

const renderSidesHtml = (sheets, sides) => {
  const slots = sides
    .map(([left, right]) => {
      const leftHtml = left === null ? '' : sheets[left - 1]
      const rightHtml = right === null ? '' : sheets[right - 1]
      return `<div class="a4"><div class="slot">${leftHtml}</div><div class="slot">${rightHtml}</div></div>`
    })
    .join('\n')
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Briefing Geral de Militância — livreto</title><style>${PRINT_CSS}</style></head><body>${slots}</body></html>`
}

const printPdf = async (page, html, outPath, label) => {
  await page.setContent(html, { waitUntil: 'load' })
  await page.emulateMedia({ media: 'print' })
  const overflows = await page.evaluate(() =>
    [...document.querySelectorAll('.slot, [data-guide]')]
      .map((slot, index) => ({
        slot: slot.dataset.guide ? 'guia' : index + 1,
        height: slot.scrollHeight,
        client: slot.clientHeight,
      }))
      .filter((row) => row.height > row.client + 1),
  )
  if (overflows.length > 0) {
    die(
      `${label}: slot estourou (${overflows.map((row) => `${row.slot}:${row.height}>${row.client}`).join(', ')})`,
    )
  }
  await page.pdf({
    path: resolve(ROOT, outPath),
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: '0', bottom: '0', left: '0', right: '0' },
  })
}

/** Blocos da pesca mínima: princípios, defesas, trabalho e propostas de cada recorte. */
const buildPescaBlock = (recorte, content) => ({
  label: recorte.label,
  slug: recorte.slug,
  principle: content.principle,
  defenses: content.defenses,
  work: content.work,
  proposal: content.proposal,
})

const pescaPairs = (recortes) => {
  const pairs = []
  for (let index = 0; index < recortes.length; index += 2) {
    pairs.push([recortes[index], recortes[index + 1]].filter(Boolean))
  }
  return pairs
}

const blockHtml = (block) => {
  const pair = (items) =>
    items
      .map((item) => `<b>${escapeHtml(item.title)}</b> — ${escapeHtml(item.note)}`)
      .join(' <span class="sep">•</span> ')
  const lines = []
  lines.push(
    `<p class="blk-lede"><span class="tag">Princípios</span>${escapeHtml(block.principle)}</p>`,
  )
  if (block.defenses.length > 0) {
    lines.push(`<p><span class="tag">Defesas</span>${pair(block.defenses)}</p>`)
  }
  if (block.work.length > 0) {
    lines.push(`<p><span class="tag">Trabalho</span>${pair(block.work)}</p>`)
  }
  lines.push(
    `<p class="blk-proposal"><span class="tag">Propostas</span>${escapeHtml(block.proposal)}</p>`,
  )
  return `<section class="blk"><h3>${escapeHtml(block.label)}</h3>${lines.join('\n')}</section>`
}

const pescaUnit = (block) => ({ id: `blk-${block.slug}`, kind: 'blk', html: blockHtml(block) })

/** Poda um bloco da pesca: fez[1] → defesas[1] → princípio curto → fez[0] → defesas[0]. */
const shedPescaBlock = (block) => {
  if (block.work.length > 1) return { ...block, work: block.work.slice(0, -1) }
  if (block.defenses.length > 1) return { ...block, defenses: block.defenses.slice(0, -1) }
  if (!block.shortPrinciple) {
    return { ...block, shortPrinciple: true, principle: clipText(block.fullPrinciple, 150) }
  }
  if (block.work.length > 0) return { ...block, work: [] }
  if (block.defenses.length > 0) return { ...block, defenses: [] }
  return null
}

const fitPesca = async (page, recortes, proposals) => {
  const fullBlocks = recortes.map((recorte) => {
    const principle = clipText(recorte.lede, 260)
    const proposal = proposals.get(recorte.slug)?.proposta
    if (!proposal) die(`Pesca mínima: sem proposta autoral para ${recorte.slug}.`)
    return buildPescaBlock(recorte, {
      principle,
      fullPrinciple: recorte.lede,
      defenses: recorte.defenses.slice(0, 2),
      work: recorte.essential.slice(0, 2),
      proposal: clipText(proposal, 280),
    })
  })
  const measurePairs = async (blocks, basePt) => {
    const pairs = pescaPairs(blocks)
    const { capacity, heights } = await measureUnits(
      page,
      unitsProbeHtml(pairs.flat().map(pescaUnit), basePt),
    )
    const heightBySlug = new Map(pairs.flat().map((block, index) => [block.slug, heights[index]]))
    const overflowing = pairs
      .map((pair) => ({
        pair,
        total: pair.reduce((sum, block) => sum + (heightBySlug.get(block.slug) ?? 0), 0),
      }))
      .filter((row) => row.total > capacity)
    return { pairs, heightBySlug, overflowing }
  }
  // Maior corpo que ainda cabe em 8 páginas com os 2+2 itens de cada recorte.
  for (const basePt of PESCA_BASE_SIZES) {
    const { pairs, overflowing } = await measurePairs(fullBlocks, basePt)
    if (overflowing.length === 0) {
      return { blocks: fullBlocks, pairs, units: fullBlocks.map(pescaUnit), shed: [], basePt }
    }
  }
  // Sem caber inteiro: poda no menor corpo.
  const basePt = PESCA_BASE_SIZES[PESCA_BASE_SIZES.length - 1]
  let blocks = fullBlocks
  const shed = new Map()
  for (let attempt = 0; attempt <= MAX_FIT_ATTEMPTS; attempt += 1) {
    const { pairs, heightBySlug, overflowing } = await measurePairs(blocks, basePt)
    if (overflowing.length === 0) {
      return { blocks, pairs, units: blocks.map(pescaUnit), shed: [...shed.entries()], basePt }
    }
    const tallest = overflowing
      .flatMap((row) => row.pair)
      .filter((block) => block.work.length + block.defenses.length > 0 || !block.shortPrinciple)
      .sort((a, b) => (heightBySlug.get(b.slug) ?? 0) - (heightBySlug.get(a.slug) ?? 0))[0]
    if (!tallest) die('Pesca mínima não cabe em 8 páginas com o conteúdo mínimo.')
    const next = shedPescaBlock(tallest)
    if (!next) die(`Bloco ${tallest.slug} da pesca mínima não pode mais encolher.`)
    shed.set(tallest.slug, (shed.get(tallest.slug) ?? 0) + 1)
    const position = blocks.findIndex((block) => block.slug === tallest.slug)
    blocks = blocks.map((block, index) => (index === position ? next : block))
  }
  die('Pesca mínima: ajuste de páginas não convergiu.')
}

const renderPescaSheets = (blocks, basePt) => {
  const pairs = pescaPairs(blocks)
  return pairs.map((pair, pageIndex) =>
    renderSheet({
      pageIndex,
      pageCount: pairs.length,
      units: pair.map(pescaUnit),
      title: 'Pesca mínima · Jorge Solla 1313',
      basePt,
    }),
  )
}

const writeOutputs = async (page, { base, sheets, pages, description }) => {
  const sides = sidesFor(pages)
  const fronts = sides.filter((_side, index) => index % 2 === 0)
  const backs = sides.filter((_side, index) => index % 2 === 1)
  await printPdf(
    page,
    renderSidesHtml(sheets, sides),
    `${OUT_DIR}/${base}.pdf`,
    `${base} (completo)`,
  )
  await printPdf(
    page,
    renderSidesHtml(sheets, fronts),
    `${OUT_DIR}/${base}-frentes.pdf`,
    `${base} (frentes)`,
  )
  await printPdf(
    page,
    renderSidesHtml(sheets, backs),
    `${OUT_DIR}/${base}-versos.pdf`,
    `${base} (versos)`,
  )
  return {
    slug: base,
    label: description,
    pages,
    padded: pages,
    sheets: pages / 4,
    sides,
    sheetsHtml: sheets,
  }
}

/**
 * Edição completa: um único documento com as faces de todos os livretos, na
 * ordem do manifesto. `pick` separa frentes (índices pares) dos versos (ímpares)
 * — imprimir todas as frentes, virar o maço inteiro e imprimir os versos alinha
 * os dois lados de uma vez, sem montar livreto por livreto.
 */
const renderEditionHtml = (booklets, pick) => {
  const slots = booklets
    .flatMap((booklet) => pick(booklet).map(([left, right]) => ({ booklet, left, right })))
    .map(({ booklet, left, right }) => {
      const leftHtml = left === null ? '' : booklet.sheetsHtml[left - 1]
      const rightHtml = right === null ? '' : booklet.sheetsHtml[right - 1]
      return `<div class="a4"><div class="slot">${leftHtml}</div><div class="slot">${rightHtml}</div></div>`
    })
    .join('\n')
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Briefing Geral de Militância — edição completa</title><style>${PRINT_CSS}</style></head><body>${slots}</body></html>`
}

const writeEditionOutputs = async (page, booklets) => {
  if (booklets.length === 0) return
  await printPdf(
    page,
    renderEditionHtml(booklets, (booklet) => booklet.sides),
    `${OUT_DIR}/00-edicao-completa.pdf`,
    'Edição completa (todas as faces)',
  )
  await printPdf(
    page,
    renderEditionHtml(booklets, (booklet) =>
      booklet.sides.filter((_side, index) => index % 2 === 0),
    ),
    `${OUT_DIR}/00-edicao-completa-frentes.pdf`,
    'Edição completa (frentes)',
  )
  await printPdf(
    page,
    renderEditionHtml(booklets, (booklet) =>
      booklet.sides.filter((_side, index) => index % 2 === 1),
    ),
    `${OUT_DIR}/00-edicao-completa-versos.pdf`,
    'Edição completa (versos)',
  )
}

const GUIDE_CSS = `
  ${BASE_CSS}
  @page { size: A4 portrait; margin: 0; }
  .guide {
    width: 210mm;
    height: 297mm;
    padding: 16mm 18mm 12mm;
    box-sizing: border-box;
    font-size: 9.5pt;
    line-height: 1.42;
  }
  .guide h1 { margin: 0; font-size: 21pt; line-height: 1.08; letter-spacing: -.02em; }
  .guide .sub { margin: 2mm 0 0; color: var(--soft); font-size: 10pt; }
  .guide h2 { margin: 6mm 0 1.4mm; padding-top: 1.6mm; border-top: .35mm solid var(--ink); font-size: 11.5pt; }
  .guide ol { margin: 0; padding-left: 6mm; }
  .guide li { margin-bottom: 1.2mm; }
  .guide table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  .guide th, .guide td { padding: 1mm 1.6mm; border-bottom: .15mm solid var(--lline); text-align: left; }
  .guide th { border-bottom: .3mm solid var(--ink); font-size: 8pt; letter-spacing: .06em; text-transform: uppercase; }
  .guide td.num, .guide th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .guide .note { margin: 3mm 0 0; padding: 2mm 2.6mm; border-left: 1mm solid var(--accent); background: var(--note); font-size: 9pt; }
  .guide .files { margin: 0; padding-left: 6mm; }
  .guide code { font-family: 'DejaVu Sans Mono', monospace; font-size: 8.6pt; }
`

/** Manifest limpo: nunca deixa o HTML das folhas vazar para o `livretos.json`. */
const toManifestEntry = ({ slug, label, pages, padded, sheets, sides }) => ({
  slug,
  label,
  pages,
  padded,
  sheets,
  sides,
})

const renderGuideHtml = (manifest) => {
  const rows = manifest
    .map(
      (entry, index) => `<tr>
        <td class="num">${index + 1}</td>
        <td><code>${escapeHtml(entry.slug)}</code></td>
        <td>${escapeHtml(entry.label)}</td>
        <td class="num">${entry.pages}</td>
        <td class="num">${entry.sheets}</td>
      </tr>`,
    )
    .join('\n')
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Guia de impressão — Briefing de Militância</title><style>${GUIDE_CSS}</style></head>
<body><div class="guide" data-guide="1">
  <h1>Briefing Geral de Militância — guia de impressão</h1>
  <p class="sub">Jorge Solla 1313 · material interno de capacitação · não publicar</p>

  <p class="note">Cada recorte é um livreto A5 de 4 páginas (1 folha A4 paisagem dobrada ao meio);
  a pesca mínima é o compilado de 8 páginas (2 folhas). As páginas já vêm na ordem de dobra
  (saddle stitch): é imprimir, virar o maço, dobrar e montar.</p>

  <h2>Impressão fácil — edição completa</h2>
  <ol>
    <li>Imprima <code>00-edicao-completa-frentes.pdf</code> (A4, paisagem, escala 100% / print-scaling none). São 18 folhas.</li>
    <li>Retire o maço <strong>sem embaralhar</strong>, vire o maço da esquerda para a direita (como virar a página de um livro) e recoloque na bandeja.</li>
    <li>Imprima <code>00-edicao-completa-versos.pdf</code> com as mesmas opções (18 folhas).</li>
    <li>Dobre cada folha no meio e empilhe os livretos na ordem da tabela abaixo.</li>
    <li><code>00-edicao-completa.pdf</code> tem todas as faces em sequência (útil para conferência ou impressão duplex).</li>
  </ol>

  <h2>Ordem dos livretos</h2>
  <table>
    <thead><tr><th class="num">#</th><th>Arquivo</th><th>Recorte</th><th class="num">Páginas</th><th class="num">Folhas</th></tr></thead>
    <tbody>
${rows}
    </tbody>
  </table>

  <h2>Se quiser imprimir um livreto só</h2>
  <ul class="files">
    <li><code>&lt;slug&gt;-frentes.pdf</code> → imprime; vira o maço; <code>&lt;slug&gt;-versos.pdf</code> → imprime; dobra.</li>
    <li>Páginas em branco no fim de um livreto são o enchimento técnico da dobra (não é erro).</li>
  </ul>
</div></body></html>`
}

const writeGuidePdf = async (page, manifest) => {
  await printPdf(
    page,
    renderGuideHtml(manifest),
    `${OUT_DIR}/00-guia-de-impressao.pdf`,
    'Guia de impressão',
  )
}

const buildReadme = (manifest) => {
  const rows = manifest
    .map(
      (entry) =>
        `${entry.slug.padEnd(30)} ${entry.label.padEnd(42)} ${String(entry.pages).padStart(2)} pág.  ${entry.sheets} folha(s)`,
    )
    .join('\n')
  return `LIVRETOS — Briefing Geral de Militância (Jorge Solla 1313) — edição 1 folha

Cada arquivo <slug>.pdf é um livreto A5 completo em A4 paisagem, 2 páginas por lado,
na ordem de dobra (saddle stitch): junte as folhas do livreto, dobre no meio e pronto.
Nesta edição cada recorte cabe em 1 folha (4 páginas); a pesca mínima é o compilado
de 2 folhas (8 páginas) com princípios, defesas, trabalho e propostas de cada recorte.

IMPRESSÃO FÁCIL — EDIÇÃO COMPLETA (todos os livretos num documento só):
1) imprima 00-edicao-completa-frentes.pdf (A4, paisagem, escala 100%/print-scaling none);
2) retire o maço SEM embaralhar, vire o maço da esquerda para a direita (como virar
   a página de um livro) e recoloque na bandeja;
3) imprima 00-edicao-completa-versos.pdf com as mesmas opções;
4) dobre cada folha no meio e empilhe os livretos na ordem da lista abaixo.
00-edicao-completa.pdf tem todas as faces em sequência (conferência ou duplex).
00-guia-de-impressao.pdf é este guia numa página A4 para deixar junto do maço.

IMPRESSORA: HP DeskJet 2800 (sem duplex automático). Para imprimir um livreto só,
use <slug>-frentes.pdf e <slug>-versos.pdf com os mesmos passos.

Páginas em branco no fim de cada livreto são o enchimento técnico da dobra (não é erro).

ORDEM DOS LIVRETOS:
${rows}
`
}

const run = async () => {
  const args = new Map(
    process.argv
      .slice(2)
      .filter((argument) => argument.startsWith('--'))
      .map((argument) => argument.replace(/^--/, '').split('=')),
  )
  const only = args.get('only')
  const skipPesca = args.has('skip-pesca')
  const onlyPesca = args.has('only-pesca')

  const all = []
  for (const entry of RECORTES) {
    if (only && entry.slug !== only) continue
    all.push(await loadRecorte(entry))
  }
  if (all.length === 0) die(`--only=${only} não corresponde a nenhum recorte.`)
  const proposals = await loadProposals(all)

  await mkdir(resolve(ROOT, OUT_DIR), { recursive: true })
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const manifest = []
  const booklets = []
  try {
    for (const recorte of onlyPesca ? [] : all) {
      const fitted = await fitRecorte(page, recorte)
      const contentSheets = fitted.pages.map((pageUnits, pageIndex) =>
        renderSheet({
          pageIndex,
          pageCount: 4,
          units: pageUnits.map((unitIndex) => fitted.units[unitIndex]),
          title: `Recorte · ${recorte.label}`,
          basePt: fitted.basePt,
        }),
      )
      while (contentSheets.length < 4) contentSheets.push(blankSheet())
      const sheets = contentSheets
      const base = `${recorte.num}-${recorte.slug}`
      const record = await writeOutputs(page, {
        base,
        sheets,
        pages: sheets.length,
        description: recorte.label,
      })
      manifest.push(toManifestEntry(record))
      booklets.push(record)
      const shedTotal = fitted.shed.qa + fitted.shed.defenses + fitted.shed.intro
      console.log(
        `[${LABEL}] ${base}: conteúdo=${fitted.packedPages}/4 páginas · corpo=${fitted.basePt}pt · defesas=${fitted.content.defenses.length} ` +
          `essencial=${fitted.content.essential.length} qa=${fitted.content.qa.length} intro=${fitted.content.intro.length} ` +
          `podados=${shedTotal}`,
      )
    }
    if (!skipPesca && !only) {
      const recortes = all.map((recorte) => ({ ...recorte }))
      const fitted = await fitPesca(page, recortes, proposals)
      const sheets = renderPescaSheets(fitted.blocks, fitted.basePt)
      const record = await writeOutputs(page, {
        base: '00-pesca-minima',
        sheets,
        pages: sheets.length,
        description: 'Pesca mínima — o essencial de cada recorte',
      })
      manifest.push(toManifestEntry(record))
      booklets.push(record)
      console.log(`[${LABEL}] 00-pesca-minima: ${sheets.length} páginas · corpo=${fitted.basePt}pt`)
      if (fitted.shed.length > 0) {
        console.log(
          `[${LABEL}] pesca mínima podou: ${fitted.shed.map(([slug, count]) => `${slug}×${count}`).join(', ')}`,
        )
      }
    }

    // Manifest acumulado: um run parcial (--only/--only-pesca) preserva as entradas
    // já publicadas e substitui só o que foi reconstruído.
    const manifestPath = resolve(ROOT, OUT_DIR, 'livretos.json')
    let previous = []
    try {
      previous = JSON.parse(await readFile(manifestPath, 'utf8'))
    } catch {
      previous = []
    }
    const rebuilt = new Map(manifest.map((entry) => [entry.slug, entry]))
    const merged = previous.map((entry) => rebuilt.get(entry.slug) ?? entry)
    for (const entry of manifest) {
      if (!previous.some((old) => old.slug === entry.slug)) merged.push(entry)
    }

    // A edição completa só existe com todos os livretos do run: um run parcial
    // não sobrescreve os PDFs combinados.
    if (!only && !onlyPesca && merged.length > 0) {
      const ordered = merged
        .map((entry) => booklets.find((booklet) => booklet.slug === entry.slug))
        .filter(Boolean)
      await writeEditionOutputs(page, ordered)
      await writeGuidePdf(page, merged)
      console.log(
        `[${LABEL}] edição completa e guia → 00-edicao-completa*.pdf (${ordered.reduce((total, booklet) => total + booklet.sheets, 0)} folhas) e 00-guia-de-impressao.pdf`,
      )
    }

    await writeFile(manifestPath, `${JSON.stringify(merged, null, 2)}\n`)
    await writeFile(resolve(ROOT, OUT_DIR, 'LEIA-ME.txt'), buildReadme(merged))
    console.log(`[${LABEL}] manifesto e LEIA-ME → ${OUT_DIR}/`)
  } finally {
    await page.close()
    await browser.close()
  }
}

await run()
