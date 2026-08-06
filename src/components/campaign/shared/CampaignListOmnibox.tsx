'use client'

import { XIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/Popover'
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
  /** Free-text commit (Enter with no arrow selection / default). Domain owns id scheme. */
  onCommitQuery?: (query: string) => void
  onClearAll?: () => void
  isPending?: boolean
  /**
   * B161 — the filtered universe count, discreetly beside the label. Server
   * data: it refreshes with the RSC re-render a filter navigation triggers,
   * dimming with the rest of the controls while pending.
   */
  totalDocs?: number
  /** Domain controls beside the bar (e.g. save bookmark). */
  trailing?: ReactNode
}

/**
 * Shared list omnibox chassis (B127): chips inside the field, caret to the
 * right, grouped suggestions from the domain adapter. Navigation / URL policy
 * stay in the caller.
 *
 * Keyboard contract mirrors RelationChipCell (ARIA combobox by hand): arrows
 * move the active option, Enter picks it, Escape closes. cmdk is not used —
 * its Root expects an inner CommandInput and would leave this field mouse-only.
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
  onCommitQuery,
  onClearAll,
  isPending = false,
  totalDocs,
  trailing,
}: CampaignListOmniboxProps) => {
  const reactId = useId()
  const id = idProp ?? `campaign-list-omnibox-${reactId}`
  const listboxId = `${id}-suggestions`
  const optionId = (index: number) => `${id}-option-${index}`
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [activeChipId, setActiveChipId] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const hasChips = chips.length > 0
  const showSuggestions = open && suggestions.length > 0
  const safeActiveIndex =
    suggestions.length === 0 ? 0 : Math.min(activeIndex, suggestions.length - 1)
  const activeOptionId = showSuggestions ? optionId(safeActiveIndex) : undefined

  useEffect(() => {
    if (!open) setActiveChipId(null)
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const selectSuggestion = (suggestionId: string) => {
    onSelectSuggestion(suggestionId)
    onQueryChange('')
    setOpen(false)
    setActiveIndex(0)
    inputRef.current?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (suggestions.length === 0) return
      event.preventDefault()
      setOpen(true)
      const delta = event.key === 'ArrowDown' ? 1 : -1
      setActiveIndex((current) => (current + delta + suggestions.length) % suggestions.length)
      return
    }

    if (event.key === 'Home' || event.key === 'End') {
      if (suggestions.length === 0) return
      event.preventDefault()
      setOpen(true)
      setActiveIndex(event.key === 'Home' ? 0 : suggestions.length - 1)
      return
    }

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
      if (showSuggestions && suggestions[safeActiveIndex]) {
        event.preventDefault()
        selectSuggestion(suggestions[safeActiveIndex]!.id)
        return
      }
      if (trimmed && onCommitQuery) {
        event.preventDefault()
        onCommitQuery(trimmed)
        onQueryChange('')
        setOpen(false)
      }
    }
  }

  const groups = (() => {
    const map = new Map<string, { suggestion: CampaignListOmniboxSuggestion; index: number }[]>()
    suggestions.forEach((suggestion, index) => {
      const bucket = map.get(suggestion.group) ?? []
      bucket.push({ suggestion, index })
      map.set(suggestion.group, bucket)
    })
    return [...map.entries()]
  })()

  const activeChipLabel = activeChipId
    ? chips.find((chip) => chip.id === activeChipId)?.label
    : null

  return (
    <div
      className="flex flex-col gap-3 transition-opacity data-[pending=true]:opacity-70 md:flex-row md:items-start"
      data-pending={isPending}
      aria-busy={isPending}
    >
      <div className="min-w-0 flex-1">
        <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
          {label}
          {totalDocs !== undefined ? (
            <span className="ml-1.5 font-normal text-muted-foreground">· {totalDocs}</span>
          ) : null}
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
                    <XIcon className="size-3.5" aria-hidden />
                  </button>
                </span>
              ))}
              <input
                ref={inputRef}
                id={id}
                role="combobox"
                aria-expanded={showSuggestions}
                aria-controls={showSuggestions ? listboxId : undefined}
                aria-activedescendant={activeOptionId}
                aria-autocomplete="list"
                aria-haspopup="listbox"
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
            align="start"
            className="w-[var(--radix-popover-trigger-width)] min-w-[min(100%,24rem)] p-1"
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
          >
            <div
              id={listboxId}
              role="listbox"
              aria-label={label}
              className="max-h-72 overflow-y-auto"
            >
              {groups.map(([group, items]) => (
                <div key={group} role="group" aria-label={group} className="py-1">
                  <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{group}</p>
                  {items.map(({ suggestion, index }) => {
                    const active = index === safeActiveIndex
                    return (
                      <button
                        key={suggestion.id}
                        type="button"
                        id={optionId(index)}
                        role="option"
                        aria-selected={active}
                        className={cn(
                          'flex min-h-11 w-full items-center rounded-sm px-2 py-1.5 text-left text-sm outline-hidden',
                          active ? 'bg-muted text-foreground' : 'text-foreground hover:bg-muted/70',
                        )}
                        onMouseEnter={() => setActiveIndex(index)}
                        onClick={() => selectSuggestion(suggestion.id)}
                      >
                        {suggestion.label}
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
        {activeChipLabel ? (
          <p className="sr-only" aria-live="polite">
            {activeChipLabel} selecionado. Backspace remove.
          </p>
        ) : null}
        {isPending ? (
          <p className="sr-only" aria-live="polite">
            Atualizando resultados…
          </p>
        ) : null}
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
