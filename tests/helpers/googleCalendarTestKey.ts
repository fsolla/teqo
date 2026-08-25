import { generateKeyPairSync } from 'node:crypto'

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

/**
 * C114-LOCK: valid key for the hook lock-window int test — the invalid
 * `GOOGLE_CALENDAR_TEST_KEY` throws at `importPKCS8` before any fetch, so a
 * slow-network assertion would never reach the `AbortSignal` path. This twin
 * uses a real RSA PEM so the `fetch` (stubbed to sleep) is actually hit.
 */
const generateValidGoogleTestKey = (): string => {
  const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const pem = privateKey.export({ format: 'pem', type: 'pkcs8' }) as string
  return Buffer.from(
    JSON.stringify({
      client_email: 'teqo-sa@projeto.iam.gserviceaccount.com',
      private_key: pem,
    }),
    'utf8',
  ).toString('base64')
}

export const withValidGoogleCalendarCredential = async <T>(run: () => Promise<T>): Promise<T> => {
  const previous = process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV_NAME]
  process.env[GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY_ENV_NAME] = generateValidGoogleTestKey()
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

/**
 * Stub `fetch` that sleeps `sleepMs` but respects the `AbortSignal` so a hook
 * timeout (5s) aborts it before the per-hop 15s budget — used to prove the
 * hook does not hold the row lock for the full network budget.
 */
export const createSlowGoogleFetch = (sleepMs: number): typeof fetch =>
  (async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const signal = init?.signal as AbortSignal | undefined
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted due to timeout', 'AbortError')
    }

    await new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        clearTimeout(timer)
        reject(new DOMException('The operation was aborted due to timeout', 'AbortError'))
      }
      signal?.addEventListener('abort', onAbort, { once: true })
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort)
        resolve()
      }, sleepMs)
    })

    return {
      ok: true,
      json: async () => ({ access_token: 'fake', expires_in: 3600 }),
    } as unknown as Response
  }) as unknown as typeof fetch
