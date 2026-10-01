import { YOUTUBE_VIDEO_ID_PATTERN } from '@/lib/shareLink'

/**
 * Validation for `socialFeedSettings.excludedItems[].itemId` (the campaign home
 * content board's manual exclusion list). The field is an array row: Payload
 * passes the row's own siblings through `siblingData`, NOT the document, so the
 * validate must read the platform from `siblingData` (the previous
 * `validate` read `data.platform`, which is the whole document and therefore
 * always `undefined` — dead code that never validated anything in production).
 * The YouTube id contract itself lives in `lib/shareLink` (single owner).
 */
export const validateExcludedItemId = (
  value: string | null | undefined,
  siblingData?: { platform?: string },
): true | string => {
  if (siblingData?.platform === 'youtube' && value && !YOUTUBE_VIDEO_ID_PATTERN.test(value)) {
    return 'Informe o ID do vídeo (11 caracteres)'
  }
  return true
}
