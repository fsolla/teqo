'use client'

import { UserPlusIcon, XIcon } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'

import type { MunicipalityListLeadershipsResponse } from '@/app/(campaign)/campanha/(app)/municipios/leaderships/types'
import { useMunicipalityLeadershipCreate } from '@/components/campaign/municipality/MunicipalityLeadershipCreateProvider'
import {
  CampaignCellEditOverlay,
  type CampaignCellEditOverlayVariant,
} from '@/components/campaign/shared/CampaignCellEditOverlay'
import { useCampaignCellFailureChannel } from '@/components/campaign/shared/useCampaignCellFailureChannel'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/Command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/Spinner'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import {
  formatBrazilianPhoneInput,
  normalizeBrazilianPhone,
  sanitizeBrazilianPhoneInput,
} from '@/lib/phone'
import { sameIdSet } from '@/lib/sameIdSet'
import { cn } from '@/lib/utils'
import { matchesAtWordStart } from '@/lib/wordStartFilter'
import type {
  EligibleLeadershipOption,
  MunicipalityLeadershipSummary,
} from '@/utilities/municipality/municipalityViewModels'

const LEADERSHIPS_ENDPOINT = '/campanha/municipios/leaderships'
const SAVE_ERROR_MESSAGE = 'Não foi possível atualizar as lideranças. Tente novamente.'

/** B155 — sentinel temp id for an in-flight inline create; negative = never a real leadership. */
const isPendingCreateId = (id: number): boolean => id < 0

// Shared empty values so the memos stay referentially stable when the bridge
// is absent (standalone renders in unit tests) or nothing is pending.
const EMPTY_CREATED_OPTIONS: EligibleLeadershipOption[] = []
const EMPTY_PENDING_CREATES: ReadonlyMap<number, { name: string; phone: string }> = new Map()

/** Resolves leadership ids to summaries, dropping any without a name (deleted/unknown). */
const leadershipEntriesFromIds = (
  leadershipIDs: readonly number[],
  namesById: ReadonlyMap<number, MunicipalityLeadershipSummary>,
): MunicipalityLeadershipSummary[] =>
  leadershipIDs.flatMap((id) => {
    const leadership = namesById.get(id)
    return leadership ? [{ id: leadership.id, name: leadership.name }] : []
  })

type MunicipalityListLeadershipsControlProps = {
  municipalityID: number
  municipalityName: string
  currentLeadershipIDs: number[]
  leadershipNamesById: ReadonlyMap<number, MunicipalityLeadershipSummary>
  options: EligibleLeadershipOption[]
  variant: CampaignCellEditOverlayVariant
}

export const MunicipalityListLeadershipsControl = ({
  municipalityID,
  municipalityName,
  currentLeadershipIDs,
  leadershipNamesById,
  options,
  variant,
}: MunicipalityListLeadershipsControlProps) => {
  const [open, setOpen] = useState(false)
  const [selectedIDs, setSelectedIDs] = useState<number[]>(currentLeadershipIDs)
  const [query, setQuery] = useState('')
  const { errorMessage, setErrorMessage, reportFailure, noteOpenChange } =
    useCampaignCellFailureChannel()
  const [isPending, setIsPending] = useState(false)
  const pendingCountRef = useRef(0)
  const lastPropsIDsRef = useRef(currentLeadershipIDs)
  // Requests can settle out of send order (network jitter), so the send order
  // is tracked explicitly: only the response with the highest sequence number
  // seen so far is kept, and it is adopted — win or fail — once every
  // in-flight delta has settled (`pendingCountRef` back to 0). No response
  // ever writes `lastPropsIDsRef`: that ref exists solely to tell a genuine
  // external prop change (nav/refresh) apart from a no-op re-render carrying
  // the same pre-edit content.
  const requestSeqRef = useRef(0)
  const latestConfirmedRef = useRef<{ seq: number; leadershipIDs: number[] } | null>(null)

  // B155 — the inline-create mini-form, hidden until the user picks
  // "+ Criar liderança" in the no-results branch.
  const [createFormOpen, setCreateFormOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createPhone, setCreatePhone] = useState('')
  // Unique per mounted instance: the desktop table and the mobile cards are
  // sibling trees, so the same município renders two controls at once.
  const createFormId = useId()
  // Search box to return focus to once the create form closes (the form
  // unmounts, so focus would otherwise fall to the body).
  const commandInputRef = useRef<HTMLInputElement>(null)

  const handleOpenChange = (nextOpen: boolean) => {
    noteOpenChange(nextOpen)
    setOpen(nextOpen)
  }

  // Adopt server props only when they change from outside (navigation / RSC
  // refresh) — an in-flight delta's optimistic state must not be clobbered by
  // a prop identical in content to what we already had.
  useEffect(() => {
    if (sameIdSet(currentLeadershipIDs, lastPropsIDsRef.current)) return
    lastPropsIDsRef.current = currentLeadershipIDs
    setSelectedIDs(currentLeadershipIDs)
  }, [currentLeadershipIDs])

  // B155 — leaderships created inline since the page last rendered server-side,
  // shared across every row's popover through `MunicipalityLeadershipCreateProvider`
  // (null when the control renders standalone, e.g. in unit tests).
  const createBridge = useMunicipalityLeadershipCreate()
  const createdOptions = createBridge?.createdOptions ?? EMPTY_CREATED_OPTIONS
  const registerCreatedLeadership = createBridge?.registerCreatedLeadership
  // tempId → {name, phone} for in-flight creates: the chip renders optimistically
  // while the request is out, and the id is not known until the response arrives.
  const [pendingCreates, setPendingCreates] =
    useState<ReadonlyMap<number, { name: string; phone: string }>>(EMPTY_PENDING_CREATES)

  // Every leadership the actor may add is listed here regardless of current
  // assignment, so it doubles as the name lookup for an id the popover just
  // optimistically added — no round trip needed to label it.
  // `leadershipNamesById` is the fallback for an id that fell out of
  // eligibility but is still assigned; `leadershipEntriesFromIds` drops the
  // rare id found in neither, same as every other relation cell in the list.
  const effectiveOptions = useMemo(() => {
    // The provider bridge can outlive a server re-render (sort/filter
    // navigation keeps client state, and `getEligibleLeadershipOptions` then
    // returns the created record again), so the same leadership can arrive
    // twice — dedupe by id to keep combobox entries and React keys unique.
    const byId = new Map<number, EligibleLeadershipOption>()
    for (const option of options) byId.set(option.id, option)
    for (const option of createdOptions) byId.set(option.id, option)
    return [...byId.values()]
  }, [options, createdOptions])

  const leadershipLookup = useMemo(() => {
    const lookup = new Map<number, MunicipalityLeadershipSummary>(leadershipNamesById)
    for (const option of effectiveOptions)
      lookup.set(option.id, { id: option.id, name: option.name })
    for (const [tempId, pending] of pendingCreates)
      lookup.set(tempId, { id: tempId, name: pending.name })
    return lookup
  }, [leadershipNamesById, effectiveOptions, pendingCreates])

  const selectedSet = useMemo(() => new Set(selectedIDs), [selectedIDs])
  const chips = useMemo(
    () =>
      [...leadershipEntriesFromIds(selectedIDs, leadershipLookup)].sort((left, right) =>
        left.name.localeCompare(right.name, 'pt-BR'),
      ),
    [selectedIDs, leadershipLookup],
  )

  // The trigger already reads the names by extenso — no hover tooltip needed.
  const assignedLabel = chips.length ? chips.map((chip) => chip.name).join(', ') : 'nenhuma'

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
    if (latestConfirmedRef.current) setSelectedIDs(latestConfirmedRef.current.leadershipIDs)
  }

  const toggle = (leadershipId: number, assigned: boolean) => {
    // A negative id is a B155 pending-create sentinel, never a real record —
    // the temp chip has no remove affordance, so this only guards the path.
    if (isPendingCreateId(leadershipId)) return
    setErrorMessage(null)
    setSelectedIDs((current) => {
      const next = new Set(current)
      if (assigned) next.add(leadershipId)
      else next.delete(leadershipId)
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
          if (assigned) next.delete(leadershipId)
          else next.add(leadershipId)
          return [...next]
        })
      }

      try {
        const { ok, payload } = await postCampaignJson<MunicipalityListLeadershipsResponse>(
          LEADERSHIPS_ENDPOINT,
          { municipalityId: municipalityID, leadershipId, assigned },
        )

        if (!ok || payload.status !== 'success') {
          revertDelta()
          reportFailure(payload.status === 'error' ? payload.message : SAVE_ERROR_MESSAGE)
          finishRequest()
          return
        }

        if (requestSeq > (latestConfirmedRef.current?.seq ?? 0)) {
          latestConfirmedRef.current = { seq: requestSeq, leadershipIDs: payload.leadershipIDs }
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
   * B155 — name+phone inline create, assigned to this município. The chip goes
   * up immediately under a sentinel temp id (the real id only exists once the
   * response lands); the request rides the same seq/pending machinery as the
   * toggle, so out-of-order settles and the floor/cap failure reconcile exactly
   * like a toggle — a failed create reverts the temp chip and shows the Alert.
   */
  const createLeadership = (name: string, phone: string) => {
    // A create is not an idempotent delta: re-activating the same person while
    // a create is in flight would mint a second record. The temp chip already
    // signals the pending one — skip.
    if (
      [...pendingCreates.values()].some(
        (pending) => pending.name === name && pending.phone === phone,
      )
    ) {
      return
    }
    setErrorMessage(null)
    setCreateFormOpen(false)
    setCreateName('')
    setCreatePhone('')
    setQuery('')

    pendingCountRef.current += 1
    setIsPending(true)
    const requestSeq = (requestSeqRef.current += 1)
    const tempId = -requestSeq

    setSelectedIDs((current) => [...current, tempId])
    setPendingCreates((current) => new Map(current).set(tempId, { name, phone }))

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
        const { ok, payload } = await postCampaignJson<MunicipalityListLeadershipsResponse>(
          LEADERSHIPS_ENDPOINT,
          { municipalityId: municipalityID, name, phone },
        )

        if (!ok || payload.status !== 'success') {
          revertCreate()
          reportFailure(payload.status === 'error' ? payload.message : SAVE_ERROR_MESSAGE)
          finishRequest()
          return
        }

        if (requestSeq > (latestConfirmedRef.current?.seq ?? 0)) {
          latestConfirmedRef.current = { seq: requestSeq, leadershipIDs: payload.leadershipIDs }
        }

        const createdLeadership = payload.createdLeadership
        if (createdLeadership) {
          // Swap the sentinel for the real id right away: if another delta is
          // still in flight the reconcile is deferred, and the chip must not
          // vanish in the gap (the lookup drops a temp id the moment its
          // pending entry is removed).
          setSelectedIDs((current) => [
            ...current.filter((id) => id !== tempId),
            createdLeadership.id,
          ])
          setPendingCreates((current) => {
            const next = new Map(current)
            next.delete(tempId)
            return next
          })
          // Make the record selectable in every other row's popover on this
          // page load — `createdOptions` is the client-side bridge until the
          // next navigation's `getEligibleLeadershipOptions` picks it up.
          registerCreatedLeadership?.({ id: createdLeadership.id, name: createdLeadership.name })
        }
        finishRequest()
      } catch {
        revertCreate()
        reportFailure(SAVE_ERROR_MESSAGE)
        finishRequest()
      }
    })()
  }

  const closeCreateForm = () => {
    setCreateFormOpen(false)
    // The form unmounts with it; return focus to the search box once the
    // Command remounts (otherwise keyboard/SR focus falls to the body).
    requestAnimationFrame(() => commandInputRef.current?.focus())
  }

  const handleCreateSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = createName.trim()
    const phone = normalizeBrazilianPhone(createPhone)
    if (name.length < 2 || !phone) return
    createLeadership(name, phone)
  }

  const handlePhoneChange = (value: string) => {
    setCreatePhone(formatBrazilianPhoneInput(sanitizeBrazilianPhoneInput(value)))
  }

  // Mirrors the zod schema (`name 2–120`, `brazilianMobile`) so a malformed
  // submit never reaches the server's generic error.
  const canCreate =
    createName.trim().length >= 2 && createName.trim().length <= 120
      ? normalizeBrazilianPhone(createPhone) !== null
      : false

  const statusMessage = errorMessage ? errorMessage : isPending ? 'Salvando lideranças.' : ''
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
      title="Gerenciar lideranças"
      description={municipalityName}
      triggerLabel={`Editar lideranças em ${municipalityName} — ${assignedLabel}`}
      triggerBusy={isPending}
      statusMessage={statusMessage}
      contentClassName="w-80 p-0"
      sheetBodyClassName="px-0 pt-2"
      trigger={
        chips.length === 0 ? (
          <span className="text-sm text-muted-foreground">Nenhuma</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {chips.map((chip) => (
              <Badge key={chip.id} variant="secondary" className="max-w-full font-normal">
                <span className="truncate">{chip.name}</span>
              </Badge>
            ))}
          </span>
        )
      }
    >
      <div className={cn('relative flex shrink-0 flex-col gap-2 px-4 pb-0', !isSheet && 'pt-3')}>
        {/* The Drawer's own header already titles it. */}
        {isSheet ? null : <p className="text-sm font-medium">Gerenciar lideranças</p>}
        <p className={cn('text-xs text-muted-foreground', isSheet && 'pr-6')}>
          A liderança passa a aparecer também na ficha dela, na área Lideranças.
        </p>
        {isPending ? (
          <Spinner
            className={cn(
              'absolute size-3.5 text-muted-foreground',
              isSheet ? 'top-0 right-4' : 'top-3 right-3',
            )}
            aria-label="Salvando lideranças"
          />
        ) : null}
      </div>
      {chips.length > 0 ? (
        <div className="flex shrink-0 flex-wrap gap-1.5 px-4 pt-2">
          {chips.map((chip) =>
            // A pending-create chip has no remove affordance: the server-side
            // create cannot be cancelled mid-flight, so removal waits for the
            // real record (and the real toggle) once the response lands.
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
      {createFormOpen ? (
        <form className="flex shrink-0 flex-col gap-3 px-4 pb-3 pt-3" onSubmit={handleCreateSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`leadership-create-name-${createFormId}`}>Nome</Label>
            <Input
              id={`leadership-create-name-${createFormId}`}
              value={createName}
              onChange={(event) => setCreateName(event.currentTarget.value)}
              placeholder="Nome completo"
              autoComplete="name"
              maxLength={120}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`leadership-create-phone-${createFormId}`}>Celular (com DDD)</Label>
            <Input
              id={`leadership-create-phone-${createFormId}`}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={createPhone}
              onChange={(event) => handlePhoneChange(event.currentTarget.value)}
              placeholder="(71) 99999-9999"
            />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" size="sm" disabled={!canCreate || isPending}>
              Criar liderança
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={closeCreateForm}
            >
              Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Command shouldFilter={false} className="mt-1">
          <CommandInput
            ref={commandInputRef}
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar liderança…"
            aria-label="Buscar liderança"
          />
          <CommandList>
            {filteredOptions.length === 0 ? (
              trimmedQuery.length >= 2 && trimmedQuery.length <= 120 ? (
                <CommandItem
                  value={`create-${trimmedQuery}`}
                  className={isSheet ? 'min-h-11' : undefined}
                  onSelect={() => {
                    setCreateFormOpen(true)
                    setCreateName(trimmedQuery)
                  }}
                >
                  <UserPlusIcon className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">Criar liderança “{trimmedQuery}”</span>
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
                    value={`leadership-${option.id}`}
                    data-checked={assigned}
                    className={isSheet ? 'min-h-11' : undefined}
                    onSelect={() => toggle(option.id, !assigned)}
                  >
                    <span className="truncate">{option.name}</span>
                  </CommandItem>
                )
              })
            )}
          </CommandList>
        </Command>
      )}
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
