/**
 * changelog — pure policy for the per-delivery changelog format (OPS44).
 *
 * Deliveries write `docs/changelog/<date>-<id>.md` (one entry per file,
 * immune to merge conflicts by construction — same pattern as docs/plans/).
 * `pnpm changelog:build` inserts those entries into the single readable
 * docs/CHANGELOG-AGENTS.md in chronological position, keeping the
 * "Recently resolved" reading intact. The build is insert-only: it never
 * removes or rewrites existing blocks (historical entries stay as-is —
 * OPS44 scope), so the aggregate is append-only by construction. CI guards
 * that property (scripts/check-changelog-append-only.mjs) and that docs
 * diffs never carry conflict markers
 * (scripts/check-docs-conflict-markers.mjs).
 */

export const CHANGELOG_DIR = 'docs/changelog'
export const CHANGELOG_AGGREGATE = 'docs/CHANGELOG-AGENTS.md'

/** `2026-08-13-ops44.md` — date desc, then id asc. */
const ENTRY_FILE_RE = /^(\d{4})-(\d{2})-(\d{2})-([a-z0-9-]+)\.md$/

/** Leading line of a "Recently resolved" entry block. */
const ENTRY_BLOCK_RE = /^\*\*Recently resolved \((\d{4}-\d{2}-\d{2})\)/

/**
 * `changelog-rewrite: <motivo>` — standalone-line escape in the PR body for
 * legitimate aggregate loss (header rewrites, D8-style restorations). Kept
 * in the lib so the CLI and unit tests share one spelling. The template's
 * own checkbox text ("`changelog-rewrite: <motivo>` no body") must NOT
 * match — hence the line anchor.
 */
export const CHANGELOG_REWRITE_ESCAPE_RE = /^\s*changelog-rewrite\s*:/im

/**
 * @param {string} filename - basename of a file inside docs/changelog/
 * @returns {{ date: string, id: string } | null}
 */
export function parseChangelogEntryName(filename) {
  const match = ENTRY_FILE_RE.exec(filename)
  if (!match) return null
  const [, year, month, day, id] = match
  const m = Number(month)
  const d = Number(day)
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const check = new Date(Date.UTC(Number(year), m - 1, d))
  if (
    check.getUTCFullYear() !== Number(year) ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d
  ) {
    return null
  }
  return { date: `${year}-${month}-${day}`, id }
}

/**
 * Filters and validates a list of paths inside docs/changelog/.
 * Any .md file that does not match the entry pattern fails closed (the
 * folder is dedicated; garbage would silently drop out of the aggregate).
 *
 * @param {string[]} paths - repo-relative paths under docs/changelog/
 * @returns {{ entries: { path: string, name: string, date: string, id: string }[],
 *             errors: string[] }}
 */
export function listChangelogEntries(paths) {
  const entries = []
  const errors = []
  for (const path of paths) {
    const name = path.split('/').pop() ?? ''
    if (!name.endsWith('.md')) continue
    const parsed = parseChangelogEntryName(name)
    if (!parsed) {
      errors.push(`${path} — não casa o padrão <YYYY-MM-DD>-<id>.md`)
      continue
    }
    entries.push({ path, name, ...parsed })
  }
  entries.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return a.id.localeCompare(b.id)
  })
  return { entries, errors }
}

/**
 * Splits the aggregate into its static header (everything up to and
 * including the first `---` line) and the existing entry blocks (separated
 * by blank lines, trailing whitespace trimmed).
 *
 * @param {string} aggregateContent - current docs/CHANGELOG-AGENTS.md
 * @returns {{ header: string, blocks: string[] }}
 */
export function splitChangelogBody(aggregateContent) {
  const lines = aggregateContent.split('\n')
  const separatorIndex = lines.findIndex((line) => line === '---')
  if (separatorIndex === -1) {
    throw new Error('CHANGELOG-AGENTS.md sem separador "---" no cabeçalho')
  }
  const header = lines.slice(0, separatorIndex + 1).join('\n')
  const body = lines
    .slice(separatorIndex + 1)
    .join('\n')
    .replace(/^\n+/, '')
  const blocks = body
    .split('\n\n')
    .map((block) => block.trimEnd())
    .filter(Boolean)
  return { header, blocks }
}

/**
 * Builds the aggregate content by inserting entry contents into their
 * chronological position (date comes from each entry's own
 * "Recently resolved (date)" header, not from callers). Insert-only:
 * existing blocks are never removed or rewritten; an entry whose exact
 * text already exists is skipped (idempotent). Entries without a dated
 * header go to the top.
 *
 * @param {{ entries: { content: string }[],
 *           aggregateContent: string }} input - entries sorted date desc;
 *           current aggregate (source of header/blocks)
 * @returns {string} - full aggregate content (trailing newline)
 */
export function buildChangelog({ entries, aggregateContent }) {
  const { header, blocks } = splitChangelogBody(aggregateContent)

  const nextBlocks = [...blocks]
  for (const entry of entries) {
    const text = entry.content.trimEnd()
    if (nextBlocks.some((block) => block === text)) continue

    const entryDate = entryDateOf(text)
    const insertAt = entryDate
      ? nextBlocks.findIndex(
          (block) => entryDateOf(block) !== null && entryDateOf(block) < entryDate,
        )
      : 0
    nextBlocks.splice(insertAt === -1 ? nextBlocks.length : insertAt, 0, text)
  }

  return [header, ...nextBlocks].join('\n\n') + '\n'
}

/**
 * @param {string} block - an entry block starting with the resolved header
 * @returns {string | null} - entry date when the header matches
 */
export function entryDateOf(block) {
  const match = ENTRY_BLOCK_RE.exec(block)
  return match ? match[1] : null
}

/**
 * Append-only policy for the changelog (CI guard).
 *
 * The aggregate must never lose an existing line: every line of the old
 * content must still appear in the new content with equal or greater
 * count (multiset inclusion — honest under line moves/reordering, unlike
 * a diff parser). Files under docs/changelog/ must be additions only
 * (entries are immutable once committed; a deletion or modification is a
 * silent data-loss path).
 *
 * Legitimate restorations (D8-style) and header rewrites escape via the
 * documented `changelog-rewrite:` token in the PR body (see AGENT-OPS).
 *
 * @param {{ oldAggregate: string, newAggregate: string,
 *           changelogDiff: { status: string, path: string }[] }} input
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function assertChangelogAppendOnly({ oldAggregate, newAggregate, changelogDiff }) {
  const missing = missingLines(oldAggregate, newAggregate)
  if (missing.length > 0) {
    return {
      ok: false,
      message:
        `docs/CHANGELOG-AGENTS.md não é append-only: ${missing.length} linha(s) existente(s) ` +
        `somem (ex.: ${JSON.stringify(missing[0])}). Restaurações legítimas: use ` +
        '`changelog-rewrite: <motivo>` no body do PR (linha própria; definição em AGENT-OPS).',
    }
  }

  const touched = changelogDiff.filter((change) => change.status !== 'A')
  if (touched.length > 0) {
    return {
      ok: false,
      message:
        `docs/changelog/ não é additions-only: ${touched
          .map((change) => `${change.status} ${change.path}`)
          .join(', ')}. Entradas são imutáveis; restaurações legítimas: use ` +
        '`changelog-rewrite: <motivo>` no body do PR (linha própria; definição em AGENT-OPS).',
    }
  }

  return { ok: true }
}

/**
 * @param {string} oldContent
 * @param {string} newContent
 * @returns {string[]} - distinct old lines missing or under-counted in new
 */
export function missingLines(oldContent, newContent) {
  const counts = new Map()
  for (const line of newContent.split('\n')) {
    counts.set(line, (counts.get(line) ?? 0) + 1)
  }

  const missing = []
  for (const line of oldContent.split('\n')) {
    const remaining = counts.get(line) ?? 0
    if (remaining <= 0) {
      missing.push(line)
    } else {
      counts.set(line, remaining - 1)
    }
  }
  return [...new Set(missing)]
}
