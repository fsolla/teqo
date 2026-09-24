'use client'

import { startTransition, useActionState, useState, type FormEvent } from 'react'

import { ContentPiecePeopleField } from '@/components/campaign/content/ContentPiecePeopleField'
import { CampaignFormActionMessage } from '@/components/campaign/shared/CampaignFormActionMessage'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import {
  CONTENT_PIECE_DESCRIPTION_MAX_LENGTH,
  CONTENT_PIECE_INSTITUTION_MAX_LENGTH,
  CONTENT_PIECE_TITLE_MAX_LENGTH,
  CONTENT_PIECE_TYPES,
  contentPieceTypeLabels,
  type ContentPieceType,
} from '@/lib/contentPiece'
import { SPEECH_TOPICS, type SpeechTopic } from '@/lib/speechFacets'
import { cn } from '@/lib/utils'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'
import type { ContentPieceLeaderOption } from '@/utilities/content/contentPieceLeaderOptions'

type MunicipalityOption = { id: number; name: string }

/**
 * C211 — the editable ficha of one piece (approved design scene 4): the
 * catalogue the pipeline filled, ready for the assessoria to revise. Saving
 * marks the sent fields as curated, so the automatic cataloguing never
 * overwrites them (D6). The transcript is a first-class field — it is what the
 * public search (S28) indexes. S37 adds "Quem aparece na peça" between Temas
 * and Cidade (approved design scene 01A).
 */
export const ContentPieceForm = ({
  piece,
  municipalityOptions,
  leaderOptions,
  publicFigures,
  searchLeaders,
  formAction,
}: {
  piece: {
    id: number
    title: string
    description: string | null
    type: ContentPieceType
    pieceDate: string | null
    topics: SpeechTopic[]
    municipalityId: number | null
    institution: string | null
    transcript: string | null
  }
  municipalityOptions: readonly MunicipalityOption[]
  /** S37 — the picked leaders, resolved to `{ id, label }` for the chips. */
  leaderOptions: readonly ContentPieceLeaderOption[]
  /** S37 — the curated public figures already on the piece. */
  publicFigures: readonly string[]
  /** S37 — the gated async search behind the leader picker. */
  searchLeaders: (query: string) => Promise<ContentPieceLeaderOption[]>
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})
  const [topics, setTopics] = useState<SpeechTopic[]>(piece.topics)
  const [type, setType] = useState<ContentPieceType>(piece.type)

  // C140 — manual dispatch (no `action={submitAction}`): React 19 resets
  // uncontrolled fields after any settled form action, wiping typed values on a
  // validation error — the page stays visible, so the wipe showed.
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    startTransition(() => submitAction(new FormData(event.currentTarget)))
  }

  const toggleTopic = (topic: SpeechTopic) => {
    setTopics((current) =>
      current.includes(topic) ? current.filter((value) => value !== topic) : [...current, topic],
    )
  }

  return (
    <form onSubmit={handleSubmit} className="grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
      <input type="hidden" name="contentPieceId" value={piece.id} />
      {topics.map((topic) => (
        <input key={topic} type="hidden" name="topics" value={topic} />
      ))}

      <Field className="sm:col-span-2">
        <FieldLabel htmlFor="content-piece-title">Título</FieldLabel>
        <Input
          id="content-piece-title"
          name="title"
          required
          maxLength={CONTENT_PIECE_TITLE_MAX_LENGTH}
          defaultValue={piece.title}
          className="min-h-11"
        />
        {fieldError(state.fieldErrors, 'title') ? (
          <FieldError>{fieldError(state.fieldErrors, 'title')}</FieldError>
        ) : null}
      </Field>

      <Field className="sm:col-span-2">
        <FieldLabel htmlFor="content-piece-description">Descrição</FieldLabel>
        <Textarea
          id="content-piece-description"
          name="description"
          rows={3}
          maxLength={CONTENT_PIECE_DESCRIPTION_MAX_LENGTH}
          defaultValue={piece.description ?? undefined}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="content-piece-type">Tipo</FieldLabel>
        <NativeSelect
          id="content-piece-type"
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value as ContentPieceType)}
          className="min-h-11 w-full"
        >
          {CONTENT_PIECE_TYPES.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {contentPieceTypeLabels[value]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <Field>
        <FieldLabel htmlFor="content-piece-date">Data da peça</FieldLabel>
        <Input
          id="content-piece-date"
          name="pieceDate"
          type="date"
          defaultValue={piece.pieceDate?.slice(0, 10) ?? undefined}
          className="min-h-11"
        />
      </Field>

      <Field className="sm:col-span-2">
        <FieldLabel>Temas</FieldLabel>
        <div role="group" aria-label="Temas" className="flex flex-wrap gap-2">
          {SPEECH_TOPICS.map((topic) => {
            const active = topics.includes(topic.value)
            return (
              <button
                key={topic.value}
                type="button"
                aria-pressed={active}
                onClick={() => toggleTopic(topic.value)}
                className={cn(
                  'min-h-11 rounded-full border px-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:min-h-9',
                  active
                    ? 'border-foreground/25 bg-muted font-semibold text-foreground'
                    : 'border-border font-normal text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                {topic.label}
              </button>
            )
          })}
        </div>
      </Field>

      <ContentPiecePeopleField
        leaders={leaderOptions}
        publicFigures={publicFigures}
        searchLeaders={searchLeaders}
      />

      <Field>
        <FieldLabel htmlFor="content-piece-municipality">Cidade</FieldLabel>
        <NativeSelect
          id="content-piece-municipality"
          name="municipalityId"
          defaultValue={piece.municipalityId ? String(piece.municipalityId) : ''}
          className="min-h-11 w-full"
        >
          <NativeSelectOption value="">Sem cidade</NativeSelectOption>
          {municipalityOptions.map((municipality) => (
            <NativeSelectOption key={municipality.id} value={String(municipality.id)}>
              {municipality.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>

      <Field>
        <FieldLabel htmlFor="content-piece-institution">Instituição</FieldLabel>
        <Input
          id="content-piece-institution"
          name="institution"
          maxLength={CONTENT_PIECE_INSTITUTION_MAX_LENGTH}
          defaultValue={piece.institution ?? undefined}
          className="min-h-11"
        />
      </Field>

      <Field className="sm:col-span-2">
        <FieldLabel htmlFor="content-piece-transcript">Transcrição / texto</FieldLabel>
        <Textarea
          id="content-piece-transcript"
          name="transcript"
          rows={8}
          defaultValue={piece.transcript ?? undefined}
        />
      </Field>

      <div className="sm:col-span-2">
        <CampaignFormActionMessage state={state} />
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="min-h-11 sm:col-span-2 sm:justify-self-end"
      >
        {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
        Salvar alterações
      </Button>
    </form>
  )
}
