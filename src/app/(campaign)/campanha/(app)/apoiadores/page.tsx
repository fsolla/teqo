import config from '@payload-config'
import { FileUpIcon, PlusIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignListEmptyState } from '@/components/campaign/shared/CampaignListEmptyState'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import { CampaignListPageHeader } from '@/components/campaign/shared/CampaignListPageHeader'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import { CampaignScopeBadge } from '@/components/campaign/shared/CampaignScopeBadge'
import { OpsListPage } from '@/components/campaign/shared/OpsListPage'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { SupporterFilters } from '@/components/campaign/supporter/SupporterFilters'
import { SupporterList } from '@/components/campaign/supporter/SupporterList'
import { SupporterListOverview } from '@/components/campaign/supporter/SupporterListOverview'
import { Button } from '@/components/ui/button'
import { resolveListUnifiedEnabled } from '@/lib/opsListRegistry/opsListFlag'
import { isCampaignCoordinator, isCampaignUnrestricted } from '@/utilities/campaignAccess'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { campaignRoleLabels } from '@/utilities/campaignUserProfile'
import { loadSupportersPageData } from '@/utilities/supporter/supporterPageData'
import {
  buildSupporterFiltersKey,
  buildSupporterListHref,
  canAccessSupporterArea,
  getSupporterScopeLabel,
} from '@/utilities/supporter/supporterUi'
import { toSupporterListItemViewModel } from '@/utilities/supporter/supporterViewModels'

type SupportersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SupportersPage({ searchParams }: SupportersPageProps) {
  const [user, payload] = await Promise.all([requireCampaignPageActor(), getPayload({ config })])

  if (!canAccessSupporterArea(user.role)) redirect('/campanha')

  const rawSearchParams = await searchParams
  const now = new Date()
  const { result, state, redirectHref, municipalityOptions, overview } =
    await loadSupportersPageData(payload, user, rawSearchParams)
  if (redirectHref) redirect(redirectHref)
  const columnVisibility = await readCampaignColumnVisibility('apoiadores')

  const overviewNode =
    result.docs.length > 0 && overview ? <SupporterListOverview view={overview} now={now} /> : null

  const toolbarNode = (
    <SupporterFilters
      key={buildSupporterFiltersKey(state)}
      state={state}
      municipalityOptions={municipalityOptions}
    />
  )

  const tableNode = (
    <SupporterList
      supporters={result.docs.map((supporter) => toSupporterListItemViewModel(supporter))}
      columnVisibility={columnVisibility}
      empty={
        <CampaignListEmptyState
          icon={SearchXIcon}
          title="Nenhum apoiador encontrado"
          description="Ajuste a busca ou os filtros. Você só vê apoiadores dentro do seu escopo."
        >
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/campanha/apoiadores">Limpar busca e filtros</Link>
          </Button>
        </CampaignListEmptyState>
      }
    />
  )

  const footerNode =
    result.docs.length > 0 ? (
      <CampaignListFooter
        totalDocs={result.totalDocs}
        singular="apoiador encontrado"
        plural="apoiadores encontrados"
        page={state.page}
        totalPages={result.totalPages}
        hrefForPage={(page) => buildSupporterListHref(state, page)}
      />
    ) : null

  const main = resolveListUnifiedEnabled() ? (
    <OpsListPage
      overview={overviewNode}
      toolbar={toolbarNode}
      table={tableNode}
      empty={null}
      footer={footerNode}
    />
  ) : (
    <CampaignListPendingBoundary>
      {toolbarNode}
      <CampaignListResults>
        {overviewNode}
        {tableNode}
        {footerNode}
      </CampaignListResults>
    </CampaignListPendingBoundary>
  )

  return (
    <CampaignPageShell>
      <CampaignListPageHeader
        title="Apoiadores"
        description="Base nominal de apoio com intenção de voto e vínculo opcional a municípios."
        scope={
          <CampaignScopeBadge>
            {isCampaignUnrestricted(user)
              ? `${campaignRoleLabels[user.role]} · todos os apoiadores`
              : getSupporterScopeLabel(result.totalDocs)}
          </CampaignScopeBadge>
        }
        actions={
          <div className="flex flex-col gap-2 sm:flex-row">
            {isCampaignCoordinator(user) ? (
              <Button asChild variant="outline" className="min-h-11">
                <Link href="/campanha/apoiadores/importar">
                  <FileUpIcon data-icon="inline-start" aria-hidden="true" />
                  Importar CSV
                </Link>
              </Button>
            ) : null}
            <Button asChild className="min-h-11">
              <Link href="/campanha/apoiadores/novo">
                <PlusIcon data-icon="inline-start" aria-hidden="true" />
                Novo
              </Link>
            </Button>
          </div>
        }
      />

      {main}
    </CampaignPageShell>
  )
}
