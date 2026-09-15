/**
 * OPS109 — helpers ANSI mínimos para o painel de issues (`pnpm issues:tui`).
 *
 * Puro by contract: só constantes de escape + operações de string (zero
 * dependência, zero I/O). O painel roda num terminal SSH comum, então o
 * conjunto é deliberadamente pequeno e conservador — cores funcionais de
 * estado, negrito/dim e o controle de tela alternada. Nada de emoji ou
 * glifos double-width: a largura é calculada por `visibleWidth`, que ignora
 * as sequências CSI/SGR.
 */

const ESC = '\u001b['
const RESET = `${ESC}0m`

/** SGR codes used by the panel. Names map to the UI draft's functional roles. */
export const SGR = {
  reset: RESET,
  bold: `${ESC}1m`,
  dim: `${ESC}2m`,
  italic: `${ESC}3m`,
  inverse: `${ESC}7m`,
  red: `${ESC}31m`,
  green: `${ESC}32m`,
  yellow: `${ESC}33m`,
  cyan: `${ESC}36m`,
  gray: `${ESC}90m`,
}

/**
 * Runs of CSI escape sequences: `ESC [ … final-byte`. Covers SGR
 * (`\u001b[0m`) and cursor moves (`\u001b[2J`), so width math never counts
 * control bytes. Deliberately not a full terminal parser (no OSC/links).
 */
const CSI_PATTERN = /\u001b\[[0-9;?]*[ -/]*[@-~]/g

/**
 * Strip every CSI sequence — for measuring and for re-wrapping already
 * styled text.
 * @param {string} text
 */
export const stripAnsi = (text) => String(text ?? '').replace(CSI_PATTERN, '')

/**
 * Printable width in terminal cells. Conservative: counts code points, not
 * grapheme clusters or East-Asian double-width (the panel avoids those), so
 * the value equals “how many characters the eye sees”.
 * @param {string} text
 */
export const visibleWidth = (text) => [...stripAnsi(text)].length

/**
 * Truncate to `width` visible columns, appending an ellipsis when it had to
 * cut. The result is unstyled plain text (escape sequences are stripped):
 * callers that need color apply it around the truncated value.
 * @param {string} text
 * @param {number} width
 */
export const truncateToWidth = (text, width) => {
  const source = String(text ?? '')
  const plain = stripAnsi(source)
  const chars = [...plain]
  const limit = Math.max(0, Math.trunc(width))
  if (chars.length <= limit) return source
  if (limit === 0) return ''
  return `${chars.slice(0, Math.max(0, limit - 1)).join('')}…`
}

/**
 * Pad a styled string with spaces up to `width` visible columns. When the
 * text is longer it is truncated with `truncateToWidth`; padding happens
 * AFTER the text so a background color covers the whole cell.
 * @param {string} text
 * @param {number} width
 */
export const padToWidth = (text, width) => {
  const target = Math.max(0, Math.trunc(width))
  const clipped = visibleWidth(text) > target ? truncateToWidth(text, target) : String(text ?? '')
  return `${clipped}${' '.repeat(Math.max(0, target - visibleWidth(clipped)))}`
}

/** Enter the alternate screen buffer (restores the shell on leave). */
export const enterAlternateScreen = () => `${ESC}?1049h`

/** Leave the alternate screen buffer. */
export const leaveAlternateScreen = () => `${ESC}?1049l`

/** Hide the hardware cursor (during full redraws). */
export const hideCursor = () => `${ESC}?25l`

/** Show the hardware cursor. */
export const showCursor = () => `${ESC}?25h`

/** Move the cursor to a 1-based row/column (no clearing). */
export const moveTo = (row, column) => `${ESC}${row};${column}H`

/** Clear the whole screen and home the cursor. */
export const clearScreen = () => `${ESC}2J${ESC}H`

/** Erase from the cursor to the end of the current line. */
export const clearLine = () => `${ESC}K`

/** Current terminal size, with conservative defaults when not a TTY. */
export const terminalSize = ({ columns, rows } = {}) => ({
  columns: Number.isInteger(columns) && columns > 0 ? columns : 80,
  rows: Number.isInteger(rows) && rows > 0 ? rows : 24,
})

/** Wrap `text` in an SGR code and reset at the end (no-op on empty text). */
export const style = (code, text) => (text ? `${code}${text}${RESET}` : '')

/** Bold and dim shorthands over `style`. */
export const bold = (text) => style(SGR.bold, text)
export const dim = (text) => style(SGR.dim, text)

/**
 * Severity → color for functional state reading (matches the UI draft):
 * green = done/approved, yellow = waiting, red = blocked/error, blue/gray =
 * neutral. Unknown states degrade to gray.
 * @param {'ok'|'wait'|'bad'|'neutral'|string} tone
 * @param {string} text
 */
export const tone = (toneName, text) => {
  const code = {
    ok: SGR.green,
    wait: SGR.yellow,
    bad: SGR.red,
    accent: SGR.cyan,
    neutral: SGR.gray,
  }[toneName]
  return style(code ?? SGR.gray, text)
}
