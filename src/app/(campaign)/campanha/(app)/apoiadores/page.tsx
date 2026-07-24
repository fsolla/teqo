import config from '@payload-config'
import { FileUpIcon, PlusIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignListPagination } from '@/components/campaign/CampaignListPagination'
import { CampaignPageShell } from '@/components/campaign/CampaignPageShell'
import { CampaignScopeBadge } from '@/components/campaign/CampaignScopeBadge'
import { SupporterFilters } from '@/components/campaign/SupporterFilters'
import { SupporterList } from '@/components/campaign/SupporterList'
import { SupporterListOverview } from '@/components/campaign/SupporterListOverview'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/Empty'
import { isCampaignCoordinator } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
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
  const { result, state, redirectHref, municipalityOptions, overview } = await loadSupportersPageData(
    payload,
    user,
    rawSearchParams,
  )
  if (redirectHref) redirect(redirectHref)

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Apoiadores</h1>
          <p className="text-muted-foreground">
            Base nominal de apoio com intenção de voto e vínculo opcional a Praças.
          </p>
          <CampaignScopeBadge>
            {isCampaignCoordinator(user)
              ? 'Coordenador Geral · todos os apoiadores'
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

      <SupporterFilters
        key={buildSupporterFiltersKey(state)}
        state={state}
        municipalityOptions={municipalityOptions}
      />

      {result.docs.length ? (
        <>
          {overview ? <SupporterListOverview view={overview} now={now} /> : null}
          <SupporterList
            supporters={result.docs.map((supporter) => toSupporterListItemViewModel(supporter))}
          />
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {result.totalDocs}{' '}
              {result.totalDocs === 1 ? 'apoiador encontrado' : 'apoiadores encontrados'}
            </p>
            <CampaignListPagination
              page={state.page}
              totalPages={result.totalPages}
              hrefForPage={(page) => buildSupporterListHref(state, page)}
            />
          </div>
        </>
      ) : (
        <Empty className="min-h-72 border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchXIcon aria-hidden="true" />
            </EmptyMedia>
            <EmptyTitle>Nenhum apoiador encontrado</EmptyTitle>
            <EmptyDescription>
              Ajuste a busca ou os filtros. Você só vê apoiadores dentro do seu escopo.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild variant="outline" className="min-h-11">
              <Link href="/campanha/apoiadores">Limpar busca e filtros</Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </CampaignPageShell>
  )
}
