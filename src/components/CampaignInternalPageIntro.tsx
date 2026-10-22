/**
 * S47 — the compact cream intro shared by the internal public pages
 * (`/artigos`, `/fotos`, `/fotos/encontre`): eyebrow + h1 with the approved
 * scene-05 geometry (full-width bar, 40px gutter at 1280). The page body stays
 * its own owner; only the title band is shared.
 */
export const CampaignInternalPageIntro = ({
  eyebrow,
  title,
}: {
  eyebrow: string
  title: string
}) => (
  <div className="border-b border-(--campaign-line) bg-(--campaign-cream)">
    <div className="mx-auto w-full max-w-[1280px] px-5 py-10 sm:px-10 sm:py-12">
      <p className="m-0 font-[family-name:var(--font-exo2)] text-sm font-extrabold text-(--pt-red)">
        {eyebrow}
      </p>
      <h1 className="mt-2 border-0 p-0 text-left font-[family-name:var(--font-exo2)] text-[34px] font-black tracking-[-0.04em] lg:text-4xl">
        {title}
      </h1>
    </div>
  </div>
)
