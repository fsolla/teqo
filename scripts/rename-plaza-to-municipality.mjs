#!/usr/bin/env node
/**
 * One-shot mechanical rename: plaza → municipality across src/ and tests/.
 * Excludes frozen historical migration artifacts.
 */
import { mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'fs'
import { dirname, join, relative } from 'path'

const ROOT = join(import.meta.dirname, '..')

const EXCLUDE_PATH_FRAGMENTS = [
  'src/migrations/data/plazaCatalog20260721.ts',
  'src/migrations/20260721_020109_remodel_plazas.ts',
  'src/migrations/20260721_020109_remodel_plazas.json',
  'src/migrations/20260721_133444_add_plaza_expected_votes.ts',
  'src/migrations/20260721_133444_add_plaza_expected_votes.json',
  'node_modules/',
  '.git/',
  'scripts/rename-plaza-to-municipality.mjs',
]

const shouldExclude = (relPath) => EXCLUDE_PATH_FRAGMENTS.some((frag) => relPath.includes(frag))

const renamePathSegment = (segment) =>
  segment
    .replace(/PlazaUpdate/g, 'MunicipalityUpdate')
    .replace(/plazaUpdate/g, 'municipalityUpdate')
    .replace(/Plaza/g, 'Municipality')
    .replace(/plaza/g, 'municipality')
    .replace(/^pracas$/, 'municipios')

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const rel = relative(ROOT, full)
    if (shouldExclude(rel)) continue
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '.git') continue
      walk(full, files)
    } else if (/\.(ts|tsx|js|jsx|json|md|mdc)$/.test(entry)) {
      files.push(full)
    }
  }
  return files
}

// Rename directories bottom-up
function collectDirs(dir, dirs = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const rel = relative(ROOT, full)
    if (shouldExclude(rel)) continue
    if (statSync(full).isDirectory()) {
      collectDirs(full, dirs)
      if (/plaza|Plaza|pracas/i.test(entry)) dirs.push(full)
    }
  }
  return dirs
}

const dirRenames = collectDirs(join(ROOT, 'src'))
  .concat(collectDirs(join(ROOT, 'tests')))
  .sort((a, b) => b.length - a.length)

for (const dir of dirRenames) {
  const parent = dirname(dir)
  const base = renamePathSegment(dir.split('/').pop())
  const target = join(parent, base)
  if (dir !== target) {
    mkdirSync(dirname(target), { recursive: true })
    try {
      renameSync(dir, target)
      console.log('DIR', relative(ROOT, dir), '->', relative(ROOT, target))
    } catch (e) {
      // already renamed
    }
  }
}

// Rename files
const allFiles = walk(join(ROOT, 'src')).concat(walk(join(ROOT, 'tests')))
const fileRenames = allFiles
  .filter((f) => /plaza|Plaza|pracas/i.test(f.split('/').pop()))
  .sort((a, b) => b.length - a.length)

for (const file of fileRenames) {
  const parent = dirname(file)
  const base = renamePathSegment(file.split('/').pop())
  const target = join(parent, base)
  if (file !== target) {
    try {
      renameSync(file, target)
      console.log('FILE', relative(ROOT, file), '->', relative(ROOT, target))
    } catch {
      /* noop */
    }
  }
}

const REPLACEMENTS = [
  ['/campanha/pracas', '/campanha/municipios'],
  ["collection: 'plazaUpdate'", "collection: 'municipalityUpdate'"],
  ["collection: 'plaza'", "collection: 'municipality'"],
  ["relationTo: 'plazaUpdate'", "relationTo: 'municipalityUpdate'"],
  ["relationTo: 'plaza'", "relationTo: 'municipality'"],
  ['slug: plazaUpdate', 'slug: municipalityUpdate'],
  ['slug: plaza', 'slug: municipality'],
  ["'plazaUpdate'", "'municipalityUpdate'"],
  ["'plaza'", "'municipality'"],
  ['PlazaUpdate', 'MunicipalityUpdate'],
  ['plazaUpdate', 'municipalityUpdate'],
  ['PlazaEstimateScenario', 'MunicipalityEstimateScenario'],
  ['plazaEstimateScenario', 'municipalityEstimateScenario'],
  ['PlazaZoneNeighborhoods', 'MunicipalityZoneNeighborhoods'],
  ['plazaZoneNeighborhoods', 'municipalityZoneNeighborhoods'],
  ['plaza-zone-neighborhoods', 'municipality-zone-neighborhoods'],
  ['plaza-catalog', 'municipality-catalog'],
  ['plazaStaffFormActions', 'municipalityStaffFormActions'],
  ['plazaStaffEditMessages', 'municipalityStaffEditMessages'],
  ['plazaStaffVoteTotal', 'municipalityStaffVoteTotal'],
  ['StaffPlazaVotes', 'StaffMunicipalityVotes'],
  ['aggregatePledgesByPlaza', 'aggregatePledgesByMunicipality'],
  ['loadPlazaListPageBundle', 'loadMunicipalityListPageBundle'],
  ['loadPlazaMapBundle', 'loadMunicipalityMapBundle'],
  ['buildPlazaMapBundleFromPlazas', 'buildMunicipalityMapBundleFromMunicipalities'],
  ['buildPlazaMapBundle', 'buildMunicipalityMapBundle'],
  ['buildPlazaListWhere', 'buildMunicipalityListWhere'],
  ['shouldUpdatePlazaSearchUrl', 'shouldUpdateMunicipalitySearchUrl'],
  ['buildPlazaFiltersKey', 'buildMunicipalityFiltersKey'],
  ['getAccessiblePlazaIds', 'getAccessibleMunicipalityIds'],
  ['canAssignPlazaAdvisors', 'canAssignMunicipalityAdvisors'],
  ['canManagePlazaAdvisors', 'canManageMunicipalityAdvisors'],
  ['canCreatePlaza', 'canCreateMunicipality'],
  ['canDeletePlaza', 'canDeleteMunicipality'],
  ['canReadPlaza', 'canReadMunicipality'],
  ['canUpdatePlaza', 'canUpdateMunicipality'],
  ['validatePlazaAdvisors', 'validateMunicipalityAdvisors'],
  ['plazaCatalogEntriesForCity', 'municipalityCatalogEntriesForCity'],
  ['getPlazaCatalogEntry', 'getMunicipalityCatalogEntry'],
  ['plazaCatalog', 'municipalityCatalog'],
  ['isPlazaSlug', 'isMunicipalitySlug'],
  ['PlazaCatalogEntry', 'MunicipalityCatalogEntry'],
  ['PlazaKind', 'MunicipalityKind'],
  ['ZONE_PLAZA_CITIES', 'ZONE_MUNICIPALITY_CITIES'],
  ['zonePlazaCitySet', 'zoneMunicipalityCitySet'],
  ['plazasByIbgeCode', 'municipalitiesByIbgeCode'],
  ['resolvePlazaMapNavigation', 'resolveMunicipalityMapNavigation'],
  ['plazaMapNavigation', 'municipalityMapNavigation'],
  ['plazaRevalidation', 'municipalityRevalidation'],
  ['plazaSlug', 'municipalitySlug'],
  ['plazaPageData', 'municipalityPageData'],
  ['plazaViewModels', 'municipalityViewModels'],
  ['plazaMapData', 'municipalityMapData'],
  ['plazaUi', 'municipalityUi'],
  ['plazaElectoralBaseline', 'municipalityElectoralBaseline'],
  ['plazaElectionGeography', 'municipalityElectionGeography'],
  ['plazaCandidateComparison', 'municipalityCandidateComparison'],
  ['plazaDetailTabUi', 'municipalityDetailTabUi'],
  ['campaignPlazaAccess', 'campaignMunicipalityAccess'],
  ['campaignPlazas', 'campaignMunicipalities'],
  ['campaignPlazaUpdate', 'campaignMunicipalityUpdate'],
  ['updatePlazaStrategy', 'updateMunicipalityStrategy'],
  ['PlazaMapBundle', 'MunicipalityMapBundle'],
  ['plazaMapBundle', 'municipalityMapBundle'],
  ['PlazaList', 'MunicipalityList'],
  ['PlazaFilters', 'MunicipalityFilters'],
  ['PlazaMap', 'MunicipalityMap'],
  ['PlazaStrategy', 'MunicipalityStrategy'],
  ['PlazaBaseline', 'MunicipalityBaseline'],
  ['PlazaCandidate', 'MunicipalityCandidate'],
  ['PlazaAdvisor', 'MunicipalityAdvisor'],
  ['PlazaLeadership', 'MunicipalityLeadership'],
  ['PlazaPledges', 'MunicipalityPledges'],
  ['PlazaTab', 'MunicipalityTab'],
  ['PlazaUpdate', 'MunicipalityUpdate'],
  ['plazas', 'municipalities'],
  ['Plaza', 'Municipality'],
  ['plaza', 'municipality'],
]

const contentFiles = walk(join(ROOT, 'src'))
  .concat(walk(join(ROOT, 'tests')))
  .concat(
    [
      join(ROOT, 'AGENTS.md'),
      join(ROOT, 'PRODUCT.md'),
      join(ROOT, 'docs/roadmap.md'),
      join(ROOT, '.cursor/rules/projects/nucleos-eleitorais.mdc'),
    ].filter((f) => {
      try {
        statSync(f)
        return true
      } catch {
        return false
      }
    }),
  )

for (const file of contentFiles) {
  const rel = relative(ROOT, file)
  if (shouldExclude(rel)) continue
  let content = readFileSync(file, 'utf8')
  const original = content
  for (const [from, to] of REPLACEMENTS) {
    content = content.split(from).join(to)
  }
  if (content !== original) {
    writeFileSync(file, content)
    console.log('CONTENT', rel)
  }
}

console.log('Done.')
