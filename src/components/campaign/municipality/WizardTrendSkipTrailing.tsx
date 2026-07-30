import Link from 'next/link'

import { Button } from '@/components/ui/button'
import type { WizardTrendSkipAction } from '@/lib/politicalTrendWizardUi'

type WizardTrendSkipTrailingProps = {
  skip: WizardTrendSkipAction
}

export const WizardTrendSkipTrailing = ({ skip }: WizardTrendSkipTrailingProps) => (
  <Button variant="link" size="sm" className="h-auto px-2 py-1 text-xs" asChild>
    <Link href={skip.href}>{skip.label}</Link>
  </Button>
)
