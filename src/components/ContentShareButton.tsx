'use client'

import { WhatsAppIcon } from '@/components/socialIcons'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import {
  buildContentShareLink,
  buildContentShareWhatsAppUrl,
  type ContentShareKind,
} from '@/lib/contentShare'
import { CheckIcon, CopyIcon, Share2Icon } from 'lucide-react'
import { useEffect, useState } from 'react'

const COPY_FEEDBACK_RESET_MS = 2000

type CopyFeedback = 'idle' | 'copied' | 'error'

const COPY_LABELS: Record<CopyFeedback, string> = {
  idle: 'Copiar link',
  copied: 'Link copiado',
  error: 'Não foi possível copiar',
}

const COPY_LIVE_MESSAGES: Record<CopyFeedback, string> = {
  idle: '',
  copied: 'Link copiado.',
  error: 'Não foi possível copiar o link.',
}

type ContentShareButtonProps = {
  kind: ContentShareKind
  title: string
  href: string
}

/**
 * Discreet per-card WhatsApp share control for the home content section (S4):
 * a small round button in the card corner opening a two-item popover — share
 * on WhatsApp with a pre-configured message (`wa.me` of the sender's own
 * WhatsApp, new tab with `noopener`) or copy the absolute link. It lives as a
 * sibling of the card anchor (never inside it — interactive inside an anchor
 * is invalid HTML), and the Popover portals its content so the mobile
 * carousel's `overflow-x-auto` track never clips it.
 */
export const ContentShareButton = ({ kind, title, href }: ContentShareButtonProps) => {
  const [open, setOpen] = useState(false)
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback>('idle')
  const [origin] = useState(() => (typeof window === 'undefined' ? '' : window.location.origin))

  useEffect(() => {
    if (copyFeedback === 'idle') return
    const reset = setTimeout(() => setCopyFeedback('idle'), COPY_FEEDBACK_RESET_MS)
    return () => clearTimeout(reset)
  }, [copyFeedback])

  const link = buildContentShareLink(href, origin || href)
  const whatsAppUrl = buildContentShareWhatsAppUrl(kind, title, link)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setCopyFeedback('copied')
    } catch {
      setCopyFeedback('error')
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Compartilhar"
          className="absolute top-2 right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:outline-none"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-(--campaign-ink) shadow transition-colors hover:bg-(--campaign-band)">
            <Share2Icon className="size-4" aria-hidden="true" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1">
        <a
          href={whatsAppUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setOpen(false)}
          className="flex min-h-11 items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-(--campaign-ink) hover:bg-(--campaign-band) focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:outline-none"
        >
          <WhatsAppIcon className="size-4 text-[#25D366]" />
          Compartilhar no WhatsApp
        </a>
        <button
          type="button"
          onClick={copyLink}
          className="flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-sm font-medium text-(--campaign-ink) hover:bg-(--campaign-band) focus-visible:ring-2 focus-visible:ring-(--pt-red) focus-visible:outline-none"
        >
          {copyFeedback === 'copied' ? (
            <CheckIcon className="size-4 text-green-600" aria-hidden="true" />
          ) : (
            <CopyIcon className="size-4" aria-hidden="true" />
          )}
          {COPY_LABELS[copyFeedback]}
        </button>
        <span aria-live="polite" className="sr-only">
          {COPY_LIVE_MESSAGES[copyFeedback]}
        </span>
      </PopoverContent>
    </Popover>
  )
}
