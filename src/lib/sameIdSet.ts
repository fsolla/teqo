/**
 * Order-independent equality for two id lists — the guard every list-cell
 * optimistic-state hook uses to tell a genuine external prop change
 * (navigation/RSC refresh) apart from a re-render carrying the same
 * pre-edit content (which must not clobber in-flight optimistic state).
 */
export const sameIdSet = (left: readonly number[], right: readonly number[]): boolean => {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((id) => rightSet.has(id))
}
