'use client'

import { ChevronsUpDownIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

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

export type AsyncSearchOption = {
  id: number
  label: string
}

type AsyncSearchComboboxProps = {
  name?: string
  label: string
  value: AsyncSearchOption | null
  onChange?: (option: AsyncSearchOption | null) => void
  search: (query: string) => Promise<AsyncSearchOption[]>
  emptyOptionLabel?: string
  dialogDescription?: string
  isQueryReady?: (query: string) => boolean
  queryTooShortMessage?: string
  pinnedOptions?: AsyncSearchOption[]
  pinnedGroupHeading?: string
}

export const AsyncSearchCombobox = ({
  name,
  label,
  value,
  onChange,
  search,
  emptyOptionLabel = 'Nenhum',
  dialogDescription = 'Digite para buscar.',
  isQueryReady = () => true,
  queryTooShortMessage = 'Digite para buscar.',
  pinnedOptions = [],
  pinnedGroupHeading = 'Sugestões',
}: AsyncSearchComboboxProps) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<AsyncSearchOption | null>(value)
  const { options, loading, failed } = useAsyncSearchOptions({ open, query, search, isQueryReady })

  useEffect(() => {
    setSelected(value)
  }, [value])

  const choose = (option: AsyncSearchOption | null) => {
    setSelected(option)
    setOpen(false)
    setQuery('')
    onChange?.(option)
  }

  const visibleOptions = options.filter((option) => option.id !== selected?.id)
  const visiblePinned = pinnedOptions.filter((option) => option.id !== selected?.id)

  return (
    <>
      {name ? <input type="hidden" name={name} value={selected?.id ?? ''} /> : null}
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full justify-between font-normal"
        aria-label={`${label}: ${selected?.label ?? emptyOptionLabel}`}
        onClick={() => setOpen(true)}
      >
        <span className="truncate">{selected?.label ?? emptyOptionLabel}</span>
        <ChevronsUpDownIcon aria-hidden="true" />
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={label}
        description={dialogDescription}
        showCloseButton
      >
        <Command shouldFilter={false} label={label}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar"
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
            ) : (
              <>
                <CommandGroup heading="Seleção">
                  <CommandItem value="none" onSelect={() => choose(null)}>
                    {emptyOptionLabel}
                  </CommandItem>
                </CommandGroup>
                {selected ? (
                  <CommandGroup heading="Selecionado">
                    <CommandItem
                      value={`current-${selected.id}`}
                      data-checked
                      onSelect={() => choose(selected)}
                    >
                      <span className="truncate">{selected.label}</span>
                    </CommandItem>
                  </CommandGroup>
                ) : null}
                {visiblePinned.length ? (
                  <CommandGroup heading={pinnedGroupHeading}>
                    {visiblePinned.map((option) => (
                      <CommandItem
                        key={option.id}
                        value={`pinned-${option.id}`}
                        onSelect={() => choose(option)}
                      >
                        <span className="truncate">{option.label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : null}
                {visibleOptions.length ? (
                  <CommandGroup heading="Resultados">
                    {visibleOptions.map((option) => (
                      <CommandItem
                        key={option.id}
                        value={`option-${option.id}`}
                        onSelect={() => choose(option)}
                      >
                        <span className="truncate">{option.label}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {!isQueryReady(query) ? queryTooShortMessage : 'Nenhum resultado encontrado.'}
                  </p>
                )}
              </>
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  )
}
