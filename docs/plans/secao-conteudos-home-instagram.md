# Seção de conteúdos na home de campanha — Instagram (S3)

Status: registrado
Atualizado em: 2026-08-17
Issue: #20
Priority: P1
Model: cursor-grok-4.5-medium
Impeccable: B — estende a seção S1/S2 com cards de Instagram (mesma estrutura, badge "Instagram")
Rascunho UI: docs/plans/secao-conteudos-home-ui-draft.html + PNGs embutidos abaixo
Appetite: ~1–2 dias eng; integração de leitura com a Graph API + cards na seção
Responsável: —

## Intenção

A seção "Acompanhe de perto" (S1 artigos + S2 YouTube) ganha os posts do Instagram oficial (`@depjorgesolla`). Instagram é onde a campanha mais posta no dia a dia (bastidores, caravanas, memes, avisos) — é a fonte que dá o ritmo de "atividade agora". A fatia segue o desenho aprovado do plano-site: automático via Instagram Graph API (conta Business/Creator + app Meta), servidor-side, sem script de embed no load; clique abre o post **na plataforma**.

## Persona e fluxo

- **Persona / contexto:** visitante da home de campanha, majoritariamente mobile, que quer ver a campanha pulsando hoje.
- **Job principal:** ver os posts recentes do Instagram sem sair do fluxo da página e abrir o que chamar atenção direto no app/rede.
- **Fluxo desejado:** rola até a seção → vê cards 1:1 com badge "Instagram", legenda e data → clica → abre o post no Instagram (nova aba, `noopener`), mantendo a home aberta.
- **Anti-goals de produto:** nenhum script/embed pesado do Instagram no load (LCP do mobile — decisão explícita); sem lightbox; o board nunca quebra se o token expirar; IG só liga depois do setup da Meta (review leva dias — sequenciar go-live).

### Esboço de fluxo (B)

```text
[seção S1+S2 + cards IG] → [clique no card IG] → [instagram.com/... nova aba] → [volta à home intacta]
Token expirado/API fora → [mantém último snapshot / oculta só os cards IG — nunca quebra a página]
```

### Rascunho UI (B)

![Rascunho UI — desktop](secao-conteudos-home-ui-draft-desktop.png)

![Rascunho UI — mobile](secao-conteudos-home-ui-draft-mobile.png)

Fonte iterável: [`secao-conteudos-home-ui-draft.html`](secao-conteudos-home-ui-draft.html). A cena `desktop` mostra o bento final; nesta fatia S3 entram os cards Instagram (1:1).

## Objetivo e aceite

- A seção passa a incluir os posts mais recentes da conta oficial: cards 1:1 com badge "Instagram", legenda (título) e data; clique abre o post na plataforma (nova aba, `noopener`). **Mobile: carrossel de 1 conteúdo por tela (decisão do cliente).**
- Fonte automática: leitura servidor-side via Instagram Graph API (token long-lived com refresh, perfil Business/Creator) com cache — nenhuma chave no cliente, nenhum embed no load.
- **Exclusão por item (obrigatório — posts de grade):** o perfil do Instagram tem imagens publicadas SÓ para montar o grid do feed (ex.: grade 3×3 em mosaico), que não são conteúdo real de campanha. O admin precisa marcar posts específicos como "não exibir" (por ID da mídia), e eles somem do board — o carrossel/bento pula para o próximo elegível. Sem esse mecanismo, a seção pode mostrar mosaicos sem sentido; é o requisito nº 1 desta fatia.
- Fail-closed: token expirado/API fora/quota → mantém último snapshot em cache; sem snapshot, a seção segue com as outras fontes — a página nunca quebra nem mostra erro.
- **Configuração no admin** conforme plano-site §4.2 (sem trava de schema nesta intenção); **sem credenciais IG configuradas, os cards IG simplesmente não aparecem** (a seção vive com artigos + YouTube).
- Kill switch "pausar feed" do plano-site vale para o board como um todo.
- Zero mudança em schema de conteúdo público; migrações não destrutivas no máximo (config no admin).

## Dados (intenção)

- **Vou apresentar dados?** Sim, superfície neste item — metadados do post (imagem, legenda, data) vindos da plataforma.
- **Decisões desbloqueadas:** o visitante decide qual post abrir; nada de métricas inventadas.
- **Forma:** *adiada ao plano de implementação* — restrição de produto: legenda/data como a plataforma mostra; sem contadores derivados.

## Direção no codebase (hipótese)

- **Áreas prováveis:** mesmo componente de seção/card de S1/S2 (`src/components/`, `src/app/(frontend)/(home)/page.tsx`, bloco `campaign-site` em `styles.css`); loader servidor-side novo com cache (`src/utilities/` ou `src/lib/`); config no admin (global do Payload, grupo `Configurações`).
- **Precedente a olhar:** S1/S2 (estrutura); `docs/campanha/plano-site-campanha-2026.md` §4.2 (Graph API, token long-lived com refresh ~60 dias, kill switch, "IG só liga após setup da Meta"); `src/utilities/posts.ts` (padrão de cache).
- **Risco de acoplamento:** mesma generalização da seção — card de conteúdo único (Artigo/YouTube/Instagram) sem código duplicado por plataforma; o setup da Meta é sequenciamento de go-live (externo), não bloqueia a implementação.

## Dependências

- **S2** (estrutura da seção completa: artigos + YouTube) — dura.
- Soft: `docs/campanha/plano-site-campanha-2026.md` §4.2 + pendência §5 ("mix mandato/campanha no board").

## Fora de escopo

- Compartilhamento WhatsApp → S4 (issue separada).
- Script de embed do Instagram no load (proibido pelo plano-site).
- Curadoria manual além da exclusão por item (etiquetas, ordenação manual, destaques); stories; DMs; estatísticas além do básico do post; outras contas.
- Setup da Meta (app/credenciais) é tarefa da assessoria/produção — a implementação só consome as credenciais quando existirem.

## Rabbit holes de produto

- **Embed no load.** Se alguém "só completar": o script do Instagram derruba o LCP (decisão explícita do plano-site). **Corte:** thumbnail + link para a plataforma.
- **Refresh de token como feature de produto.** Se alguém "só completar": vira um painel de OAuth. **Corte:** token long-lived com refresh automático conforme o plano-site; falha → fail-closed (snapshot/oculta).
- **IG sem credencial = erro.** Se alguém "só completar": a seção mostra erro de configuração. **Corte:** sem credencial, cards IG não existem — nada de aviso.
- **Exclusão vira curadoria pesada.** Se alguém "só completar": lista enorme de IDs, razões obrigatórias, aprovação. **Corte:** marcar/desmarcar item (thumbnail + ID) no admin; sem workflow.

## Questões em aberto (produto)

- **Mix mandato/campanha no board** — mesma questão da S2: **Opções:** A) automático (recomendação — pendência já registrada no plano-site §5, decidir com a assessoria) | B) filtrar por hashtag/tag. **Recomendação:** A. _(decidido — A + exclusão por item)_
- **Exclusão por item: o que aparece para marcar?** **Opções:** A) o admin vê a lista dos últimos posts (thumbnail + ID) e marca os que não devem aparecer (recomendação — sem isso, marcar por ID puro é inviável para a assessoria) | B) só campo de IDs com documentação. **Recomendação:** A — a interface de exclusão é parte desta fatia. _(assumido — validar com produto)_
- **Grade do feed (grid) entra?** **Opções:** A) posts de grade entram no automático e são excluídos um a um pela assessoria quando aparecem (recomendação — simples, transparente) | B) tentar detectar grade por heurística e já ocultar. **Recomendação:** A — heurística de "post de grade" é frágil (o IG não sinaliza); a exclusão manual resolve o caso real. _(assumido — validar com produto)_

## Referências

- GitHub Issue #20
- Rascunho UI (gate): `docs/plans/secao-conteudos-home-ui-draft.html` + PNGs acima
- `docs/campanha/plano-site-campanha-2026.md` §4.2 — decisões do board IG (Graph API, token, kill switch, sem embed) e §5 pendência "mix mandato/campanha"
- Wireframe: `docs/campanha/wireframe-solla-1313.html` (seção 7)
- `docs/plans/secao-conteudos-home-artigos.md` (S1) e `secao-conteudos-home-youtube.md` (S2)
- `AGENTS.md` — padrões de cache, admin em pt, convenções de nome
