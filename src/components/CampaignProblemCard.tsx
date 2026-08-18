import Image from 'next/image'

export type CampaignProblemCardItem = {
  id: string
  title: string
  body: string
  image?: string
  imageAlt?: string
  imageFrame?: {
    width: number
    height: number
    className: string
  }
}

export const CampaignProblemCard = ({ item }: { item: CampaignProblemCardItem }) => (
  <article className="relative h-full overflow-hidden rounded-[10px] bg-[#2a0b08] font-[family-name:var(--font-arimo)] text-white">
    {item.image && item.imageFrame ? (
      <Image
        src={item.image}
        alt={item.imageAlt ?? ''}
        width={item.imageFrame.width}
        height={item.imageFrame.height}
        sizes="(max-width: 393px) 137vw, 485px"
        className={item.imageFrame.className}
      />
    ) : item.image ? (
      <Image
        src={item.image}
        alt={item.imageAlt ?? ''}
        fill
        sizes="355px"
        className="object-cover object-center"
      />
    ) : null}
    <div className="absolute inset-0 bg-[linear-gradient(to_top,#2a0b08_0%,rgba(42,11,8,0.96)_23%,rgba(42,11,8,0.68)_34%,transparent_62%)]" />
    <div className="absolute right-3.5 bottom-3.5 left-3.5">
      <h3 className="m-0 border-0 p-0 text-[15px] leading-tight font-bold tracking-normal">
        {item.title}
      </h3>
      <p className="m-0 mt-1 text-[12px] leading-[1.16] text-white/90">{item.body}</p>
    </div>
  </article>
)
