import type { leadershipGenders, leadershipSectors } from '@/lib/schemas/leadership'

export const leadershipGenderLabels: Record<(typeof leadershipGenders)[number], string> = {
  feminino: 'Feminino',
  masculino: 'Masculino',
  outro: 'Outro',
  nao_informado: 'Prefiro não informar',
}

export const leadershipSectorLabels: Record<(typeof leadershipSectors)[number], string> = {
  religioso: 'Religioso',
  sindical: 'Sindical',
  comunitario: 'Comunitário',
  rural: 'Rural',
  empresarial: 'Empresarial',
  juventude: 'Juventude',
  saude: 'Saúde',
  educacao: 'Educação',
  cultura: 'Cultura',
  outro: 'Outro',
}
