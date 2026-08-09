'use client'

import { useState } from 'react'

import { CopyIcon, ExternalLinkIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerCloseButton,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer'
import { Input } from '@/components/ui/input'
import { useIsMobile } from '@/hooks/use-mobile'

export type CalendarFeedSummary = {
  id: number
  label: string
  createdAt: string
}

export type CreateCalendarFeedResult =
  | { ok: true; feedUrl: string }
  | { ok: false; message: string }

type CalendarFeedDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  feeds: CalendarFeedSummary[]
  onCreateFeed: (label: string) => Promise<CreateCalendarFeedResult>
  onRevokeFeed: (feedId: number) => Promise<{ ok: boolean }>
}

/**
 * Calendar feed dialog (nomear → copiar → revogar). Shared by the desktop
 * header icon and the mobile FAB quick action — rendered once per host, opened
 * by either trigger. Bottom sheet on mobile, dialog on desktop (C94). Always
 * enabled for staff (C93): with zero filters the feed covers the creator's
 * full read scope.
 */
export const CalendarFeedDialog = ({
  open,
  onOpenChange,
  feeds,
  onCreateFeed,
  onRevokeFeed,
}: CalendarFeedDialogProps) => {
  const isMobile = useIsMobile()
  const [label, setLabel] = useState('')
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleCreate = async () => {
    if (!label.trim() || isCreating) return
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

  const handleClose = (next: boolean) => {
    if (next) return
    setCreatedUrl(null)
    setError(null)
    setCopied(false)
    onOpenChange(false)
  }

  const body = (
    <>
      {createdUrl ? (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="feed-url">
              Link de import
            </label>
            <div className="flex gap-2">
              <Input id="feed-url" value={createdUrl} readOnly className="font-mono text-xs" />
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
            <p className="mb-2 font-medium">Como adicionar ao Google Calendar:</p>
            <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
              <li>Abra o Google Calendar no computador</li>
              <li>
                No menu lateral, clique em {'"'}
                {'+'}
                {'"'} ao lado de {'"'}Outras agendas{'"'}
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
            {!isMobile ? (
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Fechar
              </Button>
            ) : null}
            <Button asChild>
              <a
                href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLinkIcon className="mr-2 h-4 w-4" />
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
                      onClick={() => void onRevokeFeed(feed.id)}
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
            {!isMobile ? (
              <Button type="button" variant="outline" onClick={() => handleClose(false)}>
                Cancelar
              </Button>
            ) : null}
            <Button type="button" onClick={handleCreate} disabled={!label.trim() || isCreating}>
              {isCreating ? 'Gerando...' : 'Gerar link'}
            </Button>
          </div>
        </div>
      )}
    </>
  )

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleClose} showSwipeHandle>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Sincronizar com Google Calendar</DrawerTitle>
            <DrawerDescription>
              Gere um link de import para sincronizar a agenda com o Google Calendar. Alterações em
              Teqo serão refletidas automaticamente.
            </DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-2">{body}</div>
          <DrawerFooter className="border-t">
            <DrawerCloseButton className="w-full">Fechar</DrawerCloseButton>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Sincronizar com Google Calendar</DialogTitle>
          <DialogDescription>
            Gere um link de import para sincronizar a agenda com o Google Calendar. Alterações em
            Teqo serão refletidas automaticamente.
          </DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  )
}
