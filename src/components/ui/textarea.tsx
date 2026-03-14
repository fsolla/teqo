import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'flex field-sizing-content min-h-16 w-full rounded-xl border border-white/80 bg-white px-4 py-2 text-base text-black transition-colors outline-none placeholder:text-black/80 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:bg-white/70 disabled:text-black/70 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
