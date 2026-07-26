'use client'

import { Building2Icon, FilterIcon, Trash2Icon } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatRelativeAge } from '@/utilities/formatRelativeAge'
import {
  clearRecentVisits,
  listRecentVisits,
  type RecentVisitEntry,
} from '@/utilities/recentVisits'

export const RecentlyVisitedCard = ({ now }: { now: Date }) => {
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
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Visitados recentemente</CardTitle>
        <CardAction>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="size-8 shrink-0"
            onClick={handleClear}
            aria-label="Limpar histórico de páginas visitadas recentemente"
          >
            <Trash2Icon aria-hidden="true" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex-1">
        <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
          {entries.map((entry) => {
            const Icon = entry.kind === 'municipality' ? Building2Icon : FilterIcon
            return (
              <li key={entry.href}>
                <Button
                  asChild
                  variant="ghost"
                  className="h-auto min-h-11 w-full justify-start gap-2 px-2"
                >
                  <Link href={entry.href} title={entry.label}>
                    <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 text-left">
                      <strong className="block truncate text-sm font-medium">{entry.label}</strong>
                      <span className="block truncate text-xs text-muted-foreground">
                        {formatRelativeAge(entry.visitedAt, nowMs)}
                      </span>
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
