// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  EXTEND_DEFAULT_PROMPT,
  MASK_DEFAULT_PROMPT,
  extendedCanvas,
  padToMultipleOf64,
  parseExtendPx,
  parseFillArgs,
} from '../../scripts/lib/imageFill.mjs'

describe('parseExtendPx', () => {
  it('plain integers are pixels', () => {
    expect(parseExtendPx('400')).toBe(400)
    expect(parseExtendPx(' 600 ')).toBe(600)
  })

  it('percentages are accepted (resolved against the photo height later)', () => {
    expect(parseExtendPx('30%')).toBe(30)
    expect(parseExtendPx('100%')).toBe(100)
  })

  it('fails closed on anything else', () => {
    for (const bad of ['', 'abc', '-400', '0', '30.5', '30.5%', '400px']) {
      expect(parseExtendPx(bad)).toBeNull()
    }
  })
})

describe('extendedCanvas', () => {
  it('grows only downward, photo keeps its top position', () => {
    const canvas = extendedCanvas(1000, 1500, 500)
    expect(canvas).toEqual({ width: 1000, height: 2000, offsetY: 1500 })
  })
})

describe('padToMultipleOf64', () => {
  it('rounds up to the next multiple of 64 on each axis', () => {
    expect(padToMultipleOf64(600, 1260)).toEqual({
      width: 640,
      height: 1280,
      padRight: 40,
      padBottom: 20,
    })
    expect(padToMultipleOf64(2000, 1200)).toEqual({
      width: 2048,
      height: 1216,
      padRight: 48,
      padBottom: 16,
    })
  })

  it('is a no-op for exact multiples', () => {
    expect(padToMultipleOf64(1024, 1536)).toEqual({
      width: 1024,
      height: 1536,
      padRight: 0,
      padBottom: 0,
    })
  })
})

describe('parseFillArgs', () => {
  it('--extend flow defaults: prompt de extensão, resize on, out public, 28 passos', () => {
    const options = parseFillArgs(['--photo', 'lula.jpg', '--extend', '40%'])
    expect(options).toEqual({
      help: false,
      photo: 'lula.jpg',
      mask: null,
      extend: '40%',
      prompt: EXTEND_DEFAULT_PROMPT,
      steps: 28,
      outDir: 'public',
      resize: true,
    })
  })

  it('--mask flow defaults to the mask prompt', () => {
    const options = parseFillArgs(['--photo', 'foto.png', '--mask', 'm.png'])
    expect(options.mask).toBe('m.png')
    expect(options.extend).toBeNull()
    expect(options.prompt).toBe(MASK_DEFAULT_PROMPT)
  })

  it('reads value flags as --flag value and --flag=value', () => {
    const spaced = parseFillArgs([
      '--photo',
      'a.jpg',
      '--mask',
      'b.png',
      '--prompt',
      'terno',
      '--out',
      'draft/',
    ])
    expect(spaced.photo).toBe('a.jpg')
    expect(spaced.prompt).toBe('terno')
    expect(spaced.outDir).toBe('draft/')

    const equals = parseFillArgs(['--photo=a.jpg', '--extend=30%', '--steps=50'])
    expect(equals.extend).toBe('30%')
    expect(equals.steps).toBe(50)
  })

  it('--no-resize is a bare boolean flag', () => {
    expect(parseFillArgs(['--photo', 'a.jpg', '--extend', '10%', '--no-resize']).resize).toBe(false)
  })

  it('fails closed: photo required, mask xor extend, invalid flags/values', () => {
    expect(() => parseFillArgs(['--extend', '30%'])).toThrow(/--photo é obrigatório/)
    expect(() => parseFillArgs(['--photo', 'a.jpg'])).toThrow(/--mask|--extend/)
    expect(() => parseFillArgs(['--photo', 'a.jpg', '--mask', 'm.png', '--extend', '10%'])).toThrow(
      /mutuamente exclusivos/,
    )
    expect(() => parseFillArgs(['--photo', 'a.jpg', '--extend', 'x%'])).toThrow(/--extend inválido/)
    expect(() => parseFillArgs(['--photo', 'a.jpg', '--extend', '10%', '--steps', '99'])).toThrow(
      /--steps inválido/,
    )
    expect(() => parseFillArgs(['--photo', 'a.jpg', '--extend', '10%', '--toaster'])).toThrow(
      /flag desconhecida/,
    )
    expect(() => parseFillArgs(['a.jpg', '--extend', '10%'])).toThrow(/posicional/)
  })

  it('--help skips validation', () => {
    const options = parseFillArgs(['--help'])
    expect(options.help).toBe(true)
    expect(options.photo).toBeUndefined()
  })
})
