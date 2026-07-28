import config from '@payload-config'
import { MessageCircleIcon, PlusIcon, SearchXIcon } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { LeadershipInviteRowAction } from '@/components/campaign/invite/LeadershipInviteRowAction'
import { LeadershipListSupportStatusControl } from '@/components/campaign/leadership/LeadershipListSupportStatusControl'
import { CampaignCopyableCell } from '@/components/campaign/shared/CampaignCopyableCell'
import { CampaignListEmptyState } from '@/components/campaign/shared/CampaignListEmptyState'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import { CampaignSearchForm } from '@/components/campaign/shared/CampaignSearchForm'
import {
  CampaignTable,
  CampaignTableHead,
  type CampaignTableColumn,
} from '@/components/campaign/shared/CampaignTable'
import {
  LeadershipStateDeputyRelationCell,
  type RelationCellOption,
} from '@/components/campaign/shared/LeadershipStateDeputyRelationCell'
import { MunicipalityPortfolioCell } from '@/components/campaign/shared/MunicipalityPortfolioCell'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import type { MunicipalityPortfolioIndexEntry } from '@/lib/municipalityPortfolio'
import { formatBrazilianPhoneInput, whatsAppHrefForPhone } from '@/lib/phone'
import { MAX_LEADERSHIP_MUNICIPALITIES } from '@/lib/schemas/leadership'
import { getAdvisorMunicipalityIds, isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { loadStateDeputyOptions } from '@/utilities/campaignRelationOptions'
import {
  buildLeadershipListHref,
  loadLeadershipListPageData,
  parseLeadershipListParams,
  type LeadershipRowViewModel,
} from '@/utilities/leadershipData'
import { loadMunicipalityPortfolioIndex } from '@/utilities/municipalityPortfolioIndex'

import {
  setLeadershipMunicipalitiesFormAction,
  setLeadershipStateDeputyMembershipFormAction,
} from './formActions'

type LeadershipsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const leadershipColumns = ({
  stateDeputyOptions,
  municipalityIndex,
  addableMunicipalityIds,
}: {
  stateDeputyOptions: RelationCellOption[]
  municipalityIndex: MunicipalityPortfolioIndexEntry[]
  /** Advisors may only link municipalities they administer; staff: undefined. */
  addableMunicipalityIds?: ReadonlySet<number>
}): Array<CampaignTableColumn<LeadershipRowViewModel>> => [
  {
    id: 'name',
    mandatory: true,
    head: <CampaignTableHead>Nome</CampaignTableHead>,
    cell: (row) => (
      <Link
        href={`/campanha/liderancas/${row.id}`}
        className="inline-flex min-h-11 items-center font-medium text-primary underline-offset-4 hover:underline"
      >
        {row.name}
      </Link>
    ),
  },
  {
    id: 'email',
    head: <CampaignTableHead>E-mail</CampaignTableHead>,
    cellClassName: 'max-w-56',
    cell: (row) => <CampaignCopyableCell value={row.email} label="E-mail" />,
  },
  {
    id: 'phone',
    head: <CampaignTableHead>Celular</CampaignTableHead>,
    cell: (row) => (
      <CampaignCopyableCell
        value={row.phone}
        label="Celular"
        displayValue={row.phone ? formatBrazilianPhoneInput(row.phone) : undefined}
        className="tabular-nums"
      />
    ),
  },
  {
    id: 'supportStatus',
    head: <CampaignTableHead>Status</CampaignTableHead>,
    cell: (row) => (
      <LeadershipListSupportStatusControl leadershipID={row.id} status={row.supportStatus} />
    ),
  },
  {
    id: 'municipalities',
    head: (
      <CampaignTableHead description="Edite aqui: passe o mouse em um chip para remover, ou busque para adicionar. Um território ou ZE entra e sai como um bloco. Cada liderança fica entre 1 e 30 municípios.">
        Municípios
      </CampaignTableHead>
    ),
    cellClassName: 'max-w-64 whitespace-normal',
    cell: (row) => (
      <MunicipalityPortfolioCell
        ownerId={row.id}
        ownerName={row.name}
        municipalityIds={row.municipalityIDs}
        municipalityIndex={municipalityIndex}
        {...(addableMunicipalityIds ? { addableIds: addableMunicipalityIds } : {})}
        minItems={1}
        maxItems={MAX_LEADERSHIP_MUNICIPALITIES}
        commitAction={setLeadershipMunicipalitiesFormAction}
        drawerTitle="Municípios da liderança"
        updateErrorMessage="Não foi possível atualizar os municípios."
      />
    ),
  },
  {
    id: 'organizations',
    head: <CampaignTableHead>Organizações</CampaignTableHead>,
    cellClassName: 'max-w-56 whitespace-normal text-muted-foreground',
    cell: (row) => row.organizationNames.join(', ') || '—',
  },
  {
    id: 'stateDeputies',
    head: <CampaignTableHead>Dobradinhas</CampaignTableHead>,
    cellClassName: 'max-w-56 whitespace-normal',
    cell: (row) => (
      <LeadershipStateDeputyRelationCell
        direction="fromLeadership"
        fixedId={row.id}
        items={row.stateDeputies.map((deputy) => ({
          id: deputy.id,
          label: deputy.name,
          href: `/campanha/dobradinhas/${deputy.slug}`,
          ...(deputy.party ? { party: deputy.party } : {}),
        }))}
        options={stateDeputyOptions}
        membershipAction={setLeadershipStateDeputyMembershipFormAction}
        measureOverflow={false}
      />
    ),
  },
  {
    id: 'appAccess',
    head: <CampaignTableHead>Acesso ao app</CampaignTableHead>,
    cell: (row) => (
      <Badge variant={row.hasAppAccess ? 'estimate-confirmed' : 'outline'}>
        {row.hasAppAccess ? 'Com acesso' : 'Sem acesso'}
      </Badge>
    ),
  },
  {
    id: 'actions',
    head: (
      <CampaignTableHead align="right">
        <span className="sr-only">Ações</span>
      </CampaignTableHead>
    ),
    cellClassName: 'text-right',
    cell: (row) => {
      const whatsAppHref = whatsAppHrefForPhone(row.phone)
      return (
        <div className="inline-flex items-center justify-end gap-1">
          <LeadershipInviteRowAction
            leadershipID={row.id}
            name={row.name}
            hasValidPhone={whatsAppHref !== null}
          />
          {whatsAppHref ? (
            <Button asChild variant="ghost" size="icon" className="size-10">
              <a
                href={whatsAppHref}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Enviar WhatsApp para ${row.name}`}
              >
                <MessageCircleIcon className="size-4" aria-hidden="true" />
              </a>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-10"
              disabled
              aria-label={`WhatsApp indisponível — ${row.name} sem celular`}
            >
              <MessageCircleIcon className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      )
    },
  },
]

export default async function LeadershipsPage({ searchParams }: LeadershipsPageProps) {
  const rawSearchParams = await searchParams
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) redirect('/campanha/login')
  if (!isCampaignStaff(user)) redirect('/campanha')

  const state = parseLeadershipListParams(rawSearchParams)
  const [{ rows, totalDocs, totalPages }, stateDeputyOptions, municipalityIndex, administeredIds] =
    await Promise.all([
      loadLeadershipListPageData(payload, user, state),
      loadStateDeputyOptions(payload, user),
      loadMunicipalityPortfolioIndex(payload),
      user.role === 'advisor' ? getAdvisorMunicipalityIds(payload, user.id) : null,
    ])
  const columns = leadershipColumns({
    stateDeputyOptions: stateDeputyOptions.map((option) => ({
      id: option.id,
      searchLabel: option.name,
      item: {
        id: option.id,
        label: option.plainName,
        href: `/campanha/dobradinhas/${option.slug}`,
        ...(option.party ? { party: option.party } : {}),
      },
    })),
    municipalityIndex,
    ...(administeredIds ? { addableMunicipalityIds: new Set(administeredIds) } : {}),
  })

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Lideranças</h1>
          <p className="text-muted-foreground">
            Uma ficha por pessoa — cada liderança pode atuar em vários municípios e organizações.
          </p>
        </div>
        <Button asChild className="min-h-11">
          <Link href="/campanha/liderancas/nova">
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Nova liderança
          </Link>
        </Button>
      </header>

      <CampaignListPendingBoundary>
        <CampaignSearchForm
          ariaLabel="Buscar liderança por nome"
          placeholder="Buscar por nome…"
          initialQuery={state.q ?? ''}
          basePath="/campanha/liderancas"
        />

        <CampaignListResults>
          {rows.length ? (
            <>
              <CampaignTable columns={columns} rows={rows} rowKey={(row) => row.id} />
              <CampaignListFooter
                totalDocs={totalDocs}
                singular="liderança"
                plural="lideranças"
                page={state.page}
                totalPages={totalPages}
                hrefForPage={(page) => buildLeadershipListHref(state, page)}
              />
            </>
          ) : (
            <CampaignListEmptyState
              icon={SearchXIcon}
              title="Nenhuma liderança encontrada"
              description="Cadastre a primeira liderança ou ajuste a busca. Você só vê lideranças dos seus municípios."
            >
              <Button asChild className="min-h-11">
                <Link href="/campanha/liderancas/nova">
                  <PlusIcon data-icon="inline-start" aria-hidden="true" />
                  Nova liderança
                </Link>
              </Button>
            </CampaignListEmptyState>
          )}
        </CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
