import { CampaignWizardShell } from '@/components/campaign/shared/CampaignWizardShell'
import { wizardActionHref } from '@/lib/campaignActionRoutes'
import {
  wizardFlowTitleForSlug,
  wizardNextStepPlaceholder,
  wizardNextStepTitle,
} from '@/lib/campaignWizardCopy'
import { wizardChainEndHref } from '@/lib/wizardActionChain'

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
    dismissHref={wizardChainEndHref(returnPath)}
    municipalityLabel={municipalityName}
  >
    <p className="text-sm text-muted-foreground">{wizardNextStepPlaceholder(actionSlug)}</p>
  </CampaignWizardShell>
)
