'use client'

import { ChevronsUpDownIcon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

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
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/Spinner'
import { isContactSearchQueryReady } from '@/lib/contactSearchQuery'
import {
  MAX_ACTIVITY_RESPONSIBLES,
  type ActivityResponsibleCollection,
} from '@/lib/schemas/activity'
import { cn } from '@/lib/utils'

export type ResponsibleOption = {
  relationTo: ActivityResponsibleCollection
  id: number
  name: string
  typeLabel: string
}

type ResponsibleMultiSelectProps = {
  /** FormData field name — a hidden JSON field with the typed entries. */
  name: string
  label: string
  value?: ResponsibleOption[]
  error?: string
  description?: string
  /** Extra classes for the field label (e.g. `sr-only` on label-less sheets). */
  labelClassName?: string
  /** Trigger text while empty (replaces the "Nenhum" fallback). */
  emptyText?: string
  /** Extra classes for the trigger button (e.g. borderless list rows). */
  triggerClassName?: string
  search: (query: string) => Promise<ResponsibleOption[]>
}

/**
 * C90 — polymorphic multi-value responsible picker for the activity form
 * (later reused by the agenda inline creation, C91). One search catalog across
 * staff/leadership/dobradinha, results grouped by type, removable typed chips.
 */
export const ResponsibleMultiSelect = ({
  name,
  label,
  value = [],
  error,
  description,
  labelClassName,
  emptyText,
  triggerClassName,
  search,
}: ResponsibleMultiSelectProps) => {
  // Initial-only (like RelationMultiSelect's initialSelectedIDs): on the create
  // page `value` is a fresh `[]` every render and a sync effect would wipe the
  // user's picks on any failed submit.
  const [selected, setSelected] = useState<ResponsibleOption[]>(value)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<ResponsibleOption[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const requestId = useRef(0)
  const searchRef = useRef(search)

  searchRef.current = search

  useEffect(() => {
    if (!open) return
    if (!isContactSearchQueryReady(query)) {
      setOptions([])
      setLoading(false)
      setFailed(false)
      return
    }

    const currentRequestId = ++requestId.current
    const timeout = window.setTimeout(() => {
      setLoading(true)
      setFailed(false)
      void searchRef
        .current(query.trim())
        .then((nextOptions) => {
          if (requestId.current !== currentRequestId) return
          setOptions(nextOptions)
        })
        .catch(() => {
          if (requestId.current !== currentRequestId) return
          setFailed(true)
        })
        .finally(() => {
          if (requestId.current === currentRequestId) setLoading(false)
        })
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [open, query])

  const selectedKey = (option: ResponsibleOption) => `${option.relationTo}:${option.id}`
  const selectedKeys = new Set(selected.map(selectedKey))
  const atCapacity = selected.length >= MAX_ACTIVITY_RESPONSIBLES

  const add = (option: ResponsibleOption) => {
    if (atCapacity) return
    setSelected((current) =>
      current.some((entry) => selectedKey(entry) === selectedKey(option))
        ? current
        : [...current, option],
    )
  }

  const remove = (option: ResponsibleOption) => {
    const key = selectedKey(option)
    setSelected((current) => current.filter((entry) => selectedKey(entry) !== key))
  }

  const visibleOptions = options.filter((option) => !selectedKeys.has(selectedKey(option)))
  const groups = visibleOptions.reduce<Record<string, ResponsibleOption[]>>((acc, option) => {
    const group = acc[option.typeLabel] ?? []
    group.push(option)
    acc[option.typeLabel] = group
    return acc
  }, {})

  const selectedLabel =
    selected.length === 0
      ? (emptyText ?? 'Nenhum')
      : `${selected.length} ${selected.length === 1 ? 'responsável' : 'responsáveis'}`

  return (
    <Field>
      <FieldLabel className={labelClassName}>{label}</FieldLabel>
      <input
        type="hidden"
        name={name}
        value={JSON.stringify(selected.map(({ relationTo, id }) => ({ relationTo, value: id })))}
      />
      {selected.length ? (
        <ul className="flex flex-wrap gap-1.5">
          {selected.map((option) => (
            <li key={selectedKey(option)}>
              <Badge variant="secondary" className="gap-1 pr-1">
                <span className="font-normal">{option.name}</span>
                <span className="text-muted-foreground">{option.typeLabel}</span>
                <button
                  type="button"
                  aria-label={`Remover ${option.name}`}
                  className="inline-flex size-6 items-center justify-center rounded-full hover:bg-foreground/10"
                  onClick={() => remove(option)}
                >
                  <XIcon className="size-3.5" aria-hidden="true" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <Button
        type="button"
        variant="outline"
        className={cn('min-h-11 w-full justify-between font-normal', triggerClassName)}
        aria-label={`${label}: ${selectedLabel}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        disabled={atCapacity}
        onClick={() => setOpen(true)}
      >
        <span className="truncate">
          {atCapacity ? 'Limite de responsáveis alcançado' : selectedLabel}
        </span>
        <ChevronsUpDownIcon aria-hidden="true" />
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={label}
        description="Busque por nome e escolha um ou mais responsáveis."
        showCloseButton
      >
        <Command shouldFilter={false} label={label}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar responsável"
            aria-label={label}
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
            ) : Object.keys(groups).length > 0 ? (
              Object.entries(groups).map(([typeLabel, groupOptions]) => (
                <CommandGroup key={typeLabel} heading={typeLabel}>
                  {groupOptions.map((option) => (
                    <CommandItem
                      key={selectedKey(option)}
                      value={`${option.typeLabel}-${option.id}`}
                      onSelect={() => add(option)}
                      disabled={atCapacity}
                    >
                      <span className="truncate">{option.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {!isContactSearchQueryReady(query)
                  ? 'Digite ao menos dois caracteres para buscar.'
                  : 'Nenhum resultado encontrado.'}
              </p>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      {error ? <FieldError id={`${name}-error`}>{error}</FieldError> : null}
    </Field>
  )
}
