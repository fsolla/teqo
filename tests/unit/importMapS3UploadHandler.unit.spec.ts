import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  S3_UPLOAD_HANDLER_IMPORT_PREFIX,
  S3_UPLOAD_HANDLER_KEY,
} from '../../scripts/lib/importMapContract.mjs'

// The admin goes blank in production when this entry is missing: with the
// S3_* envs set, the media collection uses the s3Storage plugin and the admin
// config references this handler — getFromImportMap returns undefined, the
// Payload root never mounts, and the admin renders an empty page with zero
// console errors (class OPS69/OPS72/OPS73; orphaned again by 1c865bd8,
// 2026-08-23). Regenerating the importMap without the S3_* envs silently
// removes the entry — this pin fails the exact drift.

const importMapPath = path.resolve(__dirname, '../../src/app/(payload)/admin/importMap.js')

describe('importMap (admin)', () => {
  it('keeps the S3ClientUploadHandler entry required by the prod S3 storage', () => {
    const source = readFileSync(importMapPath, 'utf8')

    // Import + map entry, like the generator emits (+2 lines in the file).
    expect(source).toContain(S3_UPLOAD_HANDLER_IMPORT_PREFIX)
    expect(source).toContain(`${S3_UPLOAD_HANDLER_KEY}": S3ClientUploadHandler_`)
  })
})
