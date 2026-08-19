import { CampaignNewsletterCapture } from '@/components/CampaignNewsletterForm'

/**
 * S9 — "novidades" capture section on the campaign home, positioned right
 * above the footer (decision 2026-08-19): visitor leaves name + WhatsApp to
 * follow the campaign, choosing the engagement level. The hero CTA anchors
 * here (`#novidades`, smooth scroll on the campaign-site container).
 *
 * S10 — passes the site-level Meta pixel to the form so a successful capture
 * fires exactly one `Lead` (the seam lives in the client form).
 */
export const CampaignNewsletterSection = ({ pixelId }: { pixelId: string | null }) => (
  <section
    id="novidades"
    aria-labelledby="novidades-title"
    data-home-section="newsletter"
    className="scroll-mt-4 border-y border-(--campaign-line) bg-(--campaign-band)"
  >
    <div className="mx-auto w-full max-w-[1160px] px-5 py-12 sm:px-8 lg:px-10 lg:py-16">
      <div className="mx-auto max-w-2xl text-center">
        <p className="campaign-section-eyebrow m-0 font-black tracking-[0.1em] text-(--pt-red) uppercase">
          Apoie e acompanhe
        </p>
        <h2
          id="novidades-title"
          className="campaign-section-title m-0 mt-1 border-0 p-0 font-black tracking-[-0.02em] text-balance"
        >
          Receba as novidades da campanha
        </h2>
        <p className="campaign-section-copy m-0 mt-1 text-(--campaign-muted)">
          Deixe nome e WhatsApp para acompanhar a campanha de perto — e escolha como quer receber as
          novidades: fazendo parte do time ou com comunicações esporádicas.
        </p>
      </div>
      <div className="mt-8">
        <CampaignNewsletterCapture pixelId={pixelId ?? undefined} />
      </div>
    </div>
  </section>
)
