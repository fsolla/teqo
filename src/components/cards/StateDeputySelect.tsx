'use client'

import { CheckIcon, ChevronDownIcon, SearchIcon } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'

import {
  filterStateDeputyCards,
  stateDeputyCatalog,
  type StateDeputyCatalogEntry,
} from '@/lib/stateDeputyCatalog'

/**
 * S30 — the state-deputy picker of the `time-do-estadual` composer, ported from
 * the design gate (scene 3): a full-width trigger that shows the chosen name +
 * number ("Trocar") or the placeholder, and an inline panel with search, hint,
 * scrollable listbox and whole-row selection with a visible check. Keyboard:
 * ↑ ↓ move the active option, Enter selects, Escape closes and returns focus to
 * the trigger. The panel opens by default while nothing is chosen (the gate's
 * initial state).
 *
 * Third inline-listbox copy in the repo (the campaign omnibox and the relation
 * chip cell came first) — the Base UI `Combobox` was rejected because the gate
 * is an inline panel, not a floating popup. Revisit trigger: a fourth consumer,
 * or an a11y fix landing in one of the three.
 */
export const StateDeputySelect = ({
  selected,
  onSelect,
}: {
  selected: StateDeputyCatalogEntry | null
  onSelect: (card: StateDeputyCatalogEntry) => void
}) => {
  const [open, setOpen] = useState(selected === null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const labelId = useId()
  const valueId = useId()
  const searchId = useId()
  const listboxId = `${searchId}-listbox`
  const optionId = (index: number) => `${searchId}-option-${index}`

  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  /** Only a user-initiated open focuses the search (the gate's default-open panel must not steal the dialog focus). */
  const focusSearchOnOpenRef = useRef(false)

  const results = filterStateDeputyCards(query)

  useEffect(() => {
    if (open && focusSearchOnOpenRef.current) {
      focusSearchOnOpenRef.current = false
      searchRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open || activeIndex < 0) return
    const option = listRef.current?.querySelector<HTMLElement>(
      `#${CSS.escape(`${searchId}-option-${activeIndex}`)}`,
    )
    option?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex, open, searchId])

  const close = (focusTrigger = false) => {
    setOpen(false)
    setQuery('')
    setActiveIndex(0)
    if (focusTrigger) triggerRef.current?.focus()
  }

  const choose = (card: StateDeputyCatalogEntry) => {
    onSelect(card)
    close(true)
  }

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(0, Math.min(index + 1, results.length - 1)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const card = results[activeIndex]
      if (card) choose(card)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      close(true)
    }
  }

  return (
    <div>
      <p id={labelId} className="mt-4 block text-sm font-bold text-(--campaign-ink)">
        Seu estadual
      </p>
      <button
        ref={triggerRef}
        type="button"
        aria-labelledby={`${labelId} ${valueId}`}
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => {
          if (open) {
            close()
            return
          }
          focusSearchOnOpenRef.current = true
          setOpen(true)
        }}
        className={`mt-2 flex min-h-11 w-full items-center rounded-lg border border-(--field-border) bg-white px-3 text-left text-sm focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:ring-offset-2 focus-visible:outline-none ${
          selected ? 'font-bold text-(--campaign-ink)' : 'text-(--campaign-muted)'
        }`}
      >
        <span id={valueId} className="min-w-0 truncate">
          {selected ? selected.name : 'Escolha um nome'}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1 pl-2 text-xs font-normal text-(--campaign-muted)">
          {selected ? `${selected.ballotNumber} · Trocar` : null}
          <ChevronDownIcon className="size-4" aria-hidden="true" />
        </span>
      </button>

      {open ? (
        <div className="mt-2 overflow-hidden rounded-xl border border-(--campaign-line) bg-white shadow-xl">
          <div className="border-b border-(--campaign-line) p-3">
            <div className="flex min-h-11 items-center gap-2 rounded-lg border border-(--field-border) px-3">
              <SearchIcon className="size-4 shrink-0 text-(--campaign-muted)" aria-hidden="true" />
              <label htmlFor={searchId} className="sr-only">
                Buscar estadual
              </label>
              <input
                ref={searchRef}
                id={searchId}
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-controls={listboxId}
                aria-autocomplete="list"
                aria-activedescendant={results[activeIndex] ? optionId(activeIndex) : undefined}
                value={query}
                autoComplete="off"
                placeholder="Buscar por nome"
                onChange={(event) => {
                  setQuery(event.target.value)
                  setActiveIndex(0)
                  listRef.current?.scrollTo({ top: 0 })
                }}
                onKeyDown={handleSearchKeyDown}
                className="min-w-0 flex-1 bg-transparent text-sm text-(--campaign-ink) outline-none placeholder:text-(--campaign-muted)"
              />
            </div>
            <p className="mt-2 text-[11px] text-(--campaign-muted)">
              {stateDeputyCatalog.length} estaduais · use ↑ ↓ e Enter para escolher
            </p>
          </div>

          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Estaduais da dobradinha"
            className={`max-h-52 overflow-y-auto overscroll-contain text-sm ${
              results.length === 0 ? 'p-0' : 'p-1.5'
            }`}
          >
            {results.map((card, index) => {
              const isSelected = selected?.slug === card.slug
              const isActive = index === activeIndex

              return (
                <button
                  key={card.slug}
                  id={optionId(index)}
                  type="button"
                  role="option"
                  tabIndex={-1}
                  aria-selected={isSelected}
                  onClick={() => choose(card)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex min-h-11 w-full items-center rounded-md px-3 text-left focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:outline-none ${
                    isSelected
                      ? 'bg-red-50 font-bold text-(--pt-red)'
                      : isActive
                        ? 'bg-stone-100 text-(--campaign-ink)'
                        : 'text-(--campaign-ink) hover:bg-stone-100'
                  }`}
                >
                  <span className="min-w-0 truncate">{card.name}</span>
                  {isSelected ? (
                    <span className="ml-auto flex shrink-0 items-center gap-1 pl-2 text-xs font-normal">
                      {card.ballotNumber}
                      <CheckIcon className="size-3.5" aria-hidden="true" />
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>

          {results.length === 0 ? (
            <p className="border-t border-(--campaign-line) px-3 py-2 text-sm text-(--campaign-muted)">
              Nenhum estadual encontrado.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
