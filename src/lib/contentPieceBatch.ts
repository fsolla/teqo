/**
 * C236 — pure vocabulary and copy of the batch actions of the Central de
 * Conteúdos: the three verbs, the selection counter, the delete confirmation
 * and the honest receipt (affected × failures). Client-safe: the selection
 * provider, the action bar, the confirmation dialog and the JSON route share
 * this module.
 *
 * The batch is the unit gesture repeated — it never invents a rule of its own,
 * so everything here is presentation of an outcome the unit actions produced.
 */
import type { ContentPieceStatus } from '@/lib/contentPiece'

export const CONTENT_PIECE_BATCH_ACTIONS = ['publicar', 'despublicar', 'apagar'] as const

export type ContentPieceBatchAction = (typeof CONTENT_PIECE_BATCH_ACTIONS)[number]

/** One item of the selection: the only fields the list projection needs. */
export type ContentPieceSelectionRow = {
  id: number
  status: ContentPieceStatus
  /** The public `/conteudos/<slug>` when the piece has a slug; null otherwise. */
  publicPath: string | null
}

type ContentPieceBatchFailure = {
  contentPieceId: number
  message: string
}

/** What the loop produced: how many pieces changed and which ones did not. */
export type ContentPieceBatchOutcome = {
  action: ContentPieceBatchAction
  affected: number
  failures: ContentPieceBatchFailure[]
}

/** Transport failure of the whole request — never a per-piece failure. */
export const CONTENT_PIECE_BATCH_ERROR_MESSAGE =
  'Não foi possível concluir a ação em lote. Tente novamente.'

/** The irreversible-only body of the mass delete (no published piece in the selection). */
export const CONTENT_PIECE_BATCH_DELETE_IRREVERSIBLE_MESSAGE = 'Esta ação não pode ser desfeita.'

/** The body that warns about the public links when the selection has published pieces. */
export const CONTENT_PIECE_BATCH_DELETE_LINKS_MESSAGE =
  'Os links públicos das peças publicadas da seleção deixam de funcionar para quem já recebeu. Esta ação não pode ser desfeita.'

/** `3 selecionadas` / `1 selecionada` (the TourComposerForm precedent). */
export const contentPieceSelectionLabel = (count: number): string =>
  `${count} ${count === 1 ? 'selecionada' : 'selecionadas'}`

const PARTICIPLES: Record<ContentPieceBatchAction, readonly [string, string]> = {
  publicar: ['publicada', 'publicadas'],
  despublicar: ['despublicada', 'despublicadas'],
  apagar: ['apagada', 'apagadas'],
}

/**
 * The honest receipt: an all-success outcome is one phrase; a partial one
 * always separates affected from failures and never says "3 peças apagadas"
 * when one failed.
 */
export const contentPieceBatchReceiptMessage = (outcome: ContentPieceBatchOutcome): string => {
  const [singular, plural] = PARTICIPLES[outcome.action]

  if (outcome.failures.length === 0) {
    return `${outcome.affected} ${outcome.affected === 1 ? `peça ${singular}` : `peças ${plural}`}`
  }

  const total = outcome.affected + outcome.failures.length
  const failed =
    outcome.failures.length === 1 ? '1 falhou.' : `${outcome.failures.length} falharam.`
  const noun = total === 1 ? 'peça' : 'peças'
  return `${outcome.affected} de ${total} ${noun} ${total === 1 ? singular : plural}. ${failed}`
}

/** `Apagar 3 peças selecionadas?` — the singular reuses the C222 literal. */
export const contentPieceBatchDeleteTitle = (count: number): string =>
  count === 1 ? 'Apagar esta peça?' : `Apagar ${count} peças selecionadas?`
