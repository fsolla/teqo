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

/** Filter controls prefer the shared transition so the results dim with them. */
export const useCampaignListPending = (): CampaignListPendingValue | null =>
  useContext(CampaignListPendingContext)

/** Dims while a shared list navigation is pending; safe to render from RSC. */
export const CampaignTransitionAnchor = forwardRef<
  HTMLAnchorElement,
  Omit<ComponentPropsWithoutRef<'a'>, 'href' | 'onClick'> & {
    href: string
    replace?: boolean
    scroll?: boolean
  }
>(function CampaignTransitionAnchor(
  { href, children, replace = false, scroll = true, ...anchorProps },
  ref,
) {
  const router = useRouter()
  const shared = useContext(CampaignListPendingContext)
  const [, startLocalTransition] = useTransition()
  const startTransition = shared?.startTransition ?? startLocalTransition

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
