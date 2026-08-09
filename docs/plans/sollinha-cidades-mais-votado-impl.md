# Impl: Sollinha — responder “em quais cidades X foi o deputado mais votado” (rank competitivo reverso, flexível)

Status: aprovado
Atualizado em: 2026-08-09
Issue: #460
Intenção: docs/plans/sollinha-cidades-mais-votado.md
Appetite restante: ~1 dia eng (herdado); sem migration / collection / Consent / UI

## Registro de execução (2026-08-09)

- **Entrega:** implementado e validado — `src/lib/leadingMunicipalities.ts` (path do artefato, puro) + `src/utilities/ai/tools/getLeadingMunicipalities.ts` (tool; SQL window-rank para terceiros) + registro em `tools/index.ts` + seção pt-BR no `systemPrompt.ts`; unit (8) e int (7) specs próprios.
- **Divergência da hipótese da intenção:** nenhuma nos aceites; a decisão nova de engenharia (SQL `RANK()` window via drizzle no request path para terceiros, mantendo o artefato só para o candidato) foi deliberada e validada por int test contra a fórmula do builder do artefato.
- **Cobertura por tests:** SQL path com valores exatos da fixture (Salvador dobra zonas numa linha; 2222 top-N), equivalência SQL ≡ fórmula do artefato, resolução por número/nome + fallback de votos + not-found, lockdown de leader (unit).
- **Correções de fixture:** TSE code de Feira de Santana `35150 → 35157` nos CSVs de fixture (o `35150` não era canônico; `bahiaTseCityCodes`/snapshot oficial pina `35157`). Sem impacto em `electionResultsImport` (totais íntegros) nem `municipalityTicketPartnerData`.
- **Simplify:** fixes aplicados — `server-only` no tool + guard de convenção alargado para `@payloadcms/db-postgres`; `cityPageSlug` único (lib reusado por tool/teste) matando twin de `entries.length===1`; iterar `municipalityCatalogEntriesForCity` em vez de rebuildar mapa; `HISTORICAL_SERIES_YEARS` reusado (sem tuple local); resolução de candidato busca todas as linhas (`limit: 0`) para a ambigüidade nunca omitir o candidato certo; loader sem throw no `execute` (erro vira `{ error }` no chat); `assertCanReadElectionData` dentro do loader (defesa em profundidade, espelha `municipalityElectoralBaseline`); int test de fallback do registro.
- **Deferidos (registrados aqui, sem Issue):** (1) fixture de empate no limite do top-N — gatilho: mudar `RANK()`/DENSE_RANK ou o CTE; (2) nota de escopo do terceiro candidato (zona leaky inclusa no escopo cru da cidade) documentada no comentário do loader.

## Leitura da intenção

- **Outcome:** uma tool de leitura no chat Sollinha que responde, para um deputado federal (número/nome; default = candidato da campanha): “em quais municípios ficou em 1º (ou até a posição X)” num ano da série (2014/2018/2022; 2022 default) — com contagem, uma linha por cidade (417, Salvador como UMA cidade, nunca 19), semântica de empate = mesma do mapa, fail-safe “sem dados” quando não houver.
- **O que NÃO negociar:** leader lockdown (não conversa de municípios); não estender para outros cargos; uma linha por cidade; sem segunda fonte paralela desalinhada para o candidato da campanha (artefato imutável é a fonte da verdade); nunca inventar número; sem migration/collection/Consent.
- **O que reavaliar:** como derivar o rank de **terceiros candidatos** sem colocar o scan de ~100k linhas no path de request (B13 documenta `loadFederalVotesByCityZoneAndCandidate` como CLI/build-only). Hipótese da intenção é “derivar das coleções de votos”; a forma concreta (SQL window vs. scan no Node) é decisão desta engenharia.

## Abordagem recomendada

```mermaid
flowchart LR
  U[chat /campanha] --> T[getLeadingMunicipalities]
  T --> G{assertCanReadElectionData}
  G -- leader/deny --> E[error pt-BR]
  G -- staff --> D{candidate dado?}
  D -- não/1313 --> A[artefato federalRankByIbgeCode<br/>instantâneo, imutável]
  D -- outro número/nome --> R[resolve em electionCandidate<br/>/electionCandidateVote]
  R -- 1 match --> S[SQL window RANK()<br/>election_candidate_vote]
  R -- >1 match --> O[opções p/ desambiguar]
  A --> M[monta linhas city/rank/votes/candidates<br/>+ slug p/ link]
  S --> M2[city_code→city canônico + slug]
  M --> Out[resposta: contagem + ranking]
  M2 --> Out
```

**Opções consideradas:**

- **A — Híbrido fonte dupla sancionada:** candidato da campanha lê o artefato commitado (`federalRankByIbgeCode` + `municipalities[slug].votesByYear`); terceiros derivam ao vivo por uma query SQL window-rank única.
- **B — SQL window-rank para todos (inclusive Solla):** um único path; re-deriva a cada chamada o que o artefato já precomputa; põe o scan de ~100k linhas no chat (contra a restrição documentada por B13).
- **C — Scan `loadFederalVotesByCityZoneAndCandidate` no path do chat:** rejeitado por proibição explícita (CLI/build-only).
- **D — Resolver ranking por cidade via N queries Payload (uma por cidade):** ~417 round-trips por chamada; inviável.

**Recomendação: A.** Porque a intenção sanciona explicitamente o par artefato (candidato) + derivação (terceiros) e o artefato É a fonte do mapa — usar SQL para o candidato criaria a “segunda fonte paralela” que a intenção proíbe, a um custo de ~100k linhas por mensagem. **Rejeitadas:** B/C (scan no request + duplicação do artefato), D (latência).

**Semântica de rank = exatamente a do mapa:** o builder do artefato (`scripts/build-election-aggregates.mjs`) faz `rank = ahead + 1` (ahead = candidatos com votos > próprios), `candidates` = candidatos com votos > 0, e pula cidade onde o próprio candidato tem 0 votos. Isso é idêntico a `RANK() OVER (PARTITION BY city_code ORDER BY votes DESC)` após filtrar `votes > 0` — empate divide colocação e o denominador é honesto. O int test abaixo trava essa equivalência.

### Componentes / mudanças

- **`src/lib/leadingMunicipalities.ts`** (novo, puro — sem import de servidor; testável unit): tipos (`LeadingMunicipalityRow { city, slug, rank, votedCandidates, votes }`, `LeadingMunicipalitiesResult`), `campaignCandidateLeadingMunicipalities(year, topN)` (path do artefato: agrupa `municipalityCatalog` por cidade → `getFederalCompetitiveRank(ibgeCode, year)` filtra `rank ≤ topN` → soma `votesByYear` sobre os slugs da cidade → slug de página `null` para cidade-zona (Salvador) / slug do município caso contrário), `sortLeadingMunicipalityRows` (rank asc, votos desc). Sem duplicar o ranker JS (o SQL é a única implementação; o int test valida a fórmula ad hoc).
- **`src/utilities/ai/tools/getLeadingMunicipalities.ts`** (novo):
  - `export const loadLeadingMunicipalitiesForCandidate(payload, { candidateNumber, year, topN })` — executa o SQL window-rank via `payload.db.drizzle` + `sql` de `@payloadcms/db-postgres` (precedente exato `supporterListOverviewAggregate.ts`), mapeia `city_code` → cidade canônica (`municipalityForTseCityCode`) → slug (`municipalityCatalogEntriesForCity`). Exportado para o int test importar o path real.
  - tool factory `getLeadingMunicipalities(ctx)`: schema `{ candidate?: string, year?=2022, topN?=1 (1..20) }`; `execute` → `assertCanReadElectionData(ctx.user)` fail-closed (leader → `{ error: 'Leitura de dados eleitorais negada.' }`), valida ano em 2014/2018/2022, default/branch do candidato da campanha (inclusive quando o usuário resolve p/ o número 1313) → artefato; senão resolve candidato (`electionCandidate` por número exato ou nome ILIKE urnaName/completeName; fallback `electionCandidateVote` distinct quando o registro não achar; >1 → devolve opções pro modelo desambiguar) e usa o SQL.
- **Migration:** nenhuma.
- **Access / Consent:** `assertCanReadElectionData` (única redação da regra); nenhuma chave de Consent.
- **UI:** Impeccable A — resposta em markdown no chat existente; nenhuma superfície nova.
- **Registro:** `src/utilities/ai/tools/index.ts` + orientação em `src/utilities/ai/systemPrompt.ts` (pt-BR): quando usar, default Jorge Solla, “uma linha por cidade”, oferecer link via `buildCampaignLinks` quando útil, “sem dados” explícito.

### Dados → forma

- Forma: lista textual no chat — contagem total + linhas ordenadas (colocação, cidade, votos, “de N candidatos votados”). Rejeitada: tabela/badge/UI nova (fora do appetite; rabbit hole) e série/chart (anti-goal “leaderboard de vitórias”). Cada cidade tem um lugar; Salvador linha única (sem link de página única até B178 → `slug: null`).

## Fases verificáveis

1. **Tracer / server** — lib pura + tool + registro + system prompt; unit tests do path do artefato (Solla 2022: `total ≥ 1`, uma linha por cidade, Salvador única, `rank ≤ topN`, ordenação) e do lockdown (leader nega).
2. **Int test** (`tests/int/leadingMunicipalities.int.spec.ts`, sob `ELECTION_COLLECTIONS_LEASE_KEY` + fixtures TSE como `electionResultsImport.int.spec.ts`): importa fixtures, valida SQL path com outputs exatos (Salvador 1313 = rank 1, 2100 votos, 2 candidatos — zonas dobradas numa cidade; Feira idem; 2222 topN=1 vazio / topN=2 rank 2) e compara SQL × fórmula do builder (consistência de semântica).
3. **Gates** — `pnpm gate:fast` na iteração; entrega com `pnpm push`.

## Rabbit holes / Não escopo (engenharia)

- Não criar “referência JS duplicada” do ranker (o SQL é a única implementação; teste fixa a semântica).
- Não estender a `bahiaElectionAggregates.ts` com accessors novos só para isto (itero o catálogo p/ chegar no rank por IBGE).
- Não travar/cachear o SQL (dados de eleição são imutáveis; cada chamada é boundary e o query é único e indexado).
- Não tocar nos tools existentes (`getTopDeputies`/`getMunicipalityVotes`) — correção do possível leak de leader neles é item separado (registrar como débito).
- Não mexer no artefato nem no builder do mapa.

## Riscos e mitigação

- **SQL com casas de enum:** `office`/`turn`/`vote_type` são enums → literais inline vindos de constantes do código (sem input do usuário), números por params — mesmo padrão dos aggregates C6.
- **Drift de schema da tabela:** nomes de colunas vêm da migration congelada; guarda `payload.db.name === 'postgres'` + `drizzle.execute` presente (precedente do overview de apoiadores).
- **Lista grande (≥ centenas de cidades) em topN alto:** resposta honesta; o modelo resume; cap `topN ≤ 20`.
- **Lockdown:** `assertCanReadElectionData` no topo do `execute` (fail-closed); testado.
- **SQL path vs artefato divergirem pro candidato da campanha:** mesma tabela TSE; int test trava a fórmula; sem mecanismo de drift em prod (artefato pré-computado).

## Aceite de engenharia

- [ ] Aceite de produto da intenção coberto (contagem, top-N, empate, Salvador 1 linha, default Solla, lockdown, sem inventar número)
- [ ] Invariantes AGENTS/engineering-standards (sem server-only no lib; bypass justificado; pt-BR no prompt; identificadores em inglês)
- [ ] Testes previstos: unit (artefato + lockdown) e int (SQL path + equivalência de semântica) — onde o path de acesso/dados muda
