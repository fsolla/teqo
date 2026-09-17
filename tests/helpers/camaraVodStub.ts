/**
 * Shared Câmara VOD fetch double for the cut (C167) and frame (C182) int specs:
 * answers `video-sob-demanda` with a status document and the media URLs with the
 * requested bytes. Anything else throws, so a spec cannot silently hit the real
 * Câmara. `deadUrls` forces a 403 on a specific media link.
 */
export const PLAYBACK_URL = 'https://cdn.camara.leg.br/trecho.mp4'
export const DOWNLOAD_URL = 'https://cdn.camara.leg.br/trecho-download.mp4'
export const MP4_BYTES = Buffer.from('camara-mp4-bytes')

export const camaraVodStub = ({
  apiState = 'PRONTO',
  apiPlaybackUrl = PLAYBACK_URL,
  apiDownloadUrl = DOWNLOAD_URL,
  mediaBytes = MP4_BYTES,
  deadUrls = [],
}: {
  apiState?: 'PRONTO' | 'INDISPONIVEL' | 'GERANDO'
  apiPlaybackUrl?: string
  apiDownloadUrl?: string
  mediaBytes?: Buffer
  deadUrls?: string[]
} = {}): typeof fetch =>
  (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('video-sob-demanda')) {
      return new Response(
        JSON.stringify({
          estado: apiState,
          video:
            apiState === 'PRONTO'
              ? { linkParaReproducao: apiPlaybackUrl, linkParaDownload: apiDownloadUrl }
              : null,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }
    if (deadUrls.includes(url)) return new Response('', { status: 403 })
    if (
      url === apiPlaybackUrl ||
      url === apiDownloadUrl ||
      url === PLAYBACK_URL ||
      url === DOWNLOAD_URL
    ) {
      return new Response(new Uint8Array(mediaBytes), {
        status: 200,
        headers: { 'Content-Type': 'video/mp4', 'Content-Length': String(mediaBytes.length) },
      })
    }
    throw new Error(`Unexpected fetch to ${url}`)
  }) as typeof fetch

export const camaraFetchStub = (bytes: Buffer): typeof fetch => camaraVodStub({ mediaBytes: bytes })
