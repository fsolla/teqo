/**
 * conflictMarkers — shared conflict-marker policy for docs diffs (OPS44).
 *
 * The regex started as the OPS41 guardrail inside
 * tests/unit/codebaseConventions.unit.spec.ts (repo-wide scan of tracked
 * files). OPS44 extracts it here so the unit spec and the CI docs guard
 * (scripts/check-docs-conflict-markers.mjs) share one source — don't twin.
 */

/**
 * A real git conflict was committed to AGENTS.md twice: the OPS33 commit
 * carried `<<<<<<< HEAD` plus a mangled `> > > > > > >` closer (the
 * `=======` was deleted in the same bad resolution), and OPS37 inherited
 * the state. The `(?:> ){7}` form is the exact corrupted closer that
 * shipped; a genuine 7-deep nested blockquote would need a deliberate
 * allowlist.
 */
export const CONFLICT_MARKER_RE = /^\s*<<<<<<<(?:\s|$)|^\s*>>>>>>>(?:\s|$)|^\s*(?:> ){7}/m

/**
 * @param {string} content - file content to scan
 * @returns {{ line: number, text: string }[]} - 1-based offending lines
 */
export function findConflictMarkerLines(content) {
  const offenders = []
  const lines = content.split('\n')
  for (const [index, line] of lines.entries()) {
    if (CONFLICT_MARKER_RE.test(line)) {
      offenders.push({ line: index + 1, text: line })
    }
  }
  return offenders
}

/**
 * @param {string[]} paths - repo-relative changed paths
 * @returns {string[]} - the markdown-ish paths (docs/, AGENTS.md, .agents/ …)
 *
 * The OPS41 incident file was AGENTS.md at the repo root, so the CI guard
 * must not be limited to docs/: any changed markdown/mdc can carry markers.
 */
export function markdownPathsOf(paths) {
  return paths.filter((path) => /\.(?:md|mdx|mdc)$/i.test(path))
}
