import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import config from '@payload-config'
import { FileUpIcon, PlusIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignColumnPickerTrailing } from '@/components/campaign/shared/CampaignColumnPickerTrailing'
import { CampaignListEmptyState } from '@/components/campaign/shared/CampaignListEmptyState'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { SupporterFilters } from '@/components/campaign/supporter/SupporterFilters'
import {
  SupporterList,
  supporterPickerColumns,
} from '@/components/campaign/supporter/SupporterList'
import { SupporterListOverview } from '@/components/campaign/supporter/SupporterListOverview'
import { Button } from '@/components/ui/button'
import { advisorEditingScope, type AdvisorEditingScope } from '@/lib/campaignAdvisorProfile'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { isCampaignCoordinator } from '@/utilities/campaignAccess'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadSupportersPageData } from '@/utilities/supporter/supporterPageData'
import {
  buildSupporterFiltersKey,
  buildSupporterListHref,
  canAccessSupporterArea,
} from '@/utilities/supporter/supporterUi'
import { toSupporterListItemViewModel } from '@/utilities/supporter/supporterViewModels'

export const metadata = campaignPageMetadataFromCatalog('apoiadores')

type SupportersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function SupportersPage({ searchParams }: SupportersPageProps) {
  const [user, payload] = await Promise.all([requireCampaignPageActor(), getPayload({ config })])

  if (!canAccessSupporterArea(user.role)) redirect('/campanha')

  // C142 — the write scope gates the "Novo" and "Importar CSV" buttons.
  const editingScope: AdvisorEditingScope =
    user.role === 'advisor' ? advisorEditingScope(user.visibility, user.editing) : 'tudo'
  const canCreate = editingScope !== 'none'

  const rawSearchParams = await searchParams
  const now = new Date()
  const { result, state, redirectHref, municipalityOptions, overview } =
    await loadSupportersPageData(payload, user, rawSearchParams)
  if (redirectHref) redirect(redirectHref)
  const columnVisibility = await readCampaignColumnVisibility('apoiadores')

  const listBody = (
    <>
      {result.docs.length > 0 && overview ? (
        <SupporterListOverview view={overview} now={now} />
      ) : null}
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
      {result.docs.length > 0 ? (
        <CampaignListFooter
          totalDocs={result.totalDocs}
          singular="apoiador encontrado"
          plural="apoiadores encontrados"
          page={state.page}
          totalPages={result.totalPages}
          hrefForPage={(page) => buildSupporterListHref(state, page)}
        />
      ) : null}
    </>
  )

  return (
    <CampaignPageShell>
      <div className="flex flex-col gap-2 pt-4 sm:flex-row sm:justify-end md:pt-0">
        {isCampaignCoordinator(user) && canCreate ? (
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/campanha/apoiadores/importar">
              <FileUpIcon data-icon="inline-start" aria-hidden="true" />
              Importar CSV
            </Link>
          </Button>
        ) : null}
        {canCreate ? (
          <Button asChild className="min-h-11">
            <Link href="/campanha/apoiadores/novo">
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              Novo
            </Link>
          </Button>
        ) : null}
      </div>

      <CampaignListPendingBoundary>
        <SupporterFilters
          key={buildSupporterFiltersKey(state)}
          state={state}
          municipalityOptions={municipalityOptions}
          trailing={
            <CampaignColumnPickerTrailing
              columnVisibility={columnVisibility}
              columns={supporterPickerColumns}
            />
          }
        />

        <CampaignListResults>{listBody}</CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
