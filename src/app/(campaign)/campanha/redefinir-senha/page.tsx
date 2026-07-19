import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ResetPasswordForm } from '@/app/(campaign)/campanha/redefinir-senha/ResetPasswordForm'
import { CampaignAuthPageShell } from '@/components/campaign/CampaignAuthPageShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { campaignAuthHeadingClassName } from '@/lib/campaignAuthCopy'
import { CAMPAIGN_PASSWORD_RESET_TOKEN_MIN_LENGTH } from '@/lib/schemas/campaignPassword'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { CAMPAIGN_PASSWORD_RESET_INVALID_TOKEN_MESSAGE } from '@/utilities/campaignPasswordReset'

export const metadata: Metadata = {
  title: 'Redefinir senha | Campanha',
  robots: {
    index: false,
    follow: false,
  },
}

type CampaignResetPasswordPageProps = {
  searchParams: Promise<{ token?: string }>
}

export default async function CampaignResetPasswordPage({
  searchParams,
}: CampaignResetPasswordPageProps) {
  const user = await getCampaignUser()
  if (user) {
    redirect('/campanha/perfil')
  }

  const { token } = await searchParams

  if (!token || token.length < CAMPAIGN_PASSWORD_RESET_TOKEN_MIN_LENGTH) {
    return (
      <CampaignAuthPageShell>
        <Card>
          <CardHeader className="text-center">
            <h1 className={campaignAuthHeadingClassName}>Link inválido</h1>
            <CardDescription>{CAMPAIGN_PASSWORD_RESET_INVALID_TOKEN_MESSAGE}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild className="min-h-11 w-full">
              <Link href="/campanha/esqueci-senha">Solicitar novo link</Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11 w-full">
              <Link href="/campanha/login">Voltar ao login</Link>
            </Button>
          </CardContent>
        </Card>
      </CampaignAuthPageShell>
    )
  }

  return (
    <CampaignAuthPageShell>
      <ResetPasswordForm token={token} />
    </CampaignAuthPageShell>
  )
}
