'use client'

import { BookmarkPlusIcon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { usePeopleSavedFilters } from '@/components/campaign/shared/usePeopleSavedFilters'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { cn } from '@/lib/utils'
import {
  buildPeopleFilterHref,
  formatPeopleActiveFiltersSummary,
} from '@/utilities/people/peopleListFilters'
import type { PeopleListState } from '@/utilities/people/peopleListUrl'
import {
  MAX_ENTRIES,
  MAX_NAME_LENGTH,
  savePeopleSavedFilter,
} from '@/utilities/people/peopleSavedFilters'

type SavePeopleFilterControlProps = {
  /**
   * The APPLIED state — a search still inside the debounce window is not in the URL yet.
   */
  state: PeopleListState
  /** Municipality id → name, for the default name and the summary (optional). */
  municipalityLabelsById?: ReadonlyMap<number, string>
  /**
   * `trailing` (desktop, beside the omnibox) or `header` (mobile icon button,
   * registered via `SetCampaignHeaderAction` — the C100 mobile spec).
   */
  variant?: 'trailing' | 'header'
}

/**
 * Names the current recorte and keeps it in the sidebar (B18 pattern, 2nd call
 * site). Naming is confirmatory, so this is the explicit-submit exception the
 * edit-where-you-see rule already carves out for flows that need a note.
 */
export const SavePeopleFilterControl = ({
  state,
  municipalityLabelsById,
  variant = 'trailing',
}: SavePeopleFilterControlProps) => {
  const savedFilters = usePeopleSavedFilters()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const nameId = useId()
  const errorId = `${nameId}-error`

  const summary = formatPeopleActiveFiltersSummary(state, municipalityLabelsById)
  const href = buildPeopleFilterHref(state)
  const existing = savedFilters.find((entry) => entry.href === href)

  // The bare list has no recorte to name — same gate the clear affordance uses.
  if (!summary) return null

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) return
    setName(existing?.name ?? summary.slice(0, MAX_NAME_LENGTH))
    setErrorMessage('')
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim()) {
      setErrorMessage('Dê um nome ao filtro.')
      return
    }

    const result = savePeopleSavedFilter({ href, name })
    if (result === 'limit') {
      setErrorMessage(
        `Você já tem ${MAX_ENTRIES} filtros salvos. Apague um em Pessoas, na navegação, para salvar outro.`,
      )
      return
    }
    if (result === 'failed') {
      setErrorMessage('Não foi possível salvar neste dispositivo. Tente de novo.')
      return
    }

    setOpen(false)
    toast.success(existing ? 'Nome atualizado.' : 'Filtro salvo em Pessoas, na navegação.')
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn('min-h-11 shrink-0', variant === 'trailing' ? 'md:self-end' : 'md:hidden')}
          // SC 2.5.3: an accessible name has to CONTAIN the visible label, or
          // "clique em Salvar filtro" matches nothing by voice. The rename case
          // may add the target's name because it keeps the visible word first.
          aria-label={existing ? `Renomear o filtro salvo ${existing.name}` : undefined}
        >
          <BookmarkPlusIcon aria-hidden="true" />
          <span className={cn(variant === 'header' && 'sr-only')}>
            {existing ? 'Renomear' : 'Salvar filtro'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="Salvar filtro" className="w-80">
        {/* Portaled out of the search form above, so this nests no form. */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <Field>
            <FieldLabel htmlFor={nameId}>Nome do filtro</FieldLabel>
            <Input
              id={nameId}
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setErrorMessage('')
              }}
              maxLength={MAX_NAME_LENGTH}
              autoComplete="off"
              autoFocus
              className="min-h-11"
              aria-invalid={errorMessage ? true : undefined}
              aria-describedby={errorMessage ? errorId : undefined}
            />
            <FieldDescription>{summary}</FieldDescription>
          </Field>
          {errorMessage ? (
            <Alert variant="destructive" id={errorId}>
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" className="min-h-11 w-full">
            {existing ? 'Atualizar nome' : 'Salvar'}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
