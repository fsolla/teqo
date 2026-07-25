import 'server-only'

import { Fragment, type ReactNode } from 'react'

import type { Consent } from '@/payload-types'

type ConsentNode = {
  children?: unknown
  fields?: unknown
  format?: unknown
  listType?: unknown
  newTab?: unknown
  tag?: unknown
  text?: unknown
  type?: unknown
  url?: unknown
}

const asNode = (value: unknown): ConsentNode | null =>
  typeof value === 'object' && value !== null ? (value as ConsentNode) : null

const childrenOf = (node: ConsentNode): unknown[] =>
  Array.isArray(node.children) ? node.children : []

const safeLink = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const href = value.trim()
  if (href.startsWith('/') || href.startsWith('#')) return href

  try {
    const url = new URL(href)
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? href : null
  } catch {
    return null
  }
}

const renderChildren = (node: ConsentNode, key: string, depth: number): ReactNode =>
  childrenOf(node).map((child, index) => renderNode(child, `${key}-${index}`, depth + 1))

const renderText = (node: ConsentNode, key: string): ReactNode => {
  if (typeof node.text !== 'string') return null

  let content: ReactNode = node.text
  const format = typeof node.format === 'number' ? node.format : 0
  if (format & 1) content = <strong>{content}</strong>
  if (format & 2) content = <em>{content}</em>
  if (format & 4) content = <s>{content}</s>
  if (format & 8) content = <u>{content}</u>
  if (format & 16) content = <code>{content}</code>
  if (format & 32) content = <sub>{content}</sub>
  if (format & 64) content = <sup>{content}</sup>
  if (format & 128) content = <mark>{content}</mark>

  return <Fragment key={key}>{content}</Fragment>
}

const renderNode = (value: unknown, key: string, depth: number): ReactNode => {
  if (depth > 40) return null
  const node = asNode(value)
  if (!node || typeof node.type !== 'string') return null

  switch (node.type) {
    case 'text':
      return renderText(node, key)
    case 'linebreak':
      return <br key={key} />
    case 'paragraph':
      return <p key={key}>{renderChildren(node, key, depth)}</p>
    case 'heading': {
      const children = renderChildren(node, key, depth)
      switch (node.tag) {
        case 'h2':
          return <h2 key={key}>{children}</h2>
        case 'h3':
          return <h3 key={key}>{children}</h3>
        case 'h4':
          return <h4 key={key}>{children}</h4>
        case 'h5':
          return <h5 key={key}>{children}</h5>
        case 'h6':
          return <h6 key={key}>{children}</h6>
        default:
          return <h2 key={key}>{children}</h2>
      }
    }
    case 'quote':
      return <blockquote key={key}>{renderChildren(node, key, depth)}</blockquote>
    case 'list': {
      const children = renderChildren(node, key, depth)
      return node.tag === 'ol' || node.listType === 'number' ? (
        <ol key={key}>{children}</ol>
      ) : (
        <ul key={key}>{children}</ul>
      )
    }
    case 'listitem':
      return <li key={key}>{renderChildren(node, key, depth)}</li>
    case 'link':
    case 'autolink': {
      const fields = asNode(node.fields)
      const href = safeLink(fields?.url ?? node.url)
      const children = renderChildren(node, key, depth)
      if (!href) return <Fragment key={key}>{children}</Fragment>
      const opensNewTab = fields?.newTab === true
      return (
        <a
          key={key}
          href={href}
          rel={opensNewTab ? 'noopener noreferrer' : undefined}
          target={opensNewTab ? '_blank' : undefined}
        >
          {children}
        </a>
      )
    }
    case 'horizontalrule':
      return <hr key={key} />
    default:
      return <Fragment key={key}>{renderChildren(node, key, depth)}</Fragment>
  }
}

export const ConsentText = ({ data }: { data: Consent['text'] }) => (
  <div className="flex flex-col gap-3 text-foreground">
    {data.root.children.map((node, index) => renderNode(node, `consent-${index}`, 0))}
  </div>
)
