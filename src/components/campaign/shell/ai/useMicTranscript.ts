'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type MicTranscriptStatus = 'idle' | 'recording' | 'transcribing' | 'error'

type UseMicTranscriptOptions = {
  /** Recording cap (seconds): stops an accidental infinite clip automatically. */
  maxDurationSeconds?: number
}

const TRANSCRIBE_ENDPOINT = '/campanha/api/ai-transcribe'
const DEFAULT_MAX_DURATION_SECONDS = 60
const MESSAGE_VOICE_UNSUPPORTED = 'Este navegador não suporta gravação de voz por aqui.'
const MESSAGE_PERMISSION_DENIED =
  'Não foi possível acessar o microfone. Verifique a permissão no navegador e tente novamente.'
const MESSAGE_TRANSCRIBE_FAILED = 'Não foi possível transcrever o áudio. Tente novamente.'

const stopStreamTracks = (stream: MediaStream) => {
  stream.getTracks().forEach((track) => track.stop())
}

/**
 * B173: the voice-input state machine behind the Sollinha chat mic button.
 * Owns the browser audio capture (getUserMedia + MediaRecorder), the elapsed
 * timer, the multipart POST to `/campanha/api/ai-transcribe` and the pt-BR
 * mapping of every failure — so `CampaignAIChat` stays render-only and the
 * whole flow is unit-testable with stubbed browser APIs.
 *
 * Product contract it enforces: the transcript is delivered as a draft string
 * (the caller puts it in the chat input), never auto-sent; any failure degrades
 * to an `error` state with a message, keeping the text chat fully usable.
 */
export const useMicTranscript = ({
  maxDurationSeconds = DEFAULT_MAX_DURATION_SECONDS,
}: UseMicTranscriptOptions = {}) => {
  const [status, setStatus] = useState<MicTranscriptStatus>('idle')
  const [transcript, setTranscript] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)
  const elapsedRef = useRef(0)
  // True from unmount cleanup until the next `start()`: blocks an in-flight
  // transcription from reporting through a dead component (StrictMode remounts
  // are covered because `start()` resets it).
  const cancelledRef = useRef(false)

  const clearElapsedTimer = useCallback(() => {
    if (timerRef.current !== undefined) {
      clearInterval(timerRef.current)
      timerRef.current = undefined
    }
  }, [])

  const sendForTranscription = useCallback(async (clip: Blob) => {
    if (cancelledRef.current) return
    setStatus('transcribing')
    setErrorMessage(null)

    const form = new FormData()
    form.append('file', clip, 'voice.webm')

    try {
      const response = await fetch(TRANSCRIBE_ENDPOINT, { method: 'POST', body: form })
      const payload = (await response.json()) as { text?: string; error?: string }
      if (cancelledRef.current) return
      if (!response.ok || typeof payload.text !== 'string') {
        setStatus('error')
        setErrorMessage(payload.error ?? MESSAGE_TRANSCRIBE_FAILED)
        return
      }
      setTranscript(payload.text)
      setStatus('idle')
    } catch {
      if (cancelledRef.current) return
      setStatus('error')
      setErrorMessage(MESSAGE_TRANSCRIBE_FAILED)
    }
  }, [])

  /** Stops an active capture; the recorder's `stop` event fires the transcription. */
  const stop = useCallback(() => {
    clearElapsedTimer()
    const recorder = recorderRef.current
    if (!recorder || recorder.state === 'inactive') return
    try {
      recorder.stop()
    } catch {
      // Already stopped (e.g. the platform stopped it): nothing to finalize.
    }
  }, [clearElapsedTimer])

  const start = useCallback(async () => {
    cancelledRef.current = false
    setErrorMessage(null)
    setTranscript('')

    if (typeof MediaRecorder === 'undefined') {
      setStatus('error')
      setErrorMessage(MESSAGE_VOICE_UNSUPPORTED)
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setStatus('error')
      setErrorMessage(MESSAGE_PERMISSION_DENIED)
      return
    }

    if (cancelledRef.current) {
      stopStreamTracks(stream)
      return
    }
    streamRef.current = stream

    const recorder = new MediaRecorder(stream)
    recorderRef.current = recorder
    chunksRef.current = []

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data)
    })
    recorder.addEventListener('stop', () => {
      const clip = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      chunksRef.current = []
      if (clip.size > 0) void sendForTranscription(clip)
      else if (!cancelledRef.current) {
        setStatus('error')
        setErrorMessage(MESSAGE_TRANSCRIBE_FAILED)
      }
    })

    recorder.start()
    setStatus('recording')
    elapsedRef.current = 0
    setElapsed(0)
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1
      setElapsed(elapsedRef.current)
      if (elapsedRef.current >= maxDurationSeconds) stop()
    }, 1000)
  }, [maxDurationSeconds, sendForTranscription, stop])

  // Unmount (or closing the chat) abandons the capture: tracks stop, recorder
  // stops, and nothing in flight reports through a dead component.
  useEffect(
    () => () => {
      cancelledRef.current = true
      clearElapsedTimer()
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') {
        try {
          recorder.stop()
        } catch {
          // Already stopped by the stop button.
        }
      }
      if (streamRef.current) stopStreamTracks(streamRef.current)
      streamRef.current = null
      recorderRef.current = null
    },
    [clearElapsedTimer],
  )

  const dismissError = useCallback(() => {
    setErrorMessage(null)
    setStatus('idle')
  }, [])

  return { status, transcript, errorMessage, elapsed, start, stop, dismissError }
}
