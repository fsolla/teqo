import { CampaignWizardNavLink } from '@/components/campaign/shared/CampaignWizardNavLink'
import { Button } from '@/components/ui/button'
import type { WizardUpdateSkipAction } from '@/lib/wizardUpdateUi'

type WizardSkipTrailingProps = {
  skip: WizardUpdateSkipAction
}

export const WizardSkipTrailing = ({ skip }: WizardSkipTrailingProps) => (
  <Button variant="link" size="sm" className="h-auto px-2 py-1 text-xs" asChild>
    <CampaignWizardNavLink href={skip.href}>{skip.label}</CampaignWizardNavLink>
  </Button>
)
