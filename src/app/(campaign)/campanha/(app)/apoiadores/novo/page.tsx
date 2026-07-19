import config from '@payload-config'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { createSupporterFormAction } from '@/app/(campaign)/campanha/(app)/apoiadores/novo/formActions'
import { CampaignScopeBadge } from '@/components/campaign/CampaignScopeBadge'
import { SupporterForm } from '@/components/campaign/SupporterForm'
import { Button } from '@/components/ui/button'
import { isCampaignGeneral } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { loadSupporterCreatePageData } from '@/utilities/supporterPageData'
import { canAccessSupporterArea } from '@/utilities/supporterUi'

export default async function NewSupporterPage() {
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])

  if (!user) redirect('/campanha/login')
  if (!canAccessSupporterArea(user.role)) redirect('/campanha')

  const pageData = await loadSupporterCreatePageData(payload, user)

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Button asChild variant="ghost" className="w-fit px-0">
          <Link href="/campanha/apoiadores">← Voltar para apoiadores</Link>
        </Button>
        <CampaignScopeBadge>
          {isCampaignGeneral(user) ? 'Coordenação geral' : 'Coordenação de núcleo'}
        </CampaignScopeBadge>
        <h1 className="text-2xl font-semibold tracking-tight">Novo apoiador</h1>
        <p className="text-muted-foreground">
          Cadastre um apoiador com telefone obrigatório e consentimento LGPD.
        </p>
      </header>

      <SupporterForm
        action={createSupporterFormAction}
        nucleusOptions={pageData.nucleusOptions}
        registrationConsentConfigured={pageData.registrationConsentConfigured}
        voteIntentionConsentConfigured={pageData.voteIntentionConsentConfigured}
        requireNucleus={pageData.requireNucleus}
      />
    </div>
  )
}
