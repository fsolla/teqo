# Escala DRY: helper único da URL do thumbnail do YouTube

Status: rascunho
Atualizado em: 2026-09-16
Issue: a registrar — C179
Priority: P3
Impeccable: A — sem superfície nova (só extração de literal)
Appetite: ~1 h eng; em fill-in, sem schema/URL pública
Depende de: #1082 (C172) — o dono natural do helper é `src/lib/speechShare.ts`, que C172 edita; destrava sozinha quando o C172 flipar `done`.

## Intenção

O literal `https://i.ytimg.com/vi/<id>/hqdefault.jpg` está repetido em 4 módulos — `SpeechDetailPlayer.tsx` (capa C178), `SpeechCutPlayer.tsx`, `SpeechCutResultCard.tsx` e `src/app/(frontend)/corte/[id]/page.tsx`. É o mesmo conhecimento (host + formato + sufixo) copiado 4×, com risco de drift silencioso (ex.: troca de host/CSP). O dono natural é `src/lib/speechShare.ts`, que já expõe o contrato do link externo do YouTube.

## Fases verificáveis

1. **Extrair + consumir** — adicionar `youtubeThumbnailUrl(videoId: string): string` em `src/lib/speechShare.ts` e usá-lo nos 4 pontos. Unit do helper (id normal, id vazio/whitespace) e ajuste dos pins que assertam a URL.
2. **Gates** — `pnpm gate:fast`; entrega via `work-issue` (sem migration, sem UI nova).

## Já resolvido no simplify/critique (não reabrir)

- A duplicação do literal **não** foi extraída no C178 de propósito: `src/lib/speechShare.ts` está sendo editado pelo C172 em worktree paralelo (rebase/conflict). Esta Issue existe justamente para não perder o achado.

## Explicitamente fora

- Unificar imagem de capa/posters além do helper (sem mudança visual).
- Migrar o host do thumbnail ou adicionar fallback de imagem (comportamento atual mantido).
- Defer do C178: a duplicação do markup do bloco de saída (`renderYoutubeExit`, 2 ramos) só revisita com uma **3ª variante/superfície de saída** ou reuso fora do `SpeechDetailPlayer`.

## Self-score (decisão)

4/5 — decisão barata de reverter, dono nomeado, depth check justificado (4 call sites), sem mudar comportamento, gate claro.
