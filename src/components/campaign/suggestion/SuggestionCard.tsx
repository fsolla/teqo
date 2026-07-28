'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import {
  getSuggestionPattern,
  SUGGESTION_TEXT_MAX_LENGTH,
  suggestionPostponeDays,
  suggestionTriageLabels,
  type SuggestionPatternId,
  type SuggestionTriageLevel,
} from '@/lib/suggestionCatalog'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

/** The slice of the evaluator's view model the card renders — texts come from the catalog. */
export type SuggestionCardData = {
  municipalityID: number
  municipalityName: string
  municipalitySlug: string
  patternId: SuggestionPatternId
  triageLevel: SuggestionTriageLevel
  factors: string[]
}

type SuggestionResolveAction = (
  state: CampaignFormActionState,
  formData: FormData,
) => Promise<CampaignFormActionState>

const GENERIC_ERROR_MESSAGE = 'Não foi possível registrar a decisão. Tente novamente.'

const firstErrorMessage = (state: CampaignFormActionState): string => {
  if ('message' in state && state.message) return state.message
  if ('fieldErrors' in state && state.fieldErrors) {
    const first = Object.values(state.fieldErrors).flat()[0]
    if (first) return first
  }
  return GENERIC_ERROR_MESSAGE
}

/**
 * E11 — one triggered pattern as a decision card: the reading, the observed
 * facts, the ordered action menu, and the three ways a human answers it.
 * Accept and dismiss are EXPLICIT submits (they carry a choice or a reading —
 * the `campanha-edit-where-you-see` exception for confirmation flows, same as
 * E14); postpone is a single labeled tap. Nothing here auto-decides.
 */
export const SuggestionCard = ({
  suggestion,
  showMunicipality = false,
  resolveAction,
}: {
  suggestion: SuggestionCardData
  /** Dashboard names the município; the detail card is already inside it. */
  showMunicipality?: boolean
  resolveAction: SuggestionResolveAction
}) => {
  const pattern = getSuggestionPattern(suggestion.patternId)
  const postponeDays = suggestionPostponeDays(suggestion.triageLevel)
  const baseId = useId()
  const titleId = `${baseId}-title`

  const [mode, setMode] = useState<'aceitar' | 'descartar' | null>(null)
  // The first menu action is the cheap 48h check — the recommended next step,
  // so it starts selected and one tap away under field pressure.
  const [chosenActionId, setChosenActionId] = useState(pattern.menu[0]?.id ?? '')
  const [note, setNote] = useState('')
  const [alternativeReading, setAlternativeReading] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Opening a form UNMOUNTS the trigger row (and vice versa), which would drop
  // keyboard focus on <body>: send it to the first field on open, back to the
  // matching trigger on cancel. On success the whole card leaves the queue —
  // the toast's live region is the announcement then.
  const formRef = useRef<HTMLFormElement | null>(null)
  const triggersRef = useRef<HTMLDivElement | null>(null)
  const previousModeRef = useRef<typeof mode>(null)
  useEffect(() => {
    const previous = previousModeRef.current
    previousModeRef.current = mode
    if (mode !== null) {
      formRef.current?.querySelector<HTMLElement>('input, textarea, button')?.focus()
      return
    }
    if (previous !== null) triggersRef.current?.querySelector('button')?.focus()
  }, [mode])

  const submit = (fields: Record<string, string>) => {
    setErrorMessage(null)
    const formData = new FormData()
    formData.set('municipality', String(suggestion.municipalityID))
    formData.set('patternId', suggestion.patternId)
    for (const [key, value] of Object.entries(fields)) {
      if (value) formData.set(key, value)
    }
    startTransition(async () => {
      const result = await resolveAction({}, formData)
      if ('status' in result && result.status === 'success') {
        // The card leaves the queue when the revalidated RSC lands — the same
        // transition — so the toast is the persistent copy of what happened.
        toast.success(result.message)
        setMode(null)
        return
      }
      const message = firstErrorMessage(result)
      setErrorMessage(message)
      toast.error(message)
    })
  }

  return (
    <article
      aria-labelledby={titleId}
      aria-busy={isPending}
      data-pending={isPending || undefined}
      className="flex flex-col gap-3 rounded-lg border p-4 transition-opacity data-pending:opacity-60"
    >
      <header className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Badge
          variant={suggestion.triageLevel === 1 ? 'destructive' : 'outline'}
          aria-label={`Nível ${suggestion.triageLevel} — ${suggestionTriageLabels[suggestion.triageLevel]}`}
        >
          Nível {suggestion.triageLevel}
        </Badge>
        <h3 id={titleId} className="text-sm font-semibold">
          {pattern.title}
        </h3>
        {showMunicipality ? (
          <Link
            href={`/campanha/municipios/${suggestion.municipalitySlug}`}
            className="ml-auto text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {suggestion.municipalityName}
          </Link>
        ) : null}
      </header>

      <p className="text-sm text-muted-foreground">{pattern.probableReading}</p>

      {suggestion.factors.length ? (
        <ul
          className="m-0 flex list-none flex-col gap-0.5 p-0 text-xs [&>li]:mt-0"
          aria-label="Fatos observados"
        >
          {suggestion.factors.map((factor) => (
            <li key={factor} className="flex gap-1.5">
              <span aria-hidden="true" className="text-foreground/40">
                •
              </span>
              <span className="text-foreground/80">{factor}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* The menu IS a sequence — cheap before expensive — so the numbering
          carries information, it is not scaffolding. */}
      <ol className="m-0 flex list-none flex-col gap-1 p-0 text-sm [&>li]:mt-0">
        {pattern.menu.map((action, index) => (
          <li key={action.id} className="flex gap-2">
            <span className="shrink-0 font-medium text-muted-foreground tabular-nums">
              {index + 1}º
            </span>
            <span>{action.label}</span>
          </li>
        ))}
      </ol>

      <p className="text-xs text-muted-foreground">
        <span className="font-medium">Contraindicação:</span> {pattern.contraindication}
      </p>

      {mode === null ? (
        <div ref={triggersRef} className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            className="min-h-11"
            disabled={isPending}
            onClick={() => {
              setErrorMessage(null)
              setMode('aceitar')
            }}
          >
            Aceitar
          </Button>
          <Button
            variant="outline"
            className="min-h-11"
            disabled={isPending}
            onClick={() => submit({ outcome: 'adiada' })}
          >
            {isPending ? <Spinner className="size-4" /> : null}
            Adiar {postponeDays} dias
          </Button>
          <Button
            variant="ghost"
            className="min-h-11"
            disabled={isPending}
            onClick={() => {
              setErrorMessage(null)
              setMode('descartar')
            }}
          >
            Descartar
          </Button>
        </div>
      ) : null}

      {mode === 'aceitar' ? (
        <form
          ref={formRef}
          className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3"
          onSubmit={(event) => {
            event.preventDefault()
            submit({ outcome: 'aceita', chosenActionId, note })
          }}
        >
          <FieldSet className="gap-2">
            <FieldLegend variant="label">Qual ação do menu foi tomada?</FieldLegend>
            {pattern.menu.map((action) => (
              <label key={action.id} className="flex min-h-11 items-center gap-2.5 text-sm">
                <input
                  type="radio"
                  name={`${baseId}-action`}
                  value={action.id}
                  checked={chosenActionId === action.id}
                  onChange={() => setChosenActionId(action.id)}
                  className="size-4 shrink-0 accent-primary"
                />
                <span>{action.label}</span>
              </label>
            ))}
          </FieldSet>
          <FieldLabel htmlFor={`${baseId}-note`}>
            Nota <span className="font-normal text-muted-foreground">(opcional)</span>
          </FieldLabel>
          <Textarea
            id={`${baseId}-note`}
            value={note}
            maxLength={SUGGESTION_TEXT_MAX_LENGTH}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Quem executa, prazo combinado, contexto…"
            rows={2}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-11" disabled={isPending || !chosenActionId}>
              {isPending ? <Spinner className="size-4" /> : null}
              Registrar decisão
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              disabled={isPending}
              onClick={() => setMode(null)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      {mode === 'descartar' ? (
        <form
          ref={formRef}
          className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (!alternativeReading.trim()) {
              setErrorMessage('Informe a leitura alternativa ao descartar a sugestão.')
              return
            }
            submit({ outcome: 'descarta', alternativeReading })
          }}
        >
          <FieldSet className="gap-2">
            <FieldLegend variant="label">O que explica melhor estes dados?</FieldLegend>
            <p className="text-xs text-muted-foreground">
              O descarte registra a leitura que venceu a sugestão — é o dado que o backtest compara
              com o resultado.
            </p>
            {pattern.alternativeReadings.map((reading) => (
              <label key={reading} className="flex min-h-11 items-center gap-2.5 text-sm">
                <input
                  type="radio"
                  name={`${baseId}-reading`}
                  value={reading}
                  checked={alternativeReading === reading}
                  onChange={() => {
                    setErrorMessage(null)
                    setAlternativeReading(reading)
                  }}
                  className="size-4 shrink-0 accent-primary"
                />
                <span>{reading}</span>
              </label>
            ))}
          </FieldSet>
          <FieldLabel htmlFor={`${baseId}-reading-text`}>Leitura alternativa</FieldLabel>
          <Textarea
            id={`${baseId}-reading-text`}
            value={alternativeReading}
            maxLength={SUGGESTION_TEXT_MAX_LENGTH}
            onChange={(event) => {
              setErrorMessage(null)
              setAlternativeReading(event.target.value)
            }}
            placeholder="Edite ou escreva a leitura que explica melhor o caso…"
            rows={2}
            required
          />
          <div className="flex flex-wrap gap-2">
            <Button type="submit" className="min-h-11" disabled={isPending}>
              {isPending ? <Spinner className="size-4" /> : null}
              Descartar com leitura
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              disabled={isPending}
              onClick={() => setMode(null)}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      {errorMessage ? (
        <p role="alert" className="text-sm font-medium text-destructive">
          {errorMessage}
        </p>
      ) : null}
      <span aria-live="polite" className="sr-only">
        {isPending ? 'Registrando decisão…' : ''}
      </span>
    </article>
  )
}
