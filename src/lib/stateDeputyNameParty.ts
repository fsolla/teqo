/**
 * B157 — inline create of a dobradinha from the municípios list combobox.
 *
 * The search text doubles as the create form: a trailing `(PARTIDO)` group is
 * extracted as the deputy's party, everything before it is the name. The rule
 * is deliberately narrow — ONE parenthesized group at the very end, with no
 * nesting — so "Fulano (PT)" → `{ name: 'Fulano', party: 'PT' }` and
 * "Fulano (PT) da Silva" (parens mid-string) stays a name with no party.
 * When the whole string is a single group, e.g. "(PT)", the name comes back
 * empty so the schema can refuse it instead of minting a deputy named "(PT)".
 */
export type StateDeputyNameParty = {
  name: string
  party: string | null
}

const WHOLE_STRING_IS_A_GROUP = /^\(([^()]+)\)$/
const TRAILING_GROUP = /^(.+?)\s*\(([^()]+)\)\s*$/

export const parseStateDeputyNameParty = (rawName: string): StateDeputyNameParty => {
  const trimmed = rawName.trim()

  const wholeGroup = WHOLE_STRING_IS_A_GROUP.exec(trimmed)
  if (wholeGroup) return { name: '', party: wholeGroup[1].trim() }

  const trailing = TRAILING_GROUP.exec(trimmed)
  if (!trailing) return { name: trimmed, party: null }

  return { name: trailing[1].trim(), party: trailing[2].trim() }
}

/**
 * The display fold `"Fulano (PT)"` for a name + party pair — the single
 * spelling every dobradinha chip/suggestion uses (client-safe; the server
 * catalog already folds it into `StateDeputyRelationOption.name`).
 */
export const stateDeputyDisplayName = (name: string, party: string | null): string =>
  party ? `${name} (${party})` : name
