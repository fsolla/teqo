import 'server-only'

/**
 * Transcribes a recorded voice clip to text via Deep Infra's OpenAI-compatible
 * transcription endpoint (B173). Same provider/key as the Sollinha LLM
 * (`DEEPINFRA_API_KEY`), so one account, one key, one invoice.
 *
 * The audio is forwarded as a multipart `file` and never persisted anywhere —
 * it lives only in this function's memory for the duration of the provider
 * call (product requirement: B173 processes and discards the recording).
 */

export const DEEPINFRA_TRANSCRIBE_URL = 'https://api.deepinfra.com/v1/openai/audio/transcriptions'
const DEEPINFRA_WHISPER_MODEL = 'openai/whisper-large-v3'
const DEEPINFRA_LANGUAGE = 'pt'

export type TranscribeAudioResult =
  | { ok: true; text: string }
  | { ok: false; error: string; status: number }

/**
 * Sends the clip to Deep Infra Whisper large-v3 and returns the transcript.
 * Never throws: every failure becomes `{ ok: false }` with a pt-BR message the
 * route can return verbatim, so a provider outage or a missing key degrades to
 * "sem voz" instead of breaking the text chat.
 */
export const deepInfraTranscribe = async (file: Blob): Promise<TranscribeAudioResult> => {
  const apiKey = process.env.DEEPINFRA_API_KEY
  if (!apiKey) {
    return { ok: false, error: 'Transcrição de voz está indisponível no momento.', status: 503 }
  }

  const form = new FormData()
  form.append('file', file, 'voice.webm')
  form.append('model', DEEPINFRA_WHISPER_MODEL)
  form.append('language', DEEPINFRA_LANGUAGE)

  try {
    const response = await fetch(DEEPINFRA_TRANSCRIBE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })

    if (!response.ok) {
      return {
        ok: false,
        error: 'Não foi possível transcrever o áudio. Tente novamente.',
        status: 502,
      }
    }

    const data = (await response.json()) as { text?: unknown }
    const text = typeof data.text === 'string' ? data.text.trim() : ''
    if (!text) {
      return {
        ok: false,
        error: 'Não foi possível transcrever o áudio. Tente novamente.',
        status: 502,
      }
    }

    return { ok: true, text }
  } catch {
    return {
      ok: false,
      error: 'Não foi possível transcrever o áudio. Tente novamente.',
      status: 502,
    }
  }
}
