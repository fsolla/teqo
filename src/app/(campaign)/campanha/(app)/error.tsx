'use client'

import { AlertTriangleIcon, RotateCcwIcon } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'

export default function CampaignDashboardError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto flex min-h-72 w-full max-w-2xl items-center">
      <Alert variant="destructive" aria-live="assertive">
        <AlertTriangleIcon aria-hidden="true" />
        <AlertTitle>Não foi possível carregar o painel</AlertTitle>
        <AlertDescription className="flex flex-col gap-4">
          <p>Verifique sua conexão e tente novamente. Seus dados não foram alterados.</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-fit"
            onClick={() => reset()}
          >
            <RotateCcwIcon data-icon="inline-start" aria-hidden="true" />
            Tentar novamente
          </Button>
        </AlertDescription>
      </Alert>
    </div>
  )
}
