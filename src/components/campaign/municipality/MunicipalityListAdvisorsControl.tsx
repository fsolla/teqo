'use client'

import { XIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { MunicipalityListAdvisorsResponse } from '@/app/(campaign)/campanha/(app)/municipios/advisors/types'
import {
  advisorEntriesFromIds,
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
  // Requests can settle out of send order (network jitter), so the send order
  // is tracked explicitly: only the response with the highest sequence number
  // seen so far is kept, and it is adopted — win or fail — once every
  // in-flight delta has settled (`pendingCountRef` back to 0). No response
  // ever writes `lastPropsIDsRef`: that ref exists solely to tell a genuine
  // external prop change (nav/refresh) apart from a no-op re-render carrying
  // the same pre-edit content, and advancing it here would make a later
  // stale re-render of that same pre-edit content look "external" and
  // clobber the optimistic state back to it.
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
  // regardless of current assignment, so it doubles as the name lookup for an
  // id the popover just optimistically added — no round trip needed to label
  // it. `advisorNamesById` is the fallback for an id that fell out of
  // eligibility but is still assigned; `advisorEntriesFromIds` drops the rare
  // id found in neither, same as every other advisor cell in the list.
  const advisorLookup = useMemo(() => {
    const lookup = new Map<number, { id: number; name: string }>(advisorNamesById)
    for (const option of options) lookup.set(option.id, { id: option.id, name: option.name })
    return lookup
  }, [advisorNamesById, options])

  const selectedSet = useMemo(() => new Set(selectedIDs), [selectedIDs])
  const chips = useMemo(
    () =>
      [...advisorEntriesFromIds(selectedIDs, advisorLookup)].sort((left, right) =>
        left.name.localeCompare(right.name, 'pt-BR'),
      ),
    [selectedIDs, advisorLookup],
  )

  // B23's hover/focus tooltip stays on the trigger even though it repeats the
  // chips: it's the no-open-popover read. `null` for an empty list — the
  // trigger already reads "Sem responsável"/"Sem assessor" by extenso.
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

      // Single settle point for every exit path (success, mapped error,
      // network failure): decrements the pending count and, once it reaches
      // 0, stops the spinner and reconciles to the latest confirmed server
      // set — even on this request's own failure, an earlier delta in the
      // same batch may have already confirmed one.
      const finishRequest = () => {
        pendingCountRef.current = Math.max(0, pendingCountRef.current - 1)
        if (pendingCountRef.current > 0) return
        setIsPending(false)
        if (latestConfirmedRef.current) setSelectedIDs(latestConfirmedRef.current.advisors)
      }

      try {
        const response = await fetch(ADVISORS_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ municipalityId: municipalityID, advisorId, assigned }),
        })

        const payload = (await response.json()) as MunicipalityListAdvisorsResponse

        if (!response.ok || payload.status !== 'success') {
          revertDelta()
          setErrorMessage(payload.status === 'error' ? payload.message : SAVE_ERROR_MESSAGE)
          finishRequest()
          return
        }

        if (requestSeq > (latestConfirmedRef.current?.seq ?? 0)) {
          latestConfirmedRef.current = { seq: requestSeq, advisors: payload.advisors }
        }
        finishRequest()
      } catch {
        revertDelta()
        setErrorMessage(SAVE_ERROR_MESSAGE)
        finishRequest()
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
