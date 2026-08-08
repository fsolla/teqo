import 'server-only'

import {
  optionalIntegerFormValue,
  requiredFormText,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import {
  MUNICIPALITY_UPDATE_POLARITY_REQUIRED_MESSAGE,
  parseMunicipalityUpdatePolarity,
  type MunicipalityUpdateCreateInput,
} from '@/lib/schemas/municipalityUpdate'

/** Checkbox pairs with hidden "false"; last value wins (same as leadership exclusive). */
const formBoolean = (formData: FormData, field: string): boolean => {
  const values = formData.getAll(field)
  if (values.length === 0) return false
  return values.at(-1) === 'true'
}

/**
 * Shared parse step for the two MunicipalityUpdate create surfaces (the
 * municipality detail form and the C89 feed page modal): FormData → the
 * `MunicipalityUpdateCreateInput` the server action consumes. Throws
 * `FormDataBoundaryError` for boundary-visible field problems, exactly like
 * the hand-rolled ladder in `updateFormActions.ts` used to.
 */
export const parseMunicipalityUpdateFormData = (
  formData: FormData,
): MunicipalityUpdateCreateInput => {
  const polarity = parseMunicipalityUpdatePolarity(requiredFormText(formData, 'polarity'))
  if (!polarity) {
    throw new Error(MUNICIPALITY_UPDATE_POLARITY_REQUIRED_MESSAGE)
  }

  return {
    municipality: requiredRelationshipFormValue(formData, 'municipalityId'),
    body: requiredFormText(formData, 'body'),
    polarity,
    urgent: formBoolean(formData, 'urgent'),
    activeVolunteers: optionalIntegerFormValue(formData, 'activeVolunteers'),
    newSupports: optionalIntegerFormValue(formData, 'newSupports'),
    adversarySignal: formBoolean(formData, 'adversarySignal'),
  }
}
