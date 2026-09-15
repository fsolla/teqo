// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { stripAnsi, visibleWidth } from '../../scripts/lib/ansi.mjs'
import { renderInline, renderMarkdown, wrapInline } from '../../scripts/lib/markdown-ansi.mjs'

const plain = (lines: string[]) => lines.map((line) => stripAnsi(line))

describe('markdown-ansi (OPS109)', () => {
  it('renders headings with hierarchy (h1 uppercase, h2 bold)', () => {
    const lines = renderMarkdown('# Título\n\n## Seção\n\n### Sub')
    expect(plain(lines)[0]).toBe('TÍTULO')
    expect(plain(lines)[2]).toBe('Seção')
    expect(plain(lines)[4]).toBe('Sub')
  })

  it('renders inline bold, code, italic and links', () => {
    expect(plain([renderInline('com **negrito** aqui')])).toEqual(['com negrito aqui'])
    expect(plain([renderInline('use `pnpm gate` agora')])).toEqual(['use pnpm gate agora'])
    expect(plain([renderInline('um *itálico* só')])).toEqual(['um itálico só'])
    expect(plain([renderInline('veja [plano](docs/x.md)')])).toEqual(['veja plano (docs/x.md)'])
  })

  it('renders unordered and ordered lists with wrapping indent', () => {
    const lines = plain(renderMarkdown('- um\n- dois\n\n1. primeiro\n2. segundo'))
    expect(lines).toEqual(['• um', '• dois', '', '1. primeiro', '2. segundo'])
  })

  it('renders tables with aligned columns and a dim divider', () => {
    const lines = renderMarkdown('| A | B |\n|---|---|\n| x | y |')
    expect(plain(lines)).toEqual(['A    B', '--------', 'x    y'])
  })

  it('renders fenced code dimmed and preserves content', () => {
    const lines = plain(renderMarkdown('```text\nfluxo → outcome\n```'))
    expect(lines).toEqual(['```text', 'fluxo → outcome', '```'])
  })

  it('renders blockquotes with a left bar', () => {
    expect(plain(renderMarkdown('> citação de exemplo'))).toEqual(['│ citação de exemplo'])
  })

  it('passes unknown lines through untouched (never loses content)', () => {
    expect(plain(renderMarkdown('linha || esquisita ***'))).toEqual(['linha || esquisita ***'])
  })

  it('closes an unterminated fence at the end', () => {
    const lines = plain(renderMarkdown('```\naberto'))
    expect(lines[0]).toBe('```')
    expect(lines[1]).toBe('aberto')
    expect(lines[2]).toBe('```')
  })

  it('wraps long lines to the reader width without breaking words', () => {
    const lines = renderMarkdown('palavra '.repeat(12).trim(), { width: 20 })
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) expect(visibleWidth(line)).toBeLessThanOrEqual(20)
  })

  it('truncates a single word longer than the width', () => {
    expect(wrapInline('x'.repeat(50), 10)).toEqual(['xxxxxxxxx…'])
  })
})
