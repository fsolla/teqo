import config from '@payload-config'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { SetCampaignPageChrome } from '@/components/campaign/shell/CampaignPageChromeContext'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { SpeechCutLibraryShareActions } from '@/components/campaign/speech/SpeechCutLibraryShareActions'
import { SpeechCutOriginCard } from '@/components/campaign/speech/SpeechCutOriginCard'
import { SpeechCutPlayer } from '@/components/campaign/speech/SpeechCutPlayer'
import { SpeechCutPublicationPanel } from '@/components/campaign/speech/SpeechCutPublicationPanel'
import { SpeechCutTextEditor } from '@/components/campaign/speech/SpeechCutTextEditor'
import { Button } from '@/components/ui/button'
import { campaignPageMetadata } from '@/lib/campaignPageChrome'
import { CAMPAIGN_COMMUNICATION_CORTES } from '@/lib/campaignPaths'
import { strictDecimalInteger } from '@/utilities/campaignListUrl'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  loadSpeechCutDetailPageData,
  SpeechCutNotFoundError,
} from '@/utilities/speech/speechCutPageData'

type SpeechCutDetailPageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: SpeechCutDetailPageProps) {
  const { id } = await params
  const cutId = strictDecimalInteger(id)
  if (!cutId) return campaignPageMetadata({ title: 'Corte' })

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'speechCatalog' }),
    getPayload({ config }),
  ])

  try {
    const cut = await loadSpeechCutDetailPageData(payload, user, cutId)
    return campaignPageMetadata({ title: cut.title })
  } catch {
    return campaignPageMetadata({ title: 'Corte' })
  }
}

/** C168 — one cut: player, origin speech, editable text and the kill switch. */
export default async function SpeechCutDetailPage({ params }: SpeechCutDetailPageProps) {
  const [{ id }, user, payload] = await Promise.all([
    params,
    requireCampaignPageActor({ gate: 'speechCatalog' }),
    getPayload({ config }),
  ])
  const cutId = strictDecimalInteger(id)
  if (!cutId) notFound()

  const cut = await loadSpeechCutDetailPageData(payload, user, cutId).catch((error) => {
    if (error instanceof SpeechCutNotFoundError) notFound()
    throw error
  })

  const notReady = cut.status === 'processing' || cut.status === 'failed'

  return (
    <CampaignPageShell>
      <SetCampaignPageChrome chrome={{ title: cut.title }} />

      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" className="-ml-2 min-h-10 self-start">
          <Link href={CAMPAIGN_COMMUNICATION_CORTES}>
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Voltar aos cortes
          </Link>
        </Button>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <h1 className="text-lg font-medium">{cut.title}</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Corte de {cut.durationLabel}
              {cut.createdAtLabel ? <> · criado em {cut.createdAtLabel}</> : null}
            </p>

            <div className="mt-4">
              <SpeechCutPlayer cut={cut} />
            </div>

            <div className="mt-3">
              <SpeechCutLibraryShareActions cut={cut} />
            </div>

            <div className="mt-6">
              <SpeechCutTextEditor
                cutId={cut.id}
                initialTitle={cut.title}
                initialDescription={cut.description}
                disabled={notReady}
              />
            </div>
          </div>

          <aside className="space-y-4">
            <SpeechCutOriginCard cut={cut} />
            <SpeechCutPublicationPanel cutId={cut.id} status={cut.status} />
          </aside>
        </div>
      </div>
    </CampaignPageShell>
  )
}
