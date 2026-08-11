import config from '@payload-config'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { PersonDetailSections } from '@/components/campaign/people/PersonDetailSections'
import { SetCampaignPageChrome } from '@/components/campaign/shell/CampaignPageChromeContext'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { campaignPageMetadata } from '@/lib/campaignPageChrome'
import { isUnrestrictedCampaignRole } from '@/lib/campaignRoles'
import { resolvedPortfolioEntriesById } from '@/lib/municipalityPortfolio'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadMunicipalityPortfolioIndex } from '@/utilities/municipality/municipalityPortfolioIndex'
import { loadPersonDetail } from '@/utilities/people/personDetail'

export async function generateMetadata({ params }: PersonDetailPageProps) {
  const { id } = await params
  if (!/^[1-9]\d*$/.test(id)) return campaignPageMetadata({ title: 'Pessoa' })

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const person = await loadPersonDetail(payload, user, Number(id))
  if (!person) return campaignPageMetadata({ title: 'Pessoa' })

  return campaignPageMetadata({ title: 'Pessoa', subtitle: person.name })
}

type PersonDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function PersonDetailPage({ params }: PersonDetailPageProps) {
  const { id } = await params
  if (!/^[1-9]\d*$/.test(id)) notFound()

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const person = await loadPersonDetail(payload, user, Number(id))
  if (!person) notFound()

  const municipalityIndex = resolvedPortfolioEntriesById(await loadMunicipalityPortfolioIndex())

  return (
    <CampaignPageShell>
      <SetCampaignPageChrome chrome={{ title: 'Pessoa', subtitle: person.name }} />
      <PersonDetailSections
        person={person}
        municipalityIndex={municipalityIndex}
        canDelete={isUnrestrictedCampaignRole(user.role)}
      />
    </CampaignPageShell>
  )
}
