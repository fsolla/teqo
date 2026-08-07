// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { branchNameForIssue, issueCodeAndSubject } from '../../scripts/lib/worktree.mjs'

type TestIssue = {
  number: number
  title: string
  meta?: { id?: string }
}

const issue = (over: Partial<TestIssue> = {}): TestIssue => ({
  number: 1,
  title: 'C15 — FullCalendar em /campanha/agenda',
  meta: { id: 'C15' },
  ...over,
})

describe('issueCodeAndSubject', () => {
  it('extracts the frontmatter id and strips the em-dash prefix', () => {
    expect(issueCodeAndSubject(issue())).toEqual({
      code: 'C15',
      subject: 'FullCalendar em /campanha/agenda',
    })
  })

  it('tolerates dash variants after the code', () => {
    for (const title of ['C15- FullCalendar', 'C15: FullCalendar', 'C15 — FullCalendar']) {
      expect(issueCodeAndSubject(issue({ title })).subject).toBe('FullCalendar')
    }
  })

  it('falls back to the leading title token when the frontmatter id is missing', () => {
    expect(issueCodeAndSubject(issue({ meta: {}, title: 'B164 — Barra de nav' }))).toEqual({
      code: null,
      subject: 'Barra de nav',
    })
  })
})

describe('branchNameForIssue', () => {
  it('builds <code>-<slug> with the repo slugify', () => {
    expect(branchNameForIssue(issue({ title: 'C15 — FullCalendar em /campanha/agenda' }))).toBe(
      'C15-fullcalendar-em-campanha-agenda',
    )
  })

  it('strips accents from the pt-BR title', () => {
    expect(
      branchNameForIssue(
        issue({ title: 'B164 — Barra de navegação inferior no mobile', meta: { id: 'B164' } }),
      ),
    ).toBe('B164-barra-de-navegacao-inferior-no-mobile')
  })

  it('truncates long slugs but keeps the code', () => {
    const title = 'X9 — ' + 'palavra '.repeat(20).trim()
    const branch = branchNameForIssue(issue({ title, meta: { id: 'X9' } }), 30)
    expect(branch.startsWith('X9-')).toBe(true)
    expect(branch.length).toBeLessThanOrEqual(30)
  })

  it('throws when the issue has no code — never invents', () => {
    expect(() => branchNameForIssue(issue({ meta: {}, title: 'Sem código' }))).toThrow(
      /frontmatter/,
    )
  })
})
