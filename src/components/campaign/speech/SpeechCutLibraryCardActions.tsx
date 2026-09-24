'use client'

import { PlayIcon } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { SpeechCutDeleteDialog } from '@/components/campaign/speech/SpeechCutDeleteDialog'
import { SpeechCutRetryButton } from '@/components/campaign/speech/SpeechCutRetryButton'
import { CopyLinkButton } from '@/components/CopyLinkButton'
import {
  SpeechCutDownloadButton,
  SpeechCutWhatsAppButton,
} from '@/components/SpeechCutShareActions'
import { Button } from '@/components/ui/button'
import { campaignSpeechCutDetailHref } from '@/lib/campaignPaths'
import type { SpeechCutLibraryItemViewModel, SpeechCutStatus } from '@/lib/speechCut'

/**
 * C183 — the library card's action row: the recovery of a failed cut comes
 * first and full width on mobile (Cena D), then open/copy, with delete
 * isolated at the right (desktop) or full width (mobile published).
 *
 * C217 — a published cut leads with the productive kit the artifact shows
 * (copy link primary, download, WhatsApp, scene 04/06); opening the cut and
 * deleting stay as the management row below.
 */
const deleteTriggerClassName = (status: SpeechCutStatus): string =>
  status === 'published' ? 'w-full sm:ml-auto sm:w-auto' : 'flex-1 sm:ml-auto sm:flex-none'

export const SpeechCutLibraryCardActions = ({ cut }: { cut: SpeechCutLibraryItemViewModel }) => {
  const [absoluteUrl, setAbsoluteUrl] = useState('')

  useEffect(() => {
    setAbsoluteUrl(new URL(cut.publicPath, window.location.origin).toString())
  }, [cut.publicPath])

  const shareUrl = absoluteUrl || cut.publicPath

  return (
    <div className="mt-3 flex flex-col gap-2">
      {cut.status === 'published' ? (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <CopyLinkButton url={shareUrl} variant="default" className="col-span-2 sm:col-auto" />
          {cut.mediaUrl ? (
            <SpeechCutDownloadButton url={cut.mediaUrl} filename={cut.mediaFilename} compact />
          ) : null}
          <SpeechCutWhatsAppButton url={shareUrl} title={cut.title} variant="outline" compact />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {cut.status === 'failed' ? (
          <SpeechCutRetryButton cutId={cut.id} className="min-h-11 w-full sm:min-h-10 sm:w-auto" />
        ) : null}
        <Button asChild variant="outline" className="min-h-10 flex-1 sm:flex-none">
          <Link href={campaignSpeechCutDetailHref(cut.id)}>
            <PlayIcon data-icon="inline-start" aria-hidden="true" />
            Abrir corte
          </Link>
        </Button>
        <SpeechCutDeleteDialog
          cutId={cut.id}
          status={cut.status}
          publicPath={cut.publicPath}
          triggerClassName={deleteTriggerClassName(cut.status)}
        />
      </div>
    </div>
  )
}
