'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { Skeleton } from '@/components/ui/skeleton'

/**
 * C175 — the trecho thumbnail on the acervo list: a fixed 128×80 slot so the
 * lazy image never shifts the card, with the skeleton filling it until the
 * cover paints (a missing cover settles into the neutral slot). The link
 * reuses the card's watch target, with the same accessible name as the CTA.
 */
export const SpeechResultThumbnail = ({
  href,
  src,
  label,
}: {
  href: string
  src: string
  label: string
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
      className="relative block h-20 w-32 shrink-0 overflow-hidden rounded-lg border bg-muted"
    >
      {settled ? null : <Skeleton className="absolute inset-0 rounded-lg" />}
      {/* eslint-disable-next-line @next/next/no-img-element -- YouTube cover is an external static image. */}
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
