import Link from 'next/link'

import { SocialLinks } from './socialLinks'
import { getCachedGlobal } from '@/utilities/globalReads'

export const Footer = async () => {
  const privacy = await getCachedGlobal('privacy-policy', 0)()
  const showPrivacyLink = privacy.published === true

  return (
    <footer className="flex flex-col items-center justify-center gap-3 p-4 text-center text-sm text-muted-foreground">
      <SocialLinks ariaLabel="Redes sociais do rodapé" />
      {showPrivacyLink ? (
        <Link href="/privacidade" className="text-primary underline-offset-4 hover:underline">
          Política de Privacidade
        </Link>
      ) : null}
    </footer>
  )
}
