/**
 * The shared provider defaults of the `deepseek-flash` call sites that return
 * short structured output (theme expansion, rerank, cut/piece metadata and
 * demand title). Thinking is disabled because the model spends the output
 * budget on reasoning tokens before the payload (measured: 93–354 per call) —
 * with the old small caps the JSON/text was truncated on a large share of real
 * calls and every caller degraded silently to its fallback. The cap is
 * generous for the same reason: payloads cost ~30–300 tokens.
 */
export const DEEPSEEK_FLASH_STRUCTURED_PROVIDER_OPTIONS = {
  deepseek: { thinking: { type: 'disabled' } },
} as const

export const DEEPSEEK_FLASH_STRUCTURED_MAX_OUTPUT_TOKENS = 1000
