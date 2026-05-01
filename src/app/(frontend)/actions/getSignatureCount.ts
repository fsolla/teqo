'use server'

import config from '@payload-config'
import { getPayload } from 'payload'

export const getSignatureCount = async (petitionId: string): Promise<number> => {
  const payload = await getPayload({ config })

  const { totalDocs } = await payload.count({
    collection: 'signature',
    where: { petition: { equals: petitionId } },
  })

  return totalDocs
}
