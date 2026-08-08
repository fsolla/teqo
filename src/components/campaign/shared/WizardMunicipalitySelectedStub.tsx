import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { wizardActionHref, wizardReturnHref } from '@/lib/campaignActionRoutes'
import {
  wizardFlowTitleForSlug,
  wizardNextStepPlaceholder,
  wizardNextStepTitle,
} from '@/lib/campaignWizardCopy'

type WizardMunicipalitySelectedStubProps = {
  actionSlug: string
  municipalityName: string
  returnPath?: string
}

export const WizardMunicipalitySelectedStub = ({
  actionSlug,
  municipalityName,
  returnPath,
}: WizardMunicipalitySelectedStubProps) => (
  <CampaignWizardShell
    flowTitle={wizardFlowTitleForSlug(actionSlug)}
    stepTitle={wizardNextStepTitle(actionSlug)}
    isEntryStep={false}
    previousHref={wizardActionHref(actionSlug, undefined, { returnPath })}
    dismissHref={wizardReturnHref(returnPath)}
    municipalityLabel={municipalityName}
  >
    <p className="text-sm text-muted-foreground">{wizardNextStepPlaceholder(actionSlug)}</p>
  </CampaignWizardShell>
)
