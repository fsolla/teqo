import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { getCachedGlobal } from '@/utilities/globals'
import Link from 'next/link'
import { Fragment } from 'react'
import { SocialLinks } from './socialLinks'

export type Crumb = {
  label: string
  /** Omit on the current (last) crumb so it renders as plain text. */
  href?: string
}

type SiteHeaderProps = {
  /**
   * Breadcrumb trail rendered on the light sub-bar. When empty (e.g. on the
   * home page) no breadcrumb bar is shown.
   */
  breadcrumbs?: Crumb[]
  /**
   * `solid` renders a brand-red bar that participates in the layout flow and
   * sticks to the top of its scroll container (used on the Posts pages).
   * `overlay` floats transparently over hero content (used on the home page).
   */
  variant?: 'solid' | 'overlay'
}

const HOME_LABEL = 'Início'

export const SiteHeader = async ({ breadcrumbs = [], variant = 'solid' }: SiteHeaderProps) => {
  const settings = await getCachedGlobal('site-settings', 2)()
  const title = settings.headerTitle?.trim() || 'Jorge Solla'

  if (variant === 'overlay') {
    return (
      <header className="absolute top-0 right-0 left-0 z-30 flex items-center justify-between p-4">
        <Link href="/" className="text-inherit no-underline">
          <h4>{title}</h4>
        </Link>
        <SocialLinks ariaLabel="Redes sociais" />
      </header>
    )
  }

  const trail: Crumb[] = [{ label: HOME_LABEL, href: '/' }, ...breadcrumbs]

  return (
    <header className="sticky top-0 z-30">
      <div className="bg-(--site-header) text-(--site-header-foreground)">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="text-lg font-semibold tracking-tight text-(--site-header-foreground) no-underline transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            {title}
          </Link>
          <SocialLinks
            ariaLabel="Redes sociais"
            className="text-(--site-header-muted) [&_a]:text-(--site-header-muted) [&_a:hover]:text-(--site-header-foreground)"
          />
        </div>
      </div>
      {trail.length > 1 ? (
        <div className="border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
          <div className="mx-auto w-full max-w-5xl px-4 py-2.5 sm:px-6 lg:px-8">
            <Breadcrumb>
              <BreadcrumbList>
                {trail.map((crumb, index) => {
                  const isLast = index === trail.length - 1
                  return (
                    <Fragment key={`${crumb.label}-${index}`}>
                      <BreadcrumbItem>
                        {isLast || !crumb.href ? (
                          <BreadcrumbPage className="line-clamp-1">{crumb.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link href={crumb.href}>{crumb.label}</Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                      {isLast ? null : <BreadcrumbSeparator />}
                    </Fragment>
                  )
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </div>
      ) : null}
    </header>
  )
}
