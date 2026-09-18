import config from '@payload-config'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { SetCampaignPageChrome } from '@/components/campaign/shell/CampaignPageChromeContext'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { SpeechCutDeleteDialog } from '@/components/campaign/speech/SpeechCutDeleteDialog'
import { SpeechCutLibraryShareActions } from '@/components/campaign/speech/SpeechCutLibraryShareActions'
import { SpeechCutOriginCard } from '@/components/campaign/speech/SpeechCutOriginCard'
import { SpeechCutPlayer } from '@/components/campaign/speech/SpeechCutPlayer'
import { SpeechCutPublicationPanel } from '@/components/campaign/speech/SpeechCutPublicationPanel'
import { SpeechCutRetryButton } from '@/components/campaign/speech/SpeechCutRetryButton'
import { SpeechCutStatusBadge } from '@/components/campaign/speech/SpeechCutStatusBadge'
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
    requireCampaignPageActor({ gate: 'communicationCatalog' }),
    getPayload({ config }),
  ])

  try {
    const cut = await loadSpeechCutDetailPageData(payload, user, cutId)
    return campaignPageMetadata({ title: cut.title })
  } catch {
    return campaignPageMetadata({ title: 'Corte' })
  }
}

/**
 * C168 — one cut: player, origin speech, editable text and the kill switch.
 * C183 — the header carries the recovery of a failed cut ("Tentar novamente")
 * and the delete, the same actions the library card exposes.
 */
export default async function SpeechCutDetailPage({ params }: SpeechCutDetailPageProps) {
  const [{ id }, user, payload] = await Promise.all([
    params,
    requireCampaignPageActor({ gate: 'communicationCatalog' }),
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

        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <SpeechCutStatusBadge status={cut.status} />
              <span className="text-xs text-muted-foreground">
                Corte de {cut.durationLabel}
                {cut.createdAtLabel ? <> · criado em {cut.createdAtLabel}</> : null}
              </span>
            </div>
            <h1 className="mt-2 text-lg font-medium">{cut.title}</h1>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 max-sm:w-full">
            {cut.status === 'failed' ? (
              <SpeechCutRetryButton cutId={cut.id} className="min-h-11 max-sm:w-full" />
            ) : null}
            <SpeechCutDeleteDialog
              cutId={cut.id}
              status={cut.status}
              publicPath={cut.publicPath}
              redirectTo={CAMPAIGN_COMMUNICATION_CORTES}
              triggerClassName="min-h-11 max-sm:w-full"
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <SpeechCutPlayer cut={cut} />

            <div className="mt-3">
              <SpeechCutLibraryShareActions cut={cut} />
            </div>

            <div className="mt-6">
              {notReady ? (
                <section
                  className="rounded-xl border border-dashed border-border p-4 opacity-70"
                  aria-hidden="true"
                >
                  <h2 className="text-sm font-medium">Texto do corte</h2>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    Título e descrição ficam disponíveis para edição quando o processamento
                    terminar.
                  </p>
                  <div className="mt-4 h-10 rounded-md bg-muted" />
                  <div className="mt-3 h-24 rounded-md bg-muted" />
                </section>
              ) : (
                <SpeechCutTextEditor
                  cutId={cut.id}
                  initialTitle={cut.title}
                  initialDescription={cut.description}
                />
              )}
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
