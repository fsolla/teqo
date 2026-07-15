import * as migration_20260715_163458_initial from './20260715_163458_initial'
import * as migration_20260715_163500_consent_text_to_jsonb from './20260715_163500_consent_text_to_jsonb'

export const migrations = [
  {
    up: migration_20260715_163458_initial.up,
    down: migration_20260715_163458_initial.down,
    name: '20260715_163458_initial',
  },
  {
    up: migration_20260715_163500_consent_text_to_jsonb.up,
    down: migration_20260715_163500_consent_text_to_jsonb.down,
    name: '20260715_163500_consent_text_to_jsonb',
  },
]
