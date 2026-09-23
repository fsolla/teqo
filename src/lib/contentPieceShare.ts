/**
 * S27 — pure share contract of the Central de Conteúdos: the vote message per
 * piece type (the literals of the gate, always editable by the voter) and the
 * link each piece shares. The system never sends anything: the sheet opens the
 * sender's own WhatsApp with the text prefilled (`wa.me`, no recipient).
 *
 * The S4 home vocabulary (`src/lib/contentShare.ts`) stays its own owner — a
 * different message family with its own pinned contract.
 */
import type { ContentPieceType } from '@/lib/contentPiece'
import { contentPiecePublicPath } from '@/lib/contentPieceCatalog'
import { buildContentShareLink } from '@/lib/contentShare'
import { buildWhatsAppTextShareUrl } from '@/lib/phone'

/** Link-piece sources share the platform URL; an archived piece shares its page. */
export type ContentPieceShareSource = {
  slug: string
  isLink: boolean
  sourceUrl: string | null
}

/**
 * Vote message per piece type (gate literals, "assumidas — validar com a
 * comunicação"): the voter reviews the text in the sheet before opening
 * WhatsApp, so the template is a starting point, never an automatic send.
 */
export const contentPieceVoteMessage = (
  type: ContentPieceType,
  title: string,
  link: string,
): string => {
  if (type === 'video') {
    return `Estamos na reta final e o Jorge Solla 1313 precisa do seu voto. Olha esse vídeo: ${title} — ${link}. Peça voto pra Solla 1313 pra quem você conhece.`
  }
  if (type === 'audio') {
    return `Ouça e mande pro grupo: ${title} — ${link}. Peça voto pra Solla 1313.`
  }
  return `Fiz/achei esse material do Solla 1313: ${title} — ${link}. Peça voto pra Solla 1313 também.`
}

/**
 * The link a piece shares: the canonical platform URL for a link piece (never
 * a second copy), the public piece page for an archived one. Absolute against
 * the visitor's origin so the message carries a clickable URL (the S4
 * fail-soft resolver is the single owner of that absolutization).
 */
export const contentPieceShareLink = (piece: ContentPieceShareSource, origin: string): string =>
  piece.isLink && piece.sourceUrl
    ? piece.sourceUrl
    : buildContentShareLink(contentPiecePublicPath(piece.slug), origin)

/** `wa.me/?text=` with the prefilled message — no recipient, no automatic send. */
export const buildContentPieceWhatsAppUrl = (message: string): string =>
  buildWhatsAppTextShareUrl(message)
