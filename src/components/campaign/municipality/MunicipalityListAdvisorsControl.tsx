'use client'

import { UserPlusIcon, XIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { MunicipalityListAdvisorsResponse } from '@/app/(campaign)/campanha/(app)/municipios/advisors/types'
import {
  advisorEntriesFromIds,
  formatAdvisorNamesTooltip,
  MunicipalityAdvisorAvatarStack,
} from '@/components/campaign/municipality/MunicipalityAdvisorAvatarStack'
import { useMunicipalityAdvisorCreate } from '@/components/campaign/municipality/MunicipalityAdvisorCreateProvider'
import {
  CampaignCellEditOverlay,
  type CampaignCellEditOverlayVariant,
} from '@/components/campaign/shared/CampaignCellEditOverlay'
import { useCampaignCellFailureChannel } from '@/components/campaign/shared/useCampaignCellFailureChannel'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/Command'
import { Spinner } from '@/components/ui/Spinner'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import { sameIdSet } from '@/lib/sameIdSet'
import { cn } from '@/lib/utils'
import { matchesAtWordStart } from '@/lib/wordStartFilter'
import type {
  EligibleAdvisorOption,
  MunicipalityAdvisorSummary,
} from '@/utilities/municipality/municipalityViewModels'

const ADVISORS_ENDPOINT = '/campanha/municipios/advisors'
const SAVE_ERROR_MESSAGE = 'Não foi possível atualizar os assessores. Tente novamente.'

/** B154 — sentinel temp id for an in-flight inline create; negative = never a real account. */
const isPendingCreateId = (id: number): boolean => id < 0

// Shared empty values so the memos stay referentially stable when the bridge
// is absent (standalone renders in unit tests) or nothing is pending.
const EMPTY_CREATED_OPTIONS: EligibleAdvisorOption[] = []
const EMPTY_PENDING_CREATES: ReadonlyMap<number, string> = new Map()

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
  const { errorMessage, setErrorMessage, reportFailure, noteOpenChange } =
    useCampaignCellFailureChannel()
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

  const handleOpenChange = (nextOpen: boolean) => {
    noteOpenChange(nextOpen)
    setOpen(nextOpen)
  }

  // Adopt server props only when they change from outside (navigation / RSC
  // refresh) — an in-flight delta's optimistic state must not be clobbered by
  // a prop identical in content to what we already had.
  useEffect(() => {
    if (sameIdSet(currentAdvisorIDs, lastPropsIDsRef.current)) return
    lastPropsIDsRef.current = currentAdvisorIDs
    setSelectedIDs(currentAdvisorIDs)
  }, [currentAdvisorIDs])

  // B154 — advisors created inline since the page last rendered server-side,
  // shared across every row's popover through `MunicipalityAdvisorCreateProvider`
  // (null when the control renders standalone, e.g. in unit tests).
  const createBridge = useMunicipalityAdvisorCreate()
  const createdOptions = createBridge?.createdOptions ?? EMPTY_CREATED_OPTIONS
  const registerCreatedAdvisor = createBridge?.registerCreatedAdvisor
  // tempId → name for in-flight creates: the chip renders optimistically while
  // the request is out, and the id is not known until the response arrives.
  const [pendingCreates, setPendingCreates] =
    useState<ReadonlyMap<number, string>>(EMPTY_PENDING_CREATES)

  // Every eligible account (coordinator/advisor/candidate) is listed here
  // regardless of current assignment, so it doubles as the name lookup for an
  // id the popover just optimistically added — no round trip needed to label
  // it. `advisorNamesById` is the fallback for an id that fell out of
  // eligibility but is still assigned; `advisorEntriesFromIds` drops the rare
  // id found in neither, same as every other advisor cell in the list.
  const effectiveOptions = useMemo(() => {
    // The provider bridge can outlive a server re-render (sort/filter
    // navigation keeps client state, and `getEligibleAdvisorOptions` then
    // returns the created account again), so the same advisor can arrive
    // twice — dedupe by id to keep combobox entries and React keys unique.
    const byId = new Map<number, EligibleAdvisorOption>()
    for (const option of options) byId.set(option.id, option)
    for (const option of createdOptions) byId.set(option.id, option)
    return [...byId.values()]
  }, [options, createdOptions])

  const advisorLookup = useMemo(() => {
    const lookup = new Map<number, { id: number; name: string }>(advisorNamesById)
    for (const option of effectiveOptions)
      lookup.set(option.id, { id: option.id, name: option.name })
    for (const [tempId, name] of pendingCreates) lookup.set(tempId, { id: tempId, name })
    return lookup
  }, [advisorNamesById, effectiveOptions, pendingCreates])

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
    () => effectiveOptions.filter((option) => matchesAtWordStart(option.name, query)),
    [effectiveOptions, query],
  )

  // Single settle point shared by the toggle and the inline create (success,
  // mapped error, network failure): decrements the pending count and, once it
  // reaches 0, stops the spinner and reconciles to the latest confirmed server
  // set — even on a request's own failure, an earlier delta in the same batch
  // may have already confirmed one.
  const finishRequest = () => {
    pendingCountRef.current = Math.max(0, pendingCountRef.current - 1)
    if (pendingCountRef.current > 0) return
    setIsPending(false)
    if (latestConfirmedRef.current) setSelectedIDs(latestConfirmedRef.current.advisors)
  }

  const toggle = (advisorId: number, assigned: boolean) => {
    // A negative id is a B154 pending-create sentinel, never a real account —
    // the temp chip has no remove affordance, so this only guards the path.
    if (isPendingCreateId(advisorId)) return
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
        const { ok, payload } = await postCampaignJson<MunicipalityListAdvisorsResponse>(
          ADVISORS_ENDPOINT,
          { municipalityId: municipalityID, advisorId, assigned },
        )

        if (!ok || payload.status !== 'success') {
          revertDelta()
          reportFailure(payload.status === 'error' ? payload.message : SAVE_ERROR_MESSAGE)
          finishRequest()
          return
        }

        if (requestSeq > (latestConfirmedRef.current?.seq ?? 0)) {
          latestConfirmedRef.current = { seq: requestSeq, advisors: payload.advisors }
        }
        finishRequest()
      } catch {
        revertDelta()
        reportFailure(SAVE_ERROR_MESSAGE)
        finishRequest()
      }
    })()
  }

  /**
   * B154 — name-only inline create, assigned to this município. The chip goes
   * up immediately under a sentinel temp id (the real id only exists once the
   * response lands); the request rides the same seq/pending machinery as the
   * toggle, so out-of-order settles and the cap failure reconcile exactly like
   * a toggle — a failed create reverts the temp chip and shows the Alert.
   */
  const createAdvisor = (name: string) => {
    // A create is not an idempotent delta: re-activating the same name while a
    // create is in flight would mint a second account. The temp chip already
    // signals the pending one — skip.
    if ([...pendingCreates.values()].includes(name)) return
    setErrorMessage(null)
    setQuery('')

    pendingCountRef.current += 1
    setIsPending(true)
    const requestSeq = (requestSeqRef.current += 1)
    const tempId = -requestSeq

    setSelectedIDs((current) => [...current, tempId])
    setPendingCreates((current) => new Map(current).set(tempId, name))

    void (async () => {
      const revertCreate = () => {
        setSelectedIDs((current) => current.filter((id) => id !== tempId))
        setPendingCreates((current) => {
          const next = new Map(current)
          next.delete(tempId)
          return next
        })
      }

      try {
        const { ok, payload } = await postCampaignJson<MunicipalityListAdvisorsResponse>(
          ADVISORS_ENDPOINT,
          { municipalityId: municipalityID, name },
        )

        if (!ok || payload.status !== 'success') {
          revertCreate()
          reportFailure(payload.status === 'error' ? payload.message : SAVE_ERROR_MESSAGE)
          finishRequest()
          return
        }

        if (requestSeq > (latestConfirmedRef.current?.seq ?? 0)) {
          latestConfirmedRef.current = { seq: requestSeq, advisors: payload.advisors }
        }

        const createdAdvisor = payload.createdAdvisor
        if (createdAdvisor) {
          // Swap the sentinel for the real id right away: if another delta is
          // still in flight the reconcile is deferred, and the chip must not
          // vanish in the gap (the lookup drops a temp id the moment its
          // pending entry is removed).
          setSelectedIDs((current) => [...current.filter((id) => id !== tempId), createdAdvisor.id])
          setPendingCreates((current) => {
            const next = new Map(current)
            next.delete(tempId)
            return next
          })
          // Make the account selectable in every other row's popover on this
          // page load — `createdOptions` is the client-side bridge until the
          // next navigation's `getEligibleAdvisorOptions` picks it up.
          registerCreatedAdvisor?.({
            id: createdAdvisor.id,
            name: createdAdvisor.name,
            isCurrent: false,
          })
        }
        finishRequest()
      } catch {
        revertCreate()
        reportFailure(SAVE_ERROR_MESSAGE)
        finishRequest()
      }
    })()
  }

  const statusMessage = errorMessage ? errorMessage : isPending ? 'Salvando assessores.' : ''
  // The body pads its own sections (`px-4`, aligned with the Drawer header) so
  // the `Command` can stay full-bleed in both containers — hence `px-0` on the
  // sheet body and `p-0` on the popover content.
  const isSheet = variant === 'sheet'
  const trimmedQuery = query.trim()

  return (
    <CampaignCellEditOverlay
      variant={variant}
      open={open}
      onOpenChange={handleOpenChange}
      title="Atribuir assessores"
      description={municipalityName}
      // The avatar stack reads as initials at best, and an `aria-label` replaces
      // even those — so who is assigned goes in the label, by extenso.
      triggerLabel={`Editar assessores em ${municipalityName} — ${assignedLabel}`}
      triggerBusy={isPending}
      statusMessage={statusMessage}
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
          {chips.map((chip) =>
            // A pending-create chip has no remove affordance: the server-side
            // create cannot be cancelled mid-flight, so removal waits for the
            // real account (and the real toggle) once the response lands.
            isPendingCreateId(chip.id) ? (
              <Badge
                key={chip.id}
                variant="secondary"
                className={cn('max-w-full font-normal', isSheet && 'min-h-11')}
              >
                <span className="truncate">{chip.name}</span>
              </Badge>
            ) : (
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
            ),
          )}
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
            trimmedQuery.length >= 2 && trimmedQuery.length <= 160 ? (
              <CommandItem
                value={`create-${trimmedQuery}`}
                className={isSheet ? 'min-h-11' : undefined}
                onSelect={() => createAdvisor(trimmedQuery)}
              >
                <UserPlusIcon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">Criar assessor “{trimmedQuery}”</span>
              </CommandItem>
            ) : (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhum resultado.
              </p>
            )
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
    </CampaignCellEditOverlay>
  )
}
