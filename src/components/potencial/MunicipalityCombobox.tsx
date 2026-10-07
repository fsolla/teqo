'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'

import {
  filterPotentialMunicipalities,
  type PotentialMunicipalityOption,
  type PotentialUf,
} from '@/lib/sectionPotential'
import { cn } from '@/lib/utils'

import { normalizeSearchPhrase } from '@/lib/wordStartFilter'

import {
  POTENTIAL_FIELD_INPUT,
  POTENTIAL_FIELD_LABEL,
  POTENTIAL_FOCUS,
  POTENTIAL_NOTE,
} from './sectionPotentialClasses'
import {
  POTENTIAL_MUNICIPALITY_EMPTY,
  POTENTIAL_MUNICIPALITY_ERROR,
  POTENTIAL_MUNICIPALITY_HELP,
  POTENTIAL_MUNICIPALITY_PICK,
} from './sectionPotentialCopy'

type MunicipalityComboboxProps = {
  uf: PotentialUf
  value: string
  onValueChange: (value: string) => void
  onSelect: (municipality: PotentialMunicipalityOption) => void
}

/**
 * S46 — o campo Município (design, detalhe do combobox): busca por nome a
 * partir de 3 letras, accent-insensitive, só municípios da UF escolhida; sem
 * texto livre — a consulta exige uma opção conhecida (o `code` TSE).
 */
export const MunicipalityCombobox = ({
  uf,
  value,
  onValueChange,
  onSelect,
}: MunicipalityComboboxProps) => {
  const listId = useId()
  const cache = useRef(new Map<string, PotentialMunicipalityOption[]>())
  const [items, setItems] = useState<PotentialMunicipalityOption[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    let alive = true
    const cached = cache.current.get(uf)
    if (cached) {
      setItems(cached)
      setLoadState('ready')
      return
    }
    setLoadState('loading')
    fetch(`/api/potencial/municipios?uf=${uf}`, { headers: { accept: 'application/json' } })
      .then((response) => {
        if (!response.ok) throw new Error(`municipios:${response.status}`)
        return response.json() as Promise<{
          ok: boolean
          municipalities?: PotentialMunicipalityOption[]
        }>
      })
      .then((body) => {
        if (!alive) return
        if (!body.ok || !body.municipalities) throw new Error('municipios:body')
        cache.current.set(uf, body.municipalities)
        setItems(body.municipalities)
        setLoadState('ready')
      })
      .catch(() => {
        if (alive) setLoadState('error')
      })
    return () => {
      alive = false
    }
  }, [uf])

  const matches = useMemo(() => filterPotentialMunicipalities(items, value), [items, value])
  const showList = open && loadState === 'ready' && value.trim().length >= 3
  // Nome exato de um município carregado = seleção válida; a ajuda some (o
  // "Escolha um município da lista." contradizia o campo preenchido).
  const selectedExact =
    value.trim().length >= 3 &&
    items.some(
      (municipality) => normalizeSearchPhrase(municipality.name) === normalizeSearchPhrase(value),
    )

  useEffect(() => {
    setActiveIndex(0)
  }, [value, uf])

  const select = (municipality: PotentialMunicipalityOption) => {
    onSelect(municipality)
    setOpen(false)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList || matches.length === 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => Math.min(index + 1, matches.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      select(matches[activeIndex])
    } else if (event.key === 'Escape') {
      setOpen(false)
    }
  }

  const helper =
    loadState === 'error'
      ? POTENTIAL_MUNICIPALITY_ERROR
      : selectedExact
        ? null
        : value.trim().length < 3
          ? POTENTIAL_MUNICIPALITY_HELP
          : showList && matches.length === 0
            ? POTENTIAL_MUNICIPALITY_EMPTY
            : POTENTIAL_MUNICIPALITY_PICK

  return (
    <div className="relative">
      <label className={POTENTIAL_FIELD_LABEL} htmlFor={`${listId}-input`}>
        Município
      </label>
      <div className={POTENTIAL_FIELD_INPUT}>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="shrink-0 text-(--campaign-muted)"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          id={`${listId}-input`}
          type="text"
          role="combobox"
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={
            showList && matches[activeIndex] ? `${listId}-${matches[activeIndex].code}` : undefined
          }
          aria-describedby={`${listId}-help`}
          value={value}
          onChange={(event) => {
            onValueChange(event.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKeyDown}
          className={cn('w-full min-w-0 bg-transparent text-base', POTENTIAL_FOCUS)}
        />
      </div>
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Municípios"
          className="absolute z-20 mt-1.5 max-h-64 w-full list-none overflow-auto rounded-xl border border-(--campaign-line) bg-white p-0 shadow-[0_12px_32px_rgb(0_0_0/12%)]"
          // Mantém o foco no input enquanto o clique seleciona a opção.
          onMouseDown={(event) => event.preventDefault()}
        >
          {matches.map((municipality, index) => (
            <li
              key={municipality.code}
              id={`${listId}-${municipality.code}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => select(municipality)}
              className={cn(
                'cursor-pointer px-3 py-2.5 text-sm',
                index === activeIndex ? 'bg-(--campaign-cream) font-bold text-(--pt-red)' : '',
              )}
            >
              {municipality.name}
            </li>
          ))}
        </ul>
      ) : null}
      {helper ? (
        <p
          id={`${listId}-help`}
          className={cn(POTENTIAL_NOTE, 'mt-1.5', loadState === 'error' && 'text-(--destructive)')}
        >
          {helper}
        </p>
      ) : null}
    </div>
  )
}
