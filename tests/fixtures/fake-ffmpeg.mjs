#!/usr/bin/env node
/**
 * C167 test double for ffmpeg: copies the `-i` input to the output path so the
 * cut pipeline can run without a real encoder (the developer machine has none).
 * `FAKE_FFMPEG_FAIL=1` makes it exit 1; `FAKE_FFMPEG_LOG=<path>` records argv.
 * The real binary is exercised by the `skipIf(!hasFfmpeg())` block (CI).
 */
import { copyFileSync, writeFileSync } from 'node:fs'
import { argv, env, exit } from 'node:process'

const args = argv.slice(2)

if (env.FAKE_FFMPEG_LOG) {
  writeFileSync(env.FAKE_FFMPEG_LOG, JSON.stringify(args))
}

if (env.FAKE_FFMPEG_FAIL === '1') {
  process.stderr.write('fake-ffmpeg: forced failure\n')
  exit(1)
}

const inputIndex = args.indexOf('-i')
const input = inputIndex >= 0 ? args[inputIndex + 1] : undefined
const output = args.at(-1)

if (!input || !output) {
  process.stderr.write('fake-ffmpeg: missing -i input or output path\n')
  exit(2)
}

copyFileSync(input, output)
