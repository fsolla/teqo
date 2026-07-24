import { describe, expect, it } from 'vitest'

import {
  mapSheetPriority,
  parseExpectationCell,
  parseSheetNumber,
  parseSituationCell,
  splitNameCell,
} from '@/lib/projectionSheetParse'

describe('parseSheetNumber', () => {
  it('parses Brazilian thousand separators', () => {
    expect(parseSheetNumber('10.000')).toBe(10000)
    expect(parseSheetNumber('1.400')).toBe(1400)
    expect(parseSheetNumber(350)).toBe(350)
  })

  it('returns null for empty or non-numeric', () => {
    expect(parseSheetNumber('')).toBeNull()
    expect(parseSheetNumber(null)).toBeNull()
    expect(parseSheetNumber('n/a')).toBeNull()
  })
})

describe('parseExpectationCell', () => {
  it('maps Bom/Regular/Mínimo onto optimistic/central/pessimistic', () => {
    expect(parseExpectationCell('Bom:200 | Regular: 150 | Minimo: 100')).toEqual({
      optimistic: 200,
      central: 150,
      pessimistic: 100,
    })
    expect(parseExpectationCell('Bom: 300 | Regular: 200 | Minimo: 100')).toEqual({
      optimistic: 300,
      central: 200,
      pessimistic: 100,
    })
    expect(parseExpectationCell('Bom: 200| Regular: 150| Minimo: 100')).toEqual({
      optimistic: 200,
      central: 150,
      pessimistic: 100,
    })
  })

  it('parses thousand separators inside labeled cells', () => {
    expect(parseExpectationCell('Bom: 2.000 | Regular: 1.500 | Minimo: 1.000')).toEqual({
      optimistic: 2000,
      central: 1500,
      pessimistic: 1000,
    })
    expect(parseExpectationCell('Bom: 10.000 | Regular: 8.000 | Minimo: 6.000')).toEqual({
      optimistic: 10000,
      central: 8000,
      pessimistic: 6000,
    })
  })

  it('accepts Mínimo with accent', () => {
    expect(parseExpectationCell('Bom: 100 | Regular: 80 | Mínimo: 50')).toEqual({
      optimistic: 100,
      central: 80,
      pessimistic: 50,
    })
  })

  it('parses slash format', () => {
    expect(parseExpectationCell('800/500/400')).toEqual({
      optimistic: 800,
      central: 500,
      pessimistic: 400,
    })
    expect(parseExpectationCell('300 /200 /100')).toEqual({
      optimistic: 300,
      central: 200,
      pessimistic: 100,
    })
  })

  it('tolerates backslash separators from sheet export glitches', () => {
    expect(parseExpectationCell('Bom:300 \\Regular:150\\ mínimo: 50')).toEqual({
      optimistic: 300,
      central: 150,
      pessimistic: 50,
    })
  })

  it('returns null for empty or unrecognized cells', () => {
    expect(parseExpectationCell(null)).toBeNull()
    expect(parseExpectationCell('')).toBeNull()
    expect(parseExpectationCell('Bom: 50 / regular: 30 / otmo: 100')).toBeNull()
  })
})

describe('mapSheetPriority', () => {
  it('maps alta to alta regardless of case', () => {
    expect(mapSheetPriority('alta')).toBe('alta')
    expect(mapSheetPriority('Alta')).toBe('alta')
    expect(mapSheetPriority(' ALTA ')).toBe('alta')
  })

  it('maps Baixa, empty, and unknown to normal', () => {
    expect(mapSheetPriority('Baixa')).toBe('normal')
    expect(mapSheetPriority('')).toBe('normal')
    expect(mapSheetPriority(null)).toBe('normal')
    expect(mapSheetPriority('média')).toBe('normal')
  })
})

describe('parseSituationCell', () => {
  it('maps the long MAPA GERAL labels with emoji', () => {
    expect(parseSituationCell('🔴  QUEDA DE VOTOS  —  Requer ação imediata')).toBe('desfavoravel')
    expect(parseSituationCell('🟡  MANTÉM VOTAÇÃO  —  Acompanhar de perto')).toBe('neutra')
    expect(parseSituationCell('🟢  AUMENTO DE VOTOS  —  Consolidar e ampliar')).toBe('favoravel')
  })

  it('maps the bare PRIORITÁRIAS labels', () => {
    expect(parseSituationCell('QUEDA')).toBe('desfavoravel')
    expect(parseSituationCell('MANTÉM')).toBe('neutra')
    expect(parseSituationCell('AUMENTO')).toBe('favoravel')
  })

  it('returns null for undefined situations and footers', () => {
    expect(parseSituationCell('NÃO DEFINIDA')).toBeNull()
    expect(parseSituationCell('TOTAL GERAL')).toBeNull()
    expect(parseSituationCell('')).toBeNull()
    expect(parseSituationCell(null)).toBeNull()
  })
})

describe('splitNameCell', () => {
  it('splits on commas, slashes, and " e "', () => {
    expect(splitNameCell('Mário, Romilson, Diquinha e Jamile')).toEqual({
      names: ['Mário', 'Romilson', 'Diquinha', 'Jamile'],
      skipped: [],
    })
    expect(splitNameCell('Júlio-').names).toEqual(['Júlio'])
    expect(splitNameCell('Roberto/Oseas e Ademário')).toEqual({
      names: ['Roberto', 'Oseas', 'Ademário'],
      skipped: [],
    })
    expect(splitNameCell('Radiovaldo e Júlio e Ludimila')).toEqual({
      names: ['Radiovaldo', 'Júlio', 'Ludimila'],
      skipped: [],
    })
  })

  it('keeps honorifics and descriptors as part of the name', () => {
    expect(splitNameCell('Pedro Melo, Vera, Dr. Paulo e Yago').names).toEqual([
      'Pedro Melo',
      'Vera',
      'Dr. Paulo',
      'Yago',
    ])
    expect(splitNameCell('Emiran, Amilton do PT e Moça de KK')).toEqual({
      names: ['Emiran', 'Amilton do PT'],
      skipped: ['Moça de KK'],
    })
    expect(splitNameCell('Markão, Sandrinho, Prefeito e Eleni Sec Saúde')).toEqual({
      names: ['Markão', 'Sandrinho', 'Eleni Sec Saúde'],
      skipped: ['Prefeito'],
    })
  })

  it('extracts parentheticals before splitting', () => {
    expect(splitNameCell('Cintia/Fernando/ (shaulin e davi terra ) e Silvio')).toEqual({
      names: ['Cintia', 'Fernando', 'Silvio'],
      skipped: ['(shaulin e davi terra )'],
    })
    expect(splitNameCell('Lucy, Edizio e Marianna (com Jamile)')).toEqual({
      names: ['Lucy', 'Edizio', 'Marianna'],
      skipped: ['(com Jamile)'],
    })
  })

  it('drops uncertainty markers and placeholder dashes', () => {
    expect(splitNameCell('Alex? e Júlio')).toEqual({ names: ['Júlio'], skipped: ['Alex?'] })
    expect(splitNameCell('Panfile, Eliomar, vice?')).toEqual({
      names: ['Panfile', 'Eliomar'],
      skipped: ['vice?'],
    })
    expect(splitNameCell('-')).toEqual({ names: [], skipped: ['-'] })
    expect(splitNameCell('?')).toEqual({ names: [], skipped: ['?'] })
    expect(splitNameCell(null)).toEqual({ names: [], skipped: [] })
  })

  it('drops action phrases and collectives', () => {
    expect(splitNameCell('VER COM VILMA').names).toEqual([])
    expect(splitNameCell('CONFIRMAR COM JÚLIO').names).toEqual([])
    expect(splitNameCell('AGUARDAR DEFINIÇÃO DE CIBELE').names).toEqual([])
    expect(splitNameCell('SOLLA VAI INFORMAR').names).toEqual([])
    expect(splitNameCell('Solla vai ver').names).toEqual([])
    expect(splitNameCell('Construindo pra trocar Galo por Julio ou Rosemberg').names).toEqual([])
    expect(splitNameCell('Júlio e  Estadual do Prefeito')).toEqual({
      names: ['Júlio'],
      skipped: ['Estadual do Prefeito'],
    })
    expect(splitNameCell('A definir').names).toEqual([])
    expect(splitNameCell('candidato do Prefeito').names).toEqual([])
    expect(splitNameCell('Chico e vereador')).toEqual({
      names: ['Chico'],
      skipped: ['vereador'],
    })
    expect(splitNameCell('TRATAR COM ADEMAR DELGADO').names).toEqual([])
    expect(splitNameCell('Burica | DEFINIR ALYSON')).toEqual({
      names: ['Burica'],
      skipped: ['DEFINIR ALYSON'],
    })
    expect(splitNameCell('Diego Pita - COBRAR IONÁ').names).toEqual([])
    expect(splitNameCell('Ex-vice prefeito').names).toEqual([])
    expect(splitNameCell('o Prefeito').names).toEqual([])
    expect(splitNameCell('Assessor de Fatima Nunes').names).toEqual([])
    expect(splitNameCell('Presidente do PT e Netinho presidente do PT')).toEqual({
      names: ['Netinho presidente do PT'],
      skipped: ['Presidente do PT'],
    })
    expect(splitNameCell('Meiriane ex prefeita').names).toEqual(['Meiriane ex prefeita'])
    expect(splitNameCell('Rogério e grupo de ACS, Rodrigo ')).toEqual({
      names: ['Rogério', 'Rodrigo'],
      skipped: ['grupo de ACS'],
    })
    expect(splitNameCell('Dr. Ruy e pesoal do PT e  Alfredo Boasorte')).toEqual({
      names: ['Dr. Ruy', 'Alfredo Boasorte'],
      skipped: ['pesoal do PT'],
    })
    expect(splitNameCell('Sec. Saúde, Rosival Presidente do PT, Associação de mulheres')).toEqual({
      names: ['Rosival Presidente do PT'],
      skipped: ['Sec. Saúde', 'Associação de mulheres'],
    })
    expect(splitNameCell('Adiel  e irmã de Nagib, pessoal do Circo (Oseas) e Pessoal do Roque')).toEqual(
      {
        names: ['Adiel'],
        skipped: ['(Oseas)', 'irmã de Nagib', 'pessoal do Circo', 'Pessoal do Roque'],
      },
    )
  })

  it('splits sentence periods while keeping honorific abbreviations intact', () => {
    expect(splitNameCell('Lucy. Falar com Fabio e com Goiano')).toEqual({
      names: ['Lucy'],
      skipped: ['Falar com Fabio', 'com Goiano'],
    })
    expect(splitNameCell('Telma, Breno e Nem do Caipe, Luis campineira.').names).toEqual([
      'Telma',
      'Breno',
      'Nem do Caipe',
      'Luis campineira',
    ])
  })

  it('keeps compound entries with embedded descriptors', () => {
    expect(
      splitNameCell(
        'David Terra, Geysa e Ana Fraga, Adalicio - Sindicato dos Trabalhadores Rurais e sogro de Matheus, Fernando de Cairu, Jaci Perninha',
      ),
    ).toEqual({
      names: [
        'David Terra',
        'Geysa',
        'Ana Fraga',
        'Adalicio - Sindicato dos Trabalhadores Rurais',
        'Fernando de Cairu',
        'Jaci Perninha',
      ],
      skipped: ['sogro de Matheus'],
    })
    expect(splitNameCell('Getúlio e vereadores')).toEqual({
      names: ['Getúlio'],
      skipped: ['vereadores'],
    })
  })
})
