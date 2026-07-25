import config from '@payload-config'
import type { Metadata } from 'next'
import { unstable_noStore as noStore } from 'next/cache'
import { getPayload } from 'payload'

import {
  redeemCampaignInviteAutofillFormAction,
  redeemCampaignInviteLoginFormAction,
} from '@/app/(campaign)/campanha/convite/[token]/formActions'
import { CampaignInviteForm } from '@/components/campaign/invite/CampaignInviteForm'
import { InvalidCampaignInvite } from '@/components/campaign/invite/InvalidCampaignInvite'
import { ConsentText } from '@/components/campaign/shared/ConsentText'
import { getCampaignInvitePageData } from '@/utilities/campaignInvitePageData'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Confirme seus dados | Campanha do Solla',
  description: 'Página segura para confirmar seus dados com a campanha do Solla.',
  referrer: 'no-referrer',
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
}

type CampaignInvitePageProps = {
  params: Promise<{ token: string }>
}

export default async function CampaignInvitePage({ params }: CampaignInvitePageProps) {
  noStore()
  const [{ token }, payload] = await Promise.all([params, getPayload({ config })])
  const preview = await getCampaignInvitePageData(payload, token)

  if (preview.status === 'invalid') {
    return (
      <main className="flex min-h-screen items-center justify-center p-4 sm:p-6">
        <InvalidCampaignInvite />
      </main>
    )
  }

  const action =
    preview.kind === 'login'
      ? redeemCampaignInviteLoginFormAction.bind(null, token)
      : redeemCampaignInviteAutofillFormAction.bind(null, token)
  const consentText = preview.requiresConsent
    ? ConsentText({ data: preview.consentData })
    : undefined

  return (
    <main className="flex min-h-screen items-center justify-center p-4 sm:p-6">
      <CampaignInviteForm
        action={action}
        kind={preview.kind}
        profile={preview.profile}
        requiresConsent={preview.requiresConsent}
      >
        {consentText}
      </CampaignInviteForm>
    </main>
  )
}
