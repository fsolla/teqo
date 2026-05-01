import { cn } from '@/lib/utils'
import { ComponentProps } from 'react'

function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-8 w-full min-w-0 rounded-full border border-[var(--field-border)] bg-[var(--field-background)] p-4 py-5 text-base text-[var(--field-foreground)] transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--field-foreground)] placeholder:text-[var(--field-placeholder)] focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-[var(--field-disabled-background)] disabled:text-[var(--field-disabled-foreground)] disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
