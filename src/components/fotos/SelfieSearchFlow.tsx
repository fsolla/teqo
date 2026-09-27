'use client'

import {
  Camera,
  ChevronLeft,
  Clock,
  ImageIcon,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  TriangleAlert,
  Upload,
  WifiOff,
} from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'

import { ARCHIVE_PHOTO_ALBUM_PATH } from '@/lib/archivePhotoPublicCatalog'
import type { FaceSearchPhotoView } from '@/lib/faceSearch'

import {
  ARCHIVE_PHOTO_FOCUS,
  ARCHIVE_PHOTO_PRIMARY_BUTTON,
  ARCHIVE_PHOTO_SECONDARY_BUTTON,
} from './archivePhotoClasses'
import { computeSelfieDescriptor, supportsFaceSearchEngine } from './faceSearchEngine'
import { SelfieSearchClosed } from './SelfieSearchClosed'
import { SelfieSearchResultCard } from './SelfieSearchResultCard'

type SelfieSearchIntent = 'search' | 'leave-index'

type FlowStep =
  | { kind: 'consent' }
  | { kind: 'pick'; intent: SelfieSearchIntent }
  | { kind: 'confirm-leave' }
  | { kind: 'processing'; intent: SelfieSearchIntent }
  | { kind: 'results'; photos: FaceSearchPhotoView[] }
  | { kind: 'empty' }
  | { kind: 'no-face' }
  | { kind: 'presence' }
  | { kind: 'removed' }
  | { kind: 'presence-missing' }
  | { kind: 'unsupported' }
  | { kind: 'engine-error' }
  | { kind: 'rate-limited' }
  | { kind: 'network' }
  | { kind: 'closed' }

type SelfieSearchResponse =
  | { ok: true; found: true; photos: FaceSearchPhotoView[] }
  | { ok: true; found: false }
  | { ok: true; removed: boolean }
  | { ok: false; error: string }

const ACCEPTED_IMAGE = 'image/*'
const FOCUSABLE = 'a[href]:not([tabindex="-1"]), button:not([disabled]), input:not([disabled])'

/** The wizard steps center on a readable column; the result breaks out to the page grid. */
const STEP_SHELL = 'mx-auto w-full max-w-[650px]'

/**
 * C234 — the selfie search flow (artefato: cenas 02–13). The browser computes
 * the descriptor on device and posts only the 128-float vector; the component
 * never puts the image in a request. Every terminal state of the artifact has
 * an exact counterpart here (empty, no-face, engine/unsupported, rate limit,
 * network, closed) and none of them shows a score, a percentage or a
 * third-party name. The consent text arrives rendered from the server (the
 * approved Consent reachText); the opt-out is authorized by the same face
 * match, and its no-match case points to the album's configured channel.
 */
export const SelfieSearchFlow = ({
  consentText,
  removalChannelUrl,
}: {
  consentText: ReactNode
  removalChannelUrl: string | null
}) => {
  const [step, setStep] = useState<FlowStep>({ kind: 'consent' })
  const [consented, setConsented] = useState(false)
  const [activeIntent, setActiveIntent] = useState<SelfieSearchIntent>('search')
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const previewRef = useRef<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLElement>(null)
  const presenceRef = useRef<HTMLElement>(null)
  const pickRef = useRef<HTMLElement>(null)
  const processingRef = useRef<HTMLElement>(null)

  useEffect(
    () => () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    },
    [],
  )

  // The async transitions unmount the control that had focus; every new step
  // starts at its own top (the album scrolls inside its segment container, so
  // `scrollIntoView` is what reaches it) with focus on the heading region —
  // keyboard/screen-reader users never land mid-step (the terminal cards focus
  // and scroll themselves).
  useEffect(() => {
    const target =
      step.kind === 'pick'
        ? pickRef.current
        : step.kind === 'processing'
          ? processingRef.current
          : step.kind === 'results'
            ? resultsRef.current
            : step.kind === 'presence'
              ? presenceRef.current
              : null
    target?.scrollIntoView({ block: 'start' })
    target?.focus()
  }, [step.kind])

  const releasePreview = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = null
    setPreviewUrl(null)
  }

  const selectFile = (next: File | null) => {
    releasePreview()
    setFile(next)
    if (next) {
      previewRef.current = URL.createObjectURL(next)
      setPreviewUrl(previewRef.current)
    }
  }

  const runSearch = async (intent: SelfieSearchIntent) => {
    if (!file) return

    setStep({ kind: 'processing', intent })
    const computed = await computeSelfieDescriptor(file)
    if (!computed.ok) {
      setStep(
        computed.reason === 'unsupported'
          ? { kind: 'unsupported' }
          : computed.reason === 'empty'
            ? { kind: 'no-face' }
            : { kind: 'engine-error' },
      )
      return
    }

    try {
      const response = await fetch('/api/fotos/selfie', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ vector: computed.descriptor, intent }),
      })
      const body = (await response.json().catch(() => null)) as SelfieSearchResponse | null

      if (response.status === 429) return setStep({ kind: 'rate-limited' })
      if (response.status === 404 || response.status === 503) return setStep({ kind: 'closed' })
      if (!response.ok || body === null || !body.ok) return setStep({ kind: 'engine-error' })

      if (intent === 'leave-index') {
        if (!('removed' in body)) return setStep({ kind: 'engine-error' })
        return setStep(body.removed ? { kind: 'removed' } : { kind: 'presence-missing' })
      }

      if ('found' in body && body.found) return setStep({ kind: 'results', photos: body.photos })
      return setStep({ kind: 'empty' })
    } catch {
      setStep({ kind: 'network' })
    }
  }

  const startSelfieStep = (intent: SelfieSearchIntent) => {
    if (!supportsFaceSearchEngine()) {
      setStep({ kind: 'unsupported' })
      return
    }
    setActiveIntent(intent)
    selectFile(null)
    setStep({ kind: 'pick', intent })
  }

  const openPicker = () => inputRef.current?.click()

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null
    event.target.value = ''
    selectFile(next)
  }

  const reset = () => {
    selectFile(null)
    setConsented(false)
    setStep({ kind: 'consent' })
  }

  return (
    <div className="w-full px-5 py-8 sm:px-8 sm:py-10">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_IMAGE}
        className="sr-only"
        aria-label="Escolher uma selfie"
        onChange={onFileChange}
      />

      {step.kind === 'consent' ? (
        <p className="mb-4 text-center text-sm font-bold text-(--campaign-muted)">
          Encontre você nas fotos
        </p>
      ) : null}

      {step.kind === 'consent' ? (
        <section
          aria-labelledby="selfie-consent-title"
          className={`${STEP_SHELL} rounded-2xl border border-(--campaign-line) bg-white p-6 sm:p-7`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="grid size-12 place-items-center rounded-xl bg-[#eef4fb] text-[#184e92]">
              <ShieldCheck aria-hidden="true" className="size-6" strokeWidth={2} />
            </div>
            <span className="rounded-full bg-[#eef4fb] px-3 py-1 text-xs font-extrabold text-[#184e92]">
              Passo 1 de 3
            </span>
          </div>
          <p className="mt-5 text-xs font-black tracking-[0.1em] text-[#184e92] uppercase">
            Antes da sua selfie
          </p>
          <h2
            id="selfie-consent-title"
            className="mt-2 border-0 pb-0 font-[family-name:var(--font-exo2)] text-2xl font-black"
          >
            Sua face é um dado biométrico sensível
          </h2>
          <div className="mt-3 max-h-72 overflow-y-auto rounded-xl border border-(--campaign-line) bg-(--campaign-cream) p-4 text-sm leading-6 text-(--campaign-muted)">
            {consentText}
          </div>
          <div className="mt-5 grid gap-3 rounded-xl bg-[#f9faff] p-4 text-sm">
            <div className="flex gap-3">
              <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#184e92]" />
              <p>
                <b>A selfie não sai do dispositivo.</b>
                <br />
                <span className="text-(--campaign-muted)">
                  A imagem é processada aqui e não é guardada na galeria do site.
                </span>
              </p>
            </div>
            <div className="flex gap-3">
              <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#184e92]" />
              <p>
                <b>Você pode desistir e pedir remoção.</b>
                <br />
                <span className="text-(--campaign-muted)">
                  O resultado não mostra nomes de terceiros nem percentual de semelhança.
                </span>
              </p>
            </div>
          </div>
          <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-black/15 p-4 text-sm leading-5">
            <input
              type="checkbox"
              checked={consented}
              onChange={(event) => setConsented(event.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-[#184e92]"
            />
            <span>
              Li e autorizo o uso temporário da minha biometria facial para procurar a mim mesmo
              neste álbum.
            </span>
          </label>
          <p className="mt-3 text-xs leading-5 text-(--campaign-muted)">
            Saiba como tratamos seus dados na{' '}
            <Link
              href="/privacidade"
              className="font-bold text-[#184e92] underline underline-offset-2"
            >
              Política de Privacidade
            </Link>
            .
          </p>
          <button
            type="button"
            disabled={!consented}
            onClick={() => startSelfieStep('search')}
            className={`${ARCHIVE_PHOTO_PRIMARY_BUTTON} mt-6 w-full disabled:cursor-not-allowed disabled:opacity-55`}
          >
            Concordar e escolher minha selfie
          </button>
          <Link
            href={ARCHIVE_PHOTO_ALBUM_PATH}
            className={`mt-3 flex min-h-11 w-full items-center justify-center text-sm font-bold text-(--campaign-muted) ${ARCHIVE_PHOTO_FOCUS}`}
          >
            Agora não · voltar ao álbum
          </Link>
        </section>
      ) : null}

      {step.kind === 'pick' ? (
        <section
          ref={pickRef}
          tabIndex={-1}
          aria-labelledby="selfie-pick-title"
          className={`${STEP_SHELL} rounded-2xl border border-(--campaign-line) bg-white p-6 focus:outline-none sm:p-7`}
        >
          <StepDots current={2} />
          <p className="mt-5 text-xs font-black tracking-[0.08em] text-[#184e92] uppercase">
            Passo 2 de 3
          </p>
          <h2
            id="selfie-pick-title"
            className="mt-1 border-0 pb-0 font-[family-name:var(--font-exo2)] text-2xl font-black"
          >
            Escolha uma selfie nítida
          </h2>
          <p className="mt-2 text-sm leading-5 text-(--campaign-muted)">
            Olhe para a câmera, com o rosto bem iluminado e sem outras pessoas na imagem.
          </p>
          {previewUrl ? (
            <div className="relative mt-5 aspect-[4/5] overflow-hidden rounded-2xl border border-black/10 bg-[#f5f5f4]">
              {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, never uploaded */}
              <img src={previewUrl} alt="Prévia da sua selfie" className="size-full object-cover" />
              <span className="absolute right-3 bottom-3 rounded-full bg-black/55 px-3 py-1.5 text-[10px] font-bold text-white">
                Prévia no aparelho
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={openPicker}
              className={`mt-5 flex aspect-[4/5] w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-[#184e92]/30 bg-[#f9faff] text-sm font-bold text-[#184e92] ${ARCHIVE_PHOTO_FOCUS}`}
            >
              <Camera aria-hidden="true" className="size-7" strokeWidth={2} />
              Tirar ou escolher uma foto
            </button>
          )}
          <div className="mt-4 flex items-start gap-3 rounded-xl bg-[#eef4fb] p-3 text-sm text-[#143c70]">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <p className="leading-5">
              <b>Esta foto não sai do seu dispositivo.</b>
              <br />O processamento acontece aqui.
            </p>
          </div>
          <button
            type="button"
            disabled={!file}
            onClick={() =>
              step.intent === 'leave-index'
                ? setStep({ kind: 'confirm-leave' })
                : runSearch('search')
            }
            className={`${ARCHIVE_PHOTO_PRIMARY_BUTTON} mt-5 w-full disabled:cursor-not-allowed disabled:opacity-55`}
          >
            {step.intent === 'leave-index' ? 'Continuar' : 'Usar esta selfie'}
          </button>
          <button
            type="button"
            onClick={openPicker}
            className={`${ARCHIVE_PHOTO_SECONDARY_BUTTON} mt-2 w-full`}
          >
            <Upload aria-hidden="true" className="size-4" />
            Escolher outra foto
          </button>
        </section>
      ) : null}

      {step.kind === 'processing' ? (
        <section
          ref={processingRef}
          tabIndex={-1}
          aria-live="polite"
          className={`${STEP_SHELL} flex min-h-[560px] flex-col items-center justify-center rounded-2xl border border-(--campaign-line) bg-white px-6 py-12 text-center focus:outline-none`}
        >
          <div className="relative">
            <div className="grid size-28 place-items-center overflow-hidden rounded-full border-4 border-white bg-[#f5f5f4] shadow-[0_10px_28px_rgb(0_0_0/16%)]">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview, never uploaded
                <img src={previewUrl} alt="" className="size-full object-cover" />
              ) : null}
            </div>
            <div className="absolute -right-2 -bottom-1 grid size-10 place-items-center rounded-full bg-[#eef4fb]">
              <span className="size-7 animate-spin rounded-full border-[3px] border-[#184e92]/16 border-t-[#184e92] motion-reduce:animate-none" />
            </div>
          </div>
          <p className="mt-7 text-xs font-black tracking-[0.08em] text-[#184e92] uppercase">
            {step.intent === 'leave-index' ? 'Saindo do índice' : 'Passo 3 de 3'}
          </p>
          <h2 className="mt-2 border-0 pb-0 font-[family-name:var(--font-exo2)] text-2xl font-black">
            {step.intent === 'leave-index'
              ? 'Confirmando sua saída do índice…'
              : 'Procurando você nas fotos aprovadas…'}
          </h2>
          <p className="mt-3 max-w-[290px] text-sm leading-6 text-(--campaign-muted)">
            Mantenha esta tela aberta. Sua selfie continua somente neste aparelho.
          </p>
          <div className="mt-6 flex items-center gap-2 text-xs font-bold text-[#184e92]">
            <ShieldCheck aria-hidden="true" className="size-4" />
            Sem upload da imagem · sem cadastro
          </div>
        </section>
      ) : null}

      {step.kind === 'results' ? (
        <section
          ref={resultsRef}
          tabIndex={-1}
          aria-labelledby="selfie-results-title"
          className="-mx-5 w-auto bg-white px-5 py-8 focus:outline-none sm:-mx-8 sm:px-8 sm:py-9"
        >
          <div className="mx-auto w-full max-w-6xl">
            <div className="flex flex-col gap-5 border-b border-(--campaign-line) pb-6 sm:flex-row sm:items-start sm:justify-between sm:gap-8">
              <div>
                <p className="hidden text-xs font-black tracking-[0.1em] text-[#184e92] uppercase sm:block">
                  Sua busca por selfie
                </p>
                <h2
                  id="selfie-results-title"
                  className="mt-0 border-0 pb-0 font-[family-name:var(--font-exo2)] text-2xl font-black tracking-[-0.03em] sm:mt-2 sm:text-[34px]"
                >
                  <span className="sm:hidden">Encontramos você nestas fotos.</span>
                  <span className="hidden sm:inline">
                    Estas são as fotos em que encontramos você.
                  </span>
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-(--campaign-muted)">
                  <span className="sm:hidden">
                    Só registros públicos aprovados, sem nomes de terceiros.
                  </span>
                  <span className="hidden sm:inline">
                    Mostramos apenas registros públicos aprovados. Não exibimos nomes de outras
                    pessoas nem nota de semelhança.
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => startSelfieStep('search')}
                className={`${ARCHIVE_PHOTO_SECONDARY_BUTTON} shrink-0`}
              >
                Usar outra selfie
              </button>
            </div>
            <div className="mt-7 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-7">
              {step.photos.map((photo) => (
                <SelfieSearchResultCard key={photo.id} photo={photo} />
              ))}
            </div>
            <PresenceBand onManage={() => setStep({ kind: 'presence' })} />
          </div>
        </section>
      ) : null}

      {step.kind === 'empty' ? (
        <FlowStateCard
          icon={<ImageIcon aria-hidden="true" className="size-7" strokeWidth={2} />}
          title="Não encontramos fotos suas"
          body="Esta busca funciona para quem autorizou participar do índice. Também pode não haver uma foto sua entre os registros públicos aprovados."
          note="Não mostramos pessoas parecidas nem tentamos adivinhar quem você é."
          action={
            <button
              type="button"
              onClick={() => startSelfieStep('search')}
              className={`${ARCHIVE_PHOTO_PRIMARY_BUTTON} w-full sm:min-w-44`}
            >
              Tentar outra foto
            </button>
          }
          secondary={
            <Link href={ARCHIVE_PHOTO_ALBUM_PATH} className={STATE_LINK}>
              Voltar ao álbum
            </Link>
          }
        />
      ) : null}

      {step.kind === 'no-face' ? (
        <FlowStateCard
          icon={<TriangleAlert aria-hidden="true" className="size-7" strokeWidth={2} />}
          tone="danger"
          title="Não encontramos um rosto nesta selfie"
          body="Escolha uma foto de frente, com o rosto bem iluminado e sem outras pessoas na imagem."
          note="Nenhuma imagem foi enviada."
          action={
            <button
              type="button"
              onClick={() => startSelfieStep('search')}
              className={`${ARCHIVE_PHOTO_PRIMARY_BUTTON} w-full sm:min-w-44`}
            >
              Escolher outra foto
            </button>
          }
          secondary={
            <Link href={ARCHIVE_PHOTO_ALBUM_PATH} className={STATE_LINK}>
              Voltar ao álbum
            </Link>
          }
        />
      ) : null}

      {step.kind === 'presence' ? (
        <section
          ref={presenceRef}
          tabIndex={-1}
          aria-labelledby="selfie-presence-title"
          className={`${STEP_SHELL} rounded-2xl border border-(--campaign-line) bg-white p-6 focus:outline-none sm:p-7`}
        >
          <p className="text-xs font-black tracking-[0.08em] text-[#184e92] uppercase">
            Privacidade
          </p>
          <h2
            id="selfie-presence-title"
            className="mt-1 border-0 pb-0 font-[family-name:var(--font-exo2)] text-2xl font-black"
          >
            Você decide se quer aparecer
          </h2>
          <p className="mt-2 text-sm leading-6 text-(--campaign-muted)">
            Para sair do índice, confirme sua identidade com uma selfie. Para retirar uma foto
            pública, use o canal da equipe responsável pelo acervo.
          </p>
          <div className="mt-5 flex gap-3 rounded-xl border-2 border-[#184e92] bg-[#f9faff] p-4">
            <span
              aria-hidden="true"
              className="mt-0.5 size-5 shrink-0 rounded-full border-[5px] border-[#184e92]"
            />
            <span>
              <b className="text-sm">Sair do índice de busca</b>
              <small className="mt-1 block text-xs leading-5 text-(--campaign-muted)">
                Seu rosto deixa de ser usado para localizar fotos por selfie.
              </small>
            </span>
          </div>
          {removalChannelUrl ? (
            <a
              href={removalChannelUrl}
              className={`${ARCHIVE_PHOTO_SECONDARY_BUTTON} mt-3 w-full items-start justify-between p-4 text-left`}
            >
              <span>
                <b className="text-sm">Pedir remoção de uma foto</b>
                <small className="mt-1 block text-xs leading-5 text-(--campaign-muted)">
                  Abre o canal configurado pela equipe responsável pelo acervo.
                </small>
              </span>
              <ChevronLeft aria-hidden="true" className="mt-0.5 size-4 shrink-0 rotate-180" />
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => startSelfieStep('leave-index')}
            className={`${ARCHIVE_PHOTO_PRIMARY_BUTTON} mt-6 w-full`}
          >
            Continuar
          </button>
          <button
            type="button"
            onClick={reset}
            className={`mt-4 block w-full text-center text-sm font-bold text-(--campaign-muted) ${ARCHIVE_PHOTO_FOCUS}`}
          >
            Cancelar
          </button>
        </section>
      ) : null}

      {step.kind === 'removed' ? (
        <FlowStateCard
          icon={<ShieldCheck aria-hidden="true" className="size-7" strokeWidth={2} />}
          title="Pronto — você saiu do índice"
          body="Seu rosto deixou de ser usado para localizar fotos por selfie e o vetor foi apagado."
          note="Se quiser voltar a participar, fale com a equipe responsável pelo acervo."
          action={
            <Link
              href={ARCHIVE_PHOTO_ALBUM_PATH}
              className={`${ARCHIVE_PHOTO_PRIMARY_BUTTON} w-full sm:min-w-44`}
            >
              Voltar ao álbum
            </Link>
          }
        />
      ) : null}

      {step.kind === 'presence-missing' ? (
        <FlowStateCard
          icon={<ShieldCheck aria-hidden="true" className="size-7" strokeWidth={2} />}
          title="Não encontramos sua presença no índice"
          body="Não foi possível reconhecer uma participação sua no índice com esta selfie. Nenhuma alteração foi feita."
          action={
            <button
              type="button"
              onClick={() => startSelfieStep('leave-index')}
              className={`${ARCHIVE_PHOTO_PRIMARY_BUTTON} w-full sm:min-w-44`}
            >
              Tentar outra selfie
            </button>
          }
          secondary={
            <>
              <p className="text-sm leading-6 text-(--campaign-muted)">
                Quer retirar uma foto pública mesmo assim?
              </p>
              {removalChannelUrl ? (
                <a
                  href={removalChannelUrl}
                  className={`${ARCHIVE_PHOTO_SECONDARY_BUTTON} mt-3 w-full`}
                >
                  Pedir remoção de uma foto
                </a>
              ) : null}
              <Link href={ARCHIVE_PHOTO_ALBUM_PATH} className={`${STATE_LINK} mt-4`}>
                Voltar ao álbum
              </Link>
            </>
          }
        />
      ) : null}

      {step.kind === 'unsupported' ? (
        <FlowStateCard
          icon={<Smartphone aria-hidden="true" className="size-7" strokeWidth={2} />}
          title="Este navegador não consegue fazer a busca por selfie"
          body="Para proteger sua imagem, o reconhecimento precisa rodar neste aparelho. Este navegador não oferece os recursos necessários."
          note="O problema não é com a sua selfie. Nenhuma imagem foi enviada."
          action={
            <Link
              href={ARCHIVE_PHOTO_ALBUM_PATH}
              className={`${ARCHIVE_PHOTO_PRIMARY_BUTTON} w-full sm:min-w-44`}
            >
              Voltar ao álbum
            </Link>
          }
          secondary={
            <p className="text-xs leading-5 text-(--campaign-muted)">
              Você pode tentar novamente em outro navegador ou aparelho compatível.
            </p>
          }
        />
      ) : null}

      {step.kind === 'engine-error' ? (
        <FlowStateCard
          icon={<TriangleAlert aria-hidden="true" className="size-7" strokeWidth={2} />}
          tone="danger"
          title="Não foi possível processar a busca"
          body="O reconhecimento neste aparelho parou antes de concluir. Sua selfie não foi enviada nem guardada."
          action={
            <button
              type="button"
              onClick={() => startSelfieStep('search')}
              className={`${ARCHIVE_PHOTO_PRIMARY_BUTTON} w-full sm:min-w-44`}
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              Tentar novamente
            </button>
          }
          secondary={
            <Link href={ARCHIVE_PHOTO_ALBUM_PATH} className={`${STATE_LINK} mt-4`}>
              Voltar ao álbum
            </Link>
          }
        />
      ) : null}

      {step.kind === 'rate-limited' ? (
        <FlowStateCard
          icon={<Clock aria-hidden="true" className="size-7" strokeWidth={2} />}
          tone="warn"
          title="Muitas tentativas em pouco tempo"
          body="Para proteger este recurso, a busca foi pausada por alguns minutos."
          note="Espere alguns minutos antes de tentar novamente."
          action={
            <Link
              href={ARCHIVE_PHOTO_ALBUM_PATH}
              className={`${ARCHIVE_PHOTO_PRIMARY_BUTTON} w-full sm:min-w-44`}
            >
              Voltar ao álbum
            </Link>
          }
        />
      ) : null}

      {step.kind === 'network' ? (
        <FlowStateCard
          icon={<WifiOff aria-hidden="true" className="size-7" strokeWidth={2} />}
          title="Não foi possível enviar a busca"
          body="A conexão falhou ao enviar somente os dados necessários para procurar as fotos. Sua selfie continua neste aparelho."
          action={
            <button
              type="button"
              onClick={() => runSearch(activeIntent)}
              className={`${ARCHIVE_PHOTO_PRIMARY_BUTTON} w-full sm:min-w-44`}
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              Tentar enviar novamente
            </button>
          }
          secondary={
            <Link href={ARCHIVE_PHOTO_ALBUM_PATH} className={`${STATE_LINK} mt-4`}>
              Voltar ao álbum
            </Link>
          }
        />
      ) : null}

      {step.kind === 'closed' ? <SelfieSearchClosed /> : null}

      {step.kind === 'confirm-leave' ? (
        <LeaveConfirmDialog
          onConfirm={() => runSearch('leave-index')}
          onCancel={() => setStep({ kind: 'presence' })}
        />
      ) : null}
    </div>
  )
}

const STATE_LINK = `inline-flex min-h-11 items-center text-sm font-bold text-[#184e92] underline underline-offset-4 ${ARCHIVE_PHOTO_FOCUS}`

const StepDots = ({ current }: { current: 2 }) => (
  <div aria-hidden="true" className="flex items-center gap-2">
    {[1, 2, 3].map((position) => (
      <span
        key={position}
        className={`h-1.5 flex-1 rounded-full ${position <= current ? 'bg-[#184e92]' : 'bg-black/15'}`}
      />
    ))}
  </div>
)

const PresenceBand = ({ onManage }: { onManage: () => void }) => (
  <div className="mt-10 flex flex-col items-start justify-between gap-3 rounded-xl bg-(--campaign-cream) p-5 sm:flex-row sm:items-center">
    <div>
      <p className="font-extrabold">Quer controlar sua presença no álbum?</p>
      <p className="mt-1 text-sm text-(--campaign-muted)">
        Saia do índice ou peça a remoção de uma foto.
      </p>
    </div>
    <button type="button" onClick={onManage} className={`${STATE_LINK} shrink-0`}>
      Gerenciar minha presença
    </button>
  </div>
)

/**
 * The shared terminal-state card (artefato: cenas 06/09–13): the icon circle,
 * the honest title/body and the single primary action. `tone` only changes the
 * icon palette — hierarchy and spacing stay identical across states.
 */
const FlowStateCard = ({
  icon,
  tone = 'info',
  title,
  body,
  note,
  action,
  secondary,
}: {
  icon: ReactNode
  tone?: 'info' | 'danger' | 'warn'
  title: string
  body: string
  note?: string
  action: ReactNode
  secondary?: ReactNode
}) => {
  const sectionRef = useRef<HTMLElement>(null)
  useEffect(() => {
    sectionRef.current?.scrollIntoView({ block: 'start' })
    sectionRef.current?.focus()
  }, [])

  const toneClass =
    tone === 'danger'
      ? 'bg-red-50 text-[#b42318]'
      : tone === 'warn'
        ? 'bg-amber-50 text-amber-800'
        : 'bg-[#eef4fb] text-[#184e92]'

  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      className={`${STEP_SHELL} flex min-h-[560px] flex-col items-center justify-center rounded-2xl border border-(--campaign-line) bg-white px-6 py-12 text-center focus:outline-none`}
    >
      <div className={`grid size-14 place-items-center rounded-full ${toneClass}`}>{icon}</div>
      <h2 className="mt-5 border-0 pb-0 font-[family-name:var(--font-exo2)] text-2xl font-black text-balance">
        {title}
      </h2>
      <p className="mt-2 max-w-[340px] text-sm leading-6 text-(--campaign-muted)">{body}</p>
      {note ? <p className="mt-3 max-w-[340px] text-sm font-bold">{note}</p> : null}
      <div className="mt-7 w-full max-w-sm">{action}</div>
      {secondary ? <div className="mt-4 w-full max-w-sm">{secondary}</div> : null}
    </section>
  )
}

/**
 * The opt-out confirmation (artefato: cena 08, segundo quadro) — a real dialog:
 * the destructive action asks once, Esc and the backdrop cancel, Tab stays
 * inside, and focus starts on the cancel action so an accidental Enter never
 * erases the index entry.
 */
const LeaveConfirmDialog = ({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
}) => {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel

  useEffect(() => {
    cancelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCancelRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (!focusables || focusables.length === 0) return
      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="selfie-leave-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <button
        type="button"
        aria-label="Fechar sem alterar"
        tabIndex={-1}
        onClick={onCancel}
        className="absolute inset-0 cursor-default bg-[#171412]/55 backdrop-blur-[2px]"
      />
      <div className="relative w-full max-w-[420px] rounded-2xl border border-(--campaign-line) bg-white p-5 shadow-[0_24px_70px_rgb(0_0_0/28%)]">
        <div className="grid size-11 place-items-center rounded-full bg-red-50 text-[#b42318]">
          <Trash2 aria-hidden="true" className="size-5" strokeWidth={2} />
        </div>
        <h2
          id="selfie-leave-title"
          className="mt-4 border-0 pb-0 font-[family-name:var(--font-exo2)] text-xl font-black"
        >
          Confirmar saída do índice?
        </h2>
        <p className="mt-2 text-sm leading-6 text-(--campaign-muted)">
          Vamos reconhecer você neste aparelho e, se houver correspondência, retirar sua presença do
          índice de busca.
        </p>
        <button
          type="button"
          onClick={onConfirm}
          className={`mt-6 flex min-h-11 w-full items-center justify-center rounded-[10px] bg-[#b42318] px-4 font-[family-name:var(--font-exo2)] text-sm font-extrabold text-white ${ARCHIVE_PHOTO_FOCUS}`}
        >
          Confirmar saída do índice
        </button>
        <button
          ref={cancelRef}
          type="button"
          onClick={onCancel}
          className={`mt-3 flex min-h-11 w-full items-center justify-center text-sm font-bold text-(--campaign-muted) ${ARCHIVE_PHOTO_FOCUS}`}
        >
          Voltar sem alterar
        </button>
      </div>
    </div>
  )
}
