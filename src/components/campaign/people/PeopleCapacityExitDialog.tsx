'use client'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/AlertDialog'
import { Button } from '@/components/ui/button'
import type { PersonCapacityExitManifest } from '@/utilities/people/personCapacityExit'

type PeopleCapacityExitDialogProps = {
  open: boolean
  personName: string
  manifest: PersonCapacityExitManifest
  onConfirm: () => void
  onCancel: () => void
}

const plural = (count: number, singular: string, pluralForm?: string): string =>
  `${count} ${count === 1 ? singular : (pluralForm ?? `${singular}s`)}`

/**
 * C128 — the destructive-exit confirmation of the people list: when the LAST
 * municipality of a capacity leaves the row, the entity (staff account or
 * leadership) dies server-side. This dialog lists — verbatim from the
 * read-only manifest — everything the transactional exit removes, and only
 * then lets the guard resolve the pending commit (same pattern as
 * `DeletePersonButton`; a cancel resolves the guard to `false` and nothing is
 * touched).
 */
export const PeopleCapacityExitDialog = ({
  open,
  personName,
  manifest,
  onConfirm,
  onCancel,
}: PeopleCapacityExitDialogProps) => {
  const isLeadership = manifest.capacity === 'leadership'
  return (
    <AlertDialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isLeadership ? 'Encerrar liderança' : 'Encerrar assessoria'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. Será removida a capacidade de{' '}
            <span className="font-medium text-foreground">{personName}</span>:
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isLeadership ? (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
            <li>Liderança (municípios: {manifest.municipalityNames.join(' · ') || '—'})</li>
            <li>{plural(manifest.declaredVoteCount, 'voto declarado', 'votos declarados')}</li>
            {manifest.inviteCount > 0 ? (
              <li>{plural(manifest.inviteCount, 'convite pendente', 'convites pendentes')}</li>
            ) : null}
          </ul>
        ) : (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted-foreground">
            <li>Conta de acesso ({manifest.accountName})</li>
            {manifest.authored.inviteCount > 0 ? (
              <li>{plural(manifest.authored.inviteCount, 'convite criado', 'convites criados')}</li>
            ) : null}
            {manifest.authored.updateCount > 0 ? (
              <li>
                {plural(
                  manifest.authored.updateCount,
                  'atualização de município',
                  'atualizações de município',
                )}
              </li>
            ) : null}
            {manifest.authored.feedCount > 0 ? (
              <li>{plural(manifest.authored.feedCount, 'link de agenda', 'links de agenda')}</li>
            ) : null}
            {manifest.authored.importBatchCount > 0 ? (
              <li>
                {plural(
                  manifest.authored.importBatchCount,
                  'importação de apoiadores pendente',
                  'importações de apoiadores pendentes',
                )}
              </li>
            ) : null}
            {manifest.assessorado.leadershipNames.length > 0 ||
            manifest.assessorado.deputyNames.length > 0 ||
            manifest.assessorado.activityNames.length > 0 ? (
              <li>
                Deixa de ser assessor responsável
                {manifest.assessorado.leadershipNames.length > 0
                  ? ` de ${manifest.assessorado.leadershipNames.join(', ')}`
                  : ''}
                {manifest.assessorado.deputyNames.length > 0
                  ? `${manifest.assessorado.leadershipNames.length > 0 ? ' e' : ' de'} ${manifest.assessorado.deputyNames.join(', ')}`
                  : ''}
                {manifest.assessorado.activityNames.length > 0
                  ? `${manifest.assessorado.leadershipNames.length > 0 || manifest.assessorado.deputyNames.length > 0 ? ' e' : ' de'} ${manifest.assessorado.activityNames.join(', ')}`
                  : ''}
                .
              </li>
            ) : null}
          </ul>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel type="button" className="min-h-11">
            Cancelar
          </AlertDialogCancel>
          <Button type="button" variant="destructive" className="min-h-11" onClick={onConfirm}>
            {isLeadership ? 'Encerrar liderança' : 'Encerrar assessoria'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
