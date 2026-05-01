import type { Media } from '@/payload-types'

type LexicalNode = {
  type?: string
  relationTo?: string
  value?: unknown
  children?: LexicalNode[]
  [key: string]: unknown
}

type LexicalRoot = {
  root: LexicalNode
  [key: string]: unknown
}

const isImageMedia = (value: unknown): value is Media =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as Media).url === 'string' &&
  typeof (value as Media).mimeType === 'string' &&
  (value as Media).mimeType!.startsWith('image/')

const findImage = (node: LexicalNode): Media | null => {
  if (node.type === 'upload' && node.relationTo === 'media' && isImageMedia(node.value)) {
    return node.value
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      const found = findImage(child)
      if (found) return found
    }
  }

  return null
}

export const extractFirstImageFromLexical = (data: LexicalRoot): Media | null =>
  findImage(data.root)
