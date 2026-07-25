import Link from 'next/link'

import { campaignAuthTextLinkClassName } from '@/lib/campaignAuthCopy'

export const CampaignAuthBackToLoginLink = () => (
  <div className="text-center text-sm">
    <Link href="/campanha/login" className={campaignAuthTextLinkClassName}>
      Voltar ao login
    </Link>
  </div>
)
