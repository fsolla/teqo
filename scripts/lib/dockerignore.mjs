/**
 * dockerignore match — pure `.dockerignore` semantics (moby patternmatcher
 * subset) for the CI production-change gate (OPS65). No git, no fs, no deps.
 *
 * The gate classifies "production change" by asking: would this path enter the
 * docker build context? The `.dockerignore` is the source of truth for the
 * artifact (the Dockerfile does `COPY . .`), so a path is production when it
 * is NOT excluded by the ignore patterns.
 *
 * Implemented rules (moby semantics):
 *   - blank lines and `#` comments are ignored
 *   - `!` prefixes a negation (re-include); last match wins
 *   - trailing `/` is a directory pattern (the dir itself and its tree)
 *   - leading `/` anchors the pattern to the context root
 *   - a pattern with no other `/` matches the basename at ANY depth
 *   - any matched path also excludes everything under it (the builder prunes
 *     at the matched directory, so `docs` excludes `docs/x.md`)
 *   - `*` matches any run of non-separator chars, `?` a single one
 *   - `**` matches any number of directories (globstar)
 */

/** A compiled ignore rule: regex against the cleaned repo-relative path. */
export class DockerignoreRule {
  /**
   * @param {RegExp} regex - compiled matcher
   * @param {boolean} negate - `!` prefix: re-include when matched
   * @param {string} source - original pattern text (diagnostics)
   */
  constructor(regex, negate, source) {
    this.regex = regex
    this.negate = negate
    this.source = source
  }
}

/**
 * @param {string} pattern - one `.dockerignore` line (no trailing newline)
 * @returns {DockerignoreRule}
 */
export function compileDockerignoreRule(pattern) {
  const source = pattern
  let negate = false
  if (pattern.startsWith('!')) {
    negate = true
    pattern = pattern.slice(1)
  }
  if (pattern.endsWith('/')) pattern = pattern.slice(0, -1)
  const anchored = pattern.startsWith('/')
  if (anchored) pattern = pattern.slice(1)

  let body = ''
  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index]
    if (char === '*') {
      if (pattern[index + 1] === '*') {
        index += 1
        if (pattern[index + 1] === '/') {
          body += '(?:.*/)?'
          index += 1
        } else {
          body += '.*'
        }
      } else {
        body += '[^/]*'
      }
    } else if (char === '?') {
      body += '[^/]'
    } else if ('\\^$.|+()[]{}'.includes(char)) {
      body += `\\${char}`
    } else {
      body += char
    }
  }

  const anyDepth = !anchored && !pattern.includes('/') ? '(?:.*/)?' : ''
  const subtree = '(?:/.*)?'
  const regexSource = body.length > 0 ? `^${anyDepth}${body}${subtree}$` : '$^'
  return new DockerignoreRule(new RegExp(regexSource), negate, source)
}

/**
 * @param {string} text - full `.dockerignore` content
 * @returns {DockerignoreRule[]} rules in order (last match wins)
 */
export function parseDockerignore(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('#'))
    .map(compileDockerignoreRule)
}

/**
 * Last-match-wins exclusion test for one repo-relative path.
 *
 * @param {string} path - repo-relative, forward slashes (e.g. "src/app/x.ts")
 * @param {DockerignoreRule[]} rules - from parseDockerignore
 * @returns {boolean} true when the path is excluded from the build context
 */
export function isDockerignored(path, rules) {
  let ignored = false
  for (const rule of rules) {
    if (rule.regex.test(path)) ignored = !rule.negate
  }
  return ignored
}
