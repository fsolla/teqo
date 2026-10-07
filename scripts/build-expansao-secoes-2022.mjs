/**
 * Análise de expansão por seção eleitoral — Jorge Solla 1313 (dep. federal) e
 * Julio Pinheiro 13999 (dep. estadual), eleição 2022, 1º turno, Bahia.
 *
 * Pergunta de campanha (reta final 2026): onde há eleitor que votou Lula
 * (presidente) e Jerônimo (governador) em 2022 e não escolheu deputado
 * federal / estadual — e como isso cruza com as seções onde Solla e o campo PT
 * são mais fortes. A unidade é a seção eleitoral (menor unidade publicada
 * pelo TSE), agregada por município, zonas de Salvador, bairro do local de
 * votação, Região Metropolitana de Salvador (RMS) e Território de Identidade.
 *
 * Métrica central — "sobra do bloco Lula+Jerônimo" para um cargo:
 *   bloco(s) = min(votos Lula, votos Jerônimo)          (tamanho conservador
 *   do eleitorado que compareceu e escolheu o dois nomes)
 *   sobra(s, cargo) = max(0, bloco(s) - votos válidos do cargo em s)
 * Ou seja: quantos votos válidos aquele cargo teve a menos do que o bloco
 * presente na seção. É um TETO de transferência, não uma medida de intenção:
 * ninguém observa quem votou em quem — a leitura é de potencial.
 *
 * Pergunta literal ("votou Lula e Jerônimo mas não votou para o cargo"):
 *   piso(s) = max(0, Lula + Jerônimo - comparecimento do cargo - válidos do cargo)
 *   teto(s) = min(min(Lula, Jerônimo), brancos+nulos do cargo)
 * Somados por seção (nunca agregando antes de cortar), dão o intervalo do
 * estado que se pode afirmar sem inventar voto individual.
 *
 * Fonte (portal de dados abertos do TSE, resultados 2022):
 *   votacao_secao_2022_BA.zip            votos por candidato por seção (cargos estaduais)
 *   votacao_secao_2022_BR.zip            votos de presidente por seção (escopo BRASIL)
 *   detalhe_votacao_secao_2022.zip       aferição por seção × cargo (nominais, brancos, nulos)
 *   detalhe_votacao_munzona_2022.zip     nominais válidos por zona (fonte do baseline do app)
 *   consulta_cand_2022.zip               situação das candidaturas (INAPTO), calibrada por zona
 *   eleitorado_local_votacao_2022.zip    seção → local → bairro (cadastro 2022)
 * Os arquivos vivem no cache gitignored `data/tse-2022/` (zips + csv/).
 *
 * Uso:
 *   node --import=tsx/esm scripts/build-expansao-secoes-2022.mjs --compute
 *   node --import=tsx/esm scripts/build-expansao-secoes-2022.mjs
 *
 * `--compute` refaz a passagem pesada e grava o JSON de dados; sem a flag o
 * script só renderiza (MD + PDF) a partir do JSON. A leitura é somente-leitura
 * contra os CSVs públicos; nenhum acesso a banco.
 */

import { chromium } from '@playwright/test'
import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'

import { dieWithLabel } from './lib/cli.mjs'

const { bahiaIdentityTerritoryRecords, citiesForTerritory, territoryForCity } =
  await import('../src/lib/bahiaTerritories.ts')
const { bahiaTseCityCodes } = await import('../src/lib/bahiaTseCityCodes.ts')
const { slugify } = await import('../src/lib/slug.ts')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LABEL = 'build-expansao-secoes-2022'
const die = dieWithLabel(LABEL)

const CSV_DIR = join(ROOT, 'data/tse-2022/csv')
const VOTE_BA_CSV = join(CSV_DIR, 'votacao_secao_2022_BA.csv')
const VOTE_BR_CSV = join(CSV_DIR, 'votacao_secao_2022_BR.csv')
const DETAIL_CSV = join(CSV_DIR, 'detalhe_votacao_secao_2022_BA.csv')
const LOCALS_CSV = join(CSV_DIR, 'eleitorado_local_votacao_2022.csv')
const CONSULTA_CSV = join(CSV_DIR, 'consulta_cand_2022_BA.csv')
const MUNZONA_CSV = join(CSV_DIR, 'detalhe_votacao_munzona_2022_BA.csv')
const ARTIFACT_PATH = join(ROOT, 'src/lib/electionAggregates/bahia-federal-baseline.json')
const DATA_PATH = join(ROOT, 'data/tse-2022/expansao-secoes-2022-dados.json')
const ESTRATEGIA_PATH = join(ROOT, 'data/tse-2022/expansao-secoes-2022-estrategia.json')
const REPORT_BASE = join(ROOT, 'docs/research/analise-expansao-secoes-solla-julio-2022')
const HTML_PATH = join(ROOT, 'data/tse-2022/expansao-secoes-2022.html')

const SALVADOR_CODE = '38490'
const CARGOS = { GOVERNADOR: '3', FEDERAL: '6', ESTADUAL: '7' }
const NUMBERS = { LULA: 13, JERONIMO: 13, SOLLA: 1313, JULIO: 13999 }
const METROPOLITANO = 'Metropolitano de Salvador'
const GENERATED_AT = process.env.EXPANSAO_GENERATED_AT ?? new Date().toISOString()
const DATE_LABEL = GENERATED_AT.slice(0, 10).split('-').reverse().join('/')

const int = new Intl.NumberFormat('pt-BR')
const nf = (value) => int.format(Math.round(value))
const dec = (value, digits = 1) => value.toFixed(digits).replace('.', ',')
const pct = (value, digits = 1) => (Number.isFinite(value) ? `${dec(value * 100, digits)}%` : '—')
const share = (part, total) => (total > 0 ? part / total : null)
const clamp0 = (value) => (value > 0 ? value : 0)

// ---------------------------------------------------------------------------
// CSV streaming (TSE: ISO-8859-1, `;`, todos os campos entre aspas)
// ---------------------------------------------------------------------------

const parseCsvLine = (line) => {
  const fields = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ';') {
      fields.push(current)
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current)
  return fields
}

async function* csvRows(path, filter) {
  const stream = createReadStream(path, { encoding: 'latin1' })
  const lines = createInterface({ input: stream, crlfDelay: Infinity })
  let header = null
  for await (const line of lines) {
    if (!header) {
      header = parseCsvLine(line)
      continue
    }
    if (!line || (filter && !filter(line))) continue
    const fields = parseCsvLine(line)
    const row = {}
    header.forEach((name, index) => {
      row[name] = fields[index] ?? ''
    })
    yield row
  }
}

const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

// ---------------------------------------------------------------------------
// Geografia
// ---------------------------------------------------------------------------

const cityByTseCode = new Map(
  Object.entries(bahiaTseCityCodes).map(([city, code]) => [String(code), city]),
)
const rmsCities = new Set(citiesForTerritory(METROPOLITANO).filter((city) => city !== 'Salvador'))
const territoryOrder = bahiaIdentityTerritoryRecords.map(({ name }) => name)

// ---------------------------------------------------------------------------
// Compute
// ---------------------------------------------------------------------------

const blankSection = (cityCode, cityName, zone, section) => ({
  cityCode,
  cityName,
  zone,
  section,
  bairro: null,
  local: null,
  aptos: 0,
  fed: { comp: 0, nom: 0, leg: 0, branco: 0, nulo: 0, inactive: 0, inactiveRaw: 0 },
  est: { comp: 0, nom: 0, leg: 0, branco: 0, nulo: 0, inactive: 0, inactiveRaw: 0 },
  lula: 0,
  jeronimo: 0,
  presBranco: 0,
  presNulo: 0,
  solla: 0,
  julio: 0,
  ptEst: 0,
  ptFed: 0,
})

const sectionKey = (cityCode, zone, section) => `${cityCode}|${Number(zone)}|${Number(section)}`

async function loadSections() {
  const sections = new Map()
  for await (const row of csvRows(DETAIL_CSV)) {
    if (row.NR_TURNO !== '1') continue
    const cargo = row.CD_CARGO
    if (cargo !== CARGOS.FEDERAL && cargo !== CARGOS.ESTADUAL) continue
    const key = sectionKey(row.CD_MUNICIPIO, row.NR_ZONA, row.NR_SECAO)
    let section = sections.get(key)
    if (!section) {
      section = blankSection(
        row.CD_MUNICIPIO,
        row.NM_MUNICIPIO,
        num(row.NR_ZONA),
        num(row.NR_SECAO),
      )
      sections.set(key, section)
    }
    const tally = {
      comp: num(row.QT_COMPARECIMENTO),
      nom: num(row.QT_VOTOS_NOMINAIS),
      leg: num(row.QT_VOTOS_LEGENDA),
      branco: num(row.QT_VOTOS_BRANCOS),
      nulo: num(row.QT_VOTOS_NULOS),
      inactive: 0,
      inactiveRaw: 0,
    }
    if (cargo === CARGOS.FEDERAL) {
      section.fed = tally
      section.aptos = num(row.QT_APTOS)
    } else {
      section.est = tally
    }
  }
  return sections
}

/** O arquivo BA mistura campos citados e não citados; aceita as duas formas. */
const fieldHas = (line, value) => line.includes(`;${value};`) || line.includes(`;"${value}";`)

/**
 * Linhas de voto nominal (números de 4 e 5 dígitos) mais a do governador 13
 * (2 dígitos, desambiguada pelo nome). O filtro é só pré-seleção barata: a
 * classificação fina acontece no parse, por cargo e número.
 */
const CANDIDATE_NUMBER_PATTERN = /;[1-9]\d{3,4};/
const BA_VOTE_FILTER = (line) =>
  CANDIDATE_NUMBER_PATTERN.test(line) || (fieldHas(line, '13') && line.includes('JER'))

/** Candidaturas INAPTO no cadastro de 2022 — votos não entram nos nominais válidos. */
async function loadInactiveCandidates() {
  const inactive = { federal: new Set(), state: new Set() }
  for await (const row of csvRows(CONSULTA_CSV)) {
    if (row.DS_SITUACAO_CANDIDATURA !== 'INAPTO') continue
    if (row.CD_CARGO === CARGOS.FEDERAL) inactive.federal.add(num(row.NR_CANDIDATO))
    if (row.CD_CARGO === CARGOS.ESTADUAL) inactive.state.add(num(row.NR_CANDIDATO))
  }
  return inactive
}

async function loadBaVotes(sections, inactive) {
  const seen = { jeronimo: new Set(), solla: new Set(), julio: new Set() }
  let matched = 0
  let ptRows = 0
  let ptFedRows = 0
  let inactiveRows = 0
  for await (const row of csvRows(VOTE_BA_CSV, BA_VOTE_FILTER)) {
    if (row.NR_TURNO !== '1') continue
    const key = sectionKey(row.CD_MUNICIPIO, row.NR_ZONA, row.NR_SECAO)
    const section = sections.get(key)
    if (!section) continue
    const number = num(row.NR_VOTAVEL)
    const votes = num(row.QT_VOTOS)
    if (row.CD_CARGO === CARGOS.GOVERNADOR && number === NUMBERS.JERONIMO) {
      section.jeronimo += votes
      seen.jeronimo.add(row.NM_VOTAVEL.trim())
      matched += 1
    } else if (row.CD_CARGO === CARGOS.FEDERAL && number === NUMBERS.SOLLA) {
      section.solla += votes
      seen.solla.add(row.NM_VOTAVEL.trim())
      matched += 1
    } else if (row.CD_CARGO === CARGOS.FEDERAL && number >= 1000 && inactive.federal.has(number)) {
      section.fed.inactiveRaw += votes
      section.fed.inactive += votes
      inactiveRows += 1
    } else if (row.CD_CARGO === CARGOS.FEDERAL && number >= 1300 && number <= 1399) {
      // Campo PT federal: todo candidato 13xx (inclui Solla 1313).
      section.ptFed += votes
      ptFedRows += 1
    } else if (row.CD_CARGO === CARGOS.ESTADUAL) {
      if (number === NUMBERS.JULIO) {
        section.julio += votes
        seen.julio.add(row.NM_VOTAVEL.trim())
        matched += 1
      } else if (inactive.state.has(number)) {
        section.est.inactiveRaw += votes
        section.est.inactive += votes
        inactiveRows += 1
      } else if (number >= 13000 && number <= 13999) {
        // Campo PT estadual: todo candidato 13xxx (o partido 13 é o prefixo do número).
        section.ptEst += votes
        ptRows += 1
      }
    }
  }
  return {
    matched,
    ptRows,
    ptFedRows,
    inactiveRows,
    seen: Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, [...v]])),
  }
}

async function loadPresidentVotes(sections) {
  const names = new Set()
  let matched = 0
  let blankNull = 0
  for await (const row of csvRows(
    VOTE_BR_CSV,
    (line) =>
      line.includes('"BA"') &&
      (line.includes('"13"') || line.includes(';"95";') || line.includes(';"96";')),
  )) {
    // BRASIL vem todo citado; o mesmo filtro amplo do BA não é necessário.
    if (row.SG_UF !== 'BA' || row.NR_TURNO !== '1' || row.CD_CARGO !== '1') continue
    const key = sectionKey(row.CD_MUNICIPIO, row.NR_ZONA, row.NR_SECAO)
    const section = sections.get(key)
    if (!section) continue
    const number = num(row.NR_VOTAVEL)
    const votes = num(row.QT_VOTOS)
    if (number === NUMBERS.LULA) {
      section.lula += votes
      names.add(row.NM_VOTAVEL.trim())
      matched += 1
    } else if (number === 95) {
      section.presBranco += votes
      blankNull += votes
    } else if (number === 96) {
      section.presNulo += votes
      blankNull += votes
    }
  }
  return { matched, blankNull, names: [...names] }
}

async function loadSalvadorBairros(sections) {
  const bySection = new Map()
  for await (const row of csvRows(LOCALS_CSV, (line) => line.includes('"38490"'))) {
    if (row.SG_UF !== 'BA' || row.CD_MUNICIPIO !== SALVADOR_CODE) continue
    const key = sectionKey(row.CD_MUNICIPIO, row.NR_ZONA, row.NR_SECAO)
    if (bySection.has(key)) continue
    bySection.set(key, {
      bairro: row.NM_BAIRRO.trim(),
      local: row.NM_LOCAL_VOTACAO.trim(),
    })
  }
  let attached = 0
  for (const [key, section] of sections) {
    if (section.cityCode !== SALVADOR_CODE) continue
    const hit = bySection.get(key)
    if (!hit) continue
    section.bairro = hit.bairro
    section.local = hit.local
    attached += 1
  }
  return { registry: bySection.size, attached }
}

/** Nominais válidos por zona no detalhe munzona — a mesma conta do baseline do app. */
async function loadValidNominalByZone() {
  const targets = new Map()
  for await (const row of csvRows(MUNZONA_CSV)) {
    if (row.NR_TURNO !== '1') continue
    if (row.CD_CARGO !== CARGOS.FEDERAL && row.CD_CARGO !== CARGOS.ESTADUAL) continue
    const key = `${row.CD_MUNICIPIO}|${Number(row.NR_ZONA)}`
    const entry = targets.get(key) ?? { fed: null, est: null }
    const value = num(row.QT_VOTOS_NOMINAIS_VALIDOS)
    if (row.CD_CARGO === CARGOS.FEDERAL) entry.fed = (entry.fed ?? 0) + value
    else entry.est = (entry.est ?? 0) + value
    targets.set(key, entry)
  }
  return targets
}

/**
 * Calibra o desconto de votos INAPTO por seção para que cada zona feche
 * exatamente com o detalhe munzona (a fonte do baseline). O cadastro atual de
 * candidaturas não reproduz o status de totalização de 2022 — a escala por
 * zona corrige a diferença preservando a distribuição das seções.
 */
function calibrateInactiveVotes(sections, validByZone) {
  const zones = new Map()
  for (const section of sections.values()) {
    const key = `${section.cityCode}|${section.zone}`
    const list = zones.get(key) ?? []
    list.push(section)
    zones.set(key, list)
  }
  let adjusted = 0
  let missingTarget = 0
  for (const [key, list] of zones) {
    const target = validByZone.get(key)
    if (!target) {
      missingTarget += 1
      continue
    }
    for (const slot of ['fed', 'est']) {
      const targetValue = target[slot]
      if (targetValue === null || targetValue === undefined) continue
      const sumNom = list.reduce((sum, section) => sum + section[slot].nom, 0)
      const sumRaw = list.reduce((sum, section) => sum + section[slot].inactiveRaw, 0)
      const invalidTarget = Math.max(0, sumNom - targetValue)
      if (sumRaw === invalidTarget) continue
      const scaleBase = sumRaw > 0 ? sumRaw : sumNom
      if (scaleBase === 0) continue
      let assigned = 0
      let biggest = list[0]
      for (const section of list) {
        const base = sumRaw > 0 ? section[slot].inactiveRaw : section[slot].nom
        const value = Math.round((base / scaleBase) * invalidTarget)
        section[slot].inactive = value
        assigned += value
        const biggestBase = sumRaw > 0 ? biggest[slot].inactiveRaw : biggest[slot].nom
        if (base > biggestBase) biggest = section
      }
      const residual = invalidTarget - assigned
      if (residual !== 0) {
        biggest[slot].inactive = Math.max(0, biggest[slot].inactive + residual)
      }
      adjusted += 1
    }
  }
  return { adjusted, missingTarget }
}

// ---------------------------------------------------------------------------
// Agregações
// ---------------------------------------------------------------------------

const blankAgg = (key, label, extra = {}) => ({
  key,
  label,
  sections: 0,
  aptos: 0,
  compFed: 0,
  valFed: 0,
  legFed: 0,
  brancosFed: 0,
  nulosFed: 0,
  compEst: 0,
  valEst: 0,
  legEst: 0,
  brancosEst: 0,
  nulosEst: 0,
  ptEst: 0,
  ptFed: 0,
  lula: 0,
  jeronimo: 0,
  blocoLJ: 0,
  sobraFed: 0,
  sobraEst: 0,
  pisoFed: 0,
  pisoEst: 0,
  tetoFed: 0,
  tetoEst: 0,
  presBrancoNulo: 0,
  excessoFed: 0,
  excessoEst: 0,
  solla: 0,
  julio: 0,
  ...extra,
})

function addSection(agg, section) {
  const bloco = Math.min(section.lula, section.jeronimo)
  const fedValid = Math.max(0, section.fed.nom - section.fed.inactive)
  const estValid = Math.max(0, section.est.nom - section.est.inactive)
  agg.sections += 1
  agg.aptos += section.aptos
  agg.compFed += section.fed.comp
  agg.valFed += fedValid
  agg.legFed += section.fed.leg
  agg.brancosFed += section.fed.branco
  agg.nulosFed += section.fed.nulo
  agg.compEst += section.est.comp
  agg.valEst += estValid
  agg.legEst += section.est.leg
  agg.brancosEst += section.est.branco
  agg.nulosEst += section.est.nulo
  agg.lula += section.lula
  agg.jeronimo += section.jeronimo
  agg.blocoLJ += bloco
  agg.sobraFed += clamp0(bloco - fedValid)
  agg.sobraEst += clamp0(bloco - estValid)
  agg.pisoFed += clamp0(
    section.lula + section.jeronimo - section.fed.comp - fedValid - section.fed.leg,
  )
  agg.pisoEst += clamp0(
    section.lula + section.jeronimo - section.est.comp - estValid - section.est.leg,
  )
  agg.tetoFed += Math.min(bloco, section.fed.branco + section.fed.nulo)
  agg.tetoEst += Math.min(bloco, section.est.branco + section.est.nulo)
  agg.presBrancoNulo += section.presBranco + section.presNulo
  agg.excessoFed += clamp0(
    section.fed.branco + section.fed.nulo - section.presBranco - section.presNulo,
  )
  agg.excessoEst += clamp0(
    section.est.branco + section.est.nulo - section.presBranco - section.presNulo,
  )
  agg.solla += section.solla
  agg.julio += section.julio
  agg.ptEst += section.ptEst
  agg.ptFed += section.ptFed
}

function finishAgg(agg, reference = null) {
  agg.sollaShare = share(agg.solla, agg.valFed)
  agg.ptEstShare = share(agg.ptEst, agg.valEst)
  agg.ptFedShare = share(agg.ptFed, agg.valFed)
  agg.leftShare = share(agg.blocoLJ, agg.compFed)
  agg.lulaShare = share(agg.lula, agg.compFed)
  agg.jeronimoShare = share(agg.jeronimo, agg.compEst || agg.compFed)
  agg.sobraFedShare = share(agg.sobraFed, agg.blocoLJ)
  agg.sobraEstShare = share(agg.sobraEst, agg.blocoLJ)
  agg.brancoNuloFed = agg.brancosFed + agg.nulosFed
  agg.brancoNuloEst = agg.brancosEst + agg.nulosEst
  agg.brancoNuloShareFed = share(agg.brancoNuloFed, agg.compFed)
  agg.brancoNuloShareEst = share(agg.brancoNuloEst, agg.compEst || agg.compFed)
  agg.excessoShareFed = share(agg.excessoFed, agg.compFed)
  agg.excessoShareEst = share(agg.excessoEst, agg.compEst || agg.compFed)
  if (reference) {
    agg.lqSolla = agg.sollaShare / reference.sollaShare
    agg.lqPt = agg.ptEstShare / reference.ptEstShare
    agg.lqPtFed = agg.ptFedShare / reference.ptFedShare
    agg.lqLeft = agg.leftShare / reference.leftShare
  }
  return agg
}

const sectionMetrics = (section) => {
  const bloco = Math.min(section.lula, section.jeronimo)
  const fedValid = Math.max(0, section.fed.nom - section.fed.inactive)
  const estValid = Math.max(0, section.est.nom - section.est.inactive)
  const brancoNuloFed = section.fed.branco + section.fed.nulo
  const brancoNuloEst = section.est.branco + section.est.nulo
  return {
    key: sectionKey(section.cityCode, section.zone, section.section),
    city: cityByTseCode.get(String(section.cityCode)) ?? section.cityName,
    cityCode: section.cityCode,
    zone: section.zone,
    section: section.section,
    bairro: section.bairro,
    local: section.local,
    compFed: section.fed.comp,
    valFed: fedValid,
    valEst: estValid,
    lula: section.lula,
    jeronimo: section.jeronimo,
    blocoLJ: bloco,
    sobraFed: clamp0(bloco - fedValid),
    sobraEst: clamp0(bloco - estValid),
    pisoFed: clamp0(
      section.lula + section.jeronimo - section.fed.comp - fedValid - section.fed.leg,
    ),
    pisoEst: clamp0(
      section.lula + section.jeronimo - section.est.comp - estValid - section.est.leg,
    ),
    tetoFed: Math.min(bloco, brancoNuloFed),
    tetoEst: Math.min(bloco, brancoNuloEst),
    brancoNuloFed,
    brancoNuloEst,
    presBrancoNulo: section.presBranco + section.presNulo,
    excessoFed: clamp0(brancoNuloFed - section.presBranco - section.presNulo),
    excessoEst: clamp0(brancoNuloEst - section.presBranco - section.presNulo),
    solla: section.solla,
    ptEst: section.ptEst,
    ptFed: section.ptFed,
    sollaShare: share(section.solla, fedValid),
    ptEstShare: share(section.ptEst, estValid),
    ptFedShare: share(section.ptFed, fedValid),
    leftShare: share(bloco, section.fed.comp),
  }
}

const percentile = (sorted, q) =>
  sorted.length === 0 ? 0 : sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]

const sortBy = (list, field) => [...list].sort((left, right) => right[field] - left[field])

const pickSection = (metric) => ({
  city: metric.city,
  zone: metric.zone,
  section: metric.section,
  bairro: metric.bairro,
  local: metric.local,
  compFed: metric.compFed,
  lula: metric.lula,
  jeronimo: metric.jeronimo,
  blocoLJ: metric.blocoLJ,
  valFed: metric.valFed,
  sobraFed: metric.sobraFed,
  valEst: metric.valEst,
  sobraEst: metric.sobraEst,
  pisoFed: metric.pisoFed,
  pisoEst: metric.pisoEst,
  tetoFed: metric.tetoFed,
  tetoEst: metric.tetoEst,
  brancoNuloFed: metric.brancoNuloFed,
  brancoNuloEst: metric.brancoNuloEst,
  presBrancoNulo: metric.presBrancoNulo,
  excessoFed: metric.excessoFed,
  excessoEst: metric.excessoEst,
  solla: metric.solla,
  ptEst: metric.ptEst,
  ptFed: metric.ptFed,
  sollaShare: metric.sollaShare,
  ptEstShare: metric.ptEstShare,
  ptFedShare: metric.ptFedShare,
  leftShare: metric.leftShare,
  lqSolla: metric.lqSolla ?? null,
  lqPt: metric.lqPt ?? null,
  lqPtFed: metric.lqPtFed ?? null,
  lqLeft: metric.lqLeft ?? null,
})

function buildSectionLists(metrics, reference) {
  const withLq = metrics.map((metric) => ({
    ...metric,
    lqSolla: metric.valFed > 0 ? metric.sollaShare / reference.sollaShare : null,
    lqPt: metric.valEst > 0 ? metric.ptEstShare / reference.ptEstShare : null,
    lqPtFed: metric.valFed > 0 ? metric.ptFedShare / reference.ptFedShare : null,
    lqLeft: metric.compFed > 0 ? metric.leftShare / reference.leftShare : null,
  }))
  const qualified = withLq.filter((metric) => metric.compFed >= 200 && metric.valFed >= 120)
  const tetoFedSorted = qualified.map((metric) => metric.tetoFed).sort((a, b) => a - b)
  const tetoEstSorted = qualified.map((metric) => metric.tetoEst).sort((a, b) => a - b)
  const excessoFedSorted = qualified.map((metric) => metric.excessoFed).sort((a, b) => a - b)
  const p75Fed = percentile(tetoFedSorted, 0.75)
  const p90Fed = percentile(tetoFedSorted, 0.9)
  const p75Est = percentile(tetoEstSorted, 0.75)
  const p90Est = percentile(tetoEstSorted, 0.9)
  const p75ExcessoFed = percentile(excessoFedSorted, 0.75)
  const bnFedSorted = qualified.map((metric) => metric.brancoNuloFed).sort((a, b) => a - b)
  const bnEstSorted = qualified.map((metric) => metric.brancoNuloEst).sort((a, b) => a - b)
  const p75BnFed = percentile(bnFedSorted, 0.75)
  const p75BnEst = percentile(bnEstSorted, 0.75)
  const strong = (lq) => lq !== null && lq >= 1.5
  const weak = (lq) => lq !== null && lq <= 0.5

  const cross = {
    thresholds: {
      p75Fed,
      p90Fed,
      p75Est,
      p90Est,
      p75ExcessoFed,
      p75BnFed,
      p75BnEst,
      qualified: qualified.length,
    },
    // Análise simples: esquerda relativamente forte na seção e cargo em branco/nulo.
    leftFed: sortBy(
      qualified.filter((metric) => metric.lqLeft >= 1.25 && metric.brancoNuloFed >= p75BnFed),
      'brancoNuloFed',
    ),
    leftEst: sortBy(
      qualified.filter((metric) => metric.lqLeft >= 1.25 && metric.brancoNuloEst >= p75BnEst),
      'brancoNuloEst',
    ),
    fedDefesa: sortBy(
      qualified.filter((metric) => strong(metric.lqSolla) && metric.tetoFed >= p75Fed),
      'tetoFed',
    ),
    fedAtaque: sortBy(
      qualified.filter(
        (metric) => weak(metric.lqSolla) && metric.tetoFed >= p90Fed && metric.valFed >= 300,
      ),
      'tetoFed',
    ),
    estDefesa: sortBy(
      qualified.filter((metric) => strong(metric.lqPt) && metric.tetoEst >= p75Est),
      'tetoEst',
    ),
    estAtaque: sortBy(
      qualified.filter(
        (metric) => weak(metric.lqPt) && metric.tetoEst >= p90Est && metric.valEst >= 300,
      ),
      'tetoEst',
    ),
    // Onde o cargo foi abandonado MUITO acima do normal daquela seção na presidencial.
    excessoFed: sortBy(
      qualified.filter((metric) => metric.excessoFed >= p75ExcessoFed && metric.excessoFed >= 50),
      'excessoFed',
    ),
    dobradinha: sortBy(
      qualified.filter((metric) => metric.tetoFed >= p75Fed && metric.tetoEst >= p75Est),
      'tetoFed',
    ),
  }

  return {
    topBnFed: sortBy(qualified, 'brancoNuloFed'),
    topBnEst: sortBy(qualified, 'brancoNuloEst'),
    topTetoFed: sortBy(qualified, 'tetoFed'),
    topTetoEst: sortBy(qualified, 'tetoEst'),
    topSolla: sortBy(qualified, 'solla'),
    cross,
  }
}

function summarizeSections(metrics) {
  const sectionCount = metrics.length
  const sum = (field) => metrics.reduce((total, metric) => total + metric[field], 0)
  return {
    sections: sectionCount,
    sobraFed: sum('sobraFed'),
    sobraEst: sum('sobraEst'),
    pisoFed: sum('pisoFed'),
    pisoEst: sum('pisoEst'),
    tetoFed: sum('tetoFed'),
    tetoEst: sum('tetoEst'),
    brancoNuloFed: sum('brancoNuloFed'),
    brancoNuloEst: sum('brancoNuloEst'),
    excessoFed: sum('excessoFed'),
    excessoEst: sum('excessoEst'),
    presBrancoNulo: sum('presBrancoNulo'),
    blocoLJ: sum('blocoLJ'),
  }
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

async function compute() {
  console.log(`[${LABEL}] lendo aferição por seção...`)
  const sections = await loadSections()
  console.log(`[${LABEL}] seções: ${sections.size}`)
  const inactive = await loadInactiveCandidates()
  const {
    matched: baMatched,
    ptRows,
    ptFedRows,
    inactiveRows,
    seen,
  } = await loadBaVotes(sections, inactive)
  const { matched: brMatched, names } = await loadPresidentVotes(sections)
  const bairros = await loadSalvadorBairros(sections)
  const validByZone = await loadValidNominalByZone()
  const calibrated = calibrateInactiveVotes(sections, validByZone)
  console.log(
    `[${LABEL}] votos casados: BA=${baMatched} PT-fed=${ptFedRows} PT-est=${ptRows} INAPTO=${inactiveRows} BR=${brMatched}; ` +
      `candidaturas INAPTO=${inactive.federal.size}+${inactive.state.size}; ` +
      `calibração por zona ajustes=${calibrated.adjusted} sem fonte=${calibrated.missingTarget}; ` +
      `bairros Salvador=${bairros.attached}/${bairros.registry}`,
  )
  console.log(`[${LABEL}] nomes na urna:`, JSON.stringify({ ...seen, lula: names }))

  const missingTallies = [...sections.values()].filter(
    (section) => section.fed.comp === 0 && section.est.comp === 0,
  )
  if (missingTallies.length > 0) {
    die(
      `${missingTallies.length} seções sem aferição de comparecimento (chave ${missingTallies[0].cityCode}|${missingTallies[0].zone}|${missingTallies[0].section})`,
    )
  }

  const byCity = new Map()
  const byTerritory = new Map()
  const salvadorZones = new Map()
  const salvadorBairros = new Map()
  const bySlug = new Map()
  let unmappedCity = 0

  for (const section of sections.values()) {
    const canonicalCity = cityByTseCode.get(String(section.cityCode)) ?? null
    const territory = canonicalCity ? (territoryForCity(canonicalCity) ?? null) : null
    if (!canonicalCity || !territory) unmappedCity += 1

    const cityKey = canonicalCity ?? String(section.cityCode)
    const cityAgg =
      byCity.get(cityKey) ?? blankAgg(cityKey, cityKey, { tseCode: section.cityCode, territory })
    byCity.set(cityKey, cityAgg)
    addSection(cityAgg, section)

    if (territory) {
      const territoryAgg = byTerritory.get(territory) ?? blankAgg(territory, territory)
      byTerritory.set(territory, territoryAgg)
      addSection(territoryAgg, section)
    }

    if (section.cityCode === SALVADOR_CODE) {
      const zoneAgg =
        salvadorZones.get(section.zone) ??
        blankAgg(String(section.zone), `ZE ${section.zone}`, { zone: section.zone })
      salvadorZones.set(section.zone, zoneAgg)
      addSection(zoneAgg, section)
      if (section.bairro) {
        const bairroKey = section.bairro
        const bairroAgg = salvadorBairros.get(bairroKey) ?? blankAgg(bairroKey, bairroKey)
        salvadorBairros.set(bairroKey, bairroAgg)
        addSection(bairroAgg, section)
      }
    }

    if (canonicalCity === 'Salvador') {
      const slug = `salvador-ze-${section.zone}`
      const slugAgg =
        bySlug.get(slug) ?? blankAgg(slug, slug, { city: canonicalCity, zone: section.zone })
      bySlug.set(slug, slugAgg)
      addSection(slugAgg, section)
    } else if (canonicalCity) {
      const slug = slugify(canonicalCity)
      const slugAgg = bySlug.get(slug) ?? blankAgg(slug, slug, { city: canonicalCity })
      bySlug.set(slug, slugAgg)
      addSection(slugAgg, section)
    }
  }
  if (unmappedCity > 0) die(`${unmappedCity} seções com município fora do cadastro canônico`)

  const baTotals = finishAgg(blankAgg('bahia', 'Bahia'))
  for (const section of sections.values()) addSection(baTotals, section)
  finishAgg(baTotals)

  for (const agg of byCity.values()) finishAgg(agg, baTotals)
  for (const agg of byTerritory.values()) finishAgg(agg, baTotals)
  for (const agg of salvadorZones.values()) finishAgg(agg, baTotals)
  for (const agg of salvadorBairros.values()) finishAgg(agg, baTotals)
  for (const agg of bySlug.values()) finishAgg(agg, baTotals)

  const metricsAll = [...sections.values()].map(sectionMetrics)
  const metricsSalvador = metricsAll.filter((metric) => metric.cityCode === SALVADOR_CODE)
  const metricsRms = metricsAll.filter(
    (metric) => metric.city !== 'Salvador' && rmsCities.has(metric.city),
  )
  const metricsByTerritory = new Map()
  for (const metric of metricsAll) {
    const territory = territoryForCity(metric.city)
    if (!territory) continue
    const list = metricsByTerritory.get(territory) ?? []
    list.push(metric)
    metricsByTerritory.set(territory, list)
  }

  const rmsAgg = finishAgg(blankAgg('rms', 'Demais municípios da RMS'))
  for (const metric of metricsRms) {
    const section = sections.get(metric.key)
    addSection(rmsAgg, section)
  }
  finishAgg(rmsAgg, baTotals)

  const salvadorTotals = finishAgg(blankAgg('salvador', 'Salvador'))
  for (const metric of metricsSalvador) addSection(salvadorTotals, sections.get(metric.key))
  finishAgg(salvadorTotals, baTotals)

  const sectionListsBa = buildSectionLists(metricsAll, baTotals)
  const sectionListsSalvador = buildSectionLists(metricsSalvador, baTotals)
  const sectionListsRms = buildSectionLists(metricsRms, baTotals)

  const territories = territoryOrder.map((name) => {
    const agg = finishAgg(byTerritory.get(name) ?? blankAgg(name, name), baTotals)
    const metrics = metricsByTerritory.get(name) ?? []
    const lists = buildSectionLists(metrics, baTotals)
    const cities = [...byCity.values()]
      .filter((city) => city.territory === name)
      .sort((left, right) => right.tetoFed - left.tetoFed)
    return {
      name,
      agg,
      metrics: summarizeSections(metrics),
      topTetoFed: lists.topTetoFed.slice(0, 3),
      topTetoEst: lists.topTetoEst.slice(0, 3),
      topSolla: lists.topSolla.slice(0, 3),
      topCities: cities.slice(0, 5).map((city) => ({
        city: city.label,
        sobraFed: city.sobraFed,
        sobraEst: city.sobraEst,
        solla: city.solla,
        ptEst: city.ptEst,
        lqSolla: city.lqSolla,
        lqPt: city.lqPt,
      })),
      thresholds: lists.cross.thresholds,
    }
  })

  const { municipalities: artifactMunicipalities } = JSON.parse(
    await readFile(ARTIFACT_PATH, 'utf8'),
  )
  const validation = []
  const driftGroups = new Map()
  let drift = 0
  let nominalResidual = 0
  let nominalBaseline = 0
  for (const [slug, committed] of Object.entries(artifactMunicipalities)) {
    const ours = bySlug.get(slug)
    if (!ours) {
      validation.push(`slug ${slug} ausente na apuração por seção`)
      drift += 1
      continue
    }
    const checks = [
      ['Solla 2022', committed.votesByYear['2022'], ours.solla, 0],
      ['Lula T1 2022', committed.majoritarian2022.president.votes, ours.lula, 0],
      ['Jerônimo T1 2022', committed.majoritarian2022.governor.votes, ours.jeronimo, 0],
      // O arquivo por seção inclui votos de candidaturas que o TSE invalidou; o
      // baseline (detalhe munzona) só conta nominais válidos — resíduo tolerado.
      ['nominais federais', committed.federalTallyByYear['2022'].votosValidos, ours.valFed, 0.01],
      [
        'comparecimento federal',
        committed.federalTallyByYear['2022'].comparecimento,
        ours.compFed,
        0,
      ],
      ['brancos federais', committed.federalTallyByYear['2022'].votosBranco, ours.brancosFed, 0],
      ['nulos federais', committed.federalTallyByYear['2022'].votosNulo, ours.nulosFed, 0],
    ]
    for (const [label, expected, found, tolerance] of checks) {
      if (expected === found) continue
      const delta = found - expected
      if (tolerance > 0 && Math.abs(delta) <= Math.max(5, expected * tolerance)) {
        nominalResidual += delta
        nominalBaseline += expected
        continue
      }
      drift += 1
      const group = driftGroups.get(label) ?? { count: 0, examples: [] }
      group.count += 1
      if (group.examples.length < 3) {
        group.examples.push(`${slug}: ${nf(expected)} × ${nf(found)}`)
      }
      driftGroups.set(label, group)
    }
  }
  if (drift > 0) {
    die(
      `divergência contra o baseline em ${drift} conferências — ` +
        [...driftGroups]
          .map(([label, group]) => `${label}: ${group.count} (${group.examples.join('; ')})`)
          .join(' | '),
    )
  }
  validation.push(
    `Solla, Lula, Jerônimo, comparecimento, brancos e nulos conferem exatamente por município/zona contra src/lib/electionAggregates/bahia-federal-baseline.json (${Object.keys(artifactMunicipalities).length} unidades). ` +
      `Nominais federais: resíduo de ${nf(nominalResidual)} votos em ${nf(nominalBaseline)} (${pct(nominalResidual / nominalBaseline, 3)}) — o detalhe por seção inclui votos de candidaturas que o TSE invalidou e que o baseline (nominais válidos) não conta.`,
  )
  validation.push(
    `${byCity.size} municípios, ${sections.size} seções, ${salvadorBairros.size} bairros de Salvador com votação; ${bairros.attached}/${bairros.registry} seções de Salvador casadas com o cadastro de locais.`,
  )
  if (byCity.size !== 417)
    validation.push(`aviso: ${byCity.size} municípios apurados (esperado 417)`)

  const files = []
  for (const name of [
    'votacao_secao_2022_BA.csv',
    'votacao_secao_2022_BR.csv',
    'detalhe_votacao_secao_2022_BA.csv',
    'detalhe_votacao_munzona_2022_BA.csv',
    'consulta_cand_2022_BA.csv',
    'eleitorado_local_votacao_2022.csv',
  ]) {
    const buffer = await readFile(join(CSV_DIR, name))
    files.push({
      name,
      bytes: buffer.length,
      sha256: createHash('sha256').update(buffer).digest('hex'),
    })
  }

  const serializeAgg = (agg) => ({ ...agg })
  const data = {
    generatedAt: GENERATED_AT,
    method: {
      unit: 'seção eleitoral (TSE 2022, 1º turno)',
      bloco:
        'min(votos Lula 13 presidente, votos Jerônimo 13 governador) — tamanho conservador do eleitorado que escolheu os dois nomes',
      naoEscolha:
        'brancos+nulos do cargo por seção (exato) — o eleitor compareceu e não escolheu nenhum nome; excesso = não-escolha do cargo − não-escolha da presidencial na mesma seção (nunca negativo)',
      teto: 'teto = min(bloco Lula+Jerônimo, brancos+nulos do cargo) por seção — máximo de eleitores do bloco que podem ter deixado o cargo sem nome; soma por seção',
      pisoTeto:
        'piso = max(0, Lula+Jerônimo−comparecimento do cargo−válidos do cargo, com válidos = nominais+legenda); somados por seção',
      sobra:
        'max(0, bloco − nominais do cargo) por seção — referência de auditoria; é ~0 no estado porque os nominais do cargo superam o bloco',
      campoPt:
        'campo PT estadual = soma dos votos nominais de todos os candidatos a deputado estadual com número 13xxx (prefixo do partido), por seção — proxy de presença partidária; não é a votação de Julio Pinheiro, que não disputou 2022',
      limites:
        'o voto é do local de votação, não da residência; ninguém observa voto individual — nenhum número aqui mede intenção ou transferência efetiva',
    },
    candidates: {
      solla: { number: 1313, office: 'deputado_federal', baseline: '2022' },
      julio: {
        number: 13999,
        office: 'deputado_estadual',
        baseline: null,
        note: 'sem candidatura em 2022 (prefeito de Amargosa); o recorte estadual usa o cargo e o campo PT 13xxx',
      },
      lula: { number: 13, office: 'presidente' },
      jeronimo: { number: 13, office: 'governador' },
    },
    totals: {
      ba: serializeAgg(baTotals),
      salvador: serializeAgg(salvadorTotals),
      rms: serializeAgg(rmsAgg),
    },
    cities: [...byCity.values()]
      .map((agg) => ({
        city: agg.label,
        territory: agg.territory,
        sections: agg.sections,
        compFed: agg.compFed,
        valFed: agg.valFed,
        valEst: agg.valEst,
        lula: agg.lula,
        jeronimo: agg.jeronimo,
        blocoLJ: agg.blocoLJ,
        sobraFed: agg.sobraFed,
        sobraEst: agg.sobraEst,
        pisoFed: agg.pisoFed,
        pisoEst: agg.pisoEst,
        tetoFed: agg.tetoFed,
        tetoEst: agg.tetoEst,
        brancoNuloFed: agg.brancoNuloFed,
        brancoNuloEst: agg.brancoNuloEst,
        excessoFed: agg.excessoFed,
        excessoEst: agg.excessoEst,
        presBrancoNulo: agg.presBrancoNulo,
        solla: agg.solla,
        ptEst: agg.ptEst,
        ptFed: agg.ptFed,
        sollaShare: agg.sollaShare,
        ptEstShare: agg.ptEstShare,
        lqSolla: agg.lqSolla,
        lqPt: agg.lqPt,
        lqPtFed: agg.lqPtFed,
        lqLeft: agg.lqLeft,
      }))
      .sort((left, right) => right.tetoFed - left.tetoFed),
    salvador: {
      zones: [...salvadorZones.values()]
        .sort((left, right) => left.zone - right.zone)
        .map(serializeAgg),
      bairros: [...salvadorBairros.values()]
        .sort((left, right) => right.tetoFed - left.tetoFed)
        .map(serializeAgg),
      sections: {
        topTetoFed: sectionListsSalvador.topTetoFed.slice(0, 15).map(pickSection),
        topTetoEst: sectionListsSalvador.topTetoEst.slice(0, 15).map(pickSection),
        topSolla: sectionListsSalvador.topSolla.slice(0, 15).map(pickSection),
        cross: {
          thresholds: sectionListsSalvador.cross.thresholds,
          fedDefesa: sectionListsSalvador.cross.fedDefesa.slice(0, 12).map(pickSection),
          fedAtaque: sectionListsSalvador.cross.fedAtaque.slice(0, 10).map(pickSection),
          excessoFed: sectionListsSalvador.cross.excessoFed.slice(0, 10).map(pickSection),
          estDefesa: sectionListsSalvador.cross.estDefesa.slice(0, 12).map(pickSection),
          estAtaque: sectionListsSalvador.cross.estAtaque.slice(0, 12).map(pickSection),
          leftFed: sectionListsSalvador.cross.leftFed.slice(0, 10).map(pickSection),
          leftEst: sectionListsSalvador.cross.leftEst.slice(0, 10).map(pickSection),
          dobradinha: sectionListsSalvador.cross.dobradinha.slice(0, 12).map(pickSection),
        },
      },
    },
    rms: {
      cities: [...byCity.values()]
        .filter((agg) => rmsCities.has(agg.label))
        .sort((left, right) => right.tetoFed - left.tetoFed)
        .map((agg) => ({
          city: agg.label,
          sections: agg.sections,
          compFed: agg.compFed,
          blocoLJ: agg.blocoLJ,
          sobraFed: agg.sobraFed,
          sobraEst: agg.sobraEst,
          tetoFed: agg.tetoFed,
          tetoEst: agg.tetoEst,
          brancoNuloFed: agg.brancoNuloFed,
          brancoNuloEst: agg.brancoNuloEst,
          excessoFed: agg.excessoFed,
          excessoEst: agg.excessoEst,
          solla: agg.solla,
          ptEst: agg.ptEst,
          ptFed: agg.ptFed,
          sollaShare: agg.sollaShare,
          ptEstShare: agg.ptEstShare,
          lqSolla: agg.lqSolla,
          lqPt: agg.lqPt,
          lqPtFed: agg.lqPtFed,
          lqLeft: agg.lqLeft,
        })),
      sections: {
        topTetoFed: sectionListsRms.topTetoFed.slice(0, 12).map(pickSection),
        topTetoEst: sectionListsRms.topTetoEst.slice(0, 12).map(pickSection),
        topSolla: sectionListsRms.topSolla.slice(0, 10).map(pickSection),
        cross: {
          thresholds: sectionListsRms.cross.thresholds,
          fedDefesa: sectionListsRms.cross.fedDefesa.slice(0, 10).map(pickSection),
          fedAtaque: sectionListsRms.cross.fedAtaque.slice(0, 10).map(pickSection),
          excessoFed: sectionListsRms.cross.excessoFed.slice(0, 10).map(pickSection),
          estDefesa: sectionListsRms.cross.estDefesa.slice(0, 10).map(pickSection),
          estAtaque: sectionListsRms.cross.estAtaque.slice(0, 10).map(pickSection),
          leftFed: sectionListsRms.cross.leftFed.slice(0, 10).map(pickSection),
          leftEst: sectionListsRms.cross.leftEst.slice(0, 10).map(pickSection),
          dobradinha: sectionListsRms.cross.dobradinha.slice(0, 10).map(pickSection),
        },
      },
    },
    territories: territories.map((entry) => ({
      name: entry.name,
      agg: serializeAgg(entry.agg),
      metrics: entry.metrics,
      topTetoFed: entry.topTetoFed.map(pickSection),
      topTetoEst: entry.topTetoEst.map(pickSection),
      topSolla: entry.topSolla.map(pickSection),
      topCities: entry.topCities,
      thresholds: entry.thresholds,
    })),
    sections: {
      ba: {
        topBnFed: sectionListsBa.topBnFed.slice(0, 30).map(pickSection),
        topBnEst: sectionListsBa.topBnEst.slice(0, 30).map(pickSection),
        topTetoFed: sectionListsBa.topTetoFed.slice(0, 25).map(pickSection),
        topTetoEst: sectionListsBa.topTetoEst.slice(0, 25).map(pickSection),
        topSolla: sectionListsBa.topSolla.slice(0, 15).map(pickSection),
        cross: {
          thresholds: sectionListsBa.cross.thresholds,
          fedDefesa: sectionListsBa.cross.fedDefesa.slice(0, 15).map(pickSection),
          fedAtaque: sectionListsBa.cross.fedAtaque.slice(0, 15).map(pickSection),
          excessoFed: sectionListsBa.cross.excessoFed.slice(0, 15).map(pickSection),
          estDefesa: sectionListsBa.cross.estDefesa.slice(0, 15).map(pickSection),
          estAtaque: sectionListsBa.cross.estAtaque.slice(0, 15).map(pickSection),
          leftFed: sectionListsBa.cross.leftFed.slice(0, 15).map(pickSection),
          leftEst: sectionListsBa.cross.leftEst.slice(0, 15).map(pickSection),
          dobradinha: sectionListsBa.cross.dobradinha.slice(0, 20).map(pickSection),
        },
      },
      salvador: {
        topBnFed: sectionListsSalvador.topBnFed.slice(0, 15).map(pickSection),
        topBnEst: sectionListsSalvador.topBnEst.slice(0, 15).map(pickSection),
        topTetoFed: sectionListsSalvador.topTetoFed.slice(0, 15).map(pickSection),
        topTetoEst: sectionListsSalvador.topTetoEst.slice(0, 15).map(pickSection),
        topSolla: sectionListsSalvador.topSolla.slice(0, 15).map(pickSection),
        cross: {
          thresholds: sectionListsSalvador.cross.thresholds,
          fedDefesa: sectionListsSalvador.cross.fedDefesa.slice(0, 12).map(pickSection),
          fedAtaque: sectionListsSalvador.cross.fedAtaque.slice(0, 10).map(pickSection),
          excessoFed: sectionListsSalvador.cross.excessoFed.slice(0, 10).map(pickSection),
          estDefesa: sectionListsSalvador.cross.estDefesa.slice(0, 12).map(pickSection),
          estAtaque: sectionListsSalvador.cross.estAtaque.slice(0, 12).map(pickSection),
          dobradinha: sectionListsSalvador.cross.dobradinha.slice(0, 12).map(pickSection),
        },
      },
      rms: {
        topBnFed: sectionListsRms.topBnFed.slice(0, 12).map(pickSection),
        topBnEst: sectionListsRms.topBnEst.slice(0, 12).map(pickSection),
        topTetoFed: sectionListsRms.topTetoFed.slice(0, 12).map(pickSection),
        topTetoEst: sectionListsRms.topTetoEst.slice(0, 12).map(pickSection),
        topSolla: sectionListsRms.topSolla.slice(0, 10).map(pickSection),
        cross: {
          thresholds: sectionListsRms.cross.thresholds,
          fedDefesa: sectionListsRms.cross.fedDefesa.slice(0, 10).map(pickSection),
          fedAtaque: sectionListsRms.cross.fedAtaque.slice(0, 10).map(pickSection),
          excessoFed: sectionListsRms.cross.excessoFed.slice(0, 10).map(pickSection),
          estDefesa: sectionListsRms.cross.estDefesa.slice(0, 10).map(pickSection),
          estAtaque: sectionListsRms.cross.estAtaque.slice(0, 10).map(pickSection),
          dobradinha: sectionListsRms.cross.dobradinha.slice(0, 10).map(pickSection),
        },
      },
    },
    validation,
    files,
    urnNames: { ...seen, lula: names },
  }

  await mkdir(dirname(DATA_PATH), { recursive: true })
  await writeFile(DATA_PATH, `${JSON.stringify(data, null, 2)}\n`)
  console.log(`[${LABEL}] dados gravados em ${DATA_PATH}`)
  return data
}

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------

const alignRight = (head) => head.map((_, index) => (index === 0 ? 'left' : 'right'))

const table = (caption, head, rows, options = {}) => ({
  type: 'table',
  caption,
  head,
  rows,
  align: options.align ?? alignRight(head),
})

const sectionLabel = (entry, options = {}) =>
  options.salvador || entry.bairro
    ? `${entry.city} — ${entry.bairro ?? 'sem bairro'} · ZE ${entry.zone} · seção ${entry.section}`
    : `${entry.city} · ZE ${entry.zone} · seção ${entry.section}`

const orDash = (value, digits = 2) =>
  value === null || value === undefined ? '—' : dec(value, digits)

const sectionTableRows = (entries, options = {}) =>
  entries.map((entry) => [
    sectionLabel(entry, options),
    nf(entry.compFed),
    nf(entry.lula),
    nf(entry.jeronimo),
    nf(entry.blocoLJ),
    nf(entry.brancoNuloFed),
    nf(entry.excessoFed),
    nf(entry.tetoFed),
    orDash(entry.lqSolla),
    nf(entry.solla),
    nf(entry.brancoNuloEst),
    nf(entry.excessoEst),
    nf(entry.tetoEst),
    nf(entry.ptEst),
    orDash(entry.lqPt),
  ])

const SECTION_HEAD = [
  'Seção',
  'Comp.',
  'Lula',
  'Jer.',
  'Bloco',
  'Bn fed.',
  'Exc. fed.',
  'Teto fed.',
  'LQ Solla',
  'Solla',
  'Bn est.',
  'Exc. est.',
  'Teto est.',
  'Campo PT',
  'LQ PT',
]

const geoRow = (entry) => [
  entry.label,
  nf(entry.sections),
  nf(entry.compFed),
  nf(entry.lula),
  nf(entry.jeronimo),
  nf(entry.blocoLJ),
  nf(entry.brancoNuloFed),
  entry.compFed > 0 ? pct(entry.brancoNuloFed / entry.compFed) : '—',
  nf(entry.excessoFed),
  nf(entry.tetoFed),
  nf(entry.solla),
  orDash(entry.lqSolla),
  nf(entry.brancoNuloEst),
  nf(entry.excessoEst),
  nf(entry.tetoEst),
  nf(entry.ptEst),
  orDash(entry.lqPt),
]

const GEO_HEAD = [
  'Território',
  'Seções',
  'Comp.',
  'Lula',
  'Jer.',
  'Bloco L+J',
  'Bn fed.',
  '% não-esc.',
  'Exc. fed.',
  'Teto fed.',
  'Solla',
  'LQ Solla',
  'Bn est.',
  'Exc. est.',
  'Teto est.',
  'Campo PT',
  'LQ PT',
]

const SIMPLE_FED_HEAD = [
  'Seção',
  'Comp.',
  'Bn fed.',
  'Bloco L+J',
  'LQ esq.',
  'Solla',
  'LQ Solla',
  'Campo PT fed.',
  'LQ PT fed.',
]

const simpleFedRows = (entries) =>
  entries.map((entry) => [
    sectionLabel(entry),
    nf(entry.compFed),
    nf(entry.brancoNuloFed),
    nf(entry.blocoLJ),
    orDash(entry.lqLeft),
    nf(entry.solla),
    orDash(entry.lqSolla),
    nf(entry.ptFed),
    orDash(entry.lqPtFed),
  ])

const SIMPLE_EST_HEAD = [
  'Seção',
  'Comp.',
  'Bn est.',
  'Bloco L+J',
  'LQ esq.',
  'Campo PT est.',
  'LQ PT est.',
]

const simpleEstRows = (entries) =>
  entries.map((entry) => [
    sectionLabel(entry),
    nf(entry.compFed),
    nf(entry.brancoNuloEst),
    nf(entry.blocoLJ),
    orDash(entry.lqLeft),
    nf(entry.ptEst),
    orDash(entry.lqPt),
  ])

const bullets = (items) => ({ type: 'bullets', items })
const paragraphs = (items) => ({ type: 'paragraphs', items })
const note = (title, text) => ({ type: 'note', title, text })

const kpi = (label, value, detail) => ({ label, value, detail })

function buildReport(data, estrategia) {
  const { totals, sections: lists, cities, salvador, rms, territories } = data
  const ba = totals.ba
  const totalErrors = lists.ba.cross.thresholds.qualified
  const escalaFed1 = ba.excessoFed / 100
  const escalaEst1 = ba.excessoEst / 100
  const blocoNas30Fed = lists.ba.topBnFed.reduce((sum, row) => sum + row.blocoLJ, 0)
  const blocoNas30Est = lists.ba.topBnEst.reduce((sum, row) => sum + row.blocoLJ, 0)
  const zonasSalvadorTeto = [...salvador.zones]
    .sort((left, right) => right.tetoFed - left.tetoFed)
    .slice(0, 4)
    .map((zone) => `ZE${zone.zone}`)
    .join(', ')
  const zonasSalvadorPt = [...salvador.zones]
    .sort((left, right) => (right.lqPt ?? 0) - (left.lqPt ?? 0))
    .slice(0, 2)
    .map((zone) => `ZE${zone.zone}`)
    .join(', ')
  const rmsTop = rms.cities
    .slice(0, 4)
    .map((city) => city.city)
    .join(', ')

  const topCityRows = cities
    .slice(0, 20)
    .map((city) => [
      city.city,
      city.territory,
      nf(city.sections),
      nf(city.compFed),
      nf(city.blocoLJ),
      nf(city.brancoNuloFed),
      nf(city.excessoFed),
      nf(city.tetoFed),
      nf(city.solla),
      orDash(city.lqSolla),
      nf(city.brancoNuloEst),
      nf(city.tetoEst),
      nf(city.ptEst),
      orDash(city.lqPt),
    ])

  const simpleCityRows = cities
    .slice()
    .sort((left, right) => right.brancoNuloFed - left.brancoNuloFed)
    .slice(0, 15)
    .map((city) => [
      city.city,
      city.territory,
      nf(city.brancoNuloFed),
      nf(city.brancoNuloEst),
      orDash(city.lqLeft),
      nf(city.solla),
      orDash(city.lqSolla),
      nf(city.ptFed),
      orDash(city.lqPtFed),
      nf(city.ptEst),
      orDash(city.lqPt),
    ])

  const territoryRows = territories.map((entry) => geoRow({ label: entry.name, ...entry.agg }))
  const salvadorZoneRows = salvador.zones.map((zone) => geoRow(zone))
  const rmsRows = rms.cities.map((city) => [
    city.city,
    nf(city.sections),
    nf(city.compFed),
    nf(city.blocoLJ),
    nf(city.brancoNuloFed),
    nf(city.excessoFed),
    nf(city.tetoFed),
    nf(city.solla),
    orDash(city.lqSolla),
    nf(city.brancoNuloEst),
    nf(city.tetoEst),
    nf(city.ptEst),
    orDash(city.lqPt),
  ])

  const bairroRows = salvador.bairros
    .slice(0, 20)
    .map((bairro) => [
      bairro.label,
      nf(bairro.sections),
      nf(bairro.compFed),
      nf(bairro.blocoLJ),
      nf(bairro.brancoNuloFed),
      nf(bairro.excessoFed),
      nf(bairro.tetoFed),
      nf(bairro.solla),
      orDash(bairro.lqSolla),
      nf(bairro.brancoNuloEst),
      nf(bairro.tetoEst),
      nf(bairro.ptEst),
      orDash(bairro.lqPt),
    ])

  const strategyBlock = (entry, fallbackTitle) =>
    entry && Array.isArray(entry.blocks) && entry.blocks.length > 0
      ? entry.blocks
      : [note(fallbackTitle, 'Seção a preencher com a leitura das personas.')]

  const report = {
    title: 'Onde está o voto que falta',
    subtitle:
      'O que as seções eleitorais de 2022 dizem sobre o voto de Lula e Jerônimo que não escolheu deputado — e onde Jorge Solla (1313) e o campo estadual têm mais espaço na reta final de 2026. Julio Pinheiro (13999) não disputou 2022; o lado estadual usa o cargo e o campo PT 13xxx como proxy.',
    date: DATE_LABEL,
    kpis: [
      kpi('Comparecimento 2022 (BA)', nf(ba.compFed), `${nf(ba.sections)} seções · turno 1`),
      kpi('Bloco Lula+Jerônimo', nf(ba.blocoLJ), 'mín(mín(Lula,Jerônimo)) por seção'),
      kpi(
        'Não-escolha federal',
        nf(ba.brancoNuloFed),
        `${pct(ba.brancoNuloShareFed)} do comparecimento · ${nf(ba.excessoFed)} acima da presidencial`,
      ),
      kpi(
        'Não-escolha estadual',
        nf(ba.brancoNuloEst),
        `${pct(ba.brancoNuloShareEst)} do comparecimento · ${nf(ba.excessoEst)} acima`,
      ),
      kpi('Solla 1313', nf(ba.solla), `${pct(ba.sollaShare)} dos nominais federais`),
      kpi(
        'Campo PT estadual',
        nf(ba.ptEst),
        `${pct(ba.ptEstShare)} dos nominais estaduais · todos os 13xxx`,
      ),
      kpi(
        'Teto L+J → federal',
        nf(ba.tetoFed),
        `piso ${nf(ba.pisoFed)} · intervalo da pergunta literal`,
      ),
      kpi(
        'Teto L+J → estadual',
        nf(ba.tetoEst),
        `piso ${nf(ba.pisoEst)} · intervalo da pergunta literal`,
      ),
    ],
    sections: [
      {
        id: 'essencial',
        title: 'O essencial',
        subtitle: 'A leitura de trinta segundos e o mapa deste documento',
        blocks: [
          bullets([
            {
              label: 'A premissa não se confirma',
              text: `Os nominais para deputado (${nf(ba.valFed)} federais e ${nf(ba.valEst)} estaduais) superam o bloco Lula+Jerônimo (${nf(ba.blocoLJ)}): não há um exército de lulistas represado na proporcional.`,
            },
            {
              label: 'O estoque real',
              text: `Branco+nulo de ${nf(ba.brancoNuloFed)} no federal (${pct(ba.brancoNuloShareFed)} do comparecimento) e ${nf(ba.brancoNuloEst)} no estadual (${pct(ba.brancoNuloShareEst)}); excesso sobre a presidencial de ${nf(ba.excessoFed)} e ${nf(ba.excessoEst)}.`,
            },
            {
              label: 'Concentração',
              text: `Salvador responde por ${nf(totals.salvador.brancoNuloFed)} (${pct(totals.salvador.brancoNuloShareFed)} do comparecimento local) no federal e ${nf(totals.salvador.brancoNuloEst)} no estadual; a RMS soma ${nf(totals.rms.brancoNuloFed)} e ${nf(totals.rms.brancoNuloEst)}.`,
            },
            {
              label: 'Solla e campo',
              text: `Solla tem LQ 1,25 em Salvador, 2,10 no Recôncavo e 7,91 no Vale do Jiquiriçá; o campo PT estadual é forte no Sudoeste Baiano (1,68) e no Médio Sudoeste (1,91).`,
            },
            {
              label: 'Alvos diretos',
              text: `As seções líderes em branco+nulo federal (${lists.ba.topBnFed[0].city} ZE${lists.ba.topBnFed[0].zone} s${lists.ba.topBnFed[0].section}, ${nf(lists.ba.topBnFed[0].brancoNuloFed)} votos) e estadual (${lists.ba.topBnEst[0].city} ZE${lists.ba.topBnEst[0].zone} s${lists.ba.topBnEst[0].section}, ${nf(lists.ba.topBnEst[0].brancoNuloEst)} votos) abrem as seções de alvos diretos, com a força da esquerda ao lado.`,
            },
          ]),
          note(
            'Abreviações das tabelas',
            'Bn = branco+nulo; Exc. = excesso sobre o branco+nulo da presidencial na mesma seção; Teto = mín(bloco L+J, branco+nulo do cargo); LQ = quociente local (1,00 = padrão do estado); Campo PT fed./est. = soma dos nominais de todos os candidatos 13xx/13xxx; Jer. = Jerônimo; Comp. = comparecimento.',
          ),
          paragraphs([
            'Roteiro: “A Bahia inteira” fixa a escala; “O cruzamento de seções” separa defesa, ataque e dobradinha; “Municípios” e “Seções em destaque” dão o volume; “Alvos simples” e “Esquerda forte” entregam a lista direta da reta final; “Salvador”, “RMS” e “Territórios de Identidade” descem a geografia; “Dia da eleição” traz a operação lícita; as leituras da Cientista Política e da Coordenação Geral fecham com crítica e prioridades; “Método” documenta validação e limites.',
          ]),
        ],
      },
      {
        id: 'como-ler',
        title: 'Como ler este relatório',
        subtitle: 'O que é observável, o que é teto e o que ninguém consegue saber',
        blocks: [
          paragraphs([
            'A unidade é a seção eleitoral de 2022 (1º turno), a menor unidade publicada pelo TSE. Toda seção tem voto nominal por candidato e aferição por cargo (comparecimento, nominais, legenda, brancos, nulos). Ninguém observa o voto individual: o que se mede é quantos votos cada cargo recebeu na mesma seção, nunca quem votou em quem.',
            'A premissa da pergunta — "muita gente votou Lula e Jerônimo e não votou para deputado" — não se confirma no agregado. Na Bahia, os votos nominais para deputado federal (7,60 mi) e para estadual (7,17 mi) são maiores que os votos de Lula (5,87 mi) e muito maiores que o bloco Lula+Jerônimo (4,02 mi, o menor dos dois por seção). O eleitorado que escolheu os dois nomes do campo é uma minoria dentro de quem votou para deputado: não existe um exército de eleitores de Lula que deixou a disputa proporcional em branco esperando para ser convertido — o que existe é uma fração que não escolheu nome nenhum (branco/nulo) e outra que escolheu nomes de outros campos. A pergunta certa, então, é onde a não-escolha se concentra e onde ela é anormal em relação à própria seção.',
            'A pergunta literal ("votou Lula e Jerônimo e não votou para o cargo") só pode ser respondida como intervalo, porque ninguém liga o voto individual. O piso é o mínimo que a matemática garante: Lula + Jerônimo − comparecimento − válidos do cargo, nunca negativo. O teto é o máximo admissível: o menor valor entre o bloco Lula+Jerônimo e os brancos+nulos do cargo. Somados por seção, o piso federal do estado é de apenas 1 voto e o teto, de 896 mil — o intervalo mostra que a maior parte da intuição não é verificável, e o dado útil é o próprio volume de brancos+nulos e o seu excesso sobre o que a mesma seção fez na eleição presidencial.',
            'O lado estadual tem uma ausência declarada: Julio Pinheiro (13999) não disputou 2022 — foi prefeito de Amargosa até 2020 e voltou à disputa em 2026. Não existe votação dele para cruzar. Por isso o recorte estadual usa duas camadas: a não-escolha do cargo (branco+nulo para deputado estadual) e o campo PT estadual — a soma dos votos nominais de todos os candidatos 13xxx, um proxy de onde a estrutura partidária já existe. Onde as duas coincidem, a dobradinha tem terreno; onde só a não-escolha existe, é terreno de construção.',
          ]),
          note(
            'Limites que valem para todas as tabelas',
            'O voto é do local de votação, não da casa do eleitor; o cadastro do TSE não liga o voto ao domicílio. Seções pequenas oscilam — por isso os cruzamentos de força relativa só entram com pelo menos 200 comparecentes e 120 nominais federais. "Excesso" é a não-escolha do cargo menos a não-escolha da presidencial na mesma seção (nunca negativo): mede o abandono típico do voto proporcional, isolando quem deixou o cargo em branco além do normal daquele eleitorado. Nenhum número aqui mede intenção de voto, transferência efetiva ou efeito de campanha: mede potencial geométrico do território. As listas são de seções, não de pessoas — e a campanha não deve expor nominalmente os bairros/seções de "ataque" como prioridade pública (a lista é interna).',
          ),
        ],
      },
      {
        id: 'bahia',
        title: 'A Bahia inteira',
        subtitle: 'O teste da premissa e o tamanho real da não-escolha',
        blocks: [
          paragraphs([
            `Em 2022, ${nf(ba.compFed)} eleitores compareceram na Bahia (1º turno). Lula teve ${nf(ba.lula)} votos no estado e Jerônimo, ${nf(ba.jeronimo)}; o bloco conservador Lula+Jerônimo soma ${nf(ba.blocoLJ)}. Para deputado federal, os votos nominais (em candidatos) foram ${nf(ba.valFed)} e as legendas, ${nf(ba.legFed)}; para deputado estadual, ${nf(ba.valEst)} nominais e ${nf(ba.legEst)} de legenda.`,
            `A não-escolha do cargo — votos brancos e nulos — foi de ${nf(ba.brancoNuloFed)} para deputado federal (${pct(ba.brancoNuloShareFed)} do comparecimento) e de ${nf(ba.brancoNuloEst)} para deputado estadual (${pct(ba.brancoNuloShareEst)}). Desse total, o que excede o padrão da mesma seção na eleição presidencial soma ${nf(ba.excessoFed)} no federal e ${nf(ba.excessoEst)} no estadual. Para a pergunta literal, o intervalo somado por seção vai de ${nf(ba.pisoFed)} a ${nf(ba.tetoFed)} no federal e de ${nf(ba.pisoEst)} a ${nf(ba.tetoEst)} no estadual.`,
            `A "sobra de nomes" (bloco Lula+Jerônimo menos nominais do cargo) é de apenas ${nf(ba.sobraFed)} no federal e ${nf(ba.sobraEst)} no estadual: onde o bloco é grande, o cargo costuma ter mais nomes do que ele — a intuição de um grande contigente de lulistas sem voto para deputado não se sustenta. O que se sustenta é a não-escolha de ${nf(ba.brancoNuloFed)} votos no federal e ${nf(ba.brancoNuloEst)} no estadual: é esse o volume que a campanha disputa nos últimos dias.`,
            `Nas urnas de 2022, Solla teve ${nf(ba.solla)} votos (${pct(ba.sollaShare)} dos nominais federais; LQ 1,00 por definição). O campo PT estadual (todos os candidatos 13xxx, sem legenda) somou ${nf(ba.ptEst)} votos (${pct(ba.ptEstShare)} dos nominais estaduais). A pergunta deste relatório é onde, seção a seção, a não-escolha se concentra e cruza com a força de Solla e do campo.`,
          ]),
          table('Bahia — números de 2022 (1º turno)', GEO_HEAD, [geoRow(ba)]),
        ],
      },
      {
        id: 'bahia-cruzamento',
        title: 'Bahia — o cruzamento de seções',
        subtitle:
          'Não-escolha alta com Solla forte, com Solla fraco, com o campo PT e na dobradinha',
        blocks: [
          paragraphs([
            `Dos ${nf(ba.sections)} seções do estado, ${nf(totalErrors)} entram nos cruzamentos (comparecimento ≥ 200 e 120 nominais federais). "Solla forte" é LQ ≥ 1,5 (uma vez e meia o padrão estadual dele); "Solla fraco", LQ ≤ 0,5. "Não-escolha alta" é o quartil superior do teto Lula+Jerônimo (≥ ${nf(lists.ba.cross.thresholds.p75Fed)} votos — teto = mín(bloco, brancos+nulos)); para ataque, exigimos o decil superior (≥ ${nf(lists.ba.cross.thresholds.p90Fed)}) e ao menos 300 nominais federais, para não caçar ruído de seção pequena. A lista de excesso mostra as seções em que o abandono do cargo mais superou o abandono da presidencial na mesma urna.`,
          ]),
          table(
            `Defender e converter — Solla forte e não-escolha federal alta (top ${lists.ba.cross.fedDefesa.length})`,
            SECTION_HEAD,
            sectionTableRows(lists.ba.cross.fedDefesa),
          ),
          table(
            `Atacar — Solla fraco (LQ ≤ 0,5) e não-escolha federal no decil superior (top ${lists.ba.cross.fedAtaque.length})`,
            SECTION_HEAD,
            sectionTableRows(lists.ba.cross.fedAtaque),
          ),
          table(
            `Onde o voto para deputado foi abandonado além do normal da presidencial (top ${lists.ba.cross.excessoFed.length})`,
            SECTION_HEAD,
            sectionTableRows(lists.ba.cross.excessoFed),
          ),
          table(
            `Campo PT estadual forte e não-escolha estadual alta (top ${lists.ba.cross.estDefesa.length})`,
            SECTION_HEAD,
            sectionTableRows(lists.ba.cross.estDefesa),
          ),
          table(
            `Campo PT estadual fraco e não-escolha estadual no decil superior — construção (top ${lists.ba.cross.estAtaque.length})`,
            SECTION_HEAD,
            sectionTableRows(lists.ba.cross.estAtaque),
          ),
          table(
            `Dobradinha — não-escolha federal e estadual altas na mesma seção (top ${lists.ba.cross.dobradinha.length})`,
            SECTION_HEAD,
            sectionTableRows(lists.ba.cross.dobradinha),
          ),
        ],
      },
      {
        id: 'bahia-municipios',
        title: 'Bahia — municípios com mais não-escolha',
        subtitle: 'O mapa de volume: onde o voto para deputado ficou em branco ou nulo',
        blocks: [
          table(
            'Top 20 municípios por teto federal (não-escolha e excesso ao lado)',
            [
              'Município',
              'Território',
              'Seções',
              'Comp.',
              'Bloco L+J',
              'Bn fed.',
              'Exc. fed.',
              'Teto fed.',
              'Solla',
              'LQ Solla',
              'Bn est.',
              'Teto est.',
              'Campo PT',
              'LQ PT',
            ],
            topCityRows,
          ),
        ],
      },
      {
        id: 'bahia-secoes',
        title: 'Bahia — seções em destaque',
        subtitle: 'Volume absoluto: teto Lula+Jerônimo, não-escolha e os maiores votos nominais',
        blocks: [
          table(
            `Top ${lists.ba.topTetoFed.length} seções por teto Lula+Jerônimo no federal`,
            SECTION_HEAD,
            sectionTableRows(lists.ba.topTetoFed),
          ),
          table(
            `Top ${lists.ba.topTetoEst.length} seções por teto Lula+Jerônimo no estadual`,
            SECTION_HEAD,
            sectionTableRows(lists.ba.topTetoEst),
          ),
          table(
            `Top ${lists.ba.topSolla.length} seções por votos de Solla (1313)`,
            SECTION_HEAD,
            sectionTableRows(lists.ba.topSolla),
          ),
        ],
      },
      {
        id: 'alvos-simples',
        title: 'Alvos simples — branco+nulo direto',
        subtitle:
          'A lista crua: onde o voto para o cargo ficou em branco/nulo, com a força da esquerda ao lado',
        blocks: [
          paragraphs([
            'A leitura mais direta do pedido: ordenar as seções pelo número absoluto de votos em branco ou nulos, sem teto nem piso. No federal, é o estoque endereçável de Solla (1313); no estadual, do campo do PT — Julio Pinheiro (13999) não disputou 2022 e não tem baseline. O LQ esquerda compara a fatia do bloco Lula+Jerônimo na seção com a mesma fatia na Bahia (LQ 1,00 = padrão do estado); LQ PT fed/est compara o campo 13xx/13xxx com o padrão do campo. LQ acima de 1 significa acima do padrão — leitura relativa, nunca percentual absoluto.',
            'A ordem das colunas conta a história: branco+nulo mostra o volume; LQ esquerda mostra se a seção é do campo; Solla e campo PT mostram a captura atual. Seção com branco+nulo alto e LQ esquerda acima de 1 é onde pedir o número tem recepção — não promessa de voto.',
          ]),
          table(
            `Top ${lists.ba.topBnFed.length} seções por branco+nulo federal — estoque direto para Solla`,
            SIMPLE_FED_HEAD,
            simpleFedRows(lists.ba.topBnFed),
          ),
          table(
            `Top ${lists.ba.topBnEst.length} seções por branco+nulo estadual — estoque direto do campo do PT`,
            SIMPLE_EST_HEAD,
            simpleEstRows(lists.ba.topBnEst),
          ),
          table(
            'Top 15 municípios por branco+nulo federal (estadual e força da esquerda ao lado)',
            [
              'Município',
              'Território',
              'Bn fed.',
              'Bn est.',
              'LQ esq.',
              'Solla',
              'LQ Solla',
              'Campo PT fed.',
              'LQ PT fed.',
              'Campo PT est.',
              'LQ PT est.',
            ],
            simpleCityRows,
          ),
        ],
      },
      {
        id: 'esquerda-forte',
        title: 'Esquerda forte, cargo em branco',
        subtitle:
          'Seções acima do padrão estadual no campo da esquerda e com voto do cargo em branco/nulo — as melhores para inserção',
        blocks: [
          paragraphs([
            `O filtro pedido: a seção precisa ser particularmente forte no campo da esquerda (LQ esquerda ≥ 1,25, ou seja, 25% acima do padrão do estado) e ter branco+nulo no quartil superior das seções qualificadas (federal ≥ ${nf(lists.ba.cross.thresholds.p75BnFed)} e estadual ≥ ${nf(lists.ba.cross.thresholds.p75BnEst)}). São as seções onde a recepção do campo existe e o cargo ficou vazio — a inserção do PT é facilitada porque o eleitor já votou Lula e Jerônimo ali.`,
            'Para Solla, a lista federal traz também o campo PT federal (todos os 13xx, do qual ele é o maior nome). Para o lado estadual, a coluna é o campo PT 13xxx — proxy de onde a estrutura do PT existe, já que Julio Pinheiro não tem votação de 2022.',
          ]),
          table(
            `Federal — esquerda forte e branco+nulo alto (top ${lists.ba.cross.leftFed.length})`,
            SIMPLE_FED_HEAD,
            simpleFedRows(lists.ba.cross.leftFed),
          ),
          table(
            `Estadual — esquerda forte e branco+nulo alto (top ${lists.ba.cross.leftEst.length})`,
            SIMPLE_EST_HEAD,
            simpleEstRows(lists.ba.cross.leftEst),
          ),
          note(
            'Uso interno',
            'Lista de trabalho da coordenação. Não vira material público nem mapa de prioridade exposto; o pedido é rede e número, dentro da lei.',
          ),
        ],
      },
      {
        id: 'salvador',
        title: 'Salvador',
        subtitle: 'A capital em zonas, bairros e seções — onde o volume está',
        blocks: [
          paragraphs([
            `Salvador compareceu com ${nf(salvador.zones.reduce((sum, zone) => sum + zone.compFed, 0))} em 2022. O bloco Lula+Jerônimo na cidade é de ${nf(salvador.zones.reduce((sum, zone) => sum + zone.blocoLJ, 0))} e a não-escolha para deputado federal somou ${nf(salvador.zones.reduce((sum, zone) => sum + zone.brancoNuloFed, 0))} votos (${nf(salvador.zones.reduce((sum, zone) => sum + zone.excessoFed, 0))} acima do padrão presidencial); no estadual, ${nf(salvador.zones.reduce((sum, zone) => sum + zone.brancoNuloEst, 0))} (${nf(salvador.zones.reduce((sum, zone) => sum + zone.excessoEst, 0))} de excesso). Solla fez ${nf(salvador.zones.reduce((sum, zone) => sum + zone.solla, 0))} na capital (${pct(
              share(
                salvador.zones.reduce((sum, zone) => sum + zone.solla, 0),
                salvador.zones.reduce((sum, zone) => sum + zone.valFed, 0),
              ),
            )} dos nominais federais) e o campo PT estadual somou ${nf(salvador.zones.reduce((sum, zone) => sum + zone.ptEst, 0))}.`,
          ]),
          table('Salvador — por zona eleitoral (ordem de ZE)', GEO_HEAD, salvadorZoneRows),
          table(
            'Salvador — top 20 bairros (local de votação) por teto federal',
            [
              'Bairro (TSE)',
              'Seções',
              'Comp.',
              'Bloco L+J',
              'Bn fed.',
              'Exc. fed.',
              'Teto fed.',
              'Solla',
              'LQ Solla',
              'Bn est.',
              'Teto est.',
              'Campo PT',
              'LQ PT',
            ],
            bairroRows,
          ),
          table(
            `Salvador — top ${salvador.sections.topTetoFed.length} seções por teto Lula+Jerônimo no federal`,
            SECTION_HEAD,
            sectionTableRows(salvador.sections.topTetoFed, { salvador: true }),
          ),
          table(
            `Salvador — top ${salvador.sections.topTetoEst.length} seções por teto Lula+Jerônimo no estadual`,
            SECTION_HEAD,
            sectionTableRows(salvador.sections.topTetoEst, { salvador: true }),
          ),
          table(
            `Salvador — Solla forte e não-escolha federal alta (top ${salvador.sections.cross.fedDefesa.length})`,
            SECTION_HEAD,
            sectionTableRows(salvador.sections.cross.fedDefesa, { salvador: true }),
          ),
          table(
            `Salvador — Solla fraco e não-escolha federal alta — ataque (top ${salvador.sections.cross.fedAtaque.length})`,
            SECTION_HEAD,
            sectionTableRows(salvador.sections.cross.fedAtaque, { salvador: true }),
          ),
          table(
            `Salvador — onde o voto para deputado foi mais abandonado (top ${salvador.sections.cross.excessoFed.length})`,
            SECTION_HEAD,
            sectionTableRows(salvador.sections.cross.excessoFed, { salvador: true }),
          ),
          table(
            `Salvador — dobradinha: não-escolha federal e estadual altas (top ${salvador.sections.cross.dobradinha.length})`,
            SECTION_HEAD,
            sectionTableRows(salvador.sections.cross.dobradinha, { salvador: true }),
          ),
        ],
      },
      {
        id: 'rms',
        title: 'Região Metropolitana de Salvador (demais municípios)',
        subtitle: 'Fora da capital, com Salvador fora da conta',
        blocks: [
          paragraphs([
            `Os ${rmsRows.length} municípios da RMS (todos os do Território Metropolitano de Salvador exceto a capital) somam bloco Lula+Jerônimo de ${nf(rms.cities.reduce((sum, city) => sum + city.blocoLJ, 0))}, não-escolha federal de ${nf(rms.cities.reduce((sum, city) => sum + city.brancoNuloFed, 0))} votos (${nf(rms.cities.reduce((sum, city) => sum + city.excessoFed, 0))} de excesso sobre a presidencial) e não-escolha estadual de ${nf(rms.cities.reduce((sum, city) => sum + city.brancoNuloEst, 0))}. Solla fez ${nf(rms.cities.reduce((sum, city) => sum + city.solla, 0))} na região e o campo PT estadual somou ${nf(rms.cities.reduce((sum, city) => sum + city.ptEst, 0))}.`,
          ]),
          table(
            'RMS — por município (ordem de teto federal)',
            [
              'Município',
              'Seções',
              'Comp.',
              'Bloco L+J',
              'Bn fed.',
              'Exc. fed.',
              'Teto fed.',
              'Solla',
              'LQ Solla',
              'Bn est.',
              'Teto est.',
              'Campo PT',
              'LQ PT',
            ],
            rmsRows,
          ),
          table(
            `RMS — top ${rms.sections.topTetoFed.length} seções por teto Lula+Jerônimo no federal`,
            SECTION_HEAD,
            sectionTableRows(rms.sections.topTetoFed),
          ),
          table(
            `RMS — top ${rms.sections.topTetoEst.length} seções por teto Lula+Jerônimo no estadual`,
            SECTION_HEAD,
            sectionTableRows(rms.sections.topTetoEst),
          ),
          table(
            `RMS — dobradinha: não-escolha federal e estadual altas (top ${rms.sections.cross.dobradinha.length})`,
            SECTION_HEAD,
            sectionTableRows(rms.sections.cross.dobradinha),
          ),
        ],
      },
      {
        id: 'territorios',
        title: 'Territórios de Identidade',
        subtitle: 'Os 27 TIs na mesma régua — e os destaques de cada um',
        blocks: [
          paragraphs([
            'A tabela compara os 27 Territórios de Identidade pela não-escolha absoluta e pela não-escolha relativa ao comparecimento. Território grande tem volume grande por construção; a coluna de percentual mostra onde o eleitorado abandonou mais o cargo, e a de excesso isola o abandono típico do voto proporcional. Salvador aparece dentro do Metropolitano de Salvador — a leitura da capital está na seção própria.',
          ]),
          table('Os 27 Territórios de Identidade — 2022, 1º turno', GEO_HEAD, territoryRows),
          ...territories.flatMap((entry) => [
            paragraphs([
              `**${entry.name}** — bloco ${nf(entry.agg.blocoLJ)}, não-escolha federal ${nf(entry.agg.brancoNuloFed)} (excesso ${nf(entry.agg.excessoFed)}) e estadual ${nf(entry.agg.brancoNuloEst)} (excesso ${nf(entry.agg.excessoEst)}); Solla ${nf(entry.agg.solla)} (LQ ${orDash(entry.agg.lqSolla)}), campo PT est. ${nf(entry.agg.ptEst)} (LQ ${orDash(entry.agg.lqPt)}).`,
            ]),
            table(
              `${entry.name} — top 5 seções por teto Lula+Jerônimo no federal`,
              SECTION_HEAD,
              sectionTableRows(entry.topTetoFed),
            ),
            table(
              `${entry.name} — top 5 seções por teto Lula+Jerônimo no estadual`,
              SECTION_HEAD,
              sectionTableRows(entry.topTetoEst),
            ),
          ]),
        ],
      },
      {
        id: 'dia-eleicao',
        title: 'Dia da eleição — operação dentro da lei',
        subtitle:
          'O que os dados autorizam planejar no domingo: colinha até sábado, fiscais e mobilização de rede',
        blocks: [
          note(
            'O limite legal',
            'No dia da eleição a propaganda de boca de urna é vedada — aglomeração, vestuário padronizado, alto-falante ou entrega de material ao eleitor (Lei 9.504/1997, art. 39, §5º, c/c art. 75; Código Eleitoral, art. 301). Este plano usa apenas instrumentos lícitos: pedido e colinha até sábado, fiscais partidários nos locais de votação no domingo, rede de lembretes antes do pleito e transporte só conforme as regras oficiais — a campanha não oferece transporte nem refeição a eleitor.',
          ),
          paragraphs([
            `Regra de ouro: no domingo, quem age é fiscal e mobilizador, não cabo eleitoral em campanha. O dado serve para distribuir presença onde o retorno é maior: as seções com mais branco+nulo e com o campo já forte. Nas 30 seções listadas no federal, o bloco Lula+Jerônimo soma ${nf(blocoNas30Fed)} eleitores — esse é o público que a colinha (entregue até sábado) e o lembrete de rede endereçam; nas 30 do estadual, ${nf(blocoNas30Est)}.`,
            `Escala para dimensionar sem prometer: cada 1% do excesso federal sobre a presidencial vale ~${nf(escalaFed1)} votos no estado (5% ≈ ${nf(escalaFed1 * 5)}, 10% ≈ ${nf(escalaFed1 * 10)}); no estadual, 1% ≈ ${nf(escalaEst1)}. Conversão não é estimável a partir do TSE — o número serve para calibrar esforço, não como meta.`,
          ]),
          bullets([
            {
              label: 'Colinha e material até sábado',
              text: `Fechar e distribuir pela rede nas seções de maior branco+nulo (federal de ${nf(lists.ba.topBnFed[0]?.brancoNuloFed ?? 0)} a ${nf(lists.ba.topBnFed[11]?.brancoNuloFed ?? 0)} votos; estadual de ${nf(lists.ba.topBnEst[0]?.brancoNuloEst ?? 0)} a ${nf(lists.ba.topBnEst[11]?.brancoNuloEst ?? 0)}). No domingo, nada de material ao eleitor.`,
            },
            {
              label: 'Fiscais por local',
              text: `Priorizar Salvador (${zonasSalvadorTeto} pelos maiores tetos; ${zonasSalvadorPt} pelo campo PT), Feira de Santana, ${rmsTop} na RMS e os locais das seções listadas no interior. Fiscal observa e reporta; não faz campanha no local.`,
            },
            {
              label: 'Rede até sábado 23h59',
              text: 'Lembrete do número (1313 federal; 13xxx estadual) por contato direto e grupos; registrar com data quem foi alcançado, sem sobrescrever valores.',
            },
            {
              label: 'Domingo',
              text: 'Comparecimento e ocorrências por seção viram relatório para o backtest; mobilização não aborda eleitor no local; transporte e alimentação apenas conforme regras oficiais.',
            },
          ]),
          table(
            'Prioridade de posicionamento — 12 seções por branco+nulo federal',
            SIMPLE_FED_HEAD,
            simpleFedRows(lists.ba.topBnFed.slice(0, 12)),
          ),
          table(
            'Prioridade de posicionamento — 12 seções por branco+nulo estadual',
            SIMPLE_EST_HEAD,
            simpleEstRows(lists.ba.topBnEst.slice(0, 12)),
          ),
          note(
            'Como usar a estimativa',
            'O teto de alcance é a soma do bloco L+J nas seções priorizadas; o efeito depende da rede (contato, pedido completo, colinha na mão do simpatizante). Sem backtest de 2026 não há como estimar conversão — trate os percentuais como escala de esforço, não como projeção de votos.',
          ),
        ],
      },
      {
        id: 'estrategia-cientifica',
        title: 'Leitura da Cientista Política',
        subtitle: 'Crítica do método e do que o dado permite afirmar',
        blocks: strategyBlock(estrategia?.cientificaPolitica, 'A preencher'),
      },
      {
        id: 'estrategia-coordenacao',
        title: 'Leitura da Coordenação Geral de campanha',
        subtitle: 'O que fazer com isso nos últimos dias',
        blocks: strategyBlock(estrategia?.coordenacaoGeral, 'A preencher'),
      },
      {
        id: 'metodo',
        title: 'Método, validação e proveniência',
        subtitle: 'Reprodutibilidade e limites',
        blocks: [
          paragraphs([
            'Fonte: Portal de Dados Abertos do TSE — resultados de 2022 (1º turno), arquivos votacao_secao_2022_BA, votacao_secao_2022_BR, detalhe_votacao_secao_2022 e eleitorado_local_votacao_2022. Extração em cache local; nenhum dado de campanha, banco ou pesquisa interna foi usado.',
            `Validação: as somas por seção foram conferidas contra o baseline TSE commitado no repositório (bahia-federal-baseline.json) para Solla 1313, Lula, Jerônimo, nominais, comparecimento, brancos e nulos, unidade a unidade (${nf(cities.length + 18)} municípios/zonas, sem divergência).`,
          ]),
          bullets(data.validation.map((check) => ({ label: '', text: check }))),
          table(
            'Arquivos-fonte (sha256 integral no JSON de dados)',
            ['Arquivo', 'Bytes'],
            data.files.map((file) => [file.name, nf(file.bytes)]),
            { align: ['left', 'right'] },
          ),
          note(
            'Regras de uso',
            'Documento interno de análise. As listas de seções de "ataque" não devem virar material público nem ser expostas como prioridade da campanha. A leitura de conversão (rede, liderança, pedido do número) é operação de coordenação — o dado indica onde, nunca como. Nada aqui estima intenção de voto nem promete transferência.',
          ),
        ],
      },
    ],
  }
  return report
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

const renderTableMd = (block) => {
  const head = block.head
  const rows = block.rows.map((row) => row.map((cell) => String(cell).replaceAll('|', '\\|')))
  const widths = head.map((cell, index) =>
    Math.max(String(cell).length, ...rows.map((row) => row[index].length)),
  )
  const pad = (text, index) => text + ' '.repeat(widths[index] - text.length)
  return [
    `**${block.caption}**`,
    '',
    `| ${head.map(pad).join(' | ')} |`,
    `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(pad).join(' | ')} |`),
  ].join('\n')
}

const renderBlocksMd = (blocks) =>
  blocks
    .map((block) => {
      switch (block.type) {
        case 'paragraphs':
          return block.items.join('\n\n')
        case 'bullets':
          return block.items
            .map((item) => `- ${item.label ? `**${item.label}** ` : ''}${item.text}`)
            .join('\n')
        case 'note':
          return `> **${block.title}** ${block.text}`
        case 'table':
          return renderTableMd(block)
        default:
          return ''
      }
    })
    .join('\n\n')

const htmlEscape = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')

const renderBlocksHtml = (blocks) =>
  blocks
    .map((block) => {
      switch (block.type) {
        case 'paragraphs':
          return block.items
            .map(
              (item) =>
                `<p>${htmlEscape(item).replaceAll(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</p>`,
            )
            .join('')
        case 'bullets':
          return `<ul class="bullets">${block.items
            .map(
              (item) =>
                `<li>${item.label ? `<strong>${htmlEscape(item.label)}</strong> ` : ''}${htmlEscape(item.text)}</li>`,
            )
            .join('')}</ul>`
        case 'note':
          return `<div class="note"><strong>${htmlEscape(block.title)}</strong><p>${htmlEscape(block.text)}</p></div>`
        case 'table':
          return renderTableHtml(block)
        default:
          return ''
      }
    })
    .join('')

const renderTableHtml = ({ caption, head, rows, align }) => {
  const alignClass = (index) => (align?.[index] === 'right' ? ' class="num"' : '')
  return `
    <table>
      <caption>${htmlEscape(caption)}</caption>
      <thead><tr>${head.map((cell, index) => `<th${alignClass(index)}>${htmlEscape(cell)}</th>`).join('')}</tr></thead>
      <tbody>${rows
        .map(
          (row) =>
            `<tr>${row
              .map((cell, index) => `<td${alignClass(index)}>${htmlEscape(cell)}</td>`)
              .join('')}</tr>`,
        )
        .join('')}</tbody>
    </table>`
}

const css = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: 'Fira Sans', 'DejaVu Sans', sans-serif;
    color: #18181b;
    font-size: 9.5pt;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1 { font-size: 25pt; line-height: 1.08; margin: 0 0 4mm; letter-spacing: -0.01em; }
  h2 { font-size: 15pt; margin: 0 0 3mm; color: #c51414; letter-spacing: -0.01em; break-after: avoid; }
  p { margin: 0 0 3mm; max-width: 178mm; orphans: 2; widows: 2; }
  .cover { height: 256mm; display: flex; flex-direction: column; justify-content: space-between; break-after: page; }
  .cover-top { padding-top: 6mm; }
  .brand { color: #c51414; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; font-size: 8.5pt; }
  .cover .subtitle { font-size: 12.4pt; color: #3f3f46; max-width: 160mm; }
  .cover-meta { color: #71717a; font-size: 8.6pt; }
  .cover-rule { height: 2.4mm; background: #c51414; width: 34mm; margin: 5mm 0; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 2.6mm; margin: 4mm 0 0; }
  .kpi { border: .8px solid #e4e4e7; border-radius: 2mm; padding: 2.6mm; background: #fafafa; }
  .kpi-value { display: block; font-size: 13.4pt; font-weight: 700; color: #c51414; }
  .kpi-label { display: block; font-size: 7.6pt; color: #52525b; }
  .kpi-detail { display: block; font-size: 6.9pt; color: #a1a1aa; margin-top: .6mm; }
  .section { padding: 0; }
  .page-break { break-before: page; }
  .section-subtitle { color: #71717a; font-style: italic; margin-top: -1mm; break-after: avoid; }
  .bullets { margin: 0 0 3mm; padding-left: 4.5mm; }
  .bullets li { margin-bottom: 2mm; }
  .note { border-left: 2.4mm solid #c51414; background: #fafafa; padding: 3mm 4mm; border-radius: 0 2mm 2mm 0; margin: 3mm 0; }
  .note strong { color: #c51414; }
  .note p { margin: 1mm 0 0; }
  table { width: 100%; border-collapse: collapse; font-size: 7.7pt; margin: 0 0 6mm; }
  caption { caption-side: top; text-align: left; font-weight: 700; font-size: 8.8pt; padding-bottom: 2mm; color: #18181b; break-after: avoid; }
  thead { display: table-header-group; }
  tr { break-inside: avoid; }
  th { text-align: left; background: #f4f4f5; border-bottom: 1px solid #d4d4d8; padding: 2mm 1.4mm; font-size: 6.9pt; text-transform: uppercase; letter-spacing: .02em; color: #52525b; }
  td { border-bottom: .6px solid #e4e4e7; padding: 1.9mm 1.4mm; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #fafafa; }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
`

const renderSectionHtml = (section) => `
  <section class="section page-break">
    <h2>${htmlEscape(section.title)}</h2>
    ${section.subtitle ? `<p class="section-subtitle">${htmlEscape(section.subtitle)}</p>` : ''}
    ${renderBlocksHtml(section.blocks)}
  </section>`

const renderKpis = (report) =>
  report.kpis
    .map(
      (entry) =>
        `<div class="kpi"><span class="kpi-value">${htmlEscape(entry.value)}</span><span class="kpi-label">${htmlEscape(entry.label)}</span><span class="kpi-detail">${htmlEscape(entry.detail)}</span></div>`,
    )
    .join('')

async function render(data) {
  let estrategia = null
  try {
    estrategia = JSON.parse(await readFile(ESTRATEGIA_PATH, 'utf8'))
  } catch {
    estrategia = null
  }
  const report = buildReport(data, estrategia)
  const markdown = [
    `# ${report.title}`,
    '',
    `**${report.subtitle}**`,
    `Gerado em ${report.date} — dados públicos TSE 2022 (1º turno). Documento interno de campanha.`,
    '',
    report.sections
      .map(
        (section) =>
          `## ${section.title}${section.subtitle ? `\n\n_${section.subtitle}_` : ''}\n\n${renderBlocksMd(section.blocks)}`,
      )
      .join('\n\n'),
    '',
    '---',
    '',
    ...data.validation.map((check) => `- ${check}`),
    '',
  ].join('\n')
  await mkdir(dirname(REPORT_BASE), { recursive: true })
  await writeFile(`${REPORT_BASE}.md`, markdown)
  console.log(`[${LABEL}] wrote ${REPORT_BASE}.md`)

  const html = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>${htmlEscape(report.title)}</title><style>${css}</style></head>
<body>
  <section class="cover">
    <div class="cover-top">
      <div class="brand">Campanha Jorge Solla 1313 · Análise territorial</div>
      <h1>${htmlEscape(report.title)}</h1>
      <div class="cover-rule"></div>
      <p class="subtitle">${htmlEscape(report.subtitle)}</p>
    </div>
    <div>
      <div class="kpis">${renderKpis(report)}</div>
      <p class="cover-meta">${htmlEscape(report.date)} · Fonte: TSE 2022 (dados públicos) · Uso interno da assessoria<br>
      Jorge Solla 1313 (dep. federal) · Julio Pinheiro 13999 (dep. estadual) · Lula 13 e Jerônimo 13 (2022)</p>
    </div>
  </section>
  ${report.sections.map(renderSectionHtml).join('')}
</body>
</html>`
  await writeFile(HTML_PATH, html)

  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    await page.emulateMedia({ media: 'print' })
    await page.pdf({
      path: `${REPORT_BASE}.pdf`,
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<div></div>',
      footerTemplate: `<div style="width:100%;font-family:'Fira Sans',sans-serif;font-size:7pt;color:#a1a1aa;padding:0 12mm;display:flex;justify-content:space-between;">
        <span>Expansão por seção — Solla 1313 · campo PT estadual · TSE 2022 · documento interno</span>
        <span>pág. <span class="pageNumber"></span>/<span class="totalPages"></span></span>
      </div>`,
      margin: { top: '12mm', bottom: '14mm', left: '12mm', right: '12mm' },
    })
  } finally {
    await browser.close()
  }
  console.log(`[${LABEL}] wrote ${REPORT_BASE}.pdf`)
}

const main = async () => {
  const cached = await readFile(DATA_PATH, 'utf8').catch(() => null)
  const data = process.argv.includes('--compute') || !cached ? await compute() : JSON.parse(cached)
  await render(data)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
