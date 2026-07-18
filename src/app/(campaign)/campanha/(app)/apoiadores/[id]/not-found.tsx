import Link from 'next/link'

import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/Empty'

export default function SupporterNotFoundPage() {
  return (
    <Empty className="min-h-72 border">
      <EmptyHeader>
        <EmptyTitle>Apoiador não encontrado</EmptyTitle>
        <EmptyDescription>
          O registro pode ter sido removido ou você não tem acesso a ele.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/campanha/apoiadores">Voltar para apoiadores</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
