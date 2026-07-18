'use client'

import { useState } from 'react'
import { CopyIcon, MessageCircleIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { buildWhatsAppUrl } from '@/utilities/phone'

export const SupporterShareKit = ({
  supporterName,
  siteUrl,
  phone,
}: {
  supporterName: string
  siteUrl: string
  phone: string
}) => {
  const [copied, setCopied] = useState(false)
  const message = `Olá! ${supporterName}, conheça a campanha do deputado Jorge Solla: ${siteUrl}`

  const copyMessage = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      toast.success('Texto copiado.')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Não foi possível copiar o texto.')
    }
  }

  let whatsAppHref: string | null = null
  try {
    whatsAppHref = buildWhatsAppUrl(phone, message)
  } catch {
    whatsAppHref = null
  }

  return (
    <section className="rounded-[6px] border bg-card p-4" aria-labelledby="share-kit-title">
      <h2 id="share-kit-title" className="font-medium">
        Kit de compartilhamento
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Compartilhe individualmente — não use para disparo em massa (vedado pelo TSE).
      </p>

      <Alert className="mt-4">
        <AlertDescription>
          Envie apenas para contatos que autorizaram contato. A campanha não realiza disparos
          automatizados.
        </AlertDescription>
      </Alert>

      <Textarea
        readOnly
        value={message}
        className="mt-4 min-h-24 rounded-[6px]"
        aria-label="Mensagem template para compartilhamento"
      />

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        {whatsAppHref ? (
          <Button asChild className="min-h-11">
            <a href={whatsAppHref} target="_blank" rel="noopener noreferrer">
              <MessageCircleIcon data-icon="inline-start" aria-hidden="true" />
              Enviar no WhatsApp
            </a>
          </Button>
        ) : null}
        <Button type="button" variant="outline" className="min-h-11" onClick={copyMessage}>
          <CopyIcon data-icon="inline-start" aria-hidden="true" />
          {copied ? 'Copiado' : 'Copiar texto'}
        </Button>
      </div>
    </section>
  )
}
