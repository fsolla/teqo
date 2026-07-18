import type { ReactNode } from 'react'
import { AlertTriangleIcon, MessageCircleIcon } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Avatar, AvatarFallback } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import type { AssignedCoordinatorViewModel } from '@/utilities/nucleusCoordinatorAssignmentPageData'
import { buildWhatsAppUrl } from '@/utilities/phone'

type CoordinatorAssignmentCardProps = {
  coordinators: AssignedCoordinatorViewModel[]
  children?: ReactNode
}

const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

export const CoordinatorAssignmentCard = ({
  coordinators,
  children,
}: CoordinatorAssignmentCardProps) => (
    <Card>
      <CardHeader>
        <CardTitle>Coordenação responsável</CardTitle>
        <CardDescription>
          Pessoas atualmente responsáveis pela articulação deste núcleo.
        </CardDescription>
        {children ? <CardAction>{children}</CardAction> : null}
      </CardHeader>
      <CardContent>
        {coordinators.length ? (
          <ul className="flex flex-col gap-3">
            {coordinators.map((coordinator) => (
              <li
                key={coordinator.id}
                className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar size="lg">
                    <AvatarFallback>{initials(coordinator.name)}</AvatarFallback>
                  </Avatar>
                  <span className="truncate font-medium">{coordinator.name}</span>
                </div>
                {coordinator.phone ? (
                  <Button asChild variant="outline" className="min-h-11">
                    <a
                      href={buildWhatsAppUrl(coordinator.phone)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircleIcon data-icon="inline-start" aria-hidden="true" />
                      Falar no WhatsApp
                    </a>
                  </Button>
                ) : (
                  <span className="text-sm text-muted-foreground">Contato não disponível</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Alert variant="pending">
            <AlertTriangleIcon aria-hidden="true" />
            <AlertTitle>Sem coordenação responsável</AlertTitle>
            <AlertDescription>
              Este núcleo ainda não tem uma pessoa elegível designada para coordenação.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
)
