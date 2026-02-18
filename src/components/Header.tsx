import { getCachedGlobal } from '@/utilities/globals'
import { SocialLinks } from './socialLinks'

export const Header = async () => {
  const settings = await getCachedGlobal('site-settings', 2)

  return (
    <header className="flex items-center justify-between p-4 absolute top-0 left-0 right-0 bg-black">
      {settings.headerTitle ? <h2>{settings.headerTitle}</h2> : null}
      <SocialLinks ariaLabel="Redes sociais" />
    </header>
  )
}
