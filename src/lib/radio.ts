import { buildWhatsAppTextShareUrl } from './phone'

/**
 * S25 — the single owner of the Rádio 1313 contract: the zeno.fm stream the
 * player points at, the public page the share exits open, the fixed display
 * title (the stream's own `icy-name`) and the literal share message. Pure and
 * client-safe, so the player state machine and the unit tests pin the same
 * values without React.
 */
export const RADIO_STREAM_URL = 'https://stream.zeno.fm/hys86kx6k16tv'
export const RADIO_PAGE_URL = 'https://zeno.fm/radio/jorge-solla-1313/'
export const RADIO_TITLE = 'Rádio Jorge Solla 1313'
export const RADIO_SHARE_MESSAGE = `Ouça a ${RADIO_TITLE} — ${RADIO_PAGE_URL}`

/**
 * How long `connecting` may last before the player admits the failure. The
 * stream answers a 302 with a per-request signed CDN URL (usually under 2s), so
 * a connection that accepts and never delivers audio must not spin forever —
 * it becomes the honest `error` state with the retry and "Ouvir no Zeno" exits.
 */
export const RADIO_CONNECT_TIMEOUT_MS = 12_000

/**
 * S25 — one audio at a time in the home sound section. The radio and the
 * jingles are sibling client components (the section shell is a server
 * component), so the exclusivity is a `window` CustomEvent broadcast — the repo
 * precedent (`signature:created`, the speech excerpt request). Each listener
 * only ever touches its own media element, which keeps the events inert outside
 * the home (`/jingles` has no radio, so `jingle:play` has no consumer there).
 */
export const RADIO_PLAY_EVENT = 'radio:play'
export const JINGLE_PLAY_EVENT = 'jingle:play'

/** `wa.me` with the literal message and no recipient — the sender's own WhatsApp picks the chat. */
export const buildRadioShareWhatsAppUrl = (): string =>
  buildWhatsAppTextShareUrl(RADIO_SHARE_MESSAGE)
