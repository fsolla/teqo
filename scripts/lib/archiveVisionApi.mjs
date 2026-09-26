/**
 * C232 — thin OpenAI-compatible vision client for the photo-archive
 * cataloguing: one POST to `{base}/chat/completions` with the image as a
 * `data:` URL, plain `fetch` (injectable), timeout and retry with backoff for
 * transient failures only. There is no SDK dependency and no vendor pinned:
 * any local server speaking the protocol (Ollama, llama.cpp, vLLM) fits.
 *
 * The API key, when the server has one, travels in the `Authorization` header
 * and never enters logs or receipts. A 4xx answer is terminal (a wrong model
 * name must not be retried); 429/5xx/network/timeout retry.
 */

const DEFAULT_TIMEOUT_MS = 90_000
const DEFAULT_RETRY_ATTEMPTS = 3
const DEFAULT_RETRY_BASE_DELAY_MS = 2_000
const DEFAULT_MAX_OUTPUT_TOKENS = 900
const DEFAULT_TEMPERATURE = 0.2

export class ArchiveVisionError extends Error {
  /**
   * @param {string} message
   * @param {{ status?: number | null }} [options]
   */
  constructor(message, { status = null } = {}) {
    super(message)
    this.name = 'ArchiveVisionError'
    this.status = status
  }
}

/** HTTP 429/5xx, aborts and network errors retry; a 4xx refusal never does. */
const isRetryable = (error) => {
  if (error instanceof ArchiveVisionError) {
    return error.status === 429 || (error.status !== null && error.status >= 500)
  }
  return true
}

/**
 * One vision call returning the raw assistant content (the caller parses it
 * against the closed vocabularies). `imageDataUrl` is the prepared JPEG as a
 * `data:image/jpeg;base64,…` string; the original never leaves the machine
 * that prepared it.
 *
 * @param {{
 *   baseUrl?: string | null,
 *   model?: string | null,
 *   apiKey?: string | null,
 *   imageDataUrl: string,
 *   prompt: string,
 *   systemPrompt: string,
 *   fetchImpl?: typeof fetch,
 *   timeoutMs?: number,
 *   retryAttempts?: number,
 *   retryBaseDelayMs?: number,
 *   maxOutputTokens?: number,
 *   temperature?: number,
 *   sleep?: (ms: number) => Promise<void>,
 * }} options
 * @returns {Promise<string>}
 */
export const analyzeArchivePhotoVision = async ({
  baseUrl,
  model,
  apiKey = '',
  imageDataUrl,
  prompt,
  systemPrompt,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  retryAttempts = DEFAULT_RETRY_ATTEMPTS,
  retryBaseDelayMs = DEFAULT_RETRY_BASE_DELAY_MS,
  maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS,
  temperature = DEFAULT_TEMPERATURE,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}) => {
  const base = String(baseUrl ?? '')
    .trim()
    .replace(/\/+$/, '')
  if (base === '') throw new ArchiveVisionError('ARCHIVE_VISION_BASE_URL ausente.')
  const chosenModel = String(model ?? '').trim()
  if (chosenModel === '') throw new ArchiveVisionError('ARCHIVE_VISION_MODEL ausente.')
  if (typeof imageDataUrl !== 'string' || !imageDataUrl.startsWith('data:image/')) {
    throw new ArchiveVisionError('imagem preparada inválida (esperado data: URL).')
  }

  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' }
  const key = String(apiKey ?? '').trim()
  if (key !== '') headers.Authorization = `Bearer ${key}`

  const body = JSON.stringify({
    model: chosenModel,
    temperature,
    max_tokens: maxOutputTokens,
    stream: false,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      },
    ],
  })

  for (let attempt = 1; ; attempt += 1) {
    try {
      const response = await fetchImpl(`${base}/chat/completions`, {
        method: 'POST',
        headers,
        body,
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!response.ok) {
        // The provider's error body is operational gold ("model not found") —
        // clipped into the receipt message; never the request, image or key.
        let detail = ''
        try {
          detail = String(await response.text())
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 200)
        } catch {
          detail = ''
        }
        throw new ArchiveVisionError(`HTTP ${response.status}${detail ? `: ${detail}` : ''}`, {
          status: response.status,
        })
      }
      const parsed = await response.json().catch(() => {
        throw new ArchiveVisionError('resposta do engine não é JSON.')
      })
      const content = parsed?.choices?.[0]?.message?.content
      if (typeof content !== 'string' || content.trim() === '') {
        throw new ArchiveVisionError('resposta do engine sem conteúdo de texto.')
      }
      return content
    } catch (error) {
      if (attempt >= retryAttempts || !isRetryable(error)) throw error
      await sleep(retryBaseDelayMs * 2 ** (attempt - 1))
    }
  }
}
