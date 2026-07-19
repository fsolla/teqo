'use client'

import { Building2Icon, FilterIcon } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatRelativeAge } from '@/utilities/formatRelativeAge'
import {
  clearRecentVisits,
  listRecentVisits,
  type RecentVisitEntry,
} from '@/utilities/recentVisits'

export const RecentlyVisited = ({ now }: { now: Date }) => {
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
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Visitados recentemente</CardTitle>
        <Button type="button" variant="ghost" size="sm" className="min-h-11" onClick={handleClear}>
          Limpar
        </Button>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1">
          {entries.map((entry) => {
            const Icon = entry.kind === 'nucleus' ? Building2Icon : FilterIcon
            return (
              <li key={entry.href}>
                <Button asChild variant="ghost" className="h-auto min-h-11 w-full justify-start gap-2">
                  <Link href={entry.href}>
                    <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 text-left">
                      <strong className="block truncate">{entry.label}</strong>
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
