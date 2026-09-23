'use client'

import { CheckIcon, ChevronDownIcon, CopyIcon, Share2Icon } from 'lucide-react'
import { useState } from 'react'

import { MENU_POPOVER, MENU_ROW, SECONDARY_ACTION } from '@/components/shareLink/menuControls'
import { WhatsAppIcon } from '@/components/socialIcons'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { buildContentShareLink, buildContentShareWhatsAppUrl } from '@/lib/contentShare'
import { copyFeedbackLabels, copyFeedbackLiveMessages, useCopyFeedback } from '@/lib/copyFeedback'
import { shareLinkPath } from '@/lib/shareLink'
import { cn } from '@/lib/utils'

type ShareLinkShareMenuProps = {
  slug: string
  title: string
  className?: string
}

/**
 * S29 — "Compartilhar" (design cena 04): shares the short link itself (never
 * the destination URL) with the activity title — WhatsApp with a pre-filled
 * message, or copy to the clipboard with the standard feedback contract. The
 * short link keeps working even after the destination is swapped.
 */
export const ShareLinkShareMenu = ({ slug, title, className }: ShareLinkShareMenuProps) => {
  const [open, setOpen] = useState(false)
  const [origin] = useState(() => (typeof window === 'undefined' ? '' : window.location.origin))
  const { feedback, copy } = useCopyFeedback()

  const link = buildContentShareLink(shareLinkPath(slug), origin || shareLinkPath(slug))
  const whatsAppUrl = buildContentShareWhatsAppUrl('event', title, link)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={cn(SECONDARY_ACTION, className)}>
          <Share2Icon className="size-4" aria-hidden="true" />
          Compartilhar
          {open ? <ChevronDownIcon className="size-4" aria-hidden="true" /> : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="center"
        className={MENU_POPOVER}
        aria-label="Opções de compartilhamento"
      >
        <a
          href={whatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpen(false)}
          className={MENU_ROW}
        >
          <WhatsAppIcon className="size-5 flex-none text-[#25D366]" />
          Compartilhar no WhatsApp
        </a>
        <button
          type="button"
          onClick={() => {
            void copy(link)
          }}
          className={MENU_ROW}
        >
          {feedback === 'copied' ? (
            <CheckIcon className="size-5 flex-none text-green-600" aria-hidden="true" />
          ) : (
            <CopyIcon className="size-5 flex-none" aria-hidden="true" />
          )}
          {copyFeedbackLabels[feedback]}
        </button>
        <span aria-live="polite" className="sr-only">
          {copyFeedbackLiveMessages[feedback]}
        </span>
      </PopoverContent>
    </Popover>
  )
}
