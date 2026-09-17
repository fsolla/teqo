import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  BULLETIN_TIMELINE_STEPS,
  CAREER_NOTES,
  CAREER_TIMELINE,
  DOSSIER_ERAS,
  SOLLA_BIRTH_DATE,
  SOLLA_BIRTH_PLACE,
  SOLLA_DEPUTY_ID,
  SOLLA_OFFICIAL_SITE,
} from '../../scripts/lib/dossieCareer.mjs'

describe('career literals (verbatim from the intention)', () => {
  it('pins the identity facts', () => {
    expect(SOLLA_DEPUTY_ID).toBe(178857)
    expect(SOLLA_BIRTH_DATE).toBe('1961-04-11')
    expect(SOLLA_BIRTH_PLACE).toBe('Salvador-BA')
    expect(SOLLA_OFFICIAL_SITE).toContain('178857')
    expect(CAREER_NOTES).toContain('Nunca foi deputado estadual.')
  })

  it('covers the three eras with the strategic posts', () => {
    expect(DOSSIER_ERAS.map((era) => era.id)).toEqual(['A', 'B', 'C'])
    const roles = CAREER_TIMELINE.map((row) => row.role).join(' | ')
    expect(roles).toContain('Vitória da Conquista')
    expect(roles).toContain('Atenção à Saúde do Ministério da Saúde')
    expect(roles).toContain('Secretário Estadual de Saúde da Bahia')
    expect(roles).toContain('Deputado Federal, 57ª legislatura')
  })

  it('keeps the uncertain periods marked instead of inventing a date', () => {
    const uncertain = CAREER_TIMELINE.filter((row) => row.uncertain).map((row) => row.uncertain)
    expect(uncertain.join(' ')).toMatch(/1989 vs 1990/)
    expect(uncertain.join(' ')).toMatch(/2005 vs 2006/)
  })

  it('has the four-step boletim trajectory', () => {
    expect(BULLETIN_TIMELINE_STEPS).toHaveLength(4)
  })

  it('does not drift from the skill prose', () => {
    const skill = readFileSync(
      resolve(process.cwd(), '.agents/skills/dossie-solla-cidade/SKILL.md'),
      'utf8',
    )
    expect(skill).toContain('178857')
    expect(skill).toContain('2007–2014')
    expect(skill).toContain('2015–2027')
    expect(skill).toContain('pré-2011')
  })
})
