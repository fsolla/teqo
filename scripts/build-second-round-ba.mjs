/**
 * Builds the committed 2º-turno artifact (`bahia-second-round-2026.json`):
 * Lula × Flávio in Bahia, 2022 → 1º turno 2026, cut by the same
 * `municipalityCatalog` geography the campaign uses (Salvador split by ZE).
 *
 * Why an artifact: the campaign DB has Solla 2014/2018/2022 and the 2026
 * estimates, and the official presidential 1º turno 2026 lives in the committed
 * `public/dados/potencial-secao-2026/BA.json` (per section). Solla's official
 * 2026 federal result and the 2022 adversary slice come from the internal
 * analysis repo (analise-eleicoes-2026 / nota-solla-2turno). This builder joins
 * the two, validates each 2026 number against an independent source, cross-checks
 * 2022 against `bahia-federal-baseline.json` and pins the BA totals.
 *
 * Inputs:
 *   - public/dados/potencial-secao-2026/BA.json      TSE 2026 presidente T1 (por seção)
 *   - src/lib/electionAggregates/bahia-federal-baseline.json  Solla/Lula 2022 (cross-check)
 *   - --analysis-dir=<dir>   outputs of analise-eleicoes-2026 (default ../analise-eleicoes-2026/bahia):
 *       solla_municipios.csv, ba_ausentes_bn.csv, salvador_ze_v3.csv, solla_ze_salvador.csv
 *
 * Output: src/lib/electionAggregates/bahia-second-round-2026.json
 * Uso: pnpm build:second-round -- [--analysis-dir=<dir>] [--check]
 *
 * Never runs at build/deploy time — the artifact is committed (same rule as
 * `pnpm build:election-aggregates`).
 */

import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse as parseCsvSync } from 'csv-parse/sync'

import { dieWithLabel, parseEqualsFlags, writeRepoFile } from './lib/cli.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LABEL = 'build-second-round-ba'
const die = dieWithLabel(LABEL)

const ARTIFACT_PATH = 'src/lib/electionAggregates/bahia-second-round-2026.json'
const SHARD_PATH = 'public/dados/potencial-secao-2026/BA.json'
const BASELINE_PATH = 'src/lib/electionAggregates/bahia-federal-baseline.json'
const DEFAULT_ANALYSIS_DIR = resolve(ROOT, '..', 'analise-eleicoes-2026', 'bahia')

/**
 * Audited Bahia totals (TSE, 1º turno 2026, 100% apurado) — sum over the 435
 * catalog units (Salvador once, through its 19 ZE). Any divergence aborts the
 * build: a re-published bulk or a changed analysis must be a deliberate PR.
 */
const BA_PINS = {
  aptos26: 11_312_752,
  comparecimento26: 9_053_601,
  lula26: 5_664_771,
  adversary26: 2_442_585,
  validos26: 8_560_542,
  lula22: 5_873_081,
  adversary22: 2_047_599,
  solla22: 128_968,
  solla26: 152_049,
}

const { municipalityCatalog } = await import('../src/lib/municipalityCatalog.ts')
const { classifySecondRoundRole } = await import('../src/lib/secondRoundRole.ts')

const { flags } = parseEqualsFlags(process.argv.slice(2))
const analysisDir = resolve(
  ROOT,
  typeof flags['analysis-dir'] === 'string' ? flags['analysis-dir'] : DEFAULT_ANALYSIS_DIR,
)
const checkOnly = flags.check === true

const int = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) die(`Número inválido: ${JSON.stringify(value)}`)
  return Math.round(parsed)
}

const readJson = async (relativePath) => {
  try {
    return JSON.parse(await readFile(resolve(ROOT, relativePath), 'utf8'))
  } catch (error) {
    die(`Falha ao ler ${relativePath}: ${error instanceof Error ? error.message : error}`)
  }
}

const readCsv = async (fileName) => {
  const path = join(analysisDir, fileName)
  let text
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    die(
      `Falha ao ler ${path}: ${error instanceof Error ? error.message : error}\n` +
        '  Passe --analysis-dir=<diretório com os CSVs da análise 2º turno>.',
    )
  }
  return parseCsvSync(text, {
    columns: true,
    delimiter: ';',
    skip_empty_lines: true,
    trim: true,
    bom: true,
    relax_quotes: true,
    relax_column_count: true,
  })
}

const indexBy = (rows, key) => {
  const map = new Map()
  for (const row of rows) map.set(String(row[key]), row)
  return map
}

/**
 * 2026 president aggregates from the committed per-section shard: one pass over
 * the 417 municipalities, accumulating `aptos, comparecimento, lula, flávio,
 * válidos` per município and — for Salvador — per zone (the campaign unit).
 */
const aggregateShard = (shard) => {
  const byMunicipality = new Map()
  const salVadorByZone = new Map()
  for (const municipality of shard.municipalities) {
    const code = String(municipality.code)
    const total = { aptos: 0, comparecimento: 0, lula: 0, adversary: 0, validos: 0 }
    for (const [zone, , aptos, comparecimento, lula, adversary, validos] of municipality.sections) {
      total.aptos += aptos
      total.comparecimento += comparecimento
      total.lula += lula
      total.adversary += adversary
      total.validos += validos
      if (code === '38490') {
        const zoneTotal = salVadorByZone.get(zone) ?? {
          aptos: 0,
          comparecimento: 0,
          lula: 0,
          adversary: 0,
          validos: 0,
        }
        zoneTotal.aptos += aptos
        zoneTotal.comparecimento += comparecimento
        zoneTotal.lula += lula
        zoneTotal.adversary += adversary
        zoneTotal.validos += validos
        salVadorByZone.set(zone, zoneTotal)
      }
    }
    byMunicipality.set(code, total)
  }
  return { byMunicipality, salVadorByZone }
}

const failCheck = (failures) => {
  if (!failures.length) return
  die(
    `Divergência de validação (${failures.length}):\n  ` +
      failures
        .slice(0, 20)
        .map((line) => `- ${line}`)
        .join('\n  ') +
      (failures.length > 20 ? `\n  … e mais ${failures.length - 20}.` : ''),
  )
}

const main = async () => {
  const [shard, baseline] = await Promise.all([readJson(SHARD_PATH), readJson(BASELINE_PATH)])
  const [sollaMunicipios, ausentesBn, salvadorZe, sollaSalvadorZe] = await Promise.all([
    readCsv('solla_municipios.csv'),
    readCsv('ba_ausentes_bn.csv'),
    readCsv('salvador_ze_v3.csv'),
    readCsv('solla_ze_salvador.csv'),
  ])

  const sollaByCity = indexBy(sollaMunicipios, 'cd_tse')
  const ausByCity = indexBy(ausentesBn, 'cd')
  const salZeByZone = indexBy(salvadorZe, 'zona')
  const sollaSalZeByZone = indexBy(sollaSalvadorZe, 'zona')
  const { byMunicipality, salVadorByZone } = aggregateShard(shard)

  const failures = []
  const units = {}
  const totals = {
    aptos22: 0,
    aptos26: 0,
    comparecimento22: 0,
    comparecimento26: 0,
    abstencao22: 0,
    abstencao26: 0,
    brancosNulos22: 0,
    brancosNulos26: 0,
    validos22: 0,
    validos26: 0,
    lula22: 0,
    lula26: 0,
    adversary22: 0,
    adversary26: 0,
    solla22: 0,
    solla26: 0,
  }

  for (const entry of municipalityCatalog) {
    const isZone = entry.kind === 'zona'
    const zoneNumber = entry.zoneNumber ?? null
    const source = isZone ? sollaSalZeByZone.get(String(zoneNumber).padStart(4, '0')) : null
    const analysis = isZone ? salZeByZone.get(String(zoneNumber).padStart(4, '0')) : null
    const cityRow = isZone ? null : sollaByCity.get(entry.tseCityCode)
    const ausRow = isZone ? null : ausByCity.get(entry.tseCityCode)
    const shardRow = isZone ? salVadorByZone.get(zoneNumber) : byMunicipality.get(entry.tseCityCode)

    if (!shardRow) {
      failures.push(`${entry.slug}: sem agregado de 2026 no shard oficial`)
      continue
    }
    if (!isZone && (!cityRow || !ausRow)) {
      failures.push(`${entry.slug}: sem linha na análise 2º turno (${entry.tseCityCode})`)
      continue
    }
    if (isZone && (!source || !analysis)) {
      failures.push(`${entry.slug}: sem linha da análise para a ZE ${zoneNumber}`)
      continue
    }

    // 2022: análise (primary) — one table per kind, validated below against the
    // committed TSE baseline (Lula #13 and Solla 1313).
    const lula22 = int(isZone ? analysis.lula22 : cityRow.lula22)
    const adversary22 = int(isZone ? analysis.adv22 : cityRow.bolso22)
    const solla22 = int(isZone ? source.solla22 : cityRow.solla22)
    const aptos22 = int(isZone ? analysis.te22 : ausRow.aptos22)
    const abstencao22 = int(isZone ? analysis.abst22 : ausRow.abst22)
    const comparecimento22 = aptos22 - abstencao22
    const validos22 = int(isZone ? analysis.val22 : cityRow.validos22)
    const brancosNulos22 = comparecimento22 - validos22

    // 2026: shard oficial (per section) — the analysis numbers are the check.
    const lula26 = shardRow.lula
    const adversary26 = shardRow.adversary
    const aptos26 = shardRow.aptos
    const comparecimento26 = shardRow.comparecimento
    const validos26 = shardRow.validos
    const abstencao26 = aptos26 - comparecimento26
    const brancosNulos26 = comparecimento26 - validos26
    const solla26 = int(isZone ? source.solla26 : cityRow.solla26)

    if (!isZone) {
      if (lula26 !== int(cityRow.lula26))
        failures.push(`${entry.slug}: Lula26 shard ${lula26} ≠ análise ${cityRow.lula26}`)
      if (adversary26 !== int(cityRow.flavio26))
        failures.push(`${entry.slug}: Flávio26 shard ${adversary26} ≠ análise ${cityRow.flavio26}`)
      if (aptos26 !== int(ausRow.aptos26))
        failures.push(`${entry.slug}: aptos26 shard ${aptos26} ≠ análise ${ausRow.aptos26}`)
      if (comparecimento26 !== int(ausRow.aptos26) - int(ausRow.abst26))
        failures.push(
          `${entry.slug}: comp26 shard ${comparecimento26} ≠ análise ${int(ausRow.aptos26) - int(ausRow.abst26)}`,
        )
    } else {
      if (lula26 !== int(analysis.lula26))
        failures.push(`${entry.slug}: Lula26 shard ${lula26} ≠ análise ${analysis.lula26}`)
      if (adversary26 !== int(analysis.adv26))
        failures.push(`${entry.slug}: Flávio26 shard ${adversary26} ≠ análise ${analysis.adv26}`)
      if (aptos26 !== int(analysis.te26))
        failures.push(`${entry.slug}: aptos26 shard ${aptos26} ≠ análise ${analysis.te26}`)
      if (comparecimento26 !== int(analysis.comp26))
        failures.push(
          `${entry.slug}: comp26 shard ${comparecimento26} ≠ análise ${analysis.comp26}`,
        )
    }

    // 2022 cross-check against the committed Teqo baseline (independent source).
    const baselineUnit = baseline.municipalities?.[entry.slug]
    if (!baselineUnit) {
      failures.push(`${entry.slug}: fora do baseline TSE 2014/2018/2022`)
    } else {
      const baselineSolla22 = baselineUnit.votesByYear?.['2022'] ?? null
      if (baselineSolla22 !== solla22)
        failures.push(`${entry.slug}: Solla22 baseline ${baselineSolla22} ≠ análise ${solla22}`)
      const baselineLula22 = baselineUnit.majoritarian2022?.president?.votes ?? null
      if (baselineLula22 !== lula22)
        failures.push(`${entry.slug}: Lula22 baseline ${baselineLula22} ≠ análise ${lula22}`)
    }

    const dLula = lula26 - lula22
    const dAdversary = adversary26 - adversary22
    const dSolla = solla26 - solla22
    const role = classifySecondRoundRole({ dLula, dSolla, solla26 })

    units[entry.slug] = {
      name: entry.name,
      kind: entry.kind,
      tseCityCode: entry.tseCityCode,
      ibgeCode: entry.ibgeCode,
      zone: zoneNumber,
      role,
      lula22,
      lula26,
      dLula,
      adversary22,
      adversary26,
      dAdversary,
      solla22,
      solla26,
      dSolla,
      aptos22,
      aptos26,
      comparecimento22,
      comparecimento26,
      abstencao22,
      abstencao26,
      brancosNulos22,
      brancosNulos26,
      validos22,
      validos26,
    }

    for (const key of Object.keys(totals)) totals[key] += units[entry.slug][key]
  }

  for (const [key, expected] of Object.entries(BA_PINS)) {
    if (totals[key] !== expected)
      failures.push(`total BA ${key}: esperado ${expected}, encontrado ${totals[key]}`)
  }
  failCheck(failures)

  const artifact = {
    version: 1,
    generatedAt: new Date().toISOString(),
    scope: 'BA — 2º turno Lula × Flávio',
    provenance:
      'TSE 2026 presidente 1º turno por seção (public/dados/potencial-secao-2026/BA.json, oficial) + análise 2º turno da campanha (analise-eleicoes-2026/nota-solla-2turno) para Solla 2026 e a fatia de 2022; 2022 validado contra bahia-federal-baseline.json.',
    sources: {
      shard: SHARD_PATH,
      baseline: BASELINE_PATH,
      analysisDir:
        'analise-eleicoes-2026/bahia (solla_municipios, ba_ausentes_bn, salvador_ze_v3, solla_ze_salvador)',
    },
    pins: BA_PINS,
    totals,
    units,
  }

  if (checkOnly) {
    console.log(`[${LABEL}] OK — ${Object.keys(units).length} unidades, totais batem com os pins.`)
    return
  }

  await writeRepoFile({
    label: LABEL,
    root: ROOT,
    relativePath: ARTIFACT_PATH,
    body: `${JSON.stringify(artifact, null, 2)}\n`,
  })
  console.log(
    `[${LABEL}] ${Object.keys(units).length} unidades · Lula ${totals.lula26} · Flávio ${totals.adversary26} · Solla ${totals.solla26}`,
  )
}

await main()
