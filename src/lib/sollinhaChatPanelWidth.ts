/** Device-local Sollinha chat panel width (px), remembered across opens. */

export const SOLLINHA_CHAT_WIDTH_STORAGE_KEY = 'teqo:campaign:sollinha-chat-width-px'

/** Floor of the chat panel — reuse it wherever the panel width is constrained. */
export const CHAT_MIN_PX = 280

/** Cap of the default open width (`min(25% of the group, this)`). */
export const CHAT_DEFAULT_MAX_PX = 360

const isStoredWidth = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

export const getSavedChatWidthPx = (): number | null => {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(SOLLINHA_CHAT_WIDTH_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isStoredWidth(parsed) ? parsed : null
  } catch {
    return null
  }
}

export const saveChatWidthPx = (widthPx: number): void => {
  if (typeof window === 'undefined') return
  const rounded = Math.round(widthPx)
  if (rounded <= 0) return
  try {
    localStorage.setItem(SOLLINHA_CHAT_WIDTH_STORAGE_KEY, JSON.stringify(rounded))
  } catch {
    // Ignore quota / private-mode failures.
  }
}

export const clearSavedChatWidthPx = (): void => {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(SOLLINHA_CHAT_WIDTH_STORAGE_KEY)
  } catch {
    // Ignore private-mode failures.
  }
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

/** Default open width: 25% of the group, capped at `CHAT_DEFAULT_MAX_PX`. */
export const defaultChatWidthPx = (groupWidthPx: number): number =>
  clamp(Math.round(Math.min(0.25 * groupWidthPx, CHAT_DEFAULT_MAX_PX)), CHAT_MIN_PX, groupWidthPx)

/**
 * Width for the next open: the remembered choice wins (even above the cap),
 * otherwise the capped 25% default. Bounded to `CHAT_MIN_PX` and to the group
 * itself — a group narrower than the floor (degenerate layout) yields the
 * group width, and the library re-clamps the rendered panel at its `minSize`.
 */
export const resolveChatPanelWidthPx = (groupWidthPx: number, savedPx: number | null): number =>
  savedPx === null ? defaultChatWidthPx(groupWidthPx) : clamp(savedPx, CHAT_MIN_PX, groupWidthPx)
