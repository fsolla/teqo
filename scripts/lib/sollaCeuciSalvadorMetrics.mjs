/**
 * Pure metrics for the Solla × Ceuci Salvador 2022 report (C157).
 *
 * The report compares two candidates of different offices (federal vs. state
 * deputy) inside the same geography (Salvador's 19 electoral zones). No voter
 * is observable twice — the overlap here is between two *geographies of vote*,
 * never between individual ballots — so every function works on the zone
 * vectors and the shared denominator is the zone's valid votes for each
 * office.
 *
 * Kept out of the generator script so the arithmetic is unit-testable; the
 * generator owns only I/O (geometry, HTML, PDF).
 */

/** Share of a total, 0 when the denominator is missing (never NaN in the report). */
export const shareOf = (value, total) => (total > 0 ? value / total : 0)

/**
 * Local quotient (LQ): the candidate's share of his own geography vote divided
 * by the geography's share of the valid votes. 1 = exactly his average; the
 * report's "above/below own average" line.
 */
export const localQuotient = (value, ownTotal, valid, validTotal) => {
  const ownShare = shareOf(value, ownTotal)
  const validShare = shareOf(valid, validTotal)
  return validShare > 0 ? ownShare / validShare : 0
}

/** Pearson correlation; returns 0 for degenerate vectors (n < 2 or no variance). */
export const pearson = (xs, ys) => {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return 0
  const meanX = xs.reduce((sum, value) => sum + value, 0) / n
  const meanY = ys.reduce((sum, value) => sum + value, 0) / n
  let covariance = 0
  let varianceX = 0
  let varianceY = 0
  for (let index = 0; index < n; index += 1) {
    const dx = xs[index] - meanX
    const dy = ys[index] - meanY
    covariance += dx * dy
    varianceX += dx * dx
    varianceY += dy * dy
  }
  if (varianceX === 0 || varianceY === 0) return 0
  return covariance / Math.sqrt(varianceX * varianceY)
}

/** Competition ranks with ties averaged — the honest rank for Spearman. */
export const averageRanks = (values) => {
  const order = values
    .map((value, index) => [value, index])
    .sort((left, right) => left[0] - right[0])
  const ranks = new Array(values.length).fill(0)
  let start = 0
  while (start < order.length) {
    let end = start
    while (end + 1 < order.length && order[end + 1][0] === order[start][0]) end += 1
    const rank = (start + end) / 2 + 1
    for (let index = start; index <= end; index += 1) ranks[order[index][1]] = rank
    start = end + 1
  }
  return ranks
}

/** Spearman rank correlation (Pearson over average ranks). */
export const spearman = (xs, ys) => pearson(averageRanks(xs), averageRanks(ys))

/**
 * Overlap coefficient between two share vectors: Σ min(aᵢ, bᵢ). 1 = identical
 * distributions, 0 = disjoint. Scale-free (both vectors sum to ~1), which is
 * what makes a federal candidate comparable with a state one.
 */
export const overlapCoefficient = (a, b) => {
  const n = Math.min(a.length, b.length)
  let total = 0
  for (let index = 0; index < n; index += 1) total += Math.min(a[index], b[index])
  return total
}

/** Cosine similarity between two vectors (scale-invariant). */
export const cosineSimilarity = (a, b) => {
  const n = Math.min(a.length, b.length)
  let dot = 0
  let normA = 0
  let normB = 0
  for (let index = 0; index < n; index += 1) {
    dot += a[index] * b[index]
    normA += a[index] * a[index]
    normB += b[index] * b[index]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / Math.sqrt(normA * normB)
}

/** Herfindahl–Hirschman index over shares (concentration; 1/19 ≈ uniform). */
export const hhi = (shares) => shares.reduce((sum, value) => sum + value * value, 0)

/** Sum of the `n` largest shares — the "top-3 zones" concentration reading. */
export const topShare = (shares, n) =>
  [...shares]
    .sort((left, right) => right - left)
    .slice(0, n)
    .reduce((sum, value) => sum + value, 0)

export const ZONE_CLASSES = {
  shared: {
    key: 'shared',
    label: 'Reduto compartilhado',
    short: 'Ambos acima da média',
    color: '#c51414',
  },
  solla: { key: 'solla', label: 'Base Solla', short: 'Só Solla acima da média', color: '#1e40af' },
  ceuci: { key: 'ceuci', label: 'Ponte Ceuci', short: 'Só Ceuci acima da média', color: '#0d9488' },
  open: { key: 'open', label: 'Disputa ampla', short: 'Ambos abaixo da média', color: '#d4d4d8' },
}

/** Crosses the two LQs into the report's four operational classes. */
export const classifyZone = (sollaLq, ceuciLq) => {
  if (sollaLq >= 1 && ceuciLq >= 1) return ZONE_CLASSES.shared
  if (sollaLq >= 1) return ZONE_CLASSES.solla
  if (ceuciLq >= 1) return ZONE_CLASSES.ceuci
  return ZONE_CLASSES.open
}

/** Per-zone table rows, sorted by zone number (the printed order). */
export const buildZoneMetrics = ({ zones, salvadorTotals }) =>
  zones.map((zone) => {
    const sollaShareOwn = shareOf(zone.sollaVotes, salvadorTotals.sollaVotes)
    const ceuciShareOwn = shareOf(zone.ceuciVotes, salvadorTotals.ceuciVotes)
    const sollaLq = localQuotient(
      zone.sollaVotes,
      salvadorTotals.sollaVotes,
      zone.federalValid,
      salvadorTotals.federalValid,
    )
    const ceuciLq = localQuotient(
      zone.ceuciVotes,
      salvadorTotals.ceuciVotes,
      zone.stateValid,
      salvadorTotals.stateValid,
    )
    return {
      ...zone,
      sollaShareOwn,
      ceuciShareOwn,
      sollaShareValid: shareOf(zone.sollaVotes, zone.federalValid),
      ceuciShareValid: shareOf(zone.ceuciVotes, zone.stateValid),
      sollaLq,
      ceuciLq,
      overlapMin: Math.min(sollaShareOwn, ceuciShareOwn),
      combinedVotes: zone.sollaVotes + zone.ceuciVotes,
      sollaLeads: zone.sollaVotes > zone.ceuciVotes,
      zoneClass: classifyZone(sollaLq, ceuciLq),
    }
  })

/** Summary readings printed in the executive summary and the method annex. */
export const buildReportSummary = ({ metrics, candidates, salvadorTotals }) => {
  const sollaShares = metrics.map((zone) => zone.sollaShareOwn)
  const ceuciShares = metrics.map((zone) => zone.ceuciShareOwn)
  const sollaVotes = metrics.map((zone) => zone.sollaVotes)
  const ceuciVotes = metrics.map((zone) => zone.ceuciVotes)

  const byClass = (key) => metrics.filter((zone) => zone.zoneClass.key === key)
  const strongestCeuci = [...metrics].sort((left, right) => right.ceuciVotes - left.ceuciVotes)
  const strongestCombined = [...metrics].sort(
    (left, right) => right.combinedVotes - left.combinedVotes,
  )
  const ceuciAhead = metrics.filter((zone) => zone.ceuciVotes > zone.sollaVotes)

  return {
    overlapCoefficient: overlapCoefficient(sollaShares, ceuciShares),
    cosine: cosineSimilarity(sollaShares, ceuciShares),
    pearson: pearson(sollaVotes, ceuciVotes),
    spearman: spearman(sollaVotes, ceuciVotes),
    sollaTop3Share: topShare(sollaShares, 3),
    ceuciTop3Share: topShare(ceuciShares, 3),
    sollaHhi: hhi(sollaShares),
    ceuciHhi: hhi(ceuciShares),
    salvadorShareOfSollaState: shareOf(salvadorTotals.sollaVotes, candidates.solla.stateVotes),
    salvadorShareOfCeuciState: shareOf(salvadorTotals.ceuciVotes, candidates.ceuci.stateVotes),
    shared: byClass('shared'),
    sollaOnly: byClass('solla'),
    ceuciOnly: byClass('ceuci'),
    open: byClass('open'),
    strongestCeuci,
    strongestCombined,
    ceuciAhead,
  }
}

/**
 * Per-bairro rows (IBGE Censo 2022 mesh, keyed by the polygon name). Same
 * arithmetic as the zones, but the denominator is the bairro's share of the
 * valid nominal votes of each office and N is the number of bairros with a
 * polling place — a finer reading of the same two geographies of vote.
 */
export const buildBairroMetrics = ({ bairros, totals }) =>
  bairros.map((bairro) => {
    const sollaShareOwn = shareOf(bairro.sollaVotes, totals.sollaVotes)
    const ceuciShareOwn = shareOf(bairro.ceuciVotes, totals.ceuciVotes)
    const sollaLq = localQuotient(
      bairro.sollaVotes,
      totals.sollaVotes,
      bairro.federalNominal,
      totals.federalNominal,
    )
    const ceuciLq = localQuotient(
      bairro.ceuciVotes,
      totals.ceuciVotes,
      bairro.stateNominal,
      totals.stateNominal,
    )
    return {
      ...bairro,
      sollaShareOwn,
      ceuciShareOwn,
      sollaShareValid: shareOf(bairro.sollaVotes, bairro.federalNominal),
      ceuciShareValid: shareOf(bairro.ceuciVotes, bairro.stateNominal),
      sollaLq,
      ceuciLq,
      overlapMin: Math.min(sollaShareOwn, ceuciShareOwn),
      combinedVotes: bairro.sollaVotes + bairro.ceuciVotes,
      bairroClass: classifyZone(sollaLq, ceuciLq),
    }
  })

/** Bairro cuts used by the executive summary, the personas and the coordinator queues. */
export const buildBairroSummary = ({ metrics }) => {
  const sollaShares = metrics.map((bairro) => bairro.sollaShareOwn)
  const ceuciShares = metrics.map((bairro) => bairro.ceuciShareOwn)
  const sollaVotes = metrics.map((bairro) => bairro.sollaVotes)
  const ceuciVotes = metrics.map((bairro) => bairro.ceuciVotes)
  const byClass = (key) => metrics.filter((bairro) => bairro.bairroClass.key === key)

  return {
    overlapCoefficient: overlapCoefficient(sollaShares, ceuciShares),
    cosine: cosineSimilarity(sollaShares, ceuciShares),
    pearson: pearson(sollaVotes, ceuciVotes),
    spearman: spearman(sollaVotes, ceuciVotes),
    sollaTop5Share: topShare(sollaShares, 5),
    ceuciTop5Share: topShare(ceuciShares, 5),
    sollaTop10Share: topShare(sollaShares, 10),
    ceuciTop10Share: topShare(ceuciShares, 10),
    sollaHhi: hhi(sollaShares),
    ceuciHhi: hhi(ceuciShares),
    shared: byClass('shared'),
    sollaOnly: byClass('solla'),
    ceuciOnly: byClass('ceuci'),
    open: byClass('open'),
    strongestCombined: [...metrics].sort((left, right) => right.combinedVotes - left.combinedVotes),
    strongestCeuci: [...metrics].sort((left, right) => right.ceuciVotes - left.ceuciVotes),
    strongestSolla: [...metrics].sort((left, right) => right.sollaVotes - left.sollaVotes),
    ceuciAhead: metrics.filter((bairro) => bairro.ceuciVotes > bairro.sollaVotes),
    sollaAhead: metrics.filter((bairro) => bairro.sollaVotes > bairro.ceuciVotes),
    topCeuciLq: [...metrics]
      .filter((bairro) => bairro.ceuciVotes >= 100)
      .sort((left, right) => right.ceuciLq - left.ceuciLq),
    topSollaLq: [...metrics]
      .filter((bairro) => bairro.sollaVotes >= 100)
      .sort((left, right) => right.sollaLq - left.sollaLq),
  }
}
