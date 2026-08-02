import type { Metadata } from 'next'

import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import {
  CAMPAIGN_CONCEPT_CATEGORIES,
  campaignConceptsByCategory,
  type CampaignIntelligenceConcept,
} from '@/lib/campaignIntelligenceConcepts'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'

export const metadata: Metadata = campaignPageMetadataFromCatalog('conceitos')

/**
 * One documented number: what it measures, how it is calculated, why it
 * matters, and where it shows up. Flat sections (no cards) — this is a reading
 * surface, and the `article:target` tint is what orients a reader who arrived
 * from a "Saiba mais" link deep in the page instead of from the top.
 */
const ConceptSection = ({ concept }: { concept: CampaignIntelligenceConcept }) => (
  <article
    id={concept.id}
    // -mx-3 px-3: the target tint bleeds past the text column while the copy
    // stays aligned with the rest of the page.
    className="-mx-3 scroll-mt-6 rounded-lg px-3 py-5 target:bg-muted/50"
  >
    <h3 className="text-base font-semibold tracking-tight">{concept.title}</h3>
    <p className="mt-1">{concept.oneLiner}</p>

    <dl className="mt-3 rounded-md bg-muted/60 p-3">
      <dt className="text-xs font-medium text-muted-foreground">Como é calculado</dt>
      <dd className="mt-1 font-mono text-xs leading-relaxed">{concept.formula}</dd>
      {concept.example ? (
        <>
          <dt className="mt-3 text-xs font-medium text-muted-foreground">Exemplo</dt>
          <dd className="mt-1 text-xs leading-relaxed">{concept.example}</dd>
        </>
      ) : null}
    </dl>

    {/* The substance of the page, so it stays at full ink — muted is for the meta line only. */}
    <p className="mt-3">{concept.whyItMatters}</p>
    <p className="mt-2 text-xs text-muted-foreground">
      <span className="font-medium">Onde aparece:</span> {concept.whereItAppears}
    </p>
  </article>
)

/**
 * E18 — reference page for the intelligence numbers the product derives, linked
 * from the tooltips that expose them (E8's "Conta da cadeira" today; each later
 * slice of the program appends its own concepts to
 * `campaignIntelligenceConcepts`).
 *
 * Staff-only: every documented number describes a staff-only field (estimates,
 * goals, field ceiling) that a `leader` never sees — M4's dual vocabulary.
 */
export default async function CampaignConceptsPage() {
  await requireCampaignPageActor({ gate: 'staff' })

  return (
    <CampaignPageShell>
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:items-start lg:gap-10">
        {/*
          Desktop-only index: on a phone it would push all seven sections below
          the fold to duplicate what scrolling already gives (readers usually
          arrive here on an anchor from a tooltip, not from the top).
        */}
        <nav
          aria-label="Conceitos nesta página"
          className="hidden lg:sticky lg:top-0 lg:col-start-2 lg:row-start-1 lg:block"
        >
          <p className="text-sm font-medium">Nesta página</p>
          <div className="mt-3 flex flex-col gap-4">
            {CAMPAIGN_CONCEPT_CATEGORIES.map((category) => (
              <div key={category.id}>
                <p className="text-xs text-muted-foreground">{category.label}</p>
                {/* The public-site base `ul` is a bulleted, indented article list. */}
                <ul className="mt-1 mb-0 ml-0 flex list-none flex-col pl-0 [&>li]:mt-0">
                  {campaignConceptsByCategory(category.id).map((concept) => (
                    <li key={concept.id}>
                      <a
                        href={`#${concept.id}`}
                        className="block py-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        {concept.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="flex max-w-prose flex-col gap-8 lg:col-start-1 lg:row-start-1">
          {CAMPAIGN_CONCEPT_CATEGORIES.map((category) => (
            <section key={category.id} aria-labelledby={`concept-category-${category.id}`}>
              <h2
                id={`concept-category-${category.id}`}
                className="text-lg font-semibold tracking-tight"
              >
                {category.label}
              </h2>
              <div className="[&>article+article]:border-t">
                {campaignConceptsByCategory(category.id).map((concept) => (
                  <ConceptSection key={concept.id} concept={concept} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </CampaignPageShell>
  )
}
