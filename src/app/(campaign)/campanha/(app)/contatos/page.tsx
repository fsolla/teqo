import config from '@payload-config'
import { MessageCircleIcon, SearchXIcon } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import type { ReactNode } from 'react'

import { ContactCreateRow } from '@/components/campaign/contacts/ContactCreateRow'
import { ContactCreateProvider } from '@/components/campaign/contacts/ContactCreateState'
import { ContactFilters } from '@/components/campaign/contacts/ContactFilters'
import { ContactPhonesCell } from '@/components/campaign/contacts/ContactPhonesCell'
import { ContactSelectCell } from '@/components/campaign/contacts/ContactSelectCell'
import { ContactSortableHead } from '@/components/campaign/contacts/ContactSortableHead'
import { DeletePersonButton } from '@/components/campaign/people/DeletePersonButton'
import { CampaignColumnPickerTrailing } from '@/components/campaign/shared/CampaignColumnPickerTrailing'
import { CampaignHoverTooltip } from '@/components/campaign/shared/CampaignHoverTooltip'
import { CampaignInlineEditableCell } from '@/components/campaign/shared/CampaignInlineEditableCell'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
  CampaignTransitionAnchor,
} from '@/components/campaign/shared/CampaignListPending'
import {
  CampaignTable,
  CampaignTableHead,
  type CampaignTableColumn,
} from '@/components/campaign/shared/CampaignTable'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Button, buttonVariants } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/Empty'
import { toCampaignColumnPickerColumns } from '@/lib/campaignColumnVisibility'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { CitiesByState } from '@/lib/cities'
import { formatBrazilianPhoneInput, whatsAppHrefForPhone } from '@/lib/phone'
import { cn } from '@/lib/utils'
import { isCampaignUnrestricted } from '@/utilities/campaignAccess'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  loadContactListPageData,
  type ContactRowViewModel,
} from '@/utilities/contacts/contactListData'
import {
  buildContactFilterHref,
  clearContactListFilters,
  type ContactFilterOption,
} from '@/utilities/contacts/contactListFilters'
import {
  buildContactListHref,
  contactGenderLabels,
  resolveContactListUrl,
  type ContactGender,
  type ContactListState,
  type ContactStateKey,
} from '@/utilities/contacts/contactListUrl'

import { createContactFormAction, updateContactFormAction } from './formActions'

export const metadata = campaignPageMetadataFromCatalog('contatos')

type ContactsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const genderOptions: ReadonlyArray<{ value: ContactGender; label: string }> = (
  Object.keys(contactGenderLabels) as ContactGender[]
).map((value) => ({ value, label: contactGenderLabels[value] }))

const stateOptions: ReadonlyArray<{ value: ContactStateKey; label: string }> = (
  Object.keys(CitiesByState) as ContactStateKey[]
).map((value) => ({ value, label: value }))

const ContactsListEmptyState = ({
  hasFilters,
  state,
}: {
  hasFilters: boolean
  state: ContactListState
}) => (
  <Empty className="min-h-56">
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <SearchXIcon aria-hidden="true" />
      </EmptyMedia>
      <EmptyTitle>Nenhum contato neste recorte</EmptyTitle>
      <EmptyDescription>
        Ajuste a busca e os filtros para ver as fichas da campanha.
      </EmptyDescription>
    </EmptyHeader>
    {hasFilters ? (
      <EmptyContent>
        <CampaignTransitionAnchor
          href={buildContactFilterHref(clearContactListFilters(state))}
          replace
          scroll={false}
          className={cn(buttonVariants({ variant: 'outline' }), 'min-h-11')}
        >
          Limpar busca e filtros
        </CampaignTransitionAnchor>
      </EmptyContent>
    ) : null}
  </Empty>
)

const contactsColumns = ({
  state,
  canDelete,
}: {
  state: ContactListState
  canDelete: boolean
}): Array<CampaignTableColumn<ContactRowViewModel>> => [
  {
    id: 'name',
    label: 'Nome',
    mandatory: true,
    cellClassName: 'max-w-72',
    head: <ContactSortableHead state={state} sortKey="name" />,
    cell: (row) => (
      <CampaignInlineEditableCell
        recordId={row.contactID}
        recordIdField="id"
        field="name"
        value={row.name}
        label="Nome"
        formAction={updateContactFormAction}
        permanent
      />
    ),
  },
  {
    id: 'gender',
    label: 'Gênero',
    cellClassName: 'max-w-36',
    cell: (row) => (
      <ContactSelectCell
        recordId={row.contactID}
        field="gender"
        value={row.gender}
        label="Gênero"
        options={genderOptions}
        emptyLabel="Sem gênero"
        formAction={updateContactFormAction}
      />
    ),
  },
  {
    id: 'phone',
    label: 'Telefone',
    cellClassName: 'max-w-56',
    cell: (row) => (
      <ContactPhonesCell
        recordId={row.contactID}
        phones={row.phones}
        formAction={updateContactFormAction}
      />
    ),
  },
  {
    id: 'email',
    label: 'E-mail',
    cellClassName: 'max-w-56 whitespace-normal',
    head: <ContactSortableHead state={state} sortKey="email" />,
    cell: (row) => (
      <CampaignInlineEditableCell
        recordId={row.contactID}
        recordIdField="id"
        field="email"
        value={row.email}
        label="E-mail"
        placeholder="Sem e-mail"
        formAction={updateContactFormAction}
        permanent
      />
    ),
  },
  {
    id: 'city',
    label: 'Cidade',
    cellClassName: 'max-w-44 whitespace-normal',
    head: <ContactSortableHead state={state} sortKey="cidade" />,
    cell: (row) => (
      <CampaignInlineEditableCell
        recordId={row.contactID}
        recordIdField="id"
        field="city"
        value={row.city}
        label="Cidade"
        placeholder="Sem cidade"
        formAction={updateContactFormAction}
        permanent
      />
    ),
  },
  {
    id: 'state',
    label: 'Estado',
    cellClassName: 'max-w-24',
    head: <ContactSortableHead state={state} sortKey="estado" />,
    cell: (row) => (
      <ContactSelectCell
        recordId={row.contactID}
        field="state"
        value={row.state}
        label="Estado"
        options={stateOptions}
        formAction={updateContactFormAction}
      />
    ),
  },
  {
    id: 'postalCode',
    label: 'CEP',
    cellClassName: 'max-w-28',
    cell: (row) => (
      <CampaignInlineEditableCell
        recordId={row.contactID}
        recordIdField="id"
        field="postalCode"
        value={row.postalCode}
        label="CEP"
        placeholder="Sem CEP"
        formAction={updateContactFormAction}
        permanent
      />
    ),
  },
  {
    id: 'actions',
    label: 'Ações',
    mandatory: true,
    head: (
      <CampaignTableHead align="right">
        <span className="sr-only">Ações</span>
      </CampaignTableHead>
    ),
    cellClassName: 'text-right',
    cell: (row) => {
      const whatsAppHref = whatsAppHrefForPhone(row.phones[0] ?? null)
      return (
        <div className="inline-flex items-center justify-end gap-1">
          {whatsAppHref ? (
            <CampaignHoverTooltip content="WhatsApp">
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
            </CampaignHoverTooltip>
          ) : null}
          {canDelete ? (
            <CampaignHoverTooltip content="Apagar">
              {/* C130 — span wrapper: `DeletePersonButton` is a component and
                  does not forward the tooltip trigger's ref/pointer props, so
                  the hover would never reach the trigger. */}
              <span>
                <DeletePersonButton
                  personName={row.name}
                  contactId={row.contactID}
                  vocabulary="contato"
                />
              </span>
            </CampaignHoverTooltip>
          ) : null}
        </div>
      )
    },
  },
]

/** Fase 4 interim mobile list — replaced by the cards/sheets in Fase 5. */
const ContactsMobileList = ({
  rows,
  canDelete,
  empty,
}: {
  rows: readonly ContactRowViewModel[]
  canDelete: boolean
  empty: ReactNode
}) => (
  <ul data-view="mobile-list" className="flex flex-col divide-y md:hidden">
    {rows.length === 0 ? (
      <li className="py-4">{empty}</li>
    ) : (
      rows.map((row) => {
        const whatsAppHref = whatsAppHrefForPhone(row.phones[0] ?? null)
        return (
          <li key={row.contactID} className="flex items-center justify-between gap-2 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium">{row.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {row.phones[0]
                  ? formatBrazilianPhoneInput(row.phones[0])
                  : row.email
                    ? row.email
                    : 'Sem contato registrado'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
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
              ) : null}
              {canDelete ? (
                <DeletePersonButton
                  personName={row.name}
                  contactId={row.contactID}
                  vocabulary="contato"
                />
              ) : null}
            </div>
          </li>
        )
      })
    )}
  </ul>
)

export default async function ContactsPage({ searchParams }: ContactsPageProps) {
  const rawSearchParams = await searchParams
  const canonicalUrl = resolveContactListUrl(rawSearchParams)
  if (canonicalUrl.redirectHref) redirect(canonicalUrl.redirectHref)

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const [columnVisibility, listData] = await Promise.all([
    readCampaignColumnVisibility('contatos'),
    loadContactListPageData(payload, user, canonicalUrl.state),
  ])

  const resolvedUrl = resolveContactListUrl(rawSearchParams, listData.totalPages)
  if (resolvedUrl.redirectHref) redirect(resolvedUrl.redirectHref)
  const { state } = resolvedUrl

  const cityFilterOptions: ContactFilterOption[] = listData.filterFacets.cities.map((city) => ({
    value: city,
    label: city,
  }))

  const canDelete = isCampaignUnrestricted(user)
  const columns = contactsColumns({ state, canDelete })
  const hasFilters = Boolean(
    state.q ||
    state.genders?.length ||
    state.states?.length ||
    state.cities?.length ||
    state.ausencias?.length ||
    state.vinculos?.length,
  )

  return (
    <CampaignPageShell>
      <ContactCreateProvider>
        <CampaignListPendingBoundary>
          <ContactFilters
            state={state}
            cityFilterOptions={cityFilterOptions}
            trailing={
              <CampaignColumnPickerTrailing
                columnVisibility={columnVisibility}
                columns={toCampaignColumnPickerColumns(columns)}
              />
            }
          />

          <CampaignListResults>
            <ContactsMobileList
              rows={listData.rows}
              canDelete={canDelete}
              empty={<ContactsListEmptyState hasFilters={hasFilters} state={state} />}
            />
            <ContactCreateRow formAction={createContactFormAction} />
            <CampaignTable
              className="hidden md:block"
              caption="Uma linha por ficha de contato da campanha. Edite direto na célula; o telefone principal é o primeiro da lista."
              columns={columns}
              columnVisibility={columnVisibility}
              rows={listData.rows}
              rowKey={(row) => row.contactID}
              empty={<ContactsListEmptyState hasFilters={hasFilters} state={state} />}
            />
            {listData.rows.length ? (
              <CampaignListFooter
                totalDocs={listData.totalDocs}
                singular="contato"
                plural="contatos"
                page={state.page}
                totalPages={listData.totalPages}
                hrefForPage={(page) => buildContactListHref(state, page)}
              />
            ) : null}
          </CampaignListResults>
        </CampaignListPendingBoundary>
      </ContactCreateProvider>
    </CampaignPageShell>
  )
}
