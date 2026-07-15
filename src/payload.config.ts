import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { pt } from 'payload/i18n/pt'
import { Consent } from './collections/Consent'
import { Contact } from './collections/Contact'
import { Media } from './collections/Media'
import { Petition } from './collections/Petition'
import { Signature } from './collections/Signature'
import { Subscription } from './collections/Subscription'
import { Users } from './collections/Users'
import { HomePage } from './globals/HomePage'
import { Metadata } from './globals/Metadata'
import { SiteSettings } from './globals/SiteSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    livePreview: {
      url: 'http://localhost:3000',
      globals: [SiteSettings.slug, HomePage.slug],
    },
  },
  collections: [Users, Media, Petition, Contact, Consent, Signature, Subscription],
  globals: [SiteSettings, HomePage, Metadata],
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || '',
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || '',
    },
    // Schema changes are applied via committed migrations (pnpm migrate:create /
    // pnpm migrate), never auto-pushed. `pnpm build` runs `payload migrate` before
    // building, so migrations apply to prod on every Vercel deploy.
    migrationDir: path.resolve(dirname, 'migrations'),
    push: false,
  }),
  sharp,
  plugins: [
    vercelBlobStorage({
      collections: {
        media: true,
      },
      token: process.env.BLOB_READ_WRITE_TOKEN,
    }),
  ],
  i18n: {
    fallbackLanguage: 'pt', // use 'pt' (not 'pt-BR') for Payload admin language code
    supportedLanguages: { pt },
  },
})
