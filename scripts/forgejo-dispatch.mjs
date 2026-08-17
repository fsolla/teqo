/**
 * Plain-Node CLI (no pnpm) — dispatch a Forgejo workflow via workflow_dispatch.
 * Used by CI jobs (requeue) and humans.
 *
 *   node scripts/forgejo-dispatch.mjs <workflow-file> <ref> [key=value …]
 */

import { createApi } from './lib/forgejo-api.mjs'

const [, , workflowFile, ref = 'main', ...inputPairs] = process.argv
if (!workflowFile) {
  console.error('Usage: node scripts/forgejo-dispatch.mjs <workflow-file> [ref] [key=value …]')
  process.exit(1)
}

const inputs = {}
for (const pair of inputPairs) {
  const eq = pair.indexOf('=')
  if (eq <= 0) continue
  inputs[pair.slice(0, eq)] = pair.slice(eq + 1)
}

const api = createApi({})
try {
  await api.workflowDispatch(workflowFile, { ref, inputs })
  console.log(
    `[forgejo-dispatch] ${workflowFile}@${ref} enviado${Object.keys(inputs).length > 0 ? ` (${Object.keys(inputs).join(', ')})` : ''}`,
  )
} catch (error) {
  console.error(`[forgejo-dispatch] falhou: ${error instanceof Error ? error.message : error}`)
  process.exit(1)
}
