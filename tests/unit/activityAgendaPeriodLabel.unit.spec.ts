import { describe, expect, it } from 'vitest'

import {
  activityAgendaAdjacentPeriod,
  activityAgendaPeriodLabel,
  activityAgendaViewFromFcId,
} from '@/utilities/activityUi'

describe('activityAgendaPeriodLabel', () => {
  it('rotula o dia pelo dia e mês', () => {
    expect(
      activityAgendaPeriodLabel(
        'day',
        '2026-08-09T00:00:00-03:00',
        '2026-08-10T00:00:00-03:00',
        '2026-08-09T00:00:00-03:00',
      ),
    ).toBe('9 Agosto')
  })

  it('rotula a semana pelo intervalo visível (segunda a domingo) no mesmo mês', () => {
    expect(
      activityAgendaPeriodLabel(
        'week',
        '2026-08-03T00:00:00-03:00',
        '2026-08-10T00:00:00-03:00',
        '2026-08-03T00:00:00-03:00',
      ),
    ).toBe('3–9 Agosto')
  })

  it('escreve os dois meses quando a semana cruza o limite do mês', () => {
    expect(
      activityAgendaPeriodLabel(
        'week',
        '2026-07-27T00:00:00-03:00',
        '2026-08-03T00:00:00-03:00',
        '2026-07-27T00:00:00-03:00',
      ),
    ).toBe('27 Julho – 2 Agosto')
  })

  it('cruza o ano sem omitir o dia final', () => {
    expect(
      activityAgendaPeriodLabel(
        'week',
        '2026-12-28T00:00:00-03:00',
        '2027-01-04T00:00:00-03:00',
        '2026-12-28T00:00:00-03:00',
      ),
    ).toBe('28 Dezembro – 3 Janeiro')
  })

  it('rotula o mês pelo mês ativo, não pelo início do grid (domingo antecedente)', () => {
    expect(
      activityAgendaPeriodLabel(
        'month',
        '2026-07-26T00:00:00-03:00',
        '2026-09-01T00:00:00-03:00',
        '2026-08-01',
      ),
    ).toBe('Agosto')
  })

  it('aceita o anchor como data civil pura (a forma do runtime, sem timezone)', () => {
    // O runtime passa `formatBahiaCivilDate(getDate())` — "2026-09-01" sem
    // offset. Parsear como instante UTC a deslocaria para 31 de agosto na
    // Bahia (meia-noite UTC = 21:00 do dia anterior).
    expect(
      activityAgendaPeriodLabel(
        'month',
        '2026-08-31T00:00:00-03:00',
        '2026-10-01T00:00:00-03:00',
        '2026-09-01',
      ),
    ).toBe('Setembro')
  })

  it('mantém "Agenda" na lista, onde os dias aparecem no corpo', () => {
    expect(
      activityAgendaPeriodLabel(
        'list',
        '2026-08-01T00:00:00-03:00',
        '2026-09-01T00:00:00-03:00',
        '2026-08-01T00:00:00-03:00',
      ),
    ).toBe('Agenda')
  })

  it('retorna null para intervalo ilegível', () => {
    expect(
      activityAgendaPeriodLabel(
        'day',
        'não-é-data',
        '2026-08-10T00:00:00-03:00',
        '2026-08-09T00:00:00-03:00',
      ),
    ).toBeNull()
    expect(
      activityAgendaPeriodLabel(
        'week',
        '2026-08-03T00:00:00-03:00',
        'não-é-data',
        '2026-08-03T00:00:00-03:00',
      ),
    ).toBeNull()
    expect(
      activityAgendaPeriodLabel(
        'month',
        '2026-08-01T00:00:00-03:00',
        '2026-09-01T00:00:00-03:00',
        'não-é-data',
      ),
    ).toBeNull()
  })
})

describe('activityAgendaAdjacentPeriod', () => {
  it('desloca o dia em ±1 dia e ancora no dia civil deslocado', () => {
    expect(
      activityAgendaAdjacentPeriod(
        'day',
        {
          start: '2026-08-09T00:00:00-03:00',
          end: '2026-08-10T00:00:00-03:00',
          anchorDate: '2026-08-09',
        },
        'next',
      ),
    ).toEqual({
      start: '2026-08-10T03:00:00.000Z',
      end: '2026-08-11T03:00:00.000Z',
      anchorDate: '2026-08-10',
    })
    expect(
      activityAgendaAdjacentPeriod(
        'day',
        {
          start: '2026-08-09T00:00:00-03:00',
          end: '2026-08-10T00:00:00-03:00',
          anchorDate: '2026-08-09',
        },
        'prev',
      ),
    ).toEqual({
      start: '2026-08-08T03:00:00.000Z',
      end: '2026-08-09T03:00:00.000Z',
      anchorDate: '2026-08-08',
    })
  })

  it('desloca a semana em ±7 dias preservando segunda a domingo', () => {
    expect(
      activityAgendaAdjacentPeriod(
        'week',
        {
          start: '2026-08-03T00:00:00-03:00',
          end: '2026-08-10T00:00:00-03:00',
          anchorDate: '2026-08-03',
        },
        'next',
      ),
    ).toEqual({
      start: '2026-08-10T03:00:00.000Z',
      end: '2026-08-17T03:00:00.000Z',
      anchorDate: '2026-08-10',
    })
  })

  it('cruza o ano na semana e o dia (28 Dezembro → 4 Janeiro)', () => {
    const weekRange = {
      start: '2026-12-28T00:00:00-03:00',
      end: '2027-01-04T00:00:00-03:00',
      anchorDate: '2026-12-28',
    }
    const next = activityAgendaAdjacentPeriod('week', weekRange, 'next')
    expect(next).toEqual({
      start: '2027-01-04T03:00:00.000Z',
      end: '2027-01-11T03:00:00.000Z',
      anchorDate: '2027-01-04',
    })
    expect(activityAgendaPeriodLabel('week', next!.start, next!.end, next!.anchorDate)).toBe(
      '4–10 Janeiro',
    )
  })

  it('desloca o mês a partir do anchor civil (1º do mês) com range de 42 dias', () => {
    const next = activityAgendaAdjacentPeriod(
      'month',
      {
        start: '2026-08-31T00:00:00-03:00',
        end: '2026-10-01T00:00:00-03:00',
        anchorDate: '2026-09-01',
      },
      'next',
    )
    // Outubro/2026: 1º é quinta → segunda que precede = 28 Setembro.
    expect(next).toEqual({
      start: '2026-09-28T03:00:00.000Z',
      end: '2026-11-09T03:00:00.000Z',
      anchorDate: '2026-10-01',
    })
    expect(activityAgendaPeriodLabel('month', next!.start, next!.end, next!.anchorDate)).toBe(
      'Outubro',
    )
  })

  it('desloca o mês cruzando o ano e ajusta o grid à segunda antecedente', () => {
    const prev = activityAgendaAdjacentPeriod(
      'month',
      {
        start: '2026-12-28T00:00:00-03:00',
        end: '2027-02-01T00:00:00-03:00',
        anchorDate: '2027-01-01',
      },
      'prev',
    )
    // Dezembro/2026: 1º é terça → segunda antecedente = 30 Novembro.
    expect(prev).toEqual({
      start: '2026-11-30T03:00:00.000Z',
      end: '2027-01-11T03:00:00.000Z',
      anchorDate: '2026-12-01',
    })
    expect(activityAgendaPeriodLabel('month', prev!.start, prev!.end, prev!.anchorDate)).toBe(
      'Dezembro',
    )
  })

  it('lida com ano bissexto na virada do mês (Fevereiro 2028)', () => {
    const next = activityAgendaAdjacentPeriod(
      'month',
      {
        start: '2028-01-31T00:00:00-03:00',
        end: '2028-03-01T00:00:00-03:00',
        anchorDate: '2028-02-01',
      },
      'next',
    )
    // Março/2028: 1º é quarta → segunda antecedente = 28 Fevereiro.
    expect(next).toEqual({
      start: '2028-02-28T03:00:00.000Z',
      end: '2028-04-10T03:00:00.000Z',
      anchorDate: '2028-03-01',
    })
  })

  it('desloca a lista em um mês inteiro (range do mês adjacente)', () => {
    expect(
      activityAgendaAdjacentPeriod(
        'list',
        {
          start: '2026-08-01T00:00:00-03:00',
          end: '2026-09-01T00:00:00-03:00',
          anchorDate: '2026-08-01',
        },
        'next',
      ),
    ).toEqual({
      start: '2026-09-01T03:00:00.000Z',
      end: '2026-10-01T03:00:00.000Z',
      anchorDate: '2026-09-01',
    })
  })

  it('retorna null quando o anchor do mês não é o 1º ou o intervalo é ilegível', () => {
    expect(
      activityAgendaAdjacentPeriod(
        'month',
        {
          start: '2026-08-01T00:00:00-03:00',
          end: '2026-09-01T00:00:00-03:00',
          anchorDate: '2026-08-15',
        },
        'next',
      ),
    ).toBeNull()
    expect(
      activityAgendaAdjacentPeriod(
        'day',
        {
          start: 'não-é-data',
          end: '2026-08-10T00:00:00-03:00',
          anchorDate: '2026-08-09',
        },
        'next',
      ),
    ).toBeNull()
  })

  it('label do preview == título pós-commit (paridade dia/semana/mês/lista)', () => {
    const day = activityAgendaAdjacentPeriod(
      'day',
      {
        start: '2026-08-09T00:00:00-03:00',
        end: '2026-08-10T00:00:00-03:00',
        anchorDate: '2026-08-09',
      },
      'next',
    )
    expect(activityAgendaPeriodLabel('day', day!.start, day!.end, day!.anchorDate)).toBe(
      '10 Agosto',
    )

    const week = activityAgendaAdjacentPeriod(
      'week',
      {
        start: '2026-07-27T00:00:00-03:00',
        end: '2026-08-03T00:00:00-03:00',
        anchorDate: '2026-07-27',
      },
      'next',
    )
    expect(activityAgendaPeriodLabel('week', week!.start, week!.end, week!.anchorDate)).toBe(
      '3–9 Agosto',
    )

    const month = activityAgendaAdjacentPeriod(
      'month',
      {
        start: '2026-07-26T00:00:00-03:00',
        end: '2026-09-01T00:00:00-03:00',
        anchorDate: '2026-08-01',
      },
      'next',
    )
    expect(activityAgendaPeriodLabel('month', month!.start, month!.end, month!.anchorDate)).toBe(
      'Setembro',
    )

    const list = activityAgendaAdjacentPeriod(
      'list',
      {
        start: '2026-08-01T00:00:00-03:00',
        end: '2026-09-01T00:00:00-03:00',
        anchorDate: '2026-08-01',
      },
      'next',
    )
    expect(activityAgendaPeriodLabel('list', list!.start, list!.end, list!.anchorDate)).toBe(
      'Agenda',
    )
  })
})

describe('activityAgendaViewFromFcId', () => {
  it('espelha activityAgendaViewFcId para as quatro vistas', () => {
    expect(activityAgendaViewFromFcId('timeGridWeek')).toBe('week')
    expect(activityAgendaViewFromFcId('timeGridDay')).toBe('day')
    expect(activityAgendaViewFromFcId('dayGridMonth')).toBe('month')
    expect(activityAgendaViewFromFcId('listMonth')).toBe('list')
  })

  it('retorna null para um view id desconhecido', () => {
    expect(activityAgendaViewFromFcId('multiMonthYear')).toBeNull()
  })
})
