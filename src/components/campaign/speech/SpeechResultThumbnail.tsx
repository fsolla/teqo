'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * C175/C182 — the trecho thumbnail on the acervo list: a fixed 128×80 slot so
 * the lazy image never shifts the card, with the skeleton filling it until the
 * image paints (a missing image settles into the neutral slot). The link reuses
 * the card's watch target, with the same accessible name as the CTA.
 * C192 — theme results take the full width on mobile (`h-28`), like the gate.
 */
export const SpeechResultThumbnail = ({
  href,
  src,
  label,
  fullWidthOnMobile = false,
}: {
  href: string
  src: string
  label: string
  fullWidthOnMobile?: boolean
}) => {
  const [settled, setSettled] = useState(false)
  const imageRef = useRef<HTMLImageElement>(null)

  // A cached image can finish before hydration, when `onLoad` never fires.
  useEffect(() => {
    if (imageRef.current?.complete) setSettled(true)
  }, [])

  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        'relative block shrink-0 overflow-hidden rounded-lg border bg-muted',
        fullWidthOnMobile ? 'h-28 w-full md:h-20 md:w-32' : 'h-20 w-32',
      )}
    >
      {settled ? null : <Skeleton className="absolute inset-0 rounded-lg" />}
      {/* eslint-disable-next-line @next/next/no-img-element -- external static image (poster route or YouTube cover). */}
      <img
        ref={imageRef}
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={() => setSettled(true)}
        onError={() => setSettled(true)}
        className="h-full w-full object-cover"
      />
    </Link>
  )
}
