import type { leadershipGenders } from '@/lib/schemas/leadership'

export const leadershipGenderLabels: Record<(typeof leadershipGenders)[number], string> = {
  feminino: 'Feminino',
  masculino: 'Masculino',
  outro: 'Outro',
  nao_informado: 'Prefiro não informar',
}
