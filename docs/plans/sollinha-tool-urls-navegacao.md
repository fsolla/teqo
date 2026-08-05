# B162 — Sollinha: tool de URLs para navegar a vistas de interesse

Status: blocked (plano — aguarda merge em main → ready)
Atualizado em: 2026-08-05
Issue: #383
Priority: P1
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: A — N/A (links markdown no chat já existente; sem rearranjo de UI)
Canvas UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; uma tool + catálogo de destinos + orientação no system prompt; sem migration / Consent / collection
Responsável: —

## Intenção

A Sollinha (chat IA em `/campanha`, v1 entregue 2026-08-04) já responde com dados reais via tools de leitura, mas **não consegue levar o usuário até a tela onde esses dados vivem**. Quem pergunta “e Ilhéus?” ou “quais dobradinhas o assessor X cuida?” recebe texto — e depois tem de achar o município / filtro / ficha na mão.

Queremos que a Sollinha **monte links canônicos** (lista filtrada ou detalhe) e os ofereça na resposta, para o staff abrir a vista certa em um clique. Isso não substitui a navegação pelo app; completa a resposta com o próximo passo operacional.

Sucessor de [`ai-chat-sollinha.md`](ai-chat-sollinha.md) (entregue; plano imutável).

## Persona e fluxo

- **Persona / contexto:** Coordenador / candidato / assessor no Field Desk, com o chat aberto ao lado (sheet) ou full-screen (drawer), sob pressão de tempo.
- **Job principal:** depois (ou junto) da resposta factual, **ir à tela certa** sem rebuscar na sidebar/omnibox.
- **Fluxo desejado:**
  1. Pergunta em linguagem natural (“abre Ilhéus”, “dobradinhas do João”, “municípios prioritários sem assessor”).
  2. Sollinha usa tools de dados se precisar resolver entidade / confirmar existência.
  3. Sollinha chama a **tool de URL** com destino + parâmetros canônicos.
  4. Resposta inclui link(s) clicáveis (markdown) — e, quando útil, mais de um caminho (ex.: ficha do assessor **e** lista de municípios da carteira).
- **Anti-goals de produto:**
  - Substituir a navegação do app pela IA (o anti-goal original da v1 permanece).
  - Inventar filtros/URLs que o app **ainda não honra** (ex.: lista de dobradinhas filtrada por assessor — ver catálogo).
  - Auto-navegar / fechar o chat e forçar `router.push` sem o usuário clicar (surpreende).
  - Links para `/admin`, site público, wizards de escrita ou rotas fora do escopo do papel (leader lockdown).

## Objetivo e aceite

- Existe uma tool dedicada (nome de implementação livre) que **só constrói paths `/campanha/…` canônicos** a partir de um catálogo de destinos + parâmetros conhecidos.
- O system prompt ensina **quando** usar a tool (oferecer link quando a pergunta é sobre uma entidade/vista concreta; após responder com dados de uma entidade singular; quando o usuário pede explicitamente “abre / me manda o link / leva pra…”).
- Links na resposta são **clicáveis** no chat atual (markdown GFM já renderiza).
- Destinos cobertos no v1 = **catálogo abaixo** (vistas que já existem e filtros que a URL já aplica). Destinos sem filtro no app **não** são inventados — a tool recusa / devolve alternativa documentada.
- Staff com escopo restrito: a tool não precisa “esconder” paths (páginas já fail-closed), mas **só deve apontar entidades já resolvidas** por tools/dados no escopo do usuário (não inventar slug/id).
- Leader lockdown: sem links para municípios / dobradinhas / etc. (mesmo padrão da v1 — se o papel não vê a área, a tool não oferece).
- Sem migration, sem Consent, sem collection, sem persistência de histórico.

## Dados (intenção)

- **Vou apresentar dados?** Não — esta tool não agrega métricas; só devolve path(s) + label humana.
- **Decisões desbloqueadas:** staff decide **para onde ir a seguir** após a resposta da IA (abrir ficha, revisar lista filtrada, profundar no glossário).
- **Forma:** adiada — links markdown bastam neste appetite; chips/botões “Abrir” ficam fora (ver questões).

## Catálogo de destinos (produto — o que a tool precisa saber)

Inventário do que a Sollinha **deve poder** montar no v1. Cada linha = vista real no app hoje. Filtros = só os que a URL já entende.

### A. Homes / referência

| Destino                   | Path                                                              | Quando oferecer                   |
| ------------------------- | ----------------------------------------------------------------- | --------------------------------- |
| Início (mapa / dashboard) | `/campanha`                                                       | “volta pro início”, visão geral   |
| Conceitos / glossário     | `/campanha/conceitos` (+ âncora `#…` se o conceito for conhecido) | explicar captura, LQ, nível, etc. |
| Perfil                    | `/campanha/perfil`                                                | raro; só se pedir                 |
| Quadro                    | `/campanha/quadro`                                                | se o usuário citar o quadro       |

### B. Detalhes de entidade (1 registro)

| Entidade    | Path                            | Identificador que a tool precisa            |
| ----------- | ------------------------------- | ------------------------------------------- |
| Município   | `/campanha/municipios/[slug]`   | slug canônico (não nome solto sem resolver) |
| Liderança   | `/campanha/liderancas/[id]`     | id                                          |
| Dobradinha  | `/campanha/dobradinhas/[slug]`  | slug                                        |
| Assessor    | `/campanha/assessores/[id]`     | id                                          |
| Organização | `/campanha/organizacoes/[slug]` | slug                                        |
| Atividade   | `/campanha/atividades/[slug]`   | slug                                        |
| Demanda     | `/campanha/demandas/[slug]`     | slug                                        |
| Apoiador    | `/campanha/apoiadores/[id]`     | id                                          |

### C. Listas com recorte (filtros que já existem na URL)

| Lista        | Path base                | Recortes úteis para a IA (já suportados)                                                                                                                                            |
| ------------ | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Municípios   | `/campanha/municipios`   | busca `q`; município(s) por slug; território de identidade; **assessor**; com/sem assessor; prioridade alta; tendência; classe territorial; nível N0–N4 / sem nível; compare (mapa) |
| Lideranças   | `/campanha/liderancas`   | `q`; status; município(s); organização(ões); dobradinha(s); com/sem acesso ao app                                                                                                   |
| Dobradinhas  | `/campanha/dobradinhas`  | `q`; partido(s) — **sem filtro por assessor hoje**                                                                                                                                  |
| Assessores   | `/campanha/assessores`   | `q`; município(s) da carteira                                                                                                                                                       |
| Organizações | `/campanha/organizacoes` | `q`; tipo                                                                                                                                                                           |
| Atividades   | `/campanha/atividades`   | preset/tab (próximos/todos/…); tipo; status; município; `q`                                                                                                                         |
| Demandas     | `/campanha/demandas`     | `q`; status; tipo; atividade                                                                                                                                                        |
| Apoiadores   | `/campanha/apoiadores`   | `q`; intenção de voto; fonte; município/cidade                                                                                                                                      |
| Territórios  | `/campanha/territorios`  | (contrato de sort/filtro já da lista)                                                                                                                                               |

### D. Fluxos auxiliares (incluir só se couber no appetite sem puxar wizard)

| Destino                  | Path                         | Nota                                                            |
| ------------------------ | ---------------------------- | --------------------------------------------------------------- |
| Compositor de giro       | `/campanha/atividades/giros` | staff; sem parâmetros inventados além do que o compositor já lê |
| Nova entidade (`…/nova`) | vários                       | **fora do v1** — escreve/cria; anti-goal write                  |

### E. Lacunas conscientes (NÃO inventar neste item)

| Pedido humano típico                              | Situação no app hoje                                                              | O que a Sollinha deve fazer neste item                                                                                                                                      |
| ------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| “Dobradinhas do assessor X” (lista filtrada)      | Relação assessor↔dobradinha existe (B156), **filtro na lista de dobradinhas não** | Oferecer **ficha do assessor** e/ou listar dobradinhas via tool de dados + links de **detalhe** de cada dobradinha; **não** fabricar `?advisor=` em `/campanha/dobradinhas` |
| “Municípios do assessor X”                        | **Sim** — `?advisor=` na lista de municípios                                      | Preferir lista filtrada + opcionalmente ficha do assessor                                                                                                                   |
| Detalhe município v2 (`/campanha/municipio/…/v2`) | Paralelo / cutover (B152)                                                         | Preferir **canônico** `/campanha/municipios/[slug]` até cutover de produto                                                                                                  |

### F. Como a IA deve escolher (orientação de produto no prompt)

1. **Entidade singular clara** → detalhe + (opcional) lista filtrada se o job for comparativo.
2. **Conjunto / “quais / lista de”** → lista com filtros canônicos; se o filtro não existir, dados no chat + links de detalhe.
3. **Nome ambíguo** → `searchEntities` (ou tool de domínio) **antes** de montar URL; nunca inventar slug/id.
4. **Pergunta só analítica** (“quantos votos…”) → dados primeiro; link de detalhe do município como “ver no app” quando ajuda.
5. **Pedido explícito de navegação** (“abre…”, “me manda o link”) → URL é o outcome principal.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/utilities/ai/tools/` (+ registro em `index.ts`); `src/utilities/ai/systemPrompt.ts`; reuso dos builders/contratos já existentes (`campaignListUrl`, `municipalityListUrl`, `*ListUrl`, `campaignPaths`, âncoras de conceitos) — **sem** segundo gerador de query paralelo.
- **Precedente:** [`ai-chat-sollinha.md`](ai-chat-sollinha.md); contratos de lista pós-omnibox (B127+).
- **Risco de acoplamento:** drift se a tool hardcodar params que a lista já canônica; leader lockdown; não apontar v2 como canônico antes do cutover.

## Dependências

- Soft: Sollinha v1 já em produção (entregue).
- Soft: B156 (assessores por dobradinha) já em prod — explica o job “dobradinhas do assessor”, mas **não** desbloqueia filtro de lista.
- Nenhuma dependência dura de Issue aberta.

## Fora de escopo

- Novos filtros de lista (ex.: `advisor` em dobradinhas) — Issue sucessor se produto quiser.
- Auto-navegação / deep-link que fecha o sheet sozinho.
- Write tools / wizards / `…/nova`.
- Histórico persistente, web search, STT.
- Site público / `/admin`.
- UI rica de “card de link” / botão Abrir (markdown basta).
- Trocar detalhe canônico para município v2.

## Rabbit holes de produto

- **“Uma tool genérica que aceita qualquer path.”** Vira alucinação de URL e bypass de catálogo. **Corte:** catálogo fechado de destinos + params allowlisted.
- **“Resolver nome→URL sem tools de dados.”** Duplica busca e erra slug. **Corte:** URL tool exige ids/slugs já conhecidos **ou** resolve só via helpers/catalog já usados pelas outras tools — nunca chute.
- **“Cobrir 100% dos query params de todas as listas.”** Explode o schema da tool. **Corte:** params de alto valor operacional listados no catálogo; o resto fica para expansão.
- **Inventar filtro assessor→dobradinhas.** Outro item. **Corte:** alternativas do catálogo E.

## Questões em aberto (produto)

- **Links relativos (`/campanha/…`) ou absolutos (domínio de produção)?** **Opções:** A) relativo | B) absoluto com host da sessão | C) ambos. **Recomendação:** **A** — o chat roda no mesmo origin; markdown relativo abre na mesma aba/PWA. _(assumido — validar)_
- **Oferecer link proativamente ou só quando pedido?** **Opções:** A) sempre que houver entidade singular na resposta | B) só sob pedido explícito | C) híbrido (proativo em entidade singular + sempre sob pedido). **Recomendação:** **C**. _(assumido — validar)_
- **Quando o job for “dobradinhas do assessor” e não houver filtro de lista?** **Opções:** A) só ficha do assessor | B) ficha + N links de detalhe das dobradinhas (via tool de dados) | C) inventar filtro agora. **Recomendação:** **B**; C fora de escopo. _(assumido — validar)_
- **Clique no link deve fechar o chat?** **Opções:** A) comportamento default do browser/sheet (sem lógica extra) | B) fechar sheet ao clicar link interno. **Recomendação:** **A** neste appetite. _(assumido — validar)_
- **UI além de markdown (chip “Abrir Ilhéus”)?** **Opções:** A) não neste item | B) sim. **Recomendação:** **A** (Impeccable A). _(assumido — validar)_

## Referências

- GitHub Issue #383
- Canvas UI (gate): N/A
- [`ai-chat-sollinha.md`](ai-chat-sollinha.md) — v1 entregue
- `src/utilities/ai/tools/`, `src/utilities/ai/systemPrompt.ts`, `src/components/campaign/shell/ai/CampaignAIChat.tsx`
- Contratos de URL: `src/utilities/campaignListUrl.ts`, `municipality/municipalityListUrl.ts`, `stateDeputyListUrl.ts`, `leadership/leadershipListUrl.ts`, `advisor/advisorListUrl.ts`, …
- `src/lib/campaignPaths.ts`, `src/lib/campaignIntelligenceConcepts.ts` (âncoras)
- AGENTS.md — rotas `/campanha`, leader lockdown, RBAC
