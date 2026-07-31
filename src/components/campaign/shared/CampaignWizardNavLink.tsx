'use client'

import type { ComponentPropsWithoutRef } from 'react'

import {
  CampaignTransitionAnchor,
  useCampaignListTransition,
} from '@/components/campaign/shared/CampaignListPending'
import { cn } from '@/lib/utils'

/**
 * Wizard route navigation with shared list pending: drives the layout boundary
 * and locks sibling triggers while the RSC payload loads.
 */
export const CampaignWizardNavLink = ({
  href,
  className,
  children,
  ...anchorProps
}: Omit<ComponentPropsWithoutRef<'a'>, 'href'> & { href: string }) => {
  const { isPending } = useCampaignListTransition()

  return (
    <CampaignTransitionAnchor
      href={href}
      className={cn(isPending && 'pointer-events-none', className)}
      aria-busy={isPending || undefined}
      {...anchorProps}
    >
      {children}
    </CampaignTransitionAnchor>
  )
}
