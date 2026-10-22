'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useRef, useState } from 'react'

import { PUBLIC_FOCUS, PUBLIC_PATHS } from '@/lib/publicSite'
import { cn } from '@/lib/utils'

type CampaignMobileMenuProps = {
  variant: 'home' | 'internal'
  current?: 'artigos' | 'fotos'
}

const iconClassName = 'size-[22px]'

const HamburguerIcon = () => (
  <svg
    aria-hidden="true"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    className={iconClassName}
  >
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
)

const CloseIcon = () => (
  <svg
    aria-hidden="true"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    className={iconClassName}
  >
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
)

/**
 * S47 — the public mobile menu (design scene 01/02/05): a real disclosure, not
 * a modal. The trigger toggles the panel, closes on X, link, outside click and
 * Escape, moves focus to the first link when it opens and returns it to the
 * trigger when it closes. Desktop keeps the inline nav, so this island mounts
 * only below `lg`.
 */
export const CampaignMobileMenu = ({ variant, current }: CampaignMobileMenuProps) => {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()
  const isHome = variant === 'home'
  const menuLinks = [
    { label: 'Artigos', href: PUBLIC_PATHS.artigos, key: 'artigos' as const },
    { label: 'Bandeiras', href: isHome ? '#bandeiras' : '/#bandeiras' },
    { label: 'Fotos', href: PUBLIC_PATHS.fotos, key: 'fotos' as const },
    { label: 'Início', href: PUBLIC_PATHS.home },
  ]

  const close = useCallback((moveFocus = true) => {
    setOpen(false)
    if (moveFocus) triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return

    const firstLink = panelRef.current?.querySelector<HTMLElement>('[data-menu-link]')
    firstLink?.focus()

    const handlePointerDown = (event: PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node)) return
      close(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        close()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, close])

  const triggerClassName = cn(
    'flex size-11 items-center justify-center rounded-[8px]',
    isHome
      ? 'border border-white/30 text-white'
      : 'border border-(--campaign-line) text-(--pt-red)',
    PUBLIC_FOCUS,
    'lg:hidden',
  )
  const panelClassName = cn(
    'absolute inset-x-0 top-full z-50 border-b px-5 py-5 shadow-[0_18px_36px_rgb(71_19_14/18%)]',
    isHome
      ? 'border-(--campaign-line) bg-(--campaign-cream) text-[#211b19]'
      : 'border-(--campaign-line) bg-white text-[#211b19]',
    'lg:hidden',
  )
  const linkClassName = cn(
    'flex min-h-12 items-center rounded-sm border-b border-(--campaign-line) font-[family-name:var(--font-exo2)] text-base font-bold',
    PUBLIC_FOCUS,
  )

  return (
    <div ref={containerRef} className="lg:hidden">
      <button
        ref={triggerRef}
        type="button"
        aria-label={open ? 'Fechar menu' : 'Abrir menu'}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
        className={triggerClassName}
      >
        {open ? <CloseIcon /> : <HamburguerIcon />}
      </button>

      <div ref={panelRef} id={panelId} hidden={!open} className={panelClassName}>
        <div className="flex items-center justify-between border-b border-(--campaign-line) pb-3">
          <p className="m-0 font-[family-name:var(--font-exo2)] text-sm font-extrabold text-(--pt-red)">
            Menu
          </p>
          <button
            type="button"
            aria-label="Fechar painel"
            onClick={() => close()}
            className={cn(
              'flex size-11 items-center justify-center rounded-[8px] border border-(--campaign-line) text-(--pt-red)',
              PUBLIC_FOCUS,
            )}
          >
            <CloseIcon />
          </button>
        </div>
        <nav aria-label="Navegação móvel" className="mt-2 grid">
          {menuLinks.map((link) => {
            const isCurrent = 'key' in link && link.key === current
            const className = cn(
              linkClassName,
              isCurrent && 'text-(--pt-red)',
              link.label === 'Início' && 'border-b-0',
            )
            return link.href.startsWith('/') ? (
              <Link
                key={link.label}
                data-menu-link
                href={link.href}
                aria-current={isCurrent ? 'page' : undefined}
                onClick={() => close()}
                className={className}
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.label}
                data-menu-link
                href={link.href}
                onClick={() => close()}
                className={className}
              >
                {link.label}
              </a>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
