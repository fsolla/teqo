'use client'

import { PlayIcon } from 'lucide-react'
import Link from 'next/link'

import { SpeechCutDeleteDialog } from '@/components/campaign/speech/SpeechCutDeleteDialog'
import { SpeechCutRetryButton } from '@/components/campaign/speech/SpeechCutRetryButton'
import { CopyLinkButton } from '@/components/CopyLinkButton'
import { Button } from '@/components/ui/button'
import { campaignSpeechCutDetailHref } from '@/lib/campaignPaths'
import type { SpeechCutLibraryItemViewModel, SpeechCutStatus } from '@/lib/speechCut'

/**
 * C183 — the library card's action row: the recovery of a failed cut comes
 * first and full width on mobile (Cena D), then open/copy, with delete
 * isolated at the right (desktop) or full width (mobile published).
 */
const deleteTriggerClassName = (status: SpeechCutStatus): string =>
  status === 'published' ? 'w-full sm:ml-auto sm:w-auto' : 'flex-1 sm:ml-auto sm:flex-none'

export const SpeechCutLibraryCardActions = ({ cut }: { cut: SpeechCutLibraryItemViewModel }) => (
  <div className="mt-3 flex flex-wrap items-center gap-2">
    {cut.status === 'failed' ? (
      <SpeechCutRetryButton cutId={cut.id} className="min-h-11 w-full sm:min-h-10 sm:w-auto" />
    ) : null}
    <Button asChild variant="outline" className="min-h-10 flex-1 sm:flex-none">
      <Link href={campaignSpeechCutDetailHref(cut.id)}>
        <PlayIcon data-icon="inline-start" aria-hidden="true" />
        Abrir corte
      </Link>
    </Button>
    {cut.status === 'published' ? (
      <CopyLinkButton url={cut.publicPath} variant="ghost" className="flex-1 sm:flex-none" />
    ) : null}
    <SpeechCutDeleteDialog
      cutId={cut.id}
      status={cut.status}
      publicPath={cut.publicPath}
      triggerClassName={deleteTriggerClassName(cut.status)}
    />
  </div>
)
