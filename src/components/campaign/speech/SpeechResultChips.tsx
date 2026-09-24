import { Badge } from '@/components/ui/Badge'

/**
 * One chip group: `max` bounds how many of its items the card shows; the hidden
 * ones are summed with the other groups' into a single `+N`. The muted group is
 * the keyword vocabulary only the Câmara card has.
 */
export type SpeechChipGroup = {
  key: string
  items: readonly { value: string; label: string }[] | readonly string[]
  max: number
  variant?: 'secondary' | 'outline'
  className?: string
}

/**
 * C216-FOLLOWUP-DRY — the chips line shared by the speech cards (C154/C216):
 * the leading few per group plus one `+N` badge summing every hidden item. The
 * container and the empty guard stay with the caller.
 */
export const SpeechResultChips = ({ groups }: { groups: readonly SpeechChipGroup[] }) => {
  const hidden = groups.reduce(
    (total, group) => total + Math.max(0, group.items.length - group.max),
    0,
  )

  return (
    <>
      {groups.flatMap((group) =>
        group.items.slice(0, group.max).map((item) => {
          const chip = typeof item === 'string' ? { value: item, label: item } : item
          return (
            <Badge
              key={`${group.key}:${chip.value}`}
              variant={group.variant ?? 'secondary'}
              className={group.className ?? 'font-normal'}
            >
              {chip.label}
            </Badge>
          )
        }),
      )}
      {hidden > 0 ? (
        <Badge variant="outline" className="font-normal text-muted-foreground">
          +{hidden}
        </Badge>
      ) : null}
    </>
  )
}
