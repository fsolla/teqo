# Roadmap — Teqo

Atualizado em: 2026-07-19 (MVP + Ciclo 2 deployados; A2 entregue; C2 engenharia pronta e mesclada em `main`; C3 Planos de Ação implementado e mesclado em `main`; C6 Escala e DRY pós-C2 implementado e mesclado em `main` (Fases 1–5 + simplify); C7 parcial 2026-07-19 (FormData território, contadores lista, locks, contactSearchQuery) — débitos pós-simplify registrados no plano; C8 registrado — escala/DRY pós-C6 do `/simplify`; B2 fundação de geometrias do mapa entregue; B5 registrado — escala/DRY pós-B2 do `/simplify`)

Registro canônico no repositório dos planos futuros e débitos conhecidos. Status operacional do ciclo atual de Núcleos fica em [`.cursor/rules/projects/nucleos-eleitorais.mdc`](../.cursor/rules/projects/nucleos-eleitorais.mdc); este arquivo lista o que ainda é futuro ou bloqueador, **em ordem de execução**, com dependências e paralelismo explícitos.

## Âncoras do calendário eleitoral 2026 (Res. TSE 23.760/2026)

| Data        | Marco                                           | Consequência para o produto                                                                                                                                                  |
| ----------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 20/07–05/08 | Convenções partidárias                          | Estrutura de núcleos/coordenadores deve estar operando **agora**                                                                                                             |
| 15/08       | Prazo final de registro de candidaturas         | TSE publica candidaturas 2026 na sequência → destrava o insight de dobradinha                                                                                                |
| 16/08       | Início da propaganda eleitoral (rua e internet) | "Quem chega em 16/08 com base de dados estruturada tem vantagem operacional" (Politipédia) — base nominal, baseline e agenda precisam estar em produção **antes** desta data |
| 09–23/10    | Propaganda gratuita rádio/TV                    | Reta final; congelar mudanças arriscadas no app                                                                                                                              |
| 04/10       | 1º turno                                        | Operação do dia D (GOTV) — confirmação de comparecimento da base nominal                                                                                                     |
| 25/10       | Eventual 2º turno                               | Chapa majoritária (Lula/Jerônimo); Solla decidido no 1º turno                                                                                                                |

## Princípios e decisões travadas

- Priorizar ownership de audiência e portabilidade de dados. _(README)_
- Manter módulos genéricos o bastante para reuso em outros contextos políticos. _(README)_
- Default seguro e com controle de acesso para equipes de campanha e institucionais. _(README)_
- Um único app Next.js com três áreas: site público `(frontend)`, admin Payload `(payload)`, ferramenta interna `(campaign)` em `/campanha`. Sem serviço Rust separado. _(AGENTS.md)_
- Hospedagem na Vercel por enquanto; sem migração self-host/Coolify em andamento. _(AGENTS.md)_
- Doações **não** entram neste app — só CTA/link para QueroApoiar (`apoiar.me/jorgesolla`, homologado TSE). _(AGENTS.md)_
- Pessoa = `Contact` + collections de junção; nunca criar cadastro paralelo de "apoiador/pessoa". _(AGENTS.md)_
- Núcleo Eleitoral é unidade operacional da campanha; Zona TSE é referência oficial distinta. _(notebook Núcleos)_
- Sem disparo em massa por WhatsApp: vedado pela Res. TSE 23.610 (art. 33) e pela política da Meta; mobilização é orgânica (kits de compartilhamento individuais). _(plano cadastro-nominal, pesquisa 2026-07-17)_

## Onda 0 — Caminho crítico para `/campanha` em produção

O MVP de Núcleos está **entregue e deployado** (ondas 1–8 + refactors; 2026-07-18), junto com A1 (território multi-município/bairro), A2 (zonas TSE + sugestões cruzadas — sem migration), A3 (baseline TSE 2022 — modelo + import), B1 (overview da lista), C1 (compartilhar página), C3 (planos de ação / agenda) e D1 (PWA). C2 (cadastro nominal de apoiadores) tem a engenharia pronta e mesclada em `main`, mas segue bloqueada em produção pelo lote jurídico (Consent keys). As migrations (`20260718_010733_consolidate_campaign_schema`, `20260718_190559_territorio_multi_municipio_bairro`, `20260718_195854_add_election_results`, `20260718_222656_add_supporter`, `20260718_222832_add_action_plan`, `20260719_011015_add_supporter_import_batch`) aplicam automaticamente no `pnpm build` da Vercel. O que ainda separa a vertical de uso operacional com dados reais é jurídico + smoke pós-deploy:

1. **Lote jurídico único de LGPD/Consent** _(externo — assessoria jurídica eleitoral; é o caminho crítico da vertical inteira)_. Uma única rodada cobrindo:
   - Base do art. 11 da LGPD + texto versionado de `Consent.key = 'lideranca-autopreenchimento'` (bloqueador do MVP de Núcleos; o app falha fechado sem a chave).
   - Textos de `apoiador-cadastro` e `apoiador-intencao-voto` (bloqueadores do cadastro nominal — [detalhes](plans/cadastro-nominal-apoiadores.md)).
   - Texto de `campanha-notificacoes-push` (opt-in de push — [detalhes](plans/notifications.md)).
   - **Aviso de Privacidade / política de privacidade institucional** (obrigação do controlador antes de coleta em massa; também é item do site público).
   - Avaliação de necessidade de RIPD (tratamento em larga escala + dado sensível).
   - Racional: fatiar em rodadas separadas multiplica o lead time externo; quatro textos + aviso numa rodada só.
2. **Smoke pós-deploy** _(após o build Vercel aplicar a migration)_: conferir `NEXT_PUBLIC_SITE_URL` HTTPS exato, login `/campanha`, criar núcleo de teste, e só então cadastrar o Consent de liderança. Checklist completo no AGENTS.md.
3. **Ativação com dados reais assim que (1) liberar a chave de liderança.** (A decisão de 2026-07-17 de não esperar a migração multi-município ficou superada: A1 foi entregue e deployado antes da ativação — coordenadores já estruturam núcleos reais durante as convenções, 20/07–05/08, com o território definitivo.)
4. **Onboarding do time real** (usuários `geral`/`coordenador`, primeiros núcleos, treinamento básico de campo).

## Campanha (`/campanha`)

### Ciclo 1 — Núcleos (entregue)

MVP de território + reporte implementado e enviado (ondas 1–8 + refactors de composição/infra/fixtures): auth isolada `campaignUser` (`geral` / `coordenador` / `lideranca`), núcleos com slug canônico, designação de coordenador, lideranças, estimativas sugerir/confirmar com versão UUID, atualizações semanais, convites WhatsApp (`wa.me`, hash, uso único), dashboard e hardening. Detalhes: [`.cursor/rules/projects/nucleos-eleitorais.mdc`](../.cursor/rules/projects/nucleos-eleitorais.mdc).

### Ciclo 2 — entregues em 2026-07-18 (mesclados e deployados)

- **A1 Território multi-município/bairro** — `regions`/`cities`/`neighborhoods` viram arrays `hasMany` com backfill (`20260718_190559_territorio_multi_municipio_bairro`); bairros exigem município único; regiões derivadas no servidor. [Plano](plans/territorio-multi-municipio-bairro.md).
- **A3 Baseline TSE 2022 — Fase 1** — collections `electionTally`/`electionCandidateVote`/`electionCandidate` (grupo admin `Dados Eleitorais`), migration `20260718_195854_add_election_results`, import local `pnpm db:seed:tse` idempotente por escopo (year, office, turn). Sem UI ainda — a UI é A4. [Plano](plans/baseline-eleitoral-tse.md).
- **B1 Overview da lista de núcleos** — painel agregado (estimativa de votos, cobertura, últimas atualizações) entre filtros e lista, reagindo aos mesmos filtros da URL, com escopo por papel. [Plano](plans/overview-lista-nucleos.md).
- **C1 Compartilhar página** — diálogo no detalhe do núcleo com destinatários WhatsApp (coordenação geral, coordenadores, lideranças engajadas) + copiar link; envia só o link, não concede acesso. [Plano](plans/compartilhar-pagina.md).
- **D1 PWA `/campanha`** — manifest + service worker escopados em `/campanha`, shell offline, toast de instalação (Android/iOS) e limpeza de cache no logout; fundação do push (D2). [Plano](plans/pwa-campanha.md).

### Ciclo 2+ — A2 entregue e mesclado em `main` (2026-07-18)

- **A2 Zonas TSE + sugestões cruzadas** — cadastro estático `bahiaTseZones` (TSE 2024 `detalhe_votacao_munzona` BA, 417 municípios), motor puro `territorySuggestions` (inclui `outsideZones`), coordenador `NucleusTerritoryAndZonesFields` com chips `{rótulo} +` opt-in (município/TI → ZEs; irmãos do TI e cidades da ZE → Municípios), `TseZoneInput` controlado. Sem migration, sem igualdade forçada no save. [Plano](plans/zonas-por-municipio.md).

### Ciclo 2+ — B2 fundação de geometrias do mapa (2026-07-18)

- **B2 Mapa Fase 1 (geometrias)** — TopoJSON estático de municípios IBGE (`bahia-municipalities.topo.json`) + Territórios de Identidade por dissolução (`bahia-identity-territories.topo.json`), tabela `bahiaMunicipalityCodes` (nome canônico → `codarea`), helpers `bahiaGeometries` (`getMunicipalityFeature` / `getTerritoryFeature`), script re-executável `pnpm build:geometries`. Sem migration, sem UI (Leaflet = B3). [Plano](plans/mapa-bahia-geometrias.md).
- **B5 Escala e DRY pós-B2 registrado (2026-07-18)** — débitos do `/simplify` que não entraram no cleanup: lazy load de geometrias (split mun/TI + dynamic import, preferencialmente com B3) e helper compartilhado de cache CLI (`ensureCachedDownload` para `build:geometries` / `db:seed:tse`). [Plano](plans/escala-dry-pos-b2.md).

### Ciclo 2+ — C2 e C3 mesclados em `main` (2026-07-18)

- **C2 Cadastro nominal de apoiadores** — collection `supporter` (join `Contact`↔campanha, núcleo opcional), migration `20260718_222656_add_supporter` com `UNIQUE NULLS NOT DISTINCT (contact_id, nucleus_id)`, consent por chaves estáveis `apoiador-cadastro` / `apoiador-intencao-voto` via `campaignConsent.ts` genérico (`getConsentByKey` / `requireConsentByKey`, falha fechada), actions (create / intenção de voto / import CSV só `geral` / `removeSupporterData`), UI `/campanha/apoiadores` (lista+KPIs, ficha, wizard de import, kit mínimo `wa.me`). Telefone obrigatório no v1; `lideranca` sem acesso à área. Engenharia pronta e mesclada — produção com dados reais espera deploy (build Vercel aplica a migration) + Consent keys + aprovação jurídica (Onda 0). [Plano](plans/cadastro-nominal-apoiadores.md).
- **C3 Eventos / agenda de mobilização** — collection `actionPlan` + vertical `/campanha/planos` (lista com tabs Próximos/Todos/Realizados/Rascunhos, detalhe com tabs Visão geral/Tarefas/Atualizações, forms novo/editar), blocos "Próximos eventos" no overview de núcleos e no dashboard; `startAt` opcional só em rascunho (obrigatório ao sair de `rascunho`); access por `coordinators`/`leadership` (escopo `lideranca` só toggle `tasks.done` + append `updates`); transações via `withPayloadTransaction`; migration `20260718_222832_add_action_plan`. Sem `Consent` (dado interno de staff). [Plano](plans/eventos-agenda-mobilizacao.md).
- **C7 Escala e DRY pós-C3 — parcial (2026-07-19)** — primeira fatia: `campaignTerritoryFormData`, contadores `taskTotal`/`taskDoneCount` + migration `20260719_014906_action_plan_list_perf`, locks advisory + `select` mínimo em toggle/append, `contactSearchQuery` (mín. 2 chars), rename `CampaignTerritoryFields`. Débitos do `/simplify` 2026-07-19 (composição territorial, shell de contato, leituras por aba, short-circuit de hooks, `taskProgress` no detalhe) registrados no plano — Fases 1–2 e restante de 4–5 pendentes. [Plano](plans/escala-dry-pos-c3.md).

### Referências de design (UX Pilot, 2026-07-18)

Os designs gerados pelo UX Pilot para os próximos ciclos estão em [`docs/design-refs/latest/`](design-refs/latest/) (pares `.png` + `.html` com o mesmo nome). **A UX/estrutura é a referência a seguir; a paleta não é** — os arquivos usam a paleta antiga (vermelho escuro `#8E0E23`, navy `#1B2B4B`, dourado `#C8874B`); toda implementação usa os tokens claros do tema `data-theme='campaign'` (`src/app/(frontend)/styles.css`: fundo branco, primário `#C51414`, superfícies neutras). Cada plano detalha o uso na sua seção "Referência visual (UX Pilot)".

| Item do roadmap                       | Design                                                                           | Plano com instruções                                                                                                                                                                                                                                                                  |
| ------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1 Overview da lista de núcleos       | `Lista-Nucleos-Overview`                                                         | [overview-lista-nucleos.md](plans/overview-lista-nucleos.md)                                                                                                                                                                                                                          |
| C1 Compartilhar página                | `Compartilhar-Nucleo`                                                            | [compartilhar-pagina.md](plans/compartilhar-pagina.md)                                                                                                                                                                                                                                |
| A1 Território multi-município/bairro  | `Formulario-Territorio` (bloco Território)                                       | [territorio-multi-municipio-bairro.md](plans/territorio-multi-municipio-bairro.md)                                                                                                                                                                                                    |
| A2 Zonas TSE + sugestões cruzadas     | `Formulario-Territorio` (seção Zonas TSE + chips `{rótulo} +`)                   | [zonas-por-municipio.md](plans/zonas-por-municipio.md)                                                                                                                                                                                                                                |
| A3/A4 Baseline TSE 2022 + Gap vs 2022 | `Baseline-Eleitoral-2022` (+ bloco "Baseline 2022" em `Lista-Nucleos-Overview`)  | [baseline-eleitoral-tse.md](plans/baseline-eleitoral-tse.md)                                                                                                                                                                                                                          |
| A5 Insights (5 planos)                | `Baseline-Eleitoral-2022` (card "Insights do território", uma linha por insight) | [conversão](plans/insight-taxa-conversao.md) · [classificação](plans/insight-classificacao-territorial.md) · [alavancagem](plans/insight-alavancagem-chapa.md) · [mobilização](plans/insight-mobilizacao-brancos-nulos.md) · [competitiva](plans/insight-inteligencia-competitiva.md) |
| C2 Cadastro nominal de apoiadores     | `Apoiadores-Lista`, `Apoiador-Ficha`, `Importar-CSV-Apoiadores`                  | [cadastro-nominal-apoiadores.md](plans/cadastro-nominal-apoiadores.md)                                                                                                                                                                                                                |
| C6 Escala e DRY pós-C2                | — (sem design novo; reusa os de C2 + padrões de núcleos)                         | [escala-dry-pos-c2.md](plans/escala-dry-pos-c2.md)                                                                                                                                                                                                                                    |
| C3 Eventos / agenda de mobilização    | `Planos-de-Acao`, `Novo-Plano-de-Acao`                                           | [eventos-agenda-mobilizacao.md](plans/eventos-agenda-mobilizacao.md)                                                                                                                                                                                                                  |
| C7 Escala e DRY pós-C3                | — (sem design novo; reusa os de C3 + padrões de núcleos/C6)                      | [escala-dry-pos-c3.md](plans/escala-dry-pos-c3.md)                                                                                                                                                                                                                                    |
| C8 Escala e DRY pós-C6                | — (sem design novo; reusa os de C2/C6)                                           | [escala-dry-pos-c6.md](plans/escala-dry-pos-c6.md)                                                                                                                                                                                                                                    |
| B5 Escala e DRY pós-B2                | — (sem design novo; reusa geometrias B2 + padrões de scripts CLI)                | [escala-dry-pos-b2.md](plans/escala-dry-pos-b2.md)                                                                                                                                                                                                                                    |
| D2 Notificações (sino)                | `Notificacoes-PWA` (central de notificações)                                     | [notifications.md](plans/notifications.md)                                                                                                                                                                                                                                            |
| D1 PWA `/campanha`                    | `Notificacoes-PWA` (banner "Instale o app da campanha")                          | [pwa-campanha.md](plans/pwa-campanha.md)                                                                                                                                                                                                                                              |
| C5 Operação dia D / GOTV              | `Dia-D-GOTV`                                                                     | sem plano ainda — o design é a primeira materialização do item (check-off de apoiadores por seção/zona, progresso "62% da base", filtro "Ainda não confirmados", estado "Sincronizado" offline-tolerante)                                                                             |

**Sem design nesta leva** (encomendar na próxima rodada ou desenhar na implementação): A6 dobradinha 2026, B2/B3/B4 mapa da Bahia, C4 demandas, fill-ins (visitados recentemente, listas globais, reset de senha). O detalhe do plano de ação (tabs Visão geral/Tarefas/Atualizações) e a tela de opt-in de push também não vieram — os planos correspondentes indicam o padrão a seguir.

### Grafo de dependências

Setas cheias = dependência dura; tracejadas = dependência suave (melhora, não bloqueia).

```mermaid
flowchart TD
    subgraph Onda0["Onda 0 — produção"]
        JUR["Lote jurídico único<br/>(4 Consent keys + aviso privacidade)"]
        DEPLOY["Checklist deploy + lançamento MVP"]
    end

    subgraph TrilhaA["Trilha A — dados eleitorais e território"]
        A1["A1 Território multi-município/bairro<br/>(migration) ✓"]
        A2["A2 Zonas TSE + sugestões cruzadas<br/>(chips opt-in território↔ZE) ✓"]
        A3["A3 Baseline TSE 2022 — Fase 1<br/>(import, collections) ✓"]
        A4["A4 Baseline no produto + Gap vs 2022<br/>(detalhe, overview)"]
        A5["A5 Insights: conversão, classificação,<br/>alavancagem, mobilização, competitiva"]
        A6["A6 Dobradinha 2026"]
    end

    subgraph TrilhaB["Trilha B — superfícies de coordenação"]
        B1["B1 Overview da lista de núcleos ✓"]
        B2["B2 Mapa Fase 1 (geometrias) ✓"]
        B5["B5 Escala e DRY pós-B2<br/>(lazy geometrias / cache CLI)"]
        B3["B3 Mapa Fase 2 (Leaflet nas superfícies)"]
        B4["B4 Camada de zonas TSE no mapa"]
    end

    subgraph TrilhaC["Trilha C — operação de campo"]
        C1["C1 Compartilhar página ✓"]
        C2["C2 Cadastro nominal de apoiadores ✓"]
        C6["C6 Escala e DRY pós-C2<br/>(import/listas/forms)"]
        C3["C3 Eventos / agenda de mobilização ✓"]
        C7["C7 Escala e DRY pós-C3<br/>(parcial: contadores/locks/FormData)"]
        C8["C8 Escala e DRY pós-C6<br/>(locks bulk / leituras / forms DRY)"]
        C4["C4 Demandas"]
        C5["C5 Operação dia D / GOTV<br/>(proposto, a validar)"]
    end

    subgraph TrilhaD["Trilha D — plataforma e engajamento"]
        D1["D1 PWA /campanha ✓"]
        D2["D2 Notificações (push + sino)"]
    end

    A1 --> A2
    A3 --> A4
    B1 --> A4
    A2 -.qualidade de tseZones.-> A4
    A4 --> A5
    A4 --> A6
    TSE2026["TSE publica candidaturas 2026<br/>(externo, após 15/08)"] --> A6
    B1 --> B3
    B2 --> B3
    B2 --> B5
    B5 -.lazy geometrias.-> B3
    A4 -.métricas do coroplético.-> B3
    A2 --> B4
    B3 --> B4
    A1 --> C3
    A1 --> C4
    C3 --> C7
    C3 -.relação actionPlan opcional.-> C4
    C6 -.campaignListUrl.-> C7
    JUR --> C2prod["C2 em produção<br/>(dados reais)"]
    C2 --> C2prod
    C2 --> C6
    C2 --> C5
    C6 -.escala da base.-> C5
    C6 --> C8
    D1 --> D2
    JUR -.chave de push.-> D2
```

Itens sem seta de entrada (**paralelizáveis a qualquer momento**): fill-ins (visitados recentemente, listas globais, reset de senha, higiene PascalCase). **Entregues e mesclados em `main` em 2026-07-18** (✓ no grafo): A1, A2, A3, B1, B2, C1, C2, C3 e D1 — ver "Ciclo 2" e "Ciclo 2+" acima. C2 segue com produção bloqueada pelo lote jurídico (Onda 0: Consent keys `apoiador-cadastro` / `apoiador-intencao-voto` + aprovação). Destravados por eles: A4 (A2/A3 + B1 prontos), B3 (B1 ✓ + B2 ✓; suave: A4 para coroplético e B5 F1 para lazy load), B5 (após B2; preferencialmente com B3), C4 (A1 + C3 prontos), C6 (merge de C2 ✓), C7 (após C3; suave: C6 F2), C8 (merge de C6 ✓; cortável se a base nominal permanecer pequena) e D2 push (D1 pronto; falta a chave jurídica).

### Sequência de execução por janela do calendário

**Janela 1 — agora → 05/08 (convenções): colocar a vertical em produção e consertar a fundação de dados.**

| Ordem | Item                                                                                     | Plano                                                  | Depende de                            | Paralelizável com |
| ----- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------- | ----------------- |
| 1     | Onda 0 (jurídico em lote + deploy + lançamento)                                          | —                                                      | externo                               | tudo              |
| 2     | A1 Território multi-município/bairro **(entregue 2026-07-18)**                           | [detalhes](plans/territorio-multi-municipio-bairro.md) | —                                     | B1, C1, A3        |
| 3     | A2 Zonas TSE + sugestões cruzadas (chips opt-in território↔ZE) **(entregue 2026-07-18)** | [detalhes](plans/zonas-por-municipio.md)               | A1 (nasce contra `cities[]`)          | B1 ✓, C1 ✓, A3 ✓  |
| 4     | B1 Overview da lista de núcleos **(entregue 2026-07-18)**                                | [detalhes](plans/overview-lista-nucleos.md)            | —                                     | A1, A2, C1        |
| 5     | C1 Compartilhar página **(entregue 2026-07-18)**                                         | [detalhes](plans/compartilhar-pagina.md)               | —                                     | tudo              |
| 6     | A3 Baseline TSE 2022 — Fase 1 (import) **(entregue 2026-07-18)**                         | [detalhes](plans/baseline-eleitoral-tse.md)            | — (dado público; sem bloqueador LGPD) | tudo              |

**Janela 2 — 05/08 → 16/08 (pré-propaganda): base nominal + inteligência + agenda prontas para o arranque.**

| Ordem | Item                                                                                                                            | Plano                                            | Depende de                       | Paralelizável com |
| ----- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------- | ----------------- |
| 7     | C2 Cadastro nominal de apoiadores _(engenharia pronta e mesclada em `main` 2026-07-18 — deploy + Consent keys ainda pendentes)_ | [detalhes](plans/cadastro-nominal-apoiadores.md) | produção: lote jurídico (Onda 0) | A4, C3, C6, C7    |
| 8     | C6 Escala e DRY pós-C2 (import em massa, KPI, shells compartilhados com núcleos) **(implementado e mesclado em `main` 2026-07-19 — Fases 1–5 + simplify)** | [detalhes](plans/escala-dry-pos-c2.md)           | C2 (merge)                       | A4, C3, C7, C8   |
| 9     | A4 Baseline no produto + insight Gap vs 2022                                                                                    | [detalhes](plans/baseline-eleitoral-tse.md)      | A3 + B1 (suave: A2)              | C2, C3, C6, C7, C8 |
| 10    | C3 Eventos / agenda de mobilização (`actionPlan`) **(implementado e mesclado em `main` 2026-07-18)**                            | [detalhes](plans/eventos-agenda-mobilizacao.md)  | A1                               | C2, A4, C6, C7, C8 |
| 11    | C7 Escala e DRY pós-C3 _(parcial 2026-07-19: FormData território, contadores lista, locks, `contactSearchQuery`; pendente: composição territorial, shell de contato, leituras por aba, short-circuit de hooks)_ | [detalhes](plans/escala-dry-pos-c3.md)           | C3 (suave: C6 F2)                | A4, C6, C8        |
| 12    | C8 Escala e DRY pós-C6 (locks bulk em 1 RT, leituras/`pg_trgm`, helpers drizzle, forms DRY) _(cortável se a base nominal permanecer pequena)_ | [detalhes](plans/escala-dry-pos-c6.md)           | C6 (merge)                       | A4, C3, C7        |

**Janela 3 — 16/08 → set (campanha de rua): inteligência ampliada, visualização e engajamento.**

| Ordem | Item                                                                                                                       | Plano                                                                                                                                                                                                                                                                                 | Depende de                                                        | Paralelizável com |
| ----- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------- |
| 13    | A5 Insights derivados do baseline (5 itens, paralelizáveis entre si; conversão e classificação exigem limiares de produto) | [conversão](plans/insight-taxa-conversao.md) · [classificação](plans/insight-classificacao-territorial.md) · [alavancagem](plans/insight-alavancagem-chapa.md) · [mobilização](plans/insight-mobilizacao-brancos-nulos.md) · [competitiva](plans/insight-inteligencia-competitiva.md) | A4                                                                | B3, B5, C4, D1    |
| 14    | B2 Mapa Fase 1 (geometrias) **(entregue 2026-07-18)** + B3 Leaflet nas superfícies                                          | [detalhes](plans/mapa-bahia-geometrias.md)                                                                                                                                                                                                                                            | B3 ← B1 ✓ + B2 ✓ (suave: A4 coroplético; B5 F1 lazy geometrias)   | A5, B5, C4, D1    |
| 15    | B5 Escala e DRY pós-B2 (lazy geometrias + cache CLI)                                                                       | [detalhes](plans/escala-dry-pos-b2.md)                                                                                                                                                                                                                                                 | B2 ✓ (F1 preferencialmente com B3)                                | A5, B3, C4, D1    |
| 16    | C4 Demandas                                                                                                                | [detalhes](plans/demandas-campanha.md)                                                                                                                                                                                                                                                | A1 (suave: C3 para a relação `actionPlan`)                        | A5, B3, B5, D1    |
| 17    | D1 PWA `/campanha` **(entregue antecipado em 2026-07-18)**                                                                 | [detalhes](plans/pwa-campanha.md)                                                                                                                                                                                                                                                     | —                                                                 | tudo              |
| 18    | D2 Notificações (push + sino) — sino não depende do PWA; push sim                                                          | [detalhes](plans/notifications.md)                                                                                                                                                                                                                                                    | D1 ✓ (push) + chave `campanha-notificacoes-push` do lote jurídico | A5, B3, B5, C4    |

**Janela 4 — set → 04/10 (reta final): dobradinha, dia D e estabilização.**

| Ordem | Item                                                                                                                                                                                                                                                                                                                                                                                                                          | Plano                                                             | Depende de                                                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 19    | A6 Insight dobradinha 2026                                                                                                                                                                                                                                                                                                                                                                                                    | [detalhes](plans/insight-dobradinha-2026.md)                      | A4 + TSE publicar candidaturas 2026 (externo, após 15/08) + taxonomia de alinhamento (produto) |
| 20    | B4 Camada de zonas TSE no mapa                                                                                                                                                                                                                                                                                                                                                                                                | ciclo seguinte do [plano do mapa](plans/mapa-bahia-geometrias.md) | A2 + B3                                                                                        |
| 21    | C5 **Operação dia D / GOTV** _(item proposto nesta revisão — validar com produto)_: confirmação de comparecimento da base nominal em 04/10 (lista de apoiadores por núcleo/zona com marcação "confirmou que vai votar / votou", visão de cobertura para a coordenação). É o uso final da base construída em C2; a literatura de campanha trata a mobilização do dia como onde eleições apertadas se decidem. Sem plano ainda. | design: [`Dia-D-GOTV`](design-refs/latest/Dia-D-GOTV.png)         | C2 (suave: C6 para escala da base)                                                             |
| 22    | Congelamento: a partir de ~20/09, só correção de bug e dados; nada de migration arriscada perto do dia D.                                                                                                                                                                                                                                                                                                                     | —                                                                 | —                                                                                              |

**Fill-ins (qualquer janela, quando houver folga; nenhum bloqueia nada):**

- **Visitados recentemente** (client-side, `localStorage`). → [detalhes](plans/visitados-recentemente.md)
- **Listas globais** (lideranças, atualizações, territórios no nível raiz). _(plano MVP; sem plano detalhado ainda)_
- **Reset de senha self-service + foto de perfil** (UX adiada do ciclo 1). _(plano MVP)_
- **Higiene de código:** varredura PascalCase dos componentes legados. _(notebook Núcleos)_

**Cortes seguros se o prazo apertar** (nesta ordem): B4 camada de zonas, B5 F2 (cache CLI — duplicação pequena), B3 mapa Leaflet (preferir levar B5 F1 lazy load junto se B3 entrar), C4 demandas, D2 push (mantendo o sino), C6 fases 3–5 (import bulk / preview token / KPI — só se a base nominal permanecer pequena), C7 fases 4–5 restantes (leituras por aba / short-circuit de hooks / feed O(n) — só se a agenda permanecer pequena; contadores + locks já entregues), C8 (escala/DRY pós-C6 — só se a base nominal permanecer pequena; Fases 3–4 DRY podem entrar isoladas), fill-ins (D1 PWA já entregue, saiu da lista de cortes). Preferir manter C6 fases 1–2, C7 fases 1–2 e C8 fases 3–4 (DRY de helpers/forms) se houver folga. **Não cortáveis:** Onda 0 (jurídico/Consent), C2 cadastro de apoiadores, C3 eventos/agenda, A4 baseline + gap — são respectivamente o risco legal, a base de dados, a operação da propaganda e o instrumento de alocação de esforço.

### Itens consolidados/removidos nesta revisão (2026-07-17)

- **"Insight: Gap vs 2022" como item separado** — removido: é a Fase 4 do plano de [baseline TSE 2022](plans/baseline-eleitoral-tse.md) (item A4), não um item próprio.
- **"Import do cadastro oficial de zonas TSE e/ou polígonos GeoJSON"** — absorvido: o cadastro tabular é o plano [zonas-por-municipio](plans/zonas-por-municipio.md) (A2); os polígonos são a camada de zonas do [plano do mapa](plans/mapa-bahia-geometrias.md) (B4).
- **"Sugestões cruzadas no formulário de território"** (chips `{Município} +` / `{TI} +` em ZEs; irmãos do TI e cidades da ZE em Municípios) — absorvido em A2 na revisão 2026-07-18; substitui o auto-preenchimento forçado + read-only da versão 2026-07-17 do mesmo plano.
- **"Notificações WhatsApp Business API"** — movido para fora de escopo: a Meta veda o WhatsApp Business API para campanhas políticas no Brasil e a Res. TSE 23.610 (art. 33) veda disparo em massa (pesquisa em [cadastro-nominal-apoiadores.md](plans/cadastro-nominal-apoiadores.md)). Push + sino ([notifications.md](plans/notifications.md)) cobrem a necessidade.
- **"Previsão estatística de votos"** — mantido, mas explicitamente **fora do horizonte deste ciclo eleitoral**: sem dado acumulado suficiente antes de 04/10; o baseline TSE + estimativa manual + insights são o "mínimo honesto" (design-ux §4.5). Reavaliar pós-eleição.
- **Dependência baseline → zonas-por-municipio** — rebaixada de dura para suave: `citiesForTerritory` já existe e as rows de `electionTally` resolvem cidade↔zona (ver revisão nos planos).

## Bloqueadores atuais

| Item                                                                                                                                                                                                              | Status                              | Fonte                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------- |
| Lote jurídico único LGPD (4 textos de `Consent` + Aviso de Privacidade + avaliação de RIPD) — ver Onda 0. Código do MVP já em `main`; o app falha fechado sem as chaves                                           | **caminho crítico; iniciar já**     | notebook Núcleos; AGENTS checklist; planos cadastro-nominal e notifications |
| RBAC em `users` — todo usuário do admin Payload tem acesso total; necessário antes de abrir `/admin` a equipe maior. Nota: o import de apoiadores foi desenhado no `/campanha` justamente para não depender disso | pendente                            | AGENTS Known Gap #1                                                         |
| Fluxos públicos ainda hardcodam ID de Consent (ex. `consent: 2` em `submitWhatsapp.ts`); migrar para chave estável como na campanha                                                                               | pendente                            | AGENTS Known Gap #2; plano-arquitetura                                      |
| Collection `Pages` inexistente; hero/copy da home ainda hardcoded — bio, propostas e páginas institucionais                                                                                                       | pendente (não bloqueia `/campanha`) | AGENTS Known Gap #3                                                         |

## Site público

**Já entregue:** sistema de notícias/publicações (`post`/`tag`), listagens e artigos, seed a partir de jorgesolla.com.br, cache com tag `posts`.

**Próximos** (não bloqueiam `/campanha`, exceto a política de privacidade, que entra no lote jurídico da Onda 0):

- Página de política de privacidade institucional (LGPD) — **prioridade alta**, sai do lote jurídico da Onda 0. _(plano-arquitetura §3.1)_
- Modelar e popular `Pages` para conteúdo institucional (biografia, mandato, propostas). _(AGENTS Known Gap #3; plano-arquitetura §3)_
- Tornar editáveis título/subtítulo (e demais textos) da home via global/`Pages`. _(AGENTS Known Gap #3)_
- Agenda pública e multimídia: preferir links oficiais (Câmara, YouTube, Flickr). _(plano-arquitetura §3.1)_
- Garantir superfície clara de CTA "Doar" → QueroApoiar. _(AGENTS.md; plano-arquitetura)_
- Migrar Consent dos fluxos públicos (WhatsApp, petições) para resolução por chave estável. _(AGENTS Known Gap #2)_

## Admin Payload

- Introduzir `roles` em `users` e access control real antes de ampliar quem entra em `/admin`. _(AGENTS Known Gap #1)_
- Seed reproduzível de documentos `Consent` resolvidos por chave (não por ID numérico). _(plano-arquitetura §2.3)_

## Plataforma white-label

- Fase 2 do README: multi-tenant, customização de marca/conteúdo por mandato, módulos compartilhados de comunicação e engajamento.
- **Depois da eleição** — monorepo e white-label deliberadamente fora de escopo até lá. _(README Phase 2; plano-arquitetura §6)_

## Fora de escopo (por enquanto)

- Serviço Rust (ou outro backend) separado para `/campanha`. _(AGENTS.md; plano-arquitetura)_
- Migração self-host / Coolify enquanto a Vercel atender. _(AGENTS.md)_
- Processamento de pagamentos ou doações dentro deste app. _(AGENTS.md)_
- Tratar Núcleo Eleitoral como sinônimo de Zona Eleitoral do TSE. _(notebook; plano MVP)_
- PWA do site público ou do `/admin` — só a vertical `/campanha` será instalável. _(decisão de produto 2026-07-17)_
- **PostGIS** até surgir necessidade de query espacial real; v1 do mapa usa TopoJSON estático versionado no repo. _(decisão de produto 2026-07-17)_
- **WhatsApp Business API** — vedado para campanhas políticas pela Meta e sem caminho legal para disparo em massa (Res. TSE 23.610 art. 33); superado por push + sino. _(revisão 2026-07-17)_
- **Disparo em massa de mensagens** em qualquer canal — mobilização é orgânica (kits de compartilhamento individuais, art. 33 §2º). _(plano cadastro-nominal)_
- Previsão estatística de votos neste ciclo eleitoral. _(revisão 2026-07-17; reavaliar pós-eleição)_

## Fontes

- [`AGENTS.md`](../AGENTS.md) — decisões travadas, Known Gaps, checklist de campanha
- [`.cursor/rules/projects/nucleos-eleitorais.mdc`](../.cursor/rules/projects/nucleos-eleitorais.mdc) — status e decisões do MVP de Núcleos
- [`README.md`](../README.md) — missão e direção de produto
- [`docs/plans/*.md`](plans/) — planos detalhados por item
- Plano Cursor `núcleos_eleitorais_mvp_*.plan.md` (fora do repo; workspace local)
- `plano-arquitetura-campanha-2026.md` e `design-ux-campanha.md` (Cowork / pasta irmã; fora do repo)
- Res. TSE 23.760/2026 (calendário eleitoral) — https://www.tse.jus.br/legislacao/compilada/res/2026/resolucao-no-23-760-de-2-de-marco-de-2026
- Res. TSE 23.610/2019 (propaganda; art. 33 — disparo em massa) e Lei 9.504/1997
- Politipédia AVM — planejamento de campanha, base de dados, territorialização, operação do dia da eleição — https://politipedia.wiki.br
