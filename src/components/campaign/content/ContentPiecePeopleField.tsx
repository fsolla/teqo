'use client'

import { XIcon } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/Command'
import { Spinner } from '@/components/ui/Spinner'
import { useAsyncSearchOptions } from '@/hooks/useAsyncSearchOptions'
import { isContactSearchQueryReady } from '@/lib/contactSearchQuery'
import { CONTENT_PIECE_LEADERS_MAX, CONTENT_PIECE_PUBLIC_FIGURES_MAX } from '@/lib/contentPiece'
import { filterPublicFigures } from '@/lib/publicFigureCatalog'
import { normalizeForSearch } from '@/lib/speechSearch'
import type { ContentPieceLeaderOption } from '@/utilities/content/contentPieceLeaderOptions'

/** One removable chip of the two recortes (design scenes 01/02). */
const PeopleChip = ({ label, onRemove }: { label: string; onRemove: () => void }) => (
  <Badge variant="secondary" className="gap-1 pr-1 font-normal">
    <span className="max-w-full truncate">{label}</span>
    <button
      type="button"
      className="relative inline-flex size-5 items-center justify-center after:absolute after:-inset-x-1 after:-inset-y-3"
      aria-label={`Remover ${label}`}
      onClick={onRemove}
    >
      <XIcon className="size-3 opacity-70" aria-hidden="true" />
    </button>
  </Badge>
)

/**
 * S37 — "Quem aparece na peça" (approved design scenes 01/01A/02): the two
 * curated recortes inside the C211 ficha. The leader picker searches the
 * existing records through a gated server action (async, 2+ chars, only the
 * display name); the public-figure picker filters the static catalog and
 * accepts free text ("Usar «…»"). Both keep removable chips and repeated hidden
 * inputs — the ficha nests no person record, only display names.
 */
export const ContentPiecePeopleField = ({
  leaders,
  publicFigures,
  searchLeaders,
}: {
  leaders: readonly ContentPieceLeaderOption[]
  publicFigures: readonly string[]
  searchLeaders: (query: string) => Promise<ContentPieceLeaderOption[]>
}) => {
  const [selectedLeaders, setSelectedLeaders] = useState<ContentPieceLeaderOption[]>([...leaders])
  const [selectedFigures, setSelectedFigures] = useState<string[]>([...publicFigures])
  const [leaderQuery, setLeaderQuery] = useState('')
  const [figureQuery, setFigureQuery] = useState('')

  const {
    options: leaderResults,
    loading: leadersLoading,
    failed: leadersFailed,
  } = useAsyncSearchOptions<ContentPieceLeaderOption>({
    open: true,
    query: leaderQuery,
    search: searchLeaders,
    isQueryReady: isContactSearchQueryReady,
  })

  const selectedLeaderIds = new Set(selectedLeaders.map((leader) => leader.id))
  const selectedFigureKeys = new Set(selectedFigures.map(normalizeForSearch))
  const atLeaderCapacity = selectedLeaders.length >= CONTENT_PIECE_LEADERS_MAX
  const atFigureCapacity = selectedFigures.length >= CONTENT_PIECE_PUBLIC_FIGURES_MAX

  const toggleLeader = (option: ContentPieceLeaderOption) => {
    setSelectedLeaders((current) => {
      if (current.some((leader) => leader.id === option.id)) {
        return current.filter((leader) => leader.id !== option.id)
      }
      return atLeaderCapacity ? current : [...current, option]
    })
  }

  const toggleFigure = (name: string) => {
    const trimmed = name.trim()
    const key = normalizeForSearch(trimmed)
    if (!key) return

    setSelectedFigures((current) => {
      if (current.some((figure) => normalizeForSearch(figure) === key)) {
        return current.filter((figure) => normalizeForSearch(figure) !== key)
      }
      return atFigureCapacity ? current : [...current, trimmed]
    })
  }

  const figureResults = filterPublicFigures(figureQuery)
  const figureText = figureQuery.trim()
  const canUseFigureText =
    figureText !== '' &&
    !selectedFigureKeys.has(normalizeForSearch(figureText)) &&
    !atFigureCapacity
  const nothingMarked = selectedLeaders.length === 0 && selectedFigures.length === 0

  return (
    <fieldset className="flex flex-col gap-4 rounded-xl border border-black/12 p-5 sm:col-span-2">
      <legend className="sr-only">Quem aparece na peça</legend>
      <div className="flex items-start justify-between gap-6">
        <div>
          <h3 className="text-base font-semibold">Quem aparece na peça</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Marque somente pessoas visíveis ou participantes desta peça. A publicação expõe apenas o
            nome.
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#fff5ed] px-2 py-1 text-[11px] font-semibold text-[#6b2d15]">
          Curadoria humana
        </span>
      </div>

      {selectedLeaders.map((leader) => (
        <input key={leader.id} type="hidden" name="leaderIds" value={leader.id} />
      ))}
      {selectedFigures.map((figure) => (
        <input key={figure} type="hidden" name="publicFigures" value={figure} />
      ))}

      {nothingMarked ? (
        <p className="rounded-lg bg-muted p-3 text-xs leading-5 text-muted-foreground">
          Ninguém marcado. A peça pode ser publicada normalmente e não cria nenhum nome na faceta
          “Lideranças”.
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <p className="text-[13px] font-semibold">Lideranças da campanha</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Busca nos registros existentes. Nenhum telefone, município ou voto vai para a Central
            pública.
          </p>
          {selectedLeaders.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedLeaders.map((leader) => (
                <PeopleChip
                  key={leader.id}
                  label={leader.label}
                  onRemove={() => toggleLeader(leader)}
                />
              ))}
            </div>
          ) : null}
          <Command
            shouldFilter={false}
            className="mt-2 overflow-hidden rounded-xl border bg-white p-1 shadow-lg"
          >
            <CommandInput
              value={leaderQuery}
              onValueChange={setLeaderQuery}
              placeholder="Buscar liderança…"
              aria-label="Buscar liderança"
            />
            <CommandList aria-busy={leadersLoading}>
              {leadersLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                  <Spinner aria-hidden="true" />
                  Buscando…
                </div>
              ) : leadersFailed ? (
                <p className="py-6 text-center text-sm text-destructive">
                  Não foi possível concluir a busca.
                </p>
              ) : leaderResults.length > 0 ? (
                leaderResults.map((option) => {
                  const selected = selectedLeaderIds.has(option.id)
                  return (
                    <CommandItem
                      key={option.id}
                      value={String(option.id)}
                      data-checked={selected}
                      disabled={atLeaderCapacity && !selected}
                      onSelect={() => toggleLeader(option)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{option.label}</span>
                        <span className="block text-xs font-normal text-muted-foreground">
                          Registro da campanha
                        </span>
                      </span>
                    </CommandItem>
                  )
                })
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {!isContactSearchQueryReady(leaderQuery)
                    ? 'Digite ao menos dois caracteres para buscar.'
                    : 'Nenhum resultado encontrado.'}
                </p>
              )}
            </CommandList>
          </Command>
        </div>

        <div>
          <p className="text-[13px] font-semibold">Figuras públicas</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Texto curado com catálogo, no mesmo molde de Instituição.
          </p>
          {selectedFigures.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedFigures.map((figure) => (
                <PeopleChip key={figure} label={figure} onRemove={() => toggleFigure(figure)} />
              ))}
            </div>
          ) : null}
          <Command
            shouldFilter={false}
            className="mt-2 overflow-hidden rounded-xl border bg-white p-1 shadow-lg"
          >
            <CommandInput
              value={figureQuery}
              onValueChange={setFigureQuery}
              placeholder="Digite ou escolha uma figura pública…"
              aria-label="Buscar ou digitar uma figura pública"
            />
            <CommandList>
              {figureResults.map((entry) => {
                const selected = selectedFigureKeys.has(normalizeForSearch(entry.name))
                return (
                  <CommandItem
                    key={entry.slug}
                    value={entry.slug}
                    data-checked={selected}
                    disabled={atFigureCapacity && !selected}
                    onSelect={() => toggleFigure(entry.name)}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{entry.name}</span>
                      <span className="block text-xs font-normal text-muted-foreground">
                        Figura pública catalogada
                      </span>
                    </span>
                  </CommandItem>
                )
              })}
              {canUseFigureText ? (
                <CommandItem
                  value={`usar-${figureText}`}
                  className="font-medium text-primary"
                  onSelect={() => {
                    toggleFigure(figureText)
                    setFigureQuery('')
                  }}
                >
                  Usar «{figureText}»
                </CommandItem>
              ) : null}
              {figureResults.length === 0 && !canUseFigureText ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Nenhum resultado encontrado.
                </p>
              ) : null}
            </CommandList>
          </Command>
        </div>
      </div>
    </fieldset>
  )
}
