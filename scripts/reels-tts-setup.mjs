/**
 * C197 — `pnpm reels:tts:setup`: prepares the dedicated venv of the TTS draft
 * provider (edge-tts). Idempotent: re-running upgrades into the same venv.
 */

import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { dieWithLabel } from './lib/cli.mjs'
import { setupEdgeTts } from './lib/reelTts.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const die = dieWithLabel('reels:tts:setup')

setupEdgeTts({ root: ROOT })
  .then((result) => {
    console.log(`[reels:tts:setup] edge-tts pronto: ${result.bin}`)
    console.log('[reels:tts:setup] rascunho narrado: pnpm reels:build <slug> --audio')
  })
  .catch((error) => {
    die(error instanceof Error ? error.message : String(error))
  })
