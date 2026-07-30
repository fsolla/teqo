import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { wizardActionHref } from '@/lib/campaignActionRoutes'
import { wizardNextStepPlaceholder, wizardNextStepTitle } from '@/lib/campaignWizardCopy'

type WizardMunicipalitySelectedStubProps = {
  actionSlug: string
  municipalityName: string
}

export const WizardMunicipalitySelectedStub = ({
  actionSlug,
  municipalityName,
}: WizardMunicipalitySelectedStubProps) => (
  <CampaignWizardShell
    stepTitle={wizardNextStepTitle(actionSlug)}
    previousHref={wizardActionHref(actionSlug)}
    municipalityLabel={municipalityName}
  >
    <p className="text-sm text-muted-foreground">{wizardNextStepPlaceholder(actionSlug)}</p>
  </CampaignWizardShell>
)
