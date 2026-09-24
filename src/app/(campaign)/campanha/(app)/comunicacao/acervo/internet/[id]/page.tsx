import config from '@payload-config'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { SetCampaignPageChrome } from '@/components/campaign/shell/CampaignPageChromeContext'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { WebSpeechDetailPlayer } from '@/components/campaign/speech/WebSpeechDetailPlayer'
import { Button } from '@/components/ui/button'
import { buildAcervoSourceHref } from '@/lib/acervoSource'
import { campaignPageMetadata } from '@/lib/campaignPageChrome'
import { parseSeekSeconds } from '@/lib/speechClock'
import { firstValue, strictDecimalInteger } from '@/utilities/campaignListUrl'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  loadWebSpeechDetailPageData,
  loadWebSpeechTitleForActor,
  SpeechNotFoundError,
} from '@/utilities/speech/speechPageData'

type WebSpeechDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateMetadata({ params }: WebSpeechDetailPageProps) {
  const { id } = await params
  const speechId = strictDecimalInteger(id)
  if (!speechId) return campaignPageMetadata({ title: 'Fala na internet' })

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'communicationCatalog' }),
    getPayload({ config }),
  ])

  try {
    const title = await loadWebSpeechTitleForActor(payload, user, speechId)
    return campaignPageMetadata({ title: title ?? 'Fala na internet' })
  } catch {
    return campaignPageMetadata({ title: 'Fala na internet' })
  }
}

/**
 * C216 — one web speech ("Falas na internet"): the private player of the
 * mirrored file, the download, "Abrir na origem" and the clickable transcript.
 * The Câmara detail is another product (VOD/cuts), which is why the source has
 * its own route — the Câmara loader answers an honest 404 for a web row and
 * this one for a Câmara row.
 */
export default async function WebSpeechDetailPage({
  params,
  searchParams,
}: WebSpeechDetailPageProps) {
  const [{ id }, query, user, payload] = await Promise.all([
    params,
    searchParams,
    requireCampaignPageActor({ gate: 'communicationCatalog' }),
    getPayload({ config }),
  ])
  const speechId = strictDecimalInteger(id)
  if (!speechId) notFound()

  const speech = await loadWebSpeechDetailPageData(
    payload,
    user,
    speechId,
    firstValue(query.q)?.trim() || undefined,
  ).catch((error) => {
    if (error instanceof SpeechNotFoundError) notFound()
    throw error
  })

  const initialSeconds = parseSeekSeconds(firstValue(query.t))

  return (
    <CampaignPageShell>
      <SetCampaignPageChrome chrome={{ title: 'Fala na internet', subtitle: 'Acervo' }} />

      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" className="-ml-2 min-h-11 self-start">
          <Link href={buildAcervoSourceHref('internet')}>
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Voltar para Falas na internet
          </Link>
        </Button>

        <WebSpeechDetailPlayer speech={speech} initialSeconds={initialSeconds} />
      </div>
    </CampaignPageShell>
  )
}
