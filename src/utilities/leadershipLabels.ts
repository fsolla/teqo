/**
 * Leadership display labels shared across the ficha forms and the list
 * quick-edit control. Client-safe: a plain string table, no Payload/DB.
 */
import type { SupportStatus } from '@/lib/schemas/leadership'

export const supportStatusLabels: Record<SupportStatus, string> = {
  engajado: 'Engajado',
  a_abordar: 'A abordar',
  em_disputa: 'Em disputa',
  negativo: 'Negativo',
}
