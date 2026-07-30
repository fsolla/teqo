'use client'

import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useId, useRef, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type CampaignWizardShellProps = {
  stepTitle: string
  previousHref: string
  municipalityLabel?: string
  trailingAction?: ReactNode
  contentAlign?: 'start' | 'end'
  children: ReactNode
}

export const CampaignWizardShell = ({
  stepTitle,
  previousHref,
  municipalityLabel,
  trailingAction,
  contentAlign = 'start',
  children,
}: CampaignWizardShellProps) => {
  const titleRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()

  useEffect(() => {
    titleRef.current?.focus()
  }, [stepTitle])

  return (
    <div className="flex min-h-full w-full flex-col">
      <header className="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="relative flex min-h-11 items-center justify-center gap-2 px-2 pb-1 pt-[max(0.25rem,env(safe-area-inset-top))]">
          <div
            className="absolute left-0 top-1/2 -translate-y-1/2 md:hidden"
            data-slot="wizard-mobile-back"
          >
            <Button variant="ghost" size="sm" className="min-h-11 gap-1 px-2" asChild>
              <Link href={previousHref}>
                <ArrowLeft className="size-4 shrink-0" aria-hidden />
                Voltar
              </Link>
            </Button>
          </div>
          {municipalityLabel ? (
            <p
              className="max-w-[min(100%,14rem)] truncate px-12 text-center text-sm text-muted-foreground sm:max-w-md"
              aria-label={`Município em atualização: ${municipalityLabel}`}
            >
              {municipalityLabel}
            </p>
          ) : null}
          {trailingAction ? (
            <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center">
              {trailingAction}
            </div>
          ) : null}
        </div>
      </header>

      <main
        aria-labelledby={titleId}
        className={cn(
          'flex flex-1 flex-col gap-6 py-6 md:justify-start',
          contentAlign === 'end' ? 'justify-end md:justify-start' : 'justify-start',
        )}
      >
        <h1
          ref={titleRef}
          id={titleId}
          tabIndex={-1}
          className="text-xl font-semibold tracking-tight outline-none md:text-2xl"
        >
          {stepTitle}
        </h1>
        {children}
      </main>
    </div>
  )
}
