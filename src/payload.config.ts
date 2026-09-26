import { postgresAdapter } from '@payloadcms/db-postgres'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import path from 'path'
import { buildConfig, type Access, type CollectionConfig } from 'payload'
import sharp from 'sharp'
import { fileURLToPath } from 'url'

import { resendAdapter } from '@payloadcms/email-resend'
import { importExportPlugin } from '@payloadcms/plugin-import-export'
import { s3Storage } from '@payloadcms/storage-s3'
import { pt } from 'payload/i18n/pt'
import { Activity } from './collections/Activity'
import { AllocationDecision } from './collections/AllocationDecision'
import { ArchivePhoto } from './collections/ArchivePhoto'
import { CalendarFeed } from './collections/CalendarFeed'
import { CampaignDemand } from './collections/CampaignDemand'
import { CampaignInvite } from './collections/CampaignInvite'
import { CampaignUser } from './collections/CampaignUser'
import { CampaignVoteSummarySnapshot } from './collections/CampaignVoteSummarySnapshot'
import { CampaignWebAuthnCredential } from './collections/CampaignWebAuthnCredential'
import { Consent } from './collections/Consent'
import { Contact } from './collections/Contact'
import { ContentEvent } from './collections/ContentEvent'
import { ContentMedia } from './collections/ContentMedia'
import { ContentPiece } from './collections/ContentPiece'
import { ElectionCandidate } from './collections/ElectionCandidate'
import { ElectionCandidateVote } from './collections/ElectionCandidateVote'
import { ElectionTally } from './collections/ElectionTally'
import { GoogleCalendarSync } from './collections/GoogleCalendarSync'
import { InternetSpeechMedia } from './collections/InternetSpeechMedia'
import { Jingle } from './collections/Jingle'
import { Leadership } from './collections/Leadership'
import { Media } from './collections/Media'
import { Municipality } from './collections/Municipality'
import { MunicipalityUpdate } from './collections/MunicipalityUpdate'
import { Notification } from './collections/Notification'
import { Organization } from './collections/Organization'
import { Petition } from './collections/Petition'
import { Post } from './collections/Post'
import { PushSubscription } from './collections/PushSubscription'
import { Recording } from './collections/Recording'
import { RecordingMedia } from './collections/RecordingMedia'
import { RecordingSegment } from './collections/RecordingSegment'
import { Reel } from './collections/Reel'
import { ReelMedia } from './collections/ReelMedia'
import { ShareLink } from './collections/ShareLink'
import { Signature } from './collections/Signature'
import { Speech } from './collections/Speech'
import { SpeechCut } from './collections/SpeechCut'
import { SpeechSegment } from './collections/SpeechSegment'
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
import { SocialFeedSettings } from './globals/SocialFeedSettings'
import { ARCHIVE_PHOTO_SLUG } from './lib/archivePhoto'
import { isPayloadAdmin } from './utilities/campaignAccess'
import { resolveS3StorageEnv } from './utilities/mediaStorage'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

const mediaStorage = resolveS3StorageEnv(process.env)

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
    Speech,
    SpeechSegment,
    SpeechCut,
    InternetSpeechMedia,
    Reel,
    ReelMedia,
    ContentPiece,
    ContentMedia,
    ArchivePhoto,
    ContentEvent,
    Recording,
    RecordingMedia,
    RecordingSegment,
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
    ShareLink,
    Jingle,
  ],
  globals: [SiteSettings, HomePage, Metadata, PrivacyPolicy, CampaignGoals, SocialFeedSettings],
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
    // Media storage (OPS52): Garage S3 when the S3_* envs are set, local disk
    // otherwise; a partial S3 config throws at boot (see mediaStorage.ts). The
    // bucket stays private — Payload proxies files through /media/file.
    ...(mediaStorage.enabled
      ? [
          s3Storage({
            collections: {
              media: true,
              // C193 — private reel artifacts; without this entry they would
              // fall back to the container's ephemeral disk in production.
              reelMedia: true,
              // C199 — private recording files; same failure mode if omitted.
              recordingMedia: true,
              // C211 — private content-piece files; same failure mode if omitted.
              contentMedia: true,
              // C215 — private mirrored web-speech files; same failure mode if omitted.
              internetSpeechMedia: true,
              // C231 — private Flickr photo-archive originals; same failure mode if omitted.
              [ARCHIVE_PHOTO_SLUG]: true,
            },
            bucket: mediaStorage.bucket,
            config: {
              credentials: {
                accessKeyId: mediaStorage.accessKeyId,
                secretAccessKey: mediaStorage.secretAccessKey,
              },
              region: mediaStorage.region,
              endpoint: mediaStorage.endpoint,
              forcePathStyle: true,
            },
          }),
        ]
      : []),
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
