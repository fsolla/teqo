# Insight: alavancagem da chapa (conversão + oportunidade de virada)

Status: rascunho
Atualizado em: 2026-07-19
Item do roadmap: [docs/roadmap.md](../roadmap.md) (Trilha A, item A5 — um dos cinco insights derivados do baseline)
Responsável: —

## Referência visual (UX Pilot)

Design: [`Baseline-Eleitoral-2022.png`](../design-refs/latest/Baseline-Eleitoral-2022.png) · [`Baseline-Eleitoral-2022.html`](../design-refs/latest/Baseline-Eleitoral-2022.html)

![Card Insights do território com linha Alavancagem da chapa](../design-refs/latest/Baseline-Eleitoral-2022.png)

Como usar:

- **Adotar a estrutura:** card "Insights do território" no detalhe do núcleo — uma linha/Alert por insight (ícone + veredito curto + números de apoio). A linha existente "Alavancagem da chapa: 22% · Da base Lula/Jerônimo ainda não convertida" cobre a **Fase 1**. A **Fase 2** (oportunidade de virada) entra como **segunda linha** no mesmo stack quando algum gatilho dispara — não inventar tela nova.
- **Fora deste plano:** Gap vs 2022 (já em A4), conversão/classificação/mobilização/competitiva (outros planos A5), dobradinha 2026 (A6).
- **Ajustar cores e código:** o HTML/PNG usa a paleta antiga (vermelho escuro `#8E0E23`, navy `#1B2B4B`, dourado `#C8874B`) e Tailwind via CDN. Implementar com `Alert` / tokens do tema `data-theme='campaign'` (`src/app/(frontend)/styles.css`), no stack `NucleusInsights.tsx`.

## Contexto

Solla (PT) apoia a chapa majoritária de esquerda (Lula presidente, Jerônimo governador — `BASELINE_TICKET_2022` em `src/lib/electionResults.ts`). O baseline TSE 2022 (A3/A4) já expõe no detalhe do núcleo:

- votos da chapa (`president` / `governor` via `getNucleusElectoralBaseline`);
- `winnerFederal` (mais votado a dep. federal na geografia, com `party`);
- ranking federal agregável por candidato (hoje materializado no loader; A7 F1 deve agregar no SQL);
- em `electionTally`, por município×zona×cargo×turno: `winnerCandidateName` / `winnerParty` / `winnerVotes` (ainda **não** no view model do núcleo).

Hoje o único insight ligado à chapa no produto é o Gap vs 2022 (candidato). Faltam dois sinais de alavancagem da majoritária:

1. **Conversão da base** — quanto da base Lula/Jerônimo a estimativa confirmada já captura.
2. **Oportunidade de virada** _(produto 2026-07-19)_ — território onde o eleitorado já escolheu (ou favorece) o time majoritário de esquerda, mas o voto **proporcional federal** ainda foi para a direita — seja porque o **mais votado** federal é de direita, seja porque a **soma dos votos de partidos de direita** é alta em relação ao total válido. Em ambos os casos o discurso de **completar a chapa / eleger o time** é operacionalmente útil.

A Fase 2 foi **absorvida neste plano** (não virou item A5 paralelo): mesma superfície (`NucleusInsights`), mesmos dados TSE, mesma taxonomia de espectro que a dobradinha A6 precisará depois. Precedente: Gap vs 2022 absorvido no baseline.

## Objetivos

- **Fase 1 — conversão:** `ticketLeverage` = `confirmedVoteEstimate / lulaVotes` (e `/ jeronimoVotes`); % capturada, teto da chapa e gap no detalhe; no overview, `Σ estimate / Σ lulaVotes` sobre o filtro.
- **Fase 2 — oportunidade de virada:** detectar, na geografia do núcleo (com majoritários de esquerda), **qualquer** dos gatilhos abaixo e exibir Alert com copy de completar a chapa; no overview, contagem de núcleos com oportunidade.
  - **Gatilho A — vencedor federal de direita:** `winnerFederal.party` → espectro `direita`.
  - **Gatilho B — participação da direita alta:** `rightShare = Σ votos federais (partido→direita) / Σ votos federais válidos nominais` ≥ limiar versionado — **mesmo se o mais votado não for de direita** (ex.: vencedor de centro/esquerda estreito, mas PL+PP+União+… somam 35%+).
- Guardrails: **leitura derivada** — sem escrita, sem `Consent`, sem migration, sem collection nova; `overrideAccess: false`; falha fechada se faltar tally/voto ou partido fora do mapa (não inventar classificação).

## Decisões travadas

- **Duas fases no mesmo insight A5, não item novo.** Fase 1 = métrica contínua; Fase 2 = flag com gatilhos A e/ou B. _(produto 2026-07-19)_
- **Gatilho B é independente do vencedor.** Participação proporcional da direita basta; o vencedor de direita (A) é caso especial de B com share concentrado, mas A e B disparam o mesmo Alert com `trigger: 'winner' | 'share' | 'both'` para o copy citar o motivo certo. _(refino de produto 2026-07-19)_
- **Espectro por partido, estático e versionado** — `SG_PARTIDO` → `esquerda | direita | centro | outro` em `src/lib/electionPartySpectrum.ts`. Fonte inicial: federações/coligações 2022. Sem ML. _(compartilhável com A6)_
- **Share usa votos nominais federais agregados por partido**, não legenda isolada no v1 (legenda pode entrar depois se o seed expuser). Denominador = soma dos nominais na geografia (turno 1 dep. federal), alinhado ao ranking A4.
- **Vencedores majoritários vêm de `electionTally.winner*`** (turno decisivo), agregados por geografia; federal A usa `winnerFederal`; federal B precisa da **soma por espectro** — preferir a mesma agregação que A7 F1 (`SUM(votes) GROUP BY party` ou por candidato→partido), não materializar todas as rows no React.
- **Campanha é esquerda via ticket** — `BASELINE_TICKET_2022.*.party` (PT) no mapa; Fase 2 só faz sentido quando majoritários locais são esquerda (pré-condição) e o proporcional ainda “vaza” para a direita.
- **Fase 2 opt-in na UI** — Alert só quando `status === 'opportunity'`; silêncio caso contrário.
- **i18n/naming:** `computeTicketLeverage`, `computeTicketFlipOpportunity`, `partySpectrum`, `rightShare`, `winnerPresident`, `winnerGovernor`; strings em pt-BR.

## Questões em aberto

- **Limiar do gatilho B (`RIGHT_SHARE_THRESHOLD`)?** **Recomendação:** `0.25` (25% dos nominais federais) como constante versionada em `electionInsights.ts`; validar com produto (faixa plausível 20–35%). Abaixo do limiar e sem gatilho A → sem Alert.
- **Turno decisivo dos majoritários?** **Recomendação:** 2º turno (pres./gov.); fallback para 1º se não houver tally de 2º.
- **Geografia multi-zona com vencedores majoritários diferentes?** **Recomendação:** somar `winnerVotes` por candidato; empate → `ambiguous` (não dispara). Share federal (B) soma todas as zonas sem ambiguidade.
- **Partido ausente do mapa?** **Recomendação:** votos com espectro `null` entram no denominador mas **não** no numerador da direita (fail-closed no share); se o vencedor federal tiver partido desconhecido → gatilho A não dispara.
- **Exigir os dois majoritários esquerda?** **Recomendação:** **ambos**; validar com produto se quiserem OR.
- **Quando A e B disparam juntos?** **Recomendação:** um único Alert com `trigger: 'both'` e copy que menciona o vencedor **e** o % da direita.
- **`lideranca` vê?** **Recomendação:** sim (dado público).
- **Overview:** **Recomendação:** contagem de núcleos com oportunidade; breakdown A vs B opcional no v1.

## Abordagem proposta

```mermaid
flowchart LR
    Tally["electionTally<br/>winner* pres/gov"]
    FedAgg["agregação federal<br/>por candidato + por partido"]
    Spec["electionPartySpectrum.ts"]
    Est["confirmedVoteEstimate"]
    F1["computeTicketLeverage"]
    F2["computeTicketFlipOpportunity<br/>pré-condição majoritária esq<br/>+ gatilho A winner dir<br/>+ gatilho B rightShare ≥ limiar"]
    UI["NucleusInsights<br/>Alert F1 + Alert F2 condicional"]
    Overview["NucleusListOverview<br/>Σ leverage + contagem flip"]
    Tally --> F2
    FedAgg --> F2
    Spec --> F2
    Est --> F1
    F1 --> UI
    F2 --> UI
    F1 --> Overview
    F2 --> Overview
```

Componentes:

- **`electionPartySpectrum.ts`** (`src/lib/electionPartySpectrum.ts`): `partySpectrum(party) → 'esquerda' | 'direita' | 'centro' | 'outro' | null`; teste de cobertura dos `SG_PARTIDO` do seed BA 2022.
- **`computeTicketLeverage`** (`src/lib/electionInsights.ts`): Fase 1 — `{ lulaLeverage, jeronimoLeverage, lulaGap, jeronimoGap, status }`.
- **`computeTicketFlipOpportunity`** (`src/lib/electionInsights.ts`): entrada `{ winnerPresident, winnerGovernor, winnerFederal, federalVotesByParty: Record<string, number> | Array<{ party, votes }> }` → `{ status, trigger, rightShare, rightVotes, totalFederalVotes, president, governor, federal, message }`. Pré-condição: ambos majoritários `esquerda`. Gatilho A: espectro do `winnerFederal` = `direita`. Gatilho B: `rightShare >= RIGHT_SHARE_THRESHOLD`. `status`: `opportunity | noOpportunity | ambiguous | unknownSpectrum | incomplete`.
- **Loader** (`nucleusElectoralBaseline.ts` + view model): `winnerPresident` / `winnerGovernor` a partir de tallies; para B, expor `federalVotesByParty` (ou `rightShare` já computado no server) junto da agregação federal — **alinhar com A7 F1** (`GROUP BY` candidato/partido, sem rows zonais no cliente).
- **UI:** `NucleusInsights.tsx` — Alert Fase 1; Alert Fase 2 só em `opportunity` (copy distingue winner vs share vs both). Overview: contagem no `NucleusListOverview`.
- **Testes:** unit — vencedor direita / vencedor esquerda com share 40% / share 10% sem oportunidade / majoritário direita (pré-condição falha) / partido desconhecido / empate majoritário; int do agregador multi-zona.
- **Migration:** nenhuma. Sem Consent.

## Dependências

- **Dura:** A4 Baseline no produto ✓ — `getNucleusElectoralBaseline`, `winnerFederal`, votos da chapa, `electionTally.winner*`, votes federais nominais.
- **Suave (forte na prática):** A7 F1 — agregar federal no detalhe; o gatilho B **precisa** de soma por partido e herda o custo do ranking se A7 atrasar.
- **Suave (saída):** A6 — reusa `electionPartySpectrum` → tiers em `electionAlliances.ts`.
- Reusa: `BASELINE_TICKET_2022`, `NucleusInsights`, `computeGapVs2022`, design `Baseline-Eleitoral-2022`.

## Não escopo

- Sugerir parceiros de dobradinha 2026 → [insight-dobradinha-2026.md](insight-dobradinha-2026.md) (A6).
- Ranking/margem competitiva (top-N, `sollaRank`) → [insight-inteligencia-competitiva.md](insight-inteligencia-competitiva.md) — reusa a mesma agregação, não o copy de virada.
- Classificação/conversão por aptos → outros planos A5.
- Kits WhatsApp ou scripts de discurso gerados — só o insight.
- Persistência do flag no núcleo — sempre derivado.

## Referências

- `docs/roadmap.md` — A5 Insights; grafo A4 → A5; Janela 3 ordem 19
- [baseline-eleitoral-tse.md](baseline-eleitoral-tse.md) — A3/A4
- [escala-dry-pos-a4.md](escala-dry-pos-a4.md) — A7 F1 (agregação federal)
- [insight-dobradinha-2026.md](insight-dobradinha-2026.md) — taxonomia futura
- `src/lib/electionInsights.ts` — padrão `computeGapVs2022`
- `src/lib/electionResults.ts` — `BASELINE_TICKET_2022`
- `src/utilities/nucleusElectoralBaseline.ts` — loader + `winnerFederal`
- `src/utilities/nucleusViewModels.ts` — `NucleusElectoralBaselineViewModel`
- `src/collections/ElectionTally.ts` — `winnerParty` / `winnerVotes`
- `src/collections/ElectionCandidateVote.ts` — votos nominais + `party`
- `src/components/campaign/NucleusInsights.tsx`
- AGENTS.md — Election baseline; naming; `overrideAccess: false`; sem PII
