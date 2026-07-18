'use client'

import { CheckIcon, CopyIcon, LinkIcon, MessageCircleIcon } from 'lucide-react'
import { useState } from 'react'

import type { NucleusShareRecipientsResult } from '@/app/(campaign)/campanha/(app)/nucleos/[slug]/shareRecipientsActions'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Avatar, AvatarFallback } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/button'
import { DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/Spinner'
import type { NucleusShareRecipient } from '@/utilities/nucleusShareRecipients'
import { buildWhatsAppUrl } from '@/utilities/phone'

export const buildNucleusShareMessage = ({
  recipientName,
  senderName,
  nucleusName,
  nucleusUrl,
}: {
  recipientName: string
  senderName: string
  nucleusName: string
  nucleusUrl: string
}): string =>
  `Oi ${recipientName}, aqui é ${senderName} da campanha do Solla. Veja o núcleo ${nucleusName}: ${nucleusUrl}`

const getInitials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toLocaleUpperCase('pt-BR')
}

const RecipientRow = ({
  recipient,
  roleLabel,
  onOpenWhatsApp,
}: {
  recipient: NucleusShareRecipient
  roleLabel: string
  onOpenWhatsApp: (recipient: NucleusShareRecipient) => void
}) => (
  <div className="flex items-center gap-3 py-2">
    <Avatar size="lg">
      <AvatarFallback>{getInitials(recipient.name)}</AvatarFallback>
    </Avatar>
    <div className="min-w-0 flex-1">
      <p className="truncate font-medium">{recipient.name}</p>
      <p className="text-sm text-muted-foreground">{roleLabel}</p>
    </div>
    <Button
      type="button"
      size="sm"
      className="min-h-9 shrink-0 bg-emerald-600 text-white hover:bg-emerald-700"
      onClick={() => onOpenWhatsApp(recipient)}
    >
      <MessageCircleIcon data-icon="inline-start" aria-hidden="true" />
      Abrir
    </Button>
  </div>
)

const RecipientSection = ({
  title,
  roleLabel,
  recipients,
  onOpenWhatsApp,
}: {
  title: string
  roleLabel: string
  recipients: NucleusShareRecipient[]
  onOpenWhatsApp: (recipient: NucleusShareRecipient) => void
}) => {
  if (recipients.length === 0) return null

  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      <div className="divide-y divide-border">
        {recipients.map((recipient) => (
          <RecipientRow
            key={recipient.id}
            recipient={recipient}
            roleLabel={roleLabel}
            onOpenWhatsApp={onOpenWhatsApp}
          />
        ))}
      </div>
    </section>
  )
}

export const ShareNucleusDialog = ({
  data,
  loadError,
  loading,
  nucleusName,
  onRetry,
  senderName,
}: {
  data: NucleusShareRecipientsResult | null
  loadError: boolean
  loading: boolean
  nucleusName: string
  onRetry: () => void
  senderName: string
}) => {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  const openWhatsApp = (recipient: NucleusShareRecipient) => {
    if (!data) return
    const message = buildNucleusShareMessage({
      recipientName: recipient.name,
      senderName,
      nucleusName,
      nucleusUrl: data.nucleusUrl,
    })
    window.open(buildWhatsAppUrl(recipient.phone, message), '_blank', 'noopener,noreferrer')
  }

  const copyLink = async () => {
    if (!data) return
    setCopyError(null)
    try {
      await navigator.clipboard.writeText(data.nucleusUrl)
      setCopied(true)
    } catch {
      setCopyError('Não foi possível copiar o link. Selecione e copie manualmente.')
    }
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-x-hidden overflow-y-auto sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Compartilhar núcleo</DialogTitle>
        <DialogDescription>
          {nucleusName} · envia apenas o link, não concede acesso
        </DialogDescription>
      </DialogHeader>

      {loading ? (
        <div
          className="flex min-h-24 items-center justify-center"
          aria-label="Carregando destinatários"
        >
          <Spinner aria-hidden="true" />
        </div>
      ) : null}

      {loadError ? (
        <div className="flex flex-col gap-3">
          <Alert variant="destructive">
            <AlertTitle>Não foi possível carregar</AlertTitle>
            <AlertDescription>
              Não foi possível listar os destinatários. Tente novamente.
            </AlertDescription>
          </Alert>
          <Button type="button" variant="outline" onClick={onRetry}>
            Tentar novamente
          </Button>
        </div>
      ) : null}

      {copyError ? (
        <Alert variant="destructive" aria-live="polite">
          <AlertTitle>Cópia indisponível</AlertTitle>
          <AlertDescription>{copyError}</AlertDescription>
        </Alert>
      ) : null}

      {data && !loading ? (
        <div className="flex min-w-0 flex-col gap-5">
          <RecipientSection
            title="Com coordenação geral"
            roleLabel="Coord. Geral"
            recipients={data.recipients.general}
            onOpenWhatsApp={openWhatsApp}
          />
          <RecipientSection
            title="Com coordenador"
            roleLabel="Coord. Núcleo"
            recipients={data.recipients.coordinators}
            onOpenWhatsApp={openWhatsApp}
          />
          <RecipientSection
            title="Com liderança"
            roleLabel="Liderança · Engajada"
            recipients={data.recipients.leaderships}
            onOpenWhatsApp={openWhatsApp}
          />

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Copiar link
            </h3>
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                <LinkIcon className="size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{data.nucleusUrl}</span>
              </div>
              <Button
                type="button"
                variant="secondary"
                className="min-h-11 shrink-0"
                onClick={copyLink}
              >
                {copied ? (
                  <CheckIcon data-icon="inline-start" aria-hidden="true" />
                ) : (
                  <CopyIcon data-icon="inline-start" aria-hidden="true" />
                )}
                {copied ? 'Copiado' : 'Copiar'}
              </Button>
            </div>
          </section>
        </div>
      ) : null}
    </DialogContent>
  )
}
