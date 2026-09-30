import { cn } from '@/lib/utils'
import { Loader2Icon } from 'lucide-react'

export const Spinner = ({ className, ...props }: React.ComponentProps<'svg'>) => (
  <Loader2Icon
    data-slot="spinner"
    role="status"
    aria-label="Carregando"
    className={cn('size-4 animate-spin motion-reduce:animate-none', className)}
    {...props}
  />
)
