'use client'

import { UserPlusIcon, XIcon } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import {
  CampaignCellEditOverlay,
  type CampaignCellEditOverlayVariant,
} from '@/components/campaign/shared/CampaignCellEditOverlay'
import {
  MunicipalityRelationAvatarStack,
  type MunicipalityRelationEntry,
} from '@/components/campaign/shared/MunicipalityRelationAvatarStack'
import { useCampaignCellFailureChannel } from '@/components/campaign/shared/useCampaignCellFailureChannel'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/Command'
import { Spinner } from '@/components/ui/Spinner'
import { sameIdSet } from '@/lib/sameIdSet'
import { cn } from '@/lib/utils'
import { matchesAtWordStart } from '@/lib/wordStartFilter'

export type MunicipalityRelationMutationResult =
  | {
      status: 'success'
      selectedIDs?: number[]
      createdEntry?: MunicipalityRelationEntry
    }
  | { status: 'error'; message: string }

/**
 * B193 — the closed-display override the dense mobile card passes through the
 * relation wrappers (Advisors/Lideranças/Dobradinhas) to this editor.
 */
export type MunicipalityRelationTriggerProps = {
  trigger?: (entries: MunicipalityRelationEntry[], emptyState: ReactNode) => ReactNode
  /** B193 — dense card trigger styling override (no min-height/hover pill). */
  triggerClassName?: string
}

type MunicipalityRelationEditorProps = MunicipalityRelationTriggerProps & {
  municipalityName: string
  currentIDs: number[]
  knownEntries?: MunicipalityRelationEntry[]
  options: MunicipalityRelationEntry[]
  variant: CampaignCellEditOverlayVariant
  title: string
  description: string
  searchPlaceholder: string
  searchLabel: string
  savingMessage: string
  saveErrorMessage: string
  createErrorMessage?: string
  triggerLabel: (entries: MunicipalityRelationEntry[]) => string
  emptyState: ReactNode
  createLabel: (name: string) => string
  createMaxLength?: number
  sortSelected?: boolean
  onToggle: (id: number, assigned: boolean) => Promise<MunicipalityRelationMutationResult>
  onCreate: (name: string) => Promise<MunicipalityRelationMutationResult>
  onCreated?: (entry: MunicipalityRelationEntry) => void
}

const isPendingCreateID = (id: number): boolean => id < 0
const EMPTY_ENTRIES: MunicipalityRelationEntry[] = []

export const MunicipalityRelationEditor = ({
  municipalityName,
  currentIDs,
  knownEntries = EMPTY_ENTRIES,
  options,
  variant,
  title,
  description,
  searchPlaceholder,
  searchLabel,
  savingMessage,
  saveErrorMessage,
  createErrorMessage = saveErrorMessage,
  triggerLabel,
  emptyState,
  createLabel,
  createMaxLength = 120,
  sortSelected = true,
  onToggle,
  onCreate,
  onCreated,
  trigger,
  triggerClassName,
}: MunicipalityRelationEditorProps) => {
  const [open, setOpen] = useState(false)
  const [selectedIDs, setSelectedIDs] = useState(currentIDs)
  const [query, setQuery] = useState('')
  const { errorMessage, setErrorMessage, reportFailure, noteOpenChange } =
    useCampaignCellFailureChannel()
  const [isPending, setIsPending] = useState(false)
  const [createdEntries, setCreatedEntries] = useState<MunicipalityRelationEntry[]>([])
  const [pendingCreates, setPendingCreates] = useState<
    ReadonlyMap<number, MunicipalityRelationEntry>
  >(new Map())
  const pendingCountRef = useRef(0)
  const lastPropsIDsRef = useRef(currentIDs)
  const requestSeqRef = useRef(0)
  const latestConfirmedRef = useRef<{ seq: number; ids: number[] } | null>(null)

  const handleOpenChange = (nextOpen: boolean) => {
    noteOpenChange(nextOpen)
    setOpen(nextOpen)
  }

  useEffect(() => {
    if (sameIdSet(currentIDs, lastPropsIDsRef.current)) return
    lastPropsIDsRef.current = currentIDs
    if (pendingCountRef.current === 0) latestConfirmedRef.current = null
    setSelectedIDs(currentIDs)
  }, [currentIDs])

  const selectableOptions = useMemo(() => {
    const byID = new Map<number, MunicipalityRelationEntry>()
    for (const entry of options) byID.set(entry.id, entry)
    for (const entry of createdEntries) byID.set(entry.id, entry)
    return [...byID.values()]
  }, [options, createdEntries])

  const entryByID = useMemo(() => {
    const lookup = new Map(knownEntries.map((entry) => [entry.id, entry]))
    for (const entry of selectableOptions) lookup.set(entry.id, entry)
    for (const [id, entry] of pendingCreates) lookup.set(id, entry)
    return lookup
  }, [knownEntries, selectableOptions, pendingCreates])

  const selectedSet = useMemo(() => new Set(selectedIDs), [selectedIDs])
  const selectedEntries = useMemo(() => {
    const entries = selectedIDs.flatMap((id) => {
      const entry = entryByID.get(id)
      return entry ? [entry] : []
    })
    return sortSelected
      ? entries.sort((left, right) => left.label.localeCompare(right.label, 'pt-BR'))
      : entries
  }, [selectedIDs, entryByID, sortSelected])
  const tooltipContent =
    selectedEntries.length === 0 ? null : (
      <div className="flex flex-col">
        {selectedEntries.map((entry) => (
          <span key={entry.id}>{entry.label}</span>
        ))}
      </div>
    )
  const filteredOptions = useMemo(
    () =>
      selectableOptions.filter((entry) =>
        matchesAtWordStart(entry.searchText ?? entry.label, query),
      ),
    [selectableOptions, query],
  )

  const finishRequest = () => {
    pendingCountRef.current = Math.max(0, pendingCountRef.current - 1)
    if (pendingCountRef.current > 0) return
    setIsPending(false)
    if (latestConfirmedRef.current) setSelectedIDs(latestConfirmedRef.current.ids)
  }

  const rememberConfirmation = (requestSeq: number, result: MunicipalityRelationMutationResult) => {
    if (result.status !== 'success' || !result.selectedIDs) return
    if (requestSeq > (latestConfirmedRef.current?.seq ?? 0)) {
      latestConfirmedRef.current = { seq: requestSeq, ids: result.selectedIDs }
    }
  }

  const toggle = (id: number, assigned: boolean) => {
    if (isPendingCreateID(id)) return
    setErrorMessage(null)
    setSelectedIDs((current) => {
      const next = new Set(current)
      if (assigned) next.add(id)
      else next.delete(id)
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
          if (assigned) next.delete(id)
          else next.add(id)
          return [...next]
        })
      }

      try {
        const result = await onToggle(id, assigned)
        if (result.status === 'error') {
          revertDelta()
          reportFailure(result.message || saveErrorMessage)
          finishRequest()
          return
        }
        rememberConfirmation(requestSeq, result)
        finishRequest()
      } catch {
        revertDelta()
        reportFailure(saveErrorMessage)
        finishRequest()
      }
    })()
  }

  const create = (name: string) => {
    if ([...pendingCreates.values()].some((entry) => entry.label === name)) return
    setErrorMessage(null)
    setQuery('')
    pendingCountRef.current += 1
    setIsPending(true)
    const requestSeq = (requestSeqRef.current += 1)
    const tempID = -requestSeq
    const pendingEntry = { id: tempID, label: name }
    setSelectedIDs((current) => [...current, tempID])
    setPendingCreates((current) => new Map(current).set(tempID, pendingEntry))

    void (async () => {
      const revertCreate = () => {
        setSelectedIDs((current) => current.filter((id) => id !== tempID))
        setPendingCreates((current) => {
          const next = new Map(current)
          next.delete(tempID)
          return next
        })
      }

      try {
        const result = await onCreate(name)
        if (result.status === 'error' || !result.createdEntry) {
          revertCreate()
          reportFailure(result.status === 'error' ? result.message : createErrorMessage)
          finishRequest()
          return
        }
        rememberConfirmation(requestSeq, result)
        const createdEntry = result.createdEntry
        setSelectedIDs((current) => [
          ...new Set([...current.filter((id) => id !== tempID), createdEntry.id]),
        ])
        setPendingCreates((current) => {
          const next = new Map(current)
          next.delete(tempID)
          return next
        })
        setCreatedEntries((current) =>
          current.some((entry) => entry.id === createdEntry.id)
            ? current
            : [...current, createdEntry],
        )
        onCreated?.(createdEntry)
        finishRequest()
      } catch {
        revertCreate()
        reportFailure(createErrorMessage)
        finishRequest()
      }
    })()
  }

  const statusMessage = errorMessage ? errorMessage : isPending ? savingMessage : ''
  const isSheet = variant === 'sheet'
  const trimmedQuery = query.trim()

  return (
    <CampaignCellEditOverlay
      variant={variant}
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={municipalityName}
      triggerLabel={triggerLabel(selectedEntries)}
      triggerBusy={isPending}
      statusMessage={statusMessage}
      tooltipContent={tooltipContent}
      triggerClassName={triggerClassName}
      contentClassName="w-80 p-0"
      sheetBodyClassName="px-0 pt-2"
      trigger={
        trigger ? (
          trigger(selectedEntries, emptyState)
        ) : (
          <MunicipalityRelationAvatarStack entries={selectedEntries} emptyState={emptyState} />
        )
      }
    >
      <div className={cn('relative flex shrink-0 flex-col gap-2 px-4 pb-0', !isSheet && 'pt-3')}>
        {isSheet ? null : <p className="text-sm font-medium">{title}</p>}
        <p className={cn('text-xs text-muted-foreground', isSheet && 'pr-6')}>{description}</p>
        {isPending ? (
          <Spinner
            className={cn(
              'absolute size-3.5 text-muted-foreground',
              isSheet ? 'top-0 right-4' : 'top-3 right-3',
            )}
            aria-label={savingMessage}
          />
        ) : null}
      </div>
      {selectedEntries.length > 0 ? (
        <div className="flex shrink-0 flex-wrap gap-1.5 px-4 pt-2">
          {selectedEntries.map((entry) =>
            isPendingCreateID(entry.id) ? (
              <Badge
                key={entry.id}
                variant="secondary"
                className={cn('max-w-full font-normal', isSheet && 'min-h-11')}
              >
                <span className="truncate">{entry.label}</span>
              </Badge>
            ) : entry.href ? (
              <Badge
                key={entry.id}
                variant="secondary"
                className={cn('relative max-w-full gap-1 pr-5 font-normal', isSheet && 'my-3')}
              >
                <Link className="truncate underline-offset-2 hover:underline" href={entry.href}>
                  {entry.label}
                </Link>
                <button
                  type="button"
                  className="absolute right-0 inline-flex size-5 items-center justify-center after:absolute after:-inset-x-1 after:-inset-y-3"
                  aria-label={`Remover ${entry.label}`}
                  onClick={() => toggle(entry.id, false)}
                >
                  <XIcon className="size-3 opacity-70" aria-hidden="true" />
                </button>
              </Badge>
            ) : (
              <button
                key={entry.id}
                type="button"
                className={cn('inline-flex items-center', isSheet && 'min-h-11')}
                aria-label={`Remover ${entry.label}`}
                onClick={() => toggle(entry.id, false)}
              >
                <Badge
                  variant="secondary"
                  className="max-w-full cursor-pointer gap-1 pr-1 font-normal hover:bg-destructive/15"
                >
                  <span className="truncate">{entry.label}</span>
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
          placeholder={searchPlaceholder}
          aria-label={searchLabel}
        />
        <CommandList>
          {filteredOptions.length === 0 ? (
            trimmedQuery.length >= 2 && trimmedQuery.length <= createMaxLength ? (
              <CommandItem
                value={`create-${trimmedQuery}`}
                className={isSheet ? 'min-h-11' : undefined}
                onSelect={() => create(trimmedQuery)}
              >
                <UserPlusIcon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{createLabel(trimmedQuery)}</span>
              </CommandItem>
            ) : (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                Nenhum resultado.
              </p>
            )
          ) : (
            filteredOptions.map((entry) => {
              const assigned = selectedSet.has(entry.id)
              return (
                <CommandItem
                  key={entry.id}
                  value={`relation-${entry.id}`}
                  data-checked={assigned}
                  className={isSheet ? 'min-h-11' : undefined}
                  onSelect={() => toggle(entry.id, !assigned)}
                >
                  <span className="truncate">
                    {entry.label}
                    {entry.optionSuffix ?? ''}
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
