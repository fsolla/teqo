import Link from 'next/link'

import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/Empty'
import { CAMPAIGN_COMMUNICATION_REELS } from '@/lib/campaignPaths'

export default function ReelNotFoundPage() {
  return (
    <Empty className="min-h-72 border">
      <EmptyHeader>
        <EmptyTitle>Reel não encontrado</EmptyTitle>
        <EmptyDescription>
          O reel pode ter sido removido ou você não tem acesso a ele.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline" className="min-h-11">
          <Link href={CAMPAIGN_COMMUNICATION_REELS}>Voltar à biblioteca de reels</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
