/**
 * The env var name the sync engine reads the service-account credential from
 * (`GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV` in `src/utilities/googleCalendarSync.ts`).
 * Not imported from there on purpose: that module is `server-only` and
 * `playwright.config.ts` loads this helper in plain Node.
 */
export const GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV_NAME = 'GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY'

/**
 * The fake service-account key for tests (C114/C122): a well-formed JSON that
 * `readGoogleServiceAccountCredentials` parses (so the view derives real
 * states) but whose private key is garbage — `importPKCS8` throws
 * `Invalid keyData` locally, BEFORE any fetch. That is the property that makes
 * the int/e2e states deterministic without touching the network.
 */
export const GOOGLE_CALENDAR_TEST_KEY = Buffer.from(
  JSON.stringify({
    client_email: 'teqo-sa@projeto.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----\n',
  }),
  'utf8',
).toString('base64')

/** Sets/restores the env key around a callback — restored even on failure. */
export const withGoogleCalendarTestCredential = async <T>(run: () => Promise<T>): Promise<T> => {
  const previous = process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV_NAME]
  process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV_NAME] = GOOGLE_CALENDAR_TEST_KEY
  try {
    return await run()
  } finally {
    if (previous === undefined) {
      delete process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV_NAME]
    } else {
      process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV_NAME] = previous
    }
  }
}
