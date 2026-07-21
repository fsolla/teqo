const voteFormatter = new Intl.NumberFormat('pt-BR')

export const StaffPlazaVotesDisplay = ({
  expectedVotes,
  leadershipEffectiveTotal,
  valueClassName = 'text-lg font-medium tabular-nums',
  sublineClassName = 'text-xs text-muted-foreground',
}: {
  expectedVotes: number | null
  leadershipEffectiveTotal: number
  valueClassName?: string
  sublineClassName?: string
}) => (
  <>
    <span className={valueClassName}>
      {expectedVotes == null ? '—' : voteFormatter.format(expectedVotes)}
    </span>
    {leadershipEffectiveTotal > 0 ? (
      <span className={`mt-1 block ${sublineClassName}`}>
        Nas lideranças: {voteFormatter.format(leadershipEffectiveTotal)}
      </span>
    ) : null}
  </>
)
