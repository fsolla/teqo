'use client'

import { XIcon } from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

import { Button } from '@/components/ui/button'
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/Command'
import { Popover, PopoverContent, PopoverAnchor } from '@/components/ui/Popover'
import type {
  CampaignListOmniboxChip,
  CampaignListOmniboxSuggestion,
} from '@/lib/campaignListOmnibox'
import { cn } from '@/lib/utils'

export type CampaignListOmniboxProps = {
  id?: string
  label: string
  placeholder: string
  chips: readonly CampaignListOmniboxChip[]
  suggestions: readonly CampaignListOmniboxSuggestion[]
  query: string
  onQueryChange: (query: string) => void
  onSelectSuggestion: (suggestionId: string) => void
  onRemoveChip: (chipId: string) => void
  onClearAll?: () => void
  isPending?: boolean
  /** Domain controls beside the bar (e.g. save bookmark). */
  trailing?: ReactNode
}

/**
 * Shared list omnibox chassis (B127): chips inside the field, caret to the
 * right, grouped suggestions from the domain adapter. Navigation / URL policy
 * stay in the caller.
 */
export const CampaignListOmnibox = ({
  id: idProp,
  label,
  placeholder,
  chips,
  suggestions,
  query,
  onQueryChange,
  onSelectSuggestion,
  onRemoveChip,
  onClearAll,
  isPending = false,
  trailing,
}: CampaignListOmniboxProps) => {
  const reactId = useId()
  const id = idProp ?? `campaign-list-omnibox-${reactId}`
  const listboxId = `${id}-suggestions`
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [activeChipId, setActiveChipId] = useState<string | null>(null)

  const hasChips = chips.length > 0
  const showSuggestions = open && suggestions.length > 0

  useEffect(() => {
    if (!open) setActiveChipId(null)
  }, [open])

  const selectSuggestion = (suggestionId: string) => {
    onSelectSuggestion(suggestionId)
    onQueryChange('')
    setOpen(false)
    inputRef.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault()
        setOpen(false)
      }
      return
    }

    if (event.key === 'Backspace' && query.length === 0 && chips.length > 0) {
      event.preventDefault()
      if (activeChipId) {
        onRemoveChip(activeChipId)
        setActiveChipId(null)
        return
      }
      const last = chips[chips.length - 1]
      if (last) setActiveChipId(last.id)
      return
    }

    if (event.key === 'Enter') {
      const trimmed = query.trim()
      if (!trimmed) return
      event.preventDefault()
      // Prefer the explicit Busca suggestion when present; else first match.
      const searchSuggestion = suggestions.find((entry) => entry.id === `q:${trimmed}`)
      const first = searchSuggestion ?? suggestions[0]
      if (first) selectSuggestion(first.id)
    }
  }

  const groups = (() => {
    const map = new Map<string, CampaignListOmniboxSuggestion[]>()
    for (const suggestion of suggestions) {
      const bucket = map.get(suggestion.group) ?? []
      bucket.push(suggestion)
      map.set(suggestion.group, bucket)
    }
    return [...map.entries()]
  })()

  return (
    <div
      className="flex flex-col gap-3 transition-opacity data-[pending=true]:opacity-70 md:flex-row md:items-start"
      data-pending={isPending}
      aria-busy={isPending}
    >
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
          {label}
        </label>
        <Popover
          open={showSuggestions}
          onOpenChange={(next) => {
            if (!next) setOpen(false)
          }}
        >
          <PopoverAnchor asChild>
            <div
              className={cn(
                'flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2 py-1.5 shadow-xs',
                'focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50',
              )}
              onMouseDown={(event) => {
                // Keep focus on the input when clicking chips/padding.
                if (event.target === event.currentTarget) inputRef.current?.focus()
              }}
            >
              {chips.map((chip) => (
                <span
                  key={chip.id}
                  data-active={activeChipId === chip.id ? 'true' : undefined}
                  className={cn(
                    'inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium text-foreground',
                    'data-[active=true]:ring-2 data-[active=true]:ring-ring',
                  )}
                >
                  <span className="truncate">{chip.label}</span>
                  <button
                    type="button"
                    className="inline-flex size-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-background hover:text-foreground"
                    aria-label={`Remover ${chip.label}`}
                    onClick={() => {
                      onRemoveChip(chip.id)
                      setActiveChipId(null)
                      inputRef.current?.focus()
                    }}
                  >
                    <XIcon className="size-3.5" />
                  </button>
                </span>
              ))}
              <input
                ref={inputRef}
                id={id}
                role="combobox"
                aria-expanded={showSuggestions}
                aria-controls={listboxId}
                aria-autocomplete="list"
                autoComplete="off"
                spellCheck={false}
                placeholder={hasChips ? '' : placeholder}
                value={query}
                onChange={(event) => {
                  setActiveChipId(null)
                  onQueryChange(event.target.value)
                  setOpen(true)
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={onKeyDown}
                className="min-h-8 min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </PopoverAnchor>
          <PopoverContent
            id={listboxId}
            role="listbox"
            align="start"
            className="w-[var(--radix-popover-trigger-width)] min-w-[min(100%,24rem)] p-0"
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <Command shouldFilter={false} className="rounded-xl border-0">
              <CommandList>
                {groups.map(([group, items]) => (
                  <CommandGroup key={group} heading={group}>
                    {items.map((suggestion) => (
                      <CommandItem
                        key={suggestion.id}
                        value={suggestion.id}
                        onSelect={() => selectSuggestion(suggestion.id)}
                        className="min-h-11"
                      >
                        {suggestion.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 md:pt-7">
        {trailing}
        {onClearAll && hasChips ? (
          <Button type="button" variant="ghost" className="min-h-11 shrink-0" onClick={onClearAll}>
            Limpar
          </Button>
        ) : null}
      </div>
    </div>
  )
}
