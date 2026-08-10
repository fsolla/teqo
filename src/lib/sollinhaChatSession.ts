/**
 * Per-tab Sollinha chat session (B188): the conversation plus the open state
 * live in `sessionStorage`, so a reload of the same tab restores the chat, a
 * new tab starts clean, and closing the tab erases everything. Nothing is
 * written to the server and nothing crosses tabs.
 */
import type { UIMessage } from 'ai'

export const SOLLINHA_CHAT_SESSION_STORAGE_KEY = 'teqo:campaign:sollinha-chat-session'

const SOLLINHA_CHAT_SESSION_VERSION = 1

/** Count guardrail — oldest messages are dropped at write time, no UI warning. */
export const SOLLINHA_CHAT_MAX_MESSAGES = 50

/** Byte guardrail (serialized JSON) — oldest messages are dropped at write time. */
export const SOLLINHA_CHAT_MAX_BYTES = 256 * 1024

/**
 * How the session's `open` came to be true (OPS22): `'user'` when the person
 * toggled the chat (FAB / header button / drawer swipe), `'settle'` when the
 * desktop panel reconcile (B167) opened it. The settle is layout truth, not
 * intent — a settle-originated `open: true` must never restore the mobile
 * drawer "by itself". Sessions written before this field (B188) carry no
 * value and are treated as `'settle'` (fail-closed).
 */
export type SollinhaChatSessionOpenOrigin = 'user' | 'settle'

export type SollinhaChatSession = {
  version: typeof SOLLINHA_CHAT_SESSION_VERSION
  messages: UIMessage[]
  open: boolean
  openBy?: SollinhaChatSessionOpenOrigin
}

const MESSAGE_ROLES = new Set(['system', 'user', 'assistant'])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isUIMessage = (value: unknown): value is UIMessage => {
  if (!isRecord(value)) return false
  return (
    typeof value.id === 'string' &&
    typeof value.role === 'string' &&
    MESSAGE_ROLES.has(value.role) &&
    Array.isArray(value.parts) &&
    value.parts.every((part) => isRecord(part) && typeof part.type === 'string')
  )
}

/** Fail-closed: any shape drift (or a future version bump) yields a fresh chat. */
const isSollinhaChatSession = (value: unknown): value is SollinhaChatSession => {
  if (!isRecord(value)) return false
  return (
    value.version === SOLLINHA_CHAT_SESSION_VERSION &&
    Array.isArray(value.messages) &&
    value.messages.every(isUIMessage) &&
    typeof value.open === 'boolean' &&
    (value.openBy === undefined || value.openBy === 'user' || value.openBy === 'settle')
  )
}

export const readSollinhaChatSession = (): SollinhaChatSession | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(SOLLINHA_CHAT_SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isSollinhaChatSession(parsed) ? parsed : null
  } catch {
    return null
  }
}

/**
 * Drops oldest messages until the count and byte guardrails hold, then ensures
 * the head is a user message: `convertToModelMessages` (server) rejects a
 * conversation that starts with an assistant turn, and pruning from the front
 * can leave one. Tool outputs are kept intact: complete tool parts turn back
 * into `tool-call` + `tool-result` model messages, so the model keeps the full
 * context when the restored conversation continues.
 */
export const pruneSollinhaChatMessages = (messages: UIMessage[]): UIMessage[] => {
  let pruned = messages
  if (pruned.length > SOLLINHA_CHAT_MAX_MESSAGES) {
    pruned = pruned.slice(-SOLLINHA_CHAT_MAX_MESSAGES)
  }
  while (pruned.length > 0) {
    if (JSON.stringify(pruned).length <= SOLLINHA_CHAT_MAX_BYTES) break
    pruned = pruned.slice(1)
  }
  while (pruned.length > 1 && pruned[0]?.role !== 'user') {
    pruned = pruned.slice(1)
  }
  return pruned
}

/**
 * Writes the pruned session. Fail-open: storage failures never break the chat.
 * `openBy` defaults to `'settle'` — a write without intent information must
 * not restore the mobile drawer (OPS22).
 */
export const writeSollinhaChatSession = (
  messages: UIMessage[],
  open: boolean,
  openBy: SollinhaChatSessionOpenOrigin = 'settle',
): void => {
  if (typeof window === 'undefined') return
  const session: SollinhaChatSession = {
    version: SOLLINHA_CHAT_SESSION_VERSION,
    messages: pruneSollinhaChatMessages(messages),
    open,
    openBy,
  }
  try {
    window.sessionStorage.setItem(SOLLINHA_CHAT_SESSION_STORAGE_KEY, JSON.stringify(session))
  } catch {
    // Ignore quota / private-mode failures.
  }
}
