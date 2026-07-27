'use client'

import { useRouter } from 'next/navigation'
import {
  createContext,
  forwardRef,
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

/**
 * The transition a navigating control should drive: the page-level boundary
 * when there is one — so the results region dims with the control — and a local
 * one otherwise, for controls rendered outside a boundary.
 */
export const useCampaignListTransition = (): CampaignListPendingValue => {
  const shared = useContext(CampaignListPendingContext)
  const [isLocalPending, startLocalTransition] = useTransition()

  return {
    isPending: shared?.isPending ?? isLocalPending,
    startTransition: shared?.startTransition ?? startLocalTransition,
  }
}

/** Dims while a shared list navigation is pending; safe to render from RSC. */
export const CampaignTransitionAnchor = forwardRef<
  HTMLAnchorElement,
  Omit<ComponentPropsWithoutRef<'a'>, 'href' | 'onClick'> & {
    href: string
    replace?: boolean
    scroll?: boolean
    /**
     * Optimistic hook, fired inside the navigation transition (so
     * `useOptimistic` setters are legal here) and only after this click commits
     * to `href`: a control whose `href` derives from optimistic state must not
     * invert itself before the navigation it is about to trigger.
     */
    onNavigate?: () => void
  }
>(function CampaignTransitionAnchor(
  { href, children, replace = false, scroll = true, onNavigate, ...anchorProps },
  ref,
) {
  const router = useRouter()
  const { startTransition } = useCampaignListTransition()

  return (
    <a
      ref={ref}
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
          onNavigate?.()
          if (replace) router.replace(href, { scroll })
          else router.push(href, { scroll })
        })
      }}
    >
      {children}
    </a>
  )
})

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
