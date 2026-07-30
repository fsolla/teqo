import Link from 'next/link'

import { Button } from '@/components/ui/button'
import type { WizardSignalSkipAction } from '@/lib/wizardSignalUi'

type WizardSignalSkipTrailingProps = {
  skip: WizardSignalSkipAction
}

export const WizardSignalSkipTrailing = ({ skip }: WizardSignalSkipTrailingProps) => (
  <Button variant="link" size="sm" className="h-auto px-2 py-1 text-xs" asChild>
    <Link href={skip.href}>{skip.label}</Link>
  </Button>
)
