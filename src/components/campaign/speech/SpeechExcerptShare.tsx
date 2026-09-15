'use client'

import { CheckIcon, CopyIcon, Share2Icon } from 'lucide-react'
import { useState } from 'react'

import { WhatsAppIcon } from '@/components/socialIcons'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/Sheet'
import { useCoarsePointer } from '@/lib/campaignCoarsePointer'
import { copyFeedbackLabels, copyFeedbackLiveMessages, useCopyFeedback } from '@/lib/copyFeedback'
import { buildSpeechExcerptShare } from '@/lib/speechShare'

type SpeechExcerptShareProps = {
  videoId: string
  /** Session offset in seconds; null makes the link open at the session start. */
  offsetSeconds: number | null
  startSeconds: number
  endSeconds: number
  speechType: string | null
  dateLabel: string
}

const OPTION_CLASS =
  'flex min-h-11 w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'

/**
 * C166 — the excerpt share control: one "Compartilhar" action with exactly two
 * options (copy the ready message with the interval + link, or open the
 * sender's own WhatsApp via `wa.me`). The message is what circulates because
 * YouTube cannot encode the excerpt end. Popover on fine pointers, bottom sheet
 * on coarse ones; the copy feedback lives in the option row (local state), so
 * it never covers the control and vanishes on its own.
 */
export const SpeechExcerptShare = ({
  videoId,
  offsetSeconds,
  startSeconds,
  endSeconds,
  speechType,
  dateLabel,
}: SpeechExcerptShareProps) => {
  const isCoarsePointer = useCoarsePointer()
  const [open, setOpen] = useState(false)
  const { feedback, copy } = useCopyFeedback()

  const share = buildSpeechExcerptShare({
    videoId,
    offsetSeconds,
    startSeconds,
    endSeconds,
    speechType,
    dateLabel,
  })

  const trigger = (onClick?: () => void, expanded?: boolean) => (
    <Button
      type="button"
      className="min-h-10"
      onClick={onClick}
      aria-haspopup="dialog"
      aria-expanded={expanded}
    >
      <Share2Icon data-icon="inline-start" aria-hidden="true" />
      Compartilhar
    </Button>
  )

  const options = (
    <div data-slot="speech-excerpt-share-options">
      <button type="button" onClick={() => void copy(share.message)} className={OPTION_CLASS}>
        {feedback === 'copied' ? (
          <CheckIcon className="size-4 text-emerald-600" aria-hidden="true" />
        ) : (
          <CopyIcon className="size-4" aria-hidden="true" />
        )}
        {copyFeedbackLabels[feedback]}
      </button>
      <a
        href={share.whatsAppUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => setOpen(false)}
        className={OPTION_CLASS}
      >
        <WhatsAppIcon className="size-4 text-[#25D366]" />
        Enviar no WhatsApp
      </a>
      <p className="border-t px-2 py-2 text-[11px] leading-relaxed break-words text-muted-foreground">
        {share.message}
      </p>
      {offsetSeconds === null ? (
        <p className="px-2 pb-2 text-[11px] text-muted-foreground">
          O link abre o vídeo no início da sessão.
        </p>
      ) : null}
      <span aria-live="polite" className="sr-only">
        {copyFeedbackLiveMessages[feedback]}
      </span>
    </div>
  )

  if (isCoarsePointer) {
    return (
      <div data-slot="speech-excerpt-share">
        {trigger(() => setOpen(true), open)}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="gap-2 px-2 pb-4">
            <SheetHeader>
              <SheetTitle>Compartilhar trecho</SheetTitle>
              <SheetDescription>O link abre o vídeo no ponto escolhido.</SheetDescription>
            </SheetHeader>
            {options}
          </SheetContent>
        </Sheet>
      </div>
    )
  }

  return (
    <div data-slot="speech-excerpt-share">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger()}</PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-1">
          {options}
        </PopoverContent>
      </Popover>
    </div>
  )
}
