# Acervo: cortar o trecho [início,fim] e publicar o arquivo numa página compartilhável

Status: rascunho
Atualizado em: 2026-09-15
Issue: #1014
Priority: P1
Impeccable: C — fluxo novo no detalhe do acervo + superfície pública nova
Rascunho UI: docs/plans/c167-cortar-trecho-publicar-ui-draft.html
Appetite: ~2–3 dias eng; um outcome verificável — o corte [início,fim] exato sai salvo, tocável e baixável numa página pública compartilhável
Responsável: —

## Intenção

O link do YouTube posiciona no ponto, mas a peça exige o arquivo exato. Quem produz conteúdo escolhe um trecho da fala no acervo (C166) e hoje só consegue mandar o link da sessão com o tempo — para editar ou postar, garimpa o vídeo de novo e o trecho vem com o que vier antes e depois. Este item fecha o ciclo: da mesma seleção [início,fim], "Cortar vídeo" gera o arquivo exato, salva no servidor e publica uma página pública com player; o compartilhamento passa a ser por link (com preview no WhatsApp) ou baixando o arquivo. Título e descrição são gerados por IA no momento do corte — editáveis antes de confirmar — e o arquivo fica disponível para a biblioteca de cortes (C168).

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (communicator, coordenação e candidatura) na mesa, montando peça com prazo curto e com o acervo aberto.
- **Job principal:** transformar o trecho escolhido no arquivo exato [início,fim] e ter um link público para mandar no WhatsApp ou baixar.
- **Fluxo desejado:** abre a fala → seleciona o trecho (C166) → "Cortar vídeo" → título e descrição sugeridos pela IA (edita se quiser) → "Cortar e publicar" → "Preparando o corte…" → pronto: link público + Copiar + WhatsApp + Baixar arquivo; quem recebe abre `/corte/<id>` e assiste/baixa o mesmo arquivo.
- **Anti-goals de produto:** não é editor de vídeo; não aceita upload externo; não expõe transcrição nem internals no público; não cria segundo cadastro de pessoa nem `Consent`; não vira galeria pública indexável; não abre o acervo para quem não lê.

### Esboço de fluxo (C)

```text
[detalhe da fala] → seleção [início,fim] (C166) → "Cortar vídeo"
→ formulário: título/descrição IA (editáveis) + "Cortar e publicar"
→ "Preparando o corte…" (espera honesta; falhou → erro claro, nada publicado)
→ corte publicado: link /corte/<id> + Copiar + WhatsApp + Baixar MP4
→ quem recebe: player do arquivo exato + compartilhar/baixar (unlisted)
```

### Rascunho UI (C)

- Rascunho UI (gate): `docs/plans/c167-cortar-trecho-publicar-ui-draft.html` — cenas: formulário de corte com título/descrição IA editáveis; "Preparando o corte…"; erro honesto; sucesso no acervo (link + Copiar + WhatsApp + Baixar + preview); página pública desktop e mobile; corte despublicado/indisponível.

## Objetivo e aceite

- Da seleção [início,fim] do C166 (5–180 s), "Cortar vídeo" gera e salva o MP4 do trecho EXATO — começa e termina nos marcos escolhidos, sem aproximar keyframe.
- O corte nasce publicado: `/corte/<id>` toca esse mesmo arquivo e o download entrega o mesmo arquivo; o link funciona no WhatsApp com preview (título, descrição e imagem).
- Título e descrição vêm da IA em pt-BR (texto/contexto do trecho), pré-preenchidos e editáveis antes de confirmar; IA indisponível → fallback determinístico, sem bloquear a criação.
- Compartilhar = copiar link público + deep link WhatsApp + baixar arquivo; o mesmo arquivo é baixável direto para compartilhar fora do link.
- Kill switch: despublicar tira o corte do ar na hora (admin; toggle na página interna em C168); o id numérico sobrevive à troca de título.
- **Guardrails:** página pública não indexável (unlisted, só por link; `noindex`); sem transcrição/internals no público; crédito "Fonte: Câmara dos Deputados · CC BY 4.0"; corta quem lê o acervo (communicator/coordinator/candidate), advisor/leader negados fail-closed; falhou o corte, nada é publicado; sem upload externo/Consent/segundo cadastro.

## Dados (intenção)

- **Vou apresentar dados?** Não — a superfície é formulário, estados de progresso/erro e player público; nenhum KPI/gráfico novo.
- **Decisões desbloqueadas:** a assessoria decide qual trecho vira peça publicável e compartilha o arquivo exato sem depender do YouTube; a coordenação decide, em C168, o que continua no ar.
- **Forma:** _adiada ao plano de implementação_ — restrição: progresso/erro é feedback de ação, não dado de acervo.

## Dados da decisão (literais)

- Rota pública `/corte/<id>` — id numérico sequencial do corte, estável mesmo quando o título muda; enumerável por natureza (trade-off aceito: o conteúdo é fala pública do deputado, e despublicar remove o acesso). Estado do corte: `publicado` (público pelo link) | `despublicado` (link fora do ar) — nasce publicado ao confirmar; despublicar é o kill switch (admin; toggle na página interna em C168).
- Faixa da seleção: 5–180 s — a mesma do C166.
- Arquivo: MP4 do trecho EXATO [início,fim] — começa e termina nos marcos escolhidos (não aproximação de keyframe); salvo no servidor; o player público toca esse arquivo e o download entrega o mesmo arquivo.
- Título/descrição: IA em pt-BR (provider DeepSeek já existente no repo) a partir do texto do trecho/contexto do discurso; pré-preenchidos no formulário de corte e editáveis antes de confirmar; IA indisponível → fallback determinístico `Trecho de <tipo> — <data>` + resumo oficial do discurso, sem bloquear a criação.
- Open Graph (WhatsApp): título, descrição e imagem; quando a fala tem YouTube, usar a capa do YouTube da sessão como imagem. Página NÃO indexável (unlisted; só por link) e crédito `Fonte: Câmara dos Deputados · CC BY 4.0`.
- Compartilhar o corte: copiar link público + deep link WhatsApp (`wa.me/?text=`); baixar o arquivo. O arquivo também pode ser baixado direto para compartilhar.
- Quem corta: quem lê o acervo (communicator/coordinator/candidate); advisor/leader negados (fail-closed). Sem expor transcrição/internals na página pública; sem upload externo de vídeo; sem Consent; sem segundo cadastro de pessoa.

## Direção no codebase (hipótese)

- **Áreas prováveis:** detalhe do acervo (`src/app/(campaign)/campanha/(app)/comunicacao/acervo/[id]/`, `src/components/campaign/speech/`), `src/utilities/speech/` (corte e publicação), ações/rotas de `/campanha` do acervo, superfície pública em `src/app/(frontend)/` (metadata/Open Graph).
- **Precedente a olhar:** resolução VOD sob demanda (`resolver-vod` + `speechVodResolver.ts`); upload programático por buffer já existente (`media`) com S3/Garage e proxy `/api/media/file/...` com Range; IA de texto (`campaignDemandTitle.ts`, `rerankSpeechExcerpts.ts`); páginas públicas com metadata/OG (`[type]/[category]/[slug]/page.tsx`); allowlist de revalidação em `/api/revalidate`.
- **Risco de acoplamento (mecanismo de corte EM ABERTO — decisão do plano de implementação):** `ffmpeg/ffprobe` não existem no repo/Dockerfile (Alpine) e a API da Câmara corta do ponto até o FIM (`trecho=`), então o [início,fim] exato exige corte próprio — servidor, navegador ou serviço externo é trade-off a avaliar; sem infra de fila/job no repo, a criação tende a ser espera com progresso; falha nunca publica; diff em `src/utilities/speech`/`src/components/campaign/speech`/comunicacao acorda o e2e `campaignSpeechAcervo`.

## Dependências

- **Dura: C166** — a seleção [início,fim] e o compartilhamento por link do YouTube são a porta de entrada; sem ela não há trecho para cortar.
- Suaves: C168 (biblioteca de cortes — guarda o arquivo e hospeda o toggle de despublicar), C162 (resolução VOD sob demanda), C154 (vertical acervo).

## Fora de escopo

- Editar além da seleção do C166 (timeline, preview, ajuste fino), legenda/CC, trilha e capa custom; biblioteca/curadoria/listagem de cortes e o toggle de despublicar (C168); upload externo de vídeo; indexação/SEO público do corte e publicação em YouTube/redes via API.

## Rabbit holes de produto

- **Editor de vídeo no browser.** Se alguém "só completar": timeline, filtros, preview de render. **Corte neste item:** o corte é [início,fim] da seleção do C166; sem edição.
- **Fila assíncrona de render com notificação.** Se alguém "só completar": worker, retry, tela de pendências. **Corte nesta fatia:** espera curta com progresso honesto e erro claro; falhou, nada publicado.
- **Legendar/transcrever o arquivo gerado.** Se alguém "só completar": burn-in, `.srt`, tradução. **Corte neste item:** o arquivo vai sem legenda; a transcrição segue só no acervo interno.
- **Galeria pública de cortes ("já que estão no ar").** Se alguém "só completar": índice, busca, perfil. **Corte neste item:** unlisted, só por link.

## Questões em aberto (produto)

- **Publicar direto ou pré-visualizar?** **Opções:** A) confirmar já publica (título/descrição editáveis no formulário) | B) gerar rascunho e publicar depois. **Recomendação:** A, com kill switch via admin/C168. _(assumido — validar com produto)_
- **Indexar no Google?** **Opções:** A) unlisted/`noindex` | B) indexável. **Recomendação:** A — o link funciona no WhatsApp e evita exposição no período eleitoral.
- **Demora do corte:** **Opções:** A) espera curta com progresso honesto e erro claro | B) fila assíncrona com notificação. **Recomendação:** A nesta fatia (fila é rabbit hole).
- **O que a página pública mostra do discurso?** **Opções:** A) só o corte + crédito | B) contexto (data/tipo) e link para o YouTube. **Recomendação:** B minimalista (data/tipo + link; sem transcrição).

## Referências

- GitHub Issue: — (após `pnpm agent:register`)
- Rascunho UI (gate): `docs/plans/c167-cortar-trecho-publicar-ui-draft.html`
- Planos irmãos: [`c166-compartilhar-trecho-link.md`](c166-compartilhar-trecho-link.md) (C166), [`c168-biblioteca-cortes.md`](c168-biblioteca-cortes.md) (C168), [`acervo-vod-sob-demanda.md`](acervo-vod-sob-demanda.md) (C162), [`acervo-videos-comunicacao.md`](acervo-videos-comunicacao.md) (C154)
- Arquivos-chave (pista, não contrato): `src/components/campaign/speech/SpeechDetailPlayer.tsx`, `src/utilities/speech/speechVodResolver.ts`, `src/utilities/ai/`, `src/app/(frontend)/`, `scripts/lib/camaraFetch.mjs`
- `AGENTS.md` / `AGENTS-campaign.md` — vertical Comunicação, gate do acervo e crédito CC BY.

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (o corte [início,fim] exato sai salvo, tocável e baixável numa página pública compartilhável); (2) appetite de ~2–3 dias comporta o fluxo + estados + página pública, com o mecanismo de corte como maior incerteza declarada; (3) persona, job e aceite legíveis sem jargão de stack; (4) direção no codebase é hipótese (áreas, precedentes e o risco ffmpeg/Câmara em aberto); (5) zero decisão dura de engenharia no plano (schema, storage, corte e mecanismo de IA ficam para o plano de implementação).
