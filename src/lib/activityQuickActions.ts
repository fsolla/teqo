import { Calendar, ClipboardList, ListChecks, MapPinned, Pencil, Plus } from 'lucide-react'

import {
  CAMPAIGN_WIZARD_ACTION_SLUGS,
  wizardActionHref,
  type CampaignWizardActionId,
} from '@/lib/campaignActionRoutes'
import { homeActionsForRole, toHomeActionButtonProps } from '@/lib/campaignHomeActions'
import type { CampaignQuickActionContext } from '@/lib/campaignQuickActionContext'
import {
  ACTIVITY_NEW_PATH,
  ACTIVITY_TOUR_COMPOSER_PATH,
  type ActivityQuickActionSurface,
} from '@/lib/campaignQuickActionPaths'
import type { CampaignQuickAction } from '@/lib/campaignQuickActionTypes'
import { isStaffCampaignRole, type CampaignRole } from '@/lib/campaignRoles'

const WIZARD_ACTION_IDS: readonly CampaignWizardActionId[] = [
  'update-votes',
  'register-update',
  'change-trend',
  'update-leadership',
  'register-demand',
]

const listQuickActions = (context: CampaignQuickActionContext): readonly CampaignQuickAction[] => [
  {
    id: 'new-activity',
    label: 'Nova atividade',
    icon: Plus,
    description: 'Criar caminhada, comício, panfletagem ou outra ação de campanha',
    href: ACTIVITY_NEW_PATH,
  },
  ...(context.openCalendarFeed
    ? [
        {
          id: 'import-calendar',
          label: 'Link de import',
          icon: Calendar,
          description: 'Gerar link para sincronizar este recorte da agenda com o Google Calendar',
          onAction: context.openCalendarFeed,
        },
      ]
    : []),
  {
    id: 'plan-tour',
    label: 'Planejar giro',
    icon: MapPinned,
    description: 'Compor um giro por território e gerar rascunhos de atividade',
    href: ACTIVITY_TOUR_COMPOSER_PATH,
  },
]

const wizardActionsWithMunicipalityPrefill = (
  role: CampaignRole,
  municipalitySlug: string,
  returnPath: string,
): readonly CampaignQuickAction[] => {
  const homeActions = homeActionsForRole(role).filter((action) =>
    WIZARD_ACTION_IDS.includes(action.id as CampaignWizardActionId),
  )

  return toHomeActionButtonProps(homeActions).map((action) => {
    const wizardId = action.id as CampaignWizardActionId
    return {
      id: action.id,
      label: action.label,
      icon: action.icon,
      description: action.description,
      href: wizardActionHref(CAMPAIGN_WIZARD_ACTION_SLUGS[wizardId], municipalitySlug, {
        returnPath,
      }),
    }
  })
}

const detailVerticalQuickActions = (activitySlug: string): readonly CampaignQuickAction[] => {
  const base = `/campanha/atividades/${activitySlug}`
  const actions: CampaignQuickAction[] = [
    {
      id: 'edit-activity',
      label: 'Editar',
      icon: Pencil,
      description: 'Abrir o formulário completo da atividade',
      href: `${base}/editar`,
    },
    {
      id: 'activity-tasks',
      label: 'Tarefas',
      icon: ListChecks,
      description: 'Ver e marcar o checklist desta atividade',
      href: `${base}?tab=tasks`,
    },
    {
      id: 'activity-updates',
      label: 'Atualizações',
      icon: ClipboardList,
      description: 'Registrar ou revisar o feed de atualizações',
      href: `${base}?tab=updates`,
    },
  ]

  return actions
}

export const resolveActivityQuickActions = (
  surface: ActivityQuickActionSurface,
  role: CampaignRole,
  context: CampaignQuickActionContext,
  pathname?: string,
): readonly CampaignQuickAction[] => {
  if (!isStaffCampaignRole(role)) return []

  if (surface.kind === 'list') {
    return listQuickActions(context)
  }

  const activitySlug = context.activitySlug ?? surface.activitySlug
  const municipalitySlug = context.municipalitySlug
  const returnPath = pathname ?? `/campanha/atividades/${activitySlug}`

  const detailActions = detailVerticalQuickActions(activitySlug)

  if (!municipalitySlug) {
    return detailActions
  }

  return [
    ...wizardActionsWithMunicipalityPrefill(role, municipalitySlug, returnPath),
    ...detailActions,
  ]
}
