import {
  ArrowRightIcon,
  BriefcaseIcon,
  FlagIcon,
  HeartHandshakeIcon,
  LandmarkIcon,
  MessageCircleIcon,
  UserIcon,
  UsersIcon,
  WrenchIcon,
} from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { LeadershipInviteRowAction } from '@/components/campaign/invite/LeadershipInviteRowAction'
import { SupportStatusBadge } from '@/components/campaign/leadership/SupportStatusBadge'
import { DeletePersonButton } from '@/components/campaign/people/DeletePersonButton'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import type { ResolvedPortfolioEntry } from '@/lib/municipalityPortfolio'
import { formatBrazilianPhoneInput, whatsAppHrefForPhone } from '@/lib/phone'
import { campaignRoleLabels } from '@/utilities/campaignUserProfile'
import type { PersonDetailViewModel } from '@/utilities/people/personDetail'
import {
  supporterSourceLabels,
  supporterVoteIntentionLabels,
} from '@/utilities/supporter/supporterUi'

/**
 * C118 — the person detail, mounted by capacity: each section renders only
 * when the ficha actually has that papel (liderança, dobradinha, assessora,
 * assessorado, apoiador). The page stays thin — the composition rule lives
 * here, next to the cards. Read-only by design: writing stays in the list
 * (C116) and the surfaces that own each papel.
 */

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

const PersonSectionCard = ({
  sectionId,
  icon,
  title,
  trailing,
  children,
}: {
  /** ASCII stable id (aria-labelledby + CSS): `person-section-<slug>`. */
  sectionId: string
  icon: ReactNode
  title: string
  trailing?: ReactNode
  children: ReactNode
}) => (
  <section
    aria-labelledby={`person-section-${sectionId}`}
    className="flex flex-col gap-3 rounded-xl border p-4"
  >
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex size-5 items-center justify-center text-muted-foreground">{icon}</span>
      <h2 id={`person-section-${sectionId}`} className="text-base font-medium">
        {title}
      </h2>
      {trailing}
    </div>
    {children}
  </section>
)

const PersonMunicipalityChips = ({
  ids,
  index,
}: {
  ids: readonly number[]
  index: ReadonlyMap<number, ResolvedPortfolioEntry>
}) => {
  if (!ids.length) return <span className="text-muted-foreground">—</span>
  const names = ids
    .map((id) => index.get(id)?.name)
    .filter((name): name is string => name !== undefined)
  if (!names.length) return <span className="text-muted-foreground">—</span>
  const visible = names.slice(0, 2)
  const rest = names.length - visible.length
  return (
    <div className="flex flex-wrap gap-1">
      {visible.map((name) => (
        <Badge key={name} variant="outline" className="max-w-full truncate font-normal">
          {name}
        </Badge>
      ))}
      {rest > 0 ? (
        <Badge variant="outline" className="font-normal text-muted-foreground">
          +{rest}
        </Badge>
      ) : null}
    </div>
  )
}

const FichaField = ({ label, value }: { label: string; value: string | null }) => (
  <div className="flex min-w-0 flex-col gap-1">
    <dt className="text-sm text-muted-foreground">{label}</dt>
    <dd className="truncate font-medium" title={value ?? undefined}>
      {value ?? <span className="font-normal text-muted-foreground">—</span>}
    </dd>
  </div>
)

const PersonFichaSection = ({ person }: { person: PersonDetailViewModel }) => {
  const capacityPills: string[] = []
  if (person.leadershipID !== null) capacityPills.push('Liderança')
  if (person.deputyID !== null) capacityPills.push('Dobradinha')
  if (person.staff.length > 0) capacityPills.push('Assessora')
  if (person.supporters.length > 0) capacityPills.push('Apoiador')

  return (
    <PersonSectionCard
      sectionId="ficha"
      icon={<UserIcon className="size-4" aria-hidden="true" />}
      title="Ficha"
    >
      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <FichaField label="Partido" value={person.party} />
        <FichaField
          label="Telefone"
          value={person.phone ? formatBrazilianPhoneInput(person.phone) : null}
        />
        <FichaField label="E-mail" value={person.email} />
        <FichaField label="Base" value={person.city} />
      </dl>
      <div className="flex flex-wrap gap-1">
        {capacityPills.map((label) => (
          <Badge key={label} variant="secondary">
            {label}
          </Badge>
        ))}
      </div>
    </PersonSectionCard>
  )
}

const PersonLeadershipSection = ({
  person,
  municipalityIndex,
}: {
  person: PersonDetailViewModel
  municipalityIndex: ReadonlyMap<number, ResolvedPortfolioEntry>
}) => (
  <PersonSectionCard
    sectionId="leadership"
    icon={<FlagIcon className="size-4" aria-hidden="true" />}
    title="Liderança"
    trailing={
      <Badge variant={person.hasAppAccess ? 'estimate-confirmed' : 'outline'}>
        {person.hasAppAccess ? 'Com acesso ao app' : 'Sem acesso ao app'}
      </Badge>
    }
  >
    {person.supportStatus ? <SupportStatusBadge status={person.supportStatus} /> : null}
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">Municípios</span>
      <PersonMunicipalityChips ids={person.leadershipMunicipalityIDs} index={municipalityIndex} />
    </div>
    {person.leadershipID !== null ? (
      <Button asChild variant="ghost" className="w-fit gap-1 pl-0 text-muted-foreground">
        <Link href={`/campanha/liderancas/${person.leadershipID}`}>
          Abrir detalhe de liderança
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Link>
      </Button>
    ) : null}
  </PersonSectionCard>
)

const PersonDeputySection = ({
  person,
  municipalityIndex,
}: {
  person: PersonDetailViewModel
  municipalityIndex: ReadonlyMap<number, ResolvedPortfolioEntry>
}) => (
  <PersonSectionCard
    sectionId="deputy"
    icon={<LandmarkIcon className="size-4" aria-hidden="true" />}
    title="Dobradinha"
    trailing={person.party ? <Badge variant="outline">{person.party}</Badge> : null}
  >
    <div className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">Municípios</span>
      <PersonMunicipalityChips ids={person.deputyMunicipalityIDs} index={municipalityIndex} />
    </div>
  </PersonSectionCard>
)

const PersonAssessoraSection = ({
  person,
  municipalityIndex,
}: {
  person: PersonDetailViewModel
  municipalityIndex: ReadonlyMap<number, ResolvedPortfolioEntry>
}) => (
  <PersonSectionCard
    sectionId="assessora"
    icon={<BriefcaseIcon className="size-4" aria-hidden="true" />}
    title="Assessora"
    trailing={<Badge variant="outline">{person.staff.length}</Badge>}
  >
    <div className="flex flex-col gap-3">
      {person.staff.map((account) => (
        <div key={account.id} className="flex flex-col gap-1 text-sm">
          <p>
            {account.name}{' '}
            <span className="text-muted-foreground">({campaignRoleLabels[account.role]})</span>
          </p>
          {account.municipalityIDs.length > 0 ? (
            <PersonMunicipalityChips ids={account.municipalityIDs} index={municipalityIndex} />
          ) : (
            <span className="text-muted-foreground">Sem municípios na carteira</span>
          )}
        </div>
      ))}
    </div>
  </PersonSectionCard>
)

const PersonAssessoradoSection = ({ names }: { names: string[] }) => (
  <PersonSectionCard
    sectionId="assessorado"
    icon={<UsersIcon className="size-4" aria-hidden="true" />}
    title="Assessorado"
    trailing={<Badge variant="outline">{names.length}</Badge>}
  >
    <p className="text-sm">{names.join(' · ')}</p>
  </PersonSectionCard>
)

const PersonSupporterSection = ({
  person,
  municipalityIndex,
}: {
  person: PersonDetailViewModel
  municipalityIndex: ReadonlyMap<number, ResolvedPortfolioEntry>
}) => (
  <PersonSectionCard
    sectionId="supporter"
    icon={<HeartHandshakeIcon className="size-4" aria-hidden="true" />}
    title="Apoiador"
    trailing={<Badge variant="outline">{person.supporters.length}</Badge>}
  >
    <ul className="flex flex-col gap-3">
      {person.supporters.map((supporter) => {
        const municipalityName =
          supporter.municipalityID === null
            ? null
            : (municipalityIndex.get(supporter.municipalityID)?.name ?? null)
        const voteIntentionLabel = supporter.voteIntention
          ? supporterVoteIntentionLabels[supporter.voteIntention]
          : null
        return (
          <li key={supporter.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-muted-foreground">
              {supporterSourceLabels[supporter.source]}
              {municipalityName ? ` · ${municipalityName}` : ''}
            </span>
            {voteIntentionLabel ? (
              <>
                <Badge variant="estimate-confirmed">{voteIntentionLabel}</Badge>
                {!supporter.hasVoteIntentionConsent ? (
                  <span className="text-xs text-muted-foreground">
                    sem consentimento registrado
                  </span>
                ) : null}
              </>
            ) : (
              <Badge variant="outline">Sem intenção registrada</Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {dateFormatter.format(new Date(supporter.createdAt))}
            </span>
          </li>
        )
      })}
    </ul>
  </PersonSectionCard>
)

const PersonActionsSection = ({
  person,
  canDelete,
}: {
  person: PersonDetailViewModel
  canDelete: boolean
}) => {
  const whatsAppHref = whatsAppHrefForPhone(person.phone)
  const hasActions = person.leadershipID !== null || whatsAppHref !== null || canDelete
  if (!hasActions) return null
  return (
    <PersonSectionCard
      sectionId="actions"
      icon={<WrenchIcon className="size-4" aria-hidden="true" />}
      title="Ações"
    >
      <div className="flex flex-wrap items-center gap-2">
        {person.leadershipID !== null ? (
          <LeadershipInviteRowAction
            leadershipID={person.leadershipID}
            name={person.name}
            hasValidPhone={whatsAppHref !== null}
          />
        ) : null}
        {whatsAppHref ? (
          <Button asChild variant="outline" className="min-h-10">
            <a href={whatsAppHref} target="_blank" rel="noopener noreferrer" className="gap-1.5">
              <MessageCircleIcon className="size-4" aria-hidden="true" />
              Enviar WhatsApp
            </a>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled
            className="min-h-10 gap-1.5"
            aria-label={`WhatsApp indisponível — ${person.name} sem celular`}
          >
            <MessageCircleIcon className="size-4" aria-hidden="true" />
            Enviar WhatsApp
          </Button>
        )}
        {canDelete ? (
          <DeletePersonButton
            personName={person.name}
            contactId={person.contactID}
            deletedHref="/campanha/pessoas"
          />
        ) : null}
      </div>
    </PersonSectionCard>
  )
}

export const PersonDetailSections = ({
  person,
  municipalityIndex,
  canDelete,
}: {
  person: PersonDetailViewModel
  municipalityIndex: ReadonlyMap<number, ResolvedPortfolioEntry>
  canDelete: boolean
}) => (
  <div className="flex flex-col gap-4">
    <PersonFichaSection person={person} />
    {person.leadershipID !== null ? (
      <PersonLeadershipSection person={person} municipalityIndex={municipalityIndex} />
    ) : null}
    {person.deputyID !== null ? (
      <PersonDeputySection person={person} municipalityIndex={municipalityIndex} />
    ) : null}
    {person.staff.length > 0 ? (
      <PersonAssessoraSection person={person} municipalityIndex={municipalityIndex} />
    ) : null}
    {person.assessoradoNames.length > 0 ? (
      <PersonAssessoradoSection names={person.assessoradoNames} />
    ) : null}
    {person.supporters.length > 0 ? (
      <PersonSupporterSection person={person} municipalityIndex={municipalityIndex} />
    ) : null}
    <PersonActionsSection person={person} canDelete={canDelete} />
  </div>
)
