import {
  CircleHelp,
  Handshake,
  ShieldAlert,
  Snowflake,
  UserRoundX,
  type LucideIcon,
} from 'lucide-react'

import {
  municipalitySignalTypeDescriptions,
  municipalitySignalTypeLabels,
  municipalitySignalTypes,
  type MunicipalitySignalType,
} from '@/lib/schemas/municipalityUpdate'

export type MunicipalitySignalTypeMetaEntry = {
  type: MunicipalitySignalType
  label: string
  shortDescription: string
  infoContent: string
  icon: LucideIcon
  iconClassName: string
}

const signalTypeIcons: Record<MunicipalitySignalType, LucideIcon> = {
  invasao: ShieldAlert,
  esfriamento: Snowflake,
  visita_adversario: UserRoundX,
  proposta_broker: Handshake,
  outro: CircleHelp,
}

const signalTypeIconClassNames: Record<MunicipalitySignalType, string> = {
  invasao: 'text-destructive',
  esfriamento: 'text-sky-600',
  visita_adversario: 'text-amber-600',
  proposta_broker: 'text-teal-600',
  outro: 'text-muted-foreground',
}

const signalTypeInfoContent: Record<MunicipalitySignalType, string> = {
  invasao:
    'O adversário está ocupando espaço que era nosso: reunião, base, narrativa ou presença no território. Consequência: a rede pode esfriar ou a leitura do município muda. Use quando a equipe perceber invasão real, não só boatos.',
  esfriamento:
    'Aliados pararam de responder, sumiram das conversas ou a rede perdeu ritmo. Consequência: cobertura e pledges podem estagnar. Use quando o silêncio for novo e relevante para a decisão do município.',
  visita_adversario:
    'O adversário apareceu no município — visita, agenda pública ou movimento visível. Consequência: pode pressionar lideranças ou mudar a leitura local. Use quando houver fato concreto, não só expectativa.',
  proposta_broker:
    'Alguém pediu ou ofereceu algo em troca de apoio, voto ou posicionamento. Consequência: pode virar demanda, risco ou oportunidade de alinhamento. Use quando a conversa for relevante para a campanha.',
  outro:
    'Fato importante que não encaixa nos tipos acima, mas merece registro datado. Consequência: alimenta o histórico do município e pode acionar sugestões depois. Use com parcimônia — prefira um tipo específico quando couber.',
}

export const municipalitySignalTypeMeta: MunicipalitySignalTypeMetaEntry[] =
  municipalitySignalTypes.map((type) => ({
    type,
    label: municipalitySignalTypeLabels[type],
    shortDescription: municipalitySignalTypeDescriptions[type],
    infoContent: signalTypeInfoContent[type],
    icon: signalTypeIcons[type],
    iconClassName: signalTypeIconClassNames[type],
  }))

export const municipalitySignalTypeMetaByType = Object.fromEntries(
  municipalitySignalTypeMeta.map((entry) => [entry.type, entry]),
) as Record<MunicipalitySignalType, MunicipalitySignalTypeMetaEntry>
