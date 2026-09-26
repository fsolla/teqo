import config from '@payload-config'
import { CircleAlertIcon, PackageOpenIcon } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { AddContentPieceLinkDialog } from '@/components/campaign/content/AddContentPieceLinkDialog'
import { ContentPieceCardList } from '@/components/campaign/content/ContentPieceCardList'
import { ContentPieceFilters } from '@/components/campaign/content/ContentPieceFilters'
import { ContentPieceStatusRefresher } from '@/components/campaign/content/ContentPieceStatusRefresher'
import { ContentPieceTable } from '@/components/campaign/content/ContentPieceTable'
import { ContentPieceUploadDialog } from '@/components/campaign/content/ContentPieceUploadDialog'
import { ImportContentPieceProfileDialog } from '@/components/campaign/content/ImportContentPieceProfileDialog'
import { CampaignColumnPickerTrailing } from '@/components/campaign/shared/CampaignColumnPickerTrailing'
import { CampaignListEmptyState } from '@/components/campaign/shared/CampaignListEmptyState'
import { CampaignListFooter } from '@/components/campaign/shared/CampaignListFooter'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { toCampaignColumnPickerColumns } from '@/lib/campaignColumnVisibility'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { CONTENT_PIECE_PROFILE_IMPORT_UNAVAILABLE_MESSAGE } from '@/lib/schemas/contentPiece'
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { buildContentPieceListHref } from '@/utilities/content/contentPieceListUrl'
import { loadContentPieceListPageData } from '@/utilities/content/contentPiecePageData'
import { readContentPieceProfileImportAvailability } from '@/utilities/content/contentPieceProfileImport'

export const metadata = campaignPageMetadataFromCatalog('conteudos')

type ContentPiecesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * C211 — the internal Central de Conteúdos: every piece the assessoria sent,
 * with the honest processing state, the publication kill switch and the three
 * ways in (batch upload, add by link, import from the official profile — C230).
 * The public Central is S27.
 */
export default async function ContentPiecesPage({ searchParams }: ContentPiecesPageProps) {
  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'communicationCatalog' }),
    getPayload({ config }),
  ])

  const [columnVisibility, data, instagramConfigured] = await Promise.all([
    readCampaignColumnVisibility('conteudos'),
    loadContentPieceListPageData(payload, user, searchParams),
    readContentPieceProfileImportAvailability(payload),
  ])
  if (data.redirectHref) redirect(data.redirectHref)

  const pendingPieces = data.rows.map((row) => ({
    id: row.id,
    processingStatus: row.processingStatus,
  }))

  const columns = toCampaignColumnPickerColumns([
    { id: 'piece', label: 'Peça', mandatory: true },
    { id: 'processing', label: 'Processamento' },
    { id: 'publication', label: 'Publicação' },
    { id: 'circulation', label: 'Circulação' },
    { id: 'action', label: 'Próxima ação', mandatory: true },
  ])

  const emptyState = (
    <CampaignListEmptyState
      icon={PackageOpenIcon}
      title="Nenhuma peça na Central ainda"
      description="Envie os arquivos do evento, importe as publicações recentes de @depjorgesolla ou cole o link de uma publicação do Instagram/YouTube. Cada peça entra como rascunho."
      contentClassName="max-w-none"
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        <ContentPieceUploadDialog />
        <ImportContentPieceProfileDialog configured={instagramConfigured} />
        <AddContentPieceLinkDialog />
      </div>
      <p className="text-xs text-muted-foreground">
        Importar usa somente o perfil oficial e nunca publica automaticamente.
      </p>
    </CampaignListEmptyState>
  )

  return (
    <CampaignPageShell aria-label="Central de Conteúdos">
      <ContentPieceStatusRefresher pieces={pendingPieces} />
      <CampaignListPendingBoundary>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-6">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Conteúdos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Peças que alimentam a Central pública. Rascunhos não aparecem no site.
            </p>
          </div>
          {/* Mobile (scene 6): the primary "Enviar peças" is full width on top
              and link/import sit in a two-column secondary row; desktop keeps
              the design's order (import, link, send). */}
          <div className="flex w-full flex-col gap-2 sm:ms-auto sm:w-auto sm:flex-row sm:items-center">
            <ContentPieceUploadDialog triggerClassName="max-sm:order-first max-sm:w-full sm:order-last" />
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <div className="flex flex-col items-stretch max-sm:order-last sm:items-end">
                <ImportContentPieceProfileDialog
                  configured={instagramConfigured}
                  triggerClassName="max-sm:w-full"
                />
                {!instagramConfigured ? (
                  <p className="mt-1.5 text-xs font-medium text-muted-foreground max-sm:hidden">
                    {CONTENT_PIECE_PROFILE_IMPORT_UNAVAILABLE_MESSAGE}
                  </p>
                ) : null}
              </div>
              <AddContentPieceLinkDialog
                triggerLabel={
                  <>
                    <span className="max-sm:hidden">Adicionar por link</span>
                    <span className="sm:hidden">Adicionar link</span>
                  </>
                }
                triggerClassName="max-sm:w-full"
              />
            </div>
          </div>
        </div>

        <ContentPieceFilters
          state={data.state}
          trailing={
            <CampaignColumnPickerTrailing columnVisibility={columnVisibility} columns={columns} />
          }
        />

        {!instagramConfigured ? (
          <div className="mt-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
            <CircleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              <b>{CONTENT_PIECE_PROFILE_IMPORT_UNAVAILABLE_MESSAGE}</b> A importação pelo perfil
              fica indisponível até a credencial oficial existir. Não há atalho por scraping nesta
              tela.
            </span>
          </div>
        ) : null}

        <CampaignListResults>
          <ContentPieceCardList rows={data.rows} empty={emptyState} />
          <ContentPieceTable
            rows={data.rows}
            columnVisibility={columnVisibility}
            empty={emptyState}
          />
          {data.rows.length > 0 ? (
            <CampaignListFooter
              totalDocs={data.totalDocs}
              singular="peça"
              plural="peças"
              page={data.state.page}
              totalPages={data.totalPages}
              hrefForPage={(page) => buildContentPieceListHref(data.state, page)}
            />
          ) : null}
        </CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
