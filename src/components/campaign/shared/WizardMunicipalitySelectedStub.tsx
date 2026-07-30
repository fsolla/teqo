import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { wizardActionHref } from '@/lib/campaignActionRoutes'
import { CAMPAIGN_HOME } from '@/lib/campaignPaths'
import {
  wizardFlowTitleForSlug,
  wizardNextStepPlaceholder,
  wizardNextStepTitle,
} from '@/lib/campaignWizardCopy'

type WizardMunicipalitySelectedStubProps = {
  actionSlug: string
  municipalityName: string
}

export const WizardMunicipalitySelectedStub = ({
  actionSlug,
  municipalityName,
}: WizardMunicipalitySelectedStubProps) => (
  <CampaignWizardShell
    flowTitle={wizardFlowTitleForSlug(actionSlug)}
    stepTitle={wizardNextStepTitle(actionSlug)}
    isEntryStep={false}
    previousHref={wizardActionHref(actionSlug)}
    dismissHref={CAMPAIGN_HOME}
    municipalityLabel={municipalityName}
  >
    <p className="text-sm text-muted-foreground">{wizardNextStepPlaceholder(actionSlug)}</p>
  </CampaignWizardShell>
)
