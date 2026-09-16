# Acervo: preview do trecho na listagem de falas

Status: rascunho
Atualizado em: 2026-09-16
Issue: #1085
Priority: P2
Impeccable: B — encaixe no card da lista do acervo
Design UI: docs/plans/acervo-preview-do-trecho-na-listagem-ui-design.html
Appetite: ~0,5–1 dia eng; um outcome verificável — quem varre a lista reconhece o trecho pela imagem, sem abrir fala por fala
Responsável: —

## Intenção

A assessoria varre o acervo de falas (`/campanha/comunicacao/acervo`) buscando o trecho que serve a uma peça, mas hoje a lista é só texto, data e chips — cada fala é uma caixa cinza igual à seguinte. O pedido veio direto: mostrar na listagem um preview do trecho da fala quando houver vídeo, de preferência do meio do trecho. Isso devolve reconhecimento visual à varredura: quem já viu o vídeo bate o olho e lembra; quem não viu ganha uma dica de cena antes de abrir. É um encaixe pequeno no card existente, não uma área nova.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (jornalista/videomaker), no escritório ou em campo, com prazo curto, varrendo resultados de busca para escolher a fala que vira card/áudio/vídeo.
- **Job principal:** reconhecer o trecho certo na lista e decidir se abre a fala, sem abrir fala por fala.
- **Fluxo desejado:** busca/filtra → resultados com miniatura do trecho ao lado do excerto → reconhece a cena → "Assistir no trecho" abre o detalhe já no timestamp.
- **Anti-goals de produto:** player na lista; autoplay; extração de frame no servidor; espelhamento de thumbnails; segundo cadastro/Consent; mexer na busca ou no excerto.

### Esboço de fluxo (B)

```text
[busca/filtros] → resultado do acervo (texto + chips + MINIATURA do trecho)
→ reconhece a cena pela imagem → clique em "Assistir no trecho" → [outcome: peça escolhida sem abrir fala por fala]
```

### Design UI (B)

- Design UI (gate): `docs/plans/acervo-preview-do-trecho-na-listagem-ui-design.html` — cenas desktop (1280) e mobile (~390): card com miniatura à esquerda do excerto, placeholder quando a fala não tem vídeo, e o estado da busca com destaque de termo.

## Objetivo e aceite

- Cada card da lista do acervo mostra uma miniatura do trecho quando a fala tem vídeo do YouTube; sem vídeo, o card segue como hoje (sem espaço vazio reservado indevidamente).
- A miniatura reflete a fala/trecho daquele resultado: quando há termo buscado, prioriza a fala do segmento casado; sem termo, a fala padrão do card.
- **Guardrail (limitação honesta):** não existe frame arbitrário "do meio do trecho" — o YouTube só oferece o conjunto padrão de thumbnails por vídeo. "Meio do trecho" é resolvido como a melhor miniatura disponível da fala, nunca um frame seekado. O plano de implementação escolhe a variante; a UI não promete precisão que o dado não tem.
- **Guardrail (performance):** imagens pequenas, carregamento preguiçoso, sem mudança de layout ao carregar; a lista não pode ficar mais lenta nem "pular".
- **Guardrail (LGPD/escopo):** nada novo de Consent; não expor nada além do que a fala já expõe na lista.

## Dados (intenção)

- **Vou apresentar dados?** Não — a miniatura não desbloqueia decisão numérica nem é métrica; é reconhecimento visual. Nenhum agregado novo nasce aqui.
- **Decisões desbloqueadas:** a assessoria escolhe qual fala abrir mais rápido, pelo reconhecimento da cena.
- **Forma:** _adiada ao plano de implementação_ — aqui só a restrição de produto: nada de dashboard/contagem nova.

## Dados da decisão (literais)

- **Forma da URL da miniatura:** `https://i.ytimg.com/vi/<videoId>/<variante>.jpg` — mesma família já usada em `SpeechCutResultCard.tsx` e `src/app/(frontend)/corte/[id]/page.tsx`.
- **Variantes candidatas:** `hqdefault.jpg` (480×360, sempre existe, com barras em vídeo 16:9) e `mqdefault.jpg` (320×180, enquadramento 16:9). Decisão final no plano de implementação; a UI usa `object-cover`.
- **Tamanho/estilo de referência:** `h-20 w-32 rounded-lg border object-cover` (precedente no card de cortes) — pequeno, sem dominar o card.
- **`videoId`:** obtido de `youtubeUrl` via `parseYoutubeVideoId` (`src/lib/speechVod.ts`).
- **Sem vídeo:** nenhuma imagem; placeholder neutro (ex.: ícone) ou card sem espaço de mídia — não inventar imagem.
- **Regra "meio do trecho":** usar a miniatura padrão do vídeo da fala; não há seek. Se houver múltiplas falas no card, usar a do segmento casado.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/utilities/speech/speechViewModels.ts` (novo campo de miniatura no `SpeechListItemViewModel`, reaproveitando `matchedSegment`/`pickMatchingSegment` e `parseYoutubeVideoId`), `src/components/campaign/speech/SpeechResultCard.tsx` (encaixe no layout), `src/lib/speechVod.ts` (reuso do parser de id).
- **Precedente a olhar:** `SpeechCutResultCard.tsx` (miniatura + texto), `src/app/(frontend)/corte/[id]/page.tsx`.
- **Risco de acoplamento:** a lista é usada por busca com destaque (`matchKind`) — não alterar o excerto/highlight; nada que exponha dado que o `communicator` já não vê; leader lockdown intocado.

## Dependências

- Nenhuma dura. Precedentes já entregues: C154 (view models da lista) e C162 (player/denormalização de `youtubeUrl`). Sem `youtubeUrl` no registro, o card simplesmente não mostra preview.

## Fora de escopo

- Player, autoplay ou hover-play na lista (destino: nenhum — anti-goal).
- Extração/render de frame no servidor, ffmpeg, fila de processamento (destino: nenhum).
- Espelhamento de thumbnails em S3/bucket (destino: nenhum).
- Miniatura do VOD da Câmara quando não há YouTube (avaliar depois de uso real).
- Mudança de busca, excerto, facetas ou ordenação.

## Rabbit holes de produto

- **"Extrair o frame exato do meio do trecho."** Se alguém "só completar": pipeline de ffmpeg, storage, transcodificação e jobs. **Corte neste item:** miniatura padrão do YouTube; o "meio do trecho" é a melhor miniatura disponível, declarado no aceite.
- **"Preview em vídeo no hover."** Se alguém "só completar": embed de player, autoplay, banda e ruído na varredura. **Corte neste item:** imagem estática.
- **"Backfill/baixar todas as capas."** Se alguém "só completar": mirroring, reconciliação e custo de storage. **Corte neste item:** hotlink da capa do YouTube.

## Questões em aberto (produto)

- **Qual variante de thumbnail?** **Opções:** A) `hqdefault` (sempre disponível, mesma do card de cortes) | B) `mqdefault` (16:9, mais leve). **Recomendação:** A — consistência com o que já existe; `object-cover` corta as barras. _(assumido — validar com produto)_
- **Onde a miniatura senta no card?** **Opções:** A) à esquerda do excerto, em linha (precedente dos cortes) | B) faixa no topo do card. **Recomendação:** A — mantém a altura do card e o ritmo de varredura.
- **A miniatura é clicável?** **Opções:** A) decorativa (o CTA "Assistir no trecho" segue dono do clique) | B) leva ao mesmo `watchHref`. **Recomendação:** B — alvo maior sem criar ação nova.
- **Mostrar quando não há termo casado?** **Opções:** A) sim, sempre que houver vídeo (recomendado) | B) só em `matchKind === 'segment'`. **Recomendação:** A — reconhecimento vale em toda varredura.

## Referências

- GitHub Issue: #1085
- Design UI (gate): `docs/plans/acervo-preview-do-trecho-na-listagem-ui-design.html`
- `src/components/campaign/speech/SpeechResultCard.tsx` · `SpeechResultList.tsx` · `src/utilities/speech/speechViewModels.ts` · `src/lib/speechVod.ts`
- `docs/plans/acervo-videos-comunicacao.md` (vertical e aceite do acervo) · `src/app/(campaign)/campanha/(app)/comunicacao/acervo/page.tsx`
- `AGENTS.md` — convenções de UI da campanha e `data-theme='campaign'`

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (reconhecer o trecho pela imagem na varredura); (2) appetite ~0,5–1 dia, encaixe no card; (3) persona + job + aceite claros, com a limitação da miniatura declarada; (4) direção no codebase é hipótese; (5) zero decisão dura de engenharia.
