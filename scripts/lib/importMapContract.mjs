/**
 * Contract shared by the importMap unit pin and the CI guard. The admin goes
 * blank in production when the importMap loses the S3 upload handler entry
 * (class OPS69/OPS72/OPS73 — the importMap regenerated without the S3_* envs).
 */
export const S3_UPLOAD_HANDLER_KEY = '@payloadcms/storage-s3/client#S3ClientUploadHandler'

export const S3_UPLOAD_HANDLER_IMPORT_PREFIX =
  'import { S3ClientUploadHandler as S3ClientUploadHandler_'

/**
 * Env keys that gate the s3Storage plugin (see src/utilities/mediaStorage.ts).
 * Kept in sync by the `importMapContract` unit pin.
 */
export const S3_STORAGE_ENV_KEYS = [
  'S3_BUCKET',
  'S3_ENDPOINT',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
]
