'use client'

import { DownloadIcon } from 'lucide-react'

import { CopyLinkButton } from '@/components/CopyLinkButton'
import { WhatsAppIcon } from '@/components/socialIcons'
import { Button } from '@/components/ui/button'
import { buildSpeechCutShare } from '@/lib/speechCut'
import { cn } from '@/lib/utils'

type SpeechCutWhatsAppButtonProps = {
  /** Absolute public URL of the cut. */
  url: string
  title: string
  variant?: 'default' | 'outline'
  className?: string
}

/**
 * C176 — the WhatsApp CTA of the cut surfaces, extracted from the share kit so
 * the public page can place it on its own (full-width, above the description on
 * mobile) without duplicating the shared message/URL.
 */
export const SpeechCutWhatsAppButton = ({
  url,
  title,
  variant = 'default',
  className,
}: SpeechCutWhatsAppButtonProps) => {
  const share = buildSpeechCutShare({ title, url })

  return (
    <Button asChild variant={variant} className={cn('min-h-10', className)}>
      <a href={share.whatsAppUrl} target="_blank" rel="noopener noreferrer">
        <WhatsAppIcon data-icon="inline-start" />
        Compartilhar no WhatsApp
      </a>
    </Button>
  )
}

type SpeechCutDownloadButtonProps = {
  /** Stored MP4; absent while a cut is still being processed. */
  url: string
  filename?: string | null
  className?: string
}

/** C176 — the MP4 download control, extracted for the same reason as the WhatsApp one. */
export const SpeechCutDownloadButton = ({
  url,
  filename = null,
  className,
}: SpeechCutDownloadButtonProps) => (
  <Button asChild variant="outline" className={cn('min-h-10', className)}>
    <a href={url} download={filename ?? ''}>
      <DownloadIcon data-icon="inline-start" aria-hidden="true" />
      Baixar arquivo (MP4)
    </a>
  </Button>
)

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
  /** Per-control sizing/extra classes (the public page asks for 44px controls). */
  controlClassName?: string
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
  controlClassName,
}: SpeechCutShareActionsProps) => (
  <div className={cn('flex flex-wrap items-center gap-2', className)} data-slot="speech-cut-share">
    {primary === 'whatsapp' ? (
      <SpeechCutWhatsAppButton url={url} title={title} className={controlClassName} />
    ) : null}
    <CopyLinkButton
      url={url}
      variant={primary === 'copy' ? 'default' : 'outline'}
      className={controlClassName}
    />
    {primary === 'copy' ? (
      <SpeechCutWhatsAppButton
        url={url}
        title={title}
        variant="outline"
        className={controlClassName}
      />
    ) : null}
    {downloadUrl ? (
      <SpeechCutDownloadButton
        url={downloadUrl}
        filename={downloadFilename}
        className={controlClassName}
      />
    ) : null}
  </div>
)
