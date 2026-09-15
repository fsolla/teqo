import Link from 'next/link'

import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/Empty'
import { CAMPAIGN_COMMUNICATION_CORTES } from '@/lib/campaignPaths'

export default function SpeechCutNotFoundPage() {
  return (
    <Empty className="min-h-72 border">
      <EmptyHeader>
        <EmptyTitle>Corte não encontrado</EmptyTitle>
        <EmptyDescription>
          O corte pode ter sido removido ou você não tem acesso a ele.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline" className="min-h-11">
          <Link href={CAMPAIGN_COMMUNICATION_CORTES}>Voltar à biblioteca de cortes</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
