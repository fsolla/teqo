import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { Slot } from 'radix-ui'

import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground [a]:hover:bg-primary/80',
        secondary: 'bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80',
        destructive:
          'bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20',
        outline: 'border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground',
        ghost: 'hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50',
        link: 'text-primary underline-offset-4 hover:underline',
        scope: 'border-scope-border bg-scope text-scope-foreground [a]:hover:bg-scope/80',
        tse: 'bg-tse text-tse-foreground [a]:hover:bg-tse/80',
        'support-engaged':
          'bg-support-engaged text-support-engaged-foreground [a]:hover:bg-support-engaged/80',
        'support-to-approach':
          'bg-support-to-approach text-support-to-approach-foreground [a]:hover:bg-support-to-approach/80',
        'support-disputed':
          'bg-support-disputed text-support-disputed-foreground [a]:hover:bg-support-disputed/80',
        'support-negative':
          'bg-support-negative text-support-negative-foreground [a]:hover:bg-support-negative/80',
        'estimate-confirmed':
          'bg-estimate-confirmed text-estimate-confirmed-foreground [a]:hover:bg-estimate-confirmed/80',
        'estimate-pending':
          'bg-estimate-pending text-estimate-pending-foreground [a]:hover:bg-estimate-pending/80',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

const Badge = ({
  className,
  variant = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) => {
  const Comp = asChild ? Slot.Root : 'span'

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
