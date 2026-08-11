import { primaryPhoneOf } from '@/lib/phone'
import { isPopulatedRelationship } from '@/lib/relationship'
import type { Contact, Petition } from '@/payload-types'
import type { ToCSVFunction } from '@payloadcms/plugin-import-export/types'

type ExportRow = Record<string, unknown>

const emptyContactColumns = (row: ExportRow): void => {
  row.contact_name = ''
  row.contact_email = ''
  row.contact_phone = ''
  row.contact_state = ''
  row.contact_city = ''
}

const isPopulatedPetition = (value: unknown): value is Pick<Petition, 'id' | 'title'> => {
  if (value === null || typeof value !== 'object') return false

  const record = value as Record<string, unknown>
  return typeof record.id === 'string' && typeof record.title === 'string'
}

export const signatureContactToCSV: ToCSVFunction = ({ value, row }) => {
  if (!isPopulatedRelationship<Contact>(value)) {
    emptyContactColumns(row)
    return undefined
  }

  row.contact_name = value.name
  row.contact_email = value.email ?? ''
  row.contact_phone = primaryPhoneOf(value.phones) ?? ''
  row.contact_state = value.state ?? ''
  row.contact_city = value.city ?? ''
  return undefined
}

export const signaturePetitionToCSV: ToCSVFunction = ({ value, row }) => {
  if (!isPopulatedPetition(value)) {
    row.petition_id = ''
    row.petition_title = ''
    return undefined
  }

  row.petition_id = value.id
  row.petition_title = value.title
  return undefined
}
