import config from '@payload-config'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { RecordingDeleteDialog } from '@/components/campaign/recording/RecordingDeleteDialog'
import { RecordingDetailPlayer } from '@/components/campaign/recording/RecordingDetailPlayer'
import { RecordingStatusBadge } from '@/components/campaign/recording/RecordingStatusBadge'
import { RecordingStatusRefresher } from '@/components/campaign/recording/RecordingStatusRefresher'
import { SetCampaignPageChrome } from '@/components/campaign/shell/CampaignPageChromeContext'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Button } from '@/components/ui/button'
import { campaignPageMetadata } from '@/lib/campaignPageChrome'
import { parseSeekSeconds } from '@/lib/speechClock'
import { firstValue, strictDecimalInteger } from '@/utilities/campaignListUrl'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { buildAcervoSourceHref } from '@/utilities/recordings/recordingListUrl'
import {
  loadRecordingDetailPageData,
  loadRecordingTitleForActor,
  RecordingNotFoundError,
} from '@/utilities/recordings/recordingPageData'

type RecordingDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: RecordingDetailPageProps) {
  const { id } = await params
  const recordingId = strictDecimalInteger(id)
  if (!recordingId) return campaignPageMetadata({ title: 'Gravação enviada' })

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'communicationCatalog' }),
    getPayload({ config }),
  ])

  try {
    const title = await loadRecordingTitleForActor(payload, user, recordingId)
    return campaignPageMetadata({ title: title ?? 'Gravação enviada' })
  } catch {
    return campaignPageMetadata({ title: 'Gravação enviada' })
  }
}

/**
 * C199 — one uploaded recording: the private player, the clickable transcript,
 * the download, the retry of a failed transcription and the delete confirmation
 * (the only place delete lives).
 */
export default async function RecordingDetailPage({
  params,
  searchParams,
}: RecordingDetailPageProps) {
  const [{ id }, query, user, payload] = await Promise.all([
    params,
    searchParams,
    requireCampaignPageActor({ gate: 'communicationCatalog' }),
    getPayload({ config }),
  ])
  const recordingId = strictDecimalInteger(id)
  if (!recordingId) notFound()

  const recording = await loadRecordingDetailPageData(
    payload,
    user,
    recordingId,
    firstValue(query.q)?.trim() || undefined,
  ).catch((error) => {
    if (error instanceof RecordingNotFoundError) notFound()
    throw error
  })

  const initialSeconds = parseSeekSeconds(firstValue(query.t))
  const metaLine = [recording.recordedAtLabel ?? 'Sem data', recording.durationLabel]
    .filter(Boolean)
    .join(' · ')

  return (
    <CampaignPageShell>
      <SetCampaignPageChrome chrome={{ title: 'Gravação enviada', subtitle: 'Acervo' }} />
      <RecordingStatusRefresher recordings={[{ id: recording.id, status: recording.status }]} />

      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" className="-ml-2 min-h-11 self-start">
          <Link href={buildAcervoSourceHref('enviadas')}>
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Voltar ao acervo
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
          {/* Title first, date below, status lateral — the approved hierarchy
              (scenes 3 and 13). */}
          <div className="min-w-0">
            <h1 className="text-lg font-medium">{recording.title}</h1>
            <p className="mt-1 text-xs text-muted-foreground">{metaLine}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <RecordingStatusBadge status={recording.status} />
            <div className="hidden md:block">
              <RecordingDeleteDialog
                recordingId={recording.id}
                redirectTo={buildAcervoSourceHref('enviadas')}
              />
            </div>
          </div>
        </div>

        <RecordingDetailPlayer
          recordingId={recording.id}
          status={recording.status}
          fileHref={recording.fileHref}
          downloadHref={recording.downloadHref}
          failureMessage={recording.failureMessage}
          segments={recording.segments}
          speakerGroups={recording.speakerGroups}
          speakerLabelsDropped={recording.speakerLabelsDropped}
          initialSeconds={initialSeconds}
        />

        {/* Mobile keeps the destructive action after the player and the
            download, as a ghost action (approved scene 13). */}
        <div className="md:hidden">
          <RecordingDeleteDialog
            recordingId={recording.id}
            redirectTo={buildAcervoSourceHref('enviadas')}
            triggerClassName="w-full"
          />
        </div>
      </div>
    </CampaignPageShell>
  )
}
