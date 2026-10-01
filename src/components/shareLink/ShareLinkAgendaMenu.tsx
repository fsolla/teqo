'use client'

import { CalendarPlusIcon, ChevronDownIcon } from 'lucide-react'
import { useState } from 'react'

import { MENU_POPOVER, MENU_ROW, SECONDARY_ACTION } from '@/components/shareLink/menuControls'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { buildGoogleCalendarEventUrl } from '@/lib/calendarEvent'
import { shareLinkIcsPath } from '@/lib/shareLink'

type ShareLinkAgendaMenuProps = {
  slug: string
  title: string
  description: string
  location: string | null
  canonicalUrl: string | null
  startsAt: string | null
  endsAt: string | null
  /**
   * S44 — the home section's agenda is the primary action (yellow CTA), while
   * the announcement page keeps the secondary outline. Default preserves the
   * S29 look.
   */
  triggerClassName?: string
}

/**
 * S29 — "Adicionar à agenda" (design cena 04): Google Agenda (a prefilled
 * `action=TEMPLATE` URL) and the server-generated `.ics` download. Without a
 * start date the whole control disappears — never an empty/disabled option.
 */
export const ShareLinkAgendaMenu = ({
  slug,
  title,
  description,
  location,
  canonicalUrl,
  startsAt,
  endsAt,
  triggerClassName = SECONDARY_ACTION,
}: ShareLinkAgendaMenuProps) => {
  const [open, setOpen] = useState(false)

  const googleUrl = startsAt
    ? buildGoogleCalendarEventUrl({
        title,
        description,
        location,
        url: canonicalUrl,
        startsAt,
        endsAt,
      })
    : null
  if (!googleUrl) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={triggerClassName}>
          <CalendarPlusIcon className="size-4" aria-hidden="true" />
          Adicionar à agenda
          {open ? <ChevronDownIcon className="size-4" aria-hidden="true" /> : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        side="bottom"
        sideOffset={8}
        collisionPadding={12}
        className={MENU_POPOVER}
        aria-label="Opções de agenda"
      >
        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpen(false)}
          className={MENU_ROW}
        >
          <span
            aria-hidden="true"
            className="grid size-7 flex-none place-items-center rounded bg-[#4285f4] text-xs font-bold text-white"
          >
            G
          </span>
          <span>
            Google Agenda
            <small className="mt-0.5 block text-[11px] font-normal text-black/45">
              Abrir evento preenchido
            </small>
          </span>
        </a>
        <a
          href={shareLinkIcsPath(slug)}
          download
          onClick={() => setOpen(false)}
          className={MENU_ROW}
        >
          <CalendarPlusIcon className="size-5 flex-none text-(--pt-red)" aria-hidden="true" />
          <span>
            Baixar arquivo .ics
            <small className="mt-0.5 block text-[11px] font-normal text-black/45">
              Apple, Outlook e desktop
            </small>
          </span>
        </a>
      </PopoverContent>
    </Popover>
  )
}
