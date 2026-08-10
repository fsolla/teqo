'use client'

import { useId, useState } from 'react'

import { FieldDescription, FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { MAX_ACTIVITY_TAG_LENGTH, MAX_ACTIVITY_TAGS } from '@/lib/schemas/activity'

/**
 * C105 — free-form tag chips shared by the activity form and the agenda's
 * inline create sheet (C91). Tags are typed freely, deduped and bounded;
 * `knownTags` feed a datalist of tags already used in the campaign
 * (autocomplete, never a curated list). The hidden input carries the JSON
 * tags under `tagsJson` so the surrounding form's FormData contract stays
 * untouched; `onChange` is an optional live mirror for consumers that build
 * state from the tags before submit.
 */
export const ActivityTagInput = ({
  initialTags = [],
  knownTags = [],
  error,
  onChange,
  compact = false,
  placeholder,
}: {
  initialTags?: string[]
  knownTags?: string[]
  error?: string
  onChange?: (tags: string[]) => void
  /** Label-less list-row variant (C103 mobile sheet): borderless input, no description. */
  compact?: boolean
  /** Input placeholder override (defaults to the C105 copy). */
  placeholder?: string
}) => {
  const [tags, setTags] = useState<string[]>(initialTags)
  const [input, setInput] = useState('')

  const datalistId = useId()

  const addTag = (raw: string) => {
    const trimmed = raw.trim().slice(0, MAX_ACTIVITY_TAG_LENGTH)
    if (!trimmed) return
    if (tags.includes(trimmed)) return
    if (tags.length >= MAX_ACTIVITY_TAGS) return
    const next = [...tags, trimmed]
    setTags(next)
    setInput('')
    onChange?.(next)
  }

  const removeTag = (tag: string) => {
    const next = tags.filter((entry) => entry !== tag)
    setTags(next)
    onChange?.(next)
  }

  const removeLastTag = () => {
    if (tags.length === 0) return
    const next = tags.slice(0, -1)
    setTags(next)
    onChange?.(next)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="rounded-sm opacity-70 hover:opacity-100"
              aria-label={`Remover tag ${tag}`}
            >
              ×
            </button>
          </span>
        ))}
        {tags.length < MAX_ACTIVITY_TAGS ? (
          <Input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ',') {
                event.preventDefault()
                addTag(input)
              } else if (event.key === 'Backspace' && !input) {
                event.preventDefault()
                removeLastTag()
              }
            }}
            onBlur={() => addTag(input)}
            placeholder={
              placeholder ?? (tags.length === 0 ? 'Ex.: comício, imprensa…' : 'Adicionar tag…')
            }
            className={
              compact
                ? 'min-h-11 flex-1 rounded-none border-0 bg-transparent px-0 focus-visible:ring-2 focus-visible:ring-primary/30'
                : 'min-h-9 flex-1'
            }
            list={datalistId}
            maxLength={MAX_ACTIVITY_TAG_LENGTH}
            aria-label="Adicionar tag"
          />
        ) : null}
        <datalist id={datalistId}>
          {knownTags
            .filter((tag) => !tags.includes(tag))
            .map((tag) => (
              <option key={tag} value={tag} />
            ))}
        </datalist>
      </div>
      <input type="hidden" name="tagsJson" value={JSON.stringify(tags)} />
      {compact ? null : (
        <FieldDescription>
          Classificação livre do compromisso. Digite e pressione Enter ou vírgula para adicionar.
        </FieldDescription>
      )}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  )
}
