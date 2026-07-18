import { WifiOff } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Offline | Campanha',
  robots: {
    index: false,
    follow: false,
  },
}

export default function CampaignOfflinePage() {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <WifiOff className="size-6" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-foreground">Você está offline</h1>
          <p className="text-sm text-muted-foreground">
            Sem conexão no momento. Abra novamente quando a rede voltar, ou tente uma página que
            você já visitou nesta sessão.
          </p>
        </div>
        <Button asChild className="min-h-11">
          <Link href="/campanha">Tentar novamente</Link>
        </Button>
      </div>
    </main>
  )
}
