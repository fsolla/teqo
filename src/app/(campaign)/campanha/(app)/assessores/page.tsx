import config from '@payload-config'
import { redirect } from 'next/navigation'
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
  loadAdvisorMunicipalityIndex,
  parseAdvisorListParams,
} from '@/utilities/advisorData'
import { isCampaignUnrestricted } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import {
  createAdvisorFormAction,
  sendAdvisorPasswordResetFormAction,
  setAdvisorMunicipalitiesBatchFormAction,
  setAdvisorMunicipalityMembershipFormAction,
  updateAdvisorProfileFormAction,
} from './formActions'

type AdvisorsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function AdvisorsPage({ searchParams }: AdvisorsPageProps) {
  const rawSearchParams = await searchParams
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) redirect('/campanha/login')
  if (!isCampaignUnrestricted(user)) redirect('/campanha')

  const state = parseAdvisorListParams(rawSearchParams)
  const [{ rows, totalDocs, totalPages }, municipalityIndex] = await Promise.all([
    loadAdvisorListPageData(payload, state),
    loadAdvisorMunicipalityIndex(payload),
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
          basePath="/campanha/assessores"
        />

        <CampaignListResults>
          <AdvisorsTable
            rows={rows}
            municipalityIndex={municipalityIndex}
            hasQuery={Boolean(state.q)}
            updateProfileAction={updateAdvisorProfileFormAction}
            membershipAction={setAdvisorMunicipalityMembershipFormAction}
            batchAction={setAdvisorMunicipalitiesBatchFormAction}
            createAction={createAdvisorFormAction}
            passwordResetAction={sendAdvisorPasswordResetFormAction}
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
