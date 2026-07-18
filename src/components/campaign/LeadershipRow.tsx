import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar'
import { SupportStatusBadge, type SupportStatus } from '@/components/campaign/SupportStatusBadge'
import { cn } from '@/lib/utils'

const getInitials = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean)

  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toLocaleUpperCase('pt-BR')
}

export type LeadershipRowProps = {
  name: string
  phone?: string
  sector?: string
  supportStatus: SupportStatus
  avatarSrc?: string
  className?: string
  isPrimaryContact?: boolean
  href: string
  rowId: string
}

export const LeadershipRow = ({
  name,
  phone,
  sector,
  supportStatus,
  avatarSrc,
  className,
  isPrimaryContact = false,
  href,
  rowId,
}: LeadershipRowProps) => {
  const content = (
    <>
      <Avatar size="lg">
        {avatarSrc ? <AvatarImage src={avatarSrc} alt="" /> : null}
        <AvatarFallback>{getInitials(name)}</AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="truncate font-medium">{name}</span>
          {sector ? <Badge variant="outline">{sector}</Badge> : null}
          {isPrimaryContact ? <Badge variant="secondary">Contato principal</Badge> : null}
        </div>
        {phone ? <span className="text-sm text-muted-foreground">{phone}</span> : null}
      </div>

      <SupportStatusBadge status={supportStatus} />
    </>
  )
  const rootClassName = cn(
    'flex min-h-14 min-w-0 items-center gap-3 border-b px-4 py-3 text-left last:border-b-0',
    'w-full cursor-pointer hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
    className,
  )

  return (
    <Link id={rowId} href={href} className={rootClassName} aria-label={`Abrir ficha de ${name}`}>
      {content}
    </Link>
  )
}
