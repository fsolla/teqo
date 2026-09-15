// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  clearScreen,
  enterAlternateScreen,
  leaveAlternateScreen,
  padToWidth,
  SGR,
  stripAnsi,
  style,
  terminalSize,
  tone,
  truncateToWidth,
  visibleWidth,
} from '../../scripts/lib/ansi.mjs'

describe('ansi (OPS109)', () => {
  it('strips SGR sequences when measuring', () => {
    const styled = style(SGR.bold, 'olá')
    expect(stripAnsi(styled)).toBe('olá')
    expect(visibleWidth(styled)).toBe(3)
    expect(visibleWidth('olá')).toBe(3)
  })

  it('keeps plain text untouched', () => {
    expect(stripAnsi('sem escape')).toBe('sem escape')
  })

  it('truncates with an ellipsis at the visible limit', () => {
    expect(truncateToWidth('abcdef', 4)).toBe('abc…')
    expect(truncateToWidth('abc', 4)).toBe('abc')
    expect(truncateToWidth('abc', 0)).toBe('')
  })

  it('measures width ignoring escapes when truncating', () => {
    const styled = `${SGR.bold}abcdef${SGR.reset}`
    expect(stripAnsi(truncateToWidth(styled, 3))).toBe('ab…')
  })

  it('pads to the target width after the text', () => {
    expect(padToWidth('ab', 4)).toBe('ab  ')
    expect(stripAnsi(padToWidth(`${SGR.bold}ab`, 4))).toBe('ab  ')
    expect(visibleWidth(padToWidth('abcdef', 4))).toBe(4)
  })

  it('emits the alternate-screen enter/leave pair and clear', () => {
    expect(enterAlternateScreen()).toBe('\u001b[?1049h')
    expect(leaveAlternateScreen()).toBe('\u001b[?1049l')
    expect(clearScreen()).toBe('\u001b[2J\u001b[H')
  })

  it('falls back to 80x24 when the size is unknown', () => {
    expect(terminalSize({})).toEqual({ columns: 80, rows: 24 })
    expect(terminalSize({ columns: 0, rows: Number.NaN })).toEqual({ columns: 80, rows: 24 })
    expect(terminalSize({ columns: 46, rows: 20 })).toEqual({ columns: 46, rows: 20 })
  })

  it('styles known tones and degrades unknown ones to gray', () => {
    expect(tone('ok', 'x')).toBe(style(SGR.green, 'x'))
    expect(tone('wait', 'x')).toBe(style(SGR.yellow, 'x'))
    expect(tone('bad', 'x')).toBe(style(SGR.red, 'x'))
    expect(tone('whatever', 'x')).toBe(style(SGR.gray, 'x'))
  })
})
