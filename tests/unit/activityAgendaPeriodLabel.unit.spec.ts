import { describe, expect, it } from 'vitest'

import { activityAgendaPeriodLabel, activityAgendaViewFromFcId } from '@/utilities/activityUi'

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
