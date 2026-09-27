import 'server-only'

/**
 * Reads a request body with a hard byte ceiling, streaming and aborting as
 * soon as the ceiling is crossed — a chunked body without `content-length`
 * cannot make a route buffer unbounded input. `null` means "refused".
 *
 * Single owner of the bounded-read rule for the anonymous public JSON routes
 * (the content-events beacon and the selfie search); extracted from the beacon
 * route when it earned a second caller.
 */
export const readBoundedRequestBody = async (
  request: Request,
  maxBytes: number,
): Promise<string | null> => {
  const body = request.body
  if (!body) return ''

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let text = ''
  let bytes = 0

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break

      bytes += value.byteLength
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => undefined)
        return null
      }
      text += decoder.decode(value, { stream: true })
    }
    return text + decoder.decode()
  } catch {
    await reader.cancel().catch(() => undefined)
    return null
  }
}
