'use client'

import { Share2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  buildHomeSearchDetailUrl,
  buildHomeSearchShareText,
  buildHomeSearchWhatsAppShareHref,
  resolveHomeSearchShareStrategy,
} from '@/lib/homeSearchShare'

const stopRowNavigation = (event: { stopPropagation: () => void }) => {
  event.stopPropagation()
}

export const HomeSearchShareAction = ({
  title,
  detailPath,
}: {
  title: string
  detailPath: string
}) => {
  const handleShare = async () => {
    const absoluteUrl = buildHomeSearchDetailUrl(detailPath)
    const shareText = buildHomeSearchShareText(title, absoluteUrl)
    const strategy = resolveHomeSearchShareStrategy()

    if (strategy === 'native') {
      try {
        await navigator.share({ title, text: shareText, url: absoluteUrl })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        window.open(
          buildHomeSearchWhatsAppShareHref(title, absoluteUrl),
          '_blank',
          'noopener,noreferrer',
        )
      }
      return
    }

    window.open(
      buildHomeSearchWhatsAppShareHref(title, absoluteUrl),
      '_blank',
      'noopener,noreferrer',
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-10 shrink-0"
      aria-label={`Compartilhar — ${title}`}
      onClick={(event) => {
        stopRowNavigation(event)
        void handleShare()
      }}
      onMouseDown={stopRowNavigation}
    >
      <Share2Icon className="size-4" aria-hidden="true" />
    </Button>
  )
}
