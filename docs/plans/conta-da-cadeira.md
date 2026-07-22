# E8 — Conta da cadeira (metas derivadas, potencial por praça, cobertura)

Status: rascunho
Atualizado em: 2026-07-21
Item do roadmap: [docs/roadmap.md](../roadmap.md) (seção "Inteligência de campanha", E8; plano-mestre [inteligencia-campanha.md](inteligencia-campanha.md))
Impeccable: B — cobertura/metas encaixadas no dashboard, na lista de Praças e no detalhe (sem rota nova)
Appetite: ~2 dias eng; migration pequena (global `campaignGoals`) + utilities derivadas + encaixes de UI
Responsável: —

## Design (Impeccable)

Âncoras: `PRODUCT.md` (princípio 5 — métricas relativas e locais; anti-goal % estadual absoluto) / `DESIGN.md` (register `product`) · tema `data-theme='campaign'`.

Na implementação (`implement-roadmap-item`): craft compacto → critique → polish.

- **Persona / contexto:** coordenador-geral na reunião semanal; assessor conferindo "quanto falta" nas suas Praças.
- **Job principal:** responder "a conta fecha?" em uma linha — meta, comprometido, delta da semana, por praça e no agregado.
- **Estratégia de cor:** Restrained; delta negativo usa o vermelho de campanha com parcimônia (não hero-metric).
- **Edit where you see:** sim — meta da praça editável em contexto (Popover reusando `plazaStaffFormActions`), como B9.
- **Anti-goals:** KPI de % estadual absoluto; contagem bruta de cadastros; gauge/velocímetro SaaS.

## Contexto

O relatório de discovery ([§5.1](../research/relatorio-entrevista-persona-campanha.md)) fixou a OMTM da campanha até 16/08: **cobertura da meta por compromissos auditáveis** (Σ pledges ÷ meta, com delta semanal como número da reunião), decomposta por praça. Hoje `plaza.voteGoals` (Bom/Regular/Mínimo) e `plaza.expectedVotes` existem (E1/A9), mas: não há meta estadual nem decomposição de cima para baixo; não há noção de potencial derivado (válidos projetados, captura do campo, roll-off); denominadores baseados em `aptos` inflariam praças de abstenção estrutural (relatório §6.6/I-B); e não existe "campo" definido por ano para share intracampo. Os dados TSE necessários já estão em `electionTally` (válidos/brancos/nulos/comparecimento por cargo×ano×cidade×zona) e `electionCandidateVote`.

## Objetivos

- Global `campaignGoals` (admin group `Campanha`, staff-only): meta estadual de votos, margem, ano-base, nota.
- Utilities derivadas por praça (sem persistir o derivado): válidos projetados do cargo (série 2014/2018/2022), teto do campo (majoritário 1º turno), taxa de captura, share intracampo (via `campoParties.ts`), roll-off DF×majoritária, potencial e meta sugerida (decomposição proporcional ao potencial).
- Cobertura: Σ (`estimatedVotes ?? declaredVotes`) ÷ meta por praça e agregada; delta semanal (exige C12 para série; até lá, delta vs. snapshot em memória do último load é aceitável mostrar como "—").
- Encaixes: linha de cobertura no dashboard (`campaignDashboardData.ts`), colunas meta/cobertura na lista (`PlazaList`/`PlazaListOverview`), card no detalhe da Praça.
- Access: tudo staff-only (`coordinator`/`advisor`); `leader` não vê metas — mesmo padrão de `voteGoals`.
- Sanity check por TI: Σ metas das praças do TI vs. participação histórica do TI no voto (aviso, não bloqueio).

## Decisões travadas

- **Denominadores usam válidos projetados do cargo, nunca `aptos`** (relatório §6.6; abstenção estrutural >35% em praças pequenas infla potencial). **Rejeitado:** `aptos` (viés pró-praça-vazia); válidos da majoritária (cargo errado); eleitorado IBGE (não é cadastro eleitoral).
- **Meta estadual mora num global editável, decomposição é derivada e a meta por praça continua editável** (`voteGoals` manual vence a sugerida quando preenchida). Mantém julgamento humano no loop e evita reescrever E1. **Rejeitado:** meta por praça 100% automática (K-C: "o erro é a conta" precisa de dono humano); collection de metas versionadas (C12 cobre auditoria via decisões).
- **"Campo" por ano é lib estática curada** `src/lib/campoParties.ts` (ano → partidos/números). **Rejeitado:** collection administrável (curadoria política rara, não CRUD); inferir por coligação do TSE (federações ≠ campo político real).
- **i18n e naming:** `campaignGoals`, `computePlazaPotential`, `computeGoalCoverage`, `projectedValidVotes`, `captureRate`, `intraFieldShare`, `rollOff`; labels pt-BR.

## Questões em aberto

- **Meta estadual inicial?** Opções: QE cheio (~190–200 mil) | faixa da cadeira 2022 (~80–150 mil) + margem. **Recomendação:** faixa da cadeira + margem do coordenador — o QE cheio superestima (maioria das cadeiras sai bem abaixo). _(validar com produto)_
- **Projeção de válidos: média simples da série ou tendência?** Opções: média 3 eleições | último ano | regressão simples. **Recomendação:** média ponderada (2022 peso 2) — barata, estável, sem cheiro de "previsão estatística" (fora de escopo).

## Abordagem proposta

```mermaid
flowchart LR
    Tally["electionTally + electionCandidateVote<br/>(série 2014/2018/2022)"]
    Campo["campoParties.ts"]
    Goals["global campaignGoals"]
    Pot["computePlazaPotential<br/>(válidos proj., teto, captura, roll-off)"]
    Cov["computeGoalCoverage<br/>(Σ pledges ÷ meta)"]
    Pledges["aggregatePledgesByPlaza<br/>(votePledgeData.ts)"]
    UI["dashboard + PlazaList/Overview + detalhe"]
    Tally --> Pot
    Campo --> Pot
    Goals --> Cov
    Pot --> Cov
    Pledges --> Cov
    Cov --> UI
```

Componentes:

- **`src/lib/campoParties.ts`**: mapa ano→partidos do campo (2014/2018/2022/2026), com fixture de teste.
- **`src/utilities/plazaPotential.ts`**: deriva por praça (reusa `plazaElectionGeography.ts` para células cidade×zona e `plazaElectoralBaseline.ts` para a série); expõe `projectedValidVotes`, `fieldCeiling`, `captureRate`, `intraFieldShare`, `rollOff`, `suggestedGoal`.
- **`src/utilities/goalCoverage.ts`**: cobertura por praça/agregado consumindo `aggregatePledgesByPlaza` (regra `estimatedVotes ?? declaredVotes` de `votePledgeData.ts`) + `voteGoals`/meta sugerida; sanity por TI via `bahiaTerritories.ts`.
- **Global `CampaignGoals`** (`src/globals/CampaignGoals.ts`): campos `stateGoal`, `margin`, `baseYear`, `note`; access staff-read/coordinator-write; hook `revalidateGlobal`.
- **UI:** linha nova em `CampaignMetricStrip` do dashboard; coluna/ordenar por cobertura em `PlazaList` (reusa padrão B9 para editar meta via `plazaStaffFormActions`); card "Conta da cadeira" no detalhe.
- **Migration**: `pnpm migrate:create add_campaign_goals_global` (tabela do global). Sem mudança em collections.

## Dependências

- Dura: deploy da remodelagem (schema `plaza`/`votePledge` em produção). Suave: C12 (delta semanal real da cobertura usa trajetória de pledges; até lá, sem histórico).
- Reusa: `plazaElectoralBaseline.ts`, `plazaElectionGeography.ts`, `votePledgeData.ts`, `plazaPageData.ts` (`loadPlazaListPageBundle`), `campaignDashboardData.ts`, `plazaStaffFormActions.ts`, `campaignAccess.ts`.

## Não escopo

- Fila ordenada por déficit (E9 — [fila-de-alocacao.md](fila-de-alocacao.md)); histórico/trajetória (C12); recalibração de classes (E10); rollups TI além do sanity check (E12); previsão estatística (Fora de escopo do roadmap).

## Rabbit holes

- **Projeção virar modelo preditivo.** Se alguém "melhorar" com regressão/ML: viola decisão de escopo do ciclo. **Mitigação:** média ponderada fixa, documentada como não-previsão.
- **Decomposição automática sobrescrever `voteGoals`.** **Mitigação:** meta sugerida é coluna separada; manual sempre vence; nunca escrever em `voteGoals` por job.
- **Roll-off por zona de Salvador sem tally do majoritário na mesma malha.** Verificar cobertura de `electionTally` para presidente/governador por zona antes de expor; se faltar, roll-off só municipal (nota na UI).

## Adiado com gatilho

- **Delta semanal persistido.** Revisitar quando C12 entregar trajetória (gatilho: primeira semana com 2 snapshots).
- **Meta por cenário (Bom/Regular/Mínimo) × cobertura tripla.** Gatilho: coordenador pedir leitura por cenário na reunião (hoje: cobre contra `regular ?? suggestedGoal`).

## Referências

- `docs/roadmap.md` (seção Inteligência de campanha) · [plano-mestre](inteligencia-campanha.md) (gaps G5/G6)
- `docs/research/relatorio-entrevista-persona-campanha.md` §5.1 (OMTM), §6.6 (denominadores/roll-off), FU2 (numerador/denominador)
- `src/collections/Plaza.ts` (voteGoals/expectedVotes/access), `src/collections/ElectionTally.ts` (campos por cargo)
- `src/utilities/plazaElectoralBaseline.ts`, `src/utilities/plazaElectionGeography.ts`, `src/utilities/votePledgeData.ts`, `src/utilities/campaignDashboardData.ts`
- AGENTS.md — migrations, access staff-only, naming, transações
