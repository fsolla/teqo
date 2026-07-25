import type { ComponentProps, ReactNode } from 'react'

import { CampaignLogo } from '@/components/campaign/shell/campaign-logo'
import { cn } from '@/lib/utils'

type CampaignAuthPageShellProps = {
  children: ReactNode
  className?: string
} & Omit<ComponentProps<'main'>, 'children' | 'className'>

export const CampaignAuthPageShell = ({
  children,
  className,
  ...props
}: CampaignAuthPageShellProps) => (
  <main
    className={cn(
      'flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10',
      className,
    )}
    {...props}
  >
    <div className="flex w-full max-w-sm flex-col gap-6">
      <CampaignLogo className="mx-auto w-40 max-w-full bg-primary" />
      {children}
    </div>
  </main>
)
