/**
 * IBGE baseline for the C186 dossiê (owner of the programmatic municipal
 * context). Fetches the sourced population baseline used as the municipal
 * denominator ("leitura relativa" — never an absolute state share). SIOPS/CNES
 * health-execution series are not JSON APIs; they stay a per-era research task
 * and degrade to an explicit gap when absent.
 *
 * `fetchImpl` is injectable so the unit tests never touch the network.
 */

import { formatInteger } from './cityReportFormat.mjs'

const SIDRA_BASE = 'https://apisidra.ibge.gov.br/values'
const CENSUS_YEAR = 2022

export const sidraPopulationUrl = (ibgeCode, year = CENSUS_YEAR) =>
  `${SIDRA_BASE}/t/9514/n6/${ibgeCode}/v/93/p/${year}`

/** SIDRA `/values` returns a header row first; the datum is `payload[1].V`. */
export const parseSidraValue = (payload) => {
  if (!Array.isArray(payload) || payload.length < 2) return null
  const raw = String(payload[1]?.V ?? '').replace(/[^\d-]/g, '')
  if (raw === '') return null
  const value = Number(raw)
  return Number.isFinite(value) ? value : null
}

const gap = ({ reason, sourceUrl, consultedAt }) => ({
  status: 'gap',
  reason,
  items: [],
  sourceUrl,
  consultedAt,
})

/**
 * @param {{
 *   ibgeCode?: string | null,
 *   fetchImpl?: typeof fetch,
 *   now?: Date,
 *   year?: number,
 * }} [options]
 * @returns {Promise<{ status: 'ok'|'gap', items: Array<{topic: string, detail: string, value: number, year: string, sourceUrl: string, sourceDate: string}>, reason: string|null, sourceUrl: string|null, consultedAt: string }>}
 */
export const fetchHealthData = async ({
  ibgeCode = null,
  fetchImpl = fetch,
  now = new Date(),
  year = CENSUS_YEAR,
} = {}) => {
  const consultedAt = now.toISOString()
  if (!ibgeCode) {
    return gap({
      reason: 'Município sem código IBGE no snapshot — contexto não consultado.',
      sourceUrl: null,
      consultedAt,
    })
  }
  const sourceUrl = sidraPopulationUrl(ibgeCode, year)
  try {
    const response = await fetchImpl(sourceUrl)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const population = parseSidraValue(await response.json())
    if (population === null) {
      return gap({
        reason: 'SIDRA não devolveu valor de população para o município.',
        sourceUrl,
        consultedAt,
      })
    }
    return {
      status: 'ok',
      reason: null,
      sourceUrl,
      consultedAt,
      items: [
        {
          topic: `População residente (Censo ${year})`,
          detail: `${formatInteger(population)} habitantes`,
          value: population,
          year: String(year),
          sourceUrl,
          sourceDate: consultedAt.slice(0, 10),
        },
      ],
    }
  } catch (error) {
    return gap({
      reason: `Falha ao consultar o IBGE/SIDRA: ${error instanceof Error ? error.message : error}`,
      sourceUrl,
      consultedAt,
    })
  }
}
