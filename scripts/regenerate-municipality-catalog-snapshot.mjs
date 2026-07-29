import { writeFileSync } from 'node:fs'
import { sha256Hex } from './lib/cli.mjs'

import { municipalityCatalog, ZONE_MUNICIPALITY_CITIES } from '../src/lib/municipalityCatalog.ts'

const entries = municipalityCatalog.map(
  ({ slug, name, kind, city, region, ibgeCode, tseCityCode, zoneNumber, tseZones }) => ({
    slug,
    name,
    kind,
    city,
    region,
    ibgeCode,
    tseCityCode,
    ...(zoneNumber === undefined ? {} : { zoneNumber }),
    tseZones: [...tseZones],
  }),
)
const rows = entries
  .map(
    (entry) =>
      `P\t${entry.slug}\t${entry.name}\t${entry.kind}\t${entry.city}\t${entry.zoneNumber ?? ''}\n`,
  )
  .join('')
const snapshot = {
  description:
    'Frozen snapshot of the derived municipality catalog (slug/name identity must stay stable).',
  generatedFrom: 'src/lib/municipalityCatalog.ts',
  municipalityCount: entries.length,
  zoneMunicipalityCities: [...ZONE_MUNICIPALITY_CITIES],
  identitySha256: sha256Hex(rows),
  entries,
}
writeFileSync(
  'tests/fixtures/municipality-catalog.snapshot.json',
  `${JSON.stringify(snapshot, null, 2)}\n`,
)
console.log(`Wrote ${entries.length} entries`)
