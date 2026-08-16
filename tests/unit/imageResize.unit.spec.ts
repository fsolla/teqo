// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  FORMAT_MAX_WIDTHS,
  deriveOutputFileName,
  maxWidthFor,
  normalizeImageFormat,
  parseResizeArgs,
} from '../../scripts/lib/imageResize.mjs'

describe('parseResizeArgs', () => {
  it('defaults: avif + webp, per-format width/quality, no bg removal, out public', () => {
    const options = parseResizeArgs(['foto.jpg'])
    expect(options).toEqual({
      help: false,
      paths: ['foto.jpg'],
      maxWidth: undefined,
      quality: undefined,
      formats: ['avif', 'webp'],
      outDir: 'public',
      removeBg: false,
    })
  })

  it('--remove-bg is a bare boolean flag', () => {
    expect(parseResizeArgs(['--remove-bg', 'foto.jpg']).removeBg).toBe(true)
    expect(parseResizeArgs(['foto.jpg']).removeBg).toBe(false)
  })

  it('accepts multiple positional paths and folders', () => {
    const options = parseResizeArgs(['a.jpg', 'b.png', 'fotos/'])
    expect(options.paths).toEqual(['a.jpg', 'b.png', 'fotos/'])
  })

  it('reads flags both as --flag value and --flag=value', () => {
    const spaced = parseResizeArgs([
      '--max-width',
      '2560',
      '--format',
      'webp',
      '--out',
      'public/x',
      'foto.jpg',
    ])
    expect(spaced.maxWidth).toBe(2560)
    expect(spaced.formats).toEqual(['webp'])
    expect(spaced.outDir).toBe('public/x')

    const equals = parseResizeArgs([
      '--max-width=2560',
      '--quality=75',
      '--format=jpeg',
      '--out=out/',
      'foto.jpg',
    ])
    expect(equals.maxWidth).toBe(2560)
    expect(equals.quality).toBe(75)
    expect(equals.formats).toEqual(['jpeg'])
    expect(equals.outDir).toBe('out/')
  })

  it('accepts a comma-separated --format list, deduped and order-preserving', () => {
    expect(parseResizeArgs(['--format', 'avif,webp', 'foto.jpg']).formats).toEqual(['avif', 'webp'])
    expect(parseResizeArgs(['--format', 'avif,jpeg', 'foto.jpg']).formats).toEqual(['avif', 'jpeg'])
    expect(parseResizeArgs(['--format', 'webp,avif,webp', 'foto.jpg']).formats).toEqual([
      'webp',
      'avif',
    ])
    expect(parseResizeArgs(['--format', 'avif,,webp', 'foto.jpg']).formats).toEqual([
      'avif',
      'webp',
    ])
  })

  it('leaves quality and maxWidth undefined without flags (each format applies its own default)', () => {
    expect(parseResizeArgs(['--format', 'webp', 'foto.jpg']).quality).toBeUndefined()
    expect(parseResizeArgs(['--format', 'jpeg', 'foto.jpg']).quality).toBeUndefined()
    expect(parseResizeArgs(['foto.jpg']).quality).toBeUndefined()
    expect(parseResizeArgs(['foto.jpg']).maxWidth).toBeUndefined()
  })

  it('fails closed on an unknown flag', () => {
    expect(() => parseResizeArgs(['--toaster', 'foto.jpg'])).toThrow(/flag desconhecida/)
  })

  it('fails closed on a missing flag value (end of argv or next token is a flag)', () => {
    expect(() => parseResizeArgs(['--max-width'])).toThrow(/espera um valor/)
    expect(() => parseResizeArgs(['--out', '--format', 'webp', 'foto.jpg'])).toThrow(
      /espera um valor/,
    )
  })

  it('fails closed on invalid numbers', () => {
    for (const bad of ['0', '-100', 'abc', '31.5', '3840px']) {
      expect(() => parseResizeArgs(['--max-width', bad, 'foto.jpg'])).toThrow(
        /--max-width inválido/,
      )
    }
    for (const bad of ['0', '101', 'xyz']) {
      expect(() => parseResizeArgs(['--quality', bad, 'foto.jpg'])).toThrow(/--quality inválido/)
    }
  })

  it('fails closed on an unsupported format, a list with one, or an all-empty list', () => {
    expect(() => parseResizeArgs(['--format', 'png', 'foto.jpg'])).toThrow(/--format inválido/)
    expect(() => parseResizeArgs(['--format', 'avif,svg', 'foto.jpg'])).toThrow(/--format inválido/)
    expect(() => parseResizeArgs(['--format', ',', 'foto.jpg'])).toThrow(/--format inválido/)
    expect(() => parseResizeArgs(['--format', ' , ', 'foto.jpg'])).toThrow(/--format inválido/)
  })

  it('fails closed on no paths', () => {
    expect(() => parseResizeArgs([])).toThrow(/nenhum caminho/)
  })

  it('--help skips validation', () => {
    const options = parseResizeArgs(['--help'])
    expect(options.help).toBe(true)
    expect(options.paths).toEqual([])
  })
})

describe('normalizeImageFormat', () => {
  it('accepts canonical names case-insensitively', () => {
    expect(normalizeImageFormat('avif')).toBe('avif')
    expect(normalizeImageFormat('WebP')).toBe('webp')
    expect(normalizeImageFormat('JPEG')).toBe('jpeg')
  })

  it('maps jpg aliases to jpeg and ignores a leading dot', () => {
    expect(normalizeImageFormat('jpg')).toBe('jpeg')
    expect(normalizeImageFormat('.jpeg')).toBe('jpeg')
  })

  it('returns null for anything not encodable', () => {
    for (const bad of ['png', 'gif', 'svg', '', 'aviff']) {
      expect(normalizeImageFormat(bad)).toBeNull()
    }
  })
})

describe('deriveOutputFileName', () => {
  it('keeps the basename and swaps the extension per format', () => {
    expect(deriveOutputFileName('foto.jpg', 'avif')).toBe('foto.avif')
    expect(deriveOutputFileName('foto.jpeg', 'webp')).toBe('foto.webp')
    expect(deriveOutputFileName('foto.PNG', 'jpeg')).toBe('foto.jpg')
  })

  it('survives dots inside the name', () => {
    expect(deriveOutputFileName('foto.final.1.jpg', 'avif')).toBe('foto.final.1.avif')
  })

  it('the web name never collides with a source in another format', () => {
    expect(deriveOutputFileName('foto.avif', 'avif')).toBe('foto.avif')
    expect(deriveOutputFileName('foto.avif', 'webp')).toBe('foto.webp')
  })
})

describe('maxWidthFor (PenPot companion must be light)', () => {
  it('defaults per format: avif retina-grade 2x, webp/jpeg 1x desktop', () => {
    expect(FORMAT_MAX_WIDTHS.avif).toBe(3840)
    expect(FORMAT_MAX_WIDTHS.webp).toBe(1920)
    expect(FORMAT_MAX_WIDTHS.jpeg).toBe(1920)
    expect(maxWidthFor('avif')).toBe(3840)
    expect(maxWidthFor('webp')).toBe(1920)
    expect(maxWidthFor('jpeg')).toBe(1920)
  })

  it('an explicit --max-width overrides every format', () => {
    expect(maxWidthFor('avif', 2560)).toBe(2560)
    expect(maxWidthFor('webp', 2560)).toBe(2560)
    expect(maxWidthFor('webp', 900)).toBe(900)
  })
})
