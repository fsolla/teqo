import config from '@payload-config'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { createMunicipalityV2SignalFormAction } from '@/app/(campaign)/campanha/(app)/municipio/[slug]/v2/formActions'
import { resolveSuggestionFormAction } from '@/app/(campaign)/campanha/(app)/suggestionFormActions'
import { MunicipalityV2AgoraSection } from '@/components/campaign/municipality/MunicipalityV2AgoraSection'
import { MunicipalityV2NetworkSection } from '@/components/campaign/municipality/MunicipalityV2NetworkSection'
import { MunicipalityV2StatusStrip } from '@/components/campaign/municipality/MunicipalityV2StatusStrip'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { campaignPageMetadata } from '@/lib/campaignPageChrome'
import { getMunicipalityCatalogEntry } from '@/lib/municipalityCatalog'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { MunicipalityNotFoundError } from '@/utilities/municipality/municipalityPageData'
<<<<<<< HEAD
import { loadMunicipalityV2NetworkData } from '@/utilities/municipality/municipalityV2NetworkData'
=======
import { loadMunicipalityV2AgoraData } from '@/utilities/municipality/municipalityV2AgoraData'
>>>>>>> 33101301 (style: prettier B150 files)
import { loadMunicipalityV2StatusData } from '@/utilities/municipality/municipalityV2StatusData'

type MunicipalityV2PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: MunicipalityV2PageProps) {
  const { slug } = await params
  const entry = getMunicipalityCatalogEntry(slug)
  // Soft-dep B145: entity title belongs in chrome; metadata carries the name until then.
  return campaignPageMetadata({ title: entry?.name ?? 'Município' })
}

export default async function MunicipalityV2Page({ params }: MunicipalityV2PageProps) {
  const { slug } = await params
  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'noLeader' }),
    getPayload({ config }),
  ])

  let status
  let network
  let agora
  try {
    const [statusLoaded, networkLoaded, agoraLoaded] = await Promise.all([
      loadMunicipalityV2StatusData(payload, user, slug),
      loadMunicipalityV2NetworkData(payload, user, slug),
      loadMunicipalityV2AgoraData(payload, user, slug),
    ])
    ;({ status } = statusLoaded)
    network = networkLoaded
    agora = agoraLoaded
  } catch (error) {
    if (error instanceof MunicipalityNotFoundError) notFound()
    throw error
  }

  return (
    <CampaignPageShell>
      <div className="flex flex-col gap-8">
        <MunicipalityV2StatusStrip
          status={status}
          signalFormAction={createMunicipalityV2SignalFormAction}
        />

        {/* Placeholder for B148 — keep the vertical rhythm without shipping twin content. */}
        <section aria-labelledby="municipio-v2-conta-title" className="flex flex-col gap-2">
          <h2 id="municipio-v2-conta-title" className="text-base font-medium text-muted-foreground">
            Conta local
          </h2>
          <p className="text-sm text-muted-foreground">Em breve nesta visão.</p>
        </section>
        <MunicipalityV2NetworkSection network={network} />
        <MunicipalityV2AgoraSection agora={agora} resolveAction={resolveSuggestionFormAction} />
      </div>
    </CampaignPageShell>
  )
}
