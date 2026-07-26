'use client'

import { XIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { MunicipalityListAdvisorsResponse } from '@/app/(campaign)/campanha/(app)/municipios/advisors/types'
import {
  formatAdvisorNamesTooltip,
  MunicipalityAdvisorAvatarStack,
} from '@/components/campaign/municipality/MunicipalityAdvisorAvatarStack'
import { CampaignHoverTooltip } from '@/components/campaign/shared/CampaignHoverTooltip'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/Command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'
import { matchesAtWordStart } from '@/lib/wordStartFilter'
import type {
  EligibleAdvisorOption,
  MunicipalityAdvisorSummary,
} from '@/utilities/municipalityViewModels'

const ADVISORS_ENDPOINT = '/campanha/municipios/advisors'
const SAVE_ERROR_MESSAGE = 'Não foi possível atualizar os assessores. Tente novamente.'

const sameIdSet = (left: readonly number[], right: readonly number[]): boolean => {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((id) => rightSet.has(id))
}

type MunicipalityListAdvisorsControlProps = {
  municipalityID: number
  currentAdvisorIDs: number[]
  /** Raises the empty state to "Sem responsável" — see `MissingAdvisorBadge`. */
  isPriority: boolean
  advisorNamesById: ReadonlyMap<number, MunicipalityAdvisorSummary>
  options: EligibleAdvisorOption[]
}

export const MunicipalityListAdvisorsControl = ({
  municipalityID,
  currentAdvisorIDs,
  isPriority,
  advisorNamesById,
  options,
}: MunicipalityListAdvisorsControlProps) => {
  const [open, setOpen] = useState(false)
  const [selectedIDs, setSelectedIDs] = useState<number[]>(currentAdvisorIDs)
  const [query, setQuery] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const pendingCountRef = useRef(0)
  const lastPropsIDsRef = useRef(currentAdvisorIDs)
  // Requests can settle out of send order (network jitter). Track the send
  // order explicitly and only ever adopt the response with the highest
  // sequence number seen so far — never "whichever response happens to be
  // the one that brings the pending count to zero".
  const requestSeqRef = useRef(0)
  const latestConfirmedRef = useRef<{ seq: number; advisors: number[] } | null>(null)

  // Adopt server props only when they change from outside (navigation / RSC
  // refresh) — an in-flight delta's optimistic state must not be clobbered by
  // a prop identical in content to what we already had.
  useEffect(() => {
    if (sameIdSet(currentAdvisorIDs, lastPropsIDsRef.current)) return
    lastPropsIDsRef.current = currentAdvisorIDs
    setSelectedIDs(currentAdvisorIDs)
  }, [currentAdvisorIDs])

  // Every eligible account (coordinator/advisor/candidate) is listed here
  // regardless of current assignment, so it doubles as the name lookup for
  // chips the popover just added — no round trip needed to label them.
  const optionNameById = useMemo(
    () => new Map(options.map((option) => [option.id, option.name])),
    [options],
  )

  const selectedSet = useMemo(() => new Set(selectedIDs), [selectedIDs])
  const chips = useMemo(
    () =>
      selectedIDs
        .map((id) => ({
          id,
          name: optionNameById.get(id) ?? advisorNamesById.get(id)?.name ?? `Assessor #${id}`,
        }))
        .sort((left, right) => left.name.localeCompare(right.name, 'pt-BR')),
    [selectedIDs, optionNameById, advisorNamesById],
  )

  // Redundant with the chips themselves, but B23's hover/focus tooltip on the
  // trigger stays here so the coordinator sees the full list without opening
  // the popover — `formatAdvisorNamesTooltip` returns `null` for an empty
  // list (the trigger already reads "Sem responsável"/"Sem assessor" by
  // extenso, so a tooltip would only echo it).
  const tooltipContent = formatAdvisorNamesTooltip(chips)

  const filteredOptions = useMemo(
    () => options.filter((option) => matchesAtWordStart(option.name, query)),
    [options, query],
  )

  const toggle = (advisorId: number, assigned: boolean) => {
    setErrorMessage(null)
    setSelectedIDs((current) => {
      const next = new Set(current)
      if (assigned) next.add(advisorId)
      else next.delete(advisorId)
      return [...next]
    })
    setQuery('')

    pendingCountRef.current += 1
    setIsPending(true)
    const requestSeq = (requestSeqRef.current += 1)

    void (async () => {
      const revertDelta = () => {
        setSelectedIDs((current) => {
          const next = new Set(current)
          if (assigned) next.delete(advisorId)
          else next.add(advisorId)
          return [...next]
        })
      }

      try {
        const response = await fetch(ADVISORS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ municipalityId: municipalityID, advisorId, assigned }),
        })

        const payload = (await response.json()) as MunicipalityListAdvisorsResponse
        pendingCountRef.current = Math.max(0, pendingCountRef.current - 1)

        if (!response.ok || payload.status !== 'success') {
          revertDelta()
          setErrorMessage(payload.status === 'error' ? payload.message : SAVE_ERROR_MESSAGE)
          return
        }

        if (requestSeq > (latestConfirmedRef.current?.seq ?? 0)) {
          latestConfirmedRef.current = { seq: requestSeq, advisors: payload.advisors }
        }

        // Only adopt the server's confirmed set once every in-flight delta has
        // settled, and always the most recently *sent* delta's response (not
        // whichever response happens to be the one landing last — responses
        // can arrive out of send order under network jitter).
        if (pendingCountRef.current === 0 && latestConfirmedRef.current) {
          lastPropsIDsRef.current = latestConfirmedRef.current.advisors
          setSelectedIDs(latestConfirmedRef.current.advisors)
        }
      } catch {
        pendingCountRef.current = Math.max(0, pendingCountRef.current - 1)
        revertDelta()
        setErrorMessage(SAVE_ERROR_MESSAGE)
      } finally {
        if (pendingCountRef.current === 0) setIsPending(false)
      }
    })()
  }

  const statusMessage = errorMessage ? errorMessage : isPending ? 'Salvando assessores.' : ''

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <CampaignHoverTooltip
        content={tooltipContent}
        align="start"
        openOnTouch={false}
        disabled={open}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-expanded={open}
            aria-haspopup="dialog"
            className={cn(
              'min-h-11 rounded-md px-1 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              open ? 'bg-muted/60' : undefined,
            )}
            aria-label="Editar assessores"
          >
            <MunicipalityAdvisorAvatarStack advisors={chips} isPriority={isPriority} />
          </button>
        </PopoverTrigger>
      </CampaignHoverTooltip>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="relative flex flex-col gap-2 p-3 pb-0">
          <p className="text-sm font-medium">Atribuir assessores</p>
          <p className="text-xs text-muted-foreground">
            O assessor vê e gerencia somente os municípios que administra.
          </p>
          {isPending ? (
            <Spinner
              className="absolute top-3 right-3 size-3.5 text-muted-foreground"
              aria-label="Salvando assessores"
            />
          ) : null}
        </div>
        {chips.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 px-3 pt-2">
            {chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                aria-label={`Remover ${chip.name}`}
                onClick={() => toggle(chip.id, false)}
              >
                <Badge
                  variant="secondary"
                  className="max-w-full cursor-pointer gap-1 pr-1 font-normal hover:bg-destructive/15"
                >
                  <span className="truncate">{chip.name}</span>
                  <XIcon className="size-3 shrink-0 opacity-70" aria-hidden="true" />
                </Badge>
              </button>
            ))}
          </div>
        ) : null}
        <Command shouldFilter={false} className="mt-1">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar assessor…"
            aria-label="Buscar assessor"
          />
          <CommandList>
            {filteredOptions.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhum resultado.
              </p>
            ) : (
              filteredOptions.map((option) => {
                const assigned = selectedSet.has(option.id)
                return (
                  <CommandItem
                    key={option.id}
                    value={`advisor-${option.id}`}
                    data-checked={assigned}
                    onSelect={() => toggle(option.id, !assigned)}
                  >
                    <span className="truncate">
                      {option.name}
                      {option.isCurrent ? ' (você)' : ''}
                    </span>
                  </CommandItem>
                )
              })
            )}
          </CommandList>
        </Command>
        {errorMessage ? (
          <div className="p-3 pt-2">
            <Alert variant="destructive">
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          </div>
        ) : null}
        <p className="sr-only" aria-live="polite">
          {statusMessage}
        </p>
      </PopoverContent>
    </Popover>
  )
}
