import { ClipboardList, ListChecks, MapPinned, Pencil, Plus } from 'lucide-react'

import {
  CAMPAIGN_WIZARD_ACTION_SLUGS,
  wizardActionHref,
  type CampaignWizardActionId,
} from '@/lib/campaignActionRoutes'
import type { CampaignQuickActionContext } from '@/lib/campaignQuickActionContext'
import {
  ACTIVITY_NEW_PATH,
  ACTIVITY_TOUR_COMPOSER_PATH,
  type ActivityQuickActionSurface,
} from '@/lib/campaignQuickActionPaths'
import type { CampaignQuickAction } from '@/lib/campaignQuickActionTypes'
import { homeActionsForRole, toHomeActionButtonProps } from '@/lib/campaignHomeActions'
import { isStaffCampaignRole, type CampaignRole } from '@/lib/campaignRoles'

const WIZARD_ACTION_IDS: readonly CampaignWizardActionId[] = [
  'update-votes',
  'register-signal',
  'change-trend',
  'update-leadership',
  'register-demand',
]

const listQuickActions = (): readonly CampaignQuickAction[] => [
  {
    id: 'new-activity',
    label: 'Nova atividade',
    icon: Plus,
    description: 'Criar caminhada, comício, panfletagem ou outra ação de campanha',
    href: ACTIVITY_NEW_PATH,
  },
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
      href: wizardActionHref(CAMPAIGN_WIZARD_ACTION_SLUGS[wizardId], municipalitySlug),
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
): readonly CampaignQuickAction[] => {
  if (!isStaffCampaignRole(role)) return []

  if (surface.kind === 'list') {
    return listQuickActions()
  }

  const activitySlug = context.activitySlug ?? surface.activitySlug
  const municipalitySlug = context.municipalitySlug

  const detailActions = detailVerticalQuickActions(activitySlug)

  if (!municipalitySlug) {
    return detailActions
  }

  return [...wizardActionsWithMunicipalityPrefill(role, municipalitySlug), ...detailActions]
}