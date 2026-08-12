/**
 * B200 — the mobile municipality card's relation avatar pile (overlapRow):
 * how many pixels each following avatar overlaps the previous one, given the
 * group's measured width. The pile is anchored left and the overlap grows
 * with the count so that every avatar stays fully visible and nothing ever
 * pokes into the neighbouring group: for `count > 1` the fit overlap is
 * `(count·28 − width)/(count − 1)` (total span = width exactly), floored at
 * `RELATION_AVATAR_MIN_OVERLAP_PX` so even two avatars read as a deliberate
 * stack instead of spreading to the group's corners. Extreme counts degrade
 * to a deep stack — the sr-only names still list everyone.
 */
export const RELATION_AVATAR_SIZE_PX = 28
export const RELATION_AVATAR_MIN_OVERLAP_PX = 8

export const relationAvatarOverlapPx = (count: number, groupWidthPx: number): number => {
  if (count <= 1) return 0
  const fitOverlap = (count * RELATION_AVATAR_SIZE_PX - groupWidthPx) / (count - 1)
  if (!Number.isFinite(fitOverlap)) return RELATION_AVATAR_MIN_OVERLAP_PX
  return Math.max(RELATION_AVATAR_MIN_OVERLAP_PX, fitOverlap)
}
