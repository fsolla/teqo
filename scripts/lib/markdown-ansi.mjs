/**
 * OPS109 — render de markdown para ANSI (subconjunto deliberado).
 *
 * Puro: recebe o markdown e devolve `string[]` (uma linha renderizada por
 * item), sem escrever no terminal — o leitor rola o array. Cobre o que o
 * aceite pede: títulos `#`–`######`, listas `-`/`1.`, tabelas `|…|`, blocos
 * ``` ``` ```, `**negrito**`/`*itálico*`, código inline e citação `>`.
 *
 * O que fica de fora passa **cru** (nunca some): a regra é nunca perder
 * conteúdo em troca de estética. Zero dependência — `react-markdown`/`remark`
 * são de browser e não servem num terminal.
 */

import { bold, dim, padToWidth, SGR, style, truncateToWidth, visibleWidth } from './ansi.mjs'

/** Fallback reading width when the caller has no terminal measurement. */
const DEFAULT_READER_WIDTH = 80

/**
 * Inline spans: `**bold**`, `*italic*`, `` `code` `` and `[text](url)`.
 * Order matters — bold before italic so `**` wins. Unmatched markers stay
 * literal (each regex only matches paired runs). The callback form keeps `$`
 * sequences in the content from being reinterpreted by `String.replace`.
 * @param {string} line
 */
export const renderInline = (line) => {
  let output = String(line ?? '')
  output = output.replace(/\*\*([^*\n]+)\*\*/g, (_match, text) => bold(text))
  output = output.replace(/__([^_\n]+)__/g, (_match, text) => bold(text))
  output = output.replace(/`([^`\n]+)`/g, (_match, text) => style(SGR.cyan, text))
  output = output.replace(/\*([^*\n]+)\*/g, (_match, text) => style(SGR.italic, text))
  output = output.replace(
    /\[([^\]\n]+)\]\(([^)\n]+)\)/g,
    (_match, text, url) => `${text} ${dim(`(${url})`)}`,
  )
  return output
}

const HEADING = /^(#{1,6})\s+(.*)$/
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/
const QUOTE = /^>\s?(.*)$/
const FENCE = /^```(.*)$/
const TABLE_ROW = /^\s*\|(.+)\|\s*$/
const TABLE_DIVIDER = /^\s*\|?[\s:|-]+\|?\s*$/

const headingStyle = (depth, text) => {
  const rendered = renderInline(text)
  if (depth <= 1) return bold(rendered.toUpperCase())
  return bold(rendered)
}

/**
 * Expand tab stops for stable width math (tab = 2 at the panel's density).
 * @param {string} text
 */
const expandTabs = (text) => String(text ?? '').replace(/\t/g, '  ')

/**
 * Render a markdown table block. Cells are padded to the widest visible cell
 * and truncated to the reader width; the divider row is emitted in dim gray.
 * @param {string[]} rows
 * @param {number} width
 */
const renderTable = (rows, width) => {
  const parsed = rows.map((row) =>
    row
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((cell) => cell.trim()),
  )
  const dividerIndex = rows.findIndex((row) => TABLE_DIVIDER.test(row))
  const columnCount = Math.max(...parsed.map((cells) => cells.length))
  const columnWidths = Array.from({ length: columnCount }, (_, index) =>
    Math.max(...parsed.map((cells) => visibleWidth(cells[index] ?? ''))),
  )
  const lines = []
  for (const [rowIndex, cells] of parsed.entries()) {
    if (rowIndex === dividerIndex) {
      const rule = columnWidths.map((columnWidth) => '-'.repeat(columnWidth)).join('--')
      lines.push(dim(truncateToWidth(rule, width)))
      continue
    }
    const renderedCells = Array.from({ length: columnCount }, (_, index) =>
      padToWidth(renderInline(cells[index] ?? ''), columnWidths[index]),
    )
    lines.push(truncateToWidth(renderedCells.join('  ').replace(/\s+$/, ''), width))
  }
  return lines
}

/**
 * Render markdown into an array of terminal lines.
 * @param {string} markdown
 * @param {{ width?: number }} [options]
 * @returns {string[]}
 */
export const renderMarkdown = (markdown, { width = DEFAULT_READER_WIDTH } = {}) => {
  const lines = String(markdown ?? '').split('\n')
  const output = []
  let inFence = false
  let tableBuffer = []

  const flushTable = () => {
    if (tableBuffer.length === 0) return
    for (const line of renderTable(tableBuffer, width)) output.push(line)
    tableBuffer = []
  }

  for (const rawLine of lines) {
    const line = expandTabs(rawLine)

    const fence = FENCE.exec(line)
    if (fence) {
      flushTable()
      if (inFence) {
        output.push(dim('```'))
        inFence = false
      } else {
        output.push(dim(`\`\`\`${fence[1]}`.trimEnd()))
        inFence = true
      }
      continue
    }
    if (inFence) {
      output.push(dim(truncateToWidth(line, width)))
      continue
    }

    if (TABLE_ROW.test(line)) {
      tableBuffer.push(line)
      continue
    }
    if (tableBuffer.length > 0) flushTable()

    if (line.trim() === '') {
      output.push('')
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      output.push(truncateToWidth(headingStyle(heading[1].length, heading[2]), width))
      continue
    }

    const quote = QUOTE.exec(line)
    if (quote) {
      output.push(
        truncateToWidth(`${dim('│')} ${style(SGR.italic, renderInline(quote[1]))}`, width),
      )
      continue
    }

    const list = LIST_ITEM.exec(line)
    if (list) {
      const [, indent, marker, content] = list
      const bullet = /^\d/.test(marker) ? marker : '•'
      const prefix = `${indent}${bullet} `
      const wrapped = wrapInline(renderInline(content), Math.max(8, width - visibleWidth(prefix)))
      wrapped.forEach((piece, index) =>
        output.push(
          index === 0 ? `${prefix}${piece}` : `${' '.repeat(visibleWidth(prefix))}${piece}`,
        ),
      )
      continue
    }

    const wrapped = wrapInline(renderInline(line), width)
    for (const piece of wrapped) output.push(piece)
  }

  if (inFence) output.push(dim('```'))
  flushTable()
  return output
}

/**
 * Word-wrap a styled string preserving its escape sequences. Splits on
 * spaces (visible), never breaks inside a style run mid-word unless the word
 * alone exceeds the width.
 * @param {string} text
 * @param {number} width
 */
export const wrapInline = (text, width) => {
  const plain = String(text ?? '')
  if (width <= 0) return [plain]
  if (visibleWidth(plain) <= width) return [plain]
  const words = plain.split(' ')
  const lines = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (visibleWidth(candidate) <= width) {
      current = candidate
      continue
    }
    if (current) lines.push(current)
    current = visibleWidth(word) > width ? truncateToWidth(word, width) : word
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}
