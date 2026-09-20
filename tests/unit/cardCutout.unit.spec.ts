import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  cappedSize,
  removeCardPhotoBackground,
  supportsWebAssembly,
  supportsWebgl,
} from '@/components/cards/cardCutout'

const photo = {} as File
const report = () => {}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('supportsWebAssembly', () => {
  it('is true where wasm compiles', () => {
    expect(supportsWebAssembly()).toBe(true)
  })

  it('fails closed when the browser hides WebAssembly (IronFox default)', () => {
    vi.stubGlobal('WebAssembly', undefined)

    expect(supportsWebAssembly()).toBe(false)
  })
})

describe('removeCardPhotoBackground — unsupported browser', () => {
  it('reports `unsupported` before downloading anything when WebAssembly is off', async () => {
    vi.stubGlobal('WebAssembly', undefined)

    await expect(removeCardPhotoBackground(photo, report)).resolves.toEqual({
      ok: false,
      reason: 'unsupported',
    })
  })

  it('reports `unsupported` when WebGL is blocked (MediaPipe graph needs it even on CPU)', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)

    expect(supportsWebgl()).toBe(false)
    await expect(removeCardPhotoBackground(photo, report)).resolves.toEqual({
      ok: false,
      reason: 'unsupported',
    })
  })
})

describe('cappedSize (inference input cap)', () => {
  it('caps the longest edge at 1600 regardless of orientation', () => {
    expect(cappedSize(7000, 8750)).toEqual({ width: 1280, height: 1600 })
    expect(cappedSize(4032, 3024)).toEqual({ width: 1600, height: 1200 })
  })

  it('keeps photos already inside the cap untouched', () => {
    expect(cappedSize(800, 600)).toEqual({ width: 800, height: 600 })
  })
})
