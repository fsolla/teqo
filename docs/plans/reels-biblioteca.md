# Biblioteca de reels na vertical Comunicação

Status: rascunho
Atualizado em: 2026-09-18
Issue: #1153
Priority: P2
Impeccable: C — fluxo novo em /campanha/comunicacao/reels (lista + detalhe), encaixe na vertical Comunicação
Design UI: docs/plans/reels-biblioteca-ui-design.html (a produzir pelo `designer`) + assets
Appetite: ~1–2 dias eng; um outcome verificável
Responsável: —

## Intenção

A produção de Reels do mandato (tutoriais das funcionalidades do site, começando pelos cards da home) acontece fora do site, mas a assessoria não tem onde se servir do material pronto. Hoje cada reel vive solto em pastas e conversas. Queremos uma biblioteca interna e privada dentro de `/campanha/comunicacao/reels`: a pessoa abre o reel, vê a capa e o título, assiste em 9:16 e baixa o que precisa — vídeo sem áudio (primário), vídeo com áudio rascunho, mp3 da narração, `.srt` e transcrição/roteiro. Nada é publicado no Instagram por aqui; a assessoria publica nos canais. Um kill switch permite despublicar (tirar da biblioteca) sem apagar.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação do mandato (role `communicator`), com coordinator e candidate enxergando o mesmo acervo; trabalha fora do site, em ferramentas de edição, e precisa da mídia bruta organizada.
- **Job principal:** encontrar o reel certo, conferir o resultado, baixar os arquivos e regravar/acrescentar áudio quando necessário.
- **Fluxo desejado:** entra na vertical Comunicação → Reels → varre a lista por capa/título → abre o detalhe → assiste em 9:16 → baixa o arquivo que precisa → (staff) despublica/republica quando o reel sai de linha.
- **Anti-goals de produto:** não é editor de vídeo, não publica em rede social, não é galeria pública, não substitui a skill de produção (a mídia é gerada fora), não cria um novo modelo de mídia paralelo ao que o C193 definir.

### Esboço de fluxo (C)

```text
[início: /campanha/comunicacao/reels]
   → lista (capas + títulos, só reels publicados)
   → detalhe /campanha/comunicacao/reels/[id]
   → player 9:16 + painel de downloads (sem áudio · com áudio · mp3 · .srt · transcrição)
   → baixa e trabalha a mídia fora do site
   → (kill switch no detalhe: despublica → some da lista, arquivo preservado)
[outcome: assessoria servida sem pedir arquivo a ninguém]
```

### Design UI (C)

- Design UI (gate): `docs/plans/reels-biblioteca-ui-design.html` — lista com capa/título e detalhe com player 9:16 + painel de downloads, na linguagem visual do /campanha.

## Objetivo e aceite

- A assessoria abre `/campanha/comunicacao/reels`, encontra os reels publicados e assiste cada um em 9:16 sem sair do site.
- No detalhe, todos os arquivos disponíveis do reel são baixáveis: vídeo sem áudio (primário), vídeo com áudio (quando existir), mp3 (quando existir), `.srt` e transcrição/roteiro em texto.
- Despublicar tira o reel da lista imediatamente e não apaga nada; republicar o reativa.
- Acesso restrito a `communicator`, `coordinator` e `candidate`; qualquer outro role é negado (fail-closed).
- Guardrails: nada de publicação em redes sociais; nada de edição de vídeo na UI; nenhum reel some por acidente (kill switch reversível).

## Dados (intenção)

- **Vou apresentar dados?** Não — esta entrega é biblioteca de mídia, não análise. Sem métricas, sem gráficos.
- **Decisões desbloqueadas:** qual reel está pronto para trabalhar; o que já tem narração/legenda pronta; o que foi despublicado (inventário operacional, não analítico).
- **Forma:** adiada ao plano de implementação (o C193 define o modelo e a privacidade do arquivo).

## Dados da decisão (literais)

- Rota da biblioteca: `/campanha/comunicacao/reels` (lista) + `/campanha/comunicacao/reels/[id]` (detalhe).
- 3º sub-item de navegação da vertical Comunicação, depois de "Acervo de falas" e "Biblioteca de cortes".
- Downloads oferecidos no detalhe: vídeo **sem áudio** (primário), vídeo **com áudio** (rascunho, quando existir), **mp3** da narração (quando existir), **`.srt`** e **transcrição/roteiro** em texto.
- Kill switch: despublicar tira da biblioteca sem apagar; republicar reativa.
- Acesso: só `communicator`, `coordinator`, `candidate`.
- Nada de publicação em redes sociais por este item; nada de edição do vídeo na UI (a mídia é produzida fora, pela skill).

## Direção no codebase (hipótese)

- **Áreas prováveis:** rota nova em `src/app/(campaign)/campanha/(app)/comunicacao/reels/` (lista e detalhe, espelhando `acervo/cortes/`); componentes em `src/components/campaign/reels/` ou equivalentes; caminhos em `src/lib/campaignPaths.ts`; nav em `src/components/campaign/shell/nav.ts`; chrome em `src/lib/campaignPageChrome.ts`; gate em `src/utilities/campaignPageActor.ts`; RBAC reusando `src/lib/campaignRoles.ts` / `src/utilities/access/`.
- **Precedente a olhar:** `acervo/cortes/` de ponta a ponta — `SpeechCutLibraryList/Card/Filters/StatusBadge/Player/PublicationPanel`, `speechCutPageData.ts`, `speechCutListUrl.ts`, handlers JSON `cortes/[id]/{publicacao,apagar,retry,texto}/route.ts`, teste e2e `campaignSpeechCut.e2e.spec.ts` e int `speechCut.int.spec.ts`. Reels é o mesmo formato (lista + detalhe + kill switch) com player 9:16 e painel de downloads.
- **Risco de acoplamento:** (1) o cookie de sessão `campaign-token` (`path=/campanha`) não autentica `<video src="/api/media/file/...">` sozinho — o caminho autenticado de mídia depende do C193; (2) a regra de chrome de reels precisa vir ANTES do regex genérico de `/comunicacao/acervo/[^/]+`; (3) o C184 (#1106) mexe nos mesmos componentes de nav e `tests/unit/campaignNav.unit.spec.ts:100-127` pina a lista exata `[Acervo, Cortes]` — um 3º sub-item toca o mesmo diff.

## Dependências

- **C193 (crítico):** modelo do reel + privacidade do arquivo, incluindo o caminho autenticado de mídia.
- **C184 (#1106, in-progress):** serializar com este lote para evitar conflito em nav/testes de sub-itens de Comunicação.
- **Soft:** C195/C196/C197 — o acervo só tem conteúdo real quando o ingest e as skills existirem; a página é construída com fixtures antes disso.
- **Design UI:** `docs/plans/reels-biblioteca-ui-design.html` a produzir pelo `designer` antes da implementação (gate).

## Fora de escopo

- Publicar, agendar ou cross-postar no Instagram ou qualquer rede.
- Editar, cortar, legendar ou remixar vídeo dentro da UI.
- Produção do reel (a skill gera a mídia fora do site).
- Qualquer forma de acesso público ou compartilhamento externo do acervo.
- Retenção, versionamento ou expurgo automático de arquivos despublicados (decisão adiada).
- Empacotamento "baixar tudo" em zip.

## Rabbit holes de produto

- **Estúdio de edição.** Transformar o detalhe em editor de vídeo/legenda puxa escopo muito além da biblioteca. **Corte neste item:** só assistir e baixar.
- **Versionar reels (v2, v3).** Controle de revisão não pedido. **Corte neste item:** cada reel é um registro único; trocar = substituir.
- **Métricas do Instagram.** Outro produto, outra fonte de dados. **Corte neste item:** fora.
- **Busca/filtros elaborados.** Com poucos reels, lista simples basta. **Corte neste item:** ordenação por mais recente no MVP.

## Questões em aberto (produto)

- **O kill switch pode ser acionado por `communicator` ou só `coordinator`?** **Opções:** A) qualquer um dos três roles com acesso à biblioteca; B) só coordinator/candidate. **Recomendação:** A — quem cuida do acervo no dia a dia é a assessoria; restringir cria fila.
- **Reel despublicado continua acessível por link direto do detalhe para a assessoria?** **Opções:** A) sim, para quem tem login (é arquivo interno); B) não, some também no detalhe. **Recomendação:** A — biblioteca privada; despublicar é curadoria da lista, não revogação. **Conflita com a recomendação do C193 e precisa de decisão única no gate.**
- **Lista precisa de busca/filtro no MVP?** **Opções:** A) só lista ordenada por mais recente; B) busca por título + filtro publicado/despublicado. **Recomendação:** A no MVP, B quando o acervo passar de uma dúzia.
- **Quem pode ver/baixar a transcrição é o mesmo grupo dos downloads de mídia?** **Opções:** A) mesmo grupo, sem distinção; B) separar leitura de roteiro do download de vídeo. **Recomendação:** A — não há dado sensível distinto; evitar RBAC novo sem evidência.

## Referências

- Precedente no repo: `src/app/(campaign)/campanha/(app)/comunicacao/acervo/cortes/` (lista, detalhe, handlers JSON).
- Componentes: `src/components/campaign/speech/`.
- Regras: `.agents/rules/campanha-action-feedback.mdc`; `.agents/rules/engineering-standards.mdc` ("Edit the owner, don't twin").
- Constraint de privacidade: `src/utilities/campaignAuth.ts` (`campaign-token`, `path=/campanha`) + C193.
- Conflito de nav: C184 (#1106) e `tests/unit/campaignNav.unit.spec.ts:100-127`.
- Design UI (gate): `docs/plans/reels-biblioteca-ui-design.html` + assets em `docs/plans/reels-biblioteca-ui-design-assets/`.
- Contexto de produto: `docs/research/` (discovery aprovado) e o plano de arquitetura da campanha.
