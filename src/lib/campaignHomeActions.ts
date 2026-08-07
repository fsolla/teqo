import type { LucideIcon } from 'lucide-react'
import {
  BarChart3,
  Handshake,
  Inbox,
  Megaphone,
  TrendingUp,
  UserPlus,
  UserRoundSearch,
  Users,
} from 'lucide-react'

import {
  appendWizardReturnPath,
  CAMPAIGN_WIZARD_ACTION_SLUGS,
  campaignActionEntryHref,
  isCampaignWizardActionId,
  wizardActionHref,
  type CampaignWizardActionId,
} from '@/lib/campaignActionRoutes'
import { LEADER_CONTACTS_HOME } from '@/lib/campaignPaths'
import { isStaffCampaignRole, type CampaignRole } from '@/lib/campaignRoles'

type CampaignHomeActionId =
  | 'update-votes'
  | 'register-update'
  | 'change-trend'
  | 'update-leadership'
  | 'register-demand'
  | 'uncovered-municipalities'
  | 'register-supporter'
  | 'my-contacts'

export type CampaignHomeAction = {
  id: CampaignHomeActionId
  label: string
  icon: LucideIcon
  description: string
}

const staffHomeActionsCoordinator: readonly CampaignHomeAction[] = [
  {
    id: 'update-votes',
    label: 'Ajustar votos',
    icon: BarChart3,
    description: 'Atualizar a projeção (média, pessimista, otimista) de um município',
  },
  {
    id: 'register-update',
    label: 'Registrar atualização',
    icon: Megaphone,
    description: 'Anotar o que aconteceu no município — texto, polaridade e urgência.',
  },
  {
    id: 'change-trend',
    label: 'Mudar tendência',
    icon: TrendingUp,
    description: 'Favorável, neutra ou desfavorável — com o porquê',
  },
  {
    id: 'update-leadership',
    label: 'Atualizar liderança',
    icon: Handshake,
    description: 'Trocar quem coordena, status de apoio ou votos que a pessoa declara',
  },
  {
    id: 'register-demand',
    label: 'Registrar pedido',
    icon: Inbox,
    description: 'Demanda de material, transporte, diária ou outro pedido do município',
  },
  {
    id: 'uncovered-municipalities',
    label: 'Ver esquecidos',
    icon: UserRoundSearch,
    description: 'Abrir a lista de municípios sem assessor (atalho — não é wizard)',
  },
]

const portfolioScopeSuffix = ' nos municípios da sua carteira'

const staffHomeActionsAdvisor: readonly CampaignHomeAction[] = staffHomeActionsCoordinator.map(
  (action) => {
    if (action.id === 'uncovered-municipalities') {
      return {
        ...action,
        description:
          'Abrir a lista de municípios sem assessor da sua carteira (atalho — não é wizard)',
      }
    }
    return {
      ...action,
      description: `${action.description}${portfolioScopeSuffix}`,
    }
  },
)

const leaderHomeActions: readonly CampaignHomeAction[] = [
  {
    id: 'register-supporter',
    label: 'Cadastrar apoiador',
    icon: UserPlus,
    description: 'Registrar alguém da sua rede que apoia o Solla',
  },
  {
    id: 'my-contacts',
    label: 'Ver meus contatos',
    icon: Users,
    description: 'Abrir a lista dos apoiadores que você cadastrou',
  },
]

export const wizardFlowTitleForActionId = (id: CampaignWizardActionId): string => {
  const action = staffHomeActionsCoordinator.find((entry) => entry.id === id)
  return action?.label ?? 'Continuar'
}

export const homeActionsForRole = (role: CampaignRole): readonly CampaignHomeAction[] => {
  if (role === 'leader') return leaderHomeActions
  if (!isStaffCampaignRole(role)) return []
  if (role === 'advisor') return staffHomeActionsAdvisor
  return staffHomeActionsCoordinator
}

export type ResolvedCampaignHomeAction = CampaignHomeAction & {
  href?: string
}

/** Mirrors Início `buildMunicipalityListHref({ coverage: 'sem_assessor', sort: 'votos' }, 1)`. */
export const UNCOVERED_MUNICIPALITIES_LIST_HREF =
  '/campanha/municipios?coverage=sem_assessor&sort=votos' as const

export type HomeActionButtonPropsOptions = {
  uncoveredMunicipalitiesHref?: string
  municipalitySlug?: string
  returnPath?: string
}

/** Staff Início catalog with hrefs — shared by quick-action registries (B80+). */
const staffHomeQuickActionsByRole = new Map<CampaignRole, readonly ResolvedCampaignHomeAction[]>()

export const resolveStaffHomeQuickActions = (
  role: CampaignRole,
  returnPath?: string,
): readonly ResolvedCampaignHomeAction[] => {
  if (!isStaffCampaignRole(role)) return []
  if (!returnPath) {
    const cached = staffHomeQuickActionsByRole.get(role)
    if (cached) return cached
  }
  const actions = toHomeActionButtonProps(homeActionsForRole(role), {
    uncoveredMunicipalitiesHref: UNCOVERED_MUNICIPALITIES_LIST_HREF,
    returnPath,
  })
  if (!returnPath) {
    staffHomeQuickActionsByRole.set(role, actions)
  }
  return actions
}

export const toHomeActionButtonProps = (
  actions: readonly CampaignHomeAction[],
  options?: string | HomeActionButtonPropsOptions,
): ResolvedCampaignHomeAction[] => {
  const resolved =
    typeof options === 'string' ? { uncoveredMunicipalitiesHref: options } : (options ?? {})

  return actions.map((action) => {
    let href: string | undefined
    if (action.id === 'my-contacts') {
      href = LEADER_CONTACTS_HOME
    } else if (action.id === 'uncovered-municipalities') {
      href = resolved.uncoveredMunicipalitiesHref
    } else if (isCampaignWizardActionId(action.id)) {
      if (resolved.municipalitySlug) {
        href = wizardActionHref(
          CAMPAIGN_WIZARD_ACTION_SLUGS[action.id],
          resolved.municipalitySlug,
          {
            returnPath: resolved.returnPath,
          },
        )
      } else {
        href = appendWizardReturnPath(campaignActionEntryHref(action.id), resolved.returnPath)
      }
    }
    return {
      ...action,
      ...(href ? { href } : {}),
    }
  })
}
