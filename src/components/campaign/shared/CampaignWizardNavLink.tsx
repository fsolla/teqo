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
  replace = false,
  className,
  children,
  ...anchorProps
}: Omit<ComponentPropsWithoutRef<'a'>, 'href'> & { href: string; replace?: boolean }) => {
  const { isPending } = useCampaignListTransition()

  return (
    <CampaignTransitionAnchor
      href={href}
      replace={replace}
      className={cn(isPending && 'pointer-events-none', className)}
      aria-busy={isPending || undefined}
      {...anchorProps}
    >
      {children}
    </CampaignTransitionAnchor>
  )
}
