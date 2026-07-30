#!/usr/bin/env node
/**
 * Portable write guard (repo hooks.json, preToolUse on Write/Edit).
 *
 * Denies agent writes to local env files (`.env`, `.env.local`, `.env.test`):
 * they carry DATABASE_URLs and secrets, and the parallel-ops contract says
 * agents never repoint databases (stage/prod URLs live only in CI secrets and
 * human-run scripts). Humans editing by hand are unaffected — this only gates
 * tool calls.
 *
 * Contract (same as the impeccable hook): never break a turn accidentally —
 * malformed input or internal errors allow the tool and exit 0.
 */

const DENY_PATTERN = /(^|\/)\.env(\.local|\.test|\.production)?$/

let input = ''
process.stdin.on('data', (chunk) => (input += chunk))
process.stdin.on('end', () => {
  try {
    const payload = JSON.parse(input)
    const filePath = payload?.tool_input?.file_path ?? payload?.tool_input?.path ?? ''
    if (typeof filePath === 'string' && DENY_PATTERN.test(filePath)) {
      process.stdout.write(
        JSON.stringify({
          decision: 'deny',
          reason:
            'Agentes não editam arquivos .env* (contrato agentic ops: nunca repontar DATABASE_URL; stage/prod só em secrets de CI e scripts humanos).',
        }),
      )
      process.exit(0)
    }
  } catch {
    // malformed input → allow
  }
  process.exit(0)
})
