import { CampaignListPagination } from '@/components/campaign/shared/CampaignListPagination'

/**
 * The count line + pagination every campaign list renders under its results.
 * Server component: `hrefForPage` stays on the server (the pagination anchors
 * are the client leaves).
 */
export const CampaignListFooter = ({
  totalDocs,
  singular,
  plural,
  page,
  totalPages,
  hrefForPage,
}: {
  totalDocs: number
  /** e.g. "município encontrado" */
  singular: string
  /** e.g. "municípios encontrados" */
  plural: string
  page: number
  totalPages: number
  hrefForPage: (page: number) => string
}) => (
  <div className="flex flex-col items-center gap-2">
    <p className="text-sm text-muted-foreground">
      {totalDocs} {totalDocs === 1 ? singular : plural}
    </p>
    <CampaignListPagination page={page} totalPages={totalPages} hrefForPage={hrefForPage} />
  </div>
)
