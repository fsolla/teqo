/**
 * changelog — pure policy for the per-delivery changelog format (OPS44/OPS85).
 *
 * Deliveries write `docs/changelog/<date>-<id>.md` (one entry per file,
 * immune to merge conflicts by construction — same pattern as docs/plans/).
 * Since OPS85 the committed changelog record is exactly those files: the
 * readable aggregate docs/CHANGELOG-AGENTS.md is a gitignored artifact
 * regenerated on demand (`pnpm changelog:build` writes it, `changelog:read`
 * prints it), seeded from the frozen snapshot
 * docs/CHANGELOG-AGENTS-HISTORY.md when the local file is absent. The build
 * stays insert-only: it never removes or rewrites existing blocks. CI guards
 * (scripts/check-changelog-append-only.mjs) that docs/changelog/ entries are
 * additions-only, the HISTORY snapshot is frozen, and the regenerable
 * aggregate is never committed; docs diffs must never carry conflict markers
 * (scripts/check-docs-conflict-markers.mjs).
 */

export const CHANGELOG_DIR = 'docs/changelog'
export const CHANGELOG_AGGREGATE = 'docs/CHANGELOG-AGENTS.md'
export const CHANGELOG_HISTORY = 'docs/CHANGELOG-AGENTS-HISTORY.md'

/**
 * Header of the regenerated aggregate (OPS85). Used as the seed header when
 * the local aggregate is absent and the build starts from the HISTORY
 * snapshot. Must contain the `---` separator (splitChangelogBody contract).
 */
export const CHANGELOG_HEADER = `# Changelog de contexto para agentes (fatias do AGENTS.md)

Conteúdo movido do \`AGENTS.md\` em 2026-07-30 (fatiamento do paradigma de agentes paralelos): "Known Gaps" e todos os blocos "Recently resolved". Histórico — leia só quando precisar do contexto de uma entrega passada; o sempre-presente fica no \`AGENTS.md\`. **Este arquivo é um artefato regenerado sob demanda (OPS85):** é gitignored e nunca é commitado. Cada entrega registra UMA entrada em \`docs/changelog/<data>-<id>.md\` (único registro versionado); o agregado é gerado por \`pnpm changelog:build\` (grava aqui) ou \`pnpm changelog:read\` (stdout), com seed do snapshot congelado \`docs/CHANGELOG-AGENTS-HISTORY.md\` quando o arquivo local não existe. Guard de CI \`docs-guards\` (entradas additions-only, HISTORY congelado, agregado não-commitado) e escape \`changelog-rewrite:\` documentados em AGENT-OPS.

---`

/** `2026-08-13-ops44.md` — date desc, then id asc. */
const ENTRY_FILE_RE = /^(\d{4})-(\d{2})-(\d{2})-([a-z0-9-]+)\.md$/

/** Leading line of a "Recently resolved" entry block. */
const ENTRY_BLOCK_RE = /^\*\*Recently resolved \((\d{4}-\d{2}-\d{2})\)/

/**
 * Seeds the regenerable aggregate from the frozen HISTORY snapshot (OPS85):
 * the snapshot's entry blocks become the seed blocks under the fresh
 * CHANGELOG_HEADER. Used when the local aggregate file is absent.
 *
 * @param {string} historyContent - content of docs/CHANGELOG-AGENTS-HISTORY.md
 * @returns {string} - aggregate-shaped content with CHANGELOG_HEADER + blocks
 */
export function seedAggregateFromHistory(historyContent) {
  const { blocks } = splitChangelogBody(historyContent)
  return [CHANGELOG_HEADER, ...blocks].join('\n\n') + '\n'
}

/**
 * Post-condition of the generator (OPS85): every parsed entry must appear
 * in the generated aggregate, or the entry was silently lost — the role the
 * old committed-aggregate multiset played. Substring check is honest for
 * "no silent loss" (a vanishing block fails; see build-changelog.mjs).
 *
 * @param {{ path: string, content: string }[]} entries
 * @param {string} aggregateContent
 * @returns {string[]} - paths of entries missing from the aggregate
 */
export function missingAggregateEntries(entries, aggregateContent) {
  return entries
    .filter(({ content }) => !aggregateContent.includes(content.trimEnd()))
    .map(({ path }) => path)
}

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
 * Changelog policy for the committed diff (CI + pre-push guard).
 *
 * Since OPS85 the committed changelog record is per-file only:
 *  - files under docs/changelog/ must be additions only (entries are
 *    immutable once committed; a deletion or modification is a silent
 *    data-loss path);
 *  - docs/CHANGELOG-AGENTS-HISTORY.md is a frozen snapshot of the old
 *    aggregate — only its creation (status A) is allowed, so any later
 *    modification or deletion fails;
 *  - the regenerable docs/CHANGELOG-AGENTS.md must never appear in the
 *    diff; the one-time removal (status D) is allowed only in the same
 *    diff that creates the HISTORY snapshot (the OPS85 migration).
 *
 * Legitimate exceptions (D8-style restorations, HISTORY corrections) escape
 * via the documented `changelog-rewrite:` token in the PR body (see
 * AGENT-OPS). The old committed-aggregate multiset check died with OPS85:
 * the "no silent entry loss" guarantee now lives in the per-file
 * additions-only rule plus the generator post-condition in
 * scripts/build-changelog.mjs.
 *
 * @param {{ changelogDiff: { status: string, path: string }[],
 *           historyDiff: { status: string, path: string }[],
 *           aggregateDiff: { status: string, path: string }[] }} input
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function assertChangelogAppendOnly({ changelogDiff, historyDiff, aggregateDiff }) {
  const touchedEntries = changelogDiff.filter((change) => change.status !== 'A')
  if (touchedEntries.length > 0) {
    return {
      ok: false,
      message:
        `docs/changelog/ não é additions-only: ${touchedEntries
          .map((change) => `${change.status} ${change.path}`)
          .join(', ')}. Entradas são imutáveis; restaurações legítimas: use ` +
        '`changelog-rewrite: <motivo>` no body do PR (linha própria; definição em AGENT-OPS).',
    }
  }

  const touchedHistory = historyDiff.filter((change) => change.status !== 'A')
  if (touchedHistory.length > 0) {
    return {
      ok: false,
      message:
        `${CHANGELOG_HISTORY} é um snapshot congelado: ${touchedHistory
          .map((change) => `${change.status} ${change.path}`)
          .join(', ')} não é permitido. Correções legítimas: use ` +
        '`changelog-rewrite: <motivo>` no body do PR (linha própria; definição em AGENT-OPS).',
    }
  }

  const nonDeletions = aggregateDiff.filter((change) => change.status !== 'D')
  if (nonDeletions.length > 0) {
    return {
      ok: false,
      message:
        `${CHANGELOG_AGGREGATE} não deve ser commitado — é um artefato gitignored regenerado ` +
        `sob demanda (OPS85): ${nonDeletions
          .map((change) => `${change.status} ${change.path}`)
          .join(', ')}.`,
    }
  }

  const aggregateDeleted = aggregateDiff.some((change) => change.status === 'D')
  const historyCreated = historyDiff.some((change) => change.status === 'A')
  if (aggregateDeleted && !historyCreated) {
    return {
      ok: false,
      message:
        `${CHANGELOG_AGGREGATE} removido sem criar ${CHANGELOG_HISTORY} — a remoção do ` +
        'agregado commitado só é válida na entrega que congela o snapshot (OPS85). ' +
        'Exceções legítimas: use `changelog-rewrite: <motivo>` no body do PR (linha ' +
        'própria; definição em AGENT-OPS).',
    }
  }

  return { ok: true }
}
