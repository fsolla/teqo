/** Default session: one field workday without persisting login across days. */
export const CAMPAIGN_SESSION_TTL_SHORT = 8 * 60 * 60

/** Explicit "remember me" session: a fortnight on the user's own device. */
export const CAMPAIGN_SESSION_TTL_LONG = 14 * 24 * 60 * 60
