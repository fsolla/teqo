#!/usr/bin/env node
/**
 * C167/C199 test double for ffmpeg: copies the `-i` input to the output path so
 * the cut/recording pipelines can run without a real encoder (the developer
 * machine has none). A `%0Nd` output pattern (C199's `-f segment`) produces
 * numbered copies instead of one literal file, mirroring what the segmented
 * command writes. `FAKE_FFMPEG_FAIL=1` makes it exit 1; `FAKE_FFMPEG_LOG=<path>`
 * records argv. The real binary is exercised by the `skipIf(!hasFfmpeg())`
 * block (CI).
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

const segmentPattern = /%0?(\d+)d/.exec(output)
if (segmentPattern) {
  const width = Number(segmentPattern[1])
  const count = Number(env.FAKE_FFMPEG_SEGMENTS ?? '2')
  for (let index = 0; index < count; index += 1) {
    const name = output.replace(segmentPattern[0], String(index).padStart(width, '0'))
    copyFileSync(input, name)
  }
  exit(0)
}

copyFileSync(input, output)
