'use client'

import { CheckIcon, ChevronDownIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { CampaignTransitionAnchor } from '@/components/campaign/shared/CampaignListPending'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { useNarrowMeasured } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import {
  activityAgendaViewLabels,
  activityAgendaViews,
  buildActivityAgendaHref,
  type ActivityAgendaState,
  type ActivityAgendaView,
} from '@/utilities/activityUi'

/**
 * Mirrors the calendar's own mobile fallback (`MOBILE_BREAKPOINT_PX` in
 * `ActivityAgenda`): the selector's fallback label must agree with the view the
 * calendar will pick on a narrow screen.
 */
const NARROW_VIEWPORT_PX = 640

/**
 * C95 — the agenda-contextual view-mode selector rendered inside the app
 * header (desktop cluster / mobile top bar). Registered by `AgendaViewChrome`,
 * so it lives outside the page tree but navigates with the page's own URL
 * contract (`buildActivityAgendaHref`) and the shared list transition.
 */
export const AgendaViewSelector = ({ state }: { state: ActivityAgendaState }) => {
  const [open, setOpen] = useState(false)
  const { isNarrow, measured } = useNarrowMeasured(NARROW_VIEWPORT_PX)
  const effectiveView: ActivityAgendaView = state.view ?? (measured && isNarrow ? 'day' : 'week')

  const options = useMemo(
    () =>
      activityAgendaViews.map((view) => ({
        view,
        href: buildActivityAgendaHref({ ...state, view }),
      })),
    [state],
  )

  const moveFocus = (event: React.KeyboardEvent<HTMLElement>, fromIndex: number) => {
    const direction =
      event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'Home' ? -2 : 0
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitemradio"]'),
    )
    if (items.length === 0) return
    let next: number
    if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = items.length - 1
    else if (direction !== 0) next = (fromIndex + direction + items.length) % items.length
    else return
    items[next]?.focus()
    event.preventDefault()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Modo de visualização: ${activityAgendaViewLabels[effectiveView]}`}
          aria-expanded={open}
          aria-haspopup="menu"
          className={cn(
            'inline-flex h-9 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-medium',
            'text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground',
            'md:text-foreground md:hover:bg-muted md:hover:text-foreground',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
        >
          {activityAgendaViewLabels[effectiveView]}
          <ChevronDownIcon className="size-4" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-44 p-1.5">
        <nav
          role="menu"
          aria-label="Modo de visualização"
          className="flex flex-col gap-0.5"
          onKeyDown={(event) => {
            const current = event.currentTarget.querySelector<HTMLElement>(
              '[role="menuitemradio"]:focus, [role="menuitemradio"][aria-checked="true"]',
            )
            const index = Array.from(
              event.currentTarget.querySelectorAll('[role="menuitemradio"]'),
            ).indexOf(current as HTMLElement)
            moveFocus(event, index >= 0 ? index : 0)
          }}
        >
          {options.map(({ view, href }) => {
            const selected = view === effectiveView
            return (
              <CampaignTransitionAnchor
                key={view}
                href={href}
                replace
                scroll={false}
                role="menuitemradio"
                aria-checked={selected}
                className={cn(
                  'flex min-h-10 items-center gap-2 rounded-md px-2 text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selected && 'bg-muted font-medium',
                )}
                onNavigate={() => setOpen(false)}
              >
                <span className="flex-1">{activityAgendaViewLabels[view]}</span>
                {selected ? <CheckIcon className="size-4" aria-hidden="true" /> : null}
              </CampaignTransitionAnchor>
            )
          })}
        </nav>
      </PopoverContent>
    </Popover>
  )
}
