/**
 * Curated Sollinha opening-question chips (B191).
 *
 * The catalog is configuration data, not UI: each question is only included
 * when the current AI toolset answers it well for the actor's role. Staff see
 * election/dobradinha/overview questions backed by their tools; leaders get a
 * minimal safe set (meta + links via `buildCampaignLinks`, whose leader
 * allowlist is home/perfil/leaderContacts) — never an election tool, which
 * fails closed for the leader (B180).
 */

import type { CampaignRole } from '@/lib/campaignRoles'
import { isStaffCampaignRole } from '@/lib/campaignRoles'

export type SollinhaOpeningQuestion = {
  /** The exact text sent as the user message when the chip is picked. */
  text: string
}

/** Staff (coordinator/advisor/candidate): 4 chips on wide surfaces, 3 on mobile. */
const STAFF_OPENING_QUESTIONS: readonly SollinhaOpeningQuestion[] = [
  { text: 'Quem foi o deputado mais votado em Feira de Santana?' },
  { text: 'Quantos votos tivemos em Ilhéus em 2022?' },
  { text: 'Quais dobradinhas temos em Salvador?' },
  { text: 'Como está o município de Vitória da Conquista?' },
]

/** Leader: 3 chips, all answerable by the leader-facing toolset today. */
const LEADER_OPENING_QUESTIONS: readonly SollinhaOpeningQuestion[] = [
  { text: 'O que você sabe fazer?' },
  { text: 'Me manda o link dos meus contatos' },
  { text: 'Me manda o link do meu perfil' },
]

const MOBILE_LIMIT = 3

/**
 * Opening-question chips for an empty conversation. Staff get the full catalog
 * (capped by viewport); any non-staff role (leader — and unknown roles as a
 * fail-closed fallback) gets the safe set. Deterministic and client-safe.
 */
export const getSollinhaOpeningQuestions = (
  role: CampaignRole,
  isMobile: boolean,
): readonly SollinhaOpeningQuestion[] => {
  const catalog = isStaffCampaignRole(role) ? STAFF_OPENING_QUESTIONS : LEADER_OPENING_QUESTIONS
  return isMobile ? catalog.slice(0, MOBILE_LIMIT) : catalog
}
