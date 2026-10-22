/**
 * S47 — the public-site vocabulary shared by the post-election chrome: the
 * canonical paths, the official social profiles and the public focus recipe.
 * The home header/footer, the internal headers and the content board render
 * from here so the campaign number and the old discovery links never grow back
 * in one surface while another is edited.
 */
export const PUBLIC_PATHS = {
  home: '/',
  artigos: '/artigos',
  fotos: '/fotos',
  privacidade: '/privacidade',
} as const

export const PUBLIC_SOCIAL_LINKS = {
  instagram: { label: 'Instagram', href: 'https://instagram.com/depjorgesolla' },
  youtube: { label: 'YouTube', href: 'https://youtube.com/@JorgeSollaDep' },
  facebook: { label: 'Facebook', href: 'https://facebook.com/depjorgesolla' },
} as const

export const PUBLIC_SOCIAL_LINK_LIST = Object.values(PUBLIC_SOCIAL_LINKS)

/**
 * C243 focus recipe for light public surfaces: 3px yellow outline with the
 * dark-blue separator ring. On dark surfaces the yellow edge stays visible.
 */
export const PUBLIC_FOCUS =
  'focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-(--pt-yellow) focus-visible:shadow-[0_0_0_6px_#184e92] focus-visible:outline'
