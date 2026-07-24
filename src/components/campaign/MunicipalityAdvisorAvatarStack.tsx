import { Avatar, AvatarFallback } from '@/components/ui/Avatar'

export const campaignUserInitials = (name: string): string =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

export type MunicipalityAdvisorAvatarEntry = {
  id: number
  name: string
}

export const MunicipalityAdvisorAvatarStack = ({
  advisors,
  maxVisible = 3,
}: {
  advisors: MunicipalityAdvisorAvatarEntry[]
  maxVisible?: number
}) => {
  if (!advisors.length) return <span className="text-muted-foreground">Sem assessor</span>

  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-2">
        {advisors.slice(0, maxVisible).map((advisor) => (
          <Avatar key={advisor.id} className="size-8 border-2 border-background">
            <AvatarFallback>{campaignUserInitials(advisor.name)}</AvatarFallback>
          </Avatar>
        ))}
      </div>
      <span className="sr-only">{advisors.map((advisor) => advisor.name).join(', ')}</span>
    </div>
  )
}
