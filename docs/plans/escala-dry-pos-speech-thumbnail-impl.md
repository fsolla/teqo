# Impl: Helper único da URL do thumbnail do YouTube (hqdefault)

Status: aprovado (modo `--auto`)
Atualizado em: 2026-09-17
Issue: #1093
Intenção: docs/plans/escala-dry-pos-speech-thumbnail.md
Appetite restante: herdado (~1 h eng)

## Leitura da intenção

- **Outcome:** eliminar a duplicação do literal `https://i.ytimg.com/vi/<id>/hqdefault.jpg` nos 4 módulos, consumindo um helper único.
- **O que NÃO negociar:** manter o comportamento atual (host/formato/sufixo); sem mudança visual.
- **O que reavaliar:** o plano de intenção nomeia `src/lib/speechShare.ts` como dono. **Esse pressuposto ficou stale**: o C175 (#1085, 2026-09-16 12:36) já criou `youtubeThumbnailUrl` em `src/lib/speechVod.ts` — o módulo que já expõe `parseYoutubeVideoId`, logo o dono natural do par id→cover.

## Abordagem recomendada

- **A (Recomendada, adotada):** reusar o `youtubeThumbnailUrl` existente em `src/lib/speechVod.ts` e consumi-lo nos 4 pontos duplicados.
- **B (Rejeitada):** criar `youtubeThumbnailUrl` também em `src/lib/speechShare.ts` (como escrito no plano de intenção). Rejeitada por AGENTS/engineering-standards — "edit the owner, don't twin": seria uma segunda implementação idêntica do mesmo conhecimento, exatamente o drift que a Issue quer eliminar.
- **C (Rejeitada):** criar um arquivo novo `src/lib/youtube-helpers.ts`. Rejeitada pelo mesmo motivo (twin de `speechVod.ts`).
- **D (Rejeitada):** manter a duplicação e documentar. Rejeitada: risco de drift silencioso (host/CSP).

### Componentes / mudanças

- `src/lib/speechVod.ts`: **nenhuma mudança de código** — `youtubeThumbnailUrl(videoId)` (C175) e `speechCoverUrl(youtubeUrl)` (C182, composição id→cover) já existem e são os donos únicos.
- `SpeechDetailPlayer.tsx`, `SpeechCutPlayer.tsx`, `SpeechCutResultCard.tsx` (têm o video id): consumir `youtubeThumbnailUrl`.
- `src/app/(frontend)/corte/[id]/page.tsx` (tem a URL crua): consumir `speechCoverUrl` — o mesmo helper que o view model da listagem e a rota de poster do C182 já usam.
- **Migration:** nenhuma (código puro).
- **Access / Consent:** não aplicável.
- **UI:** Impeccable A — sem superfície visual nova; crítica do `designer` (trigger c) não se aplica (non-trigger: port mecânico do literal).

## Fases verificáveis

1. **Consumir** — substituir os 4 literais por `youtubeThumbnailUrl(...)`.
2. **Gates** — `pnpm gate:fast`; entrega via `pnpm push`.

## Rabbit holes / Não escopo (engenharia)

- Refatorar o markup duplicado do bloco de saída (`renderYoutubeExit`, 2 ramos) — defer até 3ª variante/superfície.
- Unificar imagem de capa/posters além do helper.
- Migrar o host do thumbnail ou adicionar fallback de imagem.
- Criar um `youtubeThumbnailUrlFromUrl` novo: o C182 já resolveu essa composição com `speechCoverUrl` (2 call sites + o corte/[id]); reusar, não duplicar.

## Riscos e mitigação

- **Risco:** conflito de merge com C172. **Status:** C172 já está em `main` (merge 4b3bee7c); risco consumido.
- **Risco:** quebra de pins que assertam a URL. **Mitigação:** verificado — os pins existentes (`speechVod.unit.spec.ts`, `speechViewModels.unit.spec.ts`, `speechAcervo.int.spec.ts`, e2e de acervo/corte) assertam o literal final, que não muda.

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto (literal único nos 4 pontos)
- [x] Invariantes AGENTS/engineering-standards (dono único; sem twin)
- [x] Testes de domínio: helper puro já coberto no unit do C175; consumidores cobertos por int/e2e da mesma superfície
