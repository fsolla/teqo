import React from 'react'

/**
 * Shared shell for the public Posts pages (`/[type]`, `/[type]/[category]`,
 * `/[type]/[category]/[slug]`).
 *
 * The root `(frontend)` layout locks the document with `overflow-hidden`, so
 * every full-viewport page must own an internal scroll container. This wrapper
 * provides that (fixed viewport height + `overflow-y-auto`) and applies the
 * light `editorial` palette so the content area reads as a standard document.
 */
export default function PostsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-theme="editorial"
      className="h-dvh w-full overflow-y-auto bg-background text-foreground"
    >
      {children}
    </div>
  )
}
