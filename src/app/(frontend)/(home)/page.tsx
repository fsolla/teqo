import { CampaignContentSection } from '@/components/CampaignContentSection'
import { CampaignFlagsSection } from '@/components/CampaignFlagsSection'
import { CampaignFooter } from '@/components/CampaignFooter'
import { CampaignHero } from '@/components/CampaignHero'
import { CampaignPageHeader } from '@/components/CampaignPageHeader'
import { CampaignPhotoSection } from '@/components/CampaignPhotoSection'
import { CampaignStorySection } from '@/components/CampaignStorySection'
import { SelfieSearchHomeSection } from '@/components/fotos/SelfieSearchHomeSection'
import { ShareLinkHomeSection } from '@/components/shareLink/ShareLinkHomeSection'
import { SHARE_LINK_HOME_SECTION_SLUG } from '@/lib/shareLinkHomeSection'
import { getApprovedArchivePhotoItems } from '@/utilities/archivePhotos/archivePhotoReads'
import { getCachedGlobal } from '@/utilities/globalReads'
import { loadShareLinkHomeSection } from '@/utilities/shareLinkReads'

/**
 * S47 — the post-election home (design artifact
 * `site-pos-eleicao-agradecimento-ui-design.html`, scenes 01/02): the thank-you
 * hero, the editorial board, the trajectory, the mandate flags, the photos and
 * the institutional footer. The campaign sections (proof, problem, cards,
 * jingles/radio, Central de Conteúdos and the newsletter capture) are gone from
 * the composition; the Plenária (2nd round, until 25/10) and the selfie search
 * stay as conditional, fail-closed sections.
 */
export default async function HomePage() {
  // S44 — one published share link under the `shareLinks` tag; unpublished or
  // past the event window, the Plenária is absent from the HTML (fail-closed).
  // C233/C243 — one approved-photo read feeds the home gallery and the selfie
  // discovery gate (album published + flag + at least one approved photo).
  const [album, photos, plenaria] = await Promise.all([
    getCachedGlobal('photoAlbum')(),
    getApprovedArchivePhotoItems(),
    loadShareLinkHomeSection(SHARE_LINK_HOME_SECTION_SLUG),
  ])
  const showSelfieSearch =
    album.published !== false && album.selfieSearchEnabled === true && photos.length > 0

  return (
    <>
      <CampaignPageHeader variant="home" />

      <main className="w-full bg-(--campaign-cream) text-(--campaign-ink)">
        <CampaignHero />

        {plenaria ? (
          <ShareLinkHomeSection view={plenaria.view} initialLive={plenaria.initialLive} />
        ) : null}

        <CampaignContentSection />
        <CampaignStorySection />
        <CampaignFlagsSection />
        <CampaignPhotoSection items={photos} />
        {showSelfieSearch ? <SelfieSearchHomeSection /> : null}
      </main>

      <CampaignFooter />
    </>
  )
}
