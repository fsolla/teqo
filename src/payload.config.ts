import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig, type Access, type CollectionConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { resendAdapter } from '@payloadcms/email-resend'
import { importExportPlugin } from '@payloadcms/plugin-import-export'
import { vercelBlobStorage } from '@payloadcms/storage-vercel-blob'
import { pt } from 'payload/i18n/pt'
import { Activity } from './collections/Activity'
import { AllocationDecision } from './collections/AllocationDecision'
import { CalendarFeed } from './collections/CalendarFeed'
import { CampaignDemand } from './collections/CampaignDemand'
import { CampaignInvite } from './collections/CampaignInvite'
import { CampaignUser } from './collections/CampaignUser'
import { CampaignVoteSummarySnapshot } from './collections/CampaignVoteSummarySnapshot'
import { CampaignWebAuthnCredential } from './collections/CampaignWebAuthnCredential'
import { Consent } from './collections/Consent'
import { Contact } from './collections/Contact'
import { ElectionCandidate } from './collections/ElectionCandidate'
import { ElectionCandidateVote } from './collections/ElectionCandidateVote'
import { ElectionTally } from './collections/ElectionTally'
import { GoogleCalendarSync } from './collections/GoogleCalendarSync'
import { Leadership } from './collections/Leadership'
import { Media } from './collections/Media'
import { Municipality } from './collections/Municipality'
import { MunicipalityUpdate } from './collections/MunicipalityUpdate'
import { Notification } from './collections/Notification'
import { Organization } from './collections/Organization'
import { Petition } from './collections/Petition'
import { Post } from './collections/Post'
import { PushSubscription } from './collections/PushSubscription'
import { Signature } from './collections/Signature'
import { StateDeputy } from './collections/StateDeputy'
import { Subscription } from './collections/Subscription'
import { Supporter } from './collections/Supporter'
import { SupporterImportBatch } from './collections/SupporterImportBatch'
import { Tag } from './collections/Tag'
import { Users } from './collections/Users'
import { VotePledge } from './collections/VotePledge'
import { CampaignGoals } from './globals/CampaignGoals'
import { HomePage } from './globals/HomePage'
import { Metadata } from './globals/Metadata'
import { PrivacyPolicy } from './globals/PrivacyPolicy'
import { SiteSettings } from './globals/SiteSettings'
import { isPayloadAdmin } from './utilities/campaignAccess'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const campaignEmailFromAddress =
  process.env.CAMPAIGN_EMAIL_FROM?.trim() || 'campanha@jorgesolla.com.br'
const campaignEmailFromName = process.env.CAMPAIGN_EMAIL_FROM_NAME?.trim() || 'Campanha Jorge Solla'

const importExportAdminOnly: Access = ({ req }) => isPayloadAdmin(req.user)

const withImportExportAdminAccess = ({ collection }: { collection: CollectionConfig }) => ({
  ...collection,
  access: {
    ...collection.access,
    read: importExportAdminOnly,
    create: importExportAdminOnly,
    update: importExportAdminOnly,
    delete: importExportAdminOnly,
  },
})

const adminCsvExportCollection = (slug: 'signature' | 'contact') => ({
  slug,
  import: false as const,
  export: {
    format: 'csv' as const,
    disableJobsQueue: true,
    disableSave: true,
  },
})

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
    CampaignWebAuthnCredential,
    Notification,
    PushSubscription,
    CampaignInvite,
    CampaignVoteSummarySnapshot,
    Municipality,
    Leadership,
    Organization,
    StateDeputy,
    VotePledge,
    AllocationDecision,
    CampaignDemand,
    Supporter,
    SupporterImportBatch,
    MunicipalityUpdate,
    Activity,
    CalendarFeed,
    GoogleCalendarSync,
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
  globals: [SiteSettings, HomePage, Metadata, PrivacyPolicy, CampaignGoals],
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
    importExportPlugin({
      collections: [adminCsvExportCollection('signature'), adminCsvExportCollection('contact')],
      overrideExportCollection: withImportExportAdminAccess,
      overrideImportCollection: withImportExportAdminAccess,
    }),
  ],
  i18n: {
    fallbackLanguage: 'pt', // use 'pt' (not 'pt-BR') for Payload admin language code
    supportedLanguages: { pt },
  },
})
