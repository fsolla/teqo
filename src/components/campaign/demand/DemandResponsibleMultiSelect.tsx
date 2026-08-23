'use client'

import { ChevronsUpDownIcon, XIcon } from 'lucide-react'
import { useState } from 'react'

import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/Command'
import { Spinner } from '@/components/ui/Spinner'
import { useAsyncSearchOptions } from '@/hooks/useAsyncSearchOptions'
import { campaignUserInitials } from '@/utilities/campaignUserProfile'

export type DemandResponsibleOption = RelationOption & { avatarUrl?: string | null }

type DemandResponsibleMultiSelectProps = {
  /** FormData field name — repeated hidden inputs, one per selected id. */
  name: string
  value: DemandResponsibleOption[]
  /** When set, this id renders as "(criador)" (informational marker). */
  creatorUserId?: number | null
  /** Create flow: the creator chip cannot be removed (the hook re-adds it). */
  lockCreator?: boolean
  /** Server action — short queries return municipality-advisor suggestions. */
  search: (query: string) => Promise<RelationOption[]>
  /** Trigger text while empty, e.g. "Buscar assessor…". */
  triggerPlaceholder: string
  /** Accessible name of the add trigger (the list renders its own sr-only names). */
  triggerAriaLabel: string
  disabled?: boolean
  /** Fires on every change with the full selected id list (dirty tracking). */
  onChange?: (ids: number[]) => void
}

/**
 * C143 — multi-value responsible picker for campaign demands (staff only).
 * The chips carry the selected list as repeated hidden inputs; the search
 * catalog is the `searchDemandResponsibleOptions` action, whose short-query
 * branch returns the municipality's advisors as suggestions (a fill-in
 * shortcut — visibility comes only from the saved list).
 */
export const DemandResponsibleMultiSelect = ({
  name,
  value,
  creatorUserId = null,
  lockCreator = true,
  search,
  triggerPlaceholder,
  triggerAriaLabel,
  disabled,
  onChange,
}: DemandResponsibleMultiSelectProps) => {
  const [selected, setSelected] = useState<DemandResponsibleOption[]>(value)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const { options, loading, failed } = useAsyncSearchOptions({ open, query, search })

  const isCreator = (id: number) => creatorUserId != null && creatorUserId === id
  const selectedIds = new Set(selected.map((option) => option.id))

  // Discrete user events re-render between calls, so reading `selected` here
  // is safe (same shape as `RelationMultiSelect`); an updater side effect
  // would double-fire onChange under StrictMode.
  const add = (option: RelationOption) => {
    if (selectedIds.has(option.id)) return
    const next = [...selected, { ...option, avatarUrl: undefined }]
    setSelected(next)
    onChange?.(next.map((entry) => entry.id))
  }

  const remove = (option: DemandResponsibleOption) => {
    if (isCreator(option.id) && lockCreator) return
    const next = selected.filter((entry) => entry.id !== option.id)
    setSelected(next)
    onChange?.(next.map((entry) => entry.id))
  }

  const visibleOptions = options.filter((option) => !selectedIds.has(option.id))
  const shortQuery = query.trim().length < 2
  const selectedLabel =
    selected.length === 0
      ? triggerPlaceholder
      : `${selected.length} ${selected.length === 1 ? 'responsável' : 'responsáveis'}`

  return (
    <>
      {selected.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((option) => (
            <li key={option.id}>
              <Badge variant="secondary" className="gap-1.5 pr-1">
                {option.avatarUrl ? (
                  <Avatar size="sm" className="shrink-0">
                    <AvatarImage src={option.avatarUrl} alt="" />
                    <AvatarFallback>{campaignUserInitials(option.name)}</AvatarFallback>
                  </Avatar>
                ) : null}
                <input type="hidden" name={name} value={option.id} />
                <span className="font-normal">{option.name}</span>
                {isCreator(option.id) ? (
                  <span className="text-muted-foreground">(criador)</span>
                ) : null}
                {!isCreator(option.id) ? (
                  <button
                    type="button"
                    aria-label={`Remover ${option.name}`}
                    className="inline-flex size-6 items-center justify-center rounded-full hover:bg-foreground/10"
                    disabled={disabled}
                    onClick={() => remove(option)}
                  >
                    <XIcon className="size-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full justify-between font-normal"
        aria-label={`${triggerAriaLabel}: ${selectedLabel}`}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <span className="truncate">{triggerPlaceholder}</span>
        <ChevronsUpDownIcon aria-hidden="true" />
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={triggerAriaLabel}
        description="Busque por nome e escolha um ou mais responsáveis."
        showCloseButton
      >
        <Command shouldFilter={false} label={triggerAriaLabel}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar assessor…"
            aria-label={triggerAriaLabel}
          />
          <CommandList aria-busy={loading}>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Spinner aria-hidden="true" />
                Buscando…
              </div>
            ) : failed ? (
              <p className="py-6 text-center text-sm text-destructive">
                Não foi possível concluir a busca.
              </p>
            ) : visibleOptions.length > 0 ? (
              <CommandGroup heading={shortQuery ? 'Sugestões do município' : 'Assessores'}>
                {visibleOptions.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={`${option.name}-${option.id}`}
                    onSelect={() => add(option)}
                  >
                    <span className="truncate">{option.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {shortQuery
                  ? 'Sem assessores sugeridos para este município.'
                  : 'Nenhum resultado encontrado.'}
              </p>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
