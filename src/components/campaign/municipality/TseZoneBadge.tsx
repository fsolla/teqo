import { Badge } from '@/components/ui/Badge'

export const TseZoneBadge = ({ zoneNumber }: { zoneNumber: number }) => (
  <Badge variant="tse" aria-label={`Zona Eleitoral TSE ${zoneNumber}`}>
    ZE {zoneNumber}
  </Badge>
)
