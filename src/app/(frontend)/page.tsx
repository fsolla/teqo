import { getCachedGlobal } from '@/utilities/globals'
import Image from 'next/image'
import { getPayload } from 'payload'
import React from 'react'
import configPromise from '@payload-config'
import { Media } from '@/payload-types'
import { getCachedDocumentById } from '@/utilities/documents'

export default async function HomePage() {
  const payload = await getCachedGlobal('home', 2)()

  let image: Media

  if (typeof payload.image === 'number') {
    image = await getCachedDocumentById('media', `${payload.image}`)()
  } else {
    image = payload.image
  }

  return (
    // Main element occupies the whole screen width and the height of screen minus height of header
    <main className="w-screen h-screen overflow-hidden">
      {image?.url ? (
        <Image src={image.url} alt={image.alt} width={image.width!} height={image.height!} />
      ) : null}
    </main>
  )
}
