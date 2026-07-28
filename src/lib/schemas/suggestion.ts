import { z } from 'zod'

import { positiveRelationshipId } from '@/lib/schemas/primitives'
import {
  getSuggestionPattern,
  SUGGESTION_TEXT_MAX_LENGTH,
  suggestionPatternIds,
} from '@/lib/suggestionCatalog'

/** Safe message: the queue moved between render and submit — never a bug. */
export const SUGGESTION_STALE_MESSAGE =
  'A sugestão não está mais ativa — a fila foi atualizada. Recarregue para ver o estado atual.'

/** The three outcomes a card can record — one spelling for zod and the form boundary. */
export const SUGGESTION_OUTCOMES = ['aceita', 'descarta', 'adiada'] as const

/**
 * E11 — one recorded decision about one triggered pattern. What each outcome
 * requires is schema, not form courtesy: an acceptance without the chosen
 * menu action, or a dismissal without the alternative reading, is exactly the
 * unauditable record the registry exists to prevent (§6.3/§6.4).
 */
export const suggestionDecisionSchema = z
  .object({
    municipality: positiveRelationshipId,
    patternId: z.enum(suggestionPatternIds),
    outcome: z.enum(SUGGESTION_OUTCOMES),
    /** The menu action taken — required (and validated against the menu) on `aceita`. */
    chosenActionId: z.string().trim().max(120).optional(),
    note: z.string().trim().max(SUGGESTION_TEXT_MAX_LENGTH).optional(),
    /** The reading that beat the suggestion — required on `descarta`. */
    alternativeReading: z.string().trim().max(SUGGESTION_TEXT_MAX_LENGTH).optional(),
  })
  .superRefine((data, context) => {
    if (data.outcome === 'aceita') {
      const menu = getSuggestionPattern(data.patternId).menu
      if (!data.chosenActionId || !menu.some((action) => action.id === data.chosenActionId)) {
        context.addIssue({
          code: 'custom',
          path: ['chosenActionId'],
          message: 'Escolha qual ação do menu foi tomada.',
        })
      }
    }
    if (data.outcome === 'descarta' && !data.alternativeReading?.trim()) {
      context.addIssue({
        code: 'custom',
        path: ['alternativeReading'],
        message: 'Informe a leitura alternativa ao descartar a sugestão.',
      })
    }
  })

export type SuggestionDecisionInput = z.input<typeof suggestionDecisionSchema>
