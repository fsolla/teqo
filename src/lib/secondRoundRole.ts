/**
 * The deterministic role of one 2º-turno unit (município or Salvador ZE) in the
 * Lula × Flávio campaign — the shared rule between the artifact builder
 * (`pnpm build:second-round`) and the city report / briefing family. Pure: no
 * data access, so the builder and the renderers can never disagree.
 *
 * The classification comes from the Bahia 1º-turn analysis (2022→2026):
 * where Lula lost votes AND the local PT brand (Solla 1313) grew, mobilizing is
 * safe; where both fell, the task is defense/turnout. Persuasão em eleição
 * geral tem efeito médio ~0 — the role copy points the visit, it does not
 * promise vote transfer.
 */

export type SecondRoundRole = 'prioridade' | 'mobilizacao' | 'defesa' | 'expansao'

export type SecondRoundSwingInput = {
  /** Δ Lula (2026 − 2022), in votes; negative = lost votes. */
  dLula: number
  /** Δ Solla (2026 − 2022), in votes. */
  dSolla: number
  /** Solla's 2026 votes — sizes the local base (priority threshold ≥200). */
  solla26: number
}

/**
 * `prioridade` — Lula fell, Solla grew with a relevant base (≥200 votes): the
 * operational heart (joint Lula–Solla agenda, person-to-person contact).
 * `mobilizacao` — same swing, smaller base: leaders + geolocated digital.
 * `defesa` — both fell: turnout/defense, no showcase.
 * `expansao` — Lula did not lose here: keep presence and mobilize.
 */
export const classifySecondRoundRole = ({
  dLula,
  dSolla,
  solla26,
}: SecondRoundSwingInput): SecondRoundRole => {
  if (dLula < 0) {
    if (dSolla > 0) return solla26 >= 200 ? 'prioridade' : 'mobilizacao'
    return 'defesa'
  }
  return 'expansao'
}

export const secondRoundRoleLabels: Record<SecondRoundRole, string> = {
  prioridade: 'Mobilização segura — prioridade',
  mobilizacao: 'Mobilização segura',
  defesa: 'Defesa e comparecimento',
  expansao: 'Presença — Lula não perdeu aqui',
}

export const secondRoundRoleGuidance: Record<SecondRoundRole, string> = {
  prioridade:
    'Lula perdeu votos aqui e a marca local (Solla) cresceu com base relevante (≥200 votos): prioridade de mobilização — agenda conjunta Lula–Solla, contato pessoal e de vizinhança; o adversário ainda captura parte da perda.',
  mobilizacao:
    'Lula perdeu votos e Solla cresceu: mobilização segura com base menor — lideranças locais, digital geolocalizado e contato dirigido.',
  defesa:
    'Lula e Solla caíram juntos: base em erosão — a tarefa primária é comparecimento e defesa do voto já conquistado; Solla fala para a própria base, sem vitrine.',
  expansao:
    'Lula não perdeu votos neste recorte (ou ganhou): manter presença e mobilização; persuasão em eleição geral tem efeito médio próximo de zero.',
}
