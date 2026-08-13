// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  assertChangelogAppendOnly,
  buildChangelog,
  CHANGELOG_REWRITE_ESCAPE_RE,
  entryDateOf,
  listChangelogEntries,
  missingLines,
  parseChangelogEntryName,
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

describe('missingLines', () => {
  it('returns [] for a pure addition', () => {
    expect(missingLines('a\nb\n', 'x\na\nb\n')).toEqual([])
  })

  it('flags a removed line', () => {
    expect(missingLines('a\nb\n', 'a\n')).toEqual(['b'])
  })

  it('treats a moved line as present (multiset, not position)', () => {
    expect(missingLines('a\nb\nc\n', 'c\na\nb\n')).toEqual([])
  })

  it('flags a line whose count decreases (duplicate lost)', () => {
    expect(missingLines('a\na\n', 'a\n')).toEqual(['a'])
  })

  it('returns distinct missing lines', () => {
    expect(missingLines('a\nb\nb\n', 'a\n')).toEqual(['b'])
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

describe('assertChangelogAppendOnly', () => {
  it('passes on a pure addition with no changelog file touched', () => {
    expect(
      assertChangelogAppendOnly({
        oldAggregate: 'a\nb\n',
        newAggregate: 'a\nb\nc\n',
        changelogDiff: [{ status: 'A', path: 'docs/changelog/2026-08-13-ops44.md' }],
      }),
    ).toEqual({ ok: true })
  })

  it('fails when an aggregate line disappears', () => {
    const result = assertChangelogAppendOnly({
      oldAggregate: 'a\nb\n',
      newAggregate: 'a\n',
      changelogDiff: [],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('não é append-only')
      expect(result.message).toContain('changelog-rewrite')
    }
  })

  it('passes on an addition inside docs/changelog/', () => {
    expect(
      assertChangelogAppendOnly({
        oldAggregate: 'a\n',
        newAggregate: 'a\nb\n',
        changelogDiff: [{ status: 'A', path: 'docs/changelog/2026-08-13-ops44.md' }],
      }),
    ).toEqual({ ok: true })
  })

  it('fails when a docs/changelog file is modified', () => {
    const result = assertChangelogAppendOnly({
      oldAggregate: 'a\n',
      newAggregate: 'a\nb\n',
      changelogDiff: [{ status: 'M', path: 'docs/changelog/2026-08-13-ops44.md' }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('additions-only')
      expect(result.message).toContain('M docs/changelog/2026-08-13-ops44.md')
    }
  })

  it('fails when a docs/changelog file is deleted', () => {
    const result = assertChangelogAppendOnly({
      oldAggregate: 'a\n',
      newAggregate: 'a\n',
      changelogDiff: [{ status: 'D', path: 'docs/changelog/2026-08-12-b200.md' }],
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toContain('D docs/changelog/2026-08-12-b200.md')
    }
  })
})
