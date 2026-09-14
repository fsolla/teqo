# Acervo de falas: player resolve o trecho sob demanda e YouTube vira default quando existe

Status: plano — registrado (blocked até plano em main)
Atualizado em: 2026-09-14
Issue: #999
Priority: P1
Impeccable: B — encaixe no detalhe do acervo (player + ações)
Rascunho UI: docs/plans/acervo-vod-sob-demanda-ui-draft.html
Appetite: ~1,5–2 dias eng; um outcome verificável — com o CDN da Câmara vazio, abrir uma fala ainda toca (YouTube quando houver) e "Baixar" nunca entrega arquivo inexistente
Responsável: —

## Intenção

O acervo guarda o link do MP4 do trecho ("vídeo sob demanda") que a própria Câmara gera — e apaga. Medido em 2026-09-14: entre 04:35 e 08:05 o CDN derrubou os 924 MP4s do acervo, a página do evento da Câmara falha no mesmo URL, o endpoint de download responde "Não existe o arquivo …" e um probe Range dá 403/timeout. Não é regressão do C160 (que só tocou `officialTextUrl`): o link gravado sempre foi efêmero — o banco é cache, não fonte da verdade. O detalhe da fala precisa tocar e baixar mesmo assim: o player passa a usar o YouTube da sessão (estável, presente em 802 das 997 falas) quando existir e a resolver o trecho exato sob demanda na API da Câmara no clique; o "Baixar" só entrega arquivo verificado. Sem espelhar MP4 no S3.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação da campanha (vertical `/campanha/comunicacao`; communicator, coordenação e candidatura), no escritório ou em campo, montando peça com prazo curto.
- **Job principal:** assistir e baixar o trecho exato de uma fala do acervo, confiando que o vídeo/arquivo existe — mesmo quando o link gravado já morreu.
- **Fluxo desejado:** abre a fala → o player toca (YouTube da sessão quando existe; senão, um clique resolve o VOD na Câmara) → clica na transcrição e vai ao ponto exato → "Baixar vídeo (MP4)" resolve e só entrega arquivo verificado → "Abrir fonte" segue para o Diário (C160).
- **Anti-goals de produto:** segundo player/editor; espelhar ou transcodificar MP4; regenerar os 924 em lote; ajustar o trecho por vizinhança; expor o acervo fora de `/campanha`; novo `Consent`/collection.

### Esboço de fluxo (B/C/D)

```text
[abre a fala] → YouTube (default quando existe) | capa "resolver trecho" (só VOD)
→ clique em assistir/baixar → "Resolvendo o trecho na Câmara…"
→ PRONTO → player nativo no trecho (segmentos 0-based) | no YouTube, seek = offset + segmento
→ "Baixar" → arquivo verificado | falha → estado honesto + "Abrir fonte"
```

### Rascunho UI (B/C/D)

- Rascunho UI (gate): `docs/plans/acervo-vod-sob-demanda-ui-draft.html` — cenas desktop e mobile do detalhe, resolvendo, indisponível e VOD nativo.

## Objetivo e aceite

- **Com ambos (773 falas):** o detalhe toca a sessão no YouTube no load (sem chamada à Câmara no render); "Baixar vídeo (MP4)" resolve o trecho exato na Câmara no clique e só entrega arquivo verificado.
- **Só VOD (151):** o player oferece resolver o trecho no clique; `PRONTO` → player nativo como hoje; `GERANDO` → pendência visível (com limite; convite a tentar de novo, sem travar a página); `INDISPONIVEL`/`PRONTO` com hash morto → estado honesto, nunca arquivo morto.
- **Só YouTube (29):** player embed; sem botão de MP4 (não há arquivo) — "Abrir fonte" cobre.
- **Nenhum (44):** bloco "vídeo indisponível neste momento" + "Abrir fonte" quando houver (PDF do Diário do C160).
- A resolução usa `excerptTMs` verbatim (nunca arredonda/ajusta); clique na transcrição com YouTube posiciona somando o offset da sessão — nunca cai em outro orador.
- O "Baixar" direto do card da lista (mesmo link efêmero) sai; o download passa a ser do detalhe, que resolve e verifica no clique.
- **Guardrails:** link do banco é cache (pode ser atualizado ou ignorado; nunca requisito — render não chama a Câmara); resolução só no clique; crédito "Fonte: Câmara dos Deputados · CC BY 4.0" mantido; gate do acervo vale para a resolução; URLs públicas do acervo intocadas; sem S3/espelho, sem novo consent/collection.

## Dados (intenção)

- **Vou apresentar dados?** Não — a superfície é player + ações; nenhum KPI/gráfico novo.
- **Decisões desbloqueadas:** a assessoria decide cortar/usar o trecho sem arriscar arquivo morto; a coordenação decide, pelo uso, se o download continua no card da lista.
- **Forma:** _adiada ao plano de implementação_ — restrição: o estado "resolvendo/indisponível" é feedback de ação, não dado de acervo.

## Dados da decisão (literais)

- **API (resolução sob demanda):** `https://www.camara.leg.br/evento-legislativo/{eventId}/video-sob-demanda?idAudio={audioId}&trecho={excerptTMs}` → `{ estado: 'GERANDO' | 'PRONTO' | 'INDISPONIVEL', video: { linkParaReproducao, linkParaDownload, duracao, titulo } }`.
- **Trecho exato:** `trecho` = `excerptTMs` do banco (epoch ms); valor vizinho cai em outro orador — nunca alterar. Elegibilidade para tentar a Câmara: ter `eventId` + `audioId` + `excerptTMs` **e** VOD armazenado (ambos/só VOD); sem VOD armazenado, não tentar (o cache orienta a oferta, não a verdade do arquivo).
- **Offset no YouTube:** `excerptTMs` (epoch ms) → hora BRT (`Intl`, America/Sao_Paulo) − `eventStartAt` (naive); ex.: `1786473834650` = 15:43:54 BRT, sessão 15:00 → 43m54s (2634 s). Segmentos ASR são 0-based no MP4 do trecho: no VOD, seek direto; no YouTube, seek = offset + `startSeconds`.
- **Quadrantes (997 falas, 2026-09-14):** 773 ambos · 151 só VOD · 29 só YouTube · 44 nenhum; o CDN apagou os 924 MP4s entre 04:35 e 08:05.
- **Regeneração observada:** ausente → `GERANDO` → `PRONTO` com hash novo (arquivo responde 206 `video/mp4`); `PRONTO` velho pode devolver hash morto e não aceita forçar (id 996) → tratar como indisponível.
- **Default de produto:** YouTube quando existir; VOD da Câmara sob demanda para o trecho exato/download. Crédito mantido: `Fonte: Câmara dos Deputados · CC BY 4.0`.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/speech/SpeechDetailPlayer.tsx` (player + transcrição); `src/utilities/speech/` (resolução VOD server-side); `src/app/(campaign)/campanha/(app)/comunicacao/acervo/[id]/page.tsx` + `speechPageData.ts`/`speechViewModels.ts` (levar `eventId`/`audioId`/`excerptTMs`/`eventStartAt` ao view — hoje não chegam); `src/app/(campaign)/campanha/actions/` ou rota JSON com `campaignJsonMutationRoute`; `SpeechResultCard.tsx` (se o "Baixar" da lista sair).
- **Precedente a olhar:** fetch externo com timeout em `src/utilities/speech/speechClassifier.ts:89-105` e `src/utilities/googleCalendarClient.ts:32`; pendência com `useActionState` em `src/components/campaign/advisor/AdvisorPasswordResetButton.tsx`; embed `youtube-nocookie` em `src/components/CampaignStorySection.tsx:54-61`; ladder `getCampaignActionContext` + `runCampaignFormAction`; e2e `tests/e2e/campaignSpeechAcervo.e2e.spec.ts` (contrato `<video>`, "Baixar vídeo (MP4)", "Abrir fonte", "VOD indisponível" — renegociar no item).
- **Risco de acoplamento:** `resolveVod`/`probeLink`/`buildVodUrl`/`parseVodStatus` vivem em `scripts/lib/camara*.mjs` e **não são importáveis de `src/`** (extrair para dono único é decisão do plano de implementação); escrita no `speech` exige `canUpdateSpeech` (unrestricted/admin) — persistir o link novo é cache opcional e não pode ampliar a escrita; o manifest de e2e mapeia `src/utilities/speech`/`src/components/campaign/speech`/`comunicacao` → `campaignSpeechAcervo`; gate `speechCatalog` vale para a resolução.

## Dependências

- Entregues (duras, satisfeitas): C153/C154/C155 (acervo em produção, 997 falas), C160 ("Abrir fonte" = PDF oficial do Diário).
- Nenhuma dependência bloqueante.

## Fora de escopo

- Espelhar/re-hospedar MP4 (S3/Garage) e transcodificar.
- Regenerar os 924 em lote / botão manual "gerar novamente" / verificação em background e cron.
- Editor/corte no browser, favoritos/curadoria, segundo player, download em lote.
- Busca/filtros e "Abrir fonte" (C160 entregue); exposição pública do acervo.
- Redesenhar detalhe/lista além da saída do "Baixar" do card.
- Migration/collection/`Consent` novos; tornar o link do banco obrigatório.

## Rabbit holes de produto

- **Re-hospedar MP4 no S3.** Se alguém "só completar": storage, custo, retenção e direitos. **Corte neste item:** link sob demanda da Câmara, sem espelho.
- **Botão "gerar novamente" manual.** Se alguém "só completar": fila de render e suporte a estado assíncrono na tela. **Corte neste item:** a resolução é implícita no clique (assistir/baixar) e o estado explica a espera.
- **Sincronizar/cachear todo link regenerado.** Se alguém "só completar": cron, reconciliation e novas escritas. **Corte neste item:** o banco continua "último conhecido", opcional e não confiável.
- **Redescobrir o trecho por vizinhança quando o exato falha.** Se alguém "só completar": muda o orador (fato medido). **Corte neste item:** nunca alterar o `trecho`; falha → estado honesto + fonte.

## Questões em aberto (produto)

- **Player default com ambos?** **Opções:** A) YouTube sempre que existir | B) VOD sob demanda primeiro, YouTube como fallback. **Recomendação:** A — sinalizado pelo humano; o CDN é efêmero e o YouTube é estável, e o trecho exato segue alcançável (transcrição com offset + MP4 sob demanda). _(assumido — validar no gate)_
- **"Baixar" quando só houver YouTube?** **Opções:** A) ocultar o MP4 | B) oferecer "abrir no YouTube". **Recomendação:** A — nada de arquivo inexistente; "Abrir fonte" já leva à fonte. _(assumido)_
- **Clique na transcrição com YouTube?** **Opções:** A) somar offset via IFrame API | B) desabilitar seek | C) link com `t=`. **Recomendação:** A — mantém o clique do C154; se a implementação do IFrame API não couber no appetite, C é a degradação aceitável; B é regressão. _(assumido)_

## Referências

- GitHub Issue: #999
- Rascunho UI (gate): `docs/plans/acervo-vod-sob-demanda-ui-draft.html`
- Planos irmãos: `acervo-abrir-fonte-pdf-oficial.md` (C160), `acervo-videos-comunicacao.md` (C154), `backfill-acervo-falas.md` (C155), `catalogo-falas-solla.md` (C153)
- Arquivos-chave: `src/components/campaign/speech/SpeechDetailPlayer.tsx`, `src/components/campaign/speech/SpeechResultCard.tsx`, `src/utilities/speech/speechPageData.ts`, `src/utilities/speech/speechViewModels.ts`, `src/app/(campaign)/campanha/(app)/comunicacao/acervo/[id]/page.tsx`, `scripts/lib/camaraFetch.mjs`, `scripts/lib/camaraSpeeches.mjs` (referência, não importável), `tests/e2e/campaignSpeechAcervo.e2e.spec.ts`
- `AGENTS.md` / `AGENTS-campaign.md` — vertical Comunicação, gate do acervo e crédito CC BY.

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (abrir a fala toca e baixar nunca entrega arquivo morto, com o CDN da Câmara vazio); (2) cabe no appetite de ~1,5–2 dias (comportamento + estados + testes, sem schema); (3) persona, job e aceite legíveis sem jargão de stack; (4) direção no codebase é hipótese (áreas, precedentes e o alerta de que os helpers do VOD nos scripts não são importáveis); (5) zero decisão dura de engenharia no plano (rota, fetch, persistência e extração de helper ficam para o plano de implementação).
