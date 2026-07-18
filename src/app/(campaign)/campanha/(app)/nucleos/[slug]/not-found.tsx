import Link from 'next/link'
import { MapPinOffIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/Empty'

export default function NucleusNotFound() {
  return (
    <Empty className="mx-auto min-h-80 max-w-2xl border">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <MapPinOffIcon aria-hidden="true" />
        </EmptyMedia>
        <EmptyTitle>Núcleo não encontrado</EmptyTitle>
        <EmptyDescription>
          Ele pode não existir ou estar fora do seu escopo de acesso.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/campanha/nucleos">Voltar aos núcleos</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
