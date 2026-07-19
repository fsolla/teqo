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
import { isContactSearchQueryReady } from '@/lib/contactSearchQuery'

export type ContactComboboxOption = {
  id: number
  name: string
  phone: string
}

type ContactComboboxProps = {
  name?: string
  label: string
  current: ContactComboboxOption | null
  search: (query: string) => Promise<ContactComboboxOption[]>
  emptyOptionLabel?: string
  onChange?: (contact: ContactComboboxOption | null) => void
}

const contactLabel = (contact: ContactComboboxOption | null, emptyLabel: string): string =>
  contact ? `${contact.name} · ${contact.phone}` : emptyLabel

export const ContactCombobox = ({
  name,
  label,
  current,
  search,
  emptyOptionLabel = 'Nenhum responsável',
  onChange,
}: ContactComboboxProps) => {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<ContactComboboxOption | null>(current)
  const [options, setOptions] = useState<ContactComboboxOption[]>([])
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const requestId = useRef(0)

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
      void search(query.trim())
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
  }, [open, query, search])

  const choose = (contact: ContactComboboxOption | null) => {
    setSelected(contact)
    setOpen(false)
    setQuery('')
    onChange?.(contact)
  }

  const visibleOptions = options.filter((option) => option.id !== selected?.id)

  return (
    <>
      {name ? <input type="hidden" name={name} value={selected?.id ?? ''} /> : null}
      <Button
        type="button"
        variant="outline"
        className="min-h-11 w-full justify-between font-normal"
        aria-label={`${label}: ${contactLabel(selected, emptyOptionLabel)}`}
        onClick={() => setOpen(true)}
      >
        <span className="truncate">{contactLabel(selected, emptyOptionLabel)}</span>
        <ChevronsUpDownIcon aria-hidden="true" />
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title={label}
        description="Busque por nome ou celular."
        showCloseButton
      >
        <Command shouldFilter={false} label="Buscar contato por nome ou celular">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar por nome ou celular"
            aria-label="Buscar contato por nome ou celular"
          />
          <CommandList aria-busy={loading}>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Spinner aria-hidden="true" />
                Buscando…
              </div>
            ) : failed ? (
              <p className="py-6 text-center text-sm text-destructive">
                Não foi possível buscar contatos.
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
                      <span className="truncate">{contactLabel(selected, emptyOptionLabel)}</span>
                    </CommandItem>
                  </CommandGroup>
                ) : null}
                {visibleOptions.length ? (
                  <CommandGroup heading="Contatos">
                    {visibleOptions.map((contact) => (
                      <CommandItem
                        key={contact.id}
                        value={`contact-${contact.id}`}
                        onSelect={() => choose(contact)}
                      >
                        <span className="truncate">{contactLabel(contact, emptyOptionLabel)}</span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ) : (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {!isContactSearchQueryReady(query)
                      ? 'Digite ao menos dois caracteres para buscar.'
                      : 'Nenhum contato encontrado.'}
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
