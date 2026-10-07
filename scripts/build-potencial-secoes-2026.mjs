/**
 * S46 — "story da sua seção": plataforma por seção eleitoral, presidente T1 2026.
 *
 * Constrói o artefato commitado que a página pública `/potencial` lê: para cada
 * seção eleitoral do Brasil, os números do cenário aprovado — aptos,
 * comparecimento, votos de Lula (13), votos de Flávio (22) e válidos
 * (nominais) — de onde saem X₁ = comparecimento − Lula − Flávio (nulos +
 * brancos + TODOS os terceiros) e X₂ = aptos − Lula − Flávio.
 *
 * As constantes de auditoria nacional/BA estão pinadas: um bulk re-publicado
 * pelo TSE falha fechado até um PR deliberado atualizar os pins.
 *
 * Fontes (Portal de Dados Abertos do TSE, 1º turno de 04/10/2026):
 *   votacao_secao_2026_BR.zip            votos por candidato por seção (presidente)
 *   detalhe_votacao_secao_2026.zip       aferição por seção × cargo (CSV BRASIL)
 * Portal: https://dadosabertos.tse.jus.br/dataset/resultados-2026
 * Licença: Creative Commons Atribuição (dados abertos TSE).
 *
 * Saída: public/dados/potencial-secao-2026/<UF>.json + manifest.json.
 * Nunca roda em build/deploy — o artefato é commitado.
 *
 * Uso:
 *   pnpm build:potencial-secoes
 *   pnpm build:potencial-secoes -- --only=BA
 */

import { parse as parseCsv } from 'csv-parse'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { open as openZip } from 'yauzl'

import {
  dieWithLabel,
  ensureCachedDownload,
  parseEqualsFlags,
  sha256Hex,
  writeRepoFile,
} from './lib/cli.mjs'

// Donos únicos (tsx resolve os paths do tsconfig): a lista de UFs e a versão do
// shard vivem no lib que o runtime lê; as divergências de nome da BA e o
// normalizador de busca vêm dos módulos compartilhados do repo.
const { POTENTIAL_SHARD_VERSION, POTENTIAL_UFS } = await import('../src/lib/sectionPotential.ts')
const { MUNICIPALITY_NAME_ALIASES } = await import('../src/lib/municipalityNameAliases.ts')
const { normalizeSearchPhrase } = await import('../src/lib/wordStartFilter.ts')

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LABEL = 'build-potencial-secoes-2026'
const die = dieWithLabel(LABEL)

const CACHE_DIR = join(ROOT, 'data/tse-2026')
const OUTPUT_DIR = 'public/dados/potencial-secao-2026'

/** O CDN do TSE recusa user-agent headless (C161); o download usa UA de browser. */
const BROWSER_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'

const PRESIDENT_OFFICE = '1'
const FIRST_TURN = '1'
const LULA_VOTAVEL = 13
const FLAVIO_VOTAVEL = 22
const BRANCO_VOTAVEL = 95
const NULO_VOTAVEL = 96

const SOURCES = [
  {
    key: 'votacao_secao_2026_BR',
    url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_secao/votacao_secao_2026_BR.zip',
    // sha256 do zip baixado em 2026-10-07 (ver manifest.json).
    sha256: '2d42006d0f6c6e00bad83f5c23cd3d78cd3e3182dbc1ad6718222b6b132c23e1',
  },
  {
    key: 'detalhe_votacao_secao_2026',
    url: 'https://cdn.tse.jus.br/estatistica/sead/odsele/detalhe_votacao_secao/detalhe_votacao_secao_2026.zip',
    sha256: '0b1297dc7ae4a46b6ee0428d0f60b9ab9da6b53419ef7580d9ca20662a192cb1',
  },
]

const VOTACAO_ENTRY = 'votacao_secao_2026_BR.csv'
const DETALHE_ENTRY = 'detalhe_votacao_secao_2026_BRASIL.csv'

/**
 * Auditoria nacional do presidente T1 2026 (medida em 2026-10-07 dos CSVs,
 * escopo Brasil — o exterior `ZZ` fica fora do produto, que consulta a UF do
 * título): qualquer divergência aborta a ingestão. Atualizar exige PR.
 */
const NATIONAL_AUDIT = {
  sections: 497_897,
  aptos: 157_828_968,
  comparecimento: 124_934_069,
  nominais: 118_975_029,
  brancos: 2_294_982,
  nulos: 3_664_058,
  lula: 53_722_151,
  flavio: 55_960_603,
  candidateVotes: 118_975_029,
  candidates: 13,
}

/** Auditoria do recorte BA (mesma data) — usada no `--only=BA`. */
const UF_AUDIT = {
  BA: {
    sections: 35_476,
    aptos: 11_312_752,
    comparecimento: 9_053_601,
    nominais: 8_560_542,
    brancos: 154_936,
    nulos: 338_123,
    lula: 5_664_771,
    flavio: 2_442_585,
  },
}

const int = new Intl.NumberFormat('pt-BR')

const downloadZip = async (url) => {
  const response = await fetch(url, { headers: { 'user-agent': BROWSER_UA } })
  if (!response.ok) throw new Error(`download falhou (${response.status}): ${url}`)
  return Buffer.from(await response.arrayBuffer())
}

// ---------------------------------------------------------------------------
// Zip streaming (yauzl + csv-parse; nada é descompactado em disco)
// ---------------------------------------------------------------------------

const openZipEntryStream = (zipPath, matchEntry) =>
  new Promise((resolve, reject) => {
    openZip(zipPath, { lazyEntries: true }, (error, zipfile) => {
      if (error || !zipfile) {
        reject(error ?? new Error(`não abriu ${zipPath}`))
        return
      }
      zipfile.readEntry()
      zipfile.on('entry', (entry) => {
        if (/\/$/.test(entry.fileName) || !matchEntry(entry.fileName)) {
          zipfile.readEntry()
          return
        }
        zipfile.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            reject(streamError ?? new Error(`não leu ${entry.fileName}`))
            return
          }
          stream.on('end', () => {
            try {
              zipfile.close()
            } catch {
              // o fd já pode ter sido fechado pelo autoClose do yauzl
            }
          })
          resolve(stream)
        })
      })
      zipfile.on('end', () => reject(new Error(`entrada não encontrada em ${zipPath}`)))
      zipfile.on('error', reject)
    })
  })

/**
 * Linhas de um CSV dentro do zip (TSE: ISO-8859-1, `;`, campos citados).
 * `latin1` é aplicado no stream antes do parser para não decodificar UTF-8.
 */
async function* zipEntryRows(zipPath, matchEntry) {
  const stream = await openZipEntryStream(zipPath, matchEntry)
  stream.setEncoding('latin1')
  const parser = parseCsv({
    columns: true,
    delimiter: ';',
    relax_quotes: true,
    relax_column_count: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  })
  stream.pipe(parser)
  for await (const row of parser) yield row
}

const num = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

// ---------------------------------------------------------------------------
// Nomes de exibição (TSE em caixa alta → nome canônico do cadastro do repo)
// ---------------------------------------------------------------------------

/**
 * Divergências de grafia TSE × cadastro do repo. As da Bahia vêm do dono
 * (`MUNICIPALITY_NAME_ALIASES`, o mesmo fold dos imports de apoiador); as
 * demais UFs não têm cadastro curado — o fallback é o próprio nome do TSE em
 * title case, nunca um erro.
 */
const EXTRA_NAME_ALIASES = {
  // Chave já no formato de `normalizeSearchPhrase` (minúsculas, pontuação → espaço).
  'RS|sant ana do livramento': "Sant'Ana do Livramento",
}

const titleCaseName = (value) => {
  const small = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])
  return value
    .toLocaleLowerCase('pt-BR')
    .split(' ')
    .map((word, index) =>
      index > 0 && small.has(word)
        ? word
        : word.replace(/^([a-zà-öø-ÿ])/, (letter) => letter.toLocaleUpperCase('pt-BR')),
    )
    .join(' ')
}

const buildNameResolver = (citiesByState, baAliases) => {
  const canonical = new Map()
  for (const [uf, cities] of Object.entries(citiesByState)) {
    for (const name of cities) canonical.set(`${uf}|${normalizeSearchPhrase(name)}`, name)
  }
  for (const [variant, name] of baAliases) {
    canonical.set(`BA|${normalizeSearchPhrase(variant)}`, name)
  }
  for (const [key, name] of Object.entries(EXTRA_NAME_ALIASES)) canonical.set(key, name)
  const stats = { matched: 0, fallback: 0, examples: [] }
  return {
    resolve: (uf, tseName) => {
      const hit = canonical.get(`${uf}|${normalizeSearchPhrase(tseName)}`)
      if (hit) {
        stats.matched += 1
        return hit
      }
      stats.fallback += 1
      if (stats.examples.length < 200) stats.examples.push(`${uf}: ${tseName}`)
      return titleCaseName(tseName)
    },
    stats,
  }
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

const auditPatch = (totals, audit) => {
  const diffs = []
  for (const [field, expected] of Object.entries(audit)) {
    const found = totals[field]
    if (found !== expected)
      diffs.push(`${field}: esperado ${int.format(expected)}, encontrado ${int.format(found)}`)
  }
  return diffs
}

async function main() {
  const { flags } = parseEqualsFlags(process.argv.slice(2))
  const selected = new Set(
    flags.only
      ? String(flags.only)
          .split(',')
          .map((uf) => uf.trim().toUpperCase())
          .filter(Boolean)
      : POTENTIAL_UFS,
  )
  if (selected.size === 0) die('--only está vazio — informe ao menos uma UF (ex.: --only=BA).')
  for (const uf of selected) if (!POTENTIAL_UFS.includes(uf)) die(`UF fora do Brasil: ${uf}`)

  const runAll = selected.size === POTENTIAL_UFS.length
  console.log(`[${LABEL}] UFs: ${[...selected].join(', ')}${runAll ? ' (nacional)' : ''}`)

  const { CitiesByState } = await import('../src/lib/cities.ts')
  const names = buildNameResolver(CitiesByState, MUNICIPALITY_NAME_ALIASES)

  // 1. Downloads (cache em data/tse-2026/, gitignored) + hashes pinados.
  const downloaded = {}
  const sourceReceipt = []
  for (const source of SOURCES) {
    console.log(`[${LABEL}] garantindo ${source.key}.zip`)
    const cached = await ensureCachedDownload({
      label: LABEL,
      key: source.key,
      url: source.url,
      ext: 'zip',
      cacheDir: CACHE_DIR,
      expectedSha256: source.sha256,
      download: downloadZip,
    })
    downloaded[source.key] = join(CACHE_DIR, `${source.key}.zip`)
    sourceReceipt.push({
      key: source.key,
      url: cached.url,
      sha256: cached.hash,
      bytes: cached.buffer.length,
    })
  }

  // 2. Aferição por seção (CSV BRASIL): universo de seções + aptos/comp/válidos.
  const sections = new Map()
  const tseNames = new Map()
  const totals = {
    sections: 0,
    aptos: 0,
    comparecimento: 0,
    nominais: 0,
    brancos: 0,
    nulos: 0,
    lula: 0,
    flavio: 0,
  }
  console.log(`[${LABEL}] lendo aferição por seção (presidente, T1)...`)
  for await (const row of zipEntryRows(downloaded.detalhe_votacao_secao_2026, (name) =>
    name.endsWith(DETALHE_ENTRY),
  )) {
    if (row.NR_TURNO !== FIRST_TURN || row.CD_CARGO !== PRESIDENT_OFFICE) continue
    const uf = row.SG_UF
    if (!selected.has(uf)) continue
    const key = `${uf}|${row.CD_MUNICIPIO}|${Number(row.NR_ZONA)}|${Number(row.NR_SECAO)}`
    sections.set(key, [
      num(row.QT_APTOS),
      num(row.QT_COMPARECIMENTO),
      num(row.QT_VOTOS_NOMINAIS),
      0,
      0,
    ])
    tseNames.set(`${uf}|${row.CD_MUNICIPIO}`, row.NM_MUNICIPIO)
    totals.sections += 1
    totals.aptos += num(row.QT_APTOS)
    totals.comparecimento += num(row.QT_COMPARECIMENTO)
    totals.nominais += num(row.QT_VOTOS_NOMINAIS)
    totals.brancos += num(row.QT_VOTOS_BRANCOS)
    totals.nulos += num(row.QT_VOTOS_NULOS)
  }
  console.log(`[${LABEL}] seções: ${int.format(sections.size)}`)
  if (sections.size === 0) die('nenhuma seção carregada — confira a UF do --only.')

  // 3. Votos por candidato (arquivo BR inteiro, um passe): Lula/Flávio por seção
  //    + total nacional de todas as candidaturas (auditoria).
  const candidateVotes = new Map()
  let missingSections = 0
  let seenLula = 0
  let seenFlavio = 0
  console.log(`[${LABEL}] lendo votos por seção (presidente, T1)...`)
  for await (const row of zipEntryRows(downloaded.votacao_secao_2026_BR, (name) =>
    name.endsWith(VOTACAO_ENTRY),
  )) {
    if (row.NR_TURNO !== FIRST_TURN || row.CD_CARGO !== PRESIDENT_OFFICE) continue
    const uf = row.SG_UF
    if (!selected.has(uf)) continue
    const number = num(row.NR_VOTAVEL)
    const votes = num(row.QT_VOTOS)
    if (number !== BRANCO_VOTAVEL && number !== NULO_VOTAVEL) {
      candidateVotes.set(number, (candidateVotes.get(number) ?? 0) + votes)
    }
    if (number !== LULA_VOTAVEL && number !== FLAVIO_VOTAVEL) continue
    const key = `${uf}|${row.CD_MUNICIPIO}|${Number(row.NR_ZONA)}|${Number(row.NR_SECAO)}`
    const section = sections.get(key)
    if (!section) {
      missingSections += 1
      continue
    }
    if (number === LULA_VOTAVEL) {
      seenLula += 1
      section[3] += votes
      totals.lula += votes
    } else {
      seenFlavio += 1
      section[4] += votes
      totals.flavio += votes
    }
  }

  const candidateTotal = [...candidateVotes.values()].reduce((sum, votes) => sum + votes, 0)
  totals.candidateVotes = candidateTotal
  totals.candidates = candidateVotes.size

  // 4. Validações estruturais e pinadas (fail-closed).
  const validation = []
  const structural = []
  if (totals.comparecimento !== totals.nominais + totals.brancos + totals.nulos) {
    structural.push(
      `comparecimento (${int.format(totals.comparecimento)}) ≠ nominais+brancos+nulos ` +
        `(${int.format(totals.nominais + totals.brancos + totals.nulos)})`,
    )
  }
  if (totals.candidateVotes !== totals.nominais) {
    structural.push(
      `soma das candidaturas (${int.format(totals.candidateVotes)}) ≠ nominais ` +
        `(${int.format(totals.nominais)})`,
    )
  }
  if (missingSections > 0) {
    structural.push(`${int.format(missingSections)} votos de seção fora da aferição`)
  }
  // Sem os dois votáveis o shard sairia com colunas zeradas em silêncio (as
  // auditorias pinadas só cobrem BR e BA).
  if (seenLula === 0 || seenFlavio === 0) {
    structural.push(
      `votáveis ausentes no recorte: Lula=${int.format(seenLula)} linhas, Flávio=${int.format(seenFlavio)} linhas`,
    )
  }
  let negative = 0
  for (const section of sections.values()) {
    if (section[1] < section[3] + section[4]) negative += 1
  }
  if (negative > 0)
    structural.push(`${int.format(negative)} seções com Lula+Flávio > comparecimento`)
  if (structural.length > 0) die(`invariantes violadas:\n  - ${structural.join('\n  - ')}`)
  validation.push(
    `estruturais: comparecimento = nominais + brancos + nulos; soma das ${int.format(candidateVotes.size)} candidaturas = nominais; nenhuma seção sem aferição; Lula+Flávio ≤ comparecimento.`,
  )

  if (runAll) {
    const diffs = auditPatch(totals, NATIONAL_AUDIT)
    if (diffs.length > 0) die(`auditoria nacional divergiu:\n  - ${diffs.join('\n  - ')}`)
    validation.push(
      'auditoria nacional pinada confere (seções, aptos, comparecimento, nominais, brancos, nulos, Lula, Flávio, candidaturas).',
    )
  } else if (selected.size === 1) {
    const uf = [...selected][0]
    const audit = UF_AUDIT[uf]
    if (audit) {
      const diffs = auditPatch(totals, audit)
      if (diffs.length > 0) die(`auditoria de ${uf} divergiu:\n  - ${diffs.join('\n  - ')}`)
      validation.push(`auditoria pinada de ${uf} confere.`)
    } else {
      validation.push(`sem auditoria pinada para ${uf} — receita gerada sem conferência.`)
    }
  } else {
    validation.push(
      'recorte com mais de uma UF e sem auditoria nacional — receita gerada sem conferência.',
    )
  }

  // 5. Shards por UF.
  const byUf = new Map()
  for (const [key, value] of sections) {
    const [uf, code, zone, section] = key.split('|')
    let municipalities = byUf.get(uf)
    if (!municipalities) {
      municipalities = new Map()
      byUf.set(uf, municipalities)
    }
    let municipality = municipalities.get(code)
    if (!municipality) {
      municipality = {
        code: Number(code),
        name: names.resolve(uf, tseNames.get(`${uf}|${code}`) ?? String(code)),
        sections: [],
      }
      municipalities.set(code, municipality)
    }
    municipality.sections.push([
      Number(zone),
      Number(section),
      value[0],
      value[1],
      value[3],
      value[4],
      value[2],
    ])
  }

  const ufReceipt = {}
  let totalBytes = 0
  for (const uf of selected) {
    const municipalities = [...(byUf.get(uf)?.values() ?? [])]
    for (const municipality of municipalities) {
      municipality.sections.sort((left, right) => left[0] - right[0] || left[1] - right[1])
    }
    municipalities.sort((left, right) => left.code - right.code)
    const body = JSON.stringify({ version: POTENTIAL_SHARD_VERSION, uf, municipalities })
    await writeRepoFile({
      label: LABEL,
      root: ROOT,
      relativePath: `${OUTPUT_DIR}/${uf}.json`,
      body,
    })
    const bytes = Buffer.byteLength(body)
    totalBytes += bytes
    ufReceipt[uf] = {
      file: `${uf}.json`,
      sha256: sha256Hex(Buffer.from(body)),
      bytes,
      municipalities: municipalities.length,
      sections: municipalities.reduce((sum, item) => sum + item.sections.length, 0),
    }
  }

  // 6. Manifest: o run nacional grava o recibo completo; um `--only` só
  // atualiza as UFs regravadas dentro do recibo existente (totais e auditoria
  // nacionais continuam os do run completo).
  const manifestPath = `${OUTPUT_DIR}/manifest.json`
  let manifest
  if (runAll) {
    manifest = {
      version: POTENTIAL_SHARD_VERSION,
      generatedAt: new Date().toISOString(),
      scope: 'BR',
      sources: sourceReceipt,
      candidates: {
        lula: LULA_VOTAVEL,
        flavio: FLAVIO_VOTAVEL,
        count: candidateVotes.size,
        votesByNumber: Object.fromEntries(
          [...candidateVotes].sort((left, right) => left[0] - right[0]),
        ),
      },
      totals,
      ufs: ufReceipt,
      validation,
    }
  } else {
    const existing = await readFile(join(ROOT, manifestPath), 'utf8').catch(() => null)
    if (!existing) die(`manifest nacional ausente — rode o run completo antes de um --only`)
    manifest = JSON.parse(existing)
    manifest.generatedAt = new Date().toISOString()
    manifest.ufs = { ...manifest.ufs, ...ufReceipt }
    manifest.validation = [
      ...manifest.validation,
      `recorte ${[...selected].join(', ')} regravado em ${new Date().toISOString()} — ${validation.join(' ')}`,
    ]
  }
  await writeRepoFile({
    label: LABEL,
    root: ROOT,
    relativePath: manifestPath,
    body: `${JSON.stringify(manifest, null, 2)}\n`,
  })

  console.log(
    `[${LABEL}] pronto: ${Object.keys(ufReceipt).length} UFs, ${int.format(sections.size)} seções, ` +
      `${(totalBytes / 1024 / 1024).toFixed(1)} MB de dados; nomes canônicos=${int.format(names.stats.matched)} ` +
      `fallback=${int.format(names.stats.fallback)}${names.stats.examples.length ? ` (ex.: ${names.stats.examples.join('; ')})` : ''}`,
  )
  console.log(
    `[${LABEL}] totais: Lula=${int.format(totals.lula)} Flávio=${int.format(totals.flavio)} nominais=${int.format(totals.nominais)}`,
  )
}

await main()
