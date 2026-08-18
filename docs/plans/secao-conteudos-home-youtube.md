# Seção de conteúdos na home de campanha — YouTube (S2)

Status: registrado
Atualizado em: 2026-08-17
Issue: #18
Priority: P1
Model: cursor-grok-4.5-medium
Impeccable: B — estende a seção S1 com cards de vídeo (mesma estrutura de card, badge "YouTube")
Rascunho UI: docs/plans/secao-conteudos-home-ui-draft.html + PNGs embutidos abaixo
Appetite: ~1–2 dias eng; integração de leitura com a API do YouTube + cards na seção S1
Responsável: —

## Intenção

A seção "Acompanhe de perto" da home de campanha (criada em S1 com artigos) ganha os vídeos do canal oficial. O canal já existe (`@JorgeSollaDep`) e posta com frequência — vídeos são o conteúdo de maior engajamento na reta final. A fatia segue o desenho aprovado no plano do site: automático via API do YouTube, servidor-side, sem iframe no carregamento; clique abre o vídeo **na plataforma** (decisão do wireframe).

## Persona e fluxo

- **Persona / contexto:** visitante da home de campanha que quer ver a caminhada em movimento (bastidores, caravanas, entrevistas).
- **Job principal:** ver que o canal está ativo e assistir o vídeo mais recente sem caçar o canal.
- **Fluxo desejado:** rola até a seção → vê o card grande do último vídeo (thumbnail 16:9 + badge "YouTube" + título + views/data) e cards menores dos seguintes → clica no card → abre o vídeo no YouTube (nova aba, `noopener`), mantendo a home aberta.
- **Anti-goals de produto:** nenhum embed/player inline no v1 (decisão do plano-site §4.2: "sem iframe no load", LCP do mobile); o board não é curadoria manual; a seção nunca quebra se a API falhar.

### Esboço de fluxo (B)

```text
[seção S1 + cards YT] → [clique no card YT] → [youtube.com/... nova aba] → [volta à home intacta]
API indisponível → [mantém último snapshot / oculta só os cards YT — nunca quebra a página]
```

### Rascunho UI (B)

![Rascunho UI — desktop](secao-conteudos-home-ui-draft-desktop.png)

![Rascunho UI — mobile](secao-conteudos-home-ui-draft-mobile.png)

Fonte iterável: [`secao-conteudos-home-ui-draft.html`](secao-conteudos-home-ui-draft.html). A cena `desktop` mostra o bento final (Artigo + YouTube + Instagram); nesta fatia S2 entram só os cards YouTube.

## Objetivo e aceite

- A seção S1 passa a incluir os vídeos mais recentes do canal oficial: card grande = último vídeo (16:9), pequenos = próximos, com badge "YouTube", título, data e visualizações. **Mobile: carrossel de 1 conteúdo por tela (decisão do cliente).**
- Fonte automática: leitura servidor-side da API pública do YouTube (dados dos últimos vídeos do canal), com cache (ISR/revalidação) — nenhuma chave no cliente, nenhum iframe no load.
- Clique no card abre o vídeo **na plataforma** (URL canônica do vídeo), em nova aba com `noopener` — sem lightbox, sem player inline (decisão do wireframe; player inline fica fora de escopo).
- **Exclusão por item (curadoria mínima):** o admin pode marcar vídeos específicos para NÃO aparecer (ex.: vídeo errado, conteúdo que não é de campanha, transmissão incompleta). Itens excluídos não são exibidos nem contam para "o último vídeo" — o board pula para o próximo elegível. Mesmo mecanismo de exclusão das outras plataformas (S3), configurado no mesmo lugar no admin.
- Fail-closed: API sem resposta/token expirado/quota estourada → mantém o último snapshot em cache se existir; sem snapshot, a seção continua com as outras fontes (ou oculta por completo se nada houver) — a página nunca quebra nem mostra erro.
- A configuração (chave/IDs + exclusões) vive no admin, seguindo o desenho do plano-site §4.2 (sem trava de schema nesta intenção — o executor define a forma); sem chave configurada, os cards YT simplesmente não aparecem.
- Zero mudança em schema de conteúdo público / migrations destrutivas; a visibilidade eleitoral `hidden` dos posts não se aplica aqui (fonte externa), mas o kill switch do feed (pausar) segue o desenho do plano-site.

## Dados (intenção)

- **Vou apresentar dados?** Sim, superfície neste item — metadados do vídeo (título, thumbnail, data, visualizações) vindos da plataforma.
- **Decisões desbloqueadas:** o visitante decide qual vídeo assistir (clique); visualizações são fato da plataforma (não inventar).
- **Forma:** _adiada ao plano de implementação_ — restrição de produto: mostrar views como a plataforma mostra (ex. "12,4 mil"), nunca métrica derivada da campanha.

## Direção no codebase (hipótese)

- **Áreas prováveis:** mesmo componente de seção/card de S1 (`src/components/`, `src/app/(frontend)/(home)/page.tsx`, bloco `campaign-site` em `styles.css`); loader/fetch servidor-side novo em `src/utilities/` ou `src/lib/` com cache (padrão `unstable_cache` do repo); config no admin (global do Payload, grupo `Configurações` — sem nome de arquivo travado).
- **Precedente a olhar:** S1 (estrutura da seção); `docs/campanha/plano-site-campanha-2026.md` §4.2 (decisões: Data API v3, server-side, ISR, thumbnails CDN, sem iframe no load); padrões de cache do repo (`src/utilities/posts.ts`, `unstable_cache` + tags); `seed-posts.mjs` se precisar de referência de chamada externa com cache de download.
- **Risco de acoplamento:** seção compartilhada com S3 (Instagram) — a estrutura de card generalizada criada em S1 não pode virar código duplicado por plataforma; o kill switch de "pausar feed" do plano-site é um toggle único do board (não por plataforma na intenção — validar no plano de implementação).

## Dependências

- **S1** (estrutura da seção + card generalizado) — dura.
- Soft: `docs/campanha/plano-site-campanha-2026.md` §4.2 (decisões de engenharia do board).

## Fora de escopo

- Instagram → S3 (mesma seção, mesmo lote).
- Compartilhamento WhatsApp → S4 (issue separada).
- Player inline / lightbox / iframe no load (decisão do wireframe: clique abre na plataforma).
- Curadoria manual além da exclusão por item (playlists, etiquetas, ordenação manual, seleção de destaques); download/armazenamento dos vídeos; estatísticas além do que a API entrega (comentários, inscritos).
- Outros canais/contas (a configuração aponta um canal oficial).

## Rabbit holes de produto

- **Embed no load.** Se alguém "só completar": iframes de YouTube derrubam o LCP no mobile (decisão explícita do plano-site §4.2). **Corte:** thumbnail + link para a plataforma.
- **Vídeo "em destaque" com escolha manual.** Se alguém "só completar": vira curadoria semanal. **Corte:** automático (último vídeo elegível = card grande).
- **Exclusão vira curadoria pesada.** Se alguém "só completar": lista enorme de IDs, razões obrigatórias, aprovação. **Corte:** marcar/desmarcar item no admin; sem workflow.
- **Fail-closed vira erro visível.** Se alguém "só completar": mensagem de "erro ao carregar" queima a home. **Corte:** seção nunca mostra erro — snapshot ou ocultação silenciosa.

## Questões em aberto (produto)

- **Misturar mandato e campanha no board?** **Opções:** A) automático — expõe o que o canal postar (recomendação: pendência já registrada no plano-site §5, decidir com a assessoria antes do go-live) | B) filtrar por termo/playlist. **Recomendação:** A, com o kill switch do plano-site + exclusão por item como rede de segurança. _(decidido — A + exclusão por item)_
- **Exclusão por item: qual granularidade?** **Opções:** A) lista de IDs excluídos por plataforma, gerenciada no admin (recomendação — simples, auditável, suficiente para vídeos errados/indesejados) | B) razão/etiqueta obrigatória por exclusão. **Recomendação:** A — o motivo pode ser um campo opcional de texto livre, sem virar workflow. _(assumido — validar com produto)_

## Referências

- GitHub Issue #18
- Rascunho UI (gate): `docs/plans/secao-conteudos-home-ui-draft.html` + PNGs acima
- `docs/campanha/plano-site-campanha-2026.md` §4.2 — decisões do board (API, cache, sem iframe, fail-closed) e §5 pendência "mix mandato/campanha"
- Wireframe: `docs/campanha/wireframe-solla-1313.html` (seção 7)
- `docs/plans/secao-conteudos-home-artigos.md` (S1 — estrutura que esta fatia estende)
- `AGENTS.md` — padrões de cache (`unstable_cache`), admin em pt, convenções de nome (identificadores em inglês)
