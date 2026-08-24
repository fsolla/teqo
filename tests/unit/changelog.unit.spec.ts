// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  assertChangelogAppendOnly,
  buildChangelog,
  CHANGELOG_AGGREGATE,
  CHANGELOG_HEADER,
  CHANGELOG_HISTORY,
  CHANGELOG_REWRITE_ESCAPE_RE,
  entryDateOf,
  listChangelogEntries,
  missingAggregateEntries,
  parseChangelogEntryName,
  seedAggregateFromHistory,
  splitChangelogBody,
} from '../../scripts/lib/changelog.mjs'

const HEADER = `# Changelog de contexto para agentes (fatias do AGENTS.md)

Conteúdo movido do \`AGENTS.md\` em 2026-07-30.

---`

const ENTRY_2026_08_13 = `**Recently resolved (2026-08-13):** **OPS44** — teste. Intenção [x](plans/x.md); impl [x-impl](plans/x-impl.md).`
const ENTRY_2026_08_12 = `**Recently resolved (2026-08-12):** **B200** — teste.`

describe('parseChangelogEntryName', () => {
  it('parses the canonical date-id filename', () => {
    expect(parseChangelogEntryName('2026-08-13-ops44.md')).toEqual({
      date: '2026-08-13',
      id: 'ops44',
    })
  })

  it('accepts alphanumeric ids with dashes', () => {
    expect(parseChangelogEntryName('2026-08-12-c123-teste.md')).toEqual({
      date: '2026-08-12',
      id: 'c123-teste',
    })
  })

  it('rejects malformed names', () => {
    expect(parseChangelogEntryName('ops44.md')).toBeNull()
    expect(parseChangelogEntryName('2026-13-01-ops44.md')).toBeNull()
    expect(parseChangelogEntryName('2026-08-13.md')).toBeNull()
    expect(parseChangelogEntryName('2026-08-13-OPS44.md')).toBeNull()
    expect(parseChangelogEntryName('README.md')).toBeNull()
  })

  it('rejects impossible calendar dates', () => {
    expect(parseChangelogEntryName('2026-02-31-ops44.md')).toBeNull()
    expect(parseChangelogEntryName('2026-04-31-ops44.md')).toBeNull()
  })
})

describe('listChangelogEntries', () => {
  it('sorts by date desc then id asc', () => {
    const { entries, errors } = listChangelogEntries([
      'docs/changelog/2026-08-10-b197.md',
      'docs/changelog/2026-08-13-ops44.md',
      'docs/changelog/2026-08-12-a.md',
      'docs/changelog/2026-08-12-b.md',
    ])
    expect(errors).toEqual([])
    expect(entries.map((entry) => entry.name)).toEqual([
      '2026-08-13-ops44.md',
      '2026-08-12-a.md',
      '2026-08-12-b.md',
      '2026-08-10-b197.md',
    ])
  })

  it('fails closed on a .md that does not match the pattern', () => {
    const { entries, errors } = listChangelogEntries([
      'docs/changelog/2026-08-13-ops44.md',
      'docs/changelog/not-an-entry.md',
    ])
    expect(entries).toHaveLength(1)
    expect(errors).toEqual([
      'docs/changelog/not-an-entry.md — não casa o padrão <YYYY-MM-DD>-<id>.md',
    ])
  })

  it('ignores non-md files (e.g. stray assets)', () => {
    const { entries, errors } = listChangelogEntries([
      'docs/changelog/2026-08-13-ops44.md',
      'docs/changelog/foo.txt',
    ])
    expect(errors).toEqual([])
    expect(entries).toHaveLength(1)
  })
})

describe('splitChangelogBody', () => {
  const aggregate = `${HEADER}\n\n${ENTRY_2026_08_13}\n\n${ENTRY_2026_08_12}\n`

  it('splits the static header from the entry blocks', () => {
    expect(splitChangelogBody(aggregate)).toEqual({
      header: HEADER,
      blocks: [ENTRY_2026_08_13, ENTRY_2026_08_12],
    })
  })

  it('trims trailing whitespace from blocks', () => {
    const { blocks } = splitChangelogBody(`${HEADER}\n\n${ENTRY_2026_08_13}  \n`)
    expect(blocks).toEqual([ENTRY_2026_08_13])
  })

  it('throws when the separator is missing', () => {
    expect(() => splitChangelogBody('sem separador')).toThrow('sem separador')
  })
})

describe('entryDateOf', () => {
  it('extracts the date from a Recently resolved header', () => {
    expect(entryDateOf(ENTRY_2026_08_13)).toBe('2026-08-13')
  })

  it('returns null for a block without the header', () => {
    expect(entryDateOf('bloco sem header')).toBeNull()
  })
})

describe('buildChangelog', () => {
  const aggregate = `${HEADER}\n\n${ENTRY_2026_08_12}\n`

  it('inserts a newer entry before an existing older block', () => {
    const content = buildChangelog({
      entries: [{ content: ENTRY_2026_08_13 }],
      aggregateContent: aggregate,
    })
    expect(content).toBe(`${HEADER}\n\n${ENTRY_2026_08_13}\n\n${ENTRY_2026_08_12}\n`)
  })

  it('inserts an older entry after a newer existing block', () => {
    const content = buildChangelog({
      entries: [{ content: ENTRY_2026_08_12 }],
      aggregateContent: `${HEADER}\n\n${ENTRY_2026_08_13}\n`,
    })
    expect(content).toBe(`${HEADER}\n\n${ENTRY_2026_08_13}\n\n${ENTRY_2026_08_12}\n`)
  })

  it('is idempotent — a present entry is skipped', () => {
    const first = buildChangelog({
      entries: [{ content: ENTRY_2026_08_13 }],
      aggregateContent: aggregate,
    })
    const second = buildChangelog({
      entries: [{ content: ENTRY_2026_08_13 }],
      aggregateContent: first,
    })
    expect(second).toBe(first)
  })

  it('skips only on exact equality — a longer entry is not hidden by a prefix', () => {
    const content = buildChangelog({
      entries: [{ content: `${ENTRY_2026_08_12} detalhes extras.` }, { content: ENTRY_2026_08_13 }],
      aggregateContent: aggregate,
    })
    expect(content).toBe(
      `${HEADER}\n\n${ENTRY_2026_08_13}\n\n${ENTRY_2026_08_12}\n\n${ENTRY_2026_08_12} detalhes extras.\n`,
    )
  })

  it('is idempotent for entries with trailing blank lines (trimmed both sides)', () => {
    const first = buildChangelog({
      entries: [{ content: `${ENTRY_2026_08_13}\n  \n\n` }],
      aggregateContent: aggregate,
    })
    const second = buildChangelog({
      entries: [{ content: ENTRY_2026_08_13 }],
      aggregateContent: first,
    })
    expect(second).toBe(first)
  })

  it('inserts an entry without a date header at the top', () => {
    const content = buildChangelog({
      entries: [{ content: 'bloco sem data' }],
      aggregateContent: aggregate,
    })
    expect(content).toBe(`${HEADER}\n\nbloco sem data\n\n${ENTRY_2026_08_12}\n`)
  })

  it('trims trailing newlines from entry contents', () => {
    const content = buildChangelog({
      entries: [{ content: `${ENTRY_2026_08_13}\n\n` }],
      aggregateContent: aggregate,
    })
    expect(content).toBe(`${HEADER}\n\n${ENTRY_2026_08_13}\n\n${ENTRY_2026_08_12}\n`)
  })
})

describe('CHANGELOG_REWRITE_ESCAPE_RE', () => {
  it('matches a standalone changelog-rewrite line in a PR body', () => {
    expect(
      CHANGELOG_REWRITE_ESCAPE_RE.test('## Notas\n\nchangelog-rewrite: header do agregado mudou'),
    ).toBe(true)
    expect(CHANGELOG_REWRITE_ESCAPE_RE.test('changelog-rewrite:restauração D8')).toBe(true)
  })

  it('never matches the PR template checkbox text (which cites the token)', () => {
    expect(
      CHANGELOG_REWRITE_ESCAPE_RE.test(
        '- [ ] Se o changelog perdeu linhas de propósito: `changelog-rewrite: <motivo>` no body',
      ),
    ).toBe(false)
  })
})

describe('seedAggregateFromHistory', () => {
  const history = `${HEADER}\n\n${ENTRY_2026_08_12}\n`

  it('uses the fresh CHANGELOG_HEADER with the HISTORY blocks as seed', () => {
    const seeded = seedAggregateFromHistory(history)
    expect(seeded.startsWith(CHANGELOG_HEADER)).toBe(true)
    expect(seeded).toContain(ENTRY_2026_08_12)
  })

  it('round-trips: build over the seed is idempotent and complete', () => {
    const seeded = seedAggregateFromHistory(history)
    const next = buildChangelog({
      entries: [{ content: ENTRY_2026_08_12 }, { content: ENTRY_2026_08_13 }],
      aggregateContent: seeded,
    })
    expect(next).toBe(`${CHANGELOG_HEADER}\n\n${ENTRY_2026_08_13}\n\n${ENTRY_2026_08_12}\n`)
    expect(
      missingAggregateEntries(
        [
          { path: 'docs/changelog/2026-08-12-x.md', content: ENTRY_2026_08_12 },
          { path: 'docs/changelog/2026-08-13-y.md', content: ENTRY_2026_08_13 },
        ],
        next,
      ),
    ).toEqual([])
  })
})

describe('missingAggregateEntries', () => {
  it('flags an entry absent from the generated aggregate', () => {
    expect(
      missingAggregateEntries(
        [{ path: 'docs/changelog/2026-08-12-x.md', content: ENTRY_2026_08_12 }],
        'outro conteúdo',
      ),
    ).toEqual(['docs/changelog/2026-08-12-x.md'])
  })

  it('returns [] when every entry text appears', () => {
    expect(
      missingAggregateEntries(
        [{ path: 'docs/changelog/2026-08-12-x.md', content: ENTRY_2026_08_12 }],
        `prefácio\n\n${ENTRY_2026_08_12}\n`,
      ),
    ).toEqual([])
  })
})

describe('assertChangelogAppendOnly', () => {
  it('passes on a pure addition in docs/changelog/ with no other changelog diff', () => {
    expect(
      assertChangelogAppendOnly({
        changelogDiff: [{ status: 'A', path: 'docs/changelog/2026-08-13-ops44.md' }],
        historyDiff: [],
        aggregateDiff: [],
      }),
    ).toEqual({ ok: true })
  })

  it('passes on the OPS85 migration — aggregate removed together with HISTORY creation', () => {
    expect(
      assertChangelogAppendOnly({
        changelogDiff: [{ status: 'A', path: 'docs/changelog/2026-08-24-ops85.md' }],
        historyDiff: [{ status: 'A', path: CHANGELOG_HISTORY }],
        aggregateDiff: [{ status: 'D', path: CHANGELOG_AGGREGATE }],
      }),
    ).toEqual({ ok: true })
  })

  it('fails when the aggregate is added or modified (it must never be committed)', () => {
    for (const status of ['A', 'M']) {
      const result = assertChangelogAppendOnly({
        changelogDiff: [],
        historyDiff: [],
        aggregateDiff: [{ status, path: CHANGELOG_AGGREGATE }],
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.message).toContain('não deve ser commitado')
      }
    }
  })

  it('fails when the aggregate is removed without creating the HISTORY snapshot', () => {
    const result = assertChangelogAppendOnly({
      changelogDiff: [],
      historyDiff: [],
      aggregateDiff: [{ status: 'D', path: CHANGELOG_AGGREGATE }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('removido sem criar')
      expect(result.message).toContain('changelog-rewrite')
    }
  })

  it('fails when the HISTORY snapshot is modified or deleted', () => {
    for (const status of ['M', 'D']) {
      const result = assertChangelogAppendOnly({
        changelogDiff: [],
        historyDiff: [{ status, path: CHANGELOG_HISTORY }],
        aggregateDiff: [],
      })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.message).toContain('congelado')
        expect(result.message).toContain('changelog-rewrite')
      }
    }
  })

  it('fails when a docs/changelog file is modified', () => {
    const result = assertChangelogAppendOnly({
      changelogDiff: [{ status: 'M', path: 'docs/changelog/2026-08-13-ops44.md' }],
      historyDiff: [],
      aggregateDiff: [],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('additions-only')
      expect(result.message).toContain('M docs/changelog/2026-08-13-ops44.md')
    }
  })

  it('fails when a docs/changelog file is deleted', () => {
    const result = assertChangelogAppendOnly({
      changelogDiff: [{ status: 'D', path: 'docs/changelog/2026-08-12-b200.md' }],
      historyDiff: [],
      aggregateDiff: [],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('D docs/changelog/2026-08-12-b200.md')
    }
  })
})
