import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar'
import { campaignUserInitials } from '@/utilities/campaignUserProfile'
import { cn } from '@/lib/utils'

type CampaignUserAvatarProps = {
  name: string
  avatarUrl?: string | null
  size?: 'default' | 'sm' | 'lg'
  className?: string
}

export const CampaignUserAvatar = ({
  name,
  avatarUrl,
  size = 'default',
  className,
}: CampaignUserAvatarProps) => (
  <Avatar size={size} className={cn(className)}>
    {avatarUrl ? <AvatarImage src={avatarUrl} alt={name} /> : null}
    <AvatarFallback aria-hidden="true">{campaignUserInitials(name)}</AvatarFallback>
  </Avatar>
)
