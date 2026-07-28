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
 * Closing the menu is what refreshes the table — an editing session is one
 * navigation, not one per checkbox, because each refresh re-runs the whole
 * route (on `/campanha/liderancas`, the ~229 ms / 371-statement render ledgered
 * as P1).
 *
 * The timer exists so a menu left open does not lose the choice, and it writes
 * the cookie WITHOUT refreshing. Any timer that also refreshed would recreate
 * the per-toggle cost at a slower pace: three seconds is an ordinary gap
 * between clicks when the labels are being read. Durability and repaint are
 * separate questions, so they get separate triggers.
 *
 * It reads refs, never the state of the render that scheduled it — the
 * `setTimeout`-captures-stale-state bug B33+ pinned across the list filters.
 */
const PERSIST_IDLE_MS = 3_000

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
  const [hidden, setHidden] = useState<string[]>(() => [...hiddenColumnIds])
  const [serverIds, setServerIds] = useState<readonly string[]>(hiddenColumnIds)
  const latestHidden = useRef(hidden)
  /** What the cookie already holds, so an undone edit writes nothing. */
  const persistedIds = useRef<readonly string[]>(hiddenColumnIds)
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // The server is the source of truth: once its payload catches up, it wins.
  // But never over an edit that has not been written yet — the payload of
  // toggle A lands while B is still in the debounce window, and adopting it
  // there would roll B back and then commit the rolled-back set, losing it.
  // Same policy as `useCampaignListFilterNavigation`, where a pending debounce
  // outranks the URL; `sameIdSet` is the shared "did the server really change".
  if (!sameIdSet(serverIds, hiddenColumnIds) && persistTimer.current === null) {
    setServerIds(hiddenColumnIds)
    setHidden([...hiddenColumnIds])
    latestHidden.current = [...hiddenColumnIds]
    // The payload we just adopted was rendered FROM the cookie, so it is also
    // what the cookie holds — otherwise the next write would look redundant.
    persistedIds.current = hiddenColumnIds
  }

  // A menu still open when the route unmounts (sidebar navigation) never gets
  // its close event, so the cookie is written here instead. No refresh: the
  // navigation already renders the next route, which reads the cookie.
  useEffect(
    () => () => {
      if (!persistTimer.current) return
      clearTimeout(persistTimer.current)
      if (sameIdSet(persistedIds.current, latestHidden.current)) return
      writeCookie(listId, latestHidden.current)
    },
    [listId],
  )

  /** Durability, on its own: the cookie only, never a repaint. */
  const persist = () => {
    if (persistTimer.current) {
      clearTimeout(persistTimer.current)
      persistTimer.current = null
    }
    if (sameIdSet(persistedIds.current, latestHidden.current)) return
    persistedIds.current = latestHidden.current
    writeCookie(listId, latestHidden.current)
  }

  const commit = () => {
    persist()
    // Toggling a column and undoing it inside one session leaves the rendered
    // table already correct; refreshing it would re-pay the route for nothing.
    if (sameIdSet(serverIds, latestHidden.current)) return
    startTransition(() => {
      router.refresh()
    })
  }

  const apply = (next: string[]) => {
    // Advance the ref synchronously: two toggles batched into one tick must not
    // drop each other, and the timer reads the ref.
    latestHidden.current = next
    setHidden(next)

    if (persistTimer.current) clearTimeout(persistTimer.current)
    persistTimer.current = setTimeout(persist, PERSIST_IDLE_MS)
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
      onOpenChange={(next) => {
        // Closing is the commit: the whole session lands in one refresh. Both
        // halves of `commit` are guarded, so a close with nothing pending — or
        // one fired by a layer sweep rather than by the user — costs nothing.
        if (!next) commit()
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
