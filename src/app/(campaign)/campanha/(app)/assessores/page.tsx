import { ADVISOR_QUICK_CREATE_PARAM } from '@/lib/campaignAdvisorQuickActions'
import config from '@payload-config'
import { getPayload } from 'payload'

import { AdvisorFilters } from '@/components/campaign/advisor/AdvisorFilters'
import { AdvisorsTable } from '@/components/campaign/advisor/AdvisorsTable'
import { CampaignColumnPickerTrailing } from '@/components/campaign/shared/CampaignColumnPickerTrailing'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import {
  toCampaignColumnPickerColumns,
  type CampaignColumnPickerColumn,
} from '@/lib/campaignColumnVisibility'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { getMunicipalityCatalogEntry } from '@/lib/municipalityCatalog'
import { hasAdvisorListActiveFilters } from '@/utilities/advisor/advisorListFilters'
import {
  advisorListHrefForPage,
  loadAdvisorListPageData,
  parseAdvisorListParams,
} from '@/utilities/advisorData'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import { firstValue } from '@/utilities/campaignListUrl'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadMunicipalityPortfolioIndex } from '@/utilities/municipality/municipalityPortfolioIndex'
import {
  createAdvisorFormAction,
  sendAdvisorPasswordResetFormAction,
  setAdvisorMunicipalitiesFormAction,
  updateAdvisorProfileFormAction,
} from './formActions'

export const metadata = campaignPageMetadataFromCatalog('assessores')

type AdvisorsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

// B197 — labels mirror the `<th>` copy of `AdvisorsTable`; the table's own
// columns are hand-rolled (not `CampaignTableColumn`), so the picker menu is
// spelled out here instead of derived.
const advisorPickerColumns: readonly CampaignColumnPickerColumn[] = [
  { id: 'name', label: 'Nome', mandatory: true },
  { id: 'email', label: 'E-mail' },
  { id: 'phone', label: 'Celular' },
  { id: 'municipalities', label: 'Municípios' },
  { id: 'actions', label: 'Ações' },
]

export default async function AdvisorsPage({ searchParams }: AdvisorsPageProps) {
  const rawSearchParams = await searchParams
  const [, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'unrestricted' }),
    getPayload({ config }),
  ])

  const state = parseAdvisorListParams(rawSearchParams)
  const autoCreateDraft = firstValue(rawSearchParams[ADVISOR_QUICK_CREATE_PARAM]) === '1'
  const [columnVisibility, { rows, totalDocs, totalPages }, municipalityIndex] = await Promise.all([
    readCampaignColumnVisibility('assessores'),
    loadAdvisorListPageData(payload, state),
    loadMunicipalityPortfolioIndex(),
  ])

  const municipalityFilterOptions = municipalityIndex.map((entry) => ({
    value: String(entry.id),
    label: getMunicipalityCatalogEntry(entry.slug)?.name ?? entry.slug,
  }))

  const hasActiveFilters = hasAdvisorListActiveFilters(state)

  return (
    <CampaignPageShell>
      <CampaignListPendingBoundary>
        <AdvisorFilters
          state={state}
          municipalityFilterOptions={municipalityFilterOptions}
          trailing={
            <CampaignColumnPickerTrailing
              columnVisibility={columnVisibility}
              columns={toCampaignColumnPickerColumns(advisorPickerColumns)}
            />
          }
        />

        <CampaignListResults>
          <AdvisorsTable
            rows={rows}
            municipalityIndex={municipalityIndex}
            hasQuery={hasActiveFilters}
            columnVisibility={columnVisibility}
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
