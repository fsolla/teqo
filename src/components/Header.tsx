import { getCachedGlobal } from '@/utilities/getGlobals'
import { SocialLinks } from './socialLinks'

export const Header = async () => {
  const settings = await getCachedGlobal('site-settings', 2)()

  console.log(settings)

  return (
    <header className="flex items-center justify-between p-4">
      {settings.headerTitle ? <h2>{settings.headerTitle}</h2> : null}
      <SocialLinks ariaLabel="Redes sociais" />
    </header>
  )
}
