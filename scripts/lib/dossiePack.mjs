/**
 * Packing of the institution dossiê sheets (C187 flow). The probe pass renders
 * each packed section as a single sheet and measures the real height of every
 * unit; the packer turns those measurements into a plan (`sectionKey -> units
 * per sheet`) so a section spans as many sheets as it needs and nothing is
 * capped.
 *
 * A "row" is one packable line: a full-width unit (table row, list item) or a
 * grid pair (two cards share the row height). Rows never split across sheets.
 *
 * The first plan is greedy over the probe costs; the builder then re-renders
 * and measures each sheet, and `adjustPackPlan` moves rows between sheets until
 * every page is full without overflowing (no waste, no cut).
 */

/**
 * Per-sheet reserve for the block margins the tight probe zeroes out
 * (section/block margins, `.document-table`/list top margins). The A4 fit
 * guard still catches any residue; the reserve keeps a first pack from
 * overflowing.
 */
const PACK_SHEET_RESERVE_PX = 80

/** Extra room required to grow a sheet (the moved row may open a new section head). */
const GROW_SAFETY_PX = 80

/**
 * @param {Array<{ key: string, overhead: number, overheadContinuation?: number, rows: Array<{ units: number[], cost: number }> }>} probe
 * @param {number} budgetPx
 * @param {number} [reservePx]
 * @returns {Record<string, number[]>}
 */
export const packProbeSections = (probe, budgetPx, reservePx = PACK_SHEET_RESERVE_PX) => {
  const plan = {}
  const sheetBudget = Math.max(1, budgetPx - reservePx)
  for (const section of probe) {
    const usableFirst = Math.max(1, sheetBudget - section.overhead)
    const usableRest = Math.max(1, sheetBudget - (section.overheadContinuation ?? section.overhead))
    const chunks = []
    let current = []
    let used = 0
    for (const row of section.rows) {
      const usable = chunks.length === 0 ? usableFirst : usableRest
      if (current.length > 0 && used + row.cost > usable) {
        chunks.push(current)
        current = []
        used = 0
      }
      current.push(...row.units)
      used += row.cost
    }
    chunks.push(current)
    plan[section.key] = chunks.map((chunk) => chunk.length)
  }
  return plan
}

/**
 * One grow/shrink pass over a rendered plan: an overflowing sheet gives its
 * last row to the next chunk; a sheet with room takes the first row of the next
 * chunk. Pure — the builder re-renders and re-measures between passes until the
 * plan stops changing. A sheet that ever overflowed is locked (never grown
 * again), which keeps the loop from oscillating.
 *
 * @param {{
 *   plan: Record<string, number[]>,
 *   probe: Array<{ key: string, rows: Array<{ units: number[], cost: number }> }>,
 *   sheets: Array<{ page: string, height: number, used: number }>,
 *   anchors: Record<string, string>,
 *   budgetPx: number,
 *   lockedAnchors?: Set<string>,
 * }} params
 * @returns {Record<string, number[]> | null}
 */
export const adjustPackPlan = ({
  plan,
  probe,
  sheets,
  anchors,
  budgetPx,
  lockedAnchors = new Set(),
}) => {
  const byAnchor = new Map(sheets.map((sheet) => [sheet.page, sheet]))
  let changed = false
  const next = { ...plan }
  for (const section of probe) {
    const base = anchors[section.key]
    const sizes = [...(plan[section.key] ?? [])]
    if (!base || sizes.length === 0) continue
    const rows = section.rows
    let offset = 0
    for (let index = 0; index < sizes.length; index += 1) {
      const start = offset
      const end = offset + sizes[index]
      offset = end
      const anchor = index === 0 ? base : `${base}-${index + 1}`
      const sheet = byAnchor.get(anchor)
      if (!sheet) continue
      const rowsInChunk = rows.filter((row) => row.units[0] >= start && row.units[0] < end)
      if (sheet.height > budgetPx) {
        if (rowsInChunk.length <= 1) continue
        const last = rowsInChunk[rowsInChunk.length - 1]
        sizes[index] -= last.units.length
        sizes[index + 1] = (sizes[index + 1] ?? 0) + last.units.length
        changed = true
        continue
      }
      if (lockedAnchors.has(anchor)) continue
      const nextRow = rows.find((row) => row.units[0] === end)
      if (!nextRow || sizes[index + 1] === undefined) continue
      const free = budgetPx - sheet.used
      if (free < nextRow.cost + GROW_SAFETY_PX) continue
      sizes[index] += nextRow.units.length
      sizes[index + 1] -= nextRow.units.length
      if (sizes[index + 1] <= 0) sizes.splice(index + 1, 1)
      changed = true
    }
    next[section.key] = sizes
  }
  return changed ? next : null
}
