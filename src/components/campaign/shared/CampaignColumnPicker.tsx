'use client'

import { Columns3Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { useCampaignListTransition } from '@/components/campaign/shared/CampaignListPending'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import {
  CAMPAIGN_COLUMNS_COOKIE,
  CAMPAIGN_COLUMNS_COOKIE_MAX_AGE,
  CAMPAIGN_COLUMNS_COOKIE_PATH,
  parseCampaignHiddenColumns,
  serializeCampaignHiddenColumns,
  toggleHiddenColumn,
  type CampaignListId,
} from '@/lib/campaignColumnVisibility'
import { sameIdSet } from '@/lib/sameIdSet'

type CampaignColumnPickerColumn = {
  id: string
  label: string
  mandatory?: boolean
}

type CampaignColumnPickerProps = {
  listId: CampaignListId
  /** Every column of the table, hidden ones included — this is the menu. */
  columns: readonly CampaignColumnPickerColumn[]
  /** Server truth: what this device has hidden on this list. */
  hiddenColumnIds: readonly string[]
}

/**
 * Closing the menu is what commits — an editing session is one navigation, not
 * one per checkbox. A 400 ms debounce only ever batched clicks faster than
 * reading the label between them, and each miss re-runs the whole route: on
 * `/campanha/liderancas` that is the ~229 ms / 371-statement render ledgered as
 * P1. This timer is the safety net for a menu left open, not the commit path.
 * It reads a ref, never the state of the render that scheduled it — the
 * `setTimeout`-captures-stale-state bug B33+ pinned across the list filters.
 */
const COMMIT_IDLE_MS = 3_000

const readCookie = () =>
  parseCampaignHiddenColumns(
    document.cookie
      .split('; ')
      .find((entry) => entry.startsWith(`${CAMPAIGN_COLUMNS_COOKIE}=`))
      ?.slice(CAMPAIGN_COLUMNS_COOKIE.length + 1),
  )

const writeCookie = (listId: CampaignListId, hiddenColumnIds: readonly string[]) => {
  // Re-read before writing: one cookie carries every list, and another tab may
  // have changed a different one since this page rendered.
  const next = { ...readCookie(), [listId]: [...hiddenColumnIds] }

  document.cookie = [
    `${CAMPAIGN_COLUMNS_COOKIE}=${serializeCampaignHiddenColumns(next)}`,
    `path=${CAMPAIGN_COLUMNS_COOKIE_PATH}`,
    `max-age=${CAMPAIGN_COLUMNS_COOKIE_MAX_AGE}`,
    'samesite=lax',
    // Matches `campaignCookieOptions`; keyed off the protocol rather than
    // NODE_ENV because `secure` on plain http silently drops the write.
    ...(window.location.protocol === 'https:' ? ['secure'] : []),
  ].join('; ')
}

export const CampaignColumnPicker = ({
  listId,
  columns,
  hiddenColumnIds,
}: CampaignColumnPickerProps) => {
  const router = useRouter()
  // Only the transition — the busy state belongs to `CampaignListResults`,
  // which wraps this table and already dims and marks itself `aria-busy`.
  const { startTransition } = useCampaignListTransition()
  const [open, setOpen] = useState(false)
  const [hidden, setHidden] = useState<string[]>(() => [...hiddenColumnIds])
  const [serverIds, setServerIds] = useState<readonly string[]>(hiddenColumnIds)
  const latestHidden = useRef(hidden)
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The server is the source of truth: once its payload catches up, it wins.
  // But never over an edit that has not been written yet — the payload of
  // toggle A lands while B is still in the debounce window, and adopting it
  // there would roll B back and then commit the rolled-back set, losing it.
  // Same policy as `useCampaignListFilterNavigation`, where a pending debounce
  // outranks the URL; `sameIdSet` is the shared "did the server really change".
  if (!sameIdSet(serverIds, hiddenColumnIds) && commitTimer.current === null) {
    setServerIds(hiddenColumnIds)
    setHidden([...hiddenColumnIds])
    latestHidden.current = [...hiddenColumnIds]
  }

  useEffect(
    () => () => {
      if (commitTimer.current) clearTimeout(commitTimer.current)
    },
    [],
  )

  const commit = () => {
    if (commitTimer.current) {
      clearTimeout(commitTimer.current)
      commitTimer.current = null
    }
    writeCookie(listId, latestHidden.current)
    startTransition(() => {
      router.refresh()
    })
  }

  const apply = (next: string[]) => {
    // Advance the ref synchronously: two toggles batched into one tick must not
    // drop each other, and the debounced commit reads the ref.
    latestHidden.current = next
    setHidden(next)

    if (commitTimer.current) clearTimeout(commitTimer.current)
    commitTimer.current = setTimeout(commit, COMMIT_IDLE_MS)
  }

  const toggle = (columnId: string, visible: boolean) => {
    apply(toggleHiddenColumn(latestHidden.current, columnId, visible))
  }

  const hiddenSet = new Set(hidden)
  const hiddenCount = columns.filter(
    (column) => !column.mandatory && hiddenSet.has(column.id),
  ).length
  const headingId = `${listId}-column-picker`

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        // Closing is the commit: the whole session lands in one refresh.
        if (!next && commitTimer.current) commit()
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="lg"
          aria-label={
            hiddenCount
              ? `Mostrar ou ocultar colunas. ${hiddenCount} oculta${hiddenCount > 1 ? 's' : ''}`
              : 'Mostrar ou ocultar colunas'
          }
        >
          <Columns3Icon aria-hidden="true" />
          Colunas
          {hiddenCount ? (
            <span className="text-muted-foreground tabular-nums">({hiddenCount})</span>
          ) : null}
        </Button>
      </PopoverTrigger>
      {/* Radix gives the content `role="dialog"` and no name — same reason
          `CampaignCellEditOverlay` labels its own. */}
      <PopoverContent align="end" aria-label="Mostrar colunas" className="w-64 p-2">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <p id={headingId} className="text-xs font-medium text-muted-foreground">
            Mostrar colunas
          </p>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            disabled={hiddenCount === 0}
            onClick={() => apply([])}
          >
            Restaurar todas
          </Button>
        </div>
        <div
          role="group"
          aria-labelledby={headingId}
          className="flex max-h-80 flex-col gap-0.5 overflow-y-auto"
        >
          {columns.map((column) => {
            const checkboxId = `${listId}-column-${column.id}`

            return (
              <label
                key={column.id}
                htmlFor={checkboxId}
                className="flex min-h-11 items-center gap-2 rounded-md px-2 text-sm hover:bg-muted has-disabled:hover:bg-transparent"
              >
                <Checkbox
                  id={checkboxId}
                  checked={column.mandatory || !hiddenSet.has(column.id)}
                  disabled={column.mandatory}
                  onCheckedChange={(next) => toggle(column.id, next === true)}
                />
                <span className="min-w-0 flex-1 whitespace-normal">{column.label}</span>
                {column.mandatory ? (
                  <span className="text-xs text-muted-foreground">sempre visível</span>
                ) : null}
              </label>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
