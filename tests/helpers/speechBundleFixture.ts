import { randomUUID } from 'node:crypto'

import { matchMunicipalityMentions } from '@/lib/speechGazetteer'
import type { SpeechImportBundle } from '@/utilities/speech/speechImport'

/**
 * Shared speech import bundle fixture (C153/C154 int specs): one Câmara-shaped
 * bundle with deterministic metadata and a searchable segment. Overrides
 * replace any field; the caller owns the `sourceKey` cleanup bookkeeping.
 */
export const speechBundleFixture = (
  overrides: Partial<SpeechImportBundle> = {},
): SpeechImportBundle => ({
  sourceKey: `test-import-${randomUUID()}`,
  speechAt: '2023-02-07T17:28',
  year: 2023,
  legislature: '57',
  type: 'BREVES COMUNICAÇÕES',
  phase: 'Breves Comunicações',
  durationSeconds: 252,
  summary: 'Saúde e educação em Feira de Santana.',
  officialTranscript: 'O SR. JORGE SOLLA (Bloco/PT - BA) - Sr. Presidente...',
  officialTextUrl: null,
  keywords: ['SUS'],
  eventId: 67091,
  eventType: 'Sessão Deliberativa',
  eventStartAt: '2023-02-07T15:00',
  eventEndAt: '2023-02-07T21:23',
  youtubeUrl: null,
  presidingOfficer: 'Pompeo de Mattos',
  audioId: 558641,
  excerptTMs: 1675801808560,
  vodPlaybackUrl: null,
  vodDownloadUrl: null,
  facets: {
    topics: ['saude'],
    scopes: ['bahia'],
    municipalities: matchMunicipalityMentions('Feira de Santana'),
    people: ['Lula'],
    programs: [],
    projects: [],
    classifiedBy: 'gazetteer',
  },
  segments: [{ startSeconds: 0, endSeconds: 2.7, text: 'A saúde pública baiana' }],
  ...overrides,
})
