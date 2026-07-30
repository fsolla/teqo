import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { CAMPAIGN_HOME } from '@/lib/campaignPaths'
import {
  WIZARD_MUNICIPALITY_STEP_PLACEHOLDER,
  WIZARD_MUNICIPALITY_STEP_TITLE,
} from '@/lib/campaignWizardCopy'

export const WizardMunicipalityPlaceholderStep = () => (
  <CampaignWizardShell stepTitle={WIZARD_MUNICIPALITY_STEP_TITLE} previousHref={CAMPAIGN_HOME}>
    <p className="text-sm text-muted-foreground">{WIZARD_MUNICIPALITY_STEP_PLACEHOLDER}</p>
  </CampaignWizardShell>
)
