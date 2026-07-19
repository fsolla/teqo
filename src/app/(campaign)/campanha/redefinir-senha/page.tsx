import { Megaphone } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { CAMPAIGN_PASSWORD_RESET_TOKEN_MIN_LENGTH } from '@/lib/schemas/campaignPassword'
import { ResetPasswordForm } from '@/app/(campaign)/campanha/redefinir-senha/ResetPasswordForm'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
      <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
        <div className="flex w-full max-w-sm flex-col gap-6">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Link inválido</CardTitle>
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
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center gap-2 self-center font-semibold">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Megaphone className="size-4" />
          </div>
          Campanha
        </div>
        <ResetPasswordForm token={token} />
      </div>
    </main>
  )
}
