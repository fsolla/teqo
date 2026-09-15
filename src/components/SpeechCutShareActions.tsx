'use client'

import { CheckIcon, CopyIcon, DownloadIcon } from 'lucide-react'

import { WhatsAppIcon } from '@/components/socialIcons'
import { Button } from '@/components/ui/button'
import { copyFeedbackLabels, copyFeedbackLiveMessages, useCopyFeedback } from '@/lib/copyFeedback'
import { buildSpeechCutShare } from '@/lib/speechCut'
import { cn } from '@/lib/utils'

type SpeechCutShareActionsProps = {
  /** Absolute public URL of the cut. */
  url: string
  title: string
  /** Stored MP4; absent while a cut is still being processed. */
  downloadUrl?: string | null
  downloadFilename?: string | null
  /** Which action leads on this surface (acervo: copy; public page: WhatsApp). */
  primary?: 'copy' | 'whatsapp'
  className?: string
}

/**
 * C167 — the share kit of a published cut, shared by the acervo result card and
 * the public page: copy the link, open the sender's WhatsApp (`wa.me`) and
 * download the same MP4 the page plays. The copy feedback lives next to the
 * button and resets on its own.
 */
export const SpeechCutShareActions = ({
  url,
  title,
  downloadUrl = null,
  downloadFilename = null,
  primary = 'copy',
  className,
}: SpeechCutShareActionsProps) => {
  const { feedback, copy } = useCopyFeedback()
  const share = buildSpeechCutShare({ title, url })

  return (
    <div
      className={cn('flex flex-wrap items-center gap-2', className)}
      data-slot="speech-cut-share"
    >
      {primary === 'whatsapp' ? (
        <Button asChild className="min-h-10">
          <a href={share.whatsAppUrl} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon data-icon="inline-start" />
            Compartilhar no WhatsApp
          </a>
        </Button>
      ) : null}
      <Button
        type="button"
        variant={primary === 'copy' ? 'default' : 'outline'}
        className="min-h-10"
        onClick={() => void copy(url)}
      >
        {feedback === 'copied' ? (
          <CheckIcon data-icon="inline-start" aria-hidden="true" />
        ) : (
          <CopyIcon data-icon="inline-start" aria-hidden="true" />
        )}
        {copyFeedbackLabels[feedback]}
      </Button>
      {primary === 'copy' ? (
        <Button asChild variant="outline" className="min-h-10">
          <a href={share.whatsAppUrl} target="_blank" rel="noopener noreferrer">
            <WhatsAppIcon data-icon="inline-start" />
            Compartilhar no WhatsApp
          </a>
        </Button>
      ) : null}
      {downloadUrl ? (
        <Button asChild variant="outline" className="min-h-10">
          <a href={downloadUrl} download={downloadFilename ?? ''}>
            <DownloadIcon data-icon="inline-start" aria-hidden="true" />
            Baixar arquivo (MP4)
          </a>
        </Button>
      ) : null}
      <span aria-live="polite" className="sr-only">
        {copyFeedbackLiveMessages[feedback]}
      </span>
    </div>
  )
}
