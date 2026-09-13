import Link from 'next/link'

import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/Empty'
import { CAMPAIGN_COMMUNICATION_ACERVO } from '@/lib/campaignPaths'

export default function SpeechNotFoundPage() {
  return (
    <Empty className="min-h-72 border">
      <EmptyHeader>
        <EmptyTitle>Fala não encontrada</EmptyTitle>
        <EmptyDescription>
          O registro pode ter sido removido ou você não tem acesso a ele.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline" className="min-h-11">
          <Link href={CAMPAIGN_COMMUNICATION_ACERVO}>Voltar ao acervo</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
