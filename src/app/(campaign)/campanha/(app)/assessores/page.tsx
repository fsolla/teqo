import config from '@payload-config'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import type { ReactNode } from 'react'

import { AdvisorsTable } from '@/components/campaign/advisor/AdvisorsTable'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import { CampaignListPageHeader } from '@/components/campaign/shared/CampaignListPageHeader'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import { CampaignSearchForm } from '@/components/campaign/shared/CampaignSearchForm'
import { OpsListPage } from '@/components/campaign/shared/OpsListPage'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { CAMPAIGN_ADVISORS_HOME } from '@/lib/campaignPaths'
import { resolveListUnifiedEnabled } from '@/lib/opsListRegistry/opsListFlag'
import { advisorListHrefForPage, resolveAdvisorListUrl } from '@/utilities/advisor/advisorListUrl'
import { loadAdvisorListPageData } from '@/utilities/advisorData'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
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
  const canonicalUrl = resolveAdvisorListUrl(rawSearchParams)
  if (canonicalUrl.redirectHref) redirect(canonicalUrl.redirectHref)

  const [, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'unrestricted' }),
    getPayload({ config }),
  ])

  const [{ rows, totalDocs, totalPages }, municipalityIndex, columnVisibility] = await Promise.all([
    loadAdvisorListPageData(payload, canonicalUrl.state),
    loadMunicipalityPortfolioIndex(),
    readCampaignColumnVisibility('assessores'),
  ])

  const resolvedUrl = resolveAdvisorListUrl(rawSearchParams, totalPages)
  if (resolvedUrl.redirectHref) redirect(resolvedUrl.redirectHref)
  const { state } = resolvedUrl

  const tableNode = (
    <AdvisorsTable
      rows={rows}
      municipalityIndex={municipalityIndex}
      hasQuery={Boolean(state.q)}
      columnVisibility={columnVisibility}
      updateProfileAction={updateAdvisorProfileFormAction}
      municipalitiesAction={setAdvisorMunicipalitiesFormAction}
      createAction={createAdvisorFormAction}
      passwordResetAction={sendAdvisorPasswordResetFormAction}
      autoCreateDraft={Boolean(state.autoCreateDraft)}
    />
  )

  const footerNode =
    totalDocs > 0 ? (
      <CampaignListFooter
        totalDocs={totalDocs}
        singular="assessor"
        plural="assessores"
        page={state.page}
        totalPages={totalPages}
        hrefForPage={(page) => advisorListHrefForPage(state, page)}
      />
    ) : null

  const toolbar = (
    <CampaignSearchForm
      ariaLabel="Buscar assessor por nome ou e-mail"
      placeholder="Buscar por nome ou e-mail…"
      initialQuery={state.q ?? ''}
      basePath={CAMPAIGN_ADVISORS_HOME}
    />
  )

  const main: ReactNode = resolveListUnifiedEnabled() ? (
    <OpsListPage
      overview={null}
      toolbar={toolbar}
      table={tableNode}
      empty={null}
      footer={footerNode}
    />
  ) : (
    <CampaignListPendingBoundary>
      {toolbar}
      <CampaignListResults>
        {tableNode}
        {footerNode}
      </CampaignListResults>
    </CampaignListPendingBoundary>
  )

  return (
    <CampaignPageShell>
      <CampaignListPageHeader
        title="Assessores"
        description="Consulte na tabela; ative Editar para alterar campos e carteira. Nome abre a ficha; e-mail/celular copiam; município abre o município."
      />

      {main}
    </CampaignPageShell>
  )
}
