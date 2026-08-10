/**
 * Sollinha follow-up suggestions (B192): the assistant is instructed (see
 * `systemPrompt.ts`, which interpolates `SOLLINHA_FOLLOW_UP_MARKER`) to end
 * factual answers with a stable block — the marker line followed by a markdown
 * list of 2–3 follow-up questions. This module is the single source of the
 * contract: it splits the raw response text into the body to display and the
 * suggestions that feed the chat's chip slot.
 *
 * Fail-closed by design on the SUGGESTIONS: no marker, a malformed block, a
 * truncated block or fewer than two parseable items all yield no chips — the
 * answer renders as today, and nothing the model does can corrupt the
 * displayed message. The BODY is always stripped from the marker onward (the
 * block is a format directive for the interface, never chat content), whether
 * or not the suggestions parse.
 */
export const SOLLINHA_FOLLOW_UP_MARKER = '**Sugestões de continuação:**'

/** Upper bound per the product contract ("2–3 per answer"). */
const SOLLINHA_FOLLOW_UP_MAX = 3

/**
 * Fewer than this many parseable items is treated as a malformed block: the
 * product contract is "2–3 chips", and a single stray chip looks broken.
 */
const SOLLINHA_FOLLOW_UP_MIN = 2

/** Markdown bullets, dashes and numbered lists (`1.` and pt-BR `1)`). */
const LIST_ITEM = /^\s*(?:[-*]|\d+[.)])\s+(.+?)\s*$/

export type SollinhaFollowUpBlock = {
  /** Response text with the block removed (trailing whitespace trimmed). */
  body: string
  /** Follow-up questions parsed from the block; empty when absent/malformed. */
  suggestions: string[]
}

const parseSuggestions = (block: string): string[] => {
  const items: string[] = []
  for (const line of block.split('\n')) {
    const match = LIST_ITEM.exec(line)
    if (match) {
      const text = match[1]?.trim().replaceAll('**', '')
      if (text && !items.includes(text) && items.length < SOLLINHA_FOLLOW_UP_MAX) {
        items.push(text)
      }
    } else if (line.trim()) {
      // A non-empty line that is not a list item means the block is not the
      // clean marker+list the prompt contracts (prose after the list, text on
      // the marker line, …) — treat the whole block as malformed (fail-closed).
      return []
    }
  }
  return items.length >= SOLLINHA_FOLLOW_UP_MIN ? items : []
}

/**
 * Splits an assistant message text at the LAST occurrence of the marker —
 * everything from the marker onward is the block, per the prompt contract
 * ("the block is the last thing in the response"). Idempotent: a body that was
 * already stripped has no marker and passes through unchanged.
 */
export const splitSollinhaFollowUpBlock = (text: string): SollinhaFollowUpBlock => {
  const markerIndex = text.lastIndexOf(SOLLINHA_FOLLOW_UP_MARKER)
  if (markerIndex === -1) {
    return { body: text, suggestions: [] }
  }
  const body = text.slice(0, markerIndex).trimEnd()
  const block = text.slice(markerIndex + SOLLINHA_FOLLOW_UP_MARKER.length)
  return { body, suggestions: parseSuggestions(block) }
}
