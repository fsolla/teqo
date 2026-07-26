'use client'

import { Building2Icon, FilterIcon, Trash2Icon } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { formatRelativeAge } from '@/utilities/formatRelativeAge'
import {
  clearRecentVisits,
  listRecentVisits,
  type RecentVisitEntry,
} from '@/utilities/recentVisits'

type RecentlyVisitedCardProps = {
  now: Date
  compact?: boolean
  clearControl?: 'icon' | 'labeled'
  className?: string
}

export const RecentlyVisitedCard = ({
  now,
  compact = false,
  clearControl = 'icon',
  className,
}: RecentlyVisitedCardProps) => {
  const [entries, setEntries] = useState<RecentVisitEntry[]>([])

  useEffect(() => {
    setEntries(listRecentVisits())
  }, [])

  const handleClear = () => {
    clearRecentVisits()
    setEntries([])
  }

  if (!entries.length) return null

  const nowMs = now.getTime()

  return (
    <Card className={cn('flex h-full flex-col', className)}>
      <CardHeader className={compact ? 'pb-2' : undefined}>
        <CardTitle className={compact ? 'text-sm' : undefined}>
          {compact ? 'Recentes' : 'Visitados recentemente'}
        </CardTitle>
        <CardAction>
          <Button
            type="button"
            variant={clearControl === 'labeled' ? 'outline' : 'ghost'}
            size={clearControl === 'labeled' ? 'sm' : 'icon-sm'}
            className={clearControl === 'labeled' ? 'min-h-11 shrink-0' : 'size-8 shrink-0'}
            onClick={handleClear}
            aria-label="Limpar histórico de páginas visitadas recentemente"
          >
            <Trash2Icon
              data-icon={clearControl === 'labeled' ? 'inline-start' : undefined}
              aria-hidden="true"
            />
            {clearControl === 'labeled' ? 'Limpar histórico' : null}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className={cn('flex-1', compact ? 'px-4 pt-0' : undefined)}>
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {entries.map((entry) => {
            const Icon = entry.kind === 'municipality' ? Building2Icon : FilterIcon
            return (
              <li key={entry.href}>
                <Button
                  asChild
                  variant="ghost"
                  className={cn(
                    'h-auto w-full justify-start gap-2 px-2',
                    compact ? 'min-h-10 py-1.5' : 'min-h-11',
                  )}
                >
                  <Link href={entry.href} title={entry.label}>
                    <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 text-left">
                      <strong className="block truncate text-sm font-medium">{entry.label}</strong>
                      {!compact ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {formatRelativeAge(entry.visitedAt, nowMs)}
                        </span>
                      ) : (
                        <span className="sr-only">{formatRelativeAge(entry.visitedAt, nowMs)}</span>
                      )}
                    </span>
                  </Link>
                </Button>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
