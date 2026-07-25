'use client'

import { WhatsAppIcon } from '@/components/socialIcons'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { XIcon } from 'lucide-react'
import { useEffect, useState } from 'react'

interface PetitionSuccessDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  petitionTitle: string
  signatureNumber: number | null
}

const numberFormatter = new Intl.NumberFormat('pt-BR')

export const PetitionSuccessDialog = ({
  open,
  onOpenChange,
  petitionTitle,
  signatureNumber,
}: PetitionSuccessDialogProps) => {
  const [shareUrl, setShareUrl] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setShareUrl(window.location.href)
    }
  }, [])

  const message = `Acabei de assinar o abaixo-assinado "${petitionTitle}". Some sua voz também: ${shareUrl}`
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(message)}`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-theme="petition"
        showCloseButton={false}
        className="gap-0 overflow-hidden border-0 p-0 sm:p-0"
      >
        <div className="relative bg-[var(--petition-hero)] px-6 py-6 text-[var(--petition-hero-foreground)] sm:px-8 sm:py-7">
          <DialogClose
            aria-label="Fechar"
            className="absolute right-3 top-3 inline-flex size-8 items-center justify-center rounded-md text-[var(--petition-hero-foreground)] transition-colors hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <XIcon className="size-4" />
          </DialogClose>
          <DialogTitle className="border-none pb-0 text-xl font-bold leading-tight sm:text-2xl">
            Obrigado por assinar!
          </DialogTitle>
          {signatureNumber !== null ? (
            <p className="mt-2 text-sm text-[var(--petition-hero-muted)] sm:text-base">
              Você é a assinatura nº{' '}
              <span className="font-bold tabular-nums text-[var(--petition-hero-foreground)]">
                {numberFormatter.format(signatureNumber)}
              </span>
              .
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-4 bg-card px-6 py-6 text-card-foreground sm:px-8 sm:py-7">
          <DialogDescription>
            Sua assinatura foi registrada. Compartilhe o abaixo-assinado no WhatsApp para somar mais
            apoiadores.
          </DialogDescription>
          <Button
            asChild
            className="w-full bg-[#25D366] font-semibold text-white hover:bg-[#1ebe5a] hover:text-white"
          >
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <WhatsAppIcon className="size-5" />
              Compartilhar no WhatsApp
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
