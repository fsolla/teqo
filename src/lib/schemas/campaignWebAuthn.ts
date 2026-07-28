import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/browser'
import { z } from 'zod'

import { CAMPAIGN_WEBAUTHN_DEVICE_LABEL_MAX_LENGTH } from '@/lib/campaignWebAuthn'
import { positiveRelationshipId } from '@/lib/schemas/primitives'

/**
 * Envelope checks only. The credential's cryptographic content is verified by
 * `@simplewebauthn/server` against the stored challenge, the relying party and
 * the enrolled public key, so re-describing every base64url field here would
 * duplicate that authority. This layer exists to reject a body that is not a
 * credential of the expected ceremony before it reaches the verifier.
 *
 * The final cast is the one place it happens: zod proves the envelope, and the
 * union members of `clientExtensionResults` / `authenticatorAttachment` are
 * browser-owned enums that only the verifier reads.
 */
const credentialEnvelope = <Credential>(
  response: z.ZodType<Record<string, unknown>>,
): z.ZodType<Credential, unknown> =>
  z
    .looseObject({
      id: z.string().min(1),
      rawId: z.string().min(1),
      type: z.literal('public-key'),
      clientExtensionResults: z.looseObject({}),
      response,
    })
    .transform((value) => value as unknown as Credential)

const registrationCredential = credentialEnvelope<RegistrationResponseJSON>(
  z.looseObject({
    clientDataJSON: z.string().min(1),
    attestationObject: z.string().min(1),
  }),
)

const authenticationCredential = credentialEnvelope<AuthenticationResponseJSON>(
  z.looseObject({
    clientDataJSON: z.string().min(1),
    authenticatorData: z.string().min(1),
    signature: z.string().min(1),
  }),
)

const campaignPasskeyDeviceLabel = z
  .string()
  .trim()
  .min(1, 'Dê um nome a este aparelho.')
  .max(CAMPAIGN_WEBAUTHN_DEVICE_LABEL_MAX_LENGTH)

export const campaignWebAuthnRegisterSchema = z.object({
  deviceLabel: campaignPasskeyDeviceLabel,
  credential: registrationCredential,
})

export const campaignWebAuthnLoginSchema = z.object({
  credential: authenticationCredential,
})

export const campaignPasskeyRemoveSchema = z.object({
  passkeyId: positiveRelationshipId,
})

export type CampaignPasskeyRemoveInput = z.infer<typeof campaignPasskeyRemoveSchema>
