'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type { SpeechCutTextUpdateResponse } from '@/app/(campaign)/campanha/(app)/comunicacao/acervo/cortes/[id]/types'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import { SPEECH_CUT_DESCRIPTION_MAX_LENGTH, SPEECH_CUT_TITLE_MAX_LENGTH } from '@/lib/speechCut'

type SpeechCutTextEditorProps = {
  cutId: number
  initialTitle: string
  initialDescription: string
  /** A cut still processing/without a file has nothing to publish — and no text to trust. */
  disabled?: boolean
}

/**
 * C168 — edits the cut's own title/description through the JSON route. Saving
 * refreshes the server tree, so the public page and the link preview reflect
 * the new text (the `afterChange` revalidation is the C167 one).
 */
export const SpeechCutTextEditor = ({
  cutId,
  initialTitle,
  initialDescription,
  disabled = false,
}: SpeechCutTextEditorProps) => {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [description, setDescription] = useState(initialDescription)
  const [saved, setSaved] = useState({ title: initialTitle, description: initialDescription })
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<'idle' | 'saved' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  const trimmedTitle = title.trim()
  const trimmedDescription = description.trim()
  const dirty =
    trimmedTitle !== saved.title.trim() || trimmedDescription !== saved.description.trim()
  const canSave =
    !disabled && dirty && trimmedTitle.length > 0 && trimmedDescription.length > 0 && !submitting

  const save = async () => {
    setSubmitting(true)
    setFeedback('idle')
    setError(null)

    try {
      const { ok, payload } = await postCampaignJson<SpeechCutTextUpdateResponse>(
        `/campanha/comunicacao/acervo/cortes/${cutId}/texto`,
        { cutId, title: trimmedTitle, description: trimmedDescription },
      )

      if (!ok || payload.status !== 'success') {
        setFeedback('error')
        setError(
          payload.status === 'error' ? payload.message : 'Não foi possível salvar as alterações.',
        )
        return
      }

      setSaved({ title: trimmedTitle, description: trimmedDescription })
      setFeedback('saved')
      router.refresh()
    } catch {
      setFeedback('error')
      setError('Não foi possível salvar as alterações.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="rounded-xl border p-4">
      <h2 className="text-sm font-medium">Editar título e descrição</h2>
      <p className="mt-0.5 text-xs text-muted-foreground">
        O que você salvar aqui aparece na página pública e no preview do link.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <Field>
          <FieldLabel htmlFor="speech-cut-title">Título</FieldLabel>
          <Input
            id="speech-cut-title"
            value={title}
            maxLength={SPEECH_CUT_TITLE_MAX_LENGTH}
            disabled={disabled || submitting}
            onChange={(event) => {
              setTitle(event.target.value)
              setFeedback('idle')
            }}
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
            disabled={disabled || submitting}
            onChange={(event) => {
              setDescription(event.target.value)
              setFeedback('idle')
            }}
          />
        </Field>
      </div>

      {feedback === 'error' && error ? (
        <Alert variant="destructive" className="mt-3 py-2">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-3 flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
        {feedback === 'saved' ? (
          <p className="text-xs text-muted-foreground sm:mr-auto" aria-live="polite">
            Alterações salvas.
          </p>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={disabled || submitting || !dirty}
          onClick={() => {
            setTitle(saved.title)
            setDescription(saved.description)
            setFeedback('idle')
            setError(null)
          }}
        >
          Descartar
        </Button>
        <Button type="button" className="min-h-11" disabled={!canSave} onClick={() => void save()}>
          {submitting ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
          Salvar alterações
        </Button>
      </div>
    </section>
  )
}
