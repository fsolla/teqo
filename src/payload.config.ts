import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { resendAdapter } from '@payloadcms/email-resend'
import { pt } from 'payload/i18n/pt'
import { ActionPlan } from './collections/ActionPlan'
import { CampaignInvite } from './collections/CampaignInvite'
import { CampaignUser } from './collections/CampaignUser'
import { Consent } from './collections/Consent'
import { Contact } from './collections/Contact'
import { ElectionCandidate } from './collections/ElectionCandidate'
import { ElectionCandidateVote } from './collections/ElectionCandidateVote'
import { ElectionTally } from './collections/ElectionTally'
import { ElectoralNucleus } from './collections/ElectoralNucleus'
import { Leadership } from './collections/Leadership'
import { Media } from './collections/Media'
import { NucleusUpdate } from './collections/NucleusUpdate'
import { Petition } from './collections/Petition'
import { Post } from './collections/Post'
import { Signature } from './collections/Signature'
import { Subscription } from './collections/Subscription'
import { Supporter } from './collections/Supporter'
import { SupporterImportBatch } from './collections/SupporterImportBatch'
import { Tag } from './collections/Tag'
import { Users } from './collections/Users'
import { HomePage } from './globals/HomePage'
import { Metadata } from './globals/Metadata'
import { PrivacyPolicy } from './globals/PrivacyPolicy'
import { SiteSettings } from './globals/SiteSettings'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const campaignEmailFromAddress =
  process.env.CAMPAIGN_EMAIL_FROM?.trim() || 'campanha@jorgesolla.com.br'
const campaignEmailFromName =
  process.env.CAMPAIGN_EMAIL_FROM_NAME?.trim() || 'Campanha Jorge Solla'

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
  collections: [
    Users,
    CampaignUser,
    CampaignInvite,
    ElectoralNucleus,
    Leadership,
    Supporter,
    SupporterImportBatch,
    NucleusUpdate,
    ActionPlan,
    ElectionTally,
    ElectionCandidateVote,
    ElectionCandidate,
    Media,
    Petition,
    Contact,
    Consent,
    Signature,
    Subscription,
    Post,
    Tag,
  ],
  globals: [SiteSettings, HomePage, Metadata, PrivacyPolicy],
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
  email: resendAdapter({
    defaultFromAddress: campaignEmailFromAddress,
    defaultFromName: campaignEmailFromName,
    apiKey: process.env.RESEND_API_KEY || '',
  }),
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
