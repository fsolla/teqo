type CampaignFlagCardItem = {
  id: string
  title: string
  body: string
}

type CampaignFlagCardProps = {
  item: CampaignFlagCardItem
  size?: 'compact' | 'spacious'
}

export const CampaignFlagCard = ({ item, size = 'compact' }: CampaignFlagCardProps) => {
  const padding = size === 'spacious' ? 'p-4' : 'px-3.5 py-2.5'
  return (
    <article
      className={`h-full rounded-[10px] bg-(--campaign-surface) ${padding} font-[family-name:var(--font-arimo)] text-black`}
    >
      <h3 className="m-0 border-0 p-0 text-[14px] leading-[1.12] font-bold tracking-normal">
        {item.title}
      </h3>
      <p className="m-0 mt-1 text-[12px] leading-[1.18] text-[#6f6f73]">{item.body}</p>
    </article>
  )
}
