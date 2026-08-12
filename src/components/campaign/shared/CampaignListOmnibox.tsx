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
  /** Domain controls beside the bar (e.g. save bookmark). */
  trailing?: ReactNode
}

/**
 * B184 — the mobile sticky bar. Applied by every list to its own `<form
 * role="search">`: below `md` the filter region is a borderless bar glued to
 * the app top bar (the scrollport is `CampaignContentScroll`, whose sibling
 * the top bar is), with a separating line and an edge-to-edge bleed past the
 * scrollport's mobile `p-4`. `md:` restores the framed static desktop look.
 *
 * Sticky lives on the FORM on purpose: a sticky element can never escape its
 * containing block (its parent), and the form is the only wrapper whose parent
 * is the full-height `CampaignPageShell` — a sticky input column inside the
 * short omnibox row would only "stick" for its own height and then scroll away.
 *
 * `campaign-list-omnibox-form` is the stable marker `CampaignContentScroll`
 * matches (`:has()`) to drop its mobile top padding — only a page hosting the
 * list bar loses the `p-4` top gap, so the sticky's containing block starts at
 * the scrollport top and the bar glues to the header (B196). Without it the
 * sticky clamps 16px below the header and cards roll visibly through the gap.
 */
export const campaignListOmniboxFormClassName =
  'campaign-list-omnibox-form sticky top-0 z-20 -mx-4 border-b border-border bg-background px-4 pt-1 pb-0 ' +
  // B200 — below `md` the form is a direct child of the shell column
  // (`gap-8`), which is what left a 32px vão between the bar and the first
  // card; the negative bottom margin cancels that one gap so the first card
  // starts glued to the bar, while every other shell section keeps its rhythm.
  'max-md:-mb-8 ' +
  'md:static md:z-auto md:mx-0 md:border-b-0 md:bg-transparent md:px-0 md:py-0 md:mb-0'

/**
 * Shared list omnibox chassis (B127): chips inside the field, caret to the
 * right, grouped suggestions from the domain adapter. Navigation / URL policy
 * stay in the caller.
 *
 * Mobile standard (B184, 2026-08-09): below `md` the field is borderless,
 * sticky under the app top bar with a separating line, the label hides (the
 * input carries it as `aria-label`), the text "Limpar" is replaced by a
 * circular X inside the field, and the trailing cluster — empty below `md`
 * (every list gates its mobile-visible trailing elsewhere, e.g. header
 * actions) — stays out of the sticky region. Desktop keeps the framed look
 * unchanged via `md:` variants.
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
  /** B184 — increments on every clear so the live region re-announces. */
  const [clearAnnounceCount, setClearAnnounceCount] = useState(0)

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
      {/* The sticky bar lives on the caller's `<form>` (campaignListOmniboxFormClassName). */}
      <div className="min-w-0 flex-1">
        <label
          htmlFor={id}
          className="mb-1.5 block text-sm font-medium text-foreground hidden md:block"
        >
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
                // B184/B196/B200: below `md` the field is a borderless dense
                // bar (min-h-10, no inner vertical padding → bar ≈ 45px total)
                // with NO focus ring — the caret is the focus indicator; the
                // `md:` variants restore the framed desktop field with its
                // ring/colored border as the focus affordance.
                'flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-lg border-0 bg-transparent px-2 py-0 shadow-none',
                'md:min-h-11 md:border md:border-input md:py-1.5 md:shadow-xs',
                'md:focus-within:border-ring md:focus-within:ring-3 md:focus-within:ring-ring/50',
              )}
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                  inputRef.current?.focus()
                  setOpen(true)
                }
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
                // B184: below `md` the visual label is hidden; the accessible
                // name must not ride on it, so the input carries it directly
                // (identical to the label's own text on every viewport).
                aria-label={label}
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
                // C125 — a click on an already-focused input (e.g. right after
                // committing a search with Enter) fires no focus event, which
                // left the popover closed on mobile until a keystroke: the
                // mousedown always fires, so this is the reliable reopen path.
                onMouseDown={() => setOpen(true)}
                onKeyDown={onKeyDown}
                className="min-h-10 min-w-[8rem] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              {onClearAll ? (
                // B184: the mobile replacement for the text "Limpar" — a
                // circular X at the field's right edge. Rendered whenever the
                // caller clears, so the field's width never jumps at the
                // empty↔typed boundary; `invisible` keeps it out of the a11y
                // tree and the pointer until there is something to clear
                // (chips OR a typed search).
                <button
                  type="button"
                  aria-label="Limpar"
                  className={cn(
                    // B196/B200 — size-9 with the taller field keeps the bar
                    // at ~45px total; the field itself is the real touch
                    // target (the X lives inside it).
                    'inline-flex size-9 shrink-0 items-center justify-center rounded-full',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    'md:hidden',
                    !(hasChips || query.length > 0) && 'invisible pointer-events-none',
                  )}
                  onClick={() => {
                    onClearAll()
                    setActiveChipId(null)
                    setClearAnnounceCount((count) => count + 1)
                    // Refocus the field so the next keystroke keeps typing —
                    // then close the popover: the focus event itself reopens
                    // it, and a stale suggestion list over the results is
                    // worse than an empty field (measured intercepting clicks
                    // in the agenda e2e).
                    inputRef.current?.focus()
                    setOpen(false)
                  }}
                >
                  <span className="flex size-6 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-muted-foreground/20 hover:text-foreground">
                    <XIcon className="size-3.5" aria-hidden />
                  </span>
                </button>
              ) : null}
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
        {clearAnnounceCount > 0 ? (
          // B184 — clearing only a typed search never navigates (the URL is
          // already bare), so the pending region above stays silent; the keyed
          // remount re-announces the clear for screen readers.
          <p key={clearAnnounceCount} className="sr-only" aria-live="polite">
            Busca e filtros limpos.
          </p>
        ) : null}
      </div>

      {/* C100 — the trailing cluster is desktop-only: below `md` the page
          registers its own header controls, so the cluster never joins the
          mobile sticky bar (an empty container would also inflate its height
          — B200 keeps the bar ≈ 45px). */}
      <div className="hidden shrink-0 flex-wrap items-center gap-2 md:flex md:pt-7">
        {trailing}
        {onClearAll && hasChips ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 hidden shrink-0 md:inline-flex"
            onClick={onClearAll}
          >
            Limpar
          </Button>
        ) : null}
      </div>
    </div>
  )
}
