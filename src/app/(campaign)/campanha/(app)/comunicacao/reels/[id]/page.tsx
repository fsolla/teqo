import config from '@payload-config'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { ReelDownloadPanel } from '@/components/campaign/reels/ReelDownloadPanel'
import { ReelPlayer } from '@/components/campaign/reels/ReelPlayer'
import { ReelPublicationPanel } from '@/components/campaign/reels/ReelPublicationPanel'
import { ReelStatusBadge } from '@/components/campaign/reels/ReelStatusBadge'
import { ReelTranscriptCard } from '@/components/campaign/reels/ReelTranscriptCard'
import { SetCampaignPageChrome } from '@/components/campaign/shell/CampaignPageChromeContext'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Button } from '@/components/ui/button'
import { campaignPageMetadata } from '@/lib/campaignPageChrome'
import { CAMPAIGN_COMMUNICATION_REELS } from '@/lib/campaignPaths'
import { strictDecimalInteger } from '@/utilities/campaignListUrl'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadReelDetailPageData, ReelNotFoundError } from '@/utilities/reels/reelPageData'

type ReelDetailPageProps = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ReelDetailPageProps) {
  const { id } = await params
  const reelId = strictDecimalInteger(id)
  if (!reelId) return campaignPageMetadata({ title: 'Reel' })

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'communicationCatalog' }),
    getPayload({ config }),
  ])

  try {
    const reel = await loadReelDetailPageData(payload, user, reelId)
    return campaignPageMetadata({ title: reel.title })
  } catch {
    return campaignPageMetadata({ title: 'Reel' })
  }
}

/**
 * C194 — one reel: the 9:16 player, every artifact the production delivered
 * and the kill switch. Unpublished reels stay reachable here (so the switch
 * can be reversed) but the player and the downloads are withheld — the C193
 * media route serves only `published`.
 */
export default async function ReelDetailPage({ params }: ReelDetailPageProps) {
  const [{ id }, user, payload] = await Promise.all([
    params,
    requireCampaignPageActor({ gate: 'communicationCatalog' }),
    getPayload({ config }),
  ])
  const reelId = strictDecimalInteger(id)
  if (!reelId) notFound()

  const reel = await loadReelDetailPageData(payload, user, reelId).catch((error) => {
    if (error instanceof ReelNotFoundError) notFound()
    throw error
  })
  const blocked = !reel.canServeMedia

  return (
    <CampaignPageShell>
      <SetCampaignPageChrome chrome={{ title: reel.title }} />

      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" className="-ml-2 min-h-10 self-start">
          <Link href={CAMPAIGN_COMMUNICATION_REELS}>
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Voltar aos reels
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <ReelStatusBadge status={reel.status} />
              <span className="text-xs text-muted-foreground">
                {reel.featureLabel}
                {reel.publishedAtLabel ? <> · publicado em {reel.publishedAtLabel}</> : null}
              </span>
            </div>
            <h1 className="mt-2 text-lg font-medium">{reel.title}</h1>
          </div>
        </div>

        {blocked ? (
          <div className="flex flex-col gap-4">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm font-medium">Fora da lista</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Este reel não aparece na biblioteca. O registro e os arquivos continuam guardados,
                mas nenhuma mídia é servida enquanto ele não estiver publicado.
              </p>
            </div>
            <ReelPublicationPanel reelId={reel.id} status={reel.status} />
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)_280px]">
          <div>
            <ReelPlayer reel={reel} />
          </div>

          <div className="min-w-0">
            <ReelDownloadPanel reel={reel} />

            {reel.transcript ? (
              <div className="mt-4">
                <ReelTranscriptCard transcript={reel.transcript} />
              </div>
            ) : null}
          </div>

          <aside className="space-y-4">
            <section className="rounded-xl border border-border p-4">
              <h2 className="text-xs font-medium text-muted-foreground">Sobre o reel</h2>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Funcionalidade</dt>
                  <dd className="mt-0.5 font-medium">{reel.featureLabel}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Publicado em</dt>
                  <dd className="mt-0.5">{reel.publishedAtLabel ?? 'Ainda não publicado'}</dd>
                </div>
              </dl>
            </section>

            {blocked ? null : <ReelPublicationPanel reelId={reel.id} status={reel.status} />}

            <p className="rounded-lg bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">
              Nada é publicado no Instagram por esta tela.
            </p>
          </aside>
        </div>
      </div>
    </CampaignPageShell>
  )
}
