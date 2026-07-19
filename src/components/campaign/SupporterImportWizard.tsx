'use client'

import { CheckCircle2Icon, FileUpIcon, UploadIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  confirmSupporterImport,
  previewSupporterImport,
} from '@/app/(campaign)/campanha/actions/supporter'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field, FieldContent, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/ToggleGroup'
import { cn } from '@/lib/utils'
import {
  isSupporterImportOkRow,
  type SupporterImportPreviewResult,
  type SupporterImportPreviewRow,
} from '@/utilities/supporterImport'
import { supporterVoteIntentionLabels } from '@/utilities/supporterUi'

const importStatusLabels: Record<SupporterImportPreviewRow['status'], string> = {
  ok: 'Pronto',
  duplicado_pelo_telefone: 'Duplicado (telefone)',
  telefone_invalido: 'Telefone inválido',
  municipio_nao_reconhecido: 'Município não reconhecido',
  nome_invalido: 'Nome inválido',
  intencao_invalida: 'Intenção inválida',
}

const steps = ['Upload', 'Conferir prévia', 'Confirmação'] as const

const isPreviewErrorRow = (row: SupporterImportPreviewRow): boolean =>
  row.status !== 'ok' && row.status !== 'duplicado_pelo_telefone'

const downloadErrorReport = (rows: SupporterImportPreviewRow[]) => {
  const errorRows = rows.filter(isPreviewErrorRow)
  const header = 'linha,nome,telefone,municipio,intencao,status\n'
  const body = errorRows
    .map(
      (row) =>
        `${row.line},"${row.nome.replace(/"/g, '""')}","${row.telefone}","${row.municipio}","${row.intencao}",${row.status}`,
    )
    .join('\n')
  const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'relatorio-erros-apoiadores.csv'
  link.click()
  URL.revokeObjectURL(url)
}

export const SupporterImportWizard = () => {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [preview, setPreview] = useState<SupporterImportPreviewResult | null>(null)
  const [previewFilter, setPreviewFilter] = useState<'all' | 'errors'>('all')
  const [operatorAttested, setOperatorAttested] = useState(false)
  const [consentNote, setConsentNote] = useState('')
  const [error, setError] = useState<string>()
  const [isPending, startTransition] = useTransition()
  const [confirmResult, setConfirmResult] = useState<{
    created: number
    skipped: number
  } | null>(null)

  const handleFile = (file: File | null) => {
    if (!file) return
    setError(undefined)
    startTransition(async () => {
      try {
        const csvText = await file.text()
        const result = await previewSupporterImport(csvText)
        setPreview(result)
        setStep(1)
      } catch (previewError) {
        setError(
          previewError instanceof Error ? previewError.message : 'Não foi possível ler o arquivo.',
        )
      }
    })
  }

  const visibleRows =
    preview?.rows.filter((row) => (previewFilter === 'errors' ? isPreviewErrorRow(row) : true)) ??
    []

  const confirmImport = () => {
    if (!preview) return
    setError(undefined)
    startTransition(async () => {
      try {
        const rows = preview.rows.filter(isSupporterImportOkRow).map((row) => ({
          nome: row.nome,
          telefone: row.normalizedPhone,
          municipio: row.canonicalCity,
          intencao: row.voteIntention,
        }))
        const result = await confirmSupporterImport({
          operatorAttested: true,
          consentNote: consentNote.trim() || undefined,
          rows,
        })
        setConfirmResult({ created: result.created, skipped: result.skipped })
        setStep(2)
        toast.success('Importação concluída.')
        router.refresh()
      } catch (confirmError) {
        setError(
          confirmError instanceof Error
            ? confirmError.message
            : 'Não foi possível confirmar a importação.',
        )
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-wrap items-center gap-2 text-sm">
        {steps.map((label, index) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={cn(
                'inline-flex size-7 items-center justify-center rounded-full border text-xs font-semibold',
                index <= step
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'text-muted-foreground',
              )}
            >
              {index < step ? (
                <CheckCircle2Icon className="size-4" aria-hidden="true" />
              ) : (
                index + 1
              )}
            </span>
            <span className={index <= step ? 'font-medium' : 'text-muted-foreground'}>{label}</span>
            {index < steps.length - 1 ? <span className="text-muted-foreground">→</span> : null}
          </li>
        ))}
      </ol>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Não foi possível continuar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {step === 0 ? (
        <section className="rounded-[6px] border border-dashed bg-card p-8 text-center">
          <FileUpIcon className="mx-auto size-10 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold">Enviar planilha CSV</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Colunas permitidas: nome, telefone, municipio, intencao.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <Input
              type="file"
              accept=".csv,text/csv"
              className="max-w-sm"
              disabled={isPending}
              onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
            />
            {isPending ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner className="size-4" /> Processando arquivo…
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {step === 1 && preview ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <Badge variant="estimate-confirmed">{preview.counts.ok} prontos</Badge>
            <Badge variant="secondary">{preview.counts.duplicate} duplicados (telefone)</Badge>
            <Badge variant="destructive">{preview.counts.error} erros</Badge>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <ToggleGroup
              type="single"
              value={previewFilter}
              onValueChange={(value) => setPreviewFilter((value as 'all' | 'errors') ?? 'all')}
              variant="outline"
            >
              <ToggleGroupItem value="all">Todos</ToggleGroupItem>
              <ToggleGroupItem value="errors">Só erros</ToggleGroupItem>
            </ToggleGroup>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => downloadErrorReport(preview.rows)}
            >
              Baixar relatório de erros
            </Button>
          </div>

          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Linha</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Município</TableHead>
                  <TableHead>Intenção</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleRows.slice(0, 100).map((row) => (
                  <TableRow key={row.line}>
                    <TableCell>{row.line}</TableCell>
                    <TableCell>{row.nome}</TableCell>
                    <TableCell>{row.telefone}</TableCell>
                    <TableCell>{row.municipio || '—'}</TableCell>
                    <TableCell>
                      {row.voteIntention ? supporterVoteIntentionLabels[row.voteIntention] : '—'}
                    </TableCell>
                    <TableCell>{importStatusLabels[row.status]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Field orientation="horizontal">
            <Checkbox
              id="operator-attested"
              checked={operatorAttested}
              onCheckedChange={(checked) => setOperatorAttested(checked === true)}
            />
            <FieldContent>
              <FieldLabel htmlFor="operator-attested">
                Atesto que os apoiadores importados consentiram com o cadastro *
              </FieldLabel>
              <FieldDescription>
                O operador confirma a base legal e o consentimento dos titulares.
              </FieldDescription>
            </FieldContent>
          </Field>

          <Field>
            <FieldLabel htmlFor="consent-note">Observação de consentimento (opcional)</FieldLabel>
            <Textarea
              id="consent-note"
              value={consentNote}
              onChange={(event) => setConsentNote(event.target.value)}
              className="min-h-20 rounded-[6px]"
            />
          </Field>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setStep(0)}>
              Voltar
            </Button>
            <Button
              type="button"
              className="min-h-11"
              disabled={!operatorAttested || preview.counts.ok === 0 || isPending}
              onClick={confirmImport}
            >
              {isPending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <UploadIcon data-icon="inline-start" />
              )}
              {isPending ? 'Importando…' : `Importar ${preview.counts.ok} apoiadores`}
            </Button>
          </div>
        </section>
      ) : null}

      {step === 2 && confirmResult ? (
        <section className="rounded-[6px] border bg-card p-6 text-center">
          <CheckCircle2Icon className="mx-auto size-10 text-estimate-confirmed-foreground" />
          <h2 className="mt-4 text-lg font-semibold">Importação concluída</h2>
          <p className="mt-2 text-muted-foreground">
            {confirmResult.created} criados · {confirmResult.skipped} ignorados
          </p>
          <Button asChild className="mt-6 min-h-11">
            <Link href="/campanha/apoiadores">Ver apoiadores</Link>
          </Button>
        </section>
      ) : null}
    </div>
  )
}
