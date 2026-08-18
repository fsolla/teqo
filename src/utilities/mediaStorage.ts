/**
 * Resolves the media storage configuration from the S3_* environment
 * variables (Garage S3-compatible endpoint).
 *
 * Fail-closed contract (OPS52):
 * - No S3_* var set  -> { enabled: false }  (dev/test use Payload's local storage)
 * - Partially set    -> throws with the exact list of missing vars (never boots
 *                       against the wrong endpoint/bucket, never AWS defaults)
 * - All set          -> { enabled: true, ... } for the s3Storage plugin
 *
 * S3_REGION is optional: the Garage server (garage.toml) fixes `s3_region =
 * "garage"`, which is the only accepted value for signature validation.
 *
 * Public URLs are NOT generated: the bucket stays private and Payload proxies
 * the files through its /media/file route (the plugin's staticHandler streams
 * the object from Garage), so `media.url` keeps the relative
 * /media/file/<filename> contract unchanged.
 */
export const S3_STORAGE_ENV_KEYS = [
  'S3_BUCKET',
  'S3_ENDPOINT',
  'S3_ACCESS_KEY_ID',
  'S3_SECRET_ACCESS_KEY',
] as const

const S3_REGION_DEFAULT = 'garage'

export type S3StorageEnv =
  | { enabled: false }
  | {
      enabled: true
      bucket: string
      endpoint: string
      region: string
      accessKeyId: string
      secretAccessKey: string
    }

export function resolveS3StorageEnv(env: Record<string, string | undefined>): S3StorageEnv {
  const value = (key: string) => env[key]?.trim() || ''

  const present = S3_STORAGE_ENV_KEYS.filter((key) => value(key) !== '')
  if (present.length === 0) {
    return { enabled: false }
  }
  if (present.length < S3_STORAGE_ENV_KEYS.length) {
    const missing = S3_STORAGE_ENV_KEYS.filter((key) => !present.includes(key))
    throw new Error(
      `Media storage S3 configurado parcialmente: faltam ${missing.join(
        ', ',
      )}. Configure todas as envs S3_* (bucket, endpoint, credenciais) ou nenhuma (storage local).`,
    )
  }

  return {
    enabled: true,
    bucket: value('S3_BUCKET'),
    endpoint: value('S3_ENDPOINT'),
    region: value('S3_REGION') || S3_REGION_DEFAULT,
    accessKeyId: value('S3_ACCESS_KEY_ID'),
    secretAccessKey: value('S3_SECRET_ACCESS_KEY'),
  }
}
