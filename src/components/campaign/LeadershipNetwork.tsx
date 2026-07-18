import Link from 'next/link'
import { CheckCircle2Icon, PlusIcon, UserRoundIcon } from 'lucide-react'

import {
  createLeadershipFormAction,
  updateLeadershipFormAction,
} from '@/app/(campaign)/campanha/(app)/nucleos/[slug]/leadershipFormActions'
import { CampaignSearchInput } from '@/components/campaign/CampaignSearchInput'
import { LeadershipDetail } from '@/components/campaign/LeadershipDetail'
import { LeadershipFormLazy } from '@/components/campaign/LeadershipFormLazy'
import { LeadershipList } from '@/components/campaign/LeadershipList'
import { LeadershipPanelIsland } from '@/components/campaign/LeadershipPanelIsland'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/Empty'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/Pagination'
import {
  buildLeadershipFilterHref,
  buildLeadershipPanelHref,
  formatLeadershipPhone,
  getLeadershipPanelFocusTargetId,
  leadershipSectorLabels,
  type LeadershipFilterState,
  type LeadershipPanelState,
} from '@/utilities/leadershipUi'
import {
  toLeadershipEditViewModel,
  type LeadershipSelfViewModel,
  type LeadershipStaffViewModel,
  type SelfLeadershipPageData,
  type StaffLeadershipPageData,
} from '@/utilities/leadershipViewModels'

const LeadershipSelfProfile = ({ leaderships }: { leaderships: LeadershipSelfViewModel[] }) => {
  const leadership = leaderships[0]
  if (!leadership) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UserRoundIcon aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Sua ficha não está disponível</EmptyTitle>
          <EmptyDescription>
            Peça à coordenação para revisar seu vínculo com este núcleo.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <section className="rounded-xl border bg-card p-4" aria-labelledby="self-profile-title">
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="self-profile-title" className="font-semibold">
          Sua ficha
        </h2>
        {leadership.confirmedByPerson ? (
          <Badge variant="estimate-confirmed">
            <CheckCircle2Icon data-icon="inline-start" aria-hidden="true" />
            Cadastro confirmado
          </Badge>
        ) : null}
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium">Nome</dt>
          <dd className="text-muted-foreground">{leadership.name}</dd>
        </div>
        <div>
          <dt className="font-medium">Celular</dt>
          <dd className="text-muted-foreground">{formatLeadershipPhone(leadership.phone)}</dd>
        </div>
        <div>
          <dt className="font-medium">Setor</dt>
          <dd className="text-muted-foreground">
            {leadership.sector ? leadershipSectorLabels[leadership.sector] : 'Não informado'}
          </dd>
        </div>
        <div>
          <dt className="font-medium">E-mail</dt>
          <dd className="break-all text-muted-foreground">{leadership.email ?? 'Não informado'}</dd>
        </div>
      </dl>
    </section>
  )
}

const LeadershipFilters = ({ filters }: { filters: LeadershipFilterState }) => (
  <form method="get" className="flex flex-col gap-3" aria-label="Filtros de lideranças">
    <input type="hidden" name="tab" value="leaderships" />
    <div className="flex flex-col gap-2 sm:flex-row">
      <CampaignSearchInput
        id="leadership-search"
        name="leadershipQ"
        label="Buscar liderança"
        defaultValue={filters.q}
        placeholder="Buscar liderança ou celular"
        enterKeyHint="search"
      />
      <Button type="submit" variant="outline" className="min-h-11">
        Buscar
      </Button>
    </div>
    <FieldGroup className="grid gap-3 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="leadership-status-filter">Status de apoio</FieldLabel>
        <NativeSelect
          id="leadership-status-filter"
          name="leadershipStatus"
          defaultValue={filters.status ?? ''}
          className="w-full **:data-[slot=native-select]:min-h-11"
        >
          <NativeSelectOption value="">Todos os status</NativeSelectOption>
          <NativeSelectOption value="engajado">Engajados</NativeSelectOption>
          <NativeSelectOption value="a_abordar">A abordar</NativeSelectOption>
          <NativeSelectOption value="em_disputa">Em disputa</NativeSelectOption>
          <NativeSelectOption value="negativo">Negativos</NativeSelectOption>
        </NativeSelect>
      </Field>
      <Field>
        <FieldLabel htmlFor="leadership-sector-filter">Setor</FieldLabel>
        <NativeSelect
          id="leadership-sector-filter"
          name="leadershipSector"
          defaultValue={filters.sector ?? ''}
          className="w-full **:data-[slot=native-select]:min-h-11"
        >
          <NativeSelectOption value="">Todos os setores</NativeSelectOption>
          {Object.entries(leadershipSectorLabels).map(([value, label]) => (
            <NativeSelectOption key={value} value={value}>
              {label}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
    </FieldGroup>
  </form>
)

export const LeadershipNetwork = ({
  filters,
  inviteConsentConfigured,
  nucleusId,
  nucleusSlug,
  pageData,
  panelState,
  primaryContactId,
  selectedLeadership,
}: {
  filters: LeadershipFilterState
  inviteConsentConfigured: boolean
  nucleusId: number
  nucleusSlug: string
  pageData: StaffLeadershipPageData | SelfLeadershipPageData
  panelState: LeadershipPanelState
  primaryContactId: number | null
  selectedLeadership: LeadershipStaffViewModel | null
}) => {
  if (pageData.kind === 'self') {
    return <LeadershipSelfProfile leaderships={pageData.leaderships} />
  }

  const closeHref = buildLeadershipPanelHref(nucleusSlug, filters, { mode: 'closed' })
  const panel =
    panelState.mode === 'closed'
      ? null
      : panelState.mode === 'create'
        ? {
            title: 'Nova liderança',
            description: 'Cadastre uma pessoa na rede deste núcleo.',
            focusTargetId: undefined,
            content: (
              <LeadershipFormLazy
                action={createLeadershipFormAction}
                mode="create"
                nucleusId={nucleusId}
                cancelHref={closeHref}
                successHref={closeHref}
              />
            ),
          }
        : selectedLeadership
          ? {
              title:
                panelState.mode === 'edit'
                  ? `Editar ${selectedLeadership.name}`
                  : selectedLeadership.name,
              description:
                panelState.mode === 'edit'
                  ? 'Atualize setor e avaliação interna.'
                  : 'Contato e vínculo com este núcleo.',
              focusTargetId: getLeadershipPanelFocusTargetId(selectedLeadership.id),
              content:
                panelState.mode === 'edit' ? (
                  <LeadershipFormLazy
                    action={updateLeadershipFormAction}
                    mode="edit"
                    nucleusId={nucleusId}
                    leadership={toLeadershipEditViewModel(selectedLeadership)}
                    isPrimaryContact={primaryContactId === selectedLeadership.contactId}
                    cancelHref={buildLeadershipPanelHref(nucleusSlug, filters, {
                      mode: 'view',
                      leadershipId: selectedLeadership.id,
                    })}
                    successHref={closeHref}
                  />
                ) : (
                  <LeadershipDetail
                    leadership={selectedLeadership}
                    nucleusId={nucleusId}
                    isPrimaryContact={primaryContactId === selectedLeadership.contactId}
                    inviteConsentConfigured={inviteConsentConfigured}
                    editHref={buildLeadershipPanelHref(nucleusSlug, filters, {
                      mode: 'edit',
                      leadershipId: selectedLeadership.id,
                    })}
                  />
                ),
            }
          : null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {pageData.totalDocs} {pageData.totalDocs === 1 ? 'liderança' : 'lideranças'}
          {pageData.totalPages > 1 ? ` · página ${pageData.page} de ${pageData.totalPages}` : null}
        </p>
        <Button asChild className="min-h-11">
          <Link href={buildLeadershipPanelHref(nucleusSlug, filters, { mode: 'create' })}>
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Nova liderança
          </Link>
        </Button>
      </div>

      <LeadershipFilters filters={filters} />
      <LeadershipList
        leaderships={pageData.leaderships}
        primaryContactId={primaryContactId}
        nucleusSlug={nucleusSlug}
        filters={filters}
      />

      {pageData.totalPages > 1 ? (
        <Pagination>
          <PaginationContent>
            {pageData.page > 1 ? (
              <PaginationItem>
                <PaginationPrevious
                  href={buildLeadershipFilterHref(nucleusSlug, {
                    ...filters,
                    page: pageData.page - 1,
                  })}
                />
              </PaginationItem>
            ) : null}
            {pageData.page < pageData.totalPages ? (
              <PaginationItem>
                <PaginationNext
                  href={buildLeadershipFilterHref(nucleusSlug, {
                    ...filters,
                    page: pageData.page + 1,
                  })}
                />
              </PaginationItem>
            ) : null}
          </PaginationContent>
        </Pagination>
      ) : null}

      {panel ? (
        <LeadershipPanelIsland
          closeHref={closeHref}
          description={panel.description}
          focusTargetId={panel.focusTargetId}
          title={panel.title}
        >
          {panel.content}
        </LeadershipPanelIsland>
      ) : null}
    </div>
  )
}
