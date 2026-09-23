import config from '@payload-config'
import { PackageOpenIcon } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { AddContentPieceLinkDialog } from '@/components/campaign/content/AddContentPieceLinkDialog'
import { ContentPieceCardList } from '@/components/campaign/content/ContentPieceCardList'
import { ContentPieceFilters } from '@/components/campaign/content/ContentPieceFilters'
import { ContentPieceStatusRefresher } from '@/components/campaign/content/ContentPieceStatusRefresher'
import { ContentPieceTable } from '@/components/campaign/content/ContentPieceTable'
import { ContentPieceUploadDialog } from '@/components/campaign/content/ContentPieceUploadDialog'
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
import { readCampaignColumnVisibility } from '@/utilities/campaignColumnVisibilityCookie'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { buildContentPieceListHref } from '@/utilities/content/contentPieceListUrl'
import { loadContentPieceListPageData } from '@/utilities/content/contentPiecePageData'

export const metadata = campaignPageMetadataFromCatalog('conteudos')

type ContentPiecesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * C211 — the internal Central de Conteúdos: every piece the assessoria sent,
 * with the honest processing state, the publication kill switch and the two
 * ways in (batch upload, add by link). The public Central is S27.
 */
export default async function ContentPiecesPage({ searchParams }: ContentPiecesPageProps) {
  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'communicationCatalog' }),
    getPayload({ config }),
  ])

  const [columnVisibility, data] = await Promise.all([
    readCampaignColumnVisibility('conteudos'),
    loadContentPieceListPageData(payload, user, searchParams),
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
      description="Envie os arquivos do evento ou cole o link de uma publicação do Instagram/YouTube. Cada peça entra como rascunho e sai catalogada."
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        <ContentPieceUploadDialog />
        <AddContentPieceLinkDialog />
      </div>
    </CampaignListEmptyState>
  )

  return (
    <CampaignPageShell aria-label="Central de Conteúdos">
      <ContentPieceStatusRefresher pieces={pendingPieces} />
      <CampaignListPendingBoundary>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Conteúdos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Peças que alimentam a Central pública. Rascunhos não aparecem no site.
            </p>
          </div>
          {/* Mobile: the primary "Enviar peças" is full width and the link
              action is a compact secondary (approved scene 5); desktop keeps
              both side by side in the design's order. */}
          <div className="flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row sm:items-center">
            <AddContentPieceLinkDialog
              triggerLabel={
                <>
                  <span className="max-sm:hidden">Adicionar por link</span>
                  <span className="sm:hidden">Link</span>
                </>
              }
              triggerClassName="max-sm:w-full"
            />
            <ContentPieceUploadDialog triggerClassName="max-sm:w-full" />
          </div>
        </div>

        <ContentPieceFilters
          state={data.state}
          trailing={
            <CampaignColumnPickerTrailing columnVisibility={columnVisibility} columns={columns} />
          }
        />

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
