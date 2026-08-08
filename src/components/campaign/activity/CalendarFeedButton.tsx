'use client'

import { useState } from 'react'

import { CalendarIcon, CopyIcon, ExternalLinkIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import type { ActivityAgendaState } from '@/utilities/activityUi'

type CalendarFeed = {
  id: number
  label: string
  createdAt: string
}

type CalendarFeedButtonProps = {
  state: ActivityAgendaState
  hasFilters: boolean
  feeds: CalendarFeed[]
  onCreateFeed: (
    label: string,
  ) => Promise<{ ok: true; feedUrl: string } | { ok: false; message: string }>
  onRevokeFeed: (feedId: number) => Promise<{ ok: boolean }>
}

export const CalendarFeedButton = ({
  state: _state,
  hasFilters,
  feeds,
  onCreateFeed,
  onRevokeFeed,
}: CalendarFeedButtonProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCreate = async () => {
    if (!label.trim()) return
    setIsCreating(true)
    setError(null)
    const result = await onCreateFeed(label.trim())
    setIsCreating(false)
    if (result.ok) {
      setCreatedUrl(result.feedUrl)
      setLabel('')
    } else {
      setError(result.message)
    }
  }

  const handleCopy = async () => {
    if (!createdUrl) return
    await navigator.clipboard.writeText(createdUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRevoke = async (feedId: number) => {
    await onRevokeFeed(feedId)
  }

  const handleClose = () => {
    setIsOpen(false)
    setCreatedUrl(null)
    setError(null)
    setCopied(false)
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={!hasFilters}
        onClick={() => setIsOpen(true)}
        title={!hasFilters ? 'Aplique filtros para gerar um link de import' : undefined}
      >
        <CalendarIcon data-icon="inline-start" aria-hidden="true" />
        Link de import
      </Button>

      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sincronizar com Google Calendar</DialogTitle>
            <DialogDescription>
              Gere um link de import para sincronizar este recorte da agenda com o Google Calendar.
              Alterações em Teqo serão refletidas automaticamente.
            </DialogDescription>
          </DialogHeader>

          {createdUrl ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Link de import</label>
                <div className="flex gap-2">
                  <Input value={createdUrl} readOnly className="font-mono text-xs" />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopy}
                    aria-label="Copiar link"
                  >
                    <CopyIcon className="h-4 w-4" />
                  </Button>
                </div>
                {copied && <p className="text-xs text-green-600">Link copiado!</p>}
              </div>

              <div className="rounded-lg bg-muted p-4 text-sm">
                <p className="font-medium mb-2">Como adicionar ao Google Calendar:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Abra o Google Calendar no computador</li>
                  <li>
                    No menu lateral, clique em {'"'}+{'"'} ao lado de {'"'}Outras agendas{'"'}
                  </li>
                  <li>
                    Selecione {'"'}Por URL{'"'}
                  </li>
                  <li>
                    Cole o link acima e clique em {'"'}Adicionar agenda{'"'}
                  </li>
                </ol>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Fechar
                </Button>
                <Button asChild>
                  <a
                    href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLinkIcon className="h-4 w-4 mr-2" />
                    Abrir Google Calendar
                  </a>
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="feed-label" className="text-sm font-medium">
                  Nome do feed
                </label>
                <Input
                  id="feed-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Ex: Só deputado presente"
                  maxLength={120}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                <p className="text-xs text-muted-foreground">
                  Um nome para identificar este feed (ex: {'"'}Agenda do candidato{'"'}, {'"'}
                  Reuniões em Salvador{'"'})
                </p>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              {feeds.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Seus feeds ativos</p>
                  <ul className="space-y-1">
                    {feeds.map((feed) => (
                      <li
                        key={feed.id}
                        className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"
                      >
                        <span>{feed.label}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRevoke(feed.id)}
                          aria-label={`Revogar feed ${feed.label}`}
                        >
                          <Trash2Icon className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancelar
                </Button>
                <Button type="button" onClick={handleCreate} disabled={!label.trim() || isCreating}>
                  {isCreating ? 'Gerando...' : 'Gerar link'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
