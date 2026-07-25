import 'server-only'

import { LockKeyholeIcon } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const InvalidCampaignInvite = () => (
  <Card className="w-full max-w-lg">
    <CardHeader>
      <CardTitle>Este convite não está disponível</CardTitle>
      <CardDescription>
        Peça um novo convite à pessoa da campanha que falou com você.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <Alert>
        <LockKeyholeIcon aria-hidden="true" />
        <AlertTitle>Proteção dos seus dados</AlertTitle>
        <AlertDescription>
          Por segurança, não informamos detalhes sobre o estado deste link.
        </AlertDescription>
      </Alert>
    </CardContent>
  </Card>
)
