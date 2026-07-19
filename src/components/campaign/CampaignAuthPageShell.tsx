import { Megaphone } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

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
      <div className="flex items-center gap-2 self-center font-semibold">
        <div className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Megaphone className="size-4" aria-hidden="true" />
        </div>
        Campanha
      </div>
      {children}
    </div>
  </main>
)
