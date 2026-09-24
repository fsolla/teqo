'use client'

import { AlertCircleIcon, CheckIcon, ScissorsIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type {
  SpeechCutSaveResponse,
  SpeechCutStatusResponse,
  SpeechCutSuggestionResponse,
} from '@/app/(campaign)/campanha/(app)/comunicacao/acervo/cortar/types'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import { SPEECH_CUT_GENERIC_ERROR_MESSAGE, type SpeechCutRequest } from '@/lib/schemas/speechCut'
import { formatSpeechClock, formatSpeechSpan } from '@/lib/speechClock'
import {
  buildSpeechCutFallbackMetadata,
  SPEECH_CUT_DESCRIPTION_MAX_LENGTH,
  SPEECH_CUT_TITLE_MAX_LENGTH,
  speechCutStepStates,
  type SpeechCutSourceKind,
  type SpeechCutStep,
  type SpeechCutViewModel,
} from '@/lib/speechCut'
import { MIN_EXCERPT_SECONDS, type ExcerptRange } from '@/lib/speechExcerptSelection'
import { cn } from '@/lib/utils'

const SAVE_ENDPOINT = '/campanha/comunicacao/acervo/cortar'
const STATUS_ENDPOINT = `${SAVE_ENDPOINT}/status`
const SUGGESTION_ENDPOINT = `${SAVE_ENDPOINT}/sugestao`
const POLL_INTERVAL_MS = 1500

type CutPhase = 'form' | 'running' | 'failed'

type SpeechCutDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  speechId: number
  speechType: string | null
  dateLabel: string
  summary: string | null
  range: ExcerptRange
  /** C217 — the speech duration positions the range track (scene 02). */
  speechDurationSeconds?: number | null
  /** C217 — default Câmara; `web` renames the resolving step and drops the credit. */
  speechSource?: SpeechCutSourceKind
  onPublished: (cut: SpeechCutViewModel) => void
}

const StepMark = ({ state }: { state: 'done' | 'current' | 'queued' }) =>
  state === 'done' ? (
    <CheckIcon className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
  ) : state === 'current' ? (
    <Spinner className="size-4 shrink-0" aria-label="Em andamento" />
  ) : (
    <span className="size-2 shrink-0 rounded-full bg-muted-foreground/40" aria-hidden="true" />
  )

/**
 * C167 — the "Cortar vídeo" flow: the C166 selection is fixed, title and
 * description arrive pre-filled (AI suggestion swapped in while the fields are
 * untouched, deterministic fallback otherwise) and confirming creates the cut
 * and follows the four honest steps until the public page exists. A failed cut
 * retries the same row — never a duplicate.
 */
export const SpeechCutDialog = ({
  open,
  onOpenChange,
  speechId,
  speechType,
  dateLabel,
  summary,
  range,
  speechDurationSeconds = null,
  speechSource = 'camara',
  onPublished,
}: SpeechCutDialogProps) => {
  const fallback = useMemo(
    () => buildSpeechCutFallbackMetadata({ speechType, dateLabel, summary, source: speechSource }),
    [speechType, dateLabel, summary, speechSource],
  )

  const [phase, setPhase] = useState<CutPhase>('form')
  const [cutId, setCutId] = useState<number | null>(null)
  const [step, setStep] = useState<SpeechCutStep | null>(null)
  const [title, setTitle] = useState(fallback.title)
  const [description, setDescription] = useState(fallback.description)
  const [source, setSource] = useState<'ai' | 'fallback' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const titleDirty = useRef(false)
  const descriptionDirty = useRef(false)
  const phaseRef = useRef<CutPhase>(phase)

  useEffect(() => {
    phaseRef.current = phase
  }, [phase])

  const durationSeconds = range.endSeconds - range.startSeconds
  // The track of the window inside the whole speech (scene 02): handles at the
  // picked edges, only when the speech duration is known.
  const trackDuration =
    speechDurationSeconds && speechDurationSeconds > 0 ? speechDurationSeconds : null
  const percentOf = (seconds: number): number =>
    trackDuration ? Math.min(100, Math.max(0, (seconds / trackDuration) * 100)) : 0
  const startPercent = percentOf(range.startSeconds)
  const endPercent = trackDuration ? 100 - percentOf(range.endSeconds) : 0

  // Opening resets the form to the deterministic fallback and asks the server
  // for the AI suggestion; the fallback is already on screen, so a slow or
  // unavailable provider never blocks the fields. A running cut resumes its
  // progress list instead of resetting (closing while it runs is allowed).
  useEffect(() => {
    if (!open || phaseRef.current === 'running') return
    titleDirty.current = false
    descriptionDirty.current = false
    setPhase('form')
    setCutId(null)
    setStep(null)
    setError(null)
    setSource(null)
    setTitle(fallback.title)
    setDescription(fallback.description)

    const controller = new AbortController()
    void (async () => {
      try {
        const { ok, payload } = await postCampaignJson<SpeechCutSuggestionResponse>(
          SUGGESTION_ENDPOINT,
          { speechId, startSeconds: range.startSeconds, endSeconds: range.endSeconds },
          controller.signal,
        )
        if (!ok || payload.status !== 'success') return
        setSource(payload.suggestion.source)
        if (payload.suggestion.source !== 'ai') return
        if (!titleDirty.current) setTitle(payload.suggestion.title)
        if (!descriptionDirty.current) setDescription(payload.suggestion.description)
      } catch {
        // The fallback already filled the form; the suggestion is an enhancement.
      }
    })()

    return () => controller.abort()
  }, [open, speechId, range.startSeconds, range.endSeconds, fallback])

  // While the cut runs, poll the row: `step` drives the honest progress list and
  // a terminal status closes the dialog into the result card or the error state.
  useEffect(() => {
    if (!open || phase !== 'running' || cutId === null) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null
    const controller = new AbortController()

    const tick = async () => {
      try {
        const { ok, payload } = await postCampaignJson<SpeechCutStatusResponse>(
          STATUS_ENDPOINT,
          { cutId },
          controller.signal,
        )
        if (cancelled) return
        if (!ok || payload.status !== 'success') {
          setPhase('failed')
          setError(payload.status === 'error' ? payload.message : SPEECH_CUT_GENERIC_ERROR_MESSAGE)
          return
        }
        const cut = payload.cut
        setStep(cut.step)
        if (cut.status === 'published') {
          // Back to the form so reopening starts a fresh cut instead of
          // replaying this one (the ref guard would otherwise keep `running`).
          setPhase('form')
          setCutId(null)
          onPublished(cut)
          onOpenChange(false)
          return
        }
        if (cut.status === 'failed') {
          // C169 — the row carries the mapped cause; null keeps the fallback
          // line of the failure scene (a failure the server did not name).
          setPhase('failed')
          setError(cut.failureMessage)
          return
        }
      } catch {
        // A transient poll failure is retried on the next tick.
      }
      if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS)
    }

    timer = setTimeout(tick, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      controller.abort()
      if (timer) clearTimeout(timer)
    }
  }, [open, phase, cutId, onPublished, onOpenChange])

  const submit = async (body: SpeechCutRequest) => {
    setSubmitting(true)
    setError(null)
    try {
      const { ok, payload } = await postCampaignJson<SpeechCutSaveResponse>(SAVE_ENDPOINT, body)
      if (!ok || payload.status !== 'success') {
        setError(payload.status === 'error' ? payload.message : SPEECH_CUT_GENERIC_ERROR_MESSAGE)
        return
      }
      setCutId(payload.cut.id)
      setStep(payload.cut.step ?? 'resolving')
      setPhase('running')
    } catch {
      setError(SPEECH_CUT_GENERIC_ERROR_MESSAGE)
    } finally {
      setSubmitting(false)
    }
  }

  const steps = speechCutStepStates(step, speechSource)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {phase === 'failed' ? 'Não foi possível cortar o trecho' : 'Cortar vídeo'}
          </DialogTitle>
          <DialogDescription>
            {phase === 'form'
              ? 'O arquivo sai com o trecho exato — nada antes, nada depois.'
              : phase === 'running'
                ? 'Isso costuma levar menos de um minuto. Não feche esta página.'
                : 'Nada foi publicado — o acervo e o trecho selecionado continuam como estavam.'}
          </DialogDescription>
        </DialogHeader>

        {phase === 'form' ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-sm">
                  {formatSpeechClock(range.startSeconds)} → {formatSpeechClock(range.endSeconds)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatSpeechSpan(durationSeconds)} · mínimo {MIN_EXCERPT_SECONDS} s · até o fim
                  da fala
                </span>
              </div>
              {trackDuration ? (
                <div className="relative mt-4 h-2 rounded-full bg-stone-200" aria-hidden="true">
                  <div
                    className="absolute h-2 rounded-full bg-primary"
                    style={{ left: `${startPercent}%`, right: `${endPercent}%` }}
                  />
                  <span
                    className="absolute -top-1.5 size-5 -translate-x-1/2 rounded-full border-2 border-primary bg-white"
                    style={{ left: `${startPercent}%` }}
                  />
                  <span
                    className="absolute -top-1.5 size-5 translate-x-1/2 rounded-full border-2 border-primary bg-white"
                    style={{ right: `${endPercent}%` }}
                  />
                </div>
              ) : null}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="text-xs font-medium">
                  Início
                  <Input
                    className="mt-1 font-mono"
                    value={formatSpeechClock(range.startSeconds)}
                    readOnly
                  />
                </label>
                <label className="text-xs font-medium">
                  Fim
                  <Input
                    className="mt-1 font-mono"
                    value={formatSpeechClock(range.endSeconds)}
                    readOnly
                  />
                </label>
              </div>
            </div>

            <Field>
              <FieldLabel htmlFor="speech-cut-title">Título</FieldLabel>
              <Input
                id="speech-cut-title"
                value={title}
                maxLength={SPEECH_CUT_TITLE_MAX_LENGTH}
                onChange={(event) => {
                  titleDirty.current = true
                  setTitle(event.target.value)
                }}
                disabled={submitting}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="speech-cut-description">Descrição</FieldLabel>
              <Textarea
                id="speech-cut-description"
                value={description}
                maxLength={SPEECH_CUT_DESCRIPTION_MAX_LENGTH}
                rows={4}
                className="min-h-24 resize-y"
                onChange={(event) => {
                  descriptionDirty.current = true
                  setDescription(event.target.value)
                }}
                disabled={submitting}
              />
            </Field>

            <p
              className={cn(
                'rounded-lg border px-3 py-2 text-xs',
                source === 'ai'
                  ? 'border-primary/40 bg-primary/10 text-foreground/90'
                  : 'text-muted-foreground',
              )}
            >
              {source === 'ai'
                ? 'Sugerido por IA — revise antes de publicar. Os dois campos são editáveis.'
                : 'Título e descrição podem ser editados antes de publicar.'}
            </p>

            {error ? (
              <Alert variant="destructive" className="py-2">
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                className="min-h-10"
                disabled={submitting}
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="min-h-10"
                disabled={submitting || title.trim() === '' || description.trim() === ''}
                onClick={() =>
                  void submit({
                    speechId,
                    startSeconds: range.startSeconds,
                    endSeconds: range.endSeconds,
                    title: title.trim(),
                    description: description.trim(),
                  })
                }
              >
                {submitting ? (
                  <Spinner data-icon="inline-start" aria-hidden="true" />
                ) : (
                  <ScissorsIcon data-icon="inline-start" aria-hidden="true" />
                )}
                Cortar e publicar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Nada é publicado antes de confirmar. No fim, o corte ganha o link{' '}
              <span className="font-mono">/corte/&lt;id&gt;</span> e o arquivo fica na biblioteca de
              cortes.
            </p>
          </div>
        ) : null}

        {phase === 'running' ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <Spinner className="size-5 text-muted-foreground" aria-label="Preparando o corte" />
              <p className="text-sm font-medium">Preparando o corte…</p>
            </div>
            <ol className="space-y-2">
              {steps.map((entry) => (
                <li
                  key={entry.step}
                  data-step-state={entry.state}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border px-3 py-2.5',
                    entry.state === 'current' && 'border-primary/40 bg-primary/10',
                  )}
                >
                  <StepMark state={entry.state} />
                  <span
                    className={cn(
                      'text-sm',
                      entry.state === 'current' ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {entry.label}
                  </span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {entry.state === 'done'
                      ? 'Concluído'
                      : entry.state === 'current'
                        ? 'Em andamento'
                        : 'Na fila'}
                  </span>
                </li>
              ))}
            </ol>
            <p className="border-t pt-3 text-xs text-muted-foreground">
              Nada foi publicado ainda. Se algo falhar, você volta ao acervo sem corte — nada fica
              no ar pela metade.
            </p>
          </div>
        ) : null}

        {phase === 'failed' ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <AlertCircleIcon
                className="mt-0.5 size-5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground">
                {error ??
                  (speechSource === 'web'
                    ? 'Não foi possível preparar o corte desta fala agora. Tente novamente em alguns minutos.'
                    : 'A Câmara não está entregando o vídeo desta fala agora. Tente novamente em alguns minutos.')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="min-h-10"
                disabled={submitting || cutId === null}
                onClick={() => {
                  if (cutId === null) return
                  void submit({ retryOf: cutId })
                }}
              >
                {submitting ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
                Tentar novamente
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-10"
                onClick={() => onOpenChange(false)}
              >
                Voltar ao acervo
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              O mesmo trecho continua selecionado; tentar de novo não cria corte duplicado.
            </p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
