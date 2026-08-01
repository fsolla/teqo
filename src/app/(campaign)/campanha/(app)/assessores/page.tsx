import { ADVISOR_QUICK_CREATE_PARAM } from '@/lib/campaignAdvisorQuickActions'
import { CAMPAIGN_ADVISORS_HOME } from '@/lib/campaignPaths'
import config from '@payload-config'
import { getPayload } from 'payload'

import { AdvisorsTable } from '@/components/campaign/advisor/AdvisorsTable'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import { CampaignSearchForm } from '@/components/campaign/shared/CampaignSearchForm'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import {
  advisorListHrefForPage,
  loadAdvisorListPageData,
  parseAdvisorListParams,
} from '@/utilities/advisorData'
import { firstValue } from '@/utilities/campaignListUrl'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadMunicipalityPortfolioIndex } from '@/utilities/municipality/municipalityPortfolioIndex'
import {
  createAdvisorFormAction,
  sendAdvisorPasswordResetFormAction,
  setAdvisorMunicipalitiesFormAction,
  updateAdvisorProfileFormAction,
} from './formActions'

type AdvisorsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AdvisorsPage({ searchParams }: AdvisorsPageProps) {
  const rawSearchParams = await searchParams
  const [, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'unrestricted' }),
    getPayload({ config }),
  ])

  const state = parseAdvisorListParams(rawSearchParams)
  const autoCreateDraft = firstValue(rawSearchParams[ADVISOR_QUICK_CREATE_PARAM]) === '1'
  const [{ rows, totalDocs, totalPages }, municipalityIndex] = await Promise.all([
    loadAdvisorListPageData(payload, state),
    loadMunicipalityPortfolioIndex(),
  ])

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Assessores</h1>
        <p className="text-muted-foreground">
          Consulte na tabela; ative Editar para alterar campos e carteira. Nome abre a ficha;
          e-mail/celular copiam; município abre o município.
        </p>
      </header>

      <CampaignListPendingBoundary>
        <CampaignSearchForm
          ariaLabel="Buscar assessor por nome ou e-mail"
          placeholder="Buscar por nome ou e-mail…"
          initialQuery={state.q ?? ''}
          basePath={CAMPAIGN_ADVISORS_HOME}
        />

        <CampaignListResults>
          <AdvisorsTable
            rows={rows}
            municipalityIndex={municipalityIndex}
            hasQuery={Boolean(state.q)}
            updateProfileAction={updateAdvisorProfileFormAction}
            municipalitiesAction={setAdvisorMunicipalitiesFormAction}
            createAction={createAdvisorFormAction}
            passwordResetAction={sendAdvisorPasswordResetFormAction}
            autoCreateDraft={autoCreateDraft}
          />

          {totalDocs > 0 ? (
            <CampaignListFooter
              totalDocs={totalDocs}
              singular="assessor"
              plural="assessores"
              page={state.page}
              totalPages={totalPages}
              hrefForPage={(page) => advisorListHrefForPage(state, page)}
            />
          ) : null}
        </CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
