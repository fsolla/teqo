'use client'

import { useRouter } from 'next/navigation'
import {
  createContext,
  useContext,
  useTransition,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type TransitionStartFunction,
} from 'react'

import { cn } from '@/lib/utils'

type CampaignListPendingValue = {
  isPending: boolean
  startTransition: TransitionStartFunction
}

const CampaignListPendingContext = createContext<CampaignListPendingValue | null>(null)

/**
 * Shares one transition between the filter controls (which navigate) and the
 * results region (which must dim while the RSC payload loads) — "Feel the
 * action": optimistic on the control, honest pending on the result.
 *
 * Children stay server-rendered (composition via `children`).
 */
export const CampaignListPendingBoundary = ({ children }: { children: ReactNode }) => {
  const [isPending, startTransition] = useTransition()

  return (
    <CampaignListPendingContext.Provider value={{ isPending, startTransition }}>
      {children}
    </CampaignListPendingContext.Provider>
  )
}

/** Filter controls prefer the shared transition so the results dim with them. */
export const useCampaignListPending = (): CampaignListPendingValue | null =>
  useContext(CampaignListPendingContext)

/**
 * Anchor that navigates through the shared list transition (falling back to a
 * local one), so the results region dims instead of a dead full-page load.
 * Takes only serializable props — safe to render from server components.
 */
export const CampaignTransitionAnchor = ({
  href,
  children,
  ...anchorProps
}: Omit<ComponentPropsWithoutRef<'a'>, 'href' | 'onClick'> & { href: string }) => {
  const router = useRouter()
  const shared = useContext(CampaignListPendingContext)
  const [, startLocalTransition] = useTransition()
  const startTransition = shared?.startTransition ?? startLocalTransition

  return (
    <a
      href={href}
      {...anchorProps}
      onClick={(event) => {
        if (
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return
        }
        event.preventDefault()
        startTransition(() => {
          router.push(href)
        })
      }}
    >
      {children}
    </a>
  )
}

/** Wraps the server-rendered results; dims while a shared navigation is pending. */
export const CampaignListResults = ({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) => {
  const shared = useContext(CampaignListPendingContext)
  const isPending = shared?.isPending ?? false

  return (
    <div
      className={cn(
        'flex flex-col gap-6 transition-opacity data-[pending=true]:opacity-60',
        className,
      )}
      data-pending={isPending || undefined}
      aria-busy={isPending}
    >
      <p className="sr-only" aria-live="polite">
        {isPending ? 'Atualizando resultados…' : ''}
      </p>
      {children}
    </div>
  )
}
