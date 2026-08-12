/**
 * The "discreto sob o nome" secondary line (C129): the same muted small text
 * under a name in every surface — people table, dobradinhas list and ficha.
 * The position is the visual label; an optional `srLabel` names the line for
 * screen readers (the muted/small styling does not exist in a linear read).
 */
export const CampaignNameSubline = ({
  value,
  srLabel,
}: {
  value: string | null | undefined
  srLabel?: string
}) =>
  value ? (
    <span className="truncate text-xs text-muted-foreground">
      {srLabel ? <span className="sr-only">{srLabel} </span> : null}
      {value}
    </span>
  ) : null
