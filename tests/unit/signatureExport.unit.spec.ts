// @vitest-environment node

import type { ToCSVFunction } from '@payloadcms/plugin-import-export/types'
import { describe, expect, it } from 'vitest'

import { signatureContactToCSV, signaturePetitionToCSV } from '@/utilities/signatureExport'

const runToCSV = (toCSV: ToCSVFunction, value: unknown) => {
  const row: Record<string, unknown> = {}
  toCSV({
    columnName: 'field',
    data: row,
    doc: row,
    row,
    siblingDoc: {},
    value,
  } as unknown as Parameters<ToCSVFunction>[0])
  return row
}

describe('signatureExport', () => {
  describe('signatureContactToCSV', () => {
    it('writes operational contact columns from a populated relationship', () => {
      expect(
        runToCSV(signatureContactToCSV, {
          id: 1,
          name: 'Maria Silva',
          email: 'maria@example.com',
          phones: [{ value: '71999990000' }],
          state: 'BA',
          city: 'Salvador',
        }),
      ).toEqual({
        contact_name: 'Maria Silva',
        contact_email: 'maria@example.com',
        contact_phone: '71999990000',
        contact_state: 'BA',
        contact_city: 'Salvador',
      })
    })

    it('keeps SMS-only rows with empty email', () => {
      const row = runToCSV(signatureContactToCSV, {
        id: 2,
        name: 'João Souza',
        email: null,
        phones: [{ value: '71988887777' }],
        state: 'BA',
        city: 'Feira de Santana',
      })

      expect(row.contact_email).toBe('')
      expect(row.contact_phone).toBe('71988887777')
    })

    it('writes empty cells when contact is not populated', () => {
      expect(runToCSV(signatureContactToCSV, 42)).toEqual({
        contact_name: '',
        contact_email: '',
        contact_phone: '',
        contact_state: '',
        contact_city: '',
      })
    })
  })

  describe('signaturePetitionToCSV', () => {
    it('writes petition id and title from a populated relationship', () => {
      expect(
        runToCSV(signaturePetitionToCSV, {
          id: 'saude-baiana',
          title: 'Saúde para toda a Bahia',
        }),
      ).toEqual({
        petition_id: 'saude-baiana',
        petition_title: 'Saúde para toda a Bahia',
      })
    })

    it('writes empty cells when petition is not populated', () => {
      expect(runToCSV(signaturePetitionToCSV, 'saude-baiana')).toEqual({
        petition_id: '',
        petition_title: '',
      })
    })
  })
})
