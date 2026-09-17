/**
 * Câmara activity for the dossiê's Era C (owner): proposições and discursos of
 * the deputy, always with an explicit date window (the API defaults to 7 days)
 * and a per-item source URL. Network failures degrade to an explicit gap — the
 * dossiê never prints a silent zero.
 */

import { getJsonWithBackoff, speechesUrl } from './camaraFetch.mjs'
import { isNonEmptyString } from './cityReportResearch.mjs'
import { SOLLA_DEPUTY_ID } from './dossieCareer.mjs'

const CAMARA_API = 'https://dadosabertos.camara.leg.br/api/v2'
export const CAMARA_DEFAULT_FROM = '2015-01-01'
const DEFAULT_MAX_PAGES = 2
const PAGE_SIZE = 100
const ITEMS_PER_LIST = 20

export const propositionsUrl = (deputyId, page) =>
  `${CAMARA_API}/proposicoes?idDeputadoAutor=${deputyId}&itens=${PAGE_SIZE}&ordem=DESC&ordenarPor=id&pagina=${page}`

const propositionSourceUrl = (id, deputyId) =>
  id
    ? `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${id}`
    : `https://www.camara.leg.br/deputados/${deputyId}`

export const normalizeProposition = (row, deputyId = SOLLA_DEPUTY_ID) => {
  const sigla = isNonEmptyString(row?.siglaTipo) ? row.siglaTipo.trim() : null
  const number = row?.numero ?? null
  const year = row?.ano ?? null
  const ementa = isNonEmptyString(row?.ementa) ? row.ementa.trim() : null
  if (!sigla && !ementa) return null
  const identifier = [sigla, number && year ? `${number}/${year}` : number ? String(number) : null]
    .filter(Boolean)
    .join(' ')
  return {
    title: identifier || 'Proposição de autoria do deputado',
    detail: ementa,
    year: year ? String(year) : null,
    sourceUrl: propositionSourceUrl(row?.id, deputyId),
  }
}

export const normalizeSpeech = (row, deputyId) => {
  const sumario = isNonEmptyString(row?.sumario) ? row.sumario.trim() : null
  const transcricao = isNonEmptyString(row?.transcricao) ? row.transcricao.trim() : null
  const detail = (sumario ?? transcricao ?? '').slice(0, 280) || null
  if (!detail && !isNonEmptyString(row?.dataHoraInicio)) return null
  const date = isNonEmptyString(row?.dataHoraInicio) ? row.dataHoraInicio.slice(0, 10) : null
  const tipo = isNonEmptyString(row?.tipoDiscurso) ? row.tipoDiscurso.trim() : 'Pronunciamento'
  return {
    title: `${tipo} em ${date ?? 'data não informada'}`,
    detail,
    year: date ? date.slice(0, 4) : null,
    sourceUrl: `${CAMARA_API}/deputados/${deputyId}/discursos`,
  }
}

const fetchPaged = async ({ url, page, fetchImpl, label }) => {
  const payload = await getJsonWithBackoff(`${url(page)}`, { fetchImpl, label, attempts: 2 })
  return Array.isArray(payload?.dados) ? payload.dados : []
}

/**
 * The Câmara `/discursos` endpoint rejects a window wider than 4 years
 * ("A data de início não pode ser maior que 4 anos em relação à data final"),
 * so the mandate is walked in ≤4-year windows. Pure and unit-tested.
 */
export const speechWindows = (from, to, spanYears = 4) => {
  const startYear = Number(from.slice(0, 4))
  const endYear = Number(to.slice(0, 4))
  const windows = []
  for (let year = startYear; year <= endYear; year += spanYears) {
    const windowStart = `${String(year).padStart(4, '0')}-01-01`
    const windowEndYear = Math.min(year + spanYears - 1, endYear)
    const lastDay = new Date(Date.UTC(windowEndYear, 12, 0)).toISOString().slice(0, 10)
    const windowEnd = windowEndYear === endYear ? to : lastDay
    windows.push({ from: windowStart, to: windowEnd })
  }
  return windows
}

/**
 * @param {{
 *   deputyId?: number,
 *   from?: string,
 *   to?: string,
 *   fetchImpl?: typeof fetch,
 *   maxPages?: number,
 *   label?: string,
 * }} [options]
 * @returns {Promise<{ status: 'ok'|'gap', items: Array<{title: string, detail: string|null, year: string|null, sourceUrl: string}>, reason: string|null, sourceUrl: string }>}
 */
export const fetchCamaraActivity = async ({
  deputyId = SOLLA_DEPUTY_ID,
  from = CAMARA_DEFAULT_FROM,
  to = new Date().toISOString().slice(0, 10),
  fetchImpl = fetch,
  maxPages = DEFAULT_MAX_PAGES,
  label = 'dossie-camara',
} = {}) => {
  const sourceUrl = `${CAMARA_API}/deputados/${deputyId}/discursos`
  try {
    const propositions = []
    const speeches = []
    for (let page = 1; page <= maxPages; page += 1) {
      const rows = await fetchPaged({
        url: (p) => propositionsUrl(deputyId, p),
        page,
        fetchImpl,
        label,
      })
      propositions.push(...rows.map((row) => normalizeProposition(row, deputyId)).filter(Boolean))
      if (rows.length < PAGE_SIZE) break
    }
    for (const window of speechWindows(from, to)) {
      if (speeches.length >= ITEMS_PER_LIST) break
      const payload = await getJsonWithBackoff(
        `${speechesUrl(deputyId, window.from, window.to)}&pagina=1`,
        {
          fetchImpl,
          label,
          attempts: 2,
        },
      )
      const rows = Array.isArray(payload?.dados) ? payload.dados : []
      speeches.push(...rows.map((row) => normalizeSpeech(row, deputyId)).filter(Boolean))
    }
    const items = [...propositions.slice(0, ITEMS_PER_LIST), ...speeches.slice(0, ITEMS_PER_LIST)]
    if (items.length === 0) {
      return {
        status: 'gap',
        items: [],
        reason: `Sem proposições ou discursos localizados na janela ${from}–${to}.`,
        sourceUrl,
      }
    }
    return { status: 'ok', items, reason: null, sourceUrl }
  } catch (error) {
    return {
      status: 'gap',
      items: [],
      reason: `Falha ao consultar a API da Câmara: ${error instanceof Error ? error.message : error}`,
      sourceUrl,
    }
  }
}
