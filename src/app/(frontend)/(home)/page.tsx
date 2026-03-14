import { Media } from '@/payload-types'
import { getCachedDocumentById } from '@/utilities/documents'
import { getCachedGlobal } from '@/utilities/globals'
import Image from 'next/image'

export default async function HomePage() {
  const payload = await getCachedGlobal('home', 2)()

  let image: Media

  if (typeof payload.image === 'number') {
    image = await getCachedDocumentById('media', `${payload.image}`)()
  } else {
    image = payload.image
  }

  return (
    <main className="w-screen">
      {image?.url ? (
        <Image
          className="w-screen"
          src={image.url}
          alt={image.alt}
          width={image.width!}
          height={image.height!}
        />
      ) : null}
    </main>
  )
}
