'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronsUpDownIcon } from 'lucide-react'

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
import type {
  NucleusPrimaryContactPageData,
  PrimaryContactOption,
} from '@/utilities/primaryContactPageData'

type PrimaryContactComboboxProps = {
  name: string
  current: PrimaryContactOption | null
  search: (query: string) => Promise<NucleusPrimaryContactPageData>
}

const contactLabel = (contact: PrimaryContactOption | null) =>
  contact ? `${contact.name} · ${contact.phone}` : 'Sem contato principal'

export const PrimaryContactCombobox = ({
  name,
  current,
  search,
}: PrimaryContactComboboxProps) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<PrimaryContactOption | null>(current)
  const [result, setResult] = useState<NucleusPrimaryContactPageData>({
    current,
    options: [],
  })
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const requestId = useRef(0)

  useEffect(() => {
    if (!open) return

    const currentRequestId = ++requestId.current
    const timeout = window.setTimeout(() => {
      setLoading(true)
      setFailed(false)
      void search(query)
        .then((nextResult) => {
          if (requestId.current !== currentRequestId) return
          setResult({
            current: nextResult.current,
            options: nextResult.options.slice(0, nextResult.current ? 99 : 100),
          })
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
  }, [open, query, search])

  const choose = (contact: PrimaryContactOption | null) => {
    setSelected(contact)
    setOpen(false)
    setQuery('')
  }

  return (
    <>
      <input type="hidden" name={name} value={selected?.id ?? ''} />
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full justify-between font-normal"
        aria-label={`Contato principal: ${selected?.name ?? 'nenhum'}`}
        onClick={() => setOpen(true)}
      >
        <span className="truncate">{contactLabel(selected)}</span>
        <ChevronsUpDownIcon aria-hidden="true" />
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Selecionar contato principal"
        description="Busque entre as lideranças engajadas deste núcleo."
        showCloseButton
      >
        <Command shouldFilter={false} label="Buscar liderança por nome ou celular">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar por nome ou celular"
            aria-label="Buscar liderança por nome ou celular"
          />
          <CommandList aria-busy={loading}>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Spinner aria-hidden="true" />
                Buscando…
              </div>
            ) : failed ? (
              <p className="py-6 text-center text-sm text-destructive">
                Não foi possível buscar as lideranças.
              </p>
            ) : (
              <>
                <CommandGroup heading="Seleção">
                  <CommandItem value="none" onSelect={() => choose(null)}>
                    Sem contato principal
                  </CommandItem>
                </CommandGroup>
                {result.current ? (
                  <CommandGroup heading="Contato atual">
                    <CommandItem
                      value={`current-${result.current.id}`}
                      data-checked={selected?.id === result.current.id}
                      onSelect={() => choose(result.current)}
                    >
                      <span className="truncate">{contactLabel(result.current)}</span>
                    </CommandItem>
                  </CommandGroup>
                ) : null}
                {result.options.length ? (
                  <CommandGroup heading="Lideranças engajadas">
                    {result.options.map((contact) => (
                      <CommandItem
                        key={contact.id}
                        value={`contact-${contact.id}`}
                        data-checked={selected?.id === contact.id}
                        onSelect={() => choose(contact)}
                      >
                        <span className="truncate">{contactLabel(contact)}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Nenhuma liderança encontrada.
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
