'use client'

import { MessageCircleIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { whatsAppHrefForPhone } from '@/lib/phone'

const stopRowNavigation = (event: { stopPropagation: () => void }) => {
  event.stopPropagation()
}

export const HomeSearchWhatsAppAction = ({
  phone,
  contactName,
}: {
  phone: string | null
  contactName: string
}) => {
  const whatsAppHref = whatsAppHrefForPhone(phone)
  if (!whatsAppHref) return null

  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="size-10 shrink-0"
      onClick={stopRowNavigation}
      onMouseDown={stopRowNavigation}
    >
      <a
        href={whatsAppHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Abrir no WhatsApp — ${contactName}`}
      >
        <MessageCircleIcon className="size-4" aria-hidden="true" />
      </a>
    </Button>
  )
}
