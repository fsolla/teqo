/**
 * Static catalog of neighborhoods per zona eleitoral (Salvador ZE 1–19 only).
 *
 * Salvador source (official):
 * - TRE-BA Resolução Administrativa nº 2/2017, Anexo I — circunscrição por bairro
 *   https://www.tre-ba.jus.br/legislacao/compilada/resolucao/2017/resolucao-administrativa-no-2-de-10-de-maio-de-2017
 *   (accessed 2026-07-21)
 *
 * Rows author the slug and the neighborhood list only: `city` and `zoneNumber`
 * are hydrated from `municipalityCatalog`, which is also what makes an unknown
 * or non-zona slug fail at import instead of drifting silently.
 *
 * Coverage is independently checked by tests/fixtures/municipality-zone-neighborhoods.official.json.
 */

import { getMunicipalityCatalogEntry } from '@/lib/municipalityCatalog'

export type MunicipalityZoneNeighborhoodSource = 'tre-ra-02-2017'

export type MunicipalityZoneNeighborhoodEntry = {
  readonly municipalitySlug: string
  readonly city: string
  readonly zoneNumber: number
  readonly source: MunicipalityZoneNeighborhoodSource
  readonly neighborhoods: readonly string[]
}

const sortNeighborhoods = (names: readonly string[]): readonly string[] =>
  [...names].sort((left, right) => left.localeCompare(right, 'pt-BR'))

const entry = (
  municipalitySlug: string,
  source: MunicipalityZoneNeighborhoodSource,
  neighborhoods: readonly string[],
): MunicipalityZoneNeighborhoodEntry => {
  const catalogEntry = getMunicipalityCatalogEntry(municipalitySlug)
  if (!catalogEntry || catalogEntry.kind !== 'zona' || catalogEntry.zoneNumber === undefined) {
    throw new Error(`Missing zona municipality catalog entry for slug: ${municipalitySlug}`)
  }

  return {
    municipalitySlug,
    city: catalogEntry.city,
    zoneNumber: catalogEntry.zoneNumber,
    source,
    neighborhoods: sortNeighborhoods(neighborhoods),
  }
}

export const municipalityZoneNeighborhoods: readonly MunicipalityZoneNeighborhoodEntry[] = [
  entry('salvador-ze-1', 'tre-ra-02-2017', [
    'Alto das Pombas',
    'Barra',
    'Calabar',
    'Canela',
    'Centro',
    'Centro Histórico',
    'Garcia',
    'Graça',
    'Vitória',
  ]),
  entry('salvador-ze-2', 'tre-ra-02-2017', [
    'Amaralina',
    'Chapada do Rio Vermelho',
    'Engenho Velho da Federação',
    'Federação',
    'Ondina',
    'Rio Vermelho',
  ]),
  entry('salvador-ze-3', 'tre-ra-02-2017', [
    'Baixa de Quintas',
    'Cidade Nova',
    'Fazenda Grande do Retiro',
    'IAPI',
    'Pau Miúdo',
    'Pero Vaz',
    'Santa Mônica',
  ]),
  entry('salvador-ze-4', 'tre-ra-02-2017', [
    'Coutos',
    'Fazenda Coutos',
    'Ilha de Bom Jesus dos Passos',
    'Ilha de Maré',
    'Ilha dos Frades',
    'Nova Constituinte',
    'Paripe',
    'Periperi (parte ao norte da Rua das Pedrinhas)',
    'São Tomé',
  ]),
  entry('salvador-ze-5', 'tre-ra-02-2017', [
    'Barreiras',
    'Cabula',
    'Engomadeira',
    'Mata Escura',
    'Resgate',
    'Retiro',
    'São Gonçalo',
  ]),
  entry('salvador-ze-6', 'tre-ra-02-2017', [
    'Acupe',
    'Boa Vista de Brotas',
    'Brotas',
    'Candeal',
    'Engenho Velho de Brotas',
  ]),
  entry('salvador-ze-7', 'tre-ra-02-2017', [
    'Barbalho',
    'Barris',
    'Comércio',
    'Cosme de Farias',
    'Luiz Anselmo',
    'Macaúbas',
    'Matatu',
    'Nazaré',
    'Santo Agostinho',
    'Santo Antônio',
    'Saúde',
    'Tororó',
    'Vila Laura',
  ]),
  entry('salvador-ze-8', 'tre-ra-02-2017', [
    'Cajazeiras II',
    'Cajazeiras IV',
    'Cajazeiras V',
    'Cajazeiras VI',
    'Cajazeiras VII',
    'Cajazeiras VIII',
    'Campinas de Pirajá',
    'Marechal Rondon',
    'Moradas da Lagoa',
    'Palestina',
    'Pirajá',
    'Valéria',
  ]),
  entry('salvador-ze-9', 'tre-ra-02-2017', [
    'Boa Viagem',
    'Bonfim',
    'Jardim Cruzeiro',
    'Mangueira',
    'Massaranduba',
    'Monte Serrat',
    'Ribeira',
    'Santa Luzia',
    'Uruguai',
    'Vila Ruy Barbosa',
  ]),
  entry('salvador-ze-10', 'tre-ra-02-2017', [
    'Bairro da Paz',
    'Boca do Rio',
    'Costa Azul',
    'Imbuí',
    'Jardim Armação',
    'Patamares',
    'Piatã',
    'Pituaçu',
    'STIEP',
  ]),
  entry('salvador-ze-11', 'tre-ra-02-2017', [
    'Águas Claras',
    'Calabetão',
    'Castelo Branco',
    'Dom Avelar',
    'Granjas Rurais Presidente Vargas',
    'Jardim Cajazeiras',
    'Jardim Santo Inácio',
    'Pau da Lima',
    'Porto Seco Pirajá',
    'Sete de Abril',
    'Vila Canária',
  ]),
  entry('salvador-ze-12', 'tre-ra-02-2017', [
    'Aeroporto',
    'Alto do Coqueirinho',
    'Areia Branca',
    'Itapuã',
    'Itinga',
    'Jardim das Margaridas',
    'São Cristóvão',
    'Stella Maris',
  ]),
  entry('salvador-ze-13', 'tre-ra-02-2017', [
    'Caminho das Árvores',
    'Itaigara',
    'Nordeste de Amaralina',
    'Pituba',
    'Santa Cruz',
    'Vale das Pedrinhas',
  ]),
  entry('salvador-ze-14', 'tre-ra-02-2017', [
    'Arenoso',
    'Novo Horizonte',
    'São Marcos',
    'Sussuarana',
    'Tancredo Neves',
  ]),
  entry('salvador-ze-15', 'tre-ra-02-2017', [
    'Arraial do Retiro',
    'Boa Vista de São Caetano',
    'Bom Juá',
    'Capelinha',
    'Lobato',
    'São Caetano',
  ]),
  entry('salvador-ze-16', 'tre-ra-02-2017', [
    'Cabula VI',
    'Canabrava',
    'Centro Administrativo da Bahia',
    'Doron',
    'Narandiba',
    'Nova Sussuarana',
    'Pernambués',
    'Saboeiro',
    'São Rafael',
    'Saramandaia',
    'Vale dos Lagos',
  ]),
  entry('salvador-ze-17', 'tre-ra-02-2017', [
    'Alto da Terezinha',
    'Alto do Cabrito',
    'Itacaranha',
    'Periperi (parte ao sul da Rua das Pedrinhas)',
    'Plataforma',
    'Praia Grande',
    'Rio Sena',
    'São João do Cabrito',
  ]),
  entry('salvador-ze-18', 'tre-ra-02-2017', [
    "Caixa D'água",
    'Calçada',
    'Caminho de Areia',
    'Curuzu',
    'Lapinha',
    'Liberdade',
    'Mares',
    'Roma',
  ]),
  entry('salvador-ze-19', 'tre-ra-02-2017', [
    'Boca da Mata',
    'Cajazeiras X',
    'Cajazeiras XI',
    'Cassange',
    'Fazenda Grande I',
    'Fazenda Grande II',
    'Fazenda Grande III',
    'Fazenda Grande IV',
    'Jaguaripe I',
    'Jardim Nova Esperança',
    'Mussurunga',
    'Nova Brasília',
    'Nova Esperança',
    'Novo Marotinho',
    'Trobogy',
  ]),
]

const entryBySlug = new Map(
  municipalityZoneNeighborhoods.map((record) => [record.municipalitySlug, record]),
)

export const municipalityZoneNeighborhoodEntryForSlug = (
  slug: string,
): MunicipalityZoneNeighborhoodEntry | undefined => entryBySlug.get(slug)

export const municipalityZoneNeighborhoodSourceLabel = (
  source: MunicipalityZoneNeighborhoodSource,
): string => {
  switch (source) {
    case 'tre-ra-02-2017':
      return 'Bairros conforme circunscrição oficial do TRE-BA (Resolução Administrativa nº 2/2017).'
    default:
      return source satisfies never
  }
}
