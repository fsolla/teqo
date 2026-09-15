'use client'

import { DownloadIcon, ExternalLinkIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

import { SpeechCutShareActions } from '@/components/SpeechCutShareActions'
import { Button } from '@/components/ui/button'
import type { SpeechCutLibraryItemViewModel } from '@/lib/speechCut'

/**
 * C168 — the detail's actions. A published cut shares the public `/corte/<id>`
 * link (copy/WhatsApp/download) and opens it; an unpublished one only offers
 * the stored MP4, since the link is intentionally dead until republished.
 */
export const SpeechCutLibraryShareActions = ({ cut }: { cut: SpeechCutLibraryItemViewModel }) => {
  const [absoluteUrl, setAbsoluteUrl] = useState('')

  useEffect(() => {
    setAbsoluteUrl(new URL(cut.publicPath, window.location.origin).toString())
  }, [cut.publicPath])

  if (cut.status === 'published') {
    return (
      <div className="flex flex-col gap-2">
        <SpeechCutShareActions
          url={absoluteUrl || cut.publicPath}
          title={cut.title}
          downloadUrl={cut.mediaUrl}
          downloadFilename={cut.mediaFilename}
          primary="copy"
        />
        <div>
          <Button asChild variant="outline" className="min-h-10">
            <a href={cut.publicPath} target="_blank" rel="noopener noreferrer">
              <ExternalLinkIcon data-icon="inline-start" aria-hidden="true" />
              Abrir página pública
            </a>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          O link compartilhado é o mesmo da página pública:{' '}
          <span className="font-mono">{cut.publicPath}</span>
        </p>
      </div>
    )
  }

  if (!cut.mediaUrl) return null

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button asChild variant="outline" className="min-h-10">
          <a href={cut.mediaUrl} download={cut.mediaFilename ?? ''}>
            <DownloadIcon data-icon="inline-start" aria-hidden="true" />
            Baixar arquivo (MP4)
          </a>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        O link público está desativado — publique para compartilhar de novo.
      </p>
    </div>
  )
}
