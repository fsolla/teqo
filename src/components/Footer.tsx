import Link from 'next/link'

import { SocialLinks } from './socialLinks'

export const Footer = () => (
  <footer className="flex flex-col items-center justify-center gap-3 p-4 text-center text-sm text-muted-foreground">
    <SocialLinks ariaLabel="Redes sociais do rodapé" />
    <Link href="/privacidade" className="text-primary underline-offset-4 hover:underline">
      Política de Privacidade
    </Link>
  </footer>
)
