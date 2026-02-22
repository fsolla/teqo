import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

import { Users } from './collections/Users'
import { Media } from './collections/Media'
import { SiteSettings } from './globals/SiteSettings'
import { pt } from 'payload/i18n/pt'
import { HomePage } from './globals/HomePage'
import { Metadata } from './globals/Metadata'
import { Petition } from './collections/Petition'
import { Contact } from './collections/Contact'
import { Consent } from './collections/Consent'
import { Signature } from './collections/Signature'

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
  collections: [Users, Media, Petition, Contact, Consent, Signature],
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
  }),
  sharp,
  plugins: [],
  i18n: {
    fallbackLanguage: 'pt', // use 'pt' (not 'pt-BR') for Payload admin language code
    supportedLanguages: { pt },
  },
})
