'use client'

import { LeadershipContactFieldControl } from '@/components/campaign/leadership/LeadershipContactFieldControl'

type LeadershipContactSectionProps = {
  leadershipId: number
  name: string
  email: string | null
  phone: string | null
}

export const LeadershipContactSection = ({
  leadershipId,
  name,
  email,
  phone,
}: LeadershipContactSectionProps) => (
  <section aria-labelledby="leadership-contact-title" className="flex flex-col gap-3">
    <h2 id="leadership-contact-title" className="text-base font-medium">
      Contato
    </h2>
    <dl className="grid gap-3 sm:grid-cols-3">
      <div className="flex flex-col gap-1">
        <dt className="text-sm text-muted-foreground">Nome</dt>
        <dd>
          <LeadershipContactFieldControl leadershipId={leadershipId} field="name" value={name} />
        </dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-sm text-muted-foreground">E-mail</dt>
        <dd>
          <LeadershipContactFieldControl leadershipId={leadershipId} field="email" value={email} />
        </dd>
      </div>
      <div className="flex flex-col gap-1">
        <dt className="text-sm text-muted-foreground">Celular</dt>
        <dd>
          <LeadershipContactFieldControl leadershipId={leadershipId} field="phone" value={phone} />
        </dd>
      </div>
    </dl>
  </section>
)
