// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  PRIVATE_MEDIA_FALLBACK_MIME_TYPE,
  privateMediaContentDisposition,
  privateMediaContentType,
  privateMediaHeaders,
  type PrivateMediaRange,
} from '@/lib/privateMedia'

const fullRange: PrivateMediaRange = {
  status: 200,
  headers: { 'Accept-Ranges': 'bytes', 'Content-Length': '100' },
}

const partialRange: PrivateMediaRange = {
  status: 206,
  headers: { 'Accept-Ranges': 'bytes', 'Content-Length': '10', 'Content-Range': 'bytes 0-9/100' },
}

const invalidRange: PrivateMediaRange = {
  status: 416,
  headers: { 'Content-Range': 'bytes */100' },
}

describe('private media response rules (C193/C199)', () => {
  it('serves only allowlisted types inline; everything else degrades', () => {
    expect(privateMediaContentType('video/mp4')).toBe('video/mp4')
    expect(privateMediaContentType('video/quicktime')).toBe('video/quicktime')
    expect(privateMediaContentType('video/x-matroska')).toBe('video/x-matroska')
    expect(privateMediaContentType('audio/mpeg')).toBe('audio/mpeg')
    expect(privateMediaContentType('image/jpeg')).toBe('image/jpeg')
    expect(privateMediaContentType('text/html')).toBe(PRIVATE_MEDIA_FALLBACK_MIME_TYPE)
    expect(privateMediaContentType(null)).toBe(PRIVATE_MEDIA_FALLBACK_MIME_TYPE)
  })

  it('builds both filename forms and encodes non-ASCII', () => {
    expect(privateMediaContentDisposition('reel.mp4', false)).toBe(
      'inline; filename="reel.mp4"; filename*=UTF-8\'\'reel.mp4',
    )
    expect(privateMediaContentDisposition('capa ção.png', true)).toBe(
      'attachment; filename="capa_o.png"; filename*=UTF-8\'\'capa%20%C3%A7%C3%A3o.png',
    )
    expect(privateMediaContentDisposition(null, false)).toContain('filename="arquivo"')
  })

  it('keeps the range headers and adds the private streaming contract', () => {
    const headers = privateMediaHeaders({
      range: partialRange,
      mimeType: 'video/mp4',
      filename: 'reel.mp4',
      download: false,
    })
    expect(headers.get('Content-Range')).toBe('bytes 0-9/100')
    expect(headers.get('Content-Length')).toBe('10')
    expect(headers.get('Accept-Ranges')).toBe('bytes')
    expect(headers.get('Content-Type')).toBe('video/mp4')
    expect(headers.get('Content-Disposition')).toContain('inline')
    expect(headers.get('Cache-Control')).toBe('private, no-store')
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headers.get('Content-Security-Policy')).toBeNull()
  })

  it('forces a download for unsafe types and for ?download=1', () => {
    const unsafe = privateMediaHeaders({
      range: fullRange,
      mimeType: 'text/html',
      filename: 'roteiro.html',
      download: false,
    })
    expect(unsafe.get('Content-Type')).toBe(PRIVATE_MEDIA_FALLBACK_MIME_TYPE)
    expect(unsafe.get('Content-Disposition')).toContain('attachment')
    expect(unsafe.get('Content-Security-Policy')).toBe("default-src 'none'")

    const explicit = privateMediaHeaders({
      range: fullRange,
      mimeType: 'video/mp4',
      filename: 'reel.mp4',
      download: true,
    })
    expect(explicit.get('Content-Disposition')).toContain('attachment')
  })

  it('passes the 416 headers through untouched', () => {
    const headers = privateMediaHeaders({
      range: invalidRange,
      mimeType: 'video/mp4',
      filename: 'reel.mp4',
      download: false,
    })
    expect(headers.get('Content-Range')).toBe('bytes */100')
    expect(headers.get('Content-Type')).toBe('video/mp4')
  })
})
