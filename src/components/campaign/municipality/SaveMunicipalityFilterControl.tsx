'use client'

import { BookmarkPlusIcon } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { useMunicipalitySavedFilters } from '@/components/campaign/shared/useMunicipalitySavedFilters'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { cn } from '@/lib/utils'
import {
  buildMunicipalitySavedFilterHref,
  formatMunicipalityActiveFiltersSummary,
} from '@/utilities/municipality/municipalityListFilters'
import type { MunicipalityListState } from '@/utilities/municipality/municipalityListUrl'
import {
  MAX_ENTRIES,
  MAX_NAME_LENGTH,
  saveMunicipalitySavedFilter,
} from '@/utilities/municipality/municipalitySavedFilters'

type SaveMunicipalityFilterControlProps = {
  /** The APPLIED state — a search still inside the debounce window is not in the URL yet. */
  state: MunicipalityListState
  /**
   * B184 — trigger shape: `panel` is the filter-bar button with text label
   * (desktop); `icon` is the icon-only header button (mobile top bar). The
   * naming popover is identical in both.
   */
  presentation?: 'panel' | 'icon'
  /** Extra classes for the trigger button (e.g. viewport gating, header colors). */
  className?: string
}

/**
 * Names the current recorte and keeps it in the sidebar (B18).
 *
 * Naming is confirmatory, so this is the explicit-submit exception
 * `.agents/rules/campanha-edit-where-you-see.mdc` already carves out for flows
 * that need a note — and it keeps this control out of the auto-save machine the
 * quick-edit cells share.
 */
export const SaveMunicipalityFilterControl = ({
  state,
  presentation = 'panel',
  className,
}: SaveMunicipalityFilterControlProps) => {
  const savedFilters = useMunicipalitySavedFilters()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const nameId = useId()
  const errorId = `${nameId}-error`

  const summary = formatMunicipalityActiveFiltersSummary(state)
  const href = buildMunicipalitySavedFilterHref(state)
  const existing = savedFilters.find((entry) => entry.href === href)

  // The bare list has no recorte to name. This is the same gate the `Limpar`
  // button uses, minus the draft search: only what the URL already holds can be
  // bookmarked, or the name would describe a filter the href does not carry.
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

    const result = saveMunicipalitySavedFilter({ href, name })
    if (result === 'limit') {
      setErrorMessage(
        `Você já tem ${MAX_ENTRIES} filtros salvos. Apague um em Municípios, na navegação, para salvar outro.`,
      )
      return
    }
    if (result === 'failed') {
      setErrorMessage('Não foi possível salvar neste dispositivo. Tente de novo.')
      return
    }

    setOpen(false)
    toast.success(existing ? 'Nome atualizado.' : 'Filtro salvo em Municípios, na navegação.')
  }

  const renameLabel = existing ? `Renomear o filtro salvo ${existing.name}` : undefined
  const iconLabel = presentation === 'icon' ? (renameLabel ?? 'Salvar filtro') : undefined

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={presentation === 'icon' ? 'icon' : undefined}
          className={cn(
            'shrink-0',
            presentation === 'panel' && 'min-h-11 md:self-end',
            presentation === 'icon' && 'size-11',
            className,
          )}
          // SC 2.5.3: an accessible name has to CONTAIN the visible label, or
          // "clique em Salvar filtro" matches nothing by voice. The rename case
          // may add the target's name because it keeps the visible word first.
          // The icon presentation has no visible text, so the name is always
          // the aria-label.
          aria-label={presentation === 'icon' ? iconLabel : renameLabel}
        >
          <BookmarkPlusIcon aria-hidden="true" />
          {presentation === 'panel' ? (existing ? 'Renomear' : 'Salvar filtro') : null}
        </Button>
      </PopoverTrigger>
      {/* Radix gives the content `role="dialog"` and no name of its own. */}
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
              // `role="alert"` announces the refusal once; this is what tells a
              // reader returning to the field WHY it is still invalid.
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
