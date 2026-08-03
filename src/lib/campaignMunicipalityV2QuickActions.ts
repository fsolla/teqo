import { BarChart3, FileText, MapPinned, UserPlus } from 'lucide-react'

import type { CampaignQuickActionContext } from '@/lib/campaignQuickActionContext'
import { ACTIVITY_TOUR_COMPOSER_PATH } from '@/lib/campaignQuickActionPaths'
import type { CampaignQuickAction } from '@/lib/campaignQuickActionTypes'
import { isStaffCampaignRole, type CampaignRole } from '@/lib/campaignRoles'
import { getMunicipalityCatalogEntry } from '@/lib/municipalityCatalog'

const municipalityV2PathPattern = /^\/campanha\/municipio\/([^/]+)\/v2$/

const municipalityDetailTabHref = (slug: string, tab: 'dossie' | 'elections'): string =>
  `/campanha/municipios/${slug}?tab=${tab}`

export const isMunicipalityV2Path = (pathname: string): boolean =>
  municipalityV2PathPattern.test(pathname)

export const parseMunicipalityV2Slug = (pathname: string): string | undefined => {
  const match = pathname.match(municipalityV2PathPattern)
  return match?.[1]
}

export const resolveMunicipalityV2QuickActions = (
  role: CampaignRole,
  municipalitySlug: string,
  municipalityId?: number,
): readonly CampaignQuickAction[] => {
  if (!isStaffCampaignRole(role)) return []

  const catalogEntry = getMunicipalityCatalogEntry(municipalitySlug)
  const tourHref = catalogEntry?.region
    ? `${ACTIVITY_TOUR_COMPOSER_PATH}?region=${encodeURIComponent(catalogEntry.region)}`
    : ACTIVITY_TOUR_COMPOSER_PATH

  const actions: CampaignQuickAction[] = [
    {
      id: 'municipality-dossier',
      label: 'Preparar visita',
      icon: FileText,
      description: 'Abrir o dossiê de pré-visita deste município',
      href: municipalityDetailTabHref(municipalitySlug, 'dossie'),
    },
    {
      id: 'municipality-elections',
      label: 'Ver eleições',
      icon: BarChart3,
      description: 'Comparativo e linha de base TSE deste município',
      href: municipalityDetailTabHref(municipalitySlug, 'elections'),
    },
  ]

  if (municipalityId !== undefined) {
    actions.push({
      id: 'new-leadership',
      label: 'Nova liderança',
      icon: UserPlus,
      description: 'Cadastrar uma liderança vinculada a este município',
      href: `/campanha/liderancas/nova?municipality=${municipalityId}`,
    })
  }

  actions.push({
    id: 'plan-tour',
    label: 'Planejar giro',
    icon: MapPinned,
    description: catalogEntry
      ? `Abrir o compositor de giros em ${catalogEntry.region}`
      : 'Abrir o compositor de giros por território',
    href: tourHref,
  })

  return actions
}

export const resolveMunicipalityV2QuickActionsForPath = (
  pathname: string,
  role: CampaignRole,
  context: CampaignQuickActionContext,
): readonly CampaignQuickAction[] | null => {
  const slug = context.municipalitySlug ?? parseMunicipalityV2Slug(pathname)
  if (!slug || !isMunicipalityV2Path(pathname)) return null

  return resolveMunicipalityV2QuickActions(role, slug, context.municipalityId)
}
