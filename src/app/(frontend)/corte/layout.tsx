import React from 'react'

/**
 * C176 — shared shell for the unlisted public cut page (`/corte/<id>`) and its
 * not-found screen.
 *
 * The root `(frontend)` layout locks the document with `overflow-hidden`, so
 * this segment must own its internal scroll container (also what makes the
 * `SiteHeader` stick). Without a `data-theme`, `/corte` inherited `:root` —
 * whose background is the dark-red body gradient — and the content sat on a
 * tinted surface. Mirroring `[type]/layout.tsx` gives the segment the neutral
 * `editorial` palette and the scroll container in one place.
 */
export default function SpeechCutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-theme="editorial"
      className="h-dvh w-full overflow-y-auto bg-background text-foreground"
    >
      {children}
    </div>
  )
}
