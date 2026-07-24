import type { CollectionSlug, RequiredDataFromCollectionSlug } from 'payload'

/**
 * Types zod-validated create input as a collection's full create data when the
 * remaining required fields (canonical slug, authorship, workflow status) are
 * filled by the collection's own beforeValidate/beforeChange hooks.
 *
 * Unlike an `as never` cast, property-level type checking is preserved for
 * every field the caller does provide — only completeness is waived.
 */
export const hookFilledCreateData = <Slug extends CollectionSlug>(
  data: Partial<RequiredDataFromCollectionSlug<Slug>>,
): RequiredDataFromCollectionSlug<Slug> => data as RequiredDataFromCollectionSlug<Slug>
