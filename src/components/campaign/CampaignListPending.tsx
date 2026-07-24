'use client'

import {
  createContext,
  useContext,
  useTransition,
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
