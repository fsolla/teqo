'use client'

import { XIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { MunicipalityListAdvisorsResponse } from '@/app/(campaign)/campanha/(app)/municipios/advisors/types'
import {
  advisorEntriesFromIds,
  formatAdvisorNamesTooltip,
  MunicipalityAdvisorAvatarStack,
} from '@/components/campaign/municipality/MunicipalityAdvisorAvatarStack'
import {
  CampaignCellEditOverlay,
  type CampaignCellEditOverlayVariant,
} from '@/components/campaign/shared/CampaignCellEditOverlay'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/Command'
import { Spinner } from '@/components/ui/Spinner'
import { sameIdSet } from '@/lib/sameIdSet'
import { cn } from '@/lib/utils'
import { matchesAtWordStart } from '@/lib/wordStartFilter'
import type {
  EligibleAdvisorOption,
  MunicipalityAdvisorSummary,
} from '@/utilities/municipalityViewModels'

const ADVISORS_ENDPOINT = '/campanha/municipios/advisors'
const SAVE_ERROR_MESSAGE = 'Não foi possível atualizar os assessores. Tente novamente.'

type MunicipalityListAdvisorsControlProps = {
  municipalityID: number
  municipalityName: string
  currentAdvisorIDs: number[]
  /** Raises the empty state to "Sem responsável" — see `MissingAdvisorBadge`. */
  isPriority: boolean
  advisorNamesById: ReadonlyMap<number, MunicipalityAdvisorSummary>
  options: EligibleAdvisorOption[]
  variant: CampaignCellEditOverlayVariant
}

export const MunicipalityListAdvisorsControl = ({
  municipalityID,
  municipalityName,
  currentAdvisorIDs,
  isPriority,
  advisorNamesById,
  options,
  variant,
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
  const assignedLabel = chips.length
    ? chips.map((chip) => chip.name).join(', ')
    : isPriority
      ? 'sem responsável'
      : 'sem assessor'

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
  // The body pads its own sections (`px-4`, aligned with the Drawer header) so
  // the `Command` can stay full-bleed in both containers — hence `px-0` on the
  // sheet body and `p-0` on the popover content.
  const isSheet = variant === 'sheet'

  return (
    <CampaignCellEditOverlay
      variant={variant}
      open={open}
      onOpenChange={setOpen}
      title="Atribuir assessores"
      description={municipalityName}
      // The avatar stack reads as initials at best, and an `aria-label` replaces
      // even those — so who is assigned goes in the label, by extenso.
      triggerLabel={`Editar assessores em ${municipalityName} — ${assignedLabel}`}
      triggerBusy={isPending}
      tooltipContent={tooltipContent}
      contentClassName="w-80 p-0"
      sheetBodyClassName="px-0 pt-2"
      trigger={<MunicipalityAdvisorAvatarStack advisors={chips} isPriority={isPriority} />}
    >
      <div className={cn('relative flex shrink-0 flex-col gap-2 px-4 pb-0', !isSheet && 'pt-3')}>
        {/* The Drawer's own header already titles it. */}
        {isSheet ? null : <p className="text-sm font-medium">Atribuir assessores</p>}
        {/* `pr-6` keeps this line clear of the sheet's spinner, which sits at
            `top-0 right-4` because there is no title row above it to hold it. */}
        <p className={cn('text-xs text-muted-foreground', isSheet && 'pr-6')}>
          O assessor vê e gerencia somente os municípios que administra.
        </p>
        {isPending ? (
          <Spinner
            className={cn(
              'absolute size-3.5 text-muted-foreground',
              isSheet ? 'top-0 right-4' : 'top-3 right-3',
            )}
            aria-label="Salvando assessores"
          />
        ) : null}
      </div>
      {chips.length > 0 ? (
        <div className="flex shrink-0 flex-wrap gap-1.5 px-4 pt-2">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              // A 20px pill is a fine mouse target and a bad thumb one: the
              // Drawer pads it to the 44px minimum without growing the pill.
              className={cn('inline-flex items-center', isSheet && 'min-h-11')}
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
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Nenhum resultado.</p>
          ) : (
            filteredOptions.map((option) => {
              const assigned = selectedSet.has(option.id)
              return (
                <CommandItem
                  key={option.id}
                  value={`advisor-${option.id}`}
                  data-checked={assigned}
                  className={isSheet ? 'min-h-11' : undefined}
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
        <div className="shrink-0 px-4 pt-2 pb-3">
          <Alert variant="destructive">
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {statusMessage}
      </p>
    </CampaignCellEditOverlay>
  )
}
