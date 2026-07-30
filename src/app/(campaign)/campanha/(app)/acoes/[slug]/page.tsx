import { notFound } from 'next/navigation'

import { WizardMunicipalityPlaceholderStep } from '@/components/campaign/shared/WizardMunicipalityPlaceholderStep'
import {
  CAMPAIGN_WIZARD_ACTION_SLUGS,
  isCampaignWizardActionSlug,
} from '@/lib/campaignActionRoutes'

type CampaignActionWizardPageProps = {
  params: Promise<{ slug: string }>
}

export function generateStaticParams() {
  return Object.values(CAMPAIGN_WIZARD_ACTION_SLUGS).map((slug) => ({ slug }))
}

export default async function CampaignActionWizardPage({ params }: CampaignActionWizardPageProps) {
  const { slug } = await params

  if (!isCampaignWizardActionSlug(slug)) {
    notFound()
  }

  return <WizardMunicipalityPlaceholderStep />
}
