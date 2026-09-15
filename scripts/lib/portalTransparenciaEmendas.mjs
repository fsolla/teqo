/**
 * Emendas oficiais em tempo de geração (C163) — Portal da Transparência.
 *
 * Read-only by design: the report fetches the author's amendments for the
 * município, prints the phase (empenhada/liquidada/paga/restos) and never
 * persists anything. Any failure degrades to an explicit gap; it never prints
 * a silent zero.
 */

const EMENDAS_API_URL = 'https://api.portaldatransparencia.gov.br/api-de-dados/emendas'
export const DEFAULT_AUTHOR_NAME = 'JORGE SOLLA'
export const EMENDAS_YEARS = [2023, 2024, 2025, 2026]

const normalizeAuthorName = (value) =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()

export const authorNameMatches = (candidate, expected) =>
  normalizeAuthorName(candidate) === normalizeAuthorName(expected)

/**
 * The Portal returns amounts as pt-BR strings ("81.000,00"); `Number()` alone
 * would zero every row. Numbers stay accepted for replays/fixtures.
 */
const parseAmount = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value !== 'string') return 0
  const raw = value.trim()
  if (raw === '') return 0
  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(/\./g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

/** The API row shape the report actually uses — the rest is discarded. */
export const normalizeEmendaRow = (row) => ({
  code: typeof row?.codigoEmenda === 'string' ? row.codigoEmenda : null,
  year: Number(row?.ano) || null,
  type: typeof row?.tipoEmenda === 'string' ? row.tipoEmenda : null,
  authorCode: row?.codigoAutor !== undefined ? String(row.codigoAutor) : null,
  authorName: typeof row?.nomeAutor === 'string' ? row.nomeAutor : null,
  functionName: typeof row?.nomeFuncao === 'string' ? row.nomeFuncao : null,
  empenhado: parseAmount(row?.valorEmpenhado),
  liquidado: parseAmount(row?.valorLiquidado),
  pago: parseAmount(row?.valorPago),
  restoPago: parseAmount(row?.valorRestoPago),
})

const rowMunicipalityCode = (row) => {
  const candidate = row?.codigoMunicipio ?? row?.codigoMunicipioIbge ?? row?.municipio?.codigoIbge
  return candidate === undefined || candidate === null ? null : String(candidate)
}

const normalizeText = (value) =>
  String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim()

/**
 * The `/emendas` endpoint has no municipality parameter (official swagger:
 * codigoEmenda, numeroEmenda, nomeAutor, tipoEmenda, ano, codigoFuncao,
 * codigoSubfuncao, pagina) and does not expose `codigoMunicipio` per row. The
 * only per-city signal is `localidadeDoGasto` ("ITAMARAJU - BA"); rows at UF /
 * "Nacional" / "MÚLTIPLO" level are not attributable to the município and are
 * dropped (fail-closed) instead of inflating the city total.
 */
const localityMatchesMunicipality = (locality, municipalityName) => {
  const normalizedLocality = normalizeText(locality)
  const normalizedName = normalizeText(municipalityName)
  if (!normalizedLocality || !normalizedName) return false
  return (
    normalizedLocality === normalizedName || normalizedLocality.startsWith(`${normalizedName} -`)
  )
}

export const sumEmendas = (rows) =>
  rows.reduce(
    (totals, row) => ({
      empenhado: totals.empenhado + parseAmount(row.empenhado),
      liquidado: totals.liquidado + parseAmount(row.liquidado),
      pago: totals.pago + parseAmount(row.pago),
      restoPago: totals.restoPago + parseAmount(row.restoPago),
    }),
    { empenhado: 0, liquidado: 0, pago: 0, restoPago: 0 },
  )

const gapResult = ({ reason, detail = null, sourceUrl, consultedAt, requestCount, years }) => ({
  status: 'gap',
  reason,
  detail,
  sourceUrl,
  consultedAt,
  requestCount,
  years,
  rows: [],
  totals: sumEmendas([]),
})

const fetchAuthorYear = async ({ fetchImpl, apiKey, authorName, year, maxPages }) => {
  const rows = []
  let requests = 0
  for (let page = 1; page <= maxPages; page += 1) {
    const params = new URLSearchParams({
      ano: String(year),
      nomeAutor: authorName,
      pagina: String(page),
    })
    const url = `${EMENDAS_API_URL}?${params.toString()}`
    requests += 1
    const response = await fetchImpl(url, {
      headers: { 'chave-api-dados': apiKey, Accept: 'application/json' },
    })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} em ${year} (página ${page})`)
    }
    const payload = await response.json()
    const pageRows = Array.isArray(payload) ? payload : []
    rows.push(...pageRows)
    if (pageRows.length === 0) break
  }
  return { rows, requests }
}

/**
 * @typedef {Object} EmendaRow
 * @property {string | null} code
 * @property {number | null} year
 * @property {string | null} type
 * @property {string | null} authorCode
 * @property {string | null} authorName
 * @property {string | null} functionName
 * @property {number} empenhado
 * @property {number} liquidado
 * @property {number} pago
 * @property {number} restoPago
 */

/**
 * @typedef {Object} EmendasResult
 * @property {'ok' | 'gap'} status
 * @property {string | null} reason
 * @property {string | null} detail
 * @property {string | null} sourceUrl
 * @property {string} consultedAt
 * @property {number} requestCount
 * @property {number[]} years
 * @property {EmendaRow[]} rows
 * @property {{ empenhado: number, liquidado: number, pago: number, restoPago: number }} totals
 * @property {string} [authorName]
 * @property {string | null} [authorCode]
 */

/**
 * Fetches the author's amendments for the município across the mandate years.
 * `fetchImpl` is injectable so the unit tests never touch the network.
 *
 * @param {{
 *   years?: number[],
 *   municipalityCode?: string | null,
 *   municipalityName?: string | null,
 *   authorName?: string,
 *   apiKey?: string | null,
 *   fetchImpl?: (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean, status: number, json: () => Promise<unknown> }>,
 *   consultedAt?: string,
 *   maxPages?: number,
 * }} [options]
 * @returns {Promise<EmendasResult>}
 */
export const fetchAuthorEmendas = async ({
  years = EMENDAS_YEARS,
  municipalityCode = null,
  municipalityName = null,
  authorName = DEFAULT_AUTHOR_NAME,
  apiKey = null,
  fetchImpl = fetch,
  consultedAt = new Date().toISOString(),
  maxPages = 20,
} = {}) => {
  if (!apiKey) {
    return gapResult({
      reason: 'Chave da API do Portal da Transparência ausente.',
      detail: 'Defina PORTAL_TRANSPARENCIA_API_KEY no ambiente do gerador.',
      sourceUrl: EMENDAS_API_URL,
      consultedAt,
      requestCount: 0,
      years,
    })
  }

  const requestsByYear = []
  const collected = []
  try {
    for (const year of years) {
      const result = await fetchAuthorYear({
        fetchImpl,
        apiKey,
        authorName,
        year,
        maxPages,
      })
      requestsByYear.push({ year, requests: result.requests })
      collected.push(...result.rows)
    }
  } catch (error) {
    return gapResult({
      reason: 'Falha ao consultar a API de emendas.',
      detail: String(error?.message ?? error),
      sourceUrl: EMENDAS_API_URL,
      consultedAt,
      requestCount: requestsByYear.reduce((total, entry) => total + entry.requests, 0),
      years,
    })
  }

  const sourceUrl = `${EMENDAS_API_URL}?nomeAutor=${encodeURIComponent(authorName)}`
  const requestCount = requestsByYear.reduce((total, entry) => total + entry.requests, 0)

  const matched = collected.filter((row) => authorNameMatches(row?.nomeAutor, authorName))
  const distinctAuthorCodes = [
    ...new Set(matched.map((row) => String(row?.codigoAutor ?? ''))),
  ].filter((code) => code !== '')

  if (matched.length === 0) {
    return {
      ...gapResult({
        reason: 'Nenhuma emenda do autor encontrada para o município na janela consultada.',
        sourceUrl,
        consultedAt,
        requestCount,
        years,
      }),
    }
  }

  if (distinctAuthorCodes.length > 1) {
    return {
      ...gapResult({
        reason: 'Mais de um código de autor corresponde ao nome pesquisado (homônimo).',
        detail: `códigos: ${distinctAuthorCodes.join(', ')}`,
        sourceUrl,
        consultedAt,
        requestCount,
        years,
      }),
    }
  }

  const requestedMunicipality = municipalityCode !== null || municipalityName !== null
  const rows = matched
    .filter((row) => {
      const code = rowMunicipalityCode(row)
      if (code !== null) return municipalityCode === null || code === String(municipalityCode)
      if (!requestedMunicipality) return true
      return localityMatchesMunicipality(row?.localidadeDoGasto, municipalityName)
    })
    .map(normalizeEmendaRow)
    .sort(
      (left, right) =>
        (right.year ?? 0) - (left.year ?? 0) || (left.code ?? '').localeCompare(right.code ?? ''),
    )

  if (rows.length === 0) {
    return {
      ...gapResult({
        reason: requestedMunicipality
          ? `Sem emenda do autor com localidade ${municipalityName ?? municipalityCode} na janela.`
          : 'Sem emenda do autor na janela consultada.',
        detail: 'API não expõe o município da emenda.',
        sourceUrl,
        consultedAt,
        requestCount,
        years,
      }),
    }
  }

  return {
    status: 'ok',
    reason: null,
    detail: null,
    sourceUrl,
    consultedAt,
    requestCount,
    years,
    authorName,
    authorCode: distinctAuthorCodes[0] ?? null,
    rows,
    totals: sumEmendas(rows),
  }
}
