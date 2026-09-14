/**
 * Per-tab Sollinha chat session (B188): the conversation plus the open state
 * live in `sessionStorage`, so a reload of the same tab restores the chat, a
 * new tab starts clean, and closing the tab erases everything. Nothing is
 * written to the server and nothing crosses tabs.
 *
 * C159 — the persisted session carries the role it belongs to. The chat is now
 * reachable by every role, including the communication assessor (whose scope is
 * the speech acervo), and a shared tab must never restore a previous user's
 * campaign conversation for her. A session from another role is discarded
 * (fail-closed), as is a session written before this field existed.
 */
import type { UIMessage } from 'ai'

import type { CampaignRole } from '@/lib/campaignRoles'

export const SOLLINHA_CHAT_SESSION_STORAGE_KEY = 'teqo:campaign:sollinha-chat-session'

const SOLLINHA_CHAT_SESSION_VERSION = 1

/**
 * Mirror of the role enum: a role missing here never restores a session
 * (fail-closed). When a new value enters `CampaignRole`, add it here and in
 * the session unit spec in the same change.
 */
const CAMPAIGN_ROLES: ReadonlySet<string> = new Set([
  'coordinator',
  'advisor',
  'candidate',
  'leader',
  'communicator',
])

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
  /** The role that wrote the session — another role never restores it. */
  role: CampaignRole
  messages: UIMessage[]
  open: boolean
  openBy?: SollinhaChatSessionOpenOrigin
}

const MESSAGE_ROLES = new Set(['system', 'user', 'assistant'])

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isCampaignRole = (value: unknown): value is CampaignRole =>
  typeof value === 'string' && CAMPAIGN_ROLES.has(value)

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
    isCampaignRole(value.role) &&
    Array.isArray(value.messages) &&
    value.messages.every(isUIMessage) &&
    typeof value.open === 'boolean' &&
    (value.openBy === undefined || value.openBy === 'user' || value.openBy === 'settle')
  )
}

/**
 * C159 — a session whose role differs from the current actor is invisible:
 * the tab may have been shared, and the previous user's conversation is
 * exactly what a narrower role must not see.
 */
export const readSollinhaChatSession = (role: CampaignRole): SollinhaChatSession | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(SOLLINHA_CHAT_SESSION_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isSollinhaChatSession(parsed) || parsed.role !== role) return null
    return parsed
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
 * not restore the mobile drawer (OPS22). The role is always stamped (C159):
 * the session belongs to the actor who wrote it.
 */
export const writeSollinhaChatSession = (
  messages: UIMessage[],
  open: boolean,
  role: CampaignRole,
  openBy: SollinhaChatSessionOpenOrigin = 'settle',
): void => {
  if (typeof window === 'undefined') return
  const session: SollinhaChatSession = {
    version: SOLLINHA_CHAT_SESSION_VERSION,
    role,
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
