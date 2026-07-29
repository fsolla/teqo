import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'

export default function CampaignHomeLoading() {
  return (
    <CampaignPageShell aria-busy="true" aria-label="Carregando início">
      {null}
    </CampaignPageShell>
  )
}
