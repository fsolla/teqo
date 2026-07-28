import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import config from '@payload-config'
import { FileUpIcon, PlusIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignListEmptyState } from '@/components/campaign/shared/CampaignListEmptyState'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import { CampaignScopeBadge } from '@/components/campaign/shared/CampaignScopeBadge'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { SupporterFilters } from '@/components/campaign/supporter/SupporterFilters'
import { SupporterList } from '@/components/campaign/supporter/SupporterList'
import { SupporterListOverview } from '@/components/campaign/supporter/SupporterListOverview'
import { Button } from '@/components/ui/button'
import { isCampaignCoordinator, isCampaignUnrestricted } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import { campaignRoleLabels } from '@/utilities/campaignUserProfile'
import { loadSupportersPageData } from '@/utilities/supporterPageData'
import {
  buildSupporterFiltersKey,
  buildSupporterListHref,
  canAccessSupporterArea,
  getSupporterScopeLabel,
} from '@/utilities/supporterUi'
import { toSupporterListItemViewModel } from '@/utilities/supporterViewModels'

type SupportersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SupportersPage({ searchParams }: SupportersPageProps) {
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])

  if (!user) return null
  if (!canAccessSupporterArea(user.role)) redirect('/campanha')

  const rawSearchParams = await searchParams
  const now = new Date()
  const { result, state, redirectHref, municipalityOptions, overview } =
    await loadSupportersPageData(payload, user, rawSearchParams)
  if (redirectHref) redirect(redirectHref)
  const columnVisibility = await readCampaignColumnVisibility('apoiadores')

  const listBody = result.docs.length ? (
    <>
      {overview ? <SupporterListOverview view={overview} now={now} /> : null}
      <SupporterList
        supporters={result.docs.map((supporter) => toSupporterListItemViewModel(supporter))}
        columnVisibility={columnVisibility}
      />
      <CampaignListFooter
        totalDocs={result.totalDocs}
        singular="apoiador encontrado"
        plural="apoiadores encontrados"
        page={state.page}
        totalPages={result.totalPages}
        hrefForPage={(page) => buildSupporterListHref(state, page)}
      />
    </>
  ) : (
    <CampaignListEmptyState
      icon={SearchXIcon}
      title="Nenhum apoiador encontrado"
      description="Ajuste a busca ou os filtros. Você só vê apoiadores dentro do seu escopo."
    >
      <Button asChild variant="outline" className="min-h-11">
        <Link href="/campanha/apoiadores">Limpar busca e filtros</Link>
      </Button>
    </CampaignListEmptyState>
  )

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Apoiadores</h1>
          <p className="text-muted-foreground">
            Base nominal de apoio com intenção de voto e vínculo opcional a municípios.
          </p>
          <CampaignScopeBadge>
            {isCampaignUnrestricted(user)
              ? `${campaignRoleLabels[user.role]} · todos os apoiadores`
              : getSupporterScopeLabel(result.totalDocs)}
          </CampaignScopeBadge>
        </div>
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
      </header>

      <CampaignListPendingBoundary>
        <SupporterFilters
          key={buildSupporterFiltersKey(state)}
          state={state}
          municipalityOptions={municipalityOptions}
        />

        <CampaignListResults>{listBody}</CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
