/**
 * Static catalog of neighborhoods per Praça-zona (Salvador ZE 1–19, Camaçari ZE 170/171).
 *
 * Salvador source (official):
 * - TRE-BA Resolução Administrativa nº 2/2017, Anexo I — circunscrição por bairro
 *   https://www.tre-ba.jus.br/legislacao/compilada/resolucao/2017/resolucao-administrativa-no-2-de-10-de-maio-de-2017
 *   (accessed 2026-07-21)
 *
 * Camaçari source (approximate):
 * - Localidades derivadas de locais de votação TRE-BA (ZE 170/171) + curadoria manual;
 *   não há lista oficial zona↔bairro comparável a Salvador.
 *   https://www.tre-ba.jus.br/servicos-eleitorais/titulo-e-local-de-votacao
 *   (accessed 2026-07-21)
 *
 * Coverage is independently checked by tests/fixtures/plaza-zone-neighborhoods.official.json.
 */

import { getPlazaCatalogEntry } from '@/lib/plazaCatalog'

export type PlazaZoneNeighborhoodSource = 'tre-ra-02-2017' | 'tre-voting-locations-curated'

export type PlazaZoneNeighborhoodCity = 'Salvador' | 'Camaçari'

export type PlazaZoneNeighborhoodEntry = {
  readonly plazaSlug: string
  readonly city: PlazaZoneNeighborhoodCity
  readonly zoneNumber: number
  readonly source: PlazaZoneNeighborhoodSource
  readonly neighborhoods: readonly string[]
}

const sortNeighborhoods = (names: readonly string[]): readonly string[] =>
  [...names].sort((left, right) => left.localeCompare(right, 'pt-BR'))

const entry = (
  plazaSlug: string,
  city: PlazaZoneNeighborhoodCity,
  zoneNumber: number,
  source: PlazaZoneNeighborhoodSource,
  neighborhoods: readonly string[],
): PlazaZoneNeighborhoodEntry => ({
  plazaSlug,
  city,
  zoneNumber,
  source,
  neighborhoods: sortNeighborhoods(neighborhoods),
})

export const plazaZoneNeighborhoods: readonly PlazaZoneNeighborhoodEntry[] = [
  entry('salvador-ze-1', 'Salvador', 1, 'tre-ra-02-2017', [
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
  entry('salvador-ze-2', 'Salvador', 2, 'tre-ra-02-2017', [
    'Amaralina',
    'Chapada do Rio Vermelho',
    'Engenho Velho da Federação',
    'Federação',
    'Ondina',
    'Rio Vermelho',
  ]),
  entry('salvador-ze-3', 'Salvador', 3, 'tre-ra-02-2017', [
    'Baixa de Quintas',
    'Cidade Nova',
    'Fazenda Grande do Retiro',
    'IAPI',
    'Pau Miúdo',
    'Pero Vaz',
    'Santa Mônica',
  ]),
  entry('salvador-ze-4', 'Salvador', 4, 'tre-ra-02-2017', [
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
  entry('salvador-ze-5', 'Salvador', 5, 'tre-ra-02-2017', [
    'Barreiras',
    'Cabula',
    'Engomadeira',
    'Mata Escura',
    'Resgate',
    'Retiro',
    'São Gonçalo',
  ]),
  entry('salvador-ze-6', 'Salvador', 6, 'tre-ra-02-2017', [
    'Acupe',
    'Boa Vista de Brotas',
    'Brotas',
    'Candeal',
    'Engenho Velho de Brotas',
  ]),
  entry('salvador-ze-7', 'Salvador', 7, 'tre-ra-02-2017', [
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
  entry('salvador-ze-8', 'Salvador', 8, 'tre-ra-02-2017', [
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
  entry('salvador-ze-9', 'Salvador', 9, 'tre-ra-02-2017', [
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
  entry('salvador-ze-10', 'Salvador', 10, 'tre-ra-02-2017', [
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
  entry('salvador-ze-11', 'Salvador', 11, 'tre-ra-02-2017', [
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
  entry('salvador-ze-12', 'Salvador', 12, 'tre-ra-02-2017', [
    'Aeroporto',
    'Alto do Coqueirinho',
    'Areia Branca',
    'Itapuã',
    'Itinga',
    'Jardim das Margaridas',
    'São Cristóvão',
    'Stella Maris',
  ]),
  entry('salvador-ze-13', 'Salvador', 13, 'tre-ra-02-2017', [
    'Caminho das Árvores',
    'Itaigara',
    'Nordeste de Amaralina',
    'Pituba',
    'Santa Cruz',
    'Vale das Pedrinhas',
  ]),
  entry('salvador-ze-14', 'Salvador', 14, 'tre-ra-02-2017', [
    'Arenoso',
    'Novo Horizonte',
    'São Marcos',
    'Sussuarana',
    'Tancredo Neves',
  ]),
  entry('salvador-ze-15', 'Salvador', 15, 'tre-ra-02-2017', [
    'Arraial do Retiro',
    'Boa Vista de São Caetano',
    'Bom Juá',
    'Capelinha',
    'Lobato',
    'São Caetano',
  ]),
  entry('salvador-ze-16', 'Salvador', 16, 'tre-ra-02-2017', [
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
  entry('salvador-ze-17', 'Salvador', 17, 'tre-ra-02-2017', [
    'Alto da Terezinha',
    'Alto do Cabrito',
    'Itacaranha',
    'Periperi (parte ao sul da Rua das Pedrinhas)',
    'Plataforma',
    'Praia Grande',
    'Rio Sena',
    'São João do Cabrito',
  ]),
  entry('salvador-ze-18', 'Salvador', 18, 'tre-ra-02-2017', [
    "Caixa D'água",
    'Calçada',
    'Caminho de Areia',
    'Curuzu',
    'Lapinha',
    'Liberdade',
    'Mares',
    'Roma',
  ]),
  entry('salvador-ze-19', 'Salvador', 19, 'tre-ra-02-2017', [
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
  entry('camacari-ze-170', 'Camaçari', 170, 'tre-voting-locations-curated', [
    'Alto da Cruz',
    'Bairro do Natal',
    'Centro',
    'Camaçari de Dentro',
    'Dois de Julho',
    'Gleba A',
    'Gleba B',
    'Gleba C',
    'Gleba E',
    'Gleba H',
    'Gravatá',
    'Inocoop',
    'Jardim Limoeiro',
    'Lama Preta',
    'Limoeiro',
    'Mangueiral',
    'Nova Vitória',
    'Novo Horizonte',
    'Parque Verde',
    'Phoc I',
    'Phoc II',
    'Phoc III',
    'Polo Petroquímico',
    'Triângulo',
  ]),
  entry('camacari-ze-171', 'Camaçari', 171, 'tre-voting-locations-curated', [
    'Abrantes',
    'Arembepe',
    'Barra do Jacuípe',
    'Barra do Pojuca',
    'Catu de Abrantes',
    'Guarajuba',
    'Itacimirim',
    'Jauá',
    'Monte Gordo',
    'Povoado de Areias',
    'Vila de Abrantes',
  ]),
]

const entryBySlug = new Map(plazaZoneNeighborhoods.map((record) => [record.plazaSlug, record]))

export const plazaZoneNeighborhoodEntryForSlug = (
  slug: string,
): PlazaZoneNeighborhoodEntry | undefined => entryBySlug.get(slug)

export const plazaZoneNeighborhoodSourceLabel = (source: PlazaZoneNeighborhoodSource): string => {
  switch (source) {
    case 'tre-ra-02-2017':
      return 'Bairros conforme circunscrição oficial do TRE-BA (Resolução Administrativa nº 2/2017).'
    case 'tre-voting-locations-curated':
      return 'Lista aproximada a partir de locais de votação do TRE-BA; não há circunscrição oficial zona↔bairro em Camaçari.'
  }
}

const assertPlazaZoneNeighborhoodCatalogIntegrity = (): void => {
  for (const record of plazaZoneNeighborhoods) {
    const catalogEntry = getPlazaCatalogEntry(record.plazaSlug)
    if (!catalogEntry || catalogEntry.kind !== 'zona') {
      throw new Error(`Missing zona Praça catalog entry for slug: ${record.plazaSlug}`)
    }
    if (catalogEntry.city !== record.city || catalogEntry.zoneNumber !== record.zoneNumber) {
      throw new Error(`Catalog mismatch for slug: ${record.plazaSlug}`)
    }
  }
}

assertPlazaZoneNeighborhoodCatalogIntegrity()
