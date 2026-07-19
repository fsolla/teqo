import type { MigrateDownArgs, MigrateUpArgs } from '@payloadcms/db-postgres'

import {
  provisionOnda0ConsentAndPrivacyDb,
  removeOnda0ConsentAndPrivacyDb,
} from '@/utilities/onda0Provision'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await provisionOnda0ConsentAndPrivacyDb(db)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await removeOnda0ConsentAndPrivacyDb(db)
}
